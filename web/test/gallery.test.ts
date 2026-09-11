import { describe, expect, it } from "vitest";
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
