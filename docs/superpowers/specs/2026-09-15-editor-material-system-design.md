# Spec — the material system and the editor canvas

**Date:** 2026-09-15 · **Status:** approved in brainstorm, not yet settled as an
ADR · **Lands as:** NFR-9 (new), amending NFR-1's bundle line and NFR-8's
hand-mirror list. No new FR — this changes how FR-1/FR-2 surfaces look, not what
they do.

Intended to be settled as **adr-018** before implementation, following this
repo's pattern (`Settle X as adr-N` → implementation plan → PRs). Written to
convert to that structure nearly verbatim.

## Context

**Two complaints, and they are the same complaint.** The product "looks dated
and amateur" and "is inconsistent across screens". Reading the stylesheet turns
the second into a measurement:

| | |
|---|---|
| `web/src/styles.css` | 1719 lines, 77.8 kB raw, **19.4 kB gzipped** |
| Raw hex literals | **443** |
| Distinct colours | **106** |
| `:root` token blocks | **1**, holding only the two RSVP status pairs |

Three values serve as "the accent" in different sections (`#b3592e`, `#a04e27`,
`#9f4d26`) and two serve as "the ink" (`#23211d` in app chrome, `#4a3728` on the
landing page). The landing page is the only surface with a token block at all
(`--lp-bg`/`--lp-ink`/`--lp-accent`/…), which is both the evidence for the
inconsistency and the proof that the pattern works here.

So "amateur" is not mainly an art-direction problem. It is the absence of a
system, and a redesign that does not install one will regress to 106 colours
within a year.

**The direction was chosen visually, not described.** Four bearings were
rendered against the real product — the current warm-classic direction executed
properly, an editorial/paper direction, a soft-modern direction, and an
iOS-derived one in two strengths. **D1 — full Liquid Glass — was chosen**:
translucent chrome over a colour field, with the invitation card as the solid
object beneath it.

Two things make D1 a better fit here than it would be in a generic app:

1. **The app is already shaped like an iOS app.** `FieldSheet`, `SignOutSheet`,
   `DeleteAccountSheet`, and the auth gate as *the first frame of the share
   sheet* ([adr-014](../../decisions/adr-014-host-accounts.md) §2) — four
   iterations of bottom sheets built without calling them that. This names a
   grammar the codebase was already converging on.
2. **It leaves the invitation card alone.** The card's token→style map has a
   hand-mirrored twin in the OG renderer
   ([adr-003](../../decisions/adr-003-no-image-generation.md); `server/src/og/render.ts`),
   and `og.test.ts` enforces enum coverage but not colour equality. D1 puts
   glass in the *chrome*; the card and its six palettes ship unchanged.

**Tailwind was considered and rejected**, on three checkable grounds rather than
taste:

- `.design-sync/config.json` declares `cssEntry: src/styles.css` and ships that
  file's closure to the Claude Design project so the design agent builds against
  real CSS. Tailwind's meaningful CSS only exists after its compiler scans JSX,
  and the `@kind color`/`@kind font` annotations that `NOTES.md` post-build
  checks for (`grep -c "@kind" ≥ 7`) would not survive. Adopting Tailwind means
  giving up Claude Design as a design surface for this app.
- `web/src/prerender.ts` writes class names as **string literals** (`lp-cta`,
  `inv palette-${…} type-${…}`) that must match the React components'. With
  semantic classes a mismatch is one grep away; with utility strings the drift
  is silent, and that markup is what crawlers read
  ([adr-016](../../decisions/adr-016-public-discoverability.md) §10).
- The CSS is load-bearing documentation — nearly every section carries the
  reasoning for its decision on the rule itself. Utility strings in JSX have
  nowhere to put that.

On size it is a wash: a purged Tailwind build for an app this size lands near
19.4 kB gzipped. What Tailwind is genuinely right about is *constraint*, and
§1–§2 below deliver that without a compiler in the DS path.

**The editor goes first, and the reason is measurable.** The suite holds ~56
class/DOM assertions, but they concentrate on the landing, manage and guest
surfaces. The editor has **three** — `.cc-share`, `.inv`, `.inv-scrim` — because
its logic is tested through `useInvitationEditor` / `usePublishing` at the hook
level. It is by a wide margin the cheapest surface in the app to restructure.

## Decision

### 1. The material system lives in a `:root` block at the top of `styles.css`

Not a separate `tokens.css`. This is forced, not preferred: the design-sync
ships `styles.css`'s own closure, and `NOTES.md` records that the font `@import`
was *deliberately moved into* this file so the closure would carry the fonts. A
local `@import "./tokens.css"` would not be inlined the same way and the design
agent would receive a stylesheet with no tokens in it.

Compact one-line declarations, matching the existing convention that keeps CSS
formatting off in Biome on purpose.

| Group | Tokens | Replaces |
|---|---|---|
| Ground | `--ground`, `--ground-tint-a/b/c` | flat `#f6f5f2` / `#f1efe9` |
| Glass | `--glass-tint`, `--glass-blur`, `--glass-edge`, `--glass-shadow` | — (new) |
| Ink | `--ink`, `--ink-muted`, `--ink-faint` | ~8 near-blacks and greys |
| Accent | `--accent`, `--accent-hi`, `--accent-wash` | `#b3592e` / `#a04e27` / `#9f4d26` |
| Radius | `--r-sm/md/lg/xl/pill` | ad-hoc 6/8/10/12/14/16/20/22/26px |
| Elevation | `--e-1/e-2/e-3` | ~9 bespoke `box-shadow`s |
| Motion | `--ease-ios`, `--dur-fast/base` | — (new) |

**Glass is two classes, not one token.** A glass surface is four or five coupled
declarations (tint, blur+saturate, specular inset edge, drop shadow); expressing
it as a single custom property is unreadable. The tokens are the primitives and
two classes compose them:

- `.glass` — toolbars, header, segmented bar. More blur, less tint.
- `.glass-solid` — composer, banner, sheets. **Text-bearing**, so more tint and
  less blur.

**The ground is tinted by the invitation's own palette** — adaptive tinting, the
most genuinely iOS idea available here. The base stays light in all six cases so
`festive` (dark navy card) floats on light rather than going dark-on-dark.

The mechanism needs stating, because the obvious one does not work: `--bg` and
`--accent` are set by `palette-*` **on the card**, which is a descendant of the
ground, and CSS does not cascade upward. Nor can the shell simply carry the
`palette-*` class — that would leak the card's `--ink` and `--accent` into the
chrome, where the product's own accent belongs.

So: the editor shell carries `data-palette="<token>"`, and the token section
holds a six-entry map from palette to ground tint:

```
.cc-shell[data-palette="warm"]     { --ground-tint-a: …; --ground-tint-b: …; }
.cc-shell[data-palette="festive"]  { … }   /* six in total */
```

This is a **new hand-mirror** — six palettes on one side, six ground entries on
the other — and it goes on NFR-8's list with the others. §10 covers it by test,
the same enum-coverage idiom `og.test.ts` already uses: every `palette-*` in the
stylesheet must have a matching ground entry, so adding a seventh palette cannot
silently ship an untinted editor.

**The `palette-*` lines stay literal hex, deliberately.** Those values are
mirrored by hand into the OG renderer's token maps. Tokenising them would make
that mirror invisible — the one place in this file where a raw hex is the safer
choice. The same applies to `type-*`, `layout-*` and `ornament-*`.

### 2. A ratchet test stops the drift back

`web/test/styles.test.ts` reads `styles.css` and fails on raw hex inside
converted sections, with an explicit allowlist naming the sections not yet
converted. This repo's existing idiom — `gallery.test.ts`, `i18n.test.ts`,
`seo.test.ts` and `og.test.ts` all hold rules the types cannot.

The point is the ratchet: **each future surface conversion deletes a line from
the allowlist**, so "we'll tokenise the rest later" becomes a checkable claim
instead of an intention. Without it the second surface gets converted with fresh
literals and the 106 colours come back. Amends NFR-8.

### 3. The editor canvas: near-bleed, not full-bleed

The card keeps its radius and takes a ~12px inset; the palette-tinted ground
shows at the edges; controls float over it. The mockup originally showed the
card edge-to-edge and this is a deliberate 12px walk-back, for three reasons
found in the code rather than in taste:

- **The guest receives a card.** `.gr-inv` wraps the invitation in `.gr-card` at
  both breakpoints. Composing full-bleed means the host edits a surface no guest
  ever sees — WYSIWYG breaks on the one screen whose job is showing you what you
  are making.
- **`layout-banner` breaks.** Its title bar hangs on
  `margin: calc(var(--pad-y) * -1)` with `border-radius: 14px 14px 0 0` tied to
  the card's own radius. At full-bleed the card's background shows through in
  two wedges at the top corners. One of four layouts, visibly broken.
- **`layout-split` degrades.** Its 38% image panel becomes a tall strip on a
  phone.

**This needs no change to `InvitationPreview.tsx`.** A scoped override —
`.cc-canvas .inv { … }` — achieves the whole effect. That component is DS-synced
and rendered in four places (editor, gallery cards, landing hero fan, guest
page), and its props are hand-mirrored in `dtsPropsFor` and `conventions.md`,
both of which have gone stale before (`NOTES.md`, 2026-07-28). Not touching it
is worth real money.

### 4. The design controls become a segmented toolbar

Today `.design-controls` is four labelled rows of pills and swatches stacked
above the card, eating roughly a third of a phone screen before the invitation
gets any. In D1 it is one floating glass segmented bar — Палітра / Шрифт /
Макет / Декор — where tapping a segment raises a sheet with a grabber. The sheet
dims nothing and the card stays visible behind it, so the host watches the
change land.

This is the one part of the iteration that is not only cosmetic. The swatches
keep reading their colours from the real `palette-*` custom properties exactly
as they do now, so options cannot drift from the card.

### 5. Desktop keeps two panes, but they stop being flush columns

| Today | D1 |
|---|---|
| `.cc-header` — 58px white bar, `border-bottom` | floating glass pill, inset |
| `.cc-chat` — 440px white column, `border-right` | floating glass panel with its own radius |
| `.cc-preview` — flat `#f1efe9` | the palette-tinted ground |
| `.design-controls` — stacked rows | the same glass segmented bar |

Split from mobile deliberately: a 1400px screen with a single card as wallpaper
reads as a screensaver, not an editor. The mockup's power was at phone size,
which is also where the hosts are.

### 6. The chat log: a banner that cannot scroll away

**The layout creates the problem.** Today the log is always on screen at both
breakpoints, so FR-1.8's "append the refusal every turn" is a sufficient
mechanism for its guarantee. Collapse the log into a floating composer and that
mechanism silently stops delivering it — the rule survives in the code and dies
in the UI, with nothing failing.

**The fix costs nothing, because the state already exists.**
`useInvitationEditor` derives `dateBlocked`, and `App.tsx` already consumes it
twice (line 98 for `canPublish`, line 134 for the button's `title`). The
refusal becomes a **pinned `.glass-solid` banner above the composer, rendered
purely from `dateBlocked`** — a third view of existing state, sitting beside the
disabled control it explains, where it cannot scroll away.

**The log emission stays exactly as it is.** Replacing the per-turn append with
the banner was considered and rejected. There are two emission sites —
`noteDateState` on generate/seed, and `usePublishing`'s `onDateBlocked` callback
at `App.tsx:73` — and `useInvitationEditor.test.ts:208` pins the repetition
while `:247` pins exact message ordering. Those tests encode a documented
decision. More to the point the two do different jobs: the log entry is the
assistant *answering* a failed publish in conversation; the banner is the
standing explanation of a disabled control. Keeping both means **no hook change,
no test change, no behaviour change**.

A **peek line** above the composer shows the latest assistant message while the
log is collapsed, so FR-1.7's nudge and the generating status cannot be missed
either; tapping it opens the log sheet. Desktop keeps the full visible
transcript, and the banner appears there too — a guarantee must not depend on
viewport width.

### 7. Glass on real hardware

**The rule that makes everything else safe: every glass surface must be legible
with its blur removed.** The tint alone carries the contrast; blur is decoration
on top. This makes the fallback trivially correct instead of a second design.

```
@media (prefers-reduced-transparency: reduce)  →  glass becomes opaque
@media (prefers-reduced-motion: reduce)        →  sheet springs become fades
```

`prefers-reduced-transparency` maps onto the exact setting an iOS user reaches
for, so the fallback is standardised rather than invented.

**Blur stays off anything large.** Header, segmented bar, composer, banner and
sheets are fixed and small — roughly 120px of a 600px screen. The card is the
only thing that scrolls, and nothing blurred sits under a full-height scroll
region.

**The gate before it ships:** scroll the editor under Chrome DevTools at 4–6×
CPU throttle with no dropped frames, then confirm once on a real mid-range
Android inside Viber's in-app webview — the environment the hosts are actually
in, and the one nobody tests. If it cannot hold frames there, the glass gets
thinner or the fallback becomes the default. It does not ship stuttering.

Nothing here reaches the OG image: there is no glass in the card, so satori is
untouched.

### 8. Scope boundary

**In:** the `:root` material system, the ratchet test, and the editor canvas —
header, chat panel/log/composer/peek/banner, the segmented toolbar and its
sheets, the field edit sheet, the tinted ground, the near-bleed card treatment.

**Out, deliberately:**

- **The share panel, the BYOK key panel and the auth gate.** They open *from*
  the editor header, so the seam will be visible at the moment the host presses
  Publish. Accepted, and scheduled as the next pass.
- **The other five surfaces** — landing, gallery, guest, manage, crash.
- **`InvitationPreview.tsx`, the card's palettes, and the OG renderer.**
- **Dark mode.** Not supported today; adding it here would double the token work
  before the system has been proven on one screen.

### 9. Claude Design authors the material, not the layout

Use the DS project for a **small, high-leverage set**: one material spec — the
glass system rendered over all six card palettes, which is the piece that cannot
be judged from code — plus the segmented toolbar and its sheets. Not for
re-mocking every editor state.

**The stale-template problem must be handled in this iteration, not after it.**
The project holds roughly twelve template sets encoding the old direction, and
`CLAUDE.md` and `styles.css` comments cite them **by name** as spec sources, so
a stale template here actively misdirects the next iteration rather than sitting
harmlessly. This repo already has that scar (`NOTES.md`: a `conventions.md`
pixel figure stale with nothing catching it). The rule: any template set this
iteration supersedes is renamed or marked superseded **in the same pass** that
lands the CSS citing its replacement.

`NOTES.md` also records that registering a new template set needs an entry
canvas with specific markers, and that two attempts were spent discovering it
(2026-09-12). Budget for that.

### 10. Testing

- **New:** `web/test/styles.test.ts`, holding three rules the types cannot:
  1. **The §2 ratchet** — no raw hex inside converted sections, with an
     allowlist of the sections not yet converted.
  2. **Ground coverage** — every `palette-*` rule in the stylesheet has a
     matching `[data-palette]` ground entry (§1's new mirror). Same
     enum-coverage idiom as `og.test.ts`.
  3. **Contrast** — parse `--ink`/`--ink-muted`/`--accent` against `--ground`
     and each glass tint *composited over the ground with blur ignored*, compute
     the WCAG relative-luminance ratio, and require AA (4.5:1 body, 3:1 large).
     Ignoring blur is what makes this checkable at all, and it is the same
     assumption §7's legibility rule makes — the test and the rule are the same
     statement. Codifies the AA commitment the RSVP comment already claims
     (6.2:1 / 6.1:1) but which no requirement has ever written down.
- **Unchanged and must stay green:** `useInvitationEditor.test.ts` in full —
  §6's whole point is that the message behaviour does not change.
- **Expect to touch:** the three editor class assertions (`.cc-share`, `.inv`,
  `.inv-scrim`) only if those class names move. Prefer keeping them.
- **Watch:** `web/vite.config.ts` sets `globals: false`, so RTL never
  auto-cleans. Any new component test needs `afterEach(cleanup)` or it matches
  the previous test's DOM.

## Consequences

- **The app runs two design languages until the remaining surfaces convert.**
  The editor is glass; everything else is flat. This is the accepted cost of not
  doing all six at once, and §2's allowlist is what keeps it from becoming
  permanent.
- **NFR-1's bundle line needs re-measuring** after the token block lands.
  Expected to be roughly neutral — tokens add bytes, consolidating ~443 literals
  and ~9 bespoke shadows removes them — but the measurement is the point, not
  the estimate. NFR-1 already records that this figure went stale once and cost
  adr-017 a wrong threshold; re-measure with
  `pnpm --filter inv-app-web build` rather than adding to the line.
- **NFR-9 is new**, and writes down commitments the codebase has only ever made
  in CSS comments: the token layer as the single source of colour, AA contrast,
  legibility without blur, and honouring reduced transparency and motion. No
  accessibility NFR existed before this.
- **The editor gains a genuine usability improvement**, not only a restyle: four
  stacked control rows become one bar, returning roughly a third of a phone
  screen to the invitation.
- **The design-sync must be re-run** after `styles.css` changes, and
  `@kind` annotation count re-verified (`≥ 7`).

## Revisit triggers

- **The perf gate fails** on mid-range Android → the glass thins, or
  `prefers-reduced-transparency`'s opaque branch becomes the default and the
  translucency becomes the progressive enhancement.
- **The two-language seam draws a complaint** before the panel pass lands →
  pull the share/BYOK/auth panels forward rather than continuing to the other
  surfaces.
- **The allowlist stops shrinking** across two iterations → the incremental plan
  is not working; either convert the rest in one pass or drop the pretence that
  it is coming.
- **`backgrounds` usage moves off 0** (currently 0 lifetime,
  [adr-009](../../decisions/adr-009-ai-background-layer.md)) → the AI background
  layer interacts with the tinted ground and the scrim spec, and would need
  re-checking against the glass.
