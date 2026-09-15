import { describe, expect, it } from "vitest";
import { contrast, readStyles, rootTokens } from "./cssTokens";

// @vitest-environment node

const css = readStyles();
const tokens = rootTokens(css);

describe("material tokens", () => {
  it("declares every token the editor is built from", () => {
    const required = [
      "--ground",
      "--surface",
      "--ink",
      "--ink-muted",
      "--ink-faint",
      "--accent",
      "--accent-hi",
      "--accent-wash",
      "--edge",
      "--r-sm",
      "--r-md",
      "--r-lg",
      "--r-xl",
      "--r-pill",
      "--e-1",
      "--e-2",
      "--e-3",
      "--ease-ios",
      "--dur-fast",
      "--dur-base",
    ];
    expect([...required].filter((t) => !tokens.has(t))).toEqual([]);
  });

  it("keeps the RSVP status pair, which other surfaces still read", () => {
    expect(tokens.get("--rsvp-yes")).toBe("#3d6b47");
    expect(tokens.get("--rsvp-no")).toBe("#a83f3f");
  });
});

describe("token contrast (WCAG 2.1)", () => {
  const ground = () => tokens.get("--ground") as string;

  it("puts body ink on the ground at AA", () => {
    expect(contrast(tokens.get("--ink") as string, ground())).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens.get("--ink-muted") as string, ground())).toBeGreaterThanOrEqual(4.5);
  });

  it("holds --ink-faint to the large-text floor only — it is never body text", () => {
    const ratio = contrast(tokens.get("--ink-faint") as string, ground());
    expect(ratio).toBeGreaterThanOrEqual(3);
    expect(ratio).toBeLessThan(4.5);
  });

  it("keeps white legible on the accent, because that is the Publish button", () => {
    expect(contrast("#ffffff", tokens.get("--accent") as string)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ffffff", tokens.get("--accent-hi") as string)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the accent itself visible on the ground for icons and rules", () => {
    expect(contrast(tokens.get("--accent") as string, ground())).toBeGreaterThanOrEqual(3);
  });
});
