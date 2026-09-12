import type { DesignTokens, EventBrief, InvitationCopy } from "../types";
import type { OccasionId } from "./occasions";

/** One ready-to-use invitation on a gallery page (adr-017 §3).
 *
 *  A full invitation, not a card: the editor regenerates fields from
 *  `invitation.brief`, so an example without one breaks on the first "rewrite
 *  this line". Design tokens are NOT here — they are shared across languages
 *  and live in `designs.ts`, joined by `id`, the same split `LandingPage.tsx`
 *  makes for its hero samples. */
export interface GalleryExample {
  /** Globally unique, URL-safe, stable — this is the `?sample=` value. */
  id: string;
  /** Style name shown under the card ("Романтичний"). */
  style: string;
  /** One line under the style name. */
  styleNote: string;
  /** The sentence this example was generated from. Seeds the editor's
   *  `description` so the host's next chat turn builds on this event rather
   *  than replacing it with an unrelated one (adr-017 §4). */
  sentence: string;
  brief: EventBrief;
  copy: InvitationCopy;
}

/** An example resolved against its design tokens and occasion. */
export interface GallerySample {
  occasion: OccasionId;
  example: GalleryExample;
  design: DesignTokens;
}
