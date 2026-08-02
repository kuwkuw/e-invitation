// RSVP-notification state (adr-015 §7): whether a host wants reply email at
// all, and when each of their invitations last produced one.
//
// This module decides *whether* and *to whom*, and nothing about sending —
// there is no mail here, no template and no provider. `email/send.ts` is the
// transport and `email/replyNotifier.ts` is the decision; keeping them apart
// is what lets the rate limit be tested without a network boundary.
//
// It sits on db.ts beside accounts.ts rather than inside it. The dependency
// runs one way — notifications read the keyring, the keyring knows nothing
// about notifications — which is why `linkInvitation` is untouched: publishing
// creates no notification state, so the account layer needs no notion that
// this feature exists.
//
// **The preference is per account; the window is per invitation.** One-click
// unsubscribe (RFC 8058) is presented by mail clients as "stop sending me this
// kind of mail", so honouring it for one event only would leave a host still
// receiving mail about their others — and the second click is the spam button,
// which costs sender reputation for everything the product sends. Per-event
// control is a later question; the revisit trigger is in the ADR.
//
// **Reply email is opt-in** (adr-015 §7, amended). The absence of a row is
// *off*: nothing is sent to an account that has not asked for it. The original
// decision was default-on, and what reversed it was not consent — this is
// transactional mail to the account owner's own verified address about their
// own event — but deliverability. The sending domain is new and has no
// reputation, and a spam press on unasked-for mail costs inbox placement for
// everything the product sends, guests' share links included.

import { randomBytes } from "node:crypto";
import { getDb } from "./db.js";

/** An account's answer to "email me about replies". Its absence is meaningful
 *  — see `notificationTargets`. */
export interface NotificationPref {
  user_id: string;
  enabled: boolean;
  unsub_token: string;
  created_at: string;
}

/** A host who should be told about replies to one invitation, with everything
 *  the rate limit (adr-015 §4) needs to decide whether to tell them now.
 *
 *  `last_notified_at` is null until this invitation has produced a send.
 *  `unsub_token` is typed nullable because the row shape allows it, but under
 *  opt-in a target always has a preference row — it is what made it a target —
 *  so in practice it is always present. The sender does not rely on that: it
 *  reads the token back through `ensurePref`. */
export interface NotificationTarget {
  user_id: string;
  invitation_id: string;
  email: string;
  last_notified_at: string | null;
  unsub_token: string | null;
}

interface PrefRow {
  user_id: string;
  enabled: number;
  unsub_token: string;
  created_at: string;
}

function hydrate(row: PrefRow): NotificationPref {
  // SQLite has no boolean type; `enabled` crosses as 0/1 and is converted here
  // so no caller has to remember that a stored 0 is truthy in JavaScript's
  // opinion only if you forget to compare it.
  return { ...row, enabled: row.enabled !== 0 };
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Every host who should be notified about this invitation right now.
 *
 *  The reverse of `listKeyring`, and the reason `keyring_invitation_id` exists.
 *  Driven **from the keyring**, so eligibility is exactly adr-015 §1's rule:
 *  an invitation published anonymously has no keyring row, resolves to no
 *  targets, and notifies nobody — silently and forever, until someone
 *  republishes it while signed in (FR-11.4).
 *
 *  **Only an explicit `enabled = 1` produces a target.** The prefs join stays
 *  LEFT so the query reads as "the keyring, filtered", but the condition makes
 *  an absent row exclude the host — which is the whole of opt-in, expressed
 *  once, in the only place that decides who gets mail. The sends join is still
 *  LEFT for its own reason: an absent row there means "never notified", which
 *  is a state the rate limit needs rather than one that removes anybody. */
export function notificationTargets(invitationId: string): NotificationTarget[] {
  const rows = getDb()
    .prepare(
      `SELECT k.user_id       AS user_id,
              k.invitation_id AS invitation_id,
              u.email         AS email,
              s.last_notified_at,
              p.unsub_token
         FROM keyring k
         JOIN users u ON u.id = k.user_id
         LEFT JOIN notification_prefs p ON p.user_id = k.user_id
         LEFT JOIN notification_sends s
           ON s.user_id = k.user_id AND s.invitation_id = k.invitation_id
        WHERE k.invitation_id = ?
          AND p.enabled = 1
        ORDER BY k.created_at ASC`,
    )
    .all(invitationId) as unknown as NotificationTarget[];
  return rows.map((row) => ({
    ...row,
    last_notified_at: row.last_notified_at ?? null,
    unsub_token: row.unsub_token ?? null,
  }));
}

/** Resolve a token without acting on it — what the unsubscribe page's GET
 *  needs, since GET must be able to render the right state without mutating
 *  (adr-015 §7). Null for a token we never minted. */
export function prefByUnsubToken(token: string): NotificationPref | null {
  const row = getDb()
    .prepare(
      "SELECT user_id, enabled, unsub_token, created_at FROM notification_prefs WHERE unsub_token = ?",
    )
    .get(token) as PrefRow | undefined;
  return row ? hydrate(row) : null;
}

export function getPref(userId: string): NotificationPref | null {
  const row = getDb()
    .prepare(
      "SELECT user_id, enabled, unsub_token, created_at FROM notification_prefs WHERE user_id = ?",
    )
    .get(userId) as PrefRow | undefined;
  return row ? hydrate(row) : null;
}

/** This account's preference row, created with the defaults if absent.
 *
 *  The default is **off**, so calling this can never start mail: it mints a
 *  row and an unsubscribe token, not a subscription. `setNotificationsEnabled`
 *  is the only thing that turns anything on.
 *
 *  Idempotent, and never resets a setting: a host who turned notifications off
 *  and then triggers this again stays off. The insert is `DO NOTHING` rather
 *  than an upsert for exactly that reason. */
export function ensurePref(userId: string): NotificationPref {
  getDb()
    .prepare(
      "INSERT INTO notification_prefs (user_id, enabled, unsub_token, created_at)" +
        " VALUES (?, 0, ?, ?) ON CONFLICT (user_id) DO NOTHING",
    )
    .run(userId, randomBytes(16).toString("base64url"), nowIso());
  // Read back rather than trusting the insert: on conflict the stored row wins,
  // and it is the stored row — with its original token — that callers need.
  const pref = getPref(userId);
  if (!pref) throw new Error("notification preference vanished immediately after insert");
  return pref;
}

/** Turn reply email on or off for this account, across every invitation it
 *  holds and every one it publishes later.
 *
 *  Creates the row when there is none, because under opt-in **"on" is the case
 *  that has to be written down** — the default it deviates from is the absence
 *  of a row. That sentence used to read the other way round, and inverting it
 *  is the whole of the reversal on this side. */
export function setNotificationsEnabled(userId: string, enabled: boolean): NotificationPref {
  ensurePref(userId);
  getDb()
    .prepare("UPDATE notification_prefs SET enabled = ? WHERE user_id = ?")
    .run(enabled ? 1 : 0, userId);
  const pref = getPref(userId);
  if (!pref) throw new Error("notification preference vanished immediately after update");
  return pref;
}

/** Stamp a successful send for one invitation. The baseline the adr-015 §4
 *  window measures from, and the one `countNewSince` counts replies after —
 *  which is why it is an ISO-8601 string like every other timestamp here and
 *  like `Rsvp.created_at`: the two are compared directly.
 *
 *  Per invitation, not per account, so a host with two busy events gets an
 *  email about each rather than one silencing the other. Kept in its own table
 *  so unsubscribing and resubscribing cannot reset every window. */
export function markNotified(userId: string, invitationId: string, at: string = nowIso()): void {
  getDb()
    .prepare(
      "INSERT INTO notification_sends (user_id, invitation_id, last_notified_at)" +
        " VALUES (?, ?, ?) ON CONFLICT (user_id, invitation_id)" +
        " DO UPDATE SET last_notified_at = excluded.last_notified_at",
    )
    .run(userId, invitationId, at);
}

/** Test/inspection helper: when this account was last told about this
 *  invitation, or null if never. */
export function lastNotifiedAt(userId: string, invitationId: string): string | null {
  const row = getDb()
    .prepare(
      "SELECT last_notified_at FROM notification_sends WHERE user_id = ? AND invitation_id = ?",
    )
    .get(userId, invitationId) as { last_notified_at: string } | undefined;
  return row?.last_notified_at ?? null;
}

/** One-click unsubscribe (adr-015 §7), which must work from a mail client with
 *  no session — so the token is the whole credential and it can do exactly one
 *  thing. Returns false for an unknown token so the route can answer without
 *  disclosing whether it ever existed.
 *
 *  It turns off **all** reply email for the account, which is what the mail
 *  client promised the host when it offered the button. It touches no manage
 *  token, no keyring row and no invitation: the host keeps every event and
 *  keeps access to every response. */
export function disableByUnsubToken(token: string): boolean {
  const result = getDb()
    .prepare("UPDATE notification_prefs SET enabled = 0 WHERE unsub_token = ?")
    .run(token);
  return Number(result.changes) > 0;
}
