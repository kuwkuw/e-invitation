import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  atRuleSpan,
  bannerTitles,
  blend,
  contrast,
  readStyles,
  rootTokens,
  ruleBlocks,
  sections,
  stripComments,
} from "./cssTokens";

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

  it("keeps --ui-accent-rgb in step with --ui-accent, which it restates by hand", () => {
    const accent = tokens.get("--ui-accent") as string;
    const triplet = (tokens.get("--ui-accent-rgb") as string)
      .split(",")
      .map((n) => Number(n.trim()));
    const fromHex = [1, 3, 5].map((i) => Number.parseInt(accent.slice(i, i + 2), 16));
    expect(triplet).toEqual(fromHex);
  });

  it("aliases --ink to --ui-ink, so the product's ink has a name .palette-* cannot shadow", () => {
    expect(css).toMatch(/--ink:\s*var\(--ui-ink\);/);
    expect(tokens.get("--ink")).toBe(tokens.get("--ui-ink"));
  });

  /** A swatch carries its own palette-* class, so on the swatch element every
   *  name .palette-* sets is the *card's* value. --bg is read there on purpose
   *  (it is the swatch); the product's ink, accent, edge and wash are not, and
   *  must come from their --ui-* aliases or a non-shadowed token instead. */
  it("never reads a palette-shadowed name for the swatch's own chrome", () => {
    const shadowed = new Set<string>();
    for (const m of css.matchAll(/^\.palette-[a-z]+\s*\{([^}]*)\}/gm)) {
      for (const d of m[1].matchAll(/(--[\w-]+)\s*:/g)) shadowed.add(d[1]);
    }
    expect(shadowed.has("--ink")).toBe(true);

    const reads: string[] = [];
    for (const rule of ruleBlocks(stripComments(css))) {
      if (!rule.selectors.some((s) => /\.swatch(?![\w-])/.test(s))) continue;
      for (const v of rule.body.matchAll(/var\((--[\w-]+)/g)) {
        if (shadowed.has(v[1]) && v[1] !== "--bg")
          reads.push(`${rule.selectors.join(", ")}: ${v[1]}`);
      }
    }
    expect(reads).toEqual([]);
  });

  it("keeps the two sub-faint inks below --ink-faint, so a readable tier is never one of them", () => {
    // adr-019 darkened --ink-whisper past 3:1 on --surface, so the tier is
    // held by order rather than by a ceiling: neither may be promoted into
    // --ink-faint's place by a later edit that assumes they are readable.
    // Who may read them is held by "sub-faint inks" below.
    expect(tokens.has("--ink-disabled"), "--ink-disabled was retired with its last user").toBe(
      false,
    );
    const on = (name: string) =>
      contrast(tokens.get(name) as string, tokens.get("--surface") as string);
    for (const name of ["--ink-placeholder", "--ink-whisper"]) {
      expect(tokens.get(name), name).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(on("--ink-whisper")).toBeLessThan(on("--ink-placeholder"));
    expect(on("--ink-placeholder")).toBeLessThan(on("--ink-faint"));
  });

  it("collapses --app-bg onto --ground: one job, one value (adr-019 §1)", () => {
    expect(css).toMatch(/--app-bg:\s*var\(--ground\);/);
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
    const surface = tokens.get("--surface") as string;
    const over = (alphaToken: string) => blend(surface, Number(tokens.get(alphaToken)), ground);
    for (const a of ["--glass-alpha", "--glass-alpha-solid"]) {
      expect(contrast(tokens.get("--ink") as string, over(a))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens.get("--ink-muted") as string, over(a))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("is opaque paper since adr-019: the tint is --surface at alpha 1, and nothing blurs", () => {
    expect(tokens.get("--glass-tint")).toBe(tokens.get("--surface"));
    expect(tokens.get("--glass-tint-solid")).toBe(tokens.get("--surface"));
    expect(Number(tokens.get("--glass-alpha"))).toBe(1);
    expect(Number(tokens.get("--glass-alpha-solid"))).toBe(1);
    expect(tokens.get("--glass-blur")).toBe("none");
  });

  it("leaves reduced transparency no tokens to swap, since nothing is translucent", () => {
    const bare = stripComments(css);
    const span = atRuleSpan(bare, /@media\s*\(prefers-reduced-transparency:\s*reduce\)/);
    expect(span).not.toBeNull();
    const { start, end } = span as { start: number; end: number };
    expect(bare.slice(start, end)).not.toMatch(/:root/);
  });

  it("degrades to opaque when the viewer asks for less transparency", () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-transparency:\s*reduce\)/);
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });

  /** The check above proves only that the block exists. A third glass surface
   *  would blur under Reduce Transparency with every other guard still green:
   *  the prefix test counts declarations file-wide, and the contrast test
   *  reads the two alpha tokens it was written against. So name the
   *  selectors — whatever sets a blur must be cleared by the fallback.
   *
   *  Prefixed-vs-plain parity inside the block is not re-checked here; the
   *  `-webkit-` test above counts the whole file, reduce block included, so
   *  clearing only one of the pair already fails it. */
  it("clears the blur on every selector that sets one, not just the two it shipped with", () => {
    const bare = stripComments(css);
    const span = atRuleSpan(bare, /@media\s*\(prefers-reduced-transparency:\s*reduce\)/);
    expect(span, "no prefers-reduced-transparency block to scan").not.toBeNull();
    const { start, end } = span as { start: number; end: number };

    const blurred = new Set<string>();
    const cleared = new Set<string>();
    for (const rule of ruleBlocks(bare)) {
      if (!/backdrop-filter\s*:/.test(rule.body)) continue;
      const insideFallback = rule.at > start && rule.at < end;
      const clears = insideFallback && /backdrop-filter\s*:\s*none/.test(rule.body);
      for (const selector of rule.selectors) (clears ? cleared : blurred).add(selector);
    }

    // Guards the scan itself: a renamed class or a broken regex would leave
    // both sets empty, and an empty subset check passes for the wrong reason.
    expect(blurred.size).toBeGreaterThan(0);
    expect([...blurred].filter((s) => !cleared.has(s)).sort()).toEqual([]);
  });
});

/** adr-019 §3: a material may wrap the card (the deckled mat does), never sit
 *  on it or inside it — that is what keeps the OG renderer's mirror honest. */
describe("paper materials (adr-019 §3)", () => {
  const MATERIALS = ["grain", "deckle", "seal"];
  const names = (compound: string) =>
    MATERIALS.filter((m) => new RegExp(`\\.${m}(?![\\w-])`).test(compound));

  it("never sit on the card or inside it", () => {
    const selectors = ruleBlocks(stripComments(css)).flatMap((r) => r.selectors);
    const onOrInside = selectors.flatMap((s) => {
      const parts = s.split(/\s*[\s>+~]\s*/).filter(Boolean);
      const at = parts.findIndex((p) => /\.inv[\w-]*/.test(p));
      return at === -1 ? [] : [{ s, parts: parts.slice(at) }];
    });
    expect(onOrInside.length, "no card selectors found to scan").toBeGreaterThan(0);
    expect(
      onOrInside.filter(({ parts }) => parts.some((p) => names(p).length)).map(({ s }) => s),
    ).toEqual([]);
  });

  it("are never rendered by InvitationPreview", () => {
    const preview = readFileSync(
      fileURLToPath(new URL("../src/components/InvitationPreview.tsx", import.meta.url)),
      "utf8",
    );
    expect(preview).toMatch(/className/);
    expect(preview).not.toMatch(/\b(?:grain|deckle|seal)\b/);
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
      expect(
        contrast(tokens.get("--ink") as string, (ground as RegExpExecArray)[1]),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(tokens.get("--ink-muted") as string, (ground as RegExpExecArray)[1]),
      ).toBeGreaterThanOrEqual(4.5);
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
const CONVERTED = [
  "App chrome",
  "Creation chat",
  "Design controls",
  "Guest page",
  "Host manage dashboard",
  "Landing page",
  "Landing: account footer",
  "Landing: returning-host block",
  "Share panel",
];

/** `sections()` keys a Map by banner title, which has two silent bypasses
 *  the loop above cannot see: a duplicate title anywhere in the file makes
 *  `Map.set` drop the earlier section entirely (its bytes belong to no
 *  surviving key), and either bypass leaves raw hex in the orphaned
 *  remainder unpoliced while every existing guard still passes. */
describe("ratchet integrity", () => {
  it("gives every banner section a unique title, so one cannot silently replace another", () => {
    const titles = bannerTitles(css);
    const duplicates = titles.filter((t, i) => titles.indexOf(t) !== i);
    expect(duplicates).toEqual([]);
  });

  it("accounts for the entire file across the preamble and every section, so no bytes fall outside enforcement", () => {
    const parts = sections(css);
    const total = [...parts.values()].reduce((sum, part) => sum + part.length, 0);
    expect(total).toBe(css.length);
  });
});

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

/** Quiet text has to be quiet by size and weight rather than by being hard to
 *  see. Each row names the ground the text actually sits on — a card
 *  (--surface), the page around it (--app-bg), or its own control — and the
 *  floor its role owes: AA for a sentence, NFR-9's 3:1 label floor for a
 *  caption, label, placeholder or timestamp. A selector here must set its
 *  colour as `color: var(--token)`, or the row fails rather than passing
 *  unchecked. */
function textFloors(section: string, rows: [selector: string, ground: string, floor: number][]) {
  const rules = ruleBlocks(stripComments(sections(css).get(section) ?? ""));
  const colourOf = (selector: string) => {
    const rule = rules.find(
      (r) => r.selectors.includes(selector) && /(?:^|[;\s])color\s*:/.test(r.body),
    );
    const token = rule && /(?:^|[;\s])color\s*:\s*var\((--[\w-]+)\)/.exec(rule.body);
    return token ? token[1] : null;
  };

  for (const [selector, ground, floor] of rows) {
    it(`puts ${selector} at ${floor}:1 or better on ${ground}`, () => {
      const token = colourOf(selector);
      expect(token, `${selector} has no color: var(--…) to check`).not.toBeNull();
      const ratio = contrast(tokens.get(token as string) as string, tokens.get(ground) as string);
      expect(ratio, `${selector} reads ${token}`).toBeGreaterThanOrEqual(floor);
    });
  }
}

/** Where a host reads their replies. */
describe("the manage page's text", () => {
  textFloors("Host manage dashboard", [
    [".hm-state-hint", "--surface", 4.5],
    [".hm-empty-reassure", "--surface", 4.5],
    [".hm-notify-scope", "--app-bg", 4.5],
    [".hm-new-line", "--app-bg", 4.5],
    [".hm-breakdown", "--surface", 3],
    [".hm-updated", "--app-bg", 3],
    [".hm-section-title", "--surface", 3],
    [".hm-when", "--surface", 3],
    [".hm-previous", "--surface", 3],
    [".hm-tile-yes .hm-tile-label", "--rsvp-yes-bg", 3],
    [".hm-tile-no .hm-tile-label", "--rsvp-no-bg", 3],
  ]);
});

/** The one page every guest sees, usually inside a messenger's webview. The
 *  not-found page is a bare .gr-page, not a card, so its text sits on
 *  --app-bg; the placeholder is measured on the input at rest, which is the
 *  darker of its two backgrounds; the disabled submit on its own fill. */
describe("the guest page's text", () => {
  textFloors("Guest page", [
    [".gr-status", "--app-bg", 4.5],
    [".gr-thanks-body", "--surface", 4.5],
    [".gr-notfound-body", "--app-bg", 4.5],
    [".gr-notfound-hint", "--app-bg", 4.5],
    [".gr-label", "--surface", 3],
    [".gr-optional", "--surface", 3],
    [".gr-input::placeholder", "--app-bg", 3],
    [".gr-submit:disabled", "--edge-soft", 3],
    [".gr-change", "--surface", 3],
    [".gr-row-sub", "--surface", 3],
    [".gr-cta-line", "--app-bg", 3],
  ]);

  it("fills the disabled submit with --edge-soft, not the ruled line", () => {
    const rule = ruleBlocks(stripComments(sections(css).get("Guest page") ?? "")).find((r) =>
      r.selectors.includes(".gr-submit:disabled"),
    );
    expect(rule?.body).toMatch(/background:\s*var\(--edge-soft\)/);
  });
});

/** The front door. Most of the page sits on --app-bg; the nav, the replies
 *  demo's band and the invitations card are --surface; a chip on its own
 *  wash. The account footer is a strip in --app-bg inside the white card, and
 *  the two lines under the card sit on the page — so both read --app-bg. */
describe("the landing page's text", () => {
  textFloors("Landing page", [
    [".lp-cta", "--accent", 4.5],
    [".lp-nav-signin", "--surface", 4.5],
    [".lp-nav-gallery", "--surface", 3],
    [".lp-hero-copy p", "--app-bg", 4.5],
    [".lp-step-text", "--app-bg", 4.5],
    [".lp-chip", "--accent-wash", 3],
    [".lp-rsvp-copy p", "--surface", 4.5],
    [".lp-rsvp-yes", "--app-bg", 3],
    [".lp-rsvp-no", "--app-bg", 3],
    [".lp-rsvp-wait", "--app-bg", 3],
    [".lp-footer", "--app-bg", 4.5],
  ]);
  textFloors("Landing: returning-host block", [
    [".lp-yours-sub", "--app-bg", 3],
    [".lp-yours-when", "--surface", 3],
    [".lp-yours-count", "--surface", 3],
    [".lp-yours-new", "--surface", 3],
    [".lp-yours-more", "--app-bg", 3],
  ]);
  textFloors("Landing: account footer", [
    [".lp-account-mail p", "--app-bg", 4.5],
    [".lp-cross-device", "--app-bg", 4.5],
    [".lp-signed-in-empty", "--surface", 4.5],
    [".lp-account-email", "--app-bg", 3],
    [".lp-account-out", "--app-bg", 3],
    [".lp-notify-all", "--app-bg", 3],
    [".lp-delete-link", "--app-bg", 3],
  ]);
});

/** The two inks below --ink-faint clear nothing, so every rule that reads one
 *  is named here and none of them is text anyone has to read: the INVINTO
 *  wordmarks are a logotype; .sp-link's colour reaches only the link glyph,
 *  since its value sets its own --ink; and the landing's three `svg` rules
 *  colour aria-hidden icons, each beside words that say what it shows. A new
 *  name in this list is a contrast regression until shown otherwise. */
describe("sub-faint inks", () => {
  it("are read only by the wordmarks and decorative icons", () => {
    const users = ruleBlocks(stripComments(css))
      .filter((r) => /var\(--ink-(?:placeholder|whisper)\)/.test(r.body))
      .flatMap((r) => r.selectors)
      .sort();
    expect(users).toEqual([
      ".gr-brand",
      ".gr-cta-mark",
      ".hm-brand",
      ".lp-account-id svg",
      ".lp-cross-device svg",
      ".lp-yours-row svg",
      ".sp-link",
    ]);
  });
});

/** The display face is on :root because its readers sit on different roots:
 *  the landing's headings under .landing, the gallery's under a bare .gl. It
 *  used to be declared on .landing alone, so every heading on the seven
 *  indexed gallery pages read an undefined property and fell back to the
 *  body's system sans, with nothing in any log to say so. */
describe("the chrome's faces (adr-019 §2)", () => {
  it("are Literata for display and Golos Text for body, each a :root token", () => {
    expect(tokens.get("--ui-font-display")).toMatch(/^"Literata",/);
    expect(tokens.get("--ui-font-body")).toMatch(/^"Golos Text",/);
    expect(css).toMatch(/^body\s*\{[^}]*font-family:\s*var\(--ui-font-body\);/m);
  });

  it("carries the two @kind font annotations design-sync reads, one per face", () => {
    const annotated = css.split("\n").filter((line) => line.includes("@kind font"));
    expect(annotated.map((line) => /^\s*(--[\w-]+):/.exec(line)?.[1])).toEqual([
      "--ui-font-display",
      "--ui-font-body",
    ]);
  });

  it("requests exactly the axes adr-019 §2 settles, and keeps the four card families", () => {
    const url = /@import url\("([^"]+)"\)/.exec(css)?.[1] ?? "";
    for (const family of [
      "family=Literata:ital,opsz,wght@0,7..72,400..500;1,7..72,400",
      "family=Golos+Text:wght@400..800",
      "family=Playfair+Display:",
      "family=Cormorant+Garamond:",
      "family=Manrope:",
      "family=Marck+Script",
    ]) {
      expect(url).toContain(family);
    }
  });

  /** Literata is requested at 400–500 only; any other weight is synthesized. */
  it("sets every display-face rule at a weight Literata is requested in", () => {
    const off = ruleBlocks(stripComments(css))
      .filter((r) => /font-family:\s*var\(--ui-font-display\)/.test(r.body))
      .filter((r) => !/font-weight:\s*(?:400|500)\s*(?:;|$)/.test(r.body))
      .map((r) => r.selectors.join(", "));
    expect(off).toEqual([]);
  });

  it("sets the INVINTO wordmarks in Literata 500, tracked 0.32em (adr-019 §2)", () => {
    for (const selector of [".lp-brand", ".gr-brand", ".hm-brand"]) {
      const rule = ruleBlocks(stripComments(css)).find((r) => r.selectors.includes(selector));
      expect(rule?.body, selector).toMatch(/font-family:\s*var\(--ui-font-display\)/);
      expect(rule?.body, selector).toMatch(/font-weight:\s*500/);
      expect(rule?.body, selector).toMatch(/letter-spacing:\s*0\.32em/);
    }
  });

  /** A custom property declared on a class reaches only that class's subtree.
   *  The card's own names are the one sanctioned case: .inv sets them and
   *  .palette-* / .type-* override them, for the card and for the swatches
   *  that carry those classes. Anything else read without a fallback has to
   *  be on :root, or a page outside the declaring class reads nothing. */
  it("is reachable from every page, like every property read without a fallback", () => {
    const rules = ruleBlocks(stripComments(css));
    const card = new Set<string>();
    for (const r of rules) {
      if (!r.selectors.every((s) => /^\.(?:inv|palette-[a-z]+|type-[a-z]+)$/.test(s))) continue;
      for (const d of r.body.matchAll(/(--[\w-]+)\s*:/g)) card.add(d[1]);
    }
    expect(card.has("--font-display")).toBe(true);

    const unreachable: string[] = [];
    for (const r of rules) {
      for (const v of r.body.matchAll(/var\((--[\w-]+)\)/g)) {
        if (!tokens.has(v[1]) && !card.has(v[1]))
          unreachable.push(`${r.selectors.join(", ")}: ${v[1]}`);
      }
    }
    expect(unreachable).toEqual([]);
  });

  /** Ten chrome headings once named the face themselves, and the landing
   *  named Manrope for its body. The card's own .inv and .type-* keep their
   *  faces: they are the card's typography, mirrored by hand in the OG
   *  renderer, not the product's. */
  it("names each chrome face only through its token, outside the card's own typography", () => {
    const namedOutsideCard = (face: string) =>
      [...sections(css)]
        .filter(([name]) => name !== "Invitation card")
        .map(([name, body]) => [name, stripComments(body).split(`"${face}"`).length - 1])
        .filter(([, count]) => count);
    expect(namedOutsideCard("Literata")).toEqual([["Material system", 1]]);
    expect(namedOutsideCard("Golos Text")).toEqual([["Material system", 1]]);
    expect(namedOutsideCard("Playfair Display")).toEqual([]);
    expect(namedOutsideCard("Manrope")).toEqual([]);
  });
});

/** InvitationPreview's title is an h2, and so are the account sheets'
 *  `.ag-title`s. A page rule such as `.gl h2` (0,1,1) outranks a single class
 *  (0,1,0) on every one of them beneath it. The gallery had one, and its
 *  examples' titles lost their own face, most of them their size too; the
 *  landing had `.landing h2`, which set the hero fan's titles in Playfair
 *  whatever their type and the sign-out and delete sheets' titles in bold.
 *  So every rule that styles a bare h2 from above is named here, and each
 *  names a section that holds only the page's own heading. */
describe("headings that carry their own class", () => {
  it("include the card's title, which is an h2", () => {
    const preview = readFileSync(
      fileURLToPath(new URL("../src/components/InvitationPreview.tsx", import.meta.url)),
      "utf8",
    );
    expect(preview).toMatch(/<h2 \{\.\.\.fieldProps\("title", "inv-title"\)\}>/);
  });

  it("are reached by no page rule for a bare h2", () => {
    const bare = new Set(
      ruleBlocks(stripComments(css))
        .flatMap((r) => r.selectors)
        .map((s) => s.replace(/\s+/g, " "))
        .filter((s) => /[\s>+~]h2$/.test(s)),
    );
    expect([...bare].sort()).toEqual([
      ".gl-others h2",
      ".lp-final h2",
      ".lp-rsvp-copy h2",
      ".lp-steps h2",
      ".lp-yours-head h2",
    ]);
  });
});
