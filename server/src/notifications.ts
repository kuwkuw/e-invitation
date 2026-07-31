// RSVP-notification state (adr-015 §7): who wants to hear about which
// invitation, and when they were last told.
//
// This module decides *whether* and *to whom*, and nothing about sending —
// there is no mail here, no template and no provider. PR 2 adds the sender and
// PR 3 the trigger; keeping the decision separable is what lets the rate limit
// (§4) be tested without a network boundary.
//
// It sits on db.ts beside accounts.ts rather than inside it. The dependency
// runs one way — notifications read the keyring, the keyring knows nothing
// about notifications — which is why `linkInvitation` is untouched by this PR:
// publishing does not create a preference row (see below), so the account
// layer needs no notion that this feature exists.

import { randomBytes } from "node:crypto";
import { getDb } from "./db.js";

/** A stored preference. Its absence is meaningful — see `notificationTargets`. */
export interface NotificationPref {
  user_id: string;
  invitation_id: string;
  enabled: boolean;
  unsub_token: string;
  last_notified_at: string | null;
  created_at: string;
}

/** A host who should be told about replies to one invitation, with everything
 *  the rate limit (adr-015 §4) needs to decide whether to tell them now.
 *
 *  `unsub_token` is null when no row exists yet. The sender mints one with
 *  `ensurePref` immediately before it needs a link, so a token is only created
 *  for a pair that has actually been mailed. */
export interface NotificationTarget {
  user_id: string;
  invitation_id: string;
  email: string;
  last_notified_at: string | null;
  unsub_token: string | null;
}

interface PrefRow {
  user_id: string;
  invitation_id: string;
  enabled: number;
  unsub_token: string;
  last_notified_at: string | null;
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
 *  The LEFT JOIN is what makes an absent preference row mean "enabled, never
 *  notified" rather than "not eligible". Only an explicit `enabled = 0`
 *  removes a host, so a default that is never written cannot drift from a
 *  default that is. */
export function notificationTargets(invitationId: string): NotificationTarget[] {
  const rows = getDb()
    .prepare(
      `SELECT k.user_id       AS user_id,
              k.invitation_id AS invitation_id,
              u.email         AS email,
              p.last_notified_at,
              p.unsub_token
         FROM keyring k
         JOIN users u ON u.id = k.user_id
         LEFT JOIN notification_prefs p
           ON p.user_id = k.user_id AND p.invitation_id = k.invitation_id
        WHERE k.invitation_id = ?
          AND (p.enabled IS NULL OR p.enabled = 1)
        ORDER BY k.created_at ASC`,
    )
    .all(invitationId) as unknown as NotificationTarget[];
  return rows.map((row) => ({
    ...row,
    last_notified_at: row.last_notified_at ?? null,
    unsub_token: row.unsub_token ?? null,
  }));
}

export function getPref(userId: string, invitationId: string): NotificationPref | null {
  const row = getDb()
    .prepare(
      "SELECT user_id, invitation_id, enabled, unsub_token, last_notified_at, created_at" +
        " FROM notification_prefs WHERE user_id = ? AND invitation_id = ?",
    )
    .get(userId, invitationId) as PrefRow | undefined;
  return row ? hydrate(row) : null;
}

/** The row for this pair, created with the defaults if it does not exist yet.
 *
 *  Idempotent, and never resets a setting: a host who turned notifications off
 *  and then triggers this again stays off. The insert is `DO NOTHING` rather
 *  than an upsert for exactly that reason. */
export function ensurePref(userId: string, invitationId: string): NotificationPref {
  getDb()
    .prepare(
      "INSERT INTO notification_prefs" +
        " (user_id, invitation_id, enabled, unsub_token, last_notified_at, created_at)" +
        " VALUES (?, ?, 1, ?, NULL, ?)" +
        " ON CONFLICT (user_id, invitation_id) DO NOTHING",
    )
    .run(userId, invitationId, randomBytes(16).toString("base64url"), nowIso());
  // Read back rather than trusting the insert: on conflict the stored row wins,
  // and it is the stored row — with its original token and timestamps — that
  // every caller needs.
  const pref = getPref(userId, invitationId);
  if (!pref) throw new Error("notification preference vanished immediately after insert");
  return pref;
}

/** Turn notifications on or off for one host's copy of one invitation.
 *
 *  Creates the row when there is none, because "off" is the case that has to
 *  be written down — the default it deviates from is the absence of a row. */
export function setNotificationsEnabled(
  userId: string,
  invitationId: string,
  enabled: boolean,
): NotificationPref {
  ensurePref(userId, invitationId);
  getDb()
    .prepare("UPDATE notification_prefs SET enabled = ? WHERE user_id = ? AND invitation_id = ?")
    .run(enabled ? 1 : 0, userId, invitationId);
  const pref = getPref(userId, invitationId);
  if (!pref) throw new Error("notification preference vanished immediately after update");
  return pref;
}

/** Stamp a successful send. The baseline the adr-015 §4 window measures from,
 *  and the one `countNewSince` counts replies after — which is why it is an
 *  ISO-8601 string like every other timestamp here and like `Rsvp.created_at`:
 *  the two are compared directly. */
export function markNotified(userId: string, invitationId: string, at: string = nowIso()): void {
  ensurePref(userId, invitationId);
  getDb()
    .prepare(
      "UPDATE notification_prefs SET last_notified_at = ? WHERE user_id = ? AND invitation_id = ?",
    )
    .run(at, userId, invitationId);
}

/** One-click unsubscribe (adr-015 §7), which must work from a mail client with
 *  no session — so the token is the whole credential and it can do exactly one
 *  thing. Returns false for an unknown token so the route can answer without
 *  disclosing whether it ever existed.
 *
 *  Disabling only ever affects the one (user, invitation) pair the token names.
 *  It touches no manage token, no keyring row and no other invitation: a host
 *  who unsubscribes from one event keeps every other one, and keeps access to
 *  the responses for this one. */
export function disableByUnsubToken(token: string): boolean {
  const result = getDb()
    .prepare("UPDATE notification_prefs SET enabled = 0 WHERE unsub_token = ?")
    .run(token);
  return Number(result.changes) > 0;
}
