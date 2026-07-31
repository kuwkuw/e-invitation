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

  -- adr-015 §7. A row is a **deviation from the default plus send
  -- bookkeeping**, not a copy of the default: absent means enabled and never
  -- notified, which is what makes "default on" a real default rather than a
  -- value stamped into every publish. Rows appear when a host changes the
  -- setting or when the first notification is sent.
  --
  -- Keyed per (user, invitation) so two accounts holding the same invitation
  -- (FR-11.4 allows it) unsubscribe independently. No foreign key on
  -- invitation_id — invitations are files, not rows, exactly as in keyring.
  --
  -- unsub_token is 16 random bytes and nothing is signed: adr-014 established
  -- there is no signing secret in this codebase because a session cookie's
  -- value "means nothing except as a row key". The same holds here, and the
  -- token's only power is to turn one invitation's mail off for one account.
  CREATE TABLE IF NOT EXISTS notification_prefs (
    user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invitation_id    TEXT NOT NULL,
    enabled          INTEGER NOT NULL DEFAULT 1,
    unsub_token      TEXT NOT NULL UNIQUE,
    last_notified_at TEXT,
    created_at       TEXT NOT NULL,
    PRIMARY KEY (user_id, invitation_id)
  );

  CREATE TABLE IF NOT EXISTS oauth_states (
    state         TEXT PRIMARY KEY,
    nonce         TEXT NOT NULL,
    code_verifier TEXT NOT NULL,
    redirect_uri  TEXT NOT NULL,
    redirect_to   TEXT NOT NULL,
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
  db = opened;
  return db;
}

/** Drop the connection. Tests give each case its own DATA_DIR, and a cached
 *  handle would keep every one of them talking to the first case's file. */
export function closeDb(): void {
  db?.close();
  db = null;
}
