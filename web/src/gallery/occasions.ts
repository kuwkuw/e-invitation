// The six occasions the gallery covers (adr-017 §1).
//
// Mirrored by hand in `server/src/seo.ts` as `GALLERY_OCCASIONS`, the way
// `types.ts` mirrors `schemas.ts` (NFR-8) — the workspaces cannot import
// across. This mirror matters more than a type mirror: a slug present on one
// side and not the other is a URL the server offers for indexing and the
// client answers with a dead link. Change both in one pass.
export const OCCASION_IDS = [
  "wedding",
  "birthday",
  "kids",
  "christening",
  "corporate",
  "jubilee",
] as const;

export type OccasionId = (typeof OCCASION_IDS)[number];

/** The router's `:occasion` param matches any non-empty segment, so this is
 *  the guard — the same job `isInvitationId` does for `:id` (adr-011 §3). */
export function isOccasionId(value: string): value is OccasionId {
  return (OCCASION_IDS as readonly string[]).includes(value);
}
