// The account layer over db.ts (adr-014). Nothing here authorizes anything:
// an account is a keyring, not an owner. `manage_token` remains the credential
// every host-facing endpoint checks in constant time (§1), and this module
// never stores one — `linkInvitation` records that an account published an
// invitation, and the read path joins the token from the record itself.

import { createHash, randomBytes } from "node:crypto";
import { getDb } from "./db.js";

export interface User {
  id: string;
  google_sub: string;
  email: string;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  created_at: string;
  expires_at: string;
}

export interface KeyringEntry {
  invitation_id: string;
  created_at: string;
}

// Long enough that a host who publishes in the spring still has access when
// the event happens — the whole point of accounts is the come-back-later
// visit adr-010 was built for.
const SESSION_TTL_DAYS = 30;

// Session ids are stored hashed, unlike manage tokens, which the file store
// keeps raw. The asymmetry is deliberate: a manage token authorizes one
// invitation and is already sitting in the record it protects, whereas a
// session id authorizes every invitation an account holds. Hashing costs one
// line and means the sessions table is not a set of usable credentials.
function sessionKey(id: string): string {
  return createHash("sha256").update(id).digest("hex");
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Find-or-create by Google `sub` (adr-014 §3), which is stable where email is
 *  not. A returning host whose address changed is the same account, with the
 *  new address recorded — email is data here, never identity. */
export function upsertUser(googleSub: string, email: string): User {
  const db = getDb();
  const existing = db
    .prepare("SELECT id, google_sub, email, created_at FROM users WHERE google_sub = ?")
    .get(googleSub) as User | undefined;
  if (existing) {
    if (existing.email !== email) {
      db.prepare("UPDATE users SET email = ? WHERE id = ?").run(email, existing.id);
      return { ...existing, email };
    }
    return existing;
  }
  const user: User = {
    id: randomBytes(8).toString("base64url"),
    google_sub: googleSub,
    email,
    created_at: nowIso(),
  };
  db.prepare("INSERT INTO users (id, google_sub, email, created_at) VALUES (?, ?, ?, ?)").run(
    user.id,
    user.google_sub,
    user.email,
    user.created_at,
  );
  return user;
}

export function getUser(id: string): User | null {
  const row = getDb()
    .prepare("SELECT id, google_sub, email, created_at FROM users WHERE id = ?")
    .get(id) as User | undefined;
  return row ?? null;
}

/** Returns the session with its **raw** id — the only time it exists in
 *  readable form. The caller puts it in the cookie; the table keeps the hash. */
export function createSession(userId: string): Session {
  const id = randomBytes(32).toString("base64url");
  const created = new Date();
  const expires = new Date(created.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const session: Session = {
    id,
    user_id: userId,
    created_at: created.toISOString(),
    expires_at: expires.toISOString(),
  };
  getDb()
    .prepare("INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .run(sessionKey(id), userId, session.created_at, session.expires_at);
  return session;
}

/** null for an unknown *or* expired session, so a caller cannot accidentally
 *  honour one by forgetting to check the timestamp. ISO-8601 UTC strings
 *  compare lexicographically, which is why expiry is a plain SQL comparison. */
export function getSession(id: string): Session | null {
  const row = getDb()
    .prepare("SELECT user_id, created_at, expires_at FROM sessions WHERE id = ? AND expires_at > ?")
    .get(sessionKey(id), nowIso()) as Omit<Session, "id"> | undefined;
  return row ? { id, ...row } : null;
}

export function deleteSession(id: string): void {
  getDb().prepare("DELETE FROM sessions WHERE id = ?").run(sessionKey(id));
}

/** Sign-out-everywhere, and the first half of account deletion. */
export function deleteUserSessions(userId: string): void {
  getDb().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

export function pruneExpiredSessions(): number {
  const result = getDb().prepare("DELETE FROM sessions WHERE expires_at <= ?").run(nowIso());
  return Number(result.changes);
}

/** Record that this account published — or claimed — this invitation.
 *  Idempotent: a host republishing, or signing in again on a device that
 *  already linked it, must not accumulate rows or move the original link date.
 *
 *  Returns whether a row was actually inserted. Callers that publish ignore it;
 *  the claim route reports the count, because "3 invitations are now in your
 *  account" is only true the first time and must not be said on every sign-in.
 *
 *  Linking is **not exclusive** and deliberately so: two browsers holding the
 *  same manage token are two people the product cannot tell apart, and the
 *  token keeps working for both either way (adr-014 §1). A keyring is a
 *  convenience index over invitations, never a claim of sole ownership. */
export function linkInvitation(userId: string, invitationId: string): boolean {
  const result = getDb()
    .prepare(
      "INSERT INTO keyring (user_id, invitation_id, created_at) VALUES (?, ?, ?)" +
        " ON CONFLICT (user_id, invitation_id) DO NOTHING",
    )
    .run(userId, invitationId, nowIso());
  return Number(result.changes) > 0;
}

/** Newest first — the returning-host list (FR-5.6) leads with what was just
 *  published. Carries no token; the caller joins that from the record. */
export function listKeyring(userId: string): KeyringEntry[] {
  return getDb()
    .prepare(
      "SELECT invitation_id, created_at FROM keyring WHERE user_id = ? ORDER BY created_at DESC",
    )
    .all(userId) as unknown as KeyringEntry[];
}

export function unlinkInvitation(userId: string, invitationId: string): void {
  getDb()
    .prepare("DELETE FROM keyring WHERE user_id = ? AND invitation_id = ?")
    .run(userId, invitationId);
}

/** adr-014 §9: deleting an account removes the user, their sessions and their
 *  keyring (by cascade) — and deliberately **not** the invitations they
 *  published or the RSVPs guests left on them. The share links guests hold
 *  must not break, the RSVP rows are the guests' data rather than the host's,
 *  and the manage token survives on the record, so a host who kept their
 *  manage link still has access. Deletion removes the account, not the event. */
export function deleteUser(id: string): void {
  getDb().prepare("DELETE FROM users WHERE id = ?").run(id);
}
