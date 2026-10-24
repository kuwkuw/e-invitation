import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  atRuleSpan,
  bannerTitles,
  blend,
  contrast,
  deltaE76,
  readStyles,
  rootTokens,
  ruleBlocks,
  sections,
  stripComments,
} from "./cssTokens";

// @vitest-environment node

const css = readStyles();
const tokens = rootTokens(css);

/** A source file under web/src, for the rules a component's markup has to keep. */
const source = (file: string) =>
  readFileSync(fileURLToPath(new URL(`../src/${file}`, import.meta.url)), "utf8");

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

  // The pair became a trio with «Ще не знаю» (adr-019 §9.1). The floors in
  // "the manage page's text" are where each one's contrast is held.
  it("keeps the RSVP status trio, which other surfaces still read", () => {
    expect(tokens.get("--rsvp-yes")).toBe("#3d6b47");
    expect(tokens.get("--rsvp-no")).toBe("#a83f3f");
    expect(tokens.get("--rsvp-maybe")).toBe("#86621c");
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

  it("holds body ink at AA and --ink-faint at 3:1 on the table the card is set on", () => {
    const table = tokens.get("--table") as string;
    expect(table).toBe("#eae3d6");
    expect(contrast(tokens.get("--ink") as string, table)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens.get("--ink-muted") as string, table)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens.get("--ink-faint") as string, table)).toBeGreaterThanOrEqual(3);
  });

  it("keeps the seal's monogram, the envelope's title and its skip link legible", () => {
    const on = (ink: string, ground: string) =>
      contrast(tokens.get(ink) as string, tokens.get(ground) as string);
    expect(on("--surface", "--ui-accent")).toBeGreaterThanOrEqual(4.5);
    expect(on("--ui-ink", "--kraft")).toBeGreaterThanOrEqual(4.5);
    expect(on("--surface", "--night")).toBeGreaterThanOrEqual(4.5);
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

  const material = (selector: string) =>
    ruleBlocks(stripComments(sections(css).get("Material system") ?? "")).find((r) =>
      r.selectors.includes(selector),
    )?.body ?? "";

  it("defines the deckled mat as a --surface wrapper with an 11–14px pad and a polygon edge", () => {
    const deckle = material(".deckle");
    expect(deckle).toMatch(/background-color:\s*var\(--surface\)/);
    expect(deckle).toMatch(/clip-path:\s*polygon\(/);
    const pad = Number(/padding:\s*(\d+)px/.exec(deckle)?.[1]);
    expect(pad).toBeGreaterThanOrEqual(11);
    expect(pad).toBeLessThanOrEqual(14);
  });

  it("sets the seal's monogram in Literata italic 400, the one italic requested", () => {
    const seal = material(".seal");
    expect(seal).toMatch(/var\(--ui-accent\)/);
    expect(seal).toMatch(/font-family:\s*var\(--ui-font-display\)/);
    expect(seal).toMatch(/font-style:\s*italic/);
    expect(seal).toMatch(/font-weight:\s*400/);
    expect(seal).toMatch(/color:\s*var\(--surface\)/);
  });

  it("defines grain as two dot layers at 3px and 7px, under 5% alpha", () => {
    const grain = ruleBlocks(stripComments(sections(css).get("Material system") ?? "")).find((r) =>
      r.selectors.includes(".grain"),
    );
    expect(grain?.body).toMatch(/background-size:\s*3px 3px,\s*7px 7px/);
    // Only the image: a background-color or the shorthand here would paint over
    // the colour of whatever element carries the class.
    expect(grain?.body).not.toMatch(/background(?:-color)?\s*:/);
    const alphas = [...(grain?.body ?? "").matchAll(/rgba\([^)]*,\s*([\d.]+)\)/g)].map((m) =>
      Number(m[1]),
    );
    expect(alphas).toHaveLength(2);
    for (const a of alphas) expect(a).toBeLessThanOrEqual(0.05);
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
  "Account sheets",
  "App chrome",
  "Creation chat",
  "Design controls",
  "Guest page",
  "Host manage dashboard",
  "Landing page",
  "Landing: account footer",
  "Landing: returning-host block",
  "Reply email checkbox",
  "Share panel",
  "Share panel: signed in",
  "Sign-in gate",
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
  it("sets the card on the grained table, whatever the palette (adr-019 §4.2)", () => {
    const shell = /\.cc-shell\s*\{([^}]*)\}/.exec(css);
    expect(shell).not.toBeNull();
    expect((shell as RegExpExecArray)[1]).toMatch(/background-color:\s*var\(--table\)/);
    expect(css).not.toMatch(/--ground-tint-|\[data-palette=/);
    const app = readFileSync(fileURLToPath(new URL("../src/App.tsx", import.meta.url)), "utf8");
    expect(app).toMatch(/className="cc-shell grain"/);
    expect(app).toMatch(/data-palette=\{/); // kept as an unused hook (adr-019 §4.2)
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

/** The panel a host publishes into (adr-010 §3, adr-019 §10). */
describe("the share panel's text", () => {
  textFloors("Share panel", [
    [".sp-subtitle", "--surface", 4.5],
    [".sp-label", "--surface", 4.5],
    [".sp-hint", "--surface", 3],
    [".sp-version", "--ground", 3],
    [".sp-manage-label", "--caution-wash", 4.5],
    [".sp-manage-warning", "--caution-wash", 4.5],
    [".sp-manage-value", "--caution-surface", 3],
    [".sp-reveal", "--caution-wash", 3],
    [".sp-responses-link", "--surface", 4.5],
  ]);
  textFloors("Share panel: signed in", [
    [".sp-account-note", "--surface", 4.5],
    [".sp-manage-collapsed-label", "--caution-wash", 4.5],
    [".sp-manage-collapsed-action", "--caution-wash", 4.5],
    [".sp-manage-hide", "--caution-wash", 3],
  ]);

  it("glows in the paper accent, never glass's terracotta", () => {
    const body = stripComments(sections(css).get("Share panel") ?? "");
    expect(body).not.toMatch(/rgba\(\s*179\s*,\s*89\s*,\s*46/);
  });

  it("sets its corners on the radius tokens", () => {
    for (const name of ["Share panel", "Share panel: signed in"]) {
      const body = stripComments(sections(css).get(name) ?? "");
      expect(
        [...body.matchAll(/border-radius:\s*(\d+px)/g)].map((m) => m[1]),
        name,
      ).toEqual([]);
    }
  });
});

// adr-010 §3: the manage-token block exists to not be the clean chrome. Under
// paper its wash sat 2.4 from the card stock it's set on, inside the 2.5 at
// which this stylesheet collapses two values into one (adr-019 §1, step 5).
describe("the manage-token block", () => {
  it("stays a different material from the chrome around it", () => {
    const t = (name: string) => tokens.get(name) as string;
    expect(deltaE76(t("--caution-wash"), t("--surface"))).toBeGreaterThanOrEqual(6);
    expect(deltaE76(t("--caution-wash"), t("--wash"))).toBeGreaterThanOrEqual(6);
    expect(deltaE76(t("--caution-surface"), t("--surface"))).toBeGreaterThanOrEqual(2.5);
  });

  it("measures distance as the :root comment quotes it", () => {
    // `--caution-wash` vs `--wash` read 2.2 under glass (#f8f2ea, #f1efe9).
    expect(deltaE76("#f8f2ea", "#f1efe9")).toBeCloseTo(2.18, 1);
  });
});

/** The share sheet's first frame (adr-014 §2), and the two sheets built on it. */
describe("the sign-in gate's and the account sheets' text", () => {
  textFloors("Sign-in gate", [
    [".ag-title", "--surface", 4.5],
    [".ag-why", "--surface", 4.5],
    [".ag-note", "--surface", 4.5],
    [".ag-textbtn", "--surface", 3],
    [".ag-code", "--surface", 3],
    [".ag-draft", "--wash", 4.5],
    [".ag-waiting", "--app-bg", 3],
  ]);
  textFloors("Account sheets", [
    [".da-keep-head", "--rsvp-yes-bg", 4.5],
    [".da-keep-list", "--rsvp-yes-bg", 4.5],
    [".da-goes", "--surface", 4.5],
    [".da-keys-title", "--caution-wash", 4.5],
    [".da-keys-body", "--caution-wash", 4.5],
    [".da-confirm", "--surface", 4.5],
    [".so-confirm", "--surface", 4.5],
  ]);

  it("spins, fills and retries in the paper accent", () => {
    const body = stripComments(sections(css).get("Sign-in gate") ?? "");
    expect(body).not.toMatch(/rgba\(\s*179\s*,\s*89\s*,\s*46/);
    const spin = ruleBlocks(body).find((r) => r.selectors.includes(".ag-spin"));
    expect(spin?.body).toMatch(/color:\s*var\(--ui-accent\)/);
  });
});

/** Where a host reads their replies. */
describe("the manage page's text", () => {
  textFloors("Host manage dashboard", [
    [".hm-state-hint", "--surface", 4.5],
    [".hm-empty-reassure", "--surface", 4.5],
    [".hm-new-line", "--app-bg", 4.5],
    [".hm-countdown", "--app-bg", 4.5],
    [".hm-breakdown", "--surface", 3],
    [".hm-updated", "--app-bg", 3],
    [".hm-section-title", "--surface", 3],
    [".hm-when", "--surface", 3],
    [".hm-previous", "--surface", 3],
    [".hm-count-label", "--surface", 3],
    [".hm-count-maybe .hm-count-num", "--surface", 4.5],
    [".hm-pill-maybe", "--rsvp-maybe-bg", 4.5],
    [".hm-remind", "--surface", 4.5],
    [".hm-wish-quote", "--surface", 4.5],
    [".hm-wish-who", "--surface", 3],
    [".hm-wishes a", "--surface", 4.5],
    [".hm-count-yes .hm-count-num", "--surface", 4.5],
    [".hm-count-no .hm-count-num", "--surface", 4.5],
  ]);

  const manageRule = (selector: string) =>
    ruleBlocks(stripComments(sections(css).get("Host manage dashboard") ?? "")).find((r) =>
      r.selectors.includes(selector),
    )?.body ?? "";

  it("keeps the grain on the dashboard's ground (adr-019 §3)", () => {
    expect(manageRule(".hm-page")).toMatch(/background-color:\s*var\(--app-bg\)/);
    expect(manageRule(".hm-page")).not.toMatch(/(?:^|[;\s])background\s*:/);
    const pages = [...source("ManagePage.tsx").matchAll(/className="([^"]*\bhm-page\b[^"]*)"/g)];
    expect(pages.length).toBeGreaterThan(0);
    for (const [, names] of pages) expect(names).toMatch(/\bgrain\b/);
  });

  it("sets its cards on paper's radius and elevation, as the guest reply card is", () => {
    expect(manageRule(".hm-card")).toMatch(/border-radius:\s*var\(--r-xl\)/);
    expect(manageRule(".hm-card")).toMatch(/box-shadow:\s*var\(--e-2\)/);
  });
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
    [".gr-cta-line", "--app-bg", 3],
    [".gr-reply-title", "--surface", 4.5],
    [".gr-bar-when", "--surface", 4.5],
    [".gr-bar-where", "--surface", 4.5],
    [".gr-bar-reply", "--surface", 4.5],
    [".gr-countdown", "--app-bg", 4.5],
    [".gr-tile.maybe", "--surface", 4.5],
    [".gr-quiet-action", "--app-bg", 4.5],
    [".gr-env-to", "--kraft", 4.5],
    [".gr-env-skip", "--night", 4.5],
  ]);

  it("keeps the grain on every guest page ground (adr-019 §3)", () => {
    const page = ruleBlocks(stripComments(sections(css).get("Guest page") ?? "")).find((r) =>
      r.selectors.includes(".gr-page"),
    );
    expect(page?.body).toMatch(/background-color:\s*var\(--app-bg\)/);
    expect(page?.body).not.toMatch(/(?:^|[;\s])background\s*:/);
    for (const file of ["GuestPage.tsx", "components/guest/GuestNotFound.tsx"]) {
      const pages = [...source(file).matchAll(/className="([^"]*\bgr-page\b[^"]*)"/g)];
      expect(pages.length, file).toBeGreaterThan(0);
      for (const [, names] of pages) expect(names, file).toMatch(/\bgrain\b/);
    }
  });

  it("sets the card on the deckled mat, with the mat's shadow outside its clip", () => {
    expect(source("GuestPage.tsx")).toMatch(
      /<div className="gr-mat">\s*<div className="deckle">\s*<InvitationPreview/,
    );
    const mat = ruleBlocks(stripComments(sections(css).get("Guest page") ?? "")).find((r) =>
      r.selectors.includes(".gr-mat"),
    );
    expect(mat?.body).toMatch(/filter:\s*drop-shadow\(/);
  });

  // adr-019 §9.1: yes and no keep their row; «Ще не знаю» wraps beneath them
  // across the card, because three don't fit a 360 px phone side by side.
  it("sets the maybe tile on a row of its own under yes and no", () => {
    const rules = ruleBlocks(stripComments(sections(css).get("Guest page") ?? ""));
    const body = (selector: string) =>
      rules.find((r) => r.selectors.includes(selector))?.body ?? "";
    expect(body(".gr-tiles")).toMatch(/flex-wrap:\s*wrap/);
    expect(body(".gr-tile.maybe")).toMatch(/flex-basis:\s*100%/);
  });

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
    [".lp-hero-text", "--app-bg", 4.5],
    [".lp-hero-promise", "--app-bg", 4.5],
    [".lp-composer-line", "--surface", 4.5],
    [".lp-composer-label", "--surface", 3],
    [".lp-composer-note", "--app-bg", 4.5],
    [".lp-stat-value", "--app-bg", 4.5],
    [".lp-stat-label", "--app-bg", 4.5],
    [".lp-guests-text", "--app-bg", 4.5],
    [".lp-guests-point", "--app-bg", 4.5],
    [".lp-guests-to", "--kraft", 4.5],
    [".lp-faq-q", "--app-bg", 4.5],
    [".lp-faq-a", "--app-bg", 4.5],
    [".lp-step-text", "--app-bg", 4.5],
    [".lp-chip", "--surface", 3],
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
    [".lp-cross-device", "--app-bg", 4.5],
    [".lp-signed-in-empty", "--surface", 4.5],
    [".lp-account-email", "--app-bg", 3],
    [".lp-account-out", "--app-bg", 3],
    [".lp-delete-link", "--app-bg", 3],
  ]);
});

/** adr-019 §10. It sits on --app-bg in the landing footer and on the manage
 *  page, and on --surface in the share panel once step 5 brings it there. */
describe("the reply email checkbox", () => {
  textFloors("Reply email checkbox", [
    [".notify-name", "--app-bg", 4.5],
    [".notify-name", "--surface", 4.5],
    [".notify-state", "--app-bg", 4.5],
    [".notify-state", "--surface", 4.5],
  ]);

  const rules = () => ruleBlocks(stripComments(sections(css).get("Reply email checkbox") ?? ""));
  const body = (selector: string) =>
    rules().find((r) => r.selectors.includes(selector))?.body ?? "";

  it("fills the checked box with ink, never the accent, which means the public link", () => {
    expect(body(".notify-input:checked + .notify-box")).toMatch(
      /background-color:\s*var\(--ink-muted\)/,
    );
    expect(
      rules()
        .map((r) => r.body)
        .join("\n"),
    ).not.toMatch(/accent/);
  });

  it("edges the empty box at 3:1 on both grounds it sits on (WCAG 1.4.11)", () => {
    const edge = /border:\s*[\d.]+px solid var\((--[\w-]+)\)/.exec(body(".notify-box"))?.[1];
    expect(edge).toBeDefined();
    for (const ground of ["--app-bg", "--surface"]) {
      const ratio = contrast(tokens.get(edge as string) as string, tokens.get(ground) as string);
      expect(ratio, ground).toBeGreaterThanOrEqual(3);
    }
  });

  it("makes the whole label a 44px target and keeps the input in the tab order", () => {
    expect(body(".notify-check")).toMatch(/min-height:\s*44px/);
    expect(body(".notify-input")).not.toMatch(/display:\s*none/);
    expect(body(".notify-input:focus-visible + .notify-box")).toMatch(/outline:/);
  });
});

/** The hex ratchet reads only styles.css, so a colour written into a
 *  component as a literal goes stale without a sound when the token moves:
 *  the guest page kept terracotta icons beside adr-019's oxblood that way.
 *  Guest and landing components colour everything through currentColor, set
 *  by the CSS rule that places them, and carry no hex at all. */
// Google's sign-in mark must be drawn in Google's own colours.
const GOOGLE_MARK = ["#4285F4", "#34A853", "#FBBC05", "#EA4335"];

describe("the guest page's, the landing's, the dashboard's and the editor's components", () => {
  it("carry no hex literal at all, beyond the Google mark", () => {
    const src = fileURLToPath(new URL("../src/", import.meta.url));
    const inDir = (dir: string) =>
      readdirSync(join(src, dir))
        .filter((file) => file.endsWith(".tsx"))
        .map((file) => join(dir, file));
    const files = [
      ...inDir("components/guest"),
      ...inDir("components/landing"),
      ...inDir("components/manage"),
      ...inDir("components/editor"),
      "ManagePage.tsx",
      "App.tsx",
      "components/ByokSettings.tsx",
      "components/SignOutSheet.tsx",
      "components/DeleteAccountSheet.tsx",
      "components/Countdown.tsx",
      "components/NotifyCheckbox.tsx",
      "components/AccountFooter.tsx",
    ];
    const named = files.flatMap((file) =>
      [...readFileSync(join(src, file), "utf8").matchAll(/#[0-9a-fA-F]{3,8}\b/g)]
        .filter((m) => !(file.endsWith("AuthGate.tsx") && GOOGLE_MARK.includes(m[0])))
        .map((m) => `${file}: ${m[0]}`),
    );
    expect(named).toEqual([]);
    // The allowance is the mark, not a licence: each colour appears once.
    const gate = source("components/editor/AuthGate.tsx");
    expect(GOOGLE_MARK.map((hex) => gate.split(hex).length - 1)).toEqual([1, 1, 1, 1]);
  });
});

describe("the landing's motion (adr-019 §6.1)", () => {
  const landing = () => stripComments(sections(css).get("Landing page") ?? "");
  const welcome = () => {
    const span = atRuleSpan(landing(), /@media\s*\(prefers-reduced-motion:\s*no-preference\)/);
    expect(span, "no no-preference block").not.toBeNull();
    return span as { start: number; end: number };
  };
  const keyframeProps = (name: string) => {
    const span = atRuleSpan(landing(), new RegExp(`@keyframes\\s+${name}\\b`));
    expect(span, name).not.toBeNull();
    const { start, end } = span as { start: number; end: number };
    return new Set(
      [
        ...landing()
          .slice(start, end)
          .matchAll(/([\w-]+)\s*:/g),
      ].map((m) => m[1]),
    );
  };

  // Reduced motion is honoured by never starting, not by detection (NFR-9).
  it("animates only inside its one no-preference block", () => {
    const { start, end } = welcome();
    const animated = ruleBlocks(landing()).filter((r) => /(?:^|[;\s])animation\s*:/.test(r.body));
    expect(animated.flatMap((r) => r.selectors).sort()).toEqual([".lp-stage-card", ".lp-typing"]);
    for (const r of animated) expect(r.at > start && r.at < end, r.selectors.join(", ")).toBe(true);
  });

  it("raises the card by transform and opacity alone", () => {
    expect(keyframeProps("lp-rise")).toEqual(new Set(["transform", "opacity"]));
  });

  it("types by width and blinks by colour, and moves nothing else", () => {
    expect(keyframeProps("lp-type")).toEqual(new Set(["max-width"]));
    expect(keyframeProps("lp-caret")).toEqual(new Set(["border-right-color"]));
  });

  // The line is flex-end and the sentence takes margin-right: auto, so it sits
  // left while it fits and scrolls left, like an input, once it doesn't.
  it("keeps the typed line to one line that scrolls like an input, only where it types", () => {
    const { start, end } = welcome();
    const inside = ruleBlocks(landing().slice(start, end));
    const line = inside.find((r) => r.selectors.includes(".lp-composer-line"))?.body ?? "";
    const typing = inside.find((r) => r.selectors.includes(".lp-typing"))?.body ?? "";
    expect(line).toMatch(/justify-content:\s*flex-end/);
    expect(line).toMatch(/overflow:\s*hidden/);
    expect(typing).toMatch(/white-space:\s*nowrap/);
    expect(typing).toMatch(/margin-right:\s*auto/);
  });
});

/** --accent-wash is #f7efe3 and the paper ground is #f4efe6: 1.00:1, so a
 *  borderless wash fill on the page simply vanishes. The landing's chips and
 *  step icons sat exactly there, and are card stock with a ruled edge now. */
describe("the landing's chips and step icons", () => {
  it("sit on card stock with a ruled edge, not on a wash the ground has swallowed", () => {
    const rules = ruleBlocks(stripComments(sections(css).get("Landing page") ?? ""));
    for (const selector of [".lp-chip", ".lp-step-icon"]) {
      const body = rules.find((r) => r.selectors.includes(selector))?.body ?? "";
      expect(body, selector).toMatch(/background:\s*var\(--surface\)/);
      expect(body, selector).toMatch(/border:\s*1px solid var\(--edge\)/);
    }
  });
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

  /** index.html links the same URL so the fonts request starts while the app
   *  CSS is still downloading; the @import then resolves from cache. A link
   *  left on an older URL silently re-serialises the new faces behind the
   *  stylesheet and costs a second fonts.css request. */
  it("preloads exactly the font URL the stylesheet imports", () => {
    const imported = /@import url\("([^"]+)"\)/.exec(css)?.[1];
    const html = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
    const linked = /<link\s+rel="stylesheet"\s+href="(https:\/\/fonts\.googleapis\.com[^"]+)"/.exec(
      html,
    )?.[1];
    expect(imported).toBeDefined();
    expect(linked?.replaceAll("&amp;", "&")).toBe(imported);
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

  /** The tracked wordmark costs the landing nav 54px a phone does not have:
   *  main's nav fit a 360px phone with nothing to spare, and Literata at
   *  0.32em plus Golos's wider gallery link took the signed-out nav to 419px.
   *  Measured in a browser with these rules, it fits at 360, 375, 390 and
   *  414px in both nav states. jsdom cannot lay out, so this pins the rule
   *  that measurement depends on. */
  it("narrows the nav wordmark on a phone, where 0.32em overflows the nav", () => {
    const bare = stripComments(css);
    const span = atRuleSpan(bare, /@media\s*\(max-width:\s*560px\)/);
    expect(span).not.toBeNull();
    const { start, end } = span as { start: number; end: number };
    const phone = ruleBlocks(bare.slice(start, end));
    const brand = phone.find((r) => r.selectors.includes(".lp-brand"));
    expect(brand?.body).toMatch(/font-size:\s*1\.02rem/);
    expect(brand?.body).toMatch(/letter-spacing:\s*0\.12em/);
    const gallery = phone.find((r) => r.selectors.includes(".lp-nav-gallery"));
    expect(gallery?.body).toMatch(/margin-left:\s*12px/);
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

describe("the landing on paper (adr-019 §3)", () => {
  const rule = (selector: string) =>
    ruleBlocks(stripComments(sections(css).get("Landing page") ?? "")).find((r) =>
      r.selectors.includes(selector),
    )?.body ?? "";

  it("grains the page ground and the hero's table, each coloured without the shorthand", () => {
    for (const [selector, ground] of [
      [".landing", "--app-bg"],
      [".lp-stage", "--table"],
    ]) {
      expect(rule(selector), selector).toMatch(
        new RegExp(`background-color:\\s*var\\(${ground}\\)`),
      );
      expect(rule(selector), selector).not.toMatch(/(?:^|[;\s])background\s*:/);
    }
    expect(source("LandingPage.tsx")).toMatch(/className="landing grain"/);
    expect(source("prerender.ts")).toMatch(/class="landing grain"/);
    expect(source("components/landing/HeroStage.tsx")).toMatch(/className="lp-stage grain"/);
  });

  it("sets the hero's card on the deckled mat, with the mat's shadow outside its clip", () => {
    expect(source("components/landing/HeroStage.tsx")).toMatch(
      /<div className="lp-stage-card">\s*<div className="deckle">\s*<InvitationPreview/,
    );
    expect(rule(".lp-stage-card")).toMatch(/filter:\s*drop-shadow\(/);
  });
});
