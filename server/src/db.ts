// SQLite for account state (adr-014 §6): users, sessions, and the keyring
// that lets a signed-in host get their manage tokens back on a new device.
//
// It sits *beside* the file store, not in front of it. Published invitations
// stay one JSON file per id under DATA_DIR and store.ts keeps its interface
// and its write-then-rename discipline — NFR-7's single process and single
// volume are unchanged, and the roadmap's "SQLite store" backlog item still
// refers to invitation records, which do not move here.
//
// node:sqlite rather than better-sqlite3: no dependency, no native build in
// the node:22-alpine image, no onlyBuiltDependencies entry, and a synchronous
// API that matches store.ts's readFileSync idiom. It emits an
// ExperimentalWarning on import; the surface used is exec/prepare/get/all/run
// and the base image is pinned, so swapping in better-sqlite3 later is a
// change to this file alone.

import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { dataDir } from "./store.js";

// Loaded through createRequire rather than a plain import, and this is not
// stylistic. `sqlite` is absent from Node 22's `module.builtinModules` because
// it is still flagged experimental, so Vite — which vitest runs the server
// modules through — does not recognise `node:sqlite` as a builtin, tries to
// resolve it as a package, and fails at import time. A require call is opaque
// to that static analysis and lands on Node's real builtin. The `import type`
// above is erased at compile time, so the typing costs nothing.
//
// tsx (dev), tsc → node (prod) and vitest all take this path identically.
// Delete it when `sqlite` graduates into builtinModules.
const { DatabaseSync: Database } = createRequire(import.meta.url)(
  "node:sqlite",
) as typeof import("node:sqlite");

// `users.id` is ours, not Google's: adr-014 §3 keeps a second identity
// provider additive, and a provider-scoped `sub` cannot be the primary key if
// one account might ever carry two of them.
//
// The keyring stores no manage token. It records which invitations an account
// published; the read path joins the token from the record that already
// carries it (adr-014 §1 — "the keyring adds a join, not an exposure"). One
// copy of the credential means none to drift, and account state is worthless
// on its own.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    google_sub  TEXT NOT NULL UNIQUE,
    email       TEXT NOT NULL,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TEXT NOT NULL,
    expires_at  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id);

  CREATE TABLE IF NOT EXISTS keyring (
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invitation_id TEXT NOT NULL,
    created_at    TEXT NOT NULL,
    PRIMARY KEY (user_id, invitation_id)
  );
  -- The keyring's primary key answers "what has this host published"; RSVP
  -- notifications (adr-015 §1) ask the reverse — "who should hear about this
  -- invitation" — which that key cannot serve. One index rather than a second
  -- table: there is exactly one link between an account and an invitation and
  -- it already lives here.
  CREATE INDEX IF NOT EXISTS keyring_invitation_id ON keyring(invitation_id);

  -- adr-015 §7, and the reason there are two tables rather than one: the
  -- **preference is per account** while the **rate-limit window is per
  -- invitation**. They are different questions with different lifetimes, and
  -- one row carrying both would have made the account's answer depend on which
  -- invitation happened to be looked at.
  --
  -- The preference is account-wide because one-click unsubscribe (RFC 8058) is
  -- presented by every mail client as "stop sending me this kind of mail", and
  -- a host who clicks it and keeps receiving mail about their other two events
  -- reports the next one as spam. That costs sender reputation for every
  -- message the product sends, guests' share links included. Per-invitation
  -- control is a later question (adr-015 §7's revisit trigger).
  --
  -- A row is still a **deviation from the default**, not a copy of it: absent
  -- means enabled, which is what makes "default on" a real default rather than
  -- a value stamped into every account. unsub_token is 16 random bytes and
  -- nothing is signed — adr-014 established there is no signing secret here
  -- because a session cookie's value "means nothing except as a row key", and
  -- the same holds for this one.
  CREATE TABLE IF NOT EXISTS notification_prefs (
    user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    enabled     INTEGER NOT NULL DEFAULT 1,
    unsub_token TEXT NOT NULL UNIQUE,
    created_at  TEXT NOT NULL
  );

  -- Send bookkeeping, per (account, invitation): when this host was last told
  -- about this invitation. The adr-015 §4 window measures from here, and
  -- countNewSince counts replies after it. Separate from the preference
  -- above because a host who unsubscribes and resubscribes must not thereby
  -- reset every invitation's window, and because this row is written by the
  -- send path while that one is written by the host.
  --
  -- No foreign key on invitation_id — invitations are files, not rows, exactly
  -- as in keyring.
  CREATE TABLE IF NOT EXISTS notification_sends (
    user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invitation_id    TEXT NOT NULL,
    last_notified_at TEXT NOT NULL,
    PRIMARY KEY (user_id, invitation_id)
  );

  -- browser_key is the sha256 of the binding cookie the authorize leg set
  -- (adr-014 §3). Without it the state is single-use but not *browser-bound*:
  -- an attacker can complete their own handshake, hold the callback back, and
  -- have a victim open it — signing that victim into the attacker's account.
  -- Hashed for the same reason session ids are: a row here is then not a
  -- usable half of the pair.
  CREATE TABLE IF NOT EXISTS oauth_states (
    state         TEXT PRIMARY KEY,
    nonce         TEXT NOT NULL,
    code_verifier TEXT NOT NULL,
    redirect_uri  TEXT NOT NULL,
    redirect_to   TEXT NOT NULL,
    browser_key   TEXT NOT NULL DEFAULT '',
    expires_at    TEXT NOT NULL
  );
`;

let db: DatabaseSync | null = null;

/** Opened lazily on first use, so tests can point DATA_DIR at a scratch dir
 *  before the connection exists — the same reason store.ts reads it lazily. */
export function getDb(): DatabaseSync {
  if (db) return db;
  mkdirSync(dataDir(), { recursive: true });
  const opened = new Database(join(dataDir(), "app.db"));
  // WAL so a read never blocks behind a write. foreign_keys is off by default
  // in SQLite and is per-connection, not per-database — the ON DELETE CASCADE
  // above is what makes account deletion (adr-014 §9) complete, so it has to
  // be set every time the connection is opened.
  opened.exec("PRAGMA journal_mode = WAL");
  opened.exec("PRAGMA foreign_keys = ON");
  opened.exec(SCHEMA);
  migrate(opened);
  db = opened;
  return db;
}

/** Additive column migrations for a database that already exists — SCHEMA
 *  above only ever creates tables that are absent, so a column added to a
 *  shipped table has to be written twice: once there for a fresh deployment
 *  and once here for one that is already running.
 *
 *  Idempotent, and ordered oldest first. There is no version table: SQLite
 *  reports its own columns, which cannot drift from what is actually stored. */
function migrate(database: DatabaseSync): void {
  // oauth_states.browser_key binds an in-flight sign-in to the browser that
  // started it. Rows written before the column existed carry '' and can never
  // match a cookie, so a sign-in caught mid-redirect by the deploy fails and is
  // retried — the fail-closed direction, and a 10-minute row at worst.
  const columns = database.prepare("PRAGMA table_info(oauth_states)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "browser_key")) {
    database.exec("ALTER TABLE oauth_states ADD COLUMN browser_key TEXT NOT NULL DEFAULT ''");
  }
}

/** Drop the connection. Tests give each case its own DATA_DIR, and a cached
 *  handle would keep every one of them talking to the first case's file. */
export function closeDb(): void {
  db?.close();
  db = null;
}
