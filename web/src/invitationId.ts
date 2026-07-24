/** The id shape, mirroring the server's `InvitationId` (server/src/schemas.ts)
 *  by hand the same way `types.ts` mirrors `schemas.ts` (NFR-8).
 *
 *  This is a guard, not a convenience: it was the route regex in `main.tsx`
 *  before the router, and it kept `..%2f` and friends out of the API path.
 *  A router's `:id` param matches any non-empty segment, so the check has to
 *  live here now — see adr-011 §3. */
const INVITATION_ID = /^[A-Za-z0-9_-]{6,32}$/;

export function isInvitationId(value: string | undefined): value is string {
  return value !== undefined && INVITATION_ID.test(value);
}
