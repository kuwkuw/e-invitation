// Share-loop instrumentation (adr-013 §2): one flag per invitation this
// browser has already been counted for, so a guest who reopens the link — or
// refreshes it, or comes back to check the address — is one view rather than
// several.
//
// This is what "unique" means in `invitation_views`: **unique browser that has
// not cleared storage**. A second device counts again, a private tab counts
// again, cleared storage counts again. Deliberate, and the number floats high
// because of it. The precise alternative is a server-side set of hashed IPs
// per invitation — a derivative of a network identifier, stored against a
// specific social event, for every guest. NFR-4's whole posture is that the
// only personal data kept is what a guest types into the RSVP form, and
// §5.1 needs the magnitude of a ratio rather than a precise count.
//
// Browser-local like `inv-manage-seen:<id>` and `inv-invitations`, and holds
// no secret: the id is already in the URL the guest followed.
function key(id: string): string {
  return `inv-viewed:${id}`;
}

export function hasBeenViewed(id: string): boolean {
  try {
    return localStorage.getItem(key(id)) !== null;
  } catch {
    // Private-mode Safari and blocked-storage settings throw on access. Treat
    // it as unviewed: the server's per-day dedupe is the backstop, and a page
    // that renders matters more than a counter that is exactly right.
    return false;
  }
}

export function markViewed(id: string): void {
  try {
    // A timestamp rather than a flag, matching `inv-manage-seen:<id>` — it
    // costs the same and is worth having if anything ever needs recency.
    localStorage.setItem(key(id), new Date().toISOString());
  } catch {
    // Non-fatal: the view may be counted again on a later visit.
  }
}
