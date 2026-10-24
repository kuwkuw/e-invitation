// Host-facing RSVP summary (adr-010 §5). Storage stays append-only — a guest
// who changes their mind just submits again (FR-4.4) — so the collapsing
// happens here, at read time. Within a group of answers sharing a normalized
// name the latest one is live and the earlier ones are flagged `superseded`;
// counts cover the live answers only, because `guests` is the headcount the
// host caters on and a changed mind must not inflate it.
//
// This lives in its own module because more than one endpoint answers "how
// many said yes" and they must not answer it differently: a landing-page row
// that disagrees with the dashboard it links to is worse than no row at all
// (adr-012 §3). adr-010's implementation notes already flag `groupKey` as
// duplicated between server and client — one copy on this side is the limit.

import type { Rsvp, RsvpAnswer, RsvpSummary, RsvpSummaryEntry } from "./schemas.js";

export function summarizeRsvps(rsvps: Rsvp[]): RsvpSummary {
  const liveByName = new Map<string, { index: number; created_at: string }>();
  rsvps.forEach((rsvp, index) => {
    const key = groupKey(rsvp.name);
    const live = liveByName.get(key);
    // Scanning forward with >= makes the later arrival win ties, so answers
    // sharing a timestamp resolve by submission order.
    if (live === undefined || rsvp.created_at >= live.created_at) {
      liveByName.set(key, { index, created_at: rsvp.created_at });
    }
  });

  const liveIndexes = new Set([...liveByName.values()].map((live) => live.index));
  const entries: RsvpSummaryEntry[] = rsvps.map((rsvp, index) => ({
    ...rsvp,
    answer: answerOf(rsvp),
    superseded: !liveIndexes.has(index),
  }));
  const live = entries.filter((e) => !e.superseded);
  const said = (answer: RsvpAnswer) => live.filter((e) => e.answer === answer);
  const attending = said("yes");

  return {
    rsvps: entries,
    counts: {
      yes: attending.length,
      no: said("no").length,
      // Reported beside yes and no, never added to `guests` (adr-019 §9.1).
      maybe: said("maybe").length,
      guests: attending.reduce((sum, e) => sum + e.guests_count, 0),
    },
  };
}

/** What a guest said, from either era of record. One written before the
 *  maybe existed has only `attending`, which then meant yes or no; one written
 *  since carries `answer` as well. Nothing rewrites the older ones (there is no
 *  migration step), so this is the one place that reads both. */
export function answerOf(rsvp: Rsvp): RsvpAnswer {
  return rsvp.answer ?? (rsvp.attending ? "yes" : "no");
}

// Replies newer than the host's last visit, for the "N new" marker (adr-012
// §4). The rule matches the dashboard's `newSinceLastVisit` exactly: only live
// answers count (a guest amending an answer is news, their superseded original
// is not), and a missing baseline yields 0 — on a first visit "everything is
// new" tells a host nothing. Kept here, beside `summarizeRsvps`, so the one
// place that decides "how many replies" also decides "how many are new".
export function countNewSince(entries: RsvpSummaryEntry[], seenAt: string | undefined): number {
  if (!seenAt) return 0;
  return entries.filter((entry) => !entry.superseded && entry.created_at > seenAt).length;
}

// Grouping key for re-submissions. Deliberately conservative: only an exact
// name match (ignoring case and stray whitespace) collapses, and both rows
// stay in the list, so two real guests sharing a name is visible to the host
// rather than silently merged.
function groupKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}
