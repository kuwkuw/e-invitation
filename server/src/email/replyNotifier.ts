// The reply-notification trigger (adr-015 §4, §5): decides whether to tell a
// host about new replies, and hands the message to the sender.
//
// Three modules, three jobs. `notifications.ts` holds the state (who, and when
// they were last told), `send.ts` is the transport, and this decides. That
// split is what lets the rate limit be tested without a network boundary and
// the transport be tested without a database.

import { ensurePref, markNotified, notificationTargets } from "../notifications.js";
import { countNewSince, summarizeRsvps } from "../rsvpSummary.js";
import type { PublishedRecord } from "../store.js";
import { renderReplyNotification } from "./notification.js";
import { emailConfigured, sendEmail } from "./send.js";

const DEFAULT_WINDOW_MINUTES = 60;

/** At most one email per invitation per window (adr-015 §4).
 *
 *  Deliberately long: this is a host catering an event, not a chat
 *  application. An env var rather than a constant because the ADR's revisit
 *  trigger for "the window is wrong in practice" should be an operator change,
 *  not a deploy — the adr-008 and PUBLISH_REQUIRES_ACCOUNT precedent. */
export function notifyWindowMinutes(): number {
  const raw = process.env.NOTIFY_WINDOW_MINUTES;
  if (raw === undefined) return DEFAULT_WINDOW_MINUTES;
  const parsed = Number(raw);
  // A malformed value falls back rather than disabling the limit: an unbounded
  // send rate is the one failure mode this guard exists to prevent, so it is
  // not something a typo should be able to turn off. 0 is honoured, though —
  // it means "notify every reply", the adr-008 convention for a disabled
  // guardrail read the other way round.
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_WINDOW_MINUTES;
  return parsed;
}

function withinWindow(lastNotifiedAt: string, now: Date): boolean {
  const elapsedMs = now.getTime() - new Date(lastNotifiedAt).getTime();
  return elapsedMs < notifyWindowMinutes() * 60_000;
}

/**
 * Tell every eligible host about replies they have not been told about yet.
 *
 * **Never awaited by a request handler and never throws.** The guest's RSVP is
 * already durable on disk and their response has already gone out; there is
 * nobody left to show an error to. A dropped notification costs a nudge, and
 * the next reply after the window carries the full count anyway — which is why
 * §5 takes no retry queue and no dead-letter table.
 *
 * `baseUrl` is the origin the links are built against. It comes from the
 * request rather than an env var because the canonical-host redirect has
 * already run by the time a handler executes, so the host in hand is the one
 * the operator configured.
 */
export async function notifyNewReplies(record: PublishedRecord, baseUrl: string): Promise<void> {
  try {
    // Cheapest check first: with no mail credentials there is nothing to
    // decide, and an unconfigured deployment should not pay for a query on
    // every RSVP (§8).
    if (!emailConfigured()) return;

    const targets = notificationTargets(record.id);
    if (targets.length === 0) return;

    const summary = summarizeRsvps(record.rsvps);
    const now = new Date();

    for (const target of targets) {
      if (target.last_notified_at && withinWindow(target.last_notified_at, now)) continue;

      // A host who has never been told gets every live reply counted, because
      // all of them are news to them. `countNewSince` deliberately returns 0
      // without a baseline — on the dashboard "everything is new" tells a host
      // nothing, but for a first email it is exactly the number.
      const newReplies = target.last_notified_at
        ? countNewSince(summary.rsvps, target.last_notified_at)
        : summary.counts.yes + summary.counts.no;
      if (newReplies === 0) continue;

      await notifyOne(record, target.user_id, target.email, newReplies, baseUrl);
    }
  } catch {
    // Belt and braces. `sendEmail` already never throws, but the store and the
    // database calls above can, and this runs detached from any request — an
    // escaping rejection would be an unhandled rejection rather than a lost
    // notification.
  }
}

async function notifyOne(
  record: PublishedRecord,
  userId: string,
  email: string,
  newReplies: number,
  baseUrl: string,
): Promise<void> {
  // Under opt-in the row already exists — having it, enabled, is what made
  // this account a target — so this is a read that reaches for the token. It
  // stays `ensurePref` rather than `getPref` because it must not be able to
  // return null here, and because `ensurePref` never re-enables: touching the
  // row cannot undo an unsubscribe.
  const pref = ensurePref(userId);

  const invitation = record.versions[record.versions.length - 1];
  if (!invitation) return;

  const message = renderReplyNotification({
    title: invitation.copy.title,
    newReplies,
    language: invitation.brief.language,
    // No `#t=` fragment: the keyring supplies the manage token after sign-in
    // (§2), so a forwarded email grants nothing.
    manageUrl: `${baseUrl}/manage/${record.id}`,
    unsubscribeUrl: `${baseUrl}/unsubscribe/${pref.unsub_token}`,
  });

  const outcome = await sendEmail({
    to: email,
    subject: message.subject,
    html: message.html,
    text: message.text,
    unsubscribeUrl: `${baseUrl}/unsubscribe/${pref.unsub_token}`,
  });

  // Stamped only on success, so a failed send does not consume the window —
  // the next reply tries again immediately. The opposite order would make a
  // provider outage cost an hour of notifications per invitation rather than
  // the one that failed. Nothing hammers a broken provider either way: the
  // rate here is the rate guests reply at.
  if (outcome.ok) markNotified(userId, record.id);
}
