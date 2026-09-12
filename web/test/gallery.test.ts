import { describe, expect, it } from "vitest";
import { findSample, GALLERY_DESIGNS, galleryFor, sampleInvitation } from "../src/gallery";
import { isOccasionId, OCCASION_IDS } from "../src/gallery/occasions";
import { COPY_FIELDS } from "../src/types";

describe("occasion ids", () => {
  it("lists the six occasions in a stable order", () => {
    expect([...OCCASION_IDS]).toEqual([
      "wedding",
      "birthday",
      "kids",
      "christening",
      "corporate",
      "jubilee",
    ]);
  });

  it("accepts a known occasion and rejects anything else", () => {
    expect(isOccasionId("wedding")).toBe(true);
    expect(isOccasionId("Wedding")).toBe(false);
    expect(isOccasionId("../etc")).toBe(false);
    expect(isOccasionId("")).toBe(false);
  });
});

describe("gallery content", () => {
  it("gives four wedding examples in both languages", () => {
    expect(galleryFor("wedding", "uk")).toHaveLength(4);
    expect(galleryFor("wedding", "en")).toHaveLength(4);
  });

  it("carries no date, time, venue or city on any example", () => {
    for (const lang of ["uk", "en"] as const) {
      for (const example of galleryFor("wedding", lang)) {
        expect(example.brief.date).toBeNull();
        expect(example.brief.time).toBeNull();
        expect(example.brief.venue).toBeNull();
        expect(example.brief.city).toBeNull();
      }
    }
  });

  it("states the brief's language to match the table it is in", () => {
    expect(galleryFor("wedding", "en")[0].brief.language).toBe("en");
    expect(galleryFor("wedding", "uk")[0].brief.language).toBe("uk");
  });

  it("resolves a sample id to a full invitation", () => {
    const sample = findSample("wedding-romantic", "uk");
    expect(sample).not.toBeNull();
    expect(sample?.occasion).toBe("wedding");
    const invitation = sampleInvitation(sample!);
    expect(invitation.copy.title).toBe("Ми одружуємось!");
    expect(invitation.design.palette).toBe("romantic");
    expect(invitation.background).toBeNull();
  });

  it("returns null for an unknown sample id", () => {
    expect(findSample("wedding-nope", "uk")).toBeNull();
    expect(findSample("", "uk")).toBeNull();
  });

  it("carries the sentence that produced each example", () => {
    for (const example of galleryFor("wedding", "uk")) {
      expect(example.sentence.length).toBeGreaterThan(10);
    }
  });
});

/**
 * The gallery's content is roughly five hundred hand-written strings across
 * two languages (adr-017 §2). The types cover the *keys* and nothing else — an
 * English example left in Ukrainian, a palette repeated four times, a date
 * that crept back into a brief, would all compile. These are the checks that
 * make the content safe to add an occasion at a time.
 */
const CYRILLIC = /[Ѐ-ӿ]/;

describe("gallery table integrity", () => {
  it("gives the two languages the same examples in the same order", () => {
    for (const occasion of OCCASION_IDS) {
      const uk = galleryFor(occasion, "uk").map((e) => e.id);
      const en = galleryFor(occasion, "en").map((e) => e.id);
      expect(en).toEqual(uk);
    }
  });

  it("has design tokens for every example id", () => {
    for (const occasion of OCCASION_IDS) {
      for (const example of galleryFor(occasion, "uk")) {
        expect(GALLERY_DESIGNS[example.id]).toBeDefined();
      }
    }
  });

  it("never repeats an example id across occasions", () => {
    const ids = OCCASION_IDS.flatMap((o) => galleryFor(o, "uk").map((e) => e.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  // Range is half the promise (adr-017 §2): four cards in one palette would
  // tell a visitor the product has exactly one look. Held here rather than by
  // care, the same way SharePanel.test.tsx holds the filled-accent count.
  it("uses a distinct palette for every example of an occasion", () => {
    for (const occasion of OCCASION_IDS) {
      const examples = galleryFor(occasion, "uk");
      if (examples.length === 0) continue;
      const palettes = examples.map((e) => GALLERY_DESIGNS[e.id]?.palette);
      expect(new Set(palettes).size).toBe(examples.length);
    }
  });

  // The rule the whole of §3 rests on: a hardcoded date eventually becomes a
  // past date, and FR-1.8 then refuses to publish the template.
  it("states no date, time, venue or city anywhere, in either language", () => {
    for (const lang of ["uk", "en"] as const) {
      for (const occasion of OCCASION_IDS) {
        for (const example of galleryFor(occasion, lang)) {
          expect(example.brief.date).toBeNull();
          expect(example.brief.time).toBeNull();
          expect(example.brief.venue).toBeNull();
          expect(example.brief.city).toBeNull();
        }
      }
    }
  });

  it("fills every copy field of every example, in both languages", () => {
    for (const lang of ["uk", "en"] as const) {
      for (const occasion of OCCASION_IDS) {
        for (const example of galleryFor(occasion, lang)) {
          for (const field of COPY_FIELDS) {
            expect(example.copy[field]?.trim(), `${lang}/${example.id}/${field}`).not.toBe("");
          }
          expect(example.sentence.trim()).not.toBe("");
          expect(example.style.trim()).not.toBe("");
        }
      }
    }
  });

  it("tags every brief with the language of the table it is in", () => {
    for (const lang of ["uk", "en"] as const) {
      for (const occasion of OCCASION_IDS) {
        for (const example of galleryFor(occasion, lang)) {
          expect(example.brief.language).toBe(lang);
        }
      }
    }
  });

  it("writes no Ukrainian into the English table", () => {
    const untranslated: string[] = [];
    for (const occasion of OCCASION_IDS) {
      for (const example of galleryFor(occasion, "en")) {
        const fields = {
          ...example.copy,
          style: example.style,
          note: example.styleNote,
          sentence: example.sentence,
          event_type: example.brief.event_type,
          tone: example.brief.tone,
          hosts: example.brief.hosts.join(" "),
        };
        for (const [key, text] of Object.entries(fields)) {
          if (CYRILLIC.test(text)) untranslated.push(`${example.id}.${key}`);
        }
      }
    }
    expect(untranslated).toEqual([]);
  });

  it("says something different in each language", () => {
    for (const occasion of OCCASION_IDS) {
      const uk = galleryFor(occasion, "uk");
      const en = galleryFor(occasion, "en");
      for (let i = 0; i < uk.length; i += 1) {
        expect(en[i]?.copy.title).not.toBe(uk[i]?.copy.title);
      }
    }
  });
});
