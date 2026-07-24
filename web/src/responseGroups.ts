// The server returns responses in arrival order with a `superseded` flag
// (adr-010 §5). The host-manage template shows something different: one row
// per guest, newest first, with any answer they replaced tucked underneath.
// That regrouping is presentation, so it lives here.

import type { RsvpEntry } from "./types";

export interface ResponseGroup {
  /** The answer that counts. */
  live: RsvpEntry;
  /** Everything it replaced, newest first. Usually empty. */
  previous: RsvpEntry[];
}

/** Mirrors the server's grouping key deliberately — the two must agree on what
 *  "the same guest" means, or a row would nest under the wrong answer. Kept in
 *  sync by hand, like `types.ts` mirrors `schemas.ts` (NFR-8). */
function groupKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

const newestFirst = (a: RsvpEntry, b: RsvpEntry) => b.created_at.localeCompare(a.created_at);

export function groupResponses(rsvps: RsvpEntry[]): ResponseGroup[] {
  const byGuest = new Map<string, RsvpEntry[]>();
  for (const rsvp of rsvps) {
    const key = groupKey(rsvp.name);
    const existing = byGuest.get(key);
    if (existing) existing.push(rsvp);
    else byGuest.set(key, [rsvp]);
  }

  const groups: ResponseGroup[] = [];
  for (const entries of byGuest.values()) {
    const ordered = [...entries].sort(newestFirst);
    // The server marks exactly one live answer per guest; falling back to the
    // newest keeps the list rendering even if that ever stops being true.
    const live = ordered.find((entry) => !entry.superseded) ?? ordered[0];
    if (!live) continue;
    groups.push({ live, previous: ordered.filter((entry) => entry !== live) });
  }

  return groups.sort((a, b) => newestFirst(a.live, b.live));
}
