// Host feedback state (adr-016): what a host wrote to us, and the operator's
// read of it.
//
// It sits on db.ts beside accounts.ts and notifications.ts, and the dependency
// runs one way like theirs: feedback reads `users` for an address, and nothing
// in the account layer knows this feature exists. Publishing, signing in and
// deleting an account all behave exactly as they did — deletion included,
// which reaches this table only through the ON DELETE SET NULL the schema
// declares (§8).
//
// **The message has one copy.** The route logs metadata about a submission and
// never its body (§7): logs on the hosting platform have a different retention
// and a different deletion story than the volume does, and a host's sentence
// about their event should be removable by one DELETE. Nothing in this module
// prints a message.

import { randomBytes } from "node:crypto";
import { getDb } from "./db.js";
import type { FeedbackEntry, FeedbackPage, Language } from "./schemas.js";

/** A stored message, before the operator's read joins an address onto it. */
export interface Feedback {
  id: string;
  user_id: string | null;
  message: string;
  page: FeedbackPage;
  lang: Language;
  created_at: string;
}

export interface NewFeedback {
  message: string;
  page: FeedbackPage;
  lang: Language;
  /** The signed-in account, or null for a message sent signed out — which is
   *  an ordinary case, not a degraded one (adr-016 §2). */
  userId: string | null;
}

/** Store one message. Returns the row so the route can log its id and length
 *  without holding the body any longer than it already has. */
export function addFeedback(entry: NewFeedback): Feedback {
  const row: Feedback = {
    id: randomBytes(9).toString("base64url"),
    user_id: entry.userId,
    message: entry.message,
    page: entry.page,
    lang: entry.lang,
    created_at: new Date().toISOString(),
  };
  getDb()
    .prepare(
      "INSERT INTO feedback (id, user_id, message, page, lang, created_at)" +
        " VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(row.id, row.user_id, row.message, row.page, row.lang, row.created_at);
  return row;
}

/** Everything a host has written, newest first (adr-016 §6).
 *
 *  The address is **joined here rather than stored** — the same shape adr-014
 *  §1 established for the keyring, where the join is the exposure and it
 *  happens behind a credential. A LEFT JOIN because most rows have no account
 *  at all, and because a deleted account leaves a live row with a null
 *  `user_id` (§8) that must still read back.
 *
 *  `limit` bounds one response, not the table: an operator reading with `curl`
 *  wants the recent ones, and `total` says how many there are in full. */
export function listFeedback(limit = 100): { items: FeedbackEntry[]; total: number } {
  const rows = getDb()
    .prepare(
      `SELECT f.id, f.message, f.page, f.lang, f.created_at, u.email AS email
         FROM feedback f
         LEFT JOIN users u ON u.id = f.user_id
        ORDER BY f.created_at DESC
        LIMIT ?`,
    )
    .all(limit) as unknown as (Omit<FeedbackEntry, "email"> & { email: string | null })[];
  const total = getDb().prepare("SELECT COUNT(*) AS n FROM feedback").get() as { n: number };
  return {
    items: rows.map((row) => ({ ...row, email: row.email ?? null })),
    total: Number(total.n),
  };
}
