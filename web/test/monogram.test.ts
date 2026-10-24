import { describe, expect, it } from "vitest";
import { LANDING } from "../src/i18n";
import { monogramFrom } from "../src/monogram";

describe("monogramFrom (adr-019 §9.2)", () => {
  it("joins two hosts' initials with an ampersand", () => {
    expect(monogramFrom(["Марія", "Андрій"])).toBe("М&А");
  });

  it("gives one host one letter", () => {
    expect(monogramFrom(["Олена"])).toBe("О");
  });

  it("splits one string that names two people", () => {
    expect(monogramFrom(["Марія та Андрій"])).toBe("М&А");
    expect(monogramFrom(["Олена й Андрій"])).toBe("О&А");
    expect(monogramFrom(["Mary & John"])).toBe("M&J");
    expect(monogramFrom(["Anna and Tom"])).toBe("A&T");
  });

  it("keeps the first two of three or more", () => {
    expect(monogramFrom(["Мама", "Тато", "Бабуся"])).toBe("М&Т");
  });

  it("reads the first letter, past quotes and capitalisation", () => {
    expect(monogramFrom(["«квітка»"])).toBe("К");
  });

  it("falls back to the product's own letter when no host is named", () => {
    const brandLetter = [...LANDING.uk.brand][0];
    expect(monogramFrom([])).toBe(brandLetter);
    expect(monogramFrom(["  ", "—"])).toBe(brandLetter);
  });
});
