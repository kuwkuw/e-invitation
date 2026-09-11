import { describe, expect, it } from "vitest";
import { findSample, galleryFor, sampleInvitation } from "../src/gallery";
import { isOccasionId, OCCASION_IDS } from "../src/gallery/occasions";

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
