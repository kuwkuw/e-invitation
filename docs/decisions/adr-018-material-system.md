# ADR-018 — Material system and the editor canvas

**Status:** accepted · **Date:** 2026-09 · Lands as **NFR-9** (new), amending
NFR-1's bundle line and NFR-8's hand-mirror list. No new FR — this changes how
FR-1/FR-2 surfaces look, not what they do.

The first decision in this repo about **how the product looks** rather than what
it does. It leaves the invitation card untouched, so
[adr-003](adr-003-no-image-generation.md)'s enums-only rule and the OG
renderer's hand-mirrored maps are unaffected. The grammar it adopts is one the
codebase has been converging on since [adr-014](adr-014-host-accounts.md) §2
made the sign-in gate the first frame of the share sheet.

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
landing page). The landing page is the only surface with a token block at all —
which is both the evidence for the inconsistency and the proof that the pattern
works here.

So "amateur" is not mainly an art-direction problem. **It is the absence of a
system**, and a redesign that does not install one regresses to 106 colours
within a year.

**The direction was chosen visually, not described.** Four bearings were
rendered against the real product — the current warm-classic direction executed
properly, an editorial/paper direction, a soft-modern direction, and an
iOS-derived one in two strengths. **Full Liquid Glass was chosen**: translucent
chrome over a colour field, with the invitation as the solid object beneath it.

Two things make it a better fit here than it would be in a generic app:

1. **The app is already shaped like an iOS app.** `FieldSheet`, `SignOutSheet`,
   `DeleteAccountSheet`, and the auth gate as the first frame of the share sheet
   — four iterations of bottom sheets built without calling them that.
2. **It leaves the card alone.** The card's token→style map has a hand-mirrored
   twin in `server/src/og/render.ts`, and `og.test.ts` enforces enum coverage
   but not colour equality. Glass goes in the *chrome*.

**Tailwind was considered and rejected**, on three checkable grounds rather than
taste:

- `.design-sync/config.json` declares `cssEntry: src/styles.css` and ships that
  file's closure to the Claude Design project so the design agent builds against
  real CSS. Tailwind's meaningful CSS only exists after its compiler scans JSX,
  and the `@kind` annotations `NOTES.md` post-build checks for would not
  survive. Adopting it means giving up Claude Design as a design surface for
  this app.
- `web/src/prerender.ts` writes class names as **string literals** that must
  match the React components'. With semantic classes a mismatch is one grep
  away; with utility strings the drift is silent, and that markup is what
  crawlers read ([adr-016](adr-016-public-discoverability.md) §10).
- The CSS is load-bearing documentation — nearly every section carries the
  reasoning for its decision on the rule itself.

On size it is a wash: a purged build lands near the same 19.4 kB. What Tailwind
is genuinely right about is *constraint*, and §1–§2 deliver that without a
compiler in the DS path.

**The editor goes first, and the reason is measurable.** The web suite holds
~56 class/DOM assertions, concentrated on the landing, manage and guest
surfaces. The editor has **three** — `.cc-share`, `.inv`, `.inv-scrim` —
because its logic is tested through `useInvitationEditor` / `usePublishing` at
the hook level. It is by a wide margin the cheapest surface to restructure.

## Decision

### 1. The material system lives in a `:root` block at the top of `styles.css`

Not a separate `tokens.css`. Forced, not preferred: the design-sync ships this
file's own closure, and `NOTES.md` records that the font `@import` was
*deliberately moved into* it so the closure would carry the fonts. A local
`@import "./tokens.css"` would not be inlined the same way and the design agent
would receive a stylesheet with no tokens in it.

Groups: ground, glass, ink, accent, radius, elevation, motion — replacing ~8
near-blacks and greys, three accents, ad-hoc radii from 6 to 26px, and ~9
bespoke shadows.

**Glass is two classes, not one token.** A glass surface is four or five coupled
declarations; expressing it as a single custom property is unreadable. The
tokens are primitives and two classes compose them: `.glass` for toolbars and
the header, `.glass-solid` for the composer, banner and sheets — **text-bearing,
so more tint and less blur**.

**The ground is tinted by the invitation's own palette** — adaptive tinting, and
the base stays light in all six cases so `festive` (dark navy card) floats on
light rather than going dark-on-dark.

The mechanism needs stating, because the obvious one does not work: `--bg` and
`--accent` are set by `palette-*` **on the card**, a descendant of the ground,
and CSS does not cascade upward. Nor can the shell carry the `palette-*` class —
that would leak the card's `--ink` and `--accent` into the chrome, where the
product's own accent belongs. So the shell carries `data-palette` and the token
section holds a six-entry map. **That is a new hand-mirror**, and it goes on
NFR-8's list with the others, covered by the enum-coverage test in §10.

**The `palette-*` lines stay literal hex, deliberately.** Those values are
mirrored by hand into the OG renderer. Tokenising them would make that mirror
invisible — the one place in this file where a raw hex is the safer choice. Same
for `type-*`, `layout-*` and `ornament-*`.

### 2. A ratchet test stops the drift back

`web/test/styles.test.ts` reads `styles.css` and fails on raw hex inside
converted sections, with an explicit allowlist naming the sections not yet
converted — this repo's existing idiom, where `gallery.test.ts`,
`i18n.test.ts`, `seo.test.ts` and `og.test.ts` all hold rules the types cannot.

The point is the ratchet: **each future surface conversion deletes a line from
the allowlist**, so "we'll tokenise the rest later" becomes a checkable claim
instead of an intention. Without it the second surface gets converted with fresh
literals and the 106 colours come back.

### 3. The editor canvas: near-bleed, not full-bleed

The card keeps its radius and takes a ~12px inset; the tinted ground shows at
the edges; controls float over it. The chosen mockup showed the card
edge-to-edge and this is a deliberate walk-back, for three reasons found in the
code rather than in taste:

- **The guest receives a card.** `.gr-inv` wraps the invitation in `.gr-card` at
  both breakpoints. Composing full-bleed means the host edits a surface no guest
  ever sees — WYSIWYG breaks on the one screen whose job is showing you what you
  are making.
- **`layout-banner` breaks.** Its title bar hangs on
  `margin: calc(var(--pad-y) * -1)` with `border-radius: 14px 14px 0 0` tied to
  the card's own radius. At full-bleed the card's background shows through in
  two wedges at the top corners.
- **`layout-split` degrades.** Its 38% image panel becomes a tall strip on a
  phone.

**This needs no change to `InvitationPreview.tsx`.** A scoped override achieves
the whole effect. That component is DS-synced and rendered in four places
(editor, gallery cards, landing hero fan, guest page), and its props are
hand-mirrored in `dtsPropsFor` and `conventions.md`, both of which have gone
stale before (`NOTES.md`, 2026-07-28).

### 4. The design controls become a segmented toolbar

Four labelled rows of pills and swatches stacked above the card — roughly a
third of a phone screen before the invitation gets any — become one floating
glass segmented bar, where pressing a segment raises a sheet with a grabber. The
sheet dims nothing and the card stays visible behind it, so the host watches the
change land; it stays open after a choice, because picking a palette is a thing
people do three times in a row.

The one part of this decision that is not cosmetic. The swatches keep reading
their colours from the real `palette-*` custom properties, so options cannot
drift from the card.

### 5. Desktop keeps two panes, but they stop being flush columns

The 58px header bar with a `border-bottom` becomes a floating pill; the 440px
white column with a `border-right` becomes a glass panel inset on all four
sides; the flat `#f1efe9` preview pane becomes the tinted ground.

Split from mobile deliberately: a 1400px screen with a single card as wallpaper
reads as a screensaver, not an editor.

### 6. The chat log: a banner that cannot scroll away

**The layout creates the problem.** Today the log is always on screen at both
breakpoints, so FR-1.8's "append the refusal every turn" is a sufficient
mechanism for its guarantee. Collapse the log into a floating composer and that
mechanism silently stops delivering it — the rule intact in the code, gone from
the UI, with nothing failing.

**The fix costs nothing, because the state already exists.**
`useInvitationEditor` derives `dateBlocked`, and `App.tsx` already consumes it
twice — for `canPublish` and for the Publish button's `title`. The refusal
becomes a **pinned banner rendered purely from `dateBlocked`**, beside the
control it explains.

**The log emission stays exactly as it is.** Replacing it was considered and
rejected: `useInvitationEditor.test.ts:208` pins the per-turn repetition and
`:247` pins message ordering, and those tests encode a documented decision. More
to the point the two do different jobs — the log entry is the assistant
*answering* a refused publish in conversation, the banner is the standing
explanation of a disabled control. Keeping both means no hook change, no test
change, no behaviour change.

A **peek line** above the composer shows the latest assistant message while the
log is collapsed, so FR-1.7's nudge and the generating status cannot be missed
either. Desktop keeps the full transcript, and the banner appears there too — a
guarantee must not depend on viewport width.

### 7. Glass on real hardware

**The rule that makes everything else safe: every glass surface must be legible
with its blur removed.** The tint alone carries the contrast; blur is decoration
on top. This makes the fallback a token swap rather than a second design:

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
Android **inside Viber's in-app webview** — the environment the hosts are
actually in, and the one nobody tests. If it cannot hold frames there, the glass
thins or the fallback becomes the default. It does not ship stuttering.

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

**A section is not a surface, and this list undersells it.** The ratchet's
unit is a stylesheet *section* — `App chrome`, `Creation chat` — not a
*surface*, and the two shapes do not coincide: `App chrome` also holds the
language switcher shared by the landing, guest and manage screens
(`.ls-track`, `.ls-seg`, `.ls-globe`), and `Creation chat` also holds the
share-panel and BYOK-panel shells named above as out of scope. Tokenising
those two sections therefore moved a handful of declarations inside the "out"
surfaces too — a 20px→22px panel radius, a border colour, a disabled-button
pair, and the language switcher's track/segment/globe colours. Kept rather
than reverted: the deltas are imperceptible or improvements (the globe icon's
contrast goes 2.22:1 → 3.20:1), and reverting them to hold this sentence
exactly would be worse for users than the sentence being slightly wrong. The
next surface conversion should expect the same mismatch between its section
and its surface, and check for it rather than assume the ratchet's boundary
is the scope boundary.

### 9. Claude Design authors the material, not the layout

The DS project gets a **small, high-leverage set**: one material spec — the
glass system rendered over all six card palettes, the piece that cannot be
judged from code — plus the segmented toolbar and its sheets. Not a re-mock of
every editor state.

**The stale-template problem is handled in this iteration, not after it.** The
project holds roughly twelve template sets encoding the old direction, and
`CLAUDE.md` and `styles.css` comments cite them **by name** as spec sources, so
a stale template actively misdirects the next iteration rather than sitting
harmlessly. This repo already has that scar (`NOTES.md`: a `conventions.md`
pixel figure stale with nothing catching it). The rule: any template set this
iteration supersedes is marked superseded **in the same pass** that lands the
CSS citing its replacement. `creation-chat` is the set this one supersedes.

`NOTES.md` also records that registering a new template set needs an entry
canvas with specific markers, and that two attempts were spent discovering it.

### 10. Testing

`web/test/styles.test.ts` holds three rules the types cannot: the §2 ratchet;
**ground coverage** — every `palette-*` has a matching `[data-palette]` entry,
the same enum-coverage idiom `og.test.ts` uses; and **contrast** — WCAG ratios
for ink and accent against the ground and against each glass tint *composited
with blur ignored*, which is the same assumption §7's legibility rule makes. The
test and the rule are one statement.

`useInvitationEditor.test.ts` must stay green **untouched** — §6's whole point
is that message behaviour does not change.

## Consequences

- **The app runs two design languages until the remaining surfaces convert.**
  The editor is glass; everything else is flat. The accepted cost of not doing
  all six at once, and §2's allowlist is what keeps it from becoming permanent.
- **NFR-1's bundle line needs re-measuring** after the token block lands.
  Expected to be roughly neutral — tokens add bytes, consolidating 443 literals
  and ~9 bespoke shadows removes them — but the measurement is the point, not
  the estimate. NFR-1 already records that this figure went stale once and cost
  [adr-017](adr-017-invitation-gallery.md) a threshold derived from a number
  3.2 kB wrong. Re-measure rather than appending.
- **NFR-9 is new**, and writes down commitments the codebase has only ever made
  in CSS comments: the token layer as the single source of colour, AA contrast,
  legibility without blur, and honouring reduced transparency and motion. **No
  accessibility NFR existed before this.**
- **The editor gains a genuine usability improvement**, not only a restyle: four
  stacked control rows become one bar, returning roughly a third of a phone
  screen to the invitation.
- **The design-sync must be re-run** after `styles.css` changes, with the
  `@kind` annotation count re-verified (`≥ 7`).

## Revisit triggers

- **The perf gate fails** on mid-range Android → the glass thins, or
  `prefers-reduced-transparency`'s opaque branch becomes the default and the
  translucency becomes the progressive enhancement.
- **The two-language seam draws a complaint** before the panel pass lands → pull
  the share/BYOK/auth panels forward rather than continuing to the other
  surfaces.
- **The allowlist stops shrinking** across two iterations → the incremental plan
  is not working; either convert the rest in one pass or drop the pretence that
  it is coming.
- **`backgrounds` usage moves off 0** (currently 0 lifetime,
  [adr-009](adr-009-ai-background-layer.md)) → the AI background layer interacts
  with the tinted ground and the scrim spec, and would need re-checking against
  the glass.
