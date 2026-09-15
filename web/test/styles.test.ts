import { describe, expect, it } from "vitest";
import { blend, contrast, readStyles, rootTokens, sections } from "./cssTokens";

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

describe("glass", () => {
  it("declares both surfaces and their primitives", () => {
    for (const t of [
      "--glass-tint",
      "--glass-tint-solid",
      "--glass-alpha",
      "--glass-alpha-solid",
      "--glass-blur",
      "--glass-edge",
      "--glass-shadow",
    ]) {
      expect(tokens.has(t)).toBe(true);
    }
    expect(css).toMatch(/^\.glass\s*\{/m);
    expect(css).toMatch(/^\.glass-solid\s*\{/m);
  });

  it("ships the -webkit- prefix beside every backdrop-filter", () => {
    const plain = [...css.matchAll(/(?<!-webkit-)backdrop-filter\s*:/g)].length;
    const prefixed = [...css.matchAll(/-webkit-backdrop-filter\s*:/g)].length;
    expect(plain).toBeGreaterThan(0);
    expect(prefixed).toBe(plain);
  });

  // The spec's central rule: the tint alone carries the contrast, so the
  // reduced-transparency fallback cannot be a second design.
  it("keeps ink legible on both surfaces with the blur ignored", () => {
    const ground = tokens.get("--ground") as string;
    const over = (alphaToken: string) =>
      blend("#ffffff", Number(tokens.get(alphaToken)), ground);
    for (const a of ["--glass-alpha", "--glass-alpha-solid"]) {
      expect(contrast(tokens.get("--ink") as string, over(a))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens.get("--ink-muted") as string, over(a))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("degrades to opaque when the viewer asks for less transparency", () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-transparency:\s*reduce\)/);
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });
});

describe("palette-tinted ground", () => {
  // Enum coverage, the same idiom server/test/og.test.ts uses: a seventh
  // palette must not be able to ship an untinted editor.
  it("gives every palette a ground entry, and invents none", () => {
    const palettes = [...css.matchAll(/^\.palette-([a-z]+)\s/gm)].map((m) => m[1]);
    const grounds = [...css.matchAll(/\.cc-shell\[data-palette="([a-z]+)"\]/g)].map((m) => m[1]);
    expect([...new Set(palettes)].sort()).toEqual([...new Set(grounds)].sort());
  });

  it("keeps every ground light, so a dark card floats on light", () => {
    // festive is a dark navy card; its ground must not follow it down.
    for (const m of css.matchAll(/\.cc-shell\[data-palette="[a-z]+"\]\s*\{([^}]*)\}/g)) {
      const ground = /--ground:\s*(#[0-9a-f]{6})/i.exec(m[1]);
      expect(ground).not.toBeNull();
      expect(contrast(tokens.get("--ink") as string, (ground as RegExpExecArray)[1])).toBeGreaterThanOrEqual(4.5);
    }
  });
});

/** Sections converted to the material system. Each future surface conversion
 *  ADDS a name here — that is the ratchet. Without it, "we'll tokenise the
 *  rest later" is an intention rather than a checkable claim, and the second
 *  surface arrives with fresh literals.
 *
 *  `Invitation card` is permanently absent by design: its values are mirrored
 *  by hand in server/src/og/render.ts. */
const CONVERTED = ["App chrome", "Creation chat"];

describe("no raw hex in converted sections", () => {
  const parts = sections(css);

  for (const name of CONVERTED) {
    it(`keeps ${name} on tokens`, () => {
      const body = parts.get(name);
      expect(body, `section "${name}" not found — did a banner comment change?`).toBeDefined();
      // .cc-sk's three-stop shimmer needs a middle stop lighter than both
      // ends, and tokens have no "one step lighter" operation. The rule
      // carries its own reason in styles.css; minting two more tokens that
      // nothing else would use is worse.
      const scanned = (body as string).replace(/\.cc-sk\s*\{[^}]*\}/g, "");
      const literals = [...scanned.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]);
      expect(literals).toEqual([]);
    });
  }

  it("names only sections that exist", () => {
    expect(CONVERTED.filter((n) => !parts.has(n))).toEqual([]);
  });
});

describe("the editor canvas", () => {
  it("paints the shell with the tinted ground, not a flat colour", () => {
    const shell = /\.cc-shell\s*\{([^}]*)\}/.exec(css);
    expect(shell).not.toBeNull();
    expect((shell as RegExpExecArray)[1]).toMatch(/--ground-tint-a/);
  });

  it("near-bleeds the card without touching InvitationPreview's own rules", () => {
    // The whole effect is a scoped override. .inv itself must keep its radius,
    // because the guest page and the gallery render the same component.
    expect(css).toMatch(/\.cc-canvas\s+\.inv\s*\{/);
    const base = /^\.inv\s*\{([^}]*)\}/m.exec(css);
    expect((base as RegExpExecArray)[1]).toMatch(/border-radius:\s*14px/);
  });
});
