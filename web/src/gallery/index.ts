import type { Invitation, Language } from "../types";
import { GALLERY_EN } from "./content.en";
import { GALLERY_UK } from "./content.uk";
import { GALLERY_DESIGNS } from "./designs";
import { OCCASION_IDS, type OccasionId } from "./occasions";
import type { GalleryExample, GallerySample } from "./types";

// Re-exported so the screens, the prerenderer and the hooks import everything
// from `./gallery` and never reach into its files.
export { GALLERY_DESIGNS } from "./designs";
export { isOccasionId, OCCASION_IDS, type OccasionId } from "./occasions";
export type { GalleryExample, GallerySample } from "./types";

const TABLES = { uk: GALLERY_UK, en: GALLERY_EN };

export function galleryFor(occasion: OccasionId, lang: Language): GalleryExample[] {
  return TABLES[lang][occasion] ?? [];
}

/** Resolve a `?sample=` value. Null for anything unknown — the parameter is a
 *  hint from a link, not a credential, and an unrecognised one means the
 *  editor simply opens empty. */
export function findSample(sampleId: string, lang: Language): GallerySample | null {
  if (!sampleId) return null;
  for (const occasion of OCCASION_IDS) {
    const example = galleryFor(occasion, lang).find((e) => e.id === sampleId);
    const design = GALLERY_DESIGNS[sampleId];
    if (example && design) return { occasion, example, design };
  }
  return null;
}

/** The sample as the editor's own type. `background` is explicitly null: the
 *  AI background layer is an editor action (adr-009), never part of a sample. */
export function sampleInvitation(sample: GallerySample): Invitation {
  return {
    brief: sample.example.brief,
    copy: sample.example.copy,
    design: sample.design,
    background: null,
  };
}

/** Occasions that actually have content, in `OCCASION_IDS` order. Lets the hub
 *  ship before all six are written without listing a tile that leads nowhere. */
export function populatedOccasions(lang: Language): OccasionId[] {
  return OCCASION_IDS.filter((o) => galleryFor(o, lang).length > 0);
}
