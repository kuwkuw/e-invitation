import type { EventBrief } from "../types";
import type { OccasionId } from "./occasions";
import type { GalleryExample } from "./types";

/** English twin of `content.uk.ts`. Same ids, same order, same shape —
 *  `gallery.test.ts` and the `i18n.test.ts` parity walk both hold that. */
function brief(event_type: string, hosts: string[], tone: string): EventBrief {
  return {
    event_type,
    hosts,
    date: null,
    time: null,
    venue: null,
    city: null,
    tone,
    language: "en",
    extra_details: null,
  };
}

export const GALLERY_EN: Partial<Record<OccasionId, GalleryExample[]>> = {
  wedding: [
    {
      id: "wedding-romantic",
      style: "Romantic",
      styleNote: "Handwritten display, warm pastels",
      sentence: "Olena and Andrii are getting married and inviting family and friends",
      brief: brief("wedding", ["Olena", "Andrii"], "romantic"),
      copy: {
        title: "We're getting married!",
        greeting: "Dear family and friends,",
        body: "We would love you to be with us on the day we say yes to each other.",
        details_line: "We'll share the date and place personally",
        rsvp_prompt: "Let us know if you can be there.",
        closing: "Olena & Andrii",
      },
    },
    {
      id: "wedding-formal",
      style: "Formal",
      styleNote: "Banner heading, classic wording",
      sentence: "A formal wedding invitation from Olena and Andrii to their guests",
      brief: brief("wedding", ["Olena", "Andrii"], "formal"),
      copy: {
        title: "Olena and Andrii invite you",
        greeting: "Dear guests,",
        body: "We would be honoured to have you among the people closest to us on our wedding day.",
        details_line: "Details of the ceremony will follow",
        rsvp_prompt: "Kindly confirm your attendance.",
        closing: "The Koval and Melnyk families",
      },
    },
    {
      id: "wedding-festive",
      style: "Festive",
      styleNote: "Left-aligned text, deep accent",
      sentence: "A big wedding party with music and dancing, inviting all our friends",
      brief: brief("wedding", ["Olena", "Andrii"], "festive"),
      copy: {
        title: "Olena and Andrii's wedding",
        greeting: "Dear friends!",
        body: "We're gathering everyone we love for a celebration we've waited a long time for. There will be music, dancing and a great deal of joy.",
        details_line: "The date and place are coming very soon",
        rsvp_prompt: "Tell us if you're celebrating with us.",
        closing: "See you there!",
      },
    },
    {
      id: "wedding-minimal",
      style: "Minimal",
      styleNote: "No ornament, short and modern",
      sentence: "A short modern wedding invitation with no extra words",
      brief: brief("wedding", ["Olena", "Andrii"], "modern"),
      copy: {
        title: "Our wedding is coming",
        greeting: "Hello!",
        body: "We're getting married and we really want you there. Details to follow shortly.",
        details_line: "We'll announce the date soon",
        rsvp_prompt: "Reply whenever you're ready.",
        closing: "Olena + Andrii",
      },
    },
  ],
};
