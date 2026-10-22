# Paper Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin every converted surface from glass to paper by changing token values and fonts (adr-019 rollout step 1), then set the editor's card on a grained table instead of the palette-tinted ground (step 2).

**Architecture:** Two PRs, in order. PR 1 edits `:root` values, the font `@import`, the two glass classes and the chrome's heading weights, with no DOM change. PR 2 adds `--table` and a `.grain` material, repoints `.cc-shell`, and deletes the palette→ground map and its hand-mirror. Tests are all stylesheet-as-text assertions in `web/test/styles.test.ts`, using the helpers in `web/test/cssTokens.ts`.

**Tech Stack:** CSS custom properties, Google Fonts CSS2 API, Vitest (node environment for the stylesheet tests), Biome.

**Spec:** [adr-019](../../decisions/adr-019-paper-direction.md), whose long form is the [paper-direction spec](../specs/2026-10-21-paper-direction-design.md). adr-019 wins where they differ, and this plan amends adr-019 where measuring the code disproved it (listed below).

## Global Constraints

- Token **names** don't change. The only new tokens are `--ui-font-body` (PR 1) and `--table` (PR 2).
- The `Invitation card` section of `styles.css` stays **byte-identical**, along with every `.palette-*`, `.type-*`, `.layout-*` and `.ornament-*` rule. They are hand-mirrored in `server/src/og/render.ts`, and the CSS-only design sync depends on it.
- **No material class on `.inv` or inside it** (adr-019 §3). A material may wrap the card, never sit on it.
- No raw hex in a `CONVERTED` section. An accent written as `rgba()` uses `--ui-accent-rgb`.
- PR 1 changes **no DOM**. PR 2's only DOM change is one class name on `.cc-shell`. Every step changes pixels or behaviour, never both (adr-019 §12).
- **PR 2 branches from `main` after PR 1 merges.** Never stack it (`CLAUDE.md`, Workflow).
- Behaviour and docs move in the same PR: NFR-1, NFR-8, NFR-9, `web/CLAUDE.md`, and adr-019's own amendment notes.
- Run stylesheet tests with `pnpm --filter inv-app-web exec vitest run test/styles.test.ts`. Run everything with `pnpm build && pnpm test`: build first, or the SPA-shell tests skip themselves.

### Where this plan amends adr-019 (decided 2026-10-22, with the measurements behind them)

| adr-019 says | This plan does | Why |
|---|---|---|
| §1: sub-faint inks keep "their rule" | `--ink-whisper` `#8d8577` as the ADR says, and `--ink-placeholder` re-derived to `#857d6f`. The **under-3:1 ceiling test becomes an ordering test** (whisper < placeholder < faint) | Owner's decision. At 3.44 on `--surface` the ADR's whisper breaks the existing ceiling, so the tier is now defined by order, not by a ceiling |
| §1 doesn't mention `--accent-ink` | `#876955` → `#846652` (4.58 on paper) | At the old value `.hm-new-line` falls to 4.38 on the new ground and fails its 4.5 floor. Same hue, the token's minimum move |
| §1: a test holds `--caution-*` at a dE distance from `--wash`/`--surface` | No such test exists. `--caution-*` stays **unchanged** in this plan | Its re-tune and the test that pins it belong to the share-panel step (5), where its board is |
| §1: elevation "flatter, warmer `rgba(28,26,23,…)`" | `--e-1` `0 1px 2px rgba(28, 26, 23, 0.06)`, `--e-2` `0 4px 12px rgba(28, 26, 23, 0.1)`, `--e-3` `0 12px 32px rgba(28, 26, 23, 0.16)` | The ADR left the numbers open. These are picked here, so adjust them in Task 4's visual check if they read wrong |
| §2: Golos Text 400/500/600 | Request `wght@400..800` | Chrome sets 600/700/800 in about 80 rules. The variable file is **58.7 kB whichever range is requested**, so the wider request costs nothing and prevents faux bold |
| §2: Literata 400/500 | Every rule reading `--ui-font-display` sets `font-weight` 400 or 500 (held by a test). Chrome headings at 700 drop to 500 | Anything else gets a synthesized bold |
| Revisit trigger: "drop Literata's italic axis first" | Drop the **opsz** axis first | Measured: opsz costs 112 kB (Literata 131 → 59 kB). Italic costs 72 kB, and only on pages that set italic |

## Review Focus

1. **Faux bold by inheritance.** A `<strong>` or default-bold `h1`/`h2` *inside* a Literata heading inherits the face without its rule setting a weight, so the weight test can't see it. Expect no synthesized bold anywhere in chrome. Task 4's visual check looks for it on every page.
2. **The nav wordmark at 0.32 em tracking on a 360 px phone.** `.lp-brand` gets wider, and the ≤800 px shrink and the ≤370 px monogram rules (`lp-nav-counted`) were tuned for the old width. Expect no nav overflow or wrap at 360 px. Task 4 checks it.
3. **Fonts swapping in after first paint inside a messenger webview** (`display=swap`). Literata's metrics differ from Georgia's, so the guest page's text can reflow when it arrives. Expect no reflow that moves the RSVP button out from under a tap. Task 4 checks it under throttled network.
4. **The terracotta-family tokens this plan leaves alone** (`--accent-wash`, `--wash-warm-edge`, `--accent-ink-faint`, `--caution-*`) sitting beside an oxblood accent: the language switcher track, landing chips, and the share panel's manage-token block. They should read as one family. Task 4 records any clash in the PR for the step that owns that surface, rather than tuning ad hoc.
5. **The gallery (unconverted, step 8)** now sits on paper with its own hex rules and Literata headings. Its seven pages are indexed, so they must still read correctly. Task 4 checks one hub page and one occasion page.

---

## PR 1 — Tokens and fonts (adr-019 step 1)

Branch: `feat/paper-tokens` from `main`.

### Task 1: Paper token values, and the two floors they break

**Files:**
- Modify: `web/src/styles.css`: the `:root` block (lines 14–165) and `.gr-submit:disabled` (line 945)
- Test: `web/test/styles.test.ts`

**Interfaces:**
- Produces: the paper values in `:root`, and `--app-bg` as an alias of `--ground`. Tasks 2–4 and PR 2 read them.

- [ ] **Step 1: Write the tests**

In `describe("material tokens")`, replace `"keeps the two sub-faint inks under 3:1, …"` with:

```ts
it("keeps the two sub-faint inks below --ink-faint, so a readable tier is never one of them", () => {
  expect(tokens.has("--ink-disabled"), "--ink-disabled was retired with its last user").toBe(false);
  const on = (name: string) => contrast(tokens.get(name) as string, tokens.get("--surface") as string);
  for (const name of ["--ink-placeholder", "--ink-whisper"]) {
    expect(tokens.get(name), name).toMatch(/^#[0-9a-f]{6}$/);
  }
  expect(on("--ink-whisper")).toBeLessThan(on("--ink-placeholder"));
  expect(on("--ink-placeholder")).toBeLessThan(on("--ink-faint"));
});

it("collapses --app-bg onto --ground: one job, one value (adr-019 §1)", () => {
  expect(css).toMatch(/--app-bg:\s*var\(--ground\);/);
});
```

In `describe("the guest page's text")`, change the row to `[".gr-submit:disabled", "--edge-soft", 3]` and add:

```ts
it("fills the disabled submit with --edge-soft, not the ruled line", () => {
  const rule = ruleBlocks(stripComments(sections(css).get("Guest page") ?? "")).find((r) =>
    r.selectors.includes(".gr-submit:disabled"),
  );
  expect(rule?.body).toMatch(/background:\s*var\(--edge-soft\)/);
});
```

- [ ] **Step 2: Run them and see the right ones fail**

Run: `pnpm --filter inv-app-web exec vitest run test/styles.test.ts`
Expected: FAIL on `collapses --app-bg onto --ground` and `fills the disabled submit with --edge-soft`. The ordering test passes both before and after: it replaces a ceiling that the paper values break.

- [ ] **Step 3: Set the values**

In `:root`, set exactly these, lowercase like the rest of the block:

| Token | Value |
|---|---|
| `--ground` | `#f4efe6` |
| `--surface` | `#fbf8f2` |
| `--app-bg` | `var(--ground)` (declared after `--ground`, which `rootTokens()`'s alias resolution needs) |
| `--ui-ink` | `#1c1a17` |
| `--ink-muted` | `#5e574c` |
| `--ink-faint` | `#7e7668` |
| `--ink-placeholder` | `#857d6f` |
| `--ink-whisper` | `#8d8577` |
| `--ui-accent` | `#8c2f2b` |
| `--accent-hi` | `#73241f` |
| `--ui-accent-rgb` | `140, 47, 43` |
| `--accent-ink` | `#846652` |
| `--edge` | `#d6ccba` |
| `--edge-soft` | `#e6ddcd` |
| `--r-sm` / `--r-md` / `--r-lg` / `--r-xl` | `3px` / `4px` / `4px` / `6px` |
| `--e-1` / `--e-2` / `--e-3` | the three values in the amendments table above |

Everything else in `:root` keeps its value, including `--ink-strong`, `--accent-wash`, `--accent-ink-faint`, `--edge-strong`, `--wash`, `--wash-warm-edge`, every `--caution-*`, `--danger`, `--success` and every `--rsvp-*`.

Set `.gr-submit:disabled`'s `background` to `var(--edge-soft)`.

Rewrite the comments the new values falsify, citing adr-019:
- the `:root` header
- `--app-bg`'s comment: it collapses onto the ground, and the gallery now takes paper too
- the sub-faint comment: whisper 3.44 and placeholder 3.84 on `--surface`, defined by order below `--ink-faint` rather than a ceiling, with the reading rule unchanged
- the accent comment: white on `--accent` is 8.21:1
- `--accent-ink`'s comment: 4.58 on paper, moved from `#876955`

- [ ] **Step 4: Run the stylesheet tests**

Run: `pnpm --filter inv-app-web exec vitest run test/styles.test.ts`
Expected: PASS, including every `textFloors` row (`.hm-new-line` passes at 4.58).

- [ ] **Step 5: Run the web suite**

Run: `pnpm --filter inv-app-web exec vitest run`
Expected: all files pass. 446 tests passed on `main` before this plan; the count is that plus the tests added here.

- [ ] **Step 6: Commit**

```bash
git add web/src/styles.css web/test/styles.test.ts
git commit -m "Put the converted surfaces on paper values (adr-019 §1)"
```

### Task 2: Glass becomes paper, and materials stay off the card

**Files:**
- Modify: `web/src/styles.css`: the glass tokens in `:root` (lines 111–119), the glass comment (167–173), and the `prefers-reduced-transparency` block (189–193)
- Test: `web/test/styles.test.ts`

**Interfaces:**
- Consumes: `--surface`, `--edge` and `--e-2` from Task 1.
- Produces: the `paper materials` describe, holding `MATERIALS = ["grain", "deckle", "seal"]`. PR 2 adds a positive guard to it.

- [ ] **Step 1: Write the tests**

In `describe("glass")`:
- in `"keeps ink legible on both surfaces with the blur ignored"`, composite `tokens.get("--surface")` instead of `"#ffffff"`
- add:

```ts
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
```

Add a new describe after `"glass"`:

```ts
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
    expect(onOrInside.filter(({ parts }) => parts.some((p) => names(p).length)).map(({ s }) => s)).toEqual([]);
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
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm --filter inv-app-web exec vitest run test/styles.test.ts`
Expected: FAIL on `is opaque paper since adr-019` and `leaves reduced transparency no tokens to swap`. Both material tests pass now: nothing defines a material yet, and the card-selector guard keeps them from passing on empty input.

- [ ] **Step 3: Set the glass tokens and empty the fallback's token swap**

- `--glass-alpha: 1`
- `--glass-alpha-solid: 1`
- `--glass-tint: var(--surface)`
- `--glass-tint-solid: var(--surface)`
- `--glass-blur: none`
- `--glass-edge: inset 0 0 0 1px var(--edge)`
- `--glass-shadow: var(--e-2)`

Delete the `:root { --glass-tint: …; --glass-tint-solid: … }` line inside `@media (prefers-reduced-transparency: reduce)`, and keep its `.glass, .glass-solid { backdrop-filter: none }` rule, which the blur-clearing test reads. Rewrite the glass comment: the classes keep their names until the step 9 rename, and that step removes this block too.

- [ ] **Step 4: Run the stylesheet tests**

Run: `pnpm --filter inv-app-web exec vitest run test/styles.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/styles.css web/test/styles.test.ts
git commit -m "Make the glass classes opaque paper, and keep materials off the card"
```

### Task 3: Literata and Golos Text for the chrome

**Files:**
- Modify: `web/src/styles.css`:
  - the `@import` (line 2) and `--ui-font-display` (line 92), plus a new `--ui-font-body` beside it
  - `body` (line 218) and `.landing`'s `font-family` (line 1263)
  - the three wordmarks: `.lp-brand` (1303), `.gr-brand` (1058) and `.hm-brand` (1629)
  - every rule that reads `var(--ui-font-display)`
- Modify: `.design-sync/NOTES.md` line 15 (the `@kind` sentence)
- Test: `web/test/styles.test.ts`

**Interfaces:**
- Produces: `--ui-font-body`. Later steps' new chrome reads it rather than naming a face.

- [ ] **Step 1: Write the tests**

Replace `describe("the display face")`'s first and third tests (the `"Playfair Display"` token test and `"is named only by the token…"`), keep `"is reachable from every page"`, and add:

```ts
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
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm --filter inv-app-web exec vitest run test/styles.test.ts`
Expected: FAIL on all six new tests. The weight test lists about 17 rules, among them `.sp-title`, `.gr-thanks-title`, `.gr-notfound-title`, `.landing h1, …`, `.lp-brand`, `.hm-title`, `.hm-bignum`, `.hm-empty-title, .hm-state-title`, `.lp-yours-head h2`, `.cr-title`, `.da-keep-head`, `.gl h1`, `.gl-others h2`, `.gl-tile-name` and `.cc-start-title`.

- [ ] **Step 3: Change the faces, then the weights the test names**

The `@import`, exactly:

```css
@import url("https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400..500;1,7..72,400&family=Golos+Text:wght@400..800&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Manrope:wght@400..800&family=Marck+Script&display=swap");
```

Keep the line above it ("All families cover Cyrillic"), which is still true.

- `--ui-font-display: "Literata", Georgia, serif; /* @kind font */`
- new on the next line: `--ui-font-body: "Golos Text", system-ui, -apple-system, "Segoe UI", sans-serif; /* @kind font */`
- `body` and `.landing` read `font-family: var(--ui-font-body)`.

Set every rule the weight test lists to `font-weight: 500`, adding the declaration where there is none. `.ag-title` already sets `400` and keeps it. Give `.lp-brand`, `.gr-brand` and `.hm-brand` `font-family: var(--ui-font-display); font-weight: 500; letter-spacing: 0.32em`; their sizes and colours stay. Update the display-face comment in `:root` to name Literata and the new body token.

In `.design-sync/NOTES.md` line 15, `@kind font` now annotates two `:root` lines (`--ui-font-display`, `--ui-font-body`). The `grep -c '/\* @kind'` floor stays "≥ 7", and the count is now 8.

- [ ] **Step 4: Run the stylesheet tests, then the web suite**

Run: `pnpm --filter inv-app-web exec vitest run test/styles.test.ts`, then `pnpm --filter inv-app-web exec vitest run`
Expected: PASS, both.

- [ ] **Step 5: Commit**

```bash
git add web/src/styles.css web/test/styles.test.ts .design-sync/NOTES.md
git commit -m "Set the chrome in Literata and Golos Text (adr-019 §2)"
```

### Task 4: Measure, look, record, open the PR

**Files:**
- Create: `scripts/measure-fonts.mjs`
- Modify:
  - `docs/03-non-functional-requirements.md`: the NFR-1 bundle line, plus NFR-9's contrast and glass bullets
  - `docs/decisions/adr-019-paper-direction.md`: amendment notes
  - `web/CLAUDE.md`: Material system
  - `CLAUDE.md`: the "Where things live" row

**Interfaces:**
- Produces: `node scripts/measure-fonts.mjs`. It reads the `@import` URL from `web/src/styles.css`, fetches its CSS with a mobile Chrome user-agent, and for each face (family + style) prints the summed `woff2` bytes of the `latin` and `cyrillic` subsets, then a total. NFR-1 cites it as the method, so the next re-measure repeats it.

- [ ] **Step 1: Write `scripts/measure-fonts.mjs`, then run it**

Run: `node scripts/measure-fonts.mjs`
Expected: Literata normal ≈ 131 kB, Literata italic ≈ 72 kB, Golos Text ≈ 59 kB, plus the four card families. Chrome on a page with no italic ≈ 190 kB.

- [ ] **Step 2: Build, then confirm the card section is untouched**

Run: `pnpm build && pnpm test`
Expected: all green. Note the web build's gzipped CSS and JS sizes.

Run: `git diff main -- web/src/styles.css`
Expected: no hunk between the `/* Invitation card ---- */` banner and the next banner.

- [ ] **Step 3: Look at it**

Run `pnpm dev` and open these at 1280 px and at 360 px:
- `/`
- `/?lang=en`
- `/create?sample=<any gallery id>`, then publish it
- the resulting `/i/:id` and `/manage/:id`
- `/gallery` and one occasion page

Check each Review Focus item:
1. no synthesized bold anywhere
2. the nav wordmark fits at 360 px, with and without the held-token count
3. the guest page under DevTools "Slow 4G" doesn't move the RSVP button when the fonts swap in
4. note any terracotta-wash clash beside the oxblood accent, by surface
5. the gallery reads correctly

Tune `--e-1…--e-3` here if they read wrong, and record the final values.

- [ ] **Step 4: Record**

- **NFR-1:** re-measure the bundle line as the line itself instructs (today's figures, with the previous ones kept as the record). Add a sentence: chrome fonts come from Google Fonts and sit outside that line, ≈ 190 kB on a page with no italic, measured with `node scripts/measure-fonts.mjs`.
- **NFR-9:**
  - The contrast bullet: "both glass surfaces composited with their blur ignored" becomes "both chrome surfaces, opaque `--surface` since adr-019". The per-palette ground clause stays until PR 2.
  - The glass bullet becomes the paper rule: every chrome surface is opaque, and no material sits on the card.
  - The sub-faint sentence holds them below `--ink-faint` by order.
- **adr-019:** append dated "Amended 2026-10-xx (step 1)" notes to §1 and §2, and correct the revisit trigger. Use the amendments table above. Don't rewrite the original text, as adr-015 §7 and adr-018 §9 don't.
- **`web/CLAUDE.md`, Material system:**
  - "(a test keeps them under 3:1)" becomes "(a test keeps them below `--ink-faint`, whisper < placeholder < faint)"
  - the glass bullet says the classes are opaque paper until the step 9 rename
  - add one line: chrome faces are tokens (`--ui-font-display`, `--ui-font-body`), and display-face rules set weight 400 or 500
- **`CLAUDE.md`:** the Material system row cites `adr-018, 019`.

- [ ] **Step 5: Commit, push, open the PR**

```bash
git add scripts/measure-fonts.mjs docs/ web/CLAUDE.md CLAUDE.md web/src/styles.css
git commit -m "Record the paper re-skin: NFR-1 fonts, NFR-9, and what step 1 amended in adr-019"
git push -u origin feat/paper-tokens
gh pr create --base main --title "Put the app on paper: tokens and fonts (adr-019 step 1)"
```

Follow `.github/pull_request_template.md`. Put the Review Focus findings from Step 3 in the description, attach screenshots of `/` and `/i/:id`, and list the amendments table.

### Task 5: Sync the design system (after PR 1 merges)

**Files:** none in the repo. This writes to the E-invitation DS and refreshes the design project's binding.

- [ ] **Step 1: Check the CSS-only shortcut still applies**

Run: `git log --since=2026-10-17 --oneline -- web/src/components/InvitationPreview.tsx .design-sync/config.json .design-sync/conventions.md .design-sync/previews`
Expected: empty (it was empty on 2026-10-22). If not, this needs a full resync, not this task.

- [ ] **Step 2: Upload and refresh**

Follow `.design-sync/NOTES.md` "A CSS-only sync without the converter":
- upload `web/src/styles.css` from `main` as the DS's `_ds_bundle.css`
- check `@kind` ≥ 7 (now 8)
- refresh the design project's binding under `_ds/<folder>/`, as "The binding is a snapshot" describes

Verify by grepping the bound `_ds_bundle.css` for `"Literata"`.

- [ ] **Step 3: Note what stays stale**

The token panel lists the old tokens until a full CLI resync recompiles `_ds_manifest.json` (NOTES.md). Add a dated line to NOTES.md saying so, in its own small PR.

---

## PR 2 — The editor's table (adr-019 step 2)

Branch: `feat/paper-table` from `main`, **after PR 1 has merged**.

### Task 6: Set the card on a grained table, and retire the palette→ground map

**Files:**
- Modify: `web/src/styles.css`:
  - `:root`: add `--table`
  - Material system: add `.grain`
  - delete the palette→ground map and its comment (lines 199–210)
  - `.cc-shell` (line 305)
- Modify: `web/src/App.tsx:112`, the shell's `className`
- Modify: `docs/03-non-functional-requirements.md` (NFR-8 entry at line 255, NFR-9 contrast clause at line 271), `web/CLAUDE.md` (Material system)
- Test: `web/test/styles.test.ts`

**Interfaces:**
- Consumes: Task 2's `paper materials` describe and `MATERIALS`.
- Produces: `--table` and `.grain`. The guest page, landing and gallery steps put them on their own grounds.

- [ ] **Step 1: Write the tests**

In `describe("token contrast (WCAG 2.1)")`:

```ts
it("holds body ink at AA and --ink-faint at 3:1 on the table the card is set on", () => {
  const table = tokens.get("--table") as string;
  expect(table).toBe("#eae3d6");
  expect(contrast(tokens.get("--ink") as string, table)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(tokens.get("--ink-muted") as string, table)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(tokens.get("--ink-faint") as string, table)).toBeGreaterThanOrEqual(3);
});
```

Delete `describe("palette-tinted ground")`. In `describe("the editor canvas")`, replace `"paints the shell with the tinted ground, not a flat colour"` with:

```ts
it("sets the card on the grained table, whatever the palette (adr-019 §4.2)", () => {
  const shell = /\.cc-shell\s*\{([^}]*)\}/.exec(css);
  expect((shell as RegExpExecArray)[1]).toMatch(/background-color:\s*var\(--table\)/);
  expect(css).not.toMatch(/--ground-tint-|\[data-palette=/);
  const app = readFileSync(fileURLToPath(new URL("../src/App.tsx", import.meta.url)), "utf8");
  expect(app).toMatch(/className="cc-shell grain"/);
  expect(app).toMatch(/data-palette=\{/); // kept as an unused hook (adr-019 §4.2)
});
```

In `describe("paper materials (adr-019 §3)")`, add the positive guard:

```ts
it("defines grain as two dot layers at 3px and 7px, under 5% alpha", () => {
  const grain = ruleBlocks(stripComments(sections(css).get("Material system") ?? "")).find((r) =>
    r.selectors.includes(".grain"),
  );
  expect(grain?.body).toMatch(/background-size:\s*3px 3px,\s*7px 7px/);
  const alphas = [...(grain?.body ?? "").matchAll(/rgba\([^)]*,\s*([\d.]+)\)/g)].map((m) => Number(m[1]));
  expect(alphas).toHaveLength(2);
  for (const a of alphas) expect(a).toBeLessThanOrEqual(0.05);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm --filter inv-app-web exec vitest run test/styles.test.ts`
Expected: FAIL on the table contrast test, the canvas test and the grain test.

- [ ] **Step 3: Implement**

- `:root`: `--table: #eae3d6;` after `--surface`, with a one-line comment: the darker field a card is set on.
- Material system, after the glass classes: `.grain` sets only `background-image` (two `radial-gradient(rgba(28, 26, 23, A) 0.5px, transparent 0.5px)` layers, alphas `0.05` and `0.035`) and `background-size: 3px 3px, 7px 7px`. It sets no `background-color` and no `background` shorthand, so the element's own colour shows through.
- `.cc-shell`: `background-color: var(--table)`. Drop the two `--ground-tint` gradients and the `background-color` transition.
- Delete the palette→ground map and its comment.
- `App.tsx:112`: `className="cc-shell grain"`. Keep `data-palette={…}`.

- [ ] **Step 4: Run the suite and look**

Run: `pnpm build && pnpm test`
Expected: all green.

Open `/create?sample=<id>`, cycle all six palettes, and check that festive's navy card reads on the kraft table, as adr-019 §4.2 claims. Check the grain is visible but under the noise floor.

- [ ] **Step 5: Record**

- **NFR-8:** delete the palette→ground bullet.
- **NFR-9:** the contrast clause "against `--ground` — the root value and every per-palette override —" becomes "against `--ground` and `--table`".
- **`web/CLAUDE.md`:** replace the `data-palette` bullet with: the editor sets the card on `--table` with `.grain`; `data-palette` stays on `.cc-shell` as an unused hook; materials never touch `.inv`.

- [ ] **Step 6: Commit, push, open the PR**

```bash
git add web/src/styles.css web/src/App.tsx web/test/styles.test.ts docs/03-non-functional-requirements.md web/CLAUDE.md
git commit -m "Set the editor's card on a grained table, and retire the palette ground map (adr-019 §4.2)"
git push -u origin feat/paper-table
gh pr create --base main --title "Set the editor's card on the table (adr-019 step 2)"
```

- [ ] **Step 7: After it merges, repeat Task 5** (a CSS-only sync and a binding refresh).

---

## After this plan

Steps 3–9 each get their own plan when they're next. The guest page (step 3) is next. It's gated on the real-device envelope check (adr-019 §5.1) and starts by defining `.deckle` and `.seal` beside `.grain`.
