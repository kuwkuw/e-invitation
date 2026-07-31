import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createSession,
  deleteSession,
  deleteUser,
  deleteUserSessions,
  getSession,
  getUser,
  linkInvitation,
  listKeyring,
  pruneExpiredSessions,
  unlinkInvitation,
  upsertUser,
} from "../src/accounts.js";
import { closeDb, getDb } from "../src/db.js";

let dataDir: string;

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "inv-accounts-test-"));
  process.env.DATA_DIR = dataDir;
});

afterEach(() => {
  closeDb();
  rmSync(dataDir, { recursive: true, force: true });
});

describe("account store", () => {
  it("creates the database under DATA_DIR with foreign keys on", () => {
    const db = getDb();
    expect(existsSync(join(dataDir, "app.db"))).toBe(true);
    // Per-connection, not per-database — and ON DELETE CASCADE is what makes
    // account deletion (adr-014 §9) complete rather than leaving orphans.
    expect(db.prepare("PRAGMA foreign_keys").get()).toEqual({ foreign_keys: 1 });
    expect(db.prepare("PRAGMA journal_mode").get()).toEqual({ journal_mode: "wal" });
  });

  describe("users", () => {
    it("finds an existing account by Google sub rather than creating a second", () => {
      const first = upsertUser("google-sub-1", "host@example.com");
      const again = upsertUser("google-sub-1", "host@example.com");
      expect(again.id).toBe(first.id);
      expect(again.created_at).toBe(first.created_at);
    });

    // adr-014 §3: sub is the identity, email is data. A host who changed
    // address is the same account, not a new one with no invitations.
    it("updates a changed email without changing the account", () => {
      const first = upsertUser("google-sub-1", "old@example.com");
      const moved = upsertUser("google-sub-1", "new@example.com");
      expect(moved.id).toBe(first.id);
      expect(moved.email).toBe("new@example.com");
      expect(getUser(first.id)?.email).toBe("new@example.com");
    });

    it("keeps two Google accounts apart", () => {
      const a = upsertUser("google-sub-1", "a@example.com");
      const b = upsertUser("google-sub-2", "b@example.com");
      expect(a.id).not.toBe(b.id);
    });
  });

  describe("sessions", () => {
    it("stores only a hash, never the id it hands out", () => {
      const user = upsertUser("google-sub-1", "host@example.com");
      const session = createSession(user.id);

      const stored = getDb().prepare("SELECT id FROM sessions").get() as { id: string };
      expect(stored.id).not.toBe(session.id);
      expect(stored.id).toBe(createHash("sha256").update(session.id).digest("hex"));
      // A session id authorizes every invitation an account holds, so the
      // table must not be a set of usable credentials.
      expect(getSession(session.id)?.user_id).toBe(user.id);
    });

    it("refuses an unknown session", () => {
      expect(getSession("not-a-session")).toBeNull();
    });

    it("refuses an expired session and prunes it", () => {
      const user = upsertUser("google-sub-1", "host@example.com");
      const session = createSession(user.id);
      getDb().prepare("UPDATE sessions SET expires_at = ?").run("2020-01-01T00:00:00.000Z");

      expect(getSession(session.id)).toBeNull();
      expect(pruneExpiredSessions()).toBe(1);
      expect(getDb().prepare("SELECT COUNT(*) AS n FROM sessions").get()).toEqual({ n: 0 });
    });

    it("signs out one device without touching the others", () => {
      const user = upsertUser("google-sub-1", "host@example.com");
      const phone = createSession(user.id);
      const laptop = createSession(user.id);

      deleteSession(phone.id);
      expect(getSession(phone.id)).toBeNull();
      expect(getSession(laptop.id)?.user_id).toBe(user.id);

      deleteUserSessions(user.id);
      expect(getSession(laptop.id)).toBeNull();
    });
  });

  describe("keyring", () => {
    it("holds no manage token — only which invitations an account published", () => {
      const user = upsertUser("google-sub-1", "host@example.com");
      linkInvitation(user.id, "abc123");

      // adr-014 §1: the keyring adds a join, not a second copy of the
      // credential. The token lives on the record and nowhere else.
      const columns = getDb()
        .prepare("SELECT name FROM pragma_table_info('keyring')")
        .all() as unknown as { name: string }[];
      expect(columns.map((c) => c.name)).toEqual(["user_id", "invitation_id", "created_at"]);
    });

    it("is idempotent, so republishing does not accumulate rows", () => {
      const user = upsertUser("google-sub-1", "host@example.com");
      linkInvitation(user.id, "abc123");
      const first = listKeyring(user.id)[0];
      linkInvitation(user.id, "abc123");

      const entries = listKeyring(user.id);
      expect(entries).toHaveLength(1);
      // The original link date survives — the row is "this host published
      // this", not "this host last touched this".
      expect(entries[0].created_at).toBe(first.created_at);
    });

    it("lists newest first and keeps accounts separate", () => {
      const host = upsertUser("google-sub-1", "host@example.com");
      const other = upsertUser("google-sub-2", "other@example.com");
      getDb()
        .prepare("INSERT INTO keyring (user_id, invitation_id, created_at) VALUES (?, ?, ?)")
        .run(host.id, "older", "2026-07-01T00:00:00.000Z");
      getDb()
        .prepare("INSERT INTO keyring (user_id, invitation_id, created_at) VALUES (?, ?, ?)")
        .run(host.id, "newer", "2026-07-29T00:00:00.000Z");
      linkInvitation(other.id, "theirs");

      expect(listKeyring(host.id).map((e) => e.invitation_id)).toEqual(["newer", "older"]);
      expect(listKeyring(other.id).map((e) => e.invitation_id)).toEqual(["theirs"]);
    });

    it("unlinks one entry", () => {
      const user = upsertUser("google-sub-1", "host@example.com");
      linkInvitation(user.id, "abc123");
      linkInvitation(user.id, "def456");
      unlinkInvitation(user.id, "abc123");
      expect(listKeyring(user.id).map((e) => e.invitation_id)).toEqual(["def456"]);
    });
  });

  // adr-014 §9. What deletion must remove, and what it must leave alone — the
  // invitations and RSVPs are not this module's to delete, and the assertion
  // that they are untouched lives with the route that owns them.
  it("cascades sessions and keyring when an account is deleted", () => {
    const user = upsertUser("google-sub-1", "host@example.com");
    const session = createSession(user.id);
    linkInvitation(user.id, "abc123");

    deleteUser(user.id);

    expect(getUser(user.id)).toBeNull();
    expect(getSession(session.id)).toBeNull();
    expect(listKeyring(user.id)).toEqual([]);
  });

  it("reopens the same database across connections", () => {
    const user = upsertUser("google-sub-1", "host@example.com");
    linkInvitation(user.id, "abc123");
    closeDb();

    // What a server restart does. The schema bootstrap is CREATE TABLE IF NOT
    // EXISTS, so reopening must find the rows, not a fresh database.
    expect(getUser(user.id)?.email).toBe("host@example.com");
    expect(listKeyring(user.id).map((e) => e.invitation_id)).toEqual(["abc123"]);
  });
});
