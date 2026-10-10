# Spec — splitting the design system from the E-invitation design project

**Date:** 2026-10-02 · **Status:** approved in brainstorm · **Lands as:** no FR
or NFR. This is how the design workspace is organised, not what the product
does. One dated amendment to [adr-018](../../decisions/adr-018-material-system.md)
§9; no new ADR, because design-sync decisions live in `.design-sync/NOTES.md`.

## Outcome (2026-10-10): complete, and flatter than specified

This spec describes the intended end state. What landed differs in the
details below, and `.design-sync/NOTES.md` is the current record:

- **Complete, in two passes.** Three sets moved first (`guest-rsvp-extras`,
  `brand-name`, `feedback-sheet`) and the other eight on the same day, by
  asking the design project's own assistant to copy them from the bound DS.
  That copy is byte-exact.
- **Flat, not `screens/<set>/`.** Every set sits at the design project's root
  with its original file names (only the first set's entry was renamed to
  "Guest RSVP Phase 2"). The app's own copy was kept rather than paid for
  twice.
- **The binding is a snapshot**, and Claude Design offers no refresh. After
  every DS sync, the bound files are rewritten by DesignSync (NOTES has the
  steps).
- **The project is named "E-invitation design"**
  (`530d4226-b043-40eb-bdc2-326eed222b0f`). The concepts project was deleted
  by its owner, so there is no `explorations/` folder.

## Context

There are three Claude Design projects, and the one that matters holds two
different kinds of thing.

| Project | Id | Type | Holds |
|---|---|---|---|
| **E-invitation DS** | `53daa9fc-5618-4769-9cff-7fbf338169de` | design system | the `/design-sync` target: `InvitationPreview` (bundle, `.d.ts`, prompt, card), `styles.css` → `_ds_bundle.css`, the token panel — **and** 13 `templates/` sets of product screens drawn in Claude Design |
| Design System | `d96adb40-4a0f-401c-8e5a-7a518a31b5d5` | design system | 16 per-enum token cards from `scripts/build-design-cards.mjs` (last synced 2026-07-15) |
| E-invitation Design System | `350a2663-afbf-4816-8ab4-e51a7bbabb71` | regular project | one `Invitation Concepts.dc.html` canvas of theme ideas |

The 13 template sets in the DS are `auth-gate`, `brand-name`,
`card-background`, `creation-chat` (superseded per adr-018 §9), `feedback-sheet`,
`gallery`, `guest-rsvp`, `guest-rsvp-extras`, `host-manage`, `landing-page`,
`lang-switcher`, `rsvp-notifications` and `share-panel`. Eleven are registered
in `_ds_manifest.json`'s `templates` array; `brand-name` (a `@dsCard` that was
never compiled) and `feedback-sheet` (no entry canvas) are not.

Every set that loads the system does it through a nine-line `ds-base.js` with
`base = '../..'`. That file's own comment describes the case this spec is
about: *in a consuming project, point base at the bound `_ds/<folder>`*. Claude
Design already has a "design project binds a DS" mechanism, and the templates
were written to be movable.

## Goals

All four were asked for:

1. **Cleaner agent context.** The design agent working against the DS should see
   only reusable parts. Today the old landing directions and the superseded
   creation chat sit beside the card as if they were part of the system.
2. **A proper home for screens.** Product flows, screens and explorations happen
   in a regular design project that *consumes* the DS. They are no longer
   authored inside it.
3. **Reuse the system elsewhere.** A second product could bind the DS without
   inheriting INVINTO's screens.
4. **Housekeeping.** Three overlapping projects become two: one system, one
   design project.

## Decisions

**Depth: projects only.** The DS keeps shipping all of `styles.css`, screen
classes included (`.lp-*`, `.sp-*`, `.hm-*`, `.cc-*`…). Those classes stay inert
unless a page uses them, and the moved mockups need them to render. Splitting
the stylesheet would reverse part of adr-018 §3 ("not a separate `tokens.css`"),
rework the `styles.test.ts` ratchet and need a second sync pipeline. Goal 3 is
therefore met for *screens*, not for *screen CSS*. See revisit triggers.

**The line.** System is what a second product could reuse:
`InvitationPreview`, the stylesheet and its tokens, `card-background` (a
treatment of the card component) and `lang-switcher` (a shared chrome component
spec). `brand-name` is INVINTO's wordmark, so it is product and moves. The 16
old token cards are **not** folded in: the DS token panel and the
`InvitationPreview` card already cover every enum.

**Names.** The DS keeps its name and id, because `.design-sync/config.json` pins
it. The new project is **"E-invitation"**. From here on, "DS" in this repo means
the system only.

**Approach: a new project bound to the DS, then copy → verify → prune.** The
rejected alternatives:

- Repurposing `350a2663` means hand-copying `_ds/` into an unbound project. That
  copy drifts from every DS sync.
- Relabelling the templates in place fails goal 1.

## End state

**E-invitation DS** (`53daa9fc`, unchanged id, still the sync target):

- Converter output: `components/general/InvitationPreview/*`, `_ds_bundle.css`,
  `_ds_bundle.js`, `styles.css`, `_vendor/`, `_preview/`, `_ds_sync.json`,
  `README.md`.
- App-generated: `_ds_manifest.json`, `Canvas.dc.html`, `support.js`,
  `_adherence.oxlintrc.json`.
- `templates/card-background/` and `templates/lang-switcher/`. The manifest's
  `templates` array goes from 11 entries to these 2.
- `uploads/`: any `draw-*.png` that no moved canvas references stays here rather
  than being deleted.
- Future: adr-018 §9's material spec (glass over all six palettes) is system
  work and belongs here when it is built.

**E-invitation** (new, regular project, bound to the DS when it is created):

- `_ds/<folder>/`: the binding, managed by the app.
- `screens/<set>/` for the ten product sets, folder names unchanged:
  `landing-page`, `share-panel`, `host-manage`, `auth-gate`, `guest-rsvp`,
  `guest-rsvp-extras`, `rsvp-notifications`, `gallery`, `feedback-sheet`,
  `brand-name`.
- `screens/creation-chat/`: still superseded, banner kept. It is history, not a
  starting point.
- `explorations/Invitation Concepts.dc.html`: from `350a2663`.
- `uploads/`: the `draw-*.png` files the moved canvases reference.

`screens/`, not `templates/`, because "template" is a DS concept with no meaning
in a regular project. The `@template` markers in the moved entry canvases become
inert and are left in place.

**Retired** by the user in the Claude Design UI, after verification: `Design
System` (`d96adb40`) and `E-invitation Design System` (`350a2663`). The tool
cannot delete projects, and neither project is deleted before its contents are
confirmed safe.

## Migration

The constraint that shapes this section: **no file reaches the new project
without passing through the agent.** `DesignSync.get_file` returns content into
context, and even the local converter fetches remote files that way
(`.ds-sync/resync.mjs`: "DesignSync get_file → a local file"). About 70 files
move, and retyping that many canvases is a transcription risk. So the method is
chosen by probes, and the tool copy is the fallback, not the default.

### 0 · User

Create "E-invitation" in Claude Design with **E-invitation DS** selected as its
design system, then paste the project link.

### 1 · Probes

Each probe is reversible.

| # | Probe | Method | Outcome |
|---|---|---|---|
| P1 | Binding | `list_files` on the new project | Is there a `_ds/<folder>/`? Its name sets every `ds-base.js` base line; whether it holds real files hints at P2. |
| P2 | Freshness | Write `_probe/binding.txt` to the DS, look for it under the binding, delete it from the DS | **Live:** nothing extra. **Snapshot:** NOTES gains a "refresh the binding after every DS sync" step, with the method the app offers. Neither blocks the split. |
| P3 | Tool writes | `finalize_plan` + `write_files` of one probe file to the new project, then delete it | **Accepted:** the tool copy is available. **Rejected:** every move goes through the app. |
| P4 | Native copy | The user starts `guest-rsvp-extras` (3 canvases) from the DS template inside the new project; the agent diffs paths and the base line against the source | **Works:** the bulk goes native. **No such path:** the bulk goes by tool copy. |

**Stop condition:** if P3 is rejected and P4 finds no native path, the split
cannot be done safely with the tools available. Stop and report rather than
improvise.

If the native path works but lands sets somewhere other than `screens/<set>/`,
and the app offers no way to move them, keep the app's layout and record it in
NOTES. Path tidiness is not worth a tool copy.

### 2 · Copy

- **Bulk.** The 9 sets registered in the manifest that move: `auth-gate`,
  `creation-chat`, `gallery`, `guest-rsvp`, `guest-rsvp-extras`, `host-manage`,
  `landing-page`, `rsvp-notifications`, `share-panel`. They go native if P4
  works, otherwise by tool copy.
- **Always by tool copy.** `feedback-sheet` and `brand-name` (not in the
  manifest, so no native path can see them) and the concepts canvas (not in the
  DS at all).
- **Tool copy.** `get_file` each file → stage under the scratchpad as
  `screens/<set>/…` → render each entry canvas locally against `ds-bundle/` →
  `write_files` with `localPath`.
- **Rewire.** Every relative reference that climbs to the DS root
  (`../..`) is pointed at `../../_ds/<folder>`:
  - in `ds-base.js` where the set has one;
  - in the canvas itself where it does not (`brand-name` and `feedback-sheet`
    ship no `ds-base.js`; read them to find out how they load the system).
- **Not copied.** `.thumbnail` and `support.js` are app-generated, and a folder
  works without `support.js` (NOTES, 2026-09-12).
- **`uploads/`.** Only the PNGs that a moved canvas references.

About 65 files from the DS (`landing-page` alone is 17), plus the concepts
canvas and at most 4 PNGs.

### 3 · Verify, per set, before anything is deleted

- The path inventory matches the source one-for-one, minus `.thumbnail` and
  `support.js`.
- The rewired base line resolves: the entry canvas renders against the bound
  system, not as unstyled text.
- For tool-copied sets, the user opens each entry canvas in Claude Design. That
  is the final gate on transcription, because the local render check proves the
  file is well-formed, not that it is identical.

**A set that fails stays in the DS.** NOTES records the split as partial and
names which sets are still there.

### 4 · Prune the DS

1. **Manifest first.** Re-read `_ds_manifest.json` immediately before writing
   (it is uploaded whole, NOTES 2026-10-02), and reduce `templates` to the
   `card-background` and `lang-switcher` entries. Change nothing else in the
   file. Manifest before files, because a set that is hidden but still present
   is recoverable, while a listed set whose files are gone is a broken entry.
2. **Then the files.** One `finalize_plan` naming `templates/<set>/**` once per
   moved set, each set by name. **Never `templates/**`**: that is the "never
   sweep" trap in NOTES, and it would take the two system sets with it.
3. **Check the DS root `Canvas.dc.html`** for links into the moved sets, and
   repoint or drop them.

### 5 · Retire

The user deletes `Design System` and `E-invitation Design System` in the UI,
once `explorations/Invitation Concepts.dc.html` is confirmed to render.

Until step 4, everything is additive: rolling back means doing nothing.

## Repo changes

### Citation rule

"DS" now means the system only. A moved set is cited as
`design project \`AuthGateSpec\``, or in long form as "the E-invitation design
project".

**Repointed.** These are comment and docs changes only:

- `web/src/GuestPage.tsx`, `LandingPage.tsx`, `ManagePage.tsx`, `draft.ts`,
  `i18n.ts`
- `web/src/components/AccountFooter.tsx`, `DeleteAccountSheet.tsx`,
  `SignOutSheet.tsx`, `editor/AuthGate.tsx`, `editor/SharePanel.tsx`,
  `manage/icons.tsx`
- `server/src/email/notification.ts` (line 2), `server/src/email/strings.ts`
- `web/src/styles.css`, the comments at the Creation chat, Share panel, Guest
  page, guest CTA, Host manage and auth-gate sections
- `CLAUDE.md` Host accounts: "three DS template sets" (sign-in UI) and
  "DS `LandingListIsAccount`"
- `CLAUDE.md` Discoverability: "`INVITO` in quotations from the DS". Those
  quotations come from screen mockups that now live in the design project.

**Left alone, because they are still true:**

- `InvitationPreview.tsx` (card-background) and `LangSwitcher.tsx`
- `GalleryHubPage.tsx` (the `.d.ts` contract)
- `notification.ts:83` (the DS's display face)
- `styles.css`'s sync-mechanics, card-background and `@kind` comments
- `CLAUDE.md`'s AI background layer line (`templates/card-background`) and its
  Invitation gallery line (`InvitationPreview.d.ts` and `conventions.md`)

**History, not touched:** ADRs other than adr-018 §9, `docs/06-roadmap.md`, and
earlier plans and specs. This follows the precedent `CLAUDE.md` sets for the
old `INVITO` quotations.

### `.design-sync/NOTES.md`

- Both live project ids, the boundary, and the two retired projects (replacing
  the `d96adb40` paragraph).
- The probe results, including the binding refresh step if P2 found a snapshot.
- **"Never sweep", restated.** The DS still holds two template sets plus
  app-generated files, so the no-anchor trap still applies. The design project
  is never a sync target.
- "Registering a new template set" scoped to **system** sets. New screens are
  plain canvases in the design project and need no manifest entry; confirm this
  during P3/P4.
- "Marking a template set superseded" pointed at the design project, where
  `creation-chat` now lives.

### `.design-sync/conventions.md`

This ships as the DS `README.md`, the first thing the agent reads.

- One line saying product screens live in the E-invitation design project, and
  the DS holds the system only.
- Replace the stale app-chrome hexes (page `#f6f5f2`, ink `#23211d`, muted
  `#6b6659`) with the adr-018 `:root` tokens they became (`--ground`/`--surface`,
  `--ui-ink`, `--ink-muted`, …). Re-derive the mapping from `styles.css` rather
  than from this list.

### adr-018 §9

Add one dated amendment paragraph. §9 gives the DS project "the segmented
toolbar and its sheets", which is screen work and now belongs in the design
project. §9 itself argues that a stale citation actively misdirects. The
material spec stays with the DS.

### DS refresh

`conventions.md` and the `styles.css` comments are both converter inputs, so run
a **real resync** with the local `.ds-sync` converter (in the main checkout),
not the CSS-only shortcut. That also brings the token panel up to date. With a
healthy anchor, `deletePaths` only names converter output, so the resync cannot
touch `templates/`. Check the verdict's `deletePaths` before uploading anyway.

### Memory

Rewrite `design-system-sync.md` with the two live projects, the two retired
ones, and the boundary.

## Verification

- `pnpm test`, `pnpm typecheck` and `pnpm lint` are green. `styles.test.ts`
  parses section banners, so the `styles.css` comment edits are exercised.
- **Citation gate.** A grep over living files (`CLAUDE.md`, `web/src`,
  `server/src`, `.design-sync/*.md`) finds no moved set cited as DS. Every
  remaining DS citation is about the card, `card-background`, `lang-switcher`,
  the `.d.ts` contract, the token panel or sync mechanics.
- **DS end state.** `list_files` matches the end-state inventory above, the
  manifest has exactly 2 `templates`, and `grep -c "@kind" ds-bundle/_ds_bundle.css`
  is ≥ 7 after the resync.
- **Design project end state.** The inventory matches the source one-for-one,
  and every entry canvas has been opened by the user.

## Revisit triggers

- **A second product actually binds the DS.** Then the inert screen CSS becomes
  real weight, and the stylesheet split (system layer vs app layer, two sync
  targets) is worth its cost. Don't build it before that.
- **P2 found a snapshot binding and the refresh step gets skipped.** The design
  project then renders screens against a stale system, the same failure as the
  two-month sync gap in NOTES. If that happens once, the refresh step belongs
  in the resync driver's checklist, not in prose.
