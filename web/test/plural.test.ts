import { describe, expect, it } from "vitest";
import { GUEST } from "../src/i18n";
import { pluralForm } from "../src/plural";

describe("pluralForm", () => {
  const uk = GUEST.uk.guestForms;
  const en = GUEST.en.guestForms;

  it("applies the Slavic one/few/many rule to Ukrainian guest counts", () => {
    // The RSVP form caps the count at 10, so this is the whole reachable range.
    expect(pluralForm(1, uk)).toBe(uk[0]);
    expect(pluralForm(2, uk)).toBe(uk[1]);
    expect(pluralForm(4, uk)).toBe(uk[1]);
    expect(pluralForm(5, uk)).toBe(uk[2]);
    expect(pluralForm(10, uk)).toBe(uk[2]);
  });

  it("gives 11-14 the many form despite their last digit", () => {
    for (const n of [11, 12, 13, 14]) {
      expect(pluralForm(n, uk)).toBe(uk[2]);
    }
  });

  it("keys off the last digit above 20", () => {
    expect(pluralForm(21, uk)).toBe(uk[0]);
    expect(pluralForm(22, uk)).toBe(uk[1]);
    expect(pluralForm(25, uk)).toBe(uk[2]);
    expect(pluralForm(101, uk)).toBe(uk[0]);
  });

  it("is a no-op for English, where few and many are the same word", () => {
    expect(pluralForm(1, en)).toBe(en[0]);
    expect(pluralForm(2, en)).toBe(en[1]);
    expect(pluralForm(7, en)).toBe(en[2]);
    expect(en[1]).toBe(en[2]);
  });

  it("treats 0 as the many form", () => {
    expect(pluralForm(0, uk)).toBe(uk[2]);
  });
});
