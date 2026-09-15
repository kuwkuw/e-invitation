# Material System and Editor Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install a design-token material system in `web/src/styles.css` and convert the editor screen to the D1 Liquid Glass direction, leaving the invitation card, the OG renderer and the other five surfaces untouched.

**Architecture:** A single `:root` token block at the top of `styles.css` (forced — the design-sync ships that file's closure), two composing classes `.glass` / `.glass-solid`, and a six-entry palette→ground map keyed by a `data-palette` attribute on the editor shell. The editor's chrome converts to those tokens; the invitation card keeps its literal hex because the OG renderer mirrors it by hand. Three new tests hold the rules the types cannot: a no-raw-hex ratchet with a shrinking allowlist, palette→ground enum coverage, and WCAG contrast on the tokens.

**Tech Stack:** Vite 5 + React 18 + TypeScript, vitest 2 under jsdom, `@testing-library/react`, Biome (CSS formatting deliberately off), pnpm workspace.

**Spec:** [docs/superpowers/specs/2026-09-15-editor-material-system-design.md](../specs/2026-09-15-editor-material-system-design.md)

## Global Constraints

- **Run everything from the repo root with pnpm, never npm.** Web tests: `pnpm --filter inv-app-web test`. Single file: `pnpm --filter inv-app-web exec vitest run test/styles.test.ts`. Single test: `... vitest run -t "name"`.
- **`vite.config.ts` sets `globals: false`, so RTL never auto-cleans.** Every component test file must call `afterEach(cleanup)` or it starts matching the previous test's DOM.
- **CSS formatting is off on purpose** (root `biome.jsonc`). `styles.css` keeps compact one-line token rules so they stay scannable against the OG renderer's maps. Write new token rules the same way — one declaration block per line where it reads better.
- **Never convert `.palette-*`, `.type-*`, `.layout-*` or `.ornament-*` to tokens.** Those values are mirrored by hand into `server/src/og/render.ts`. A raw hex is the safer choice there.
- **Never touch `web/src/components/InvitationPreview.tsx`.** It is DS-synced, rendered in four places, and its props are hand-mirrored in `.design-sync/config.json` (`dtsPropsFor`) and `.design-sync/conventions.md`.
- **`--ink-faint` is never body text.** It clears 3:1, not 4.5:1. Labels ≥24px, or non-text only.
- **Do not remove the Google Fonts `@import` at line 1 of `styles.css`.** It looks redundant next to `index.html`'s `<link>`; it is what keeps the DS closure self-contained (`.design-sync/NOTES.md`).
- **Commit after every task.** End commit messages with:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `web/src/styles.css` | `:root` tokens, glass classes, palette→ground map, converted editor sections | 1–6, 8 |
| `web/test/styles.test.ts` | **New.** Ratchet, ground coverage, contrast — the three rules the types cannot hold | 1–4 |
| `web/test/cssTokens.ts` | **New.** Test-only helper: read `styles.css`, split into sections, parse `:root`, compute WCAG ratios | 1 |
| `web/src/App.tsx` | Adds `data-palette` to the shell; renders the past-date banner | 3, 7 |
| `web/src/components/editor/DesignToolbar.tsx` | **New.** The segmented bar; replaces `DesignControls`' four stacked rows in the editor | 6 |
| `web/src/components/editor/DesignSheet.tsx` | **New.** The sheet one segment opens | 6 |
| `web/src/components/DesignControls.tsx` | Stays, unchanged — still used where a stacked picker is right. Editor stops importing it | 6 |
| `web/src/components/editor/PreviewPanel.tsx` | Renders the toolbar instead of the stacked controls | 6 |
| `web/src/components/editor/ChatPanel.tsx` | Peek line, collapsible log, banner slot | 7, 8 |
| `web/test/DesignToolbar.test.tsx` | **New.** Segment/sheet behaviour | 6 |
| `web/test/pastDateBanner.test.tsx` | **New.** The banner renders from `dateBlocked` | 7 |
| `docs/decisions/adr-018-*.md` | **New.** Settles the decision in repo convention | 9 |
| `docs/03-non-functional-requirements.md` | NFR-9 (new), NFR-1 bundle re-measure, NFR-8 mirror list | 9 |
| `CLAUDE.md` | The material system paragraph | 9 |

`DesignControls.tsx` is deliberately **not** deleted or rewritten: it is a working stacked picker, and replacing it in place would make this iteration's diff touch a component the editor no longer uses the same way. The editor gets a new component; the old one stays until something proves it dead.

---

### Task 1: The `:root` material tokens

**Files:**
- Create: `web/test/cssTokens.ts`
- Create: `web/test/styles.test.ts`
- Modify: `web/src/styles.css:18-27` (extend the existing `:root`)

**Interfaces:**
- Consumes: nothing.
- Produces: `readStyles(): string`, `sections(css: string): Map<string, string>`, `rootTokens(css: string): Map<string, string>`, `contrast(hexA: string, hexB: string): number`, `blend(fg: string, alpha: number, bg: string): string` — all exported from `web/test/cssTokens.ts` and used by tasks 2–4.

- [ ] **Step 1: Write the failing test**

Create `web/test/cssTokens.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The stylesheet as bytes on disk. Tests assert against the file the
 *  design-sync ships, not against a rendered DOM — jsdom does not implement
 *  `backdrop-filter`, custom-property fallbacks or `@media` evaluation, so a
 *  computed-style test here would assert the shim, not the CSS. */
export function readStyles(): string {
  return readFileSync(fileURLToPath(new URL("../src/styles.css", import.meta.url)), "utf8");
}

/** Split on the file's major banner comments — `/* Title ---------- *​/`.
 *  Everything before the first banner is keyed "preamble". */
export function sections(css: string): Map<string, string> {
  const banner = /^\/\*\s*(.+?)\s*-{3,}/gm;
  const found: { title: string; start: number }[] = [];
  for (const m of css.matchAll(banner)) {
    found.push({ title: m[1], start: m.index ?? 0 });
  }
  const out = new Map<string, string>();
  out.set("preamble", css.slice(0, found[0]?.start ?? css.length));
  found.forEach((s, i) => {
    out.set(s.title, css.slice(s.start, found[i + 1]?.start ?? css.length));
  });
  return out;
}

/** Custom properties declared on a bare `:root` (not on a class or attribute). */
export function rootTokens(css: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const block of css.matchAll(/:root\s*\{([^}]*)\}/g)) {
    for (const decl of block[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      out.set(decl[1], decl[2].trim());
    }
  }
  return out;
}

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function rgb(hex: string): [number, number, number] {
  const h = hex.trim().replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.1 contrast ratio, 1–21. */
export function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Composite `fg` at `alpha` over `bg` — a translucent surface with its blur
 *  ignored, which is exactly what the spec's legibility rule assumes. */
export function blend(fg: string, alpha: number, bg: string): string {
  const [fr, fg2, fb] = rgb(fg);
  const [br, bg3, bb] = rgb(bg);
  const mix = (f: number, b: number) => Math.round(f * alpha + b * (1 - alpha));
  return `#${[mix(fr, br), mix(fg2, bg3), mix(fb, bb)]
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`;
}
```

Create `web/test/styles.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { contrast, readStyles, rootTokens } from "./cssTokens";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter inv-app-web exec vitest run test/styles.test.ts`
Expected: FAIL — "declares every token the editor is built from" reports the full list of missing tokens; the contrast tests fail on `undefined`.

- [ ] **Step 3: Write minimal implementation**

In `web/src/styles.css`, replace the existing `:root` block (currently lines 20–27, holding only the RSVP pair) with the block below. Keep the comment that is already above it — it explains the RSVP pair and is still true.

```css
/* Material system (adr-018). One vocabulary for the whole app; the editor is
   the first surface built from it. Defined here rather than in a tokens.css
   because design-sync ships this file's closure to the DS project and a local
   @import would not be inlined — see .design-sync/NOTES.md.

   Deliberately NOT tokenised: .palette-* / .type-* / .layout-* / .ornament-*.
   Those values are mirrored by hand in server/src/og/render.ts, where a raw
   hex is what keeps the mirror visible. */
:root {
  /* Ground and surface */
  --ground: #f3ece2;
  --surface: #ffffff;

  /* Ink. --ink-faint clears 3:1, not 4.5:1 — labels and non-text only. */
  --ink: #23211d;
  --ink-muted: #6b6659;
  --ink-faint: #8d8577;

  /* Accent. White on --accent is 4.79:1, which is what makes Publish legible. */
  --accent: #b3592e;
  --accent-hi: #a04e27;
  --accent-wash: #f7efe3;
  --edge: #e4ddd0;

  /* Radius */
  --r-sm: 8px;
  --r-md: 12px;
  --r-lg: 16px;
  --r-xl: 22px;
  --r-pill: 999px;

  /* Elevation */
  --e-1: 0 1px 3px rgba(74, 55, 40, 0.08);
  --e-2: 0 8px 24px rgba(74, 55, 40, 0.16);
  --e-3: 0 24px 54px rgba(20, 18, 14, 0.24);

  /* Motion. iOS reads as much from its easing as from its materials. */
  --ease-ios: cubic-bezier(0.32, 0.72, 0, 1);
  --dur-fast: 160ms;
  --dur-base: 280ms;

  /* Status tokens (RSVP yes / no) — see the note above. */
  --rsvp-yes: #3d6b47;
  --rsvp-yes-bg: #eef3ee;
  --rsvp-yes-edge: #cfe0d1;
  --rsvp-no: #a83f3f;
  --rsvp-no-bg: #f6ebe9;
  --rsvp-no-edge: #e6cfc9;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter inv-app-web exec vitest run test/styles.test.ts`
Expected: PASS, 6 tests. The computed ratios are `--ink` 14.9:1, `--ink-muted` 4.88:1, `--ink-faint` 3.11:1, white-on-accent 4.79:1, accent-on-ground 4.08:1.

- [ ] **Step 5: Run the whole web suite — nothing else should move**

Run: `pnpm --filter inv-app-web test`
Expected: PASS. Adding tokens changes no rendered pixel; nothing consumes them yet.

- [ ] **Step 6: Commit**

```bash
git add web/src/styles.css web/test/cssTokens.ts web/test/styles.test.ts
git commit -m "$(cat <<'EOF'
Give the app one colour vocabulary, held by contrast tests

443 raw hex literals and 106 distinct colours, with a :root that held
only the RSVP pair — three values served as "the accent" and two as "the
ink". This declares the system the editor will be built from and writes
the AA commitment down as a test rather than a CSS comment.

Nothing consumes the tokens yet, so no pixel moves.

--ink-faint is pinned *below* 4.5:1 on purpose: it clears the large-text
floor only, and the test says so rather than leaving the next person to
discover it in an audit.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: The glass classes and their fallbacks

**Files:**
- Modify: `web/src/styles.css` (add glass tokens to `:root`, add classes after it)
- Modify: `web/test/styles.test.ts`

**Interfaces:**
- Consumes: `rootTokens`, `contrast`, `blend` from `web/test/cssTokens.ts`.
- Produces: CSS classes `.glass` and `.glass-solid`, and tokens `--glass-tint`, `--glass-tint-solid`, `--glass-alpha`, `--glass-alpha-solid`, `--glass-blur`, `--glass-edge`, `--glass-shadow`, used by tasks 4–8.

- [ ] **Step 1: Write the failing test**

First extend the import at the top of `web/test/styles.test.ts` — this task's
test composites a tint over the ground:

```ts
import { blend, contrast, readStyles, rootTokens } from "./cssTokens";
```

Then append:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter inv-app-web exec vitest run test/styles.test.ts -t "glass"`
Expected: FAIL — `--glass-tint` missing, `.glass` not found.

- [ ] **Step 3: Write minimal implementation**

Add to the `:root` block from Task 1, after the Motion group:

```css
  /* Glass. The alpha is a token of its own so the contrast test can composite
     the surface over the ground without parsing an rgba() string. */
  --glass-alpha: 0.62;
  --glass-alpha-solid: 0.82;
  --glass-tint: rgba(255, 255, 255, 0.62);
  --glass-tint-solid: rgba(255, 255, 255, 0.82);
  --glass-blur: blur(20px) saturate(180%);
  --glass-edge: inset 0 1px 0 rgba(255, 255, 255, 0.75), inset 0 -1px 0 rgba(255, 255, 255, 0.2);
  --glass-shadow: 0 8px 24px rgba(74, 55, 40, 0.16);
```

Then, immediately after the closing `}` of `:root`:

```css
/* Glass surfaces (adr-018). Two, not one: .glass-solid carries text and so
   takes more tint and less blur than a toolbar does.

   The rule that makes the fallback below trivially correct: **every glass
   surface must be legible with its blur removed.** The tint alone carries the
   contrast; blur is decoration on top. test/styles.test.ts asserts exactly
   that, compositing each tint over --ground with blur ignored. */
.glass {
  background: var(--glass-tint);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  box-shadow: var(--glass-edge), var(--glass-shadow);
}
.glass-solid {
  background: var(--glass-tint-solid);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  box-shadow: var(--glass-edge), var(--glass-shadow);
}

/* iOS's own Reduce Transparency, and its web equivalent. Because of the rule
   above this is a token swap, not a second design. */
@media (prefers-reduced-transparency: reduce) {
  :root { --glass-tint: #faf7f2; --glass-tint-solid: #fffdfa; }
  .glass,
  .glass-solid { -webkit-backdrop-filter: none; backdrop-filter: none; }
}

@media (prefers-reduced-motion: reduce) {
  :root { --dur-fast: 1ms; --dur-base: 1ms; }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter inv-app-web exec vitest run test/styles.test.ts`
Expected: PASS, 10 tests. At `--glass-alpha: 0.62` the surface composites to roughly `#faf7f3`, which puts `--ink-muted` at ~5.0:1.

- [ ] **Step 5: Commit**

```bash
git add web/src/styles.css web/test/styles.test.ts
git commit -m "$(cat <<'EOF'
Add the two glass surfaces, and the rule that makes them safe

Every glass surface must be legible with its blur removed: the tint
carries the contrast, blur is decoration. That is what lets
prefers-reduced-transparency be a token swap rather than a second
design, and the test asserts it by compositing each tint over the ground
with blur ignored.

Two surfaces rather than one — .glass-solid carries text, so it takes
more tint and less blur than a toolbar does.

--glass-alpha is a token beside --glass-tint so the test can composite
the surface without parsing an rgba() string.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: The palette→ground map, and the editor shell that keys it

**Files:**
- Modify: `web/src/styles.css` (ground map after the glass classes)
- Modify: `web/src/App.tsx:104` (the `<div className="cc-shell">`)
- Modify: `web/test/styles.test.ts`

**Interfaces:**
- Consumes: `sections`, `rootTokens` from `web/test/cssTokens.ts`.
- Produces: `.cc-shell[data-palette="<token>"]` rules defining `--ground`, `--ground-tint-a`, `--ground-tint-b`; the `data-palette` attribute on the editor shell.

**Why an attribute and not the palette class:** `--bg`/`--accent` are set by `palette-*` **on the card**, a descendant of the ground, and CSS does not cascade upward. Putting `palette-*` on the shell instead would leak the card's `--ink` and `--accent` into the chrome, where the product's own accent belongs.

**Note on coverage:** the attribute itself is one expression in `App.tsx`, and this suite has no App-render test (adding one would mean mocking `api`, the router and four hooks — out of scope here). The half that can silently break is a palette with no ground entry, and Step 1 covers exactly that.

- [ ] **Step 1: Write the failing test**

Append to `web/test/styles.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter inv-app-web exec vitest run test/styles.test.ts -t "palette-tinted"`
Expected: FAIL — the ground list is empty, so the arrays do not match.

- [ ] **Step 3: Write minimal implementation**

Add to `web/src/styles.css` after the reduced-motion media block:

```css
/* The editor's ground, tinted by the invitation being edited (adr-018 §1).
   A hand-mirror of the six .palette-* entries — NFR-8 lists it, and
   test/styles.test.ts holds the pairing by enum coverage.

   Every ground stays light, festive included: the card goes dark, the room
   it sits in does not. */
.cc-shell[data-palette="warm"]     { --ground: #f4e9d9; --ground-tint-a: #fdf7ec; --ground-tint-b: #efdcc2; }
.cc-shell[data-palette="elegant"]  { --ground: #f3f0e6; --ground-tint-a: #fffef9; --ground-tint-b: #e9e2cb; }
.cc-shell[data-palette="playful"]  { --ground: #f5efdc; --ground-tint-a: #fffdf2; --ground-tint-b: #f2e4bd; }
.cc-shell[data-palette="minimal"]  { --ground: #f1f0ee; --ground-tint-a: #ffffff; --ground-tint-b: #e4e2df; }
.cc-shell[data-palette="festive"]  { --ground: #e8e7ef; --ground-tint-a: #f7f6fb; --ground-tint-b: #d4d3e2; }
.cc-shell[data-palette="romantic"] { --ground: #f4e6e8; --ground-tint-a: #fdf6f7; --ground-tint-b: #eed3d8; }
```

In `web/src/App.tsx`, change the shell element:

```tsx
    <div className="cc-shell" data-palette={editor.invitation?.design.palette}>
```

Add this comment directly above it:

```tsx
    // The ground is tinted by the invitation being edited (adr-018 §1). An
    // attribute rather than the palette-* class: that class would also push
    // the card's --ink and --accent into the chrome, where the product's own
    // accent belongs. Undefined before the first generate, which falls back to
    // the bare :root --ground.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter inv-app-web exec vitest run test/styles.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Typecheck — the attribute is new markup**

Run: `pnpm --filter inv-app-web typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/styles.css web/src/App.tsx web/test/styles.test.ts
git commit -m "$(cat <<'EOF'
Tint the editor's ground with the invitation's own palette

Adaptive tinting is the most genuinely iOS idea in the direction, and
the obvious mechanism does not work: --bg is set by palette-* on the
card, a descendant of the ground, and CSS does not cascade upward.
Putting palette-* on the shell instead would leak the card's --ink and
--accent into the chrome.

So the shell carries data-palette and the stylesheet holds a six-entry
map. That is a new hand-mirror, so it gets the treatment the others
have: enum coverage by test, and a line in NFR-8 when the docs land.

Every ground stays light, festive included — the card goes dark, the
room it sits in does not. Asserted, not just intended.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: The ratchet, and the editor chrome converted to tokens

**Files:**
- Modify: `web/test/styles.test.ts`
- Modify: `web/src/styles.css` — the `App chrome` and `Creation chat` sections

**Interfaces:**
- Consumes: `sections` from `web/test/cssTokens.ts`.
- Produces: the `CONVERTED` allowlist constant in `styles.test.ts`, which tasks 5–6 and every future surface conversion extend.

- [ ] **Step 1: Write the failing test**

Append to `web/test/styles.test.ts`:

```ts
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
      const literals = [...(body as string).matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]);
      expect(literals).toEqual([]);
    });
  }

  it("names only sections that exist", () => {
    expect(CONVERTED.filter((n) => !parts.has(n))).toEqual([]);
  });
});
```

Add `sections` to the import at the top of the file.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter inv-app-web exec vitest run test/styles.test.ts -t "no raw hex"`
Expected: FAIL — both sections report their literals (`App chrome` has `#f6f5f2`, `#23211d`, `#efece6`, …; `Creation chat` has ~40).

- [ ] **Step 3: Write minimal implementation**

In `web/src/styles.css`, replace every hex literal in the `App chrome` and `Creation chat` sections with the token that matches. The mapping is mechanical — apply it exactly:

| Literal | Token |
|---|---|
| `#f6f5f2`, `#f1efe9`, `#f4f2ed` | `var(--ground)` |
| `#fff`, `#ffffff` | `var(--surface)` |
| `#23211d`, `#4a3728` (chrome only — `.cc-start-title`, `.cc-chip`, `.cc-act`) | `var(--ink)` |
| `#6b6659` | `var(--ink-muted)` |
| `#8d8577`, `#a89f8e`, `#9a9384`, `#8f887a`, `#a29a8b`, `#bcb3a2` | `var(--ink-faint)` |
| `#b3592e` | `var(--accent)` |
| `#a04e27` | `var(--accent-hi)` |
| `#f7efe3`, `#fbf6ef` | `var(--accent-wash)` |
| `#e4ddd0`, `#d8d2c6`, `#c8c4bb`, `#d3ccbe` | `var(--edge)` |
| `#efece6`, `#f2efe9`, `#e9e4dc`, `#e7e2d9`, `#ece8e0`, `#f6f3ed` | `var(--edge)` for borders, `var(--accent-wash)` for fills |

Two rules that are **not** a straight swap:

```css
/* The shimmer keeps literal stops: it is a three-stop gradient whose middle
   stop must be lighter than both ends, and tokens have no "one step lighter"
   operation. Kept here rather than minted as two more tokens nothing else
   would use. */
.cc-sk {
  background: linear-gradient(90deg, #ece8e0 25%, #f6f3ed 37%, #ece8e0 63%);
  background-size: 640px 100%;
  animation: ccShimmer 1.5s infinite linear;
  border-radius: var(--r-sm);
}
```

Since `.cc-sk` keeps literals, add it to the ratchet's exception list. Amend the test's section body filter:

```ts
      // .cc-sk's three-stop shimmer needs relative lightness, which tokens
      // cannot express — see the rule's own comment.
      const scanned = (body as string).replace(/\.cc-sk\s*\{[^}]*\}/g, "");
      const literals = [...scanned.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]);
```

Also replace the ad-hoc radii in these two sections with `var(--r-sm)` (6–8px), `var(--r-md)` (10–12px), `var(--r-lg)` (14–16px), `var(--r-xl)` (20–22px), `var(--r-pill)` (999px), and the bespoke shadows with `var(--e-1)`, `var(--e-2)`, `var(--e-3)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter inv-app-web exec vitest run test/styles.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 5: Run the whole suite and typecheck**

Run: `pnpm --filter inv-app-web test && pnpm --filter inv-app-web typecheck`
Expected: PASS. `.cc-share` is the only editor class any test names, and it is unchanged.

- [ ] **Step 6: Look at it before committing**

Run `pnpm dev`, open `http://localhost:5173/create`, generate an invitation.

**Some pixels will move, and that is the point** — consolidating 106 colours into ten cannot be value-preserving. Expect exactly these, and treat anything else as a wrong mapping:

- the three accent hovers (`#a04e27`, `#9f4d26`) become one `--accent-hi`
- six near-identical warm greys snap to `--ink-faint`
- `.cc-start-title`'s warm brown `#4a3728` becomes the cooler `--ink`
- ad-hoc radii snap to the five-step scale

What must **not** change: layout, spacing, the invitation card, or anything outside the editor. If the landing page or the guest page shifts, a token leaked out of its section.

- [ ] **Step 7: Commit**

```bash
git add web/src/styles.css web/test/styles.test.ts
git commit -m "$(cat <<'EOF'
Put the editor's chrome on tokens, and ratchet the rule shut

The two editor sections lose every raw hex, and a test refuses to let
them come back. The allowlist is the point: each future surface
conversion ADDS a name to CONVERTED, so "we'll tokenise the rest later"
is checkable rather than hopeful. Without it the second surface arrives
with fresh literals and 106 colours come back.

Invitation card is permanently outside the ratchet — its values are
mirrored by hand in the OG renderer, where a raw hex is what keeps the
mirror visible.

.cc-sk keeps its literals with the reason on the rule: a three-stop
shimmer needs a middle stop lighter than both ends, and tokens have no
"one step lighter". Two more tokens nothing else would use is worse.

Some pixels move, and that is the work rather than a side effect: three
accent hovers become one, six near-identical greys snap to one step,
and the radii land on a five-step scale. Layout, spacing and the card
are untouched.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: The glass canvas — ground, floating panels, near-bleed card

**Files:**
- Modify: `web/src/styles.css` — `Creation chat` section

**Interfaces:**
- Consumes: `.glass` / `.glass-solid` (Task 2), the ground map (Task 3).
- Produces: the `.cc-canvas` wrapper class consumed by `PreviewPanel` in Task 6.

- [ ] **Step 1: Write the failing test**

Append to `web/test/styles.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter inv-app-web exec vitest run test/styles.test.ts -t "editor canvas"`
Expected: FAIL — `--ground-tint-a` is not referenced in `.cc-shell`; `.cc-canvas .inv` does not exist.

- [ ] **Step 3: Write minimal implementation**

In the `Creation chat` section of `web/src/styles.css`:

```css
.cc-shell {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  background-color: var(--ground);
  background-image:
    radial-gradient(70% 48% at 50% 0%, var(--ground-tint-a, transparent) 0%, transparent 72%),
    radial-gradient(60% 40% at 88% 92%, var(--ground-tint-b, transparent) 0%, transparent 70%);
  transition: background-color var(--dur-base) var(--ease-ios);
}

/* Header: a floating pill, not a bar with a border-bottom. */
.cc-header {
  position: relative;
  flex: 0 0 auto;
  height: 48px;
  margin: 12px 14px 0;
  border-radius: var(--r-pill);
  display: flex;
  align-items: center;
  padding: 0 6px 0 12px;
  gap: 10px;
  z-index: 6;
}

/* Chat: a floating panel, not a flush 440px column with a border-right. */
.cc-chat {
  width: 420px;
  flex: 0 0 auto;
  margin: 14px 0 14px 14px;
  border-radius: var(--r-xl);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.cc-preview { flex: 1; background: none; overflow-y: auto; display: flex; align-items: center; justify-content: center; padding: 28px; }

/* Near-bleed (adr-018 §3): a scoped override, so InvitationPreview.tsx is not
   touched. It is DS-synced and rendered in four places — editor, gallery
   cards, landing hero fan, guest page — and its props are hand-mirrored in
   .design-sync/config.json and conventions.md, both of which have gone stale
   before.

   12px of inset rather than true full-bleed, for three reasons in the code:
   the guest receives a card (.gr-card at both breakpoints), layout-banner's
   title bar hangs on a negative margin with a radius tied to the card's own
   (square corners show two wedges of background), and layout-split's 38%
   image panel becomes a strip on a phone. */
@media (max-width: 800px) {
  .cc-canvas .inv { box-shadow: var(--e-1); }
  .cc-preview { padding: 12px; align-items: flex-start; }
}
```

Apply `.glass` to the header and chat panel by adding the class in markup — see Task 6 Step 3, which touches the same two elements. For this task, add the CSS hooks only:

```css
.cc-header { /* …as above… */ background: var(--glass-tint); -webkit-backdrop-filter: var(--glass-blur); backdrop-filter: var(--glass-blur); box-shadow: var(--glass-edge), var(--glass-shadow); }
.cc-chat   { /* …as above… */ background: var(--glass-tint); -webkit-backdrop-filter: var(--glass-blur); backdrop-filter: var(--glass-blur); box-shadow: var(--glass-edge), var(--glass-shadow); }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter inv-app-web exec vitest run test/styles.test.ts`
Expected: PASS, 17 tests. The `-webkit-` pairing test from Task 2 still passes because both declarations were added together.

- [ ] **Step 5: Look at it**

Run `pnpm dev`, open `/create`, generate, and switch palettes with the existing controls. The ground should shift hue with each palette. Check `festive` specifically: the card goes dark navy, the ground must stay light.

- [ ] **Step 6: Commit**

```bash
git add web/src/styles.css web/test/styles.test.ts
git commit -m "$(cat <<'EOF'
Float the editor's chrome on a tinted ground

The 58px header bar with a border-bottom becomes a pill; the 440px
column with a border-right becomes a panel; the flat #f1efe9 preview
pane becomes the ground the invitation's own palette tints.

The card near-bleeds rather than full-bleeds, and the 12px is not
timidity. layout-banner hangs its title bar on a negative margin with a
radius tied to the card's, so a square-cornered card shows two wedges of
background at the top corners; layout-split's 38% image panel becomes a
strip on a phone; and the guest receives a card at both breakpoints, so
full-bleed would mean composing on a surface no guest ever sees.

All of it is a scoped override. InvitationPreview.tsx is untouched.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: The segmented design toolbar

**Files:**
- Create: `web/src/components/editor/DesignToolbar.tsx`
- Create: `web/src/components/editor/DesignSheet.tsx`
- Create: `web/test/DesignToolbar.test.tsx`
- Modify: `web/src/components/editor/PreviewPanel.tsx`
- Modify: `web/src/styles.css`

**Interfaces:**
- Consumes: `DesignStrings` from `../../i18n`; `LAYOUTS`, `ORNAMENTS`, `PALETTES`, `TYPOGRAPHIES`, `DesignTokens`, `BackgroundRef` from `../../types`.
- Produces: `<DesignToolbar design labels onChange background backgroundBusy onBackgroundAdd onBackgroundRemove />` — same prop shape as `DesignControls`, so `PreviewPanel` swaps one import.

- [ ] **Step 1: Write the failing test**

Create `web/test/DesignToolbar.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DesignToolbar } from "../src/components/editor/DesignToolbar";
import { UI } from "../src/i18n";
import type { DesignTokens } from "../src/types";

// vite.config.ts sets globals:false, so RTL's auto-cleanup never registers.
afterEach(cleanup);

const design: DesignTokens = {
  palette: "warm",
  typography: "serif",
  layout: "classic",
  ornament: "floral",
};

function renderToolbar(overrides: Partial<Parameters<typeof DesignToolbar>[0]> = {}) {
  return render(
    <DesignToolbar
      design={design}
      labels={UI.uk.design}
      onChange={() => {}}
      background={null}
      {...overrides}
    />,
  );
}

describe("DesignToolbar", () => {
  it("shows one segment per token group and no options until one is opened", () => {
    const { container } = renderToolbar();
    expect(container.querySelectorAll(".cc-seg-item")).toHaveLength(4);
    expect(container.querySelector(".cc-design-sheet")).toBeNull();
  });

  it("opens a sheet for the pressed segment", () => {
    const { container } = renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: UI.uk.design.palette }));
    expect(container.querySelector(".cc-design-sheet")).not.toBeNull();
    // Six palettes, each still reading its colour from its own palette-* class.
    expect(container.querySelectorAll(".swatch")).toHaveLength(6);
    expect(container.querySelector(".swatch.palette-warm")).not.toBeNull();
  });

  it("closes the open sheet when the same segment is pressed again", () => {
    const { container } = renderToolbar();
    const seg = screen.getByRole("button", { name: UI.uk.design.palette });
    fireEvent.click(seg);
    fireEvent.click(seg);
    expect(container.querySelector(".cc-design-sheet")).toBeNull();
  });

  it("reports the chosen token and leaves the sheet open to try another", () => {
    const onChange = vi.fn();
    const { container } = renderToolbar({ onChange });
    fireEvent.click(screen.getByRole("button", { name: UI.uk.design.palette }));
    fireEvent.click(screen.getByRole("button", { name: UI.uk.design.values.festive }));
    expect(onChange).toHaveBeenCalledWith({ palette: "festive" });
    expect(container.querySelector(".cc-design-sheet")).not.toBeNull();
  });

  it("hides the background segment for the minimal palette, which rejects one", () => {
    renderToolbar({
      design: { ...design, palette: "minimal" },
      onBackgroundAdd: () => {},
    });
    expect(screen.queryByRole("button", { name: UI.uk.design.background })).toBeNull();
  });

  it("shows the background segment when a handler exists and the palette allows it", () => {
    renderToolbar({ onBackgroundAdd: () => {} });
    expect(screen.getByRole("button", { name: UI.uk.design.background })).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter inv-app-web exec vitest run test/DesignToolbar.test.tsx`
Expected: FAIL — "Failed to resolve import ../src/components/editor/DesignToolbar".

- [ ] **Step 3: Write minimal implementation**

Create `web/src/components/editor/DesignSheet.tsx`:

```tsx
import type { ReactNode } from "react";

interface Props {
  title: string;
  children: ReactNode;
}

/** The sheet one toolbar segment opens. Deliberately dims nothing: the card
 *  stays visible behind it so the host watches the token land. */
export function DesignSheet({ title, children }: Props) {
  return (
    <div className="cc-design-sheet glass-solid" role="group" aria-label={title}>
      <div className="cc-sheet-grab" />
      <div className="cc-design-sheet-title">{title}</div>
      <div className="cc-design-sheet-body">{children}</div>
    </div>
  );
}
```

Create `web/src/components/editor/DesignToolbar.tsx`:

```tsx
import { useState } from "react";
import type { DesignStrings } from "../../i18n";
import {
  type BackgroundRef,
  type DesignTokens,
  LAYOUTS,
  ORNAMENTS,
  PALETTES,
  TYPOGRAPHIES,
} from "../../types";
import { DesignSheet } from "./DesignSheet";

interface Props {
  design: DesignTokens;
  labels: DesignStrings;
  onChange: (patch: Partial<DesignTokens>) => void;
  /** AI background layer (adr-009); the segment is hidden without a handler
   *  and for the minimal palette (excluded from backgrounds). */
  background?: BackgroundRef | null;
  backgroundBusy?: boolean;
  onBackgroundAdd?: () => void;
  onBackgroundRemove?: () => void;
}

type Segment = "palette" | "typography" | "layout" | "ornament" | "background";

// Mirrors the ::before content in styles.css, same as DesignControls did.
const ORNAMENT_GLYPHS: Record<DesignTokens["ornament"], string> = {
  none: "—",
  floral: "✿",
  geometric: "◆",
  sparkle: "✦",
};

/**
 * The editor's design picker as one segmented bar (adr-018 §4).
 *
 * Replaces four labelled rows stacked above the card, which cost roughly a
 * third of a phone screen before the invitation got any. Pressing a segment
 * raises a sheet; pressing it again closes it. The sheet stays open after a
 * choice so the host can try the next one without re-opening.
 *
 * The swatches still carry `palette-*`, so their colours track styles.css
 * without duplicating a value here — the same property DesignControls had.
 */
export function DesignToolbar({
  design,
  labels,
  onChange,
  background,
  backgroundBusy,
  onBackgroundAdd,
  onBackgroundRemove,
}: Props) {
  const [open, setOpen] = useState<Segment | null>(null);
  const showBackground = Boolean(onBackgroundAdd) && design.palette !== "minimal";

  const segments: { id: Segment; label: string }[] = [
    { id: "palette", label: labels.palette },
    { id: "typography", label: labels.typography },
    { id: "layout", label: labels.layout },
    { id: "ornament", label: labels.ornament },
    ...(showBackground ? [{ id: "background" as Segment, label: labels.background }] : []),
  ];

  return (
    <div className="cc-design">
      {open === "palette" && (
        <DesignSheet title={labels.palette}>
          {PALETTES.map((palette) => (
            <button
              key={palette}
              type="button"
              className={`swatch palette-${palette}${design.palette === palette ? " active" : ""}`}
              aria-label={labels.values[palette]}
              aria-pressed={design.palette === palette}
              onClick={() => onChange({ palette })}
            >
              <span className="swatch-dot" />
            </button>
          ))}
        </DesignSheet>
      )}

      {open === "typography" && (
        <DesignSheet title={labels.typography}>
          {TYPOGRAPHIES.map((typography) => (
            <button
              key={typography}
              type="button"
              className={`design-option type-${typography} font-sample${design.typography === typography ? " active" : ""}`}
              aria-label={labels.values[typography]}
              aria-pressed={design.typography === typography}
              onClick={() => onChange({ typography })}
            >
              Aa
            </button>
          ))}
        </DesignSheet>
      )}

      {open === "layout" && (
        <DesignSheet title={labels.layout}>
          {LAYOUTS.map((layout) => (
            <button
              key={layout}
              type="button"
              className={`design-option${design.layout === layout ? " active" : ""}`}
              aria-pressed={design.layout === layout}
              onClick={() => onChange({ layout })}
            >
              {labels.values[layout]}
            </button>
          ))}
        </DesignSheet>
      )}

      {open === "ornament" && (
        <DesignSheet title={labels.ornament}>
          {ORNAMENTS.map((ornament) => (
            <button
              key={ornament}
              type="button"
              className={`design-option${design.ornament === ornament ? " active" : ""}`}
              aria-pressed={design.ornament === ornament}
              onClick={() => onChange({ ornament })}
            >
              {ORNAMENT_GLYPHS[ornament]} {labels.values[ornament]}
            </button>
          ))}
        </DesignSheet>
      )}

      {open === "background" && showBackground && (
        <DesignSheet title={labels.background}>
          {backgroundBusy ? (
            <button type="button" className="design-option" disabled>
              {labels.bgGenerating}
            </button>
          ) : background ? (
            <>
              <button type="button" className="design-option" onClick={onBackgroundAdd}>
                {labels.bgRegenerate}
              </button>
              <button type="button" className="design-option" onClick={onBackgroundRemove}>
                {labels.bgRemove}
              </button>
            </>
          ) : (
            <button type="button" className="design-option" onClick={onBackgroundAdd}>
              {labels.bgAdd}
            </button>
          )}
        </DesignSheet>
      )}

      <div className="cc-seg glass" role="group" aria-label={labels.palette}>
        {segments.map((seg) => (
          <button
            key={seg.id}
            type="button"
            className={`cc-seg-item${open === seg.id ? " on" : ""}`}
            aria-expanded={open === seg.id}
            onClick={() => setOpen((cur) => (cur === seg.id ? null : seg.id))}
          >
            {seg.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

In `web/src/components/editor/PreviewPanel.tsx`, change the import and the render. Replace:

```tsx
import { DesignControls } from "../DesignControls";
```

with:

```tsx
import { DesignToolbar } from "./DesignToolbar";
```

and replace the `<DesignControls … />` element with:

```tsx
        <DesignToolbar
          design={invitation.design}
          labels={t.design}
          onChange={onDesignChange}
          background={invitation.background}
          backgroundBusy={backgroundBusy}
          onBackgroundAdd={onBackgroundAdd}
          onBackgroundRemove={onBackgroundRemove}
        />
```

Change the wrapper so Task 5's near-bleed override has its hook:

```tsx
    <section className="cc-preview">
      <div className="cc-preview-inner cc-canvas">
```

Add the toolbar CSS to the `Creation chat` section of `web/src/styles.css`:

```css
/* Design toolbar (adr-018 §4). One segmented bar in place of four labelled
   rows; the sheet it raises dims nothing, so the card stays visible behind it
   and the host watches the token land. */
.cc-design { position: sticky; bottom: 0; display: flex; flex-direction: column; gap: 10px; }
.cc-seg { display: flex; gap: 5px; padding: 5px; border-radius: var(--r-xl); }
.cc-seg-item { flex: 1; border: none; background: none; font: inherit; font-size: 0.78rem; font-weight: 600; color: var(--ink-muted); padding: 9px 4px; border-radius: var(--r-lg); cursor: pointer; transition: background var(--dur-fast) var(--ease-ios); }
.cc-seg-item.on { background: var(--surface); color: var(--accent); box-shadow: var(--e-1); }

.cc-design-sheet { border-radius: var(--r-xl); padding: 10px 16px 16px; }
.cc-sheet-grab { width: 36px; height: 4px; border-radius: var(--r-pill); background: var(--edge); margin: 0 auto 12px; }
.cc-design-sheet-title { font-size: 0.82rem; font-weight: 700; color: var(--ink); margin-bottom: 10px; }
.cc-design-sheet-body { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter inv-app-web exec vitest run test/DesignToolbar.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 5: Run the whole suite and typecheck**

Run: `pnpm --filter inv-app-web test && pnpm --filter inv-app-web typecheck`
Expected: PASS. `DesignControls.tsx` is now unimported by the editor but still compiles and is still covered by nothing — that is unchanged from before.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/editor/DesignToolbar.tsx web/src/components/editor/DesignSheet.tsx web/src/components/editor/PreviewPanel.tsx web/src/styles.css web/test/DesignToolbar.test.tsx
git commit -m "$(cat <<'EOF'
Collapse four control rows into one segmented bar

This is the part of the redesign that is not only cosmetic. Palette,
typography, layout and ornament were four labelled rows stacked above
the card, costing roughly a third of a phone screen before the
invitation got any. Now they are one bar, and a pressed segment raises a
sheet that dims nothing — the card stays visible so the host watches the
token land.

The sheet stays open after a choice: picking a palette is a thing people
do three times in a row, and re-opening between each was the old
control's real cost.

DesignControls stays as it is. It works, nothing else has replaced it
yet, and rewriting it in place would put a component the editor no
longer uses into this diff.

Swatches keep their palette-* classes, so option colours still track
styles.css rather than duplicating a value.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: The past-date banner

**Files:**
- Create: `web/test/pastDateBanner.test.tsx`
- Create: `web/src/components/editor/PastDateBanner.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/styles.css`

**Interfaces:**
- Consumes: `editor.dateBlocked` (already on `useInvitationEditor`), `t.chat.pastDateBlock` (already in `i18n.ts`).
- Produces: `<PastDateBanner blocked={boolean} message={string} />`.

**Nothing in `useInvitationEditor` changes.** The banner is a third view of state `App.tsx` already reads twice — line 98 for `canPublish`, line 134 for the button's `title`. `useInvitationEditor.test.ts` must stay green untouched; `:208` pins the per-turn repetition and `:247` pins message ordering, and both still describe the behaviour after this task.

- [ ] **Step 1: Write the failing test**

Create `web/test/pastDateBanner.test.tsx`:

```tsx
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PastDateBanner } from "../src/components/editor/PastDateBanner";
import { UI } from "../src/i18n";

afterEach(cleanup);

describe("PastDateBanner", () => {
  it("says nothing when publishing is not blocked", () => {
    const { container } = render(
      <PastDateBanner blocked={false} message={UI.uk.chat.pastDateBlock} />,
    );
    expect(container.querySelector(".cc-banner")).toBeNull();
  });

  it("states the reason the Publish button is disabled", () => {
    const { container } = render(
      <PastDateBanner blocked={true} message={UI.uk.chat.pastDateBlock} />,
    );
    const banner = container.querySelector(".cc-banner");
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toBe(UI.uk.chat.pastDateBlock);
  });

  // FR-1.8's reason must reach a host who cannot see the chat log — which is
  // every mobile host once the log collapses behind the composer.
  it("announces itself politely, so it is not only a visual cue", () => {
    const { container } = render(
      <PastDateBanner blocked={true} message={UI.uk.chat.pastDateBlock} />,
    );
    expect(container.querySelector(".cc-banner")?.getAttribute("role")).toBe("status");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter inv-app-web exec vitest run test/pastDateBanner.test.tsx`
Expected: FAIL — "Failed to resolve import ../src/components/editor/PastDateBanner".

- [ ] **Step 3: Write minimal implementation**

Create `web/src/components/editor/PastDateBanner.tsx`:

```tsx
interface Props {
  blocked: boolean;
  message: string;
}

/**
 * Why Publish is disabled (FR-1.8), pinned where it cannot scroll away.
 *
 * The chat log says the same thing on every turn the date is still past, and
 * that stays — the two do different jobs. The log entry is the assistant
 * answering a refused publish in conversation; this is the standing
 * explanation of a disabled control, and it has to survive a collapsed log on
 * a phone. `useInvitationEditor` is unchanged: this renders from `dateBlocked`,
 * which App already reads for `canPublish`.
 */
export function PastDateBanner({ blocked, message }: Props) {
  if (!blocked) return null;
  return (
    <div className="cc-banner glass-solid" role="status">
      {message}
    </div>
  );
}
```

In `web/src/App.tsx`, add the import beside the other editor imports:

```tsx
import { PastDateBanner } from "./components/editor/PastDateBanner";
```

and render it immediately before `<div className="cc-main">`:

```tsx
      <PastDateBanner blocked={editor.dateBlocked} message={t.chat.pastDateBlock} />
```

Add to the `Creation chat` section of `web/src/styles.css`:

```css
/* FR-1.8's refusal, pinned. Warm-tinted rather than red: the date is a thing
   to fix, not a failure, and the app has no alert language anywhere else. */
.cc-banner {
  margin: 10px 14px 0;
  padding: 11px 16px;
  border-radius: var(--r-lg);
  font-size: 0.86rem;
  line-height: 1.45;
  color: var(--ink);
  border-left: 3px solid var(--accent);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter inv-app-web exec vitest run test/pastDateBanner.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Prove the hook did not change**

Run: `pnpm --filter inv-app-web exec vitest run test/useInvitationEditor.test.ts`
Expected: PASS, untouched. If anything here fails, the banner has reached into the hook and the task has gone wrong.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/editor/PastDateBanner.tsx web/src/App.tsx web/src/styles.css web/test/pastDateBanner.test.tsx
git commit -m "$(cat <<'EOF'
Pin FR-1.8's reason where a collapsed log cannot hide it

"Said on every turn it is still true" was a sufficient guarantee only
because the log was always on screen. Collapsing it behind a composer
would have killed that quietly — the rule intact in the code, gone from
the UI, with nothing failing.

The banner costs nothing because the state already exists: App reads
dateBlocked twice already, for canPublish and for the button's title.
This is a third view of it, sitting beside the control it explains.

The log emission stays exactly as it is. The two do different jobs — the
log entry is the assistant answering a refused publish in conversation,
the banner is the standing explanation of a disabled button — and
useInvitationEditor.test.ts stays green untouched, which is the check
that this did not reach into the hook.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Mobile — the peek line and the collapsible log

**Files:**
- Modify: `web/src/components/editor/ChatPanel.tsx`
- Modify: `web/src/styles.css`
- Create: `web/test/ChatPanel.test.tsx`

**Interfaces:**
- Consumes: `ChatMsg`, `Phase` from `../../hooks/useInvitationEditor`; `ChatStrings` from `../../i18n`.
- Produces: no new exports — `ChatPanel`'s props are unchanged, so `App.tsx` is untouched by this task.

- [ ] **Step 1: Write the failing test**

Create `web/test/ChatPanel.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChatPanel } from "../src/components/editor/ChatPanel";
import { UI } from "../src/i18n";

afterEach(cleanup);

const t = UI.uk.chat;

const messages = [
  { role: "user" as const, text: "Весілля 12 жовтня" },
  { role: "assistant" as const, text: "Готово! Ось ваше запрошення." },
  { role: "user" as const, text: "Зроби текст тепліший" },
  { role: "assistant" as const, text: "Оновила вітання та основний текст." },
];

function renderPanel(overrides: Partial<Parameters<typeof ChatPanel>[0]> = {}) {
  return render(
    <ChatPanel
      messages={messages}
      phase="active"
      hasInvitation={true}
      onSend={() => {}}
      t={t}
      {...overrides}
    />,
  );
}

describe("ChatPanel peek line", () => {
  it("peeks the latest assistant message, not the host's own words", () => {
    const { container } = renderPanel();
    expect(container.querySelector(".cc-peek")?.textContent).toBe(
      "Оновила вітання та основний текст.",
    );
  });

  it("peeks the generating status while a call is in flight", () => {
    const { container } = renderPanel({ phase: "generating" });
    expect(container.querySelector(".cc-peek")?.textContent).toBe(t.creating);
  });

  it("peeks nothing before the first exchange", () => {
    const { container } = renderPanel({ messages: [], phase: "empty" });
    expect(container.querySelector(".cc-peek")).toBeNull();
  });

  it("opens the full transcript when the peek line is pressed", () => {
    const { container } = renderPanel();
    expect(container.querySelector(".cc-chat.open")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: t.openLog }));
    expect(container.querySelector(".cc-chat.open")).not.toBeNull();
  });

  it("closes it again, because a phone screen is the card's", () => {
    const { container } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: t.openLog }));
    fireEvent.click(screen.getByRole("button", { name: t.closeLog }));
    expect(container.querySelector(".cc-chat.open")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter inv-app-web exec vitest run test/ChatPanel.test.tsx`
Expected: FAIL — `.cc-peek` is null, and `t.openLog` is `undefined` so the accessible-name query throws.

- [ ] **Step 3: Add the two strings**

In `web/src/i18n.ts`, add to the `ChatStrings` interface, beside `send`:

```ts
  /** Opens and closes the transcript on a phone, where it collapses behind the
   *  composer (adr-018 §6). Desktop shows the log outright and never uses them
   *  as visible labels — they stay the button's accessible name. */
  openLog: string;
  closeLog: string;
```

In the `uk` chat block:

```ts
      openLog: "Показати листування",
      closeLog: "Сховати листування",
```

In the `en` chat block:

```ts
      openLog: "Show conversation",
      closeLog: "Hide conversation",
```

`web/test/i18n.test.ts` walks both tables and fails on a key present in one language only, so this is covered the moment it is added.

- [ ] **Step 4: Write minimal implementation**

In `web/src/components/editor/ChatPanel.tsx`, add `useState` for the open flag and the peek line. Replace the component body's `return` with:

```tsx
  // The latest thing the assistant said, or the status while it is saying it.
  // On a phone the transcript collapses behind the composer, and this line is
  // what keeps FR-1.7's nudge and the generating state from disappearing with
  // it. FR-1.8's refusal does not rely on this — it has its own pinned banner,
  // because a peek line can be scrolled past by the next message.
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const peek = generating ? t.creating : lastAssistant?.text;

  return (
    <section className={`cc-chat glass${open ? " open" : ""}`}>
      {peek && (
        <button
          type="button"
          className="cc-peek"
          aria-label={open ? t.closeLog : t.openLog}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {peek}
        </button>
      )}
      <div className="cc-messages">
        {/* …unchanged… */}
      </div>
      <div className="cc-composer">
        {/* …unchanged… */}
      </div>
    </section>
  );
```

and add above it, beside the existing `useState`:

```tsx
  const [open, setOpen] = useState(false);
```

Add to the `Creation chat` section of `web/src/styles.css`, replacing the existing `@media (max-width: 800px)` block's `.cc-chat` rule:

```css
/* Peek line: the latest turn, always visible. Desktop shows the transcript
   outright, so the line is redundant there and hidden. */
.cc-peek { display: none; }

@media (max-width: 800px) {
  .cc-main { flex-direction: column; }
  .cc-preview { order: 1; }
  .cc-chat {
    order: 2;
    width: auto;
    margin: 0 12px 12px;
    border-radius: var(--r-xl);
  }
  /* Collapsed: composer and peek only. The card owns the phone screen. */
  .cc-chat .cc-messages { display: none; }
  .cc-chat.open .cc-messages { display: flex; max-height: 46vh; }
  .cc-peek {
    display: block;
    width: 100%;
    border: none;
    background: none;
    font: inherit;
    font-size: 0.8rem;
    color: var(--ink-muted);
    text-align: left;
    padding: 11px 16px 3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
  }
  .cc-composer { padding: 8px 10px 10px 16px; }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter inv-app-web exec vitest run test/ChatPanel.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 6: Run the whole suite and typecheck**

Run: `pnpm --filter inv-app-web test && pnpm --filter inv-app-web typecheck`
Expected: PASS, including `i18n.test.ts` with the two new keys in both tables.

- [ ] **Step 7: Look at it on a phone width**

Run `pnpm dev`, open `/create` at 390px wide, generate an invitation. The card should own the screen with the toolbar and composer floating over it; the peek line should carry the assistant's last message; pressing it should raise the transcript.

- [ ] **Step 8: Commit**

```bash
git add web/src/components/editor/ChatPanel.tsx web/src/i18n.ts web/src/styles.css web/test/ChatPanel.test.tsx
git commit -m "$(cat <<'EOF'
Give the phone its screen back, without losing the conversation

The transcript collapses behind the composer and the card takes the
screen — which is the whole point of the direction, and would have been
a quiet regression without the line above the composer carrying the
latest turn. FR-1.7's nudge and the generating state both live there.

FR-1.8's refusal deliberately does not rely on it: a peek line can be
pushed aside by the next message, so the refusal keeps the pinned banner
from the previous commit.

Desktop is unchanged — it shows the transcript outright, and the peek
line is hidden rather than conditionally rendered so the two layouts
stay one component.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Settle it in the docs

**Files:**
- Create: `docs/decisions/adr-018-material-system.md`
- Modify: `docs/03-non-functional-requirements.md`
- Modify: `docs/06-roadmap.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Write the ADR**

Create `docs/decisions/adr-018-material-system.md` by converting the spec at `docs/superpowers/specs/2026-09-15-editor-material-system-design.md` into this repo's ADR shape: `# ADR-018 — Material system and the editor canvas`, a status line (`**Status:** accepted · **Date:** 2026-09 · Lands as **NFR-9**`), then `## Context`, `## Decision` (the spec's §1–§10 as numbered subsections), `## Consequences`, `## Revisit triggers`. The spec was written to convert nearly verbatim — carry its reasoning across rather than summarising it, and fix the relative links (`../../decisions/x.md` becomes `x.md`).

- [ ] **Step 2: Add NFR-9**

Append to `docs/03-non-functional-requirements.md`:

```markdown
## NFR-9 Visual system & accessibility

- **One colour vocabulary.** `web/src/styles.css` holds a `:root` token block
  that is the single source of colour, radius, elevation and motion. Converted
  sections carry no raw hex; `web/test/styles.test.ts` enforces it with an
  allowlist that shrinks as surfaces convert
  ([adr-018](decisions/adr-018-material-system.md) §2).
- **Deliberate exception:** `.palette-*`, `.type-*`, `.layout-*` and
  `.ornament-*` keep literal values — they are mirrored by hand in
  `server/src/og/render.ts`, where a raw hex is what keeps the mirror visible.
- **Contrast.** Body ink meets WCAG AA (4.5:1) on every surface it sits on,
  including each translucent surface **composited with its blur ignored**.
  `--ink-faint` clears the 3:1 large-text floor only and is never body text.
  Asserted in `web/test/styles.test.ts`.
- **Every glass surface must be legible with its blur removed.** The tint
  carries the contrast; blur is decoration. This is what makes the
  `prefers-reduced-transparency: reduce` fallback a token swap rather than a
  second design.
- **Reduced transparency and reduced motion are honoured**, not detected: the
  two media queries above, never a device or user-agent check.
```

- [ ] **Step 3: Re-measure the bundle and amend NFR-1**

Run: `pnpm --filter inv-app-web build`

Read the gzipped CSS + JS totals from the output. Amend NFR-1's bundle bullet with the new figure and the date, following the instruction already written there — *"Re-measure when amending this line rather than adding to the one already written here."* Replace the figure; do not append a second one.

- [ ] **Step 4: Add the new mirror to NFR-8**

In `docs/03-non-functional-requirements.md`, under NFR-8, add:

```markdown
- The palette→ground map in `styles.css` (`.cc-shell[data-palette="…"]`)
  mirrors the six `.palette-*` rules **by hand**; `web/test/styles.test.ts`
  holds the pairing by enum coverage
  ([adr-018](decisions/adr-018-material-system.md) §1).
```

- [ ] **Step 5: Update CLAUDE.md**

In the Architecture section, after the "Rendering: **no full-image generation**" paragraph, add:

```markdown
Material system (adr-018): `styles.css` opens with a `:root` token block —
ground, glass, ink, accent, radius, elevation, motion — that is the single
source of colour for converted surfaces. **The editor is the only converted
surface so far**; the other five still carry literals, and
`web/test/styles.test.ts`'s `CONVERTED` allowlist is the ratchet — each
conversion adds a name to it. `.palette-*`/`.type-*`/`.layout-*`/`.ornament-*`
are permanently exempt: those values are mirrored by hand in the OG renderer,
where a raw hex is what keeps the mirror visible. Glass is two classes composed
from tokens (`.glass`, `.glass-solid` — the second carries text), and the rule
that makes the reduced-transparency fallback a token swap rather than a second
design is that **every glass surface must be legible with its blur removed**.
The editor's ground is tinted by the invitation being edited via
`data-palette` on `.cc-shell` — an attribute, not the `palette-*` class, which
would push the card's own ink and accent into the chrome.
```

- [ ] **Step 6: Move the roadmap forward**

In `docs/06-roadmap.md`, add a `## Shipped: the material system and the editor canvas` section following the file's existing pattern, and add a candidate-backlog entry for the surfaces still on literals:

```markdown
- **Five surfaces still carry raw hex** — landing, gallery, guest, manage,
  crash. The material system ([adr-018](decisions/adr-018-material-system.md))
  shipped with the editor as its only converted surface, and
  `web/test/styles.test.ts`'s allowlist names the rest. The share panel, BYOK
  panel and auth gate come first: they open from the editor header, so the seam
  is visible at the moment the host presses Publish.
```

- [ ] **Step 7: Commit**

```bash
git add docs/ CLAUDE.md
git commit -m "$(cat <<'EOF'
Settle the material system as adr-018, and write down NFR-9

NFR-9 is new because no accessibility requirement existed at all — the
AA commitments lived only in a CSS comment about the RSVP pair, and
glass is exactly what turns that into a liability.

The bundle line in NFR-1 is re-measured rather than appended to, per the
instruction that line already carries: it went stale once between
adr-014 and adr-016, and cost adr-017 a threshold derived from a number
3.2 kB wrong.

The roadmap gets the honest version: one surface converted, five to go,
and the allowlist names them.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: The performance gate and the design-sync

**Files:** none changed unless the gate fails.

This task ships nothing. It is the check the spec requires before the work counts as done, and it is deliberately last so it measures the real thing.

- [ ] **Step 1: Build and serve the production bundle**

```bash
pnpm --filter inv-app-web build
pnpm --filter inv-app-web exec vite preview --host
```

The `--host` matters: it binds on the LAN so a phone can reach it.

- [ ] **Step 2: Throttled desktop check**

Open `/create` in Chrome, generate an invitation. In DevTools → Performance, set CPU throttling to **6×**, record while scrolling the card and switching palettes three times.

Expected: no dropped frames on the scroll, and no layout thrash when `data-palette` changes. If frames drop, the failure is almost certainly the ground's two radial gradients repainting under the blur — try `background-attachment: fixed` on `.cc-shell` before touching the glass.

- [ ] **Step 3: The check nobody makes**

Open the same LAN URL on a real mid-range Android phone, **inside Viber or Telegram's in-app browser** rather than Chrome. That is the environment the hosts are actually in, and it is a different renderer from the one on the desk.

Scroll the card, open a design sheet, switch palettes.

- [ ] **Step 4: Decide, and write it down**

- **Holds frames:** append a short "Verified on <device>, <browser>, <date>" note to adr-018's Consequences and commit it.
- **Does not hold:** thin the glass first — take `--glass-blur` from `blur(20px)` to `blur(12px)` and re-measure. If it still stutters, make the opaque branch the default and the translucency the progressive enhancement, by moving the reduced-transparency values into `:root` and putting the translucent ones behind `@media (prefers-reduced-transparency: no-preference)`. Record which happened and why in adr-018. **It does not ship stuttering.**

- [ ] **Step 5: Re-sync the design system**

`styles.css` changed, and the DS project builds against its closure.

```bash
rm -rf ds-bundle
node .ds-sync/resync.mjs --config .design-sync/config.json --node-modules web/node_modules --entry web/src/components/InvitationPreview.tsx --out ./ds-bundle
grep -c "@kind" ds-bundle/_ds_bundle.css
```

Expected: the count is **≥ 7**. If it is lower, the annotations were stripped — find them in `styles.css` before syncing, per `.design-sync/NOTES.md`.

On Windows, an `EPERM` on `ds-bundle` means a Chromium handle from a previous validate is still open; `rm -rf ds-bundle` and re-run. It is not a converter bug.

- [ ] **Step 6: Mark the superseded templates**

The DS project holds template sets encoding the old direction, and `CLAUDE.md` and `styles.css` comments cite them **by name**, so a stale one misdirects the next iteration rather than sitting harmlessly. The editor's own set is `creation-chat`.

Mark `creation-chat` superseded in the DS project in the same pass — do not sweep anything else. `.design-sync/NOTES.md` is explicit that the project holds far more than this sync produces, and that the no-anchor branch of the sync instructions, applied literally, deletes every mockup the design work depends on. If the anchor is missing, pass `deletes: []` and re-anchor.

- [ ] **Step 7: Commit whatever the gate produced**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Verify the glass on the hardware the hosts actually use

The gate the spec asked for: 6x-throttled desktop scroll, then a real
mid-range Android inside a messenger's in-app webview — a different
renderer from the one on the desk, and the one nobody tests.

Re-synced the DS closure, since styles.css is what it ships, and
verified the @kind annotation count survived the build.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| §1 tokens in `:root`, glass as two classes | 1, 2 |
| §1 palette-tinted ground, `data-palette` mechanism, new mirror | 3 |
| §1 `palette-*` stays literal | 4 (exempt from the ratchet), 9 (NFR-9 records it) |
| §2 ratchet test with shrinking allowlist | 4 |
| §3 near-bleed, no `InvitationPreview` change | 5 |
| §4 segmented toolbar | 6 |
| §5 desktop two panes as glass | 5 |
| §6 banner from `dateBlocked`, log unchanged, peek line | 7, 8 |
| §7 legibility-without-blur, reduced transparency/motion, perf gate | 2, 10 |
| §8 scope boundary | honoured throughout; no task touches the share/BYOK/auth panels or the other five surfaces |
| §9 Claude Design, superseded templates | 10 |
| §10 testing | 1–8 |
| Consequences: NFR-1 re-measure, NFR-9 new, NFR-8 mirror, DS re-sync | 9, 10 |

**Placeholder scan:** clean. Every code step carries the code; the two steps that cannot (Task 9 Step 1's ADR conversion, Task 10's manual gate) state exactly what to produce and what the pass condition is.

**Type consistency:** `DesignToolbar`'s props match `DesignControls`' shape exactly, so `PreviewPanel` swaps one import (Task 6). `PastDateBanner` takes `blocked`/`message`, matching its call in `App.tsx` (Task 7). `ChatPanel`'s props are unchanged, so `App.tsx` is untouched by Task 8. Test helpers `readStyles` / `sections` / `rootTokens` / `contrast` / `blend` are defined once in Task 1 and used under those names in Tasks 2–5.

**One known gap, stated rather than hidden:** the `data-palette` attribute on `.cc-shell` (Task 3) has no DOM-level test, because this suite has no App-render test and building one would mean mocking `api`, the router and four hooks. The enum-coverage test covers the half that can break silently — a palette with no ground entry. The attribute itself is one expression, verified by eye in Task 5 Step 5.
