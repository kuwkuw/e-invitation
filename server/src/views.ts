// View-beacon dedupe (adr-013 §6). The guest page fires
// POST /api/invitations/:id/view once per browser, guarded by its own
// `inv-viewed:<id>` flag; this is the server-side backstop for a refresh loop
// or a browser that ignores that flag. It is deliberately not a security
// control — a public counter nobody is paid on does not justify a rate
// limiter, and anyone determined to inflate one still can.
//
// State is in-process like the guardrails (NFR-7), and bounded the same way:
// every entry drops at UTC midnight, so the set never grows past one day's
// worth of distinct (ip, invitation) pairs. adr-013 §6 called this
// process-lifetime; a set that only ever grows is a leak in the one scenario
// the iteration exists to bring about, and the daily drop keeps the property
// that matters — the same reader is not counted twice in one sitting.

function today(): string {
  return new Date().toISOString().slice(0, 10); // UTC day, as in guardrails.ts
}

const seen = new Set<string>();
let seenDay = today();

function rollover(): void {
  const day = today();
  if (seenDay !== day) {
    seen.clear();
    seenDay = day;
  }
}

/** True the first time this ip asks about this invitation today; false for
 *  every repeat until the next UTC day. */
export function claimView(ip: string, id: string): boolean {
  rollover();
  const key = `${ip}:${id}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}

/** Test hook: drop all in-process view state. */
export function resetViewDedupe(): void {
  seen.clear();
  seenDay = today();
}
