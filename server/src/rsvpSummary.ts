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

import type { Rsvp, RsvpSummary } from "./schemas.js";

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
  const entries = rsvps.map((rsvp, index) => ({
    ...rsvp,
    superseded: !liveIndexes.has(index),
  }));
  const attending = entries.filter((e) => !e.superseded && e.attending);

  return {
    rsvps: entries,
    counts: {
      yes: attending.length,
      no: entries.filter((e) => !e.superseded && !e.attending).length,
      guests: attending.reduce((sum, e) => sum + e.guests_count, 0),
    },
  };
}

/**
 * Live answers that arrived after `seenAt` — the "N new since your last visit"
 * number, computed here for the batch endpoint because the browser sends only
 * a baseline and gets back a count (adr-012 §4).
 *
 * Superseded answers never count: a guest amending an answer is news, their
 * replaced original is not. No baseline means zero, not everything — on a
 * first visit "all of them are new" tells a host nothing.
 *
 * The dashboard applies the same rule client-side in `useHostManage`, where it
 * already holds the full list and the `/rsvps` response carries no count.
 * Two implementations of one rule; keep them saying the same thing.
 */
export function countNewSince(summary: RsvpSummary, seenAt: string | undefined): number {
  if (!seenAt) return 0;
  return summary.rsvps.filter((rsvp) => !rsvp.superseded && rsvp.created_at > seenAt).length;
}

// Grouping key for re-submissions. Deliberately conservative: only an exact
// name match (ignoring case and stray whitespace) collapses, and both rows
// stay in the list, so two real guests sharing a name is visible to the host
// rather than silently merged.
function groupKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}
