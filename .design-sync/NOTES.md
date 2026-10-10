# design-sync notes — inv-app

- This is an **app repo, not a component library**: `inv-app-web` has no dist/library build. The converter is anchored by passing `--entry web/src/components/InvitationPreview.tsx` (walks up to `web/package.json` for the package dir) — do not look for a dist entry, there is none.
- Full converter/driver invocation (run from repo root):
  `node .ds-sync/resync.mjs --config .design-sync/config.json --node-modules web/node_modules --entry web/src/components/InvitationPreview.tsx --out ./ds-bundle [--remote .design-sync/.cache/remote-sync.json]`
- pnpm workspace: `--node-modules web/node_modules` (react/@types/react resolve there).
- `App` and `GuestPage` are data-fetching pages, excluded via `componentSrcMap` nulls — they are not design-system components.
- `dtsPropsFor.InvitationPreview` is **hand-written** (no shipped `.d.ts`). Its source of truth is `server/src/schemas.ts` (`DesignTokens`, `InvitationCopy`) mirrored in `web/src/types.ts`, plus the component's own props in `web/src/components/InvitationPreview.tsx`. **Whenever token enums, copy fields, or component props change, update `dtsPropsFor` AND `.design-sync/conventions.md` in the same pass** (2026-07-16: added optional `activeField`/`onFieldClick` tap-to-edit props this way).
- Fonts load via a Google Fonts `@import` at the top of `web/src/styles.css` (deliberately moved there from `index.html` so the DS `styles.css` closure carries the fonts). All four families cover Cyrillic — required for Ukrainian copy; don't substitute without checking Cyrillic support. **`index.html` now carries a `<link>` to the same URL as well** (adr-016 §8, 2026-08-21): an `@import` is discovered only after the stylesheet containing it has been parsed, which held first paint for a round trip. The duplicate is deliberate and the two must stay in sync — the `@import` is what keeps the DS closure self-contained, so **do not remove it** when the `<link>` looks redundant; the browser resolves the second request from cache.
- validate prints ".d.ts parse check skipped — typescript not in node_modules": typescript is installed in `.ds-sync/node_modules` but validate resolves from cwd. Harmless for one hand-written props body.
- **Windows EPERM on rebuild**: a driver run started right after a previous validate can die with `Error: EPERM … rm '\\?\C:\projects\inv-app\ds-bundle'` — a chromium/file handle from the render check is still open on the output dir. Fix is `rm -rf ds-bundle` then re-run the driver; it is not a converter bug and needs no config change.
- **Two Claude Design projects since the 2026-10-02 split** (spec: `docs/superpowers/specs/2026-10-02-design-project-split-design.md`). **E-invitation DS** (`53daa9fc-5618-4769-9cff-7fbf338169de`, this sync's target) is the system: `InvitationPreview`, the stylesheet and its tokens, and the `card-background` and `lang-switcher` template sets. **E-invitation design** (`530d4226-b043-40eb-bdc2-326eed222b0f`, a regular project, never a sync target) binds the DS at `_ds/e-invitation-ds-53daa9fc-5618-4769-9cff-7fbf338169de/` and holds product screens, flat at its root: `Guest RSVP Phase 2` and `GuestCta` (from `guest-rsvp-extras`), `BrandName`, and `FeedbackMain`/`FeedbackSpec`/`FeedbackStates`. **The split is partial**: `auth-gate`, `creation-chat`, `gallery`, `guest-rsvp`, `host-manage`, `landing-page`, `rsvp-notifications` and `share-panel` are still under the DS's `templates/` and still cited as DS until they move (see "Moving a screen set to the design project" below). In this repo "DS" means the DS project; a board in the design project is cited as ``design project `Name` ``. The older "Design System" project (`d96adb40-4a0f-401c-8e5a-7a518a31b5d5`, 16 token cards from `scripts/build-design-cards.mjs`) is retired: the DS token panel and the `InvitationPreview` card cover every enum, and the script has no target. The "E-invitation Design System" exploration (`350a2663-afbf-4816-8ab4-e51a7bbabb71`) was deleted by its owner during the split, its concepts canvas with it.
- **The binding is a snapshot, not live.** After the DS's `_ds_manifest.json` was rewritten on 2026-10-10, the copy under `_ds/<folder>/` in the design project still listed the old template set. The binding is a fixed six-file copy (`README.md`, `_adherence.oxlintrc.json`, `_ds_bundle.css`, `_ds_bundle.js`, `_ds_manifest.json`, `styles.css`) taken when the project was bound. That is also why a probe file written anywhere else in the DS could never show up in it, and why the first freshness probe was inconclusive. **After every DS sync, refresh the binding**, or the screens render against the previous stylesheet. That is the two-month sync gap below, one level further out. Check by grepping the bound `_ds_bundle.css` for a comment that changed in the sync.

- **Claude Design token annotations live in `web/src/styles.css`**: inline `/* @kind color */` on every `--wash` declaration (base `.inv` + five `palette-*`; minimal has no wash) and `/* @kind font */` on `.landing`'s `--lp-display`. The DS app's token panel reads them from the declaration line in `_ds_bundle.css`. They were originally patched remotely by the design agent and reverted by every sync — now upstream, so they persist. Don't strip these comments; verify `grep -c "@kind" ds-bundle/_ds_bundle.css` ≥ 7 after build.

## A CSS-only sync without the converter (2026-10-02)

`.ds-sync/` is gitignored machine state, so a cloud session has no converter.
It does not need one when **only `web/src/styles.css` changed**:
`_ds_bundle.css` is a byte-for-byte copy of `styles.css` (the remote one was
verified identical to `05159a2`'s), and the project's own `styles.css` is a
one-line `@import "./_ds_bundle.css"`. Upload just that file, after checking:

- no other converter input moved since the last sync — `InvitationPreview.tsx`
  and its runtime imports (today only `import type`), `config.json`,
  `conventions.md`, `previews/` — or the JS bundle, `.d.ts` and preview card
  are stale too and this shortcut is wrong;
- the `Invitation card` section is text-identical, so `renderHashes` in
  `_ds_sync.json` still describes what the card renders;
- `@kind` count ≥ 7, and no local `@import`/`url()` has appeared that the
  converter would have inlined.

Leave `_ds_sync.json` alone. Its `styleSha` is not a plain sha256 of the CSS,
so it cannot be recomputed by hand; left stale, the next real resync sees a
style change and re-uploads the same bytes, which is harmless.

That 2026-10-02 upload was the first since **2026-08-02**: adr-018 says to
re-sync after `styles.css` changes, and two months and 27 stylesheet commits —
the gallery, discoverability and the whole material system — went by without
one. `ds-base.js` loads the bundle, so mockups that use app classes render
against the new CSS from now on. Since the 2026-10-02 split that holds in the
design project only once its binding is refreshed (see above).

**What this shortcut does not refresh: the token panel.** `_ds_manifest.json`'s
`tokens` array is compiled by the CLI resync from the CSS, and the app never
recompiles it, so after a CSS-only upload the panel still lists the old
tokens — on 2026-10-02 that meant the August set, with none of the material
system's `:root` tokens in it. Only a real resync fixes that; until one runs,
the stylesheet and the panel disagree.

## The full resync of 2026-10-02

Ran the same day, from a worktree: cwd = the worktree root, driver by absolute
path from the main checkout's `.ds-sync/`, the remote `_ds_sync.json` saved to
the worktree's `.design-sync/.cache/remote-sync.json` first. Verdict: anchor
ok, `InvitationPreview` unchanged, upload = styling + aux only — `_ds_bundle.css`,
`styles.css`, `README.md`, `_ds_needs_recompile`, then `_ds_sync.json`.

**`_ds_needs_recompile` is what refreshes the token panel**, not the CSS: the
app recompiles `_ds_manifest.json` when it next opens the project and finds
that marker, which is why a CSS-only upload never moves the panel. Expect the
README's token count to go 25 → 75. Unverified at upload time: whether the
recompile also rebuilds the `templates` array from the entry canvases'
`@template` markers. If it does, a set whose manifest entry was hand-edited
without its marker (see below) loses the edit — check the project list after
the first open.

That pass also found `conventions.md` still pointing designs at three chrome
hex values (`#f6f5f2`, `#23211d`, `#6b6659`) from before adr-018. They all
still exist, but `#f6f5f2` is now `--app-bg`, deliberately *not* the
`--ground` converted surfaces sit on, and nothing told the design agent that
`.palette-*` shadows `--ink`/`--accent`/`--wash`/`--edge`. It now names the
`:root` tokens instead. **Diff that paragraph against the `:root` block on
every resync** — like the pixel figures below, no validator reads it.

## Marking a template set superseded (2026-10-02)

`creation-chat` was the first, per adr-018 §9. Three places, nothing deleted:

1. The set's `templates` entry in `_ds_manifest.json` — `name` and
   `description` — because that array is what the project list renders and the
   app never recompiles it. Change only those two fields; the file is uploaded
   whole, so re-read it immediately before writing.
2. The entry canvas's `<!-- @template name="…" description="…" -->` marker,
   with the same text, so a resync that compiles from markers keeps the label.
3. A banner at the top of the entry canvas, so anyone who opens it reads the
   status before the mockups. Shift the canvas's other blocks and its height
   down to make room rather than overlapping them.

Name it `Superseded · <old name>` so it sorts and reads as such in the list,
and keep the description under 200 characters — the app cuts longer ones
mid-word. The captured `.thumbnail` still shows the old canvas until the app
recaptures it.

## Moving a screen set to the design project (learned 2026-10-10)

Three sets moved on 2026-10-10. The eight still in the DS move the same way,
one set at a time, and nothing leaves the DS before its copy is verified.

1. **Copy it with Claude Design's own "start from template".** In E-invitation
   design, start a file from the DS template. The app copies the set to the
   project **root** (not a folder), renames the entry canvas to the template's
   name (`Phase2.dc.html` became `Guest RSVP Phase 2.dc.html`), rewrites
   `ds-base.js`'s base to `_ds/<folder>`, and brings `support.js` and
   `.thumbnail`. Canvas names are distinct across all sets, so the flat
   layout does not collide. This costs nothing.
2. **Then confirm with `list_files`.** On 2026-10-10 eight sets reported as
   started produced no files at all. What had been seen was the DS's own
   template list, shown through the binding.
3. **A set with no `templates` entry cannot be started from a template**
   (`brand-name` and `feedback-sheet` had none). Copy it through DesignSync:
   `get_file`, stage on disk, `write_files` with `localPath`, then write a
   second copy from the **DS source** and `diff` the two. Re-reading the
   design project's copy proves nothing, because it returns the staged bytes.
   Through the agent's context this costs about 25 KB per canvas, twice.
4. **Only then prune the DS.** Drop the set's entry from `_ds_manifest.json`:
   re-read it, transcribe it twice and `cmp` the copies, check every token
   against `web/src/styles.css`, and change `templates` only. Then delete
   `templates/<set>/**` by explicit path, never a glob that could reach a
   system set.
5. **Repoint the repo's citations of that set** from DS to
   ``design project `Name` ``, and update the partial-split list above.

## Known render warns

- `[FONT_REMOTE] "Cormorant Garamond", "Marck Script", "Segoe Script", "Manrope", "Playfair Display"` — expected; families served by the Google Fonts `@import` at runtime (Manrope/Playfair joined the warn when the landing page moved their usage into `styles.css`, 2026-07-16).

## Re-sync risks

- `dtsPropsFor` and `conventions.md` enumerate the token enums by hand — they go silently stale if `schemas.ts`/`types.ts` widen or rename tokens. Diff them against `web/src/types.ts` on every re-sync. **This has already fired once**: the 2026-07-28 re-sync found `background?: BackgroundRef | null` (adr-009) shipped in `InvitationPreview.tsx` but missing from `dtsPropsFor` and `conventions.md`. Widen the check beyond the token enums — diff the component's whole `Props` interface, not just `DesignTokens`/`InvitationCopy`.
- Props whose value only resolves against a running server (today: `background`, an id served from `/api/backgrounds/:id`) must be documented as **omit-in-designs** in both the `dtsPropsFor` JSDoc and `conventions.md`. The design agent has no server; an id it invents renders a broken layer.
- `conventions.md` carries layout advice with concrete pixel figures. Those are NOT enum names and no validator catches them — the 2026-07-28 pass found a stale "~520 px" column claim with nothing behind it, restated as ~590 px from `.page`/`.workspace`. adr-018 then replaced that grid with the glass editor, and the 2026-10-10 pass found `.page`/`.workspace` still in the stylesheet but rendered by nothing. The figure is now 460 px, from `.cc-preview-inner { width: min(460px, 100%) }` inside `.cc-preview`'s 28 px padding. Re-derive it if those two rules change.
- The authored preview (`.design-sync/previews/InvitationPreview.tsx`) hard-codes realistic copy; it tracks the pipeline's copy shape (`title/greeting/body/details_line/rsvp_prompt/closing`). A schema rename breaks it loudly (compile), a semantic change only stales it quietly.
- Google Fonts are fetched at runtime — render checks need network for true typography; offline runs fall back to Georgia/Segoe and screenshots will look wrong without being a regression.
- Build assumptions: pnpm v10 workspace install from repo root; converter deps staged in `.ds-sync/` (npm, isolated); playwright chromium cached at `%LOCALAPPDATA%\ms-playwright`.
- **The DS project holds more than this sync produces — never sweep it.** Alongside our 13 files it carries a `templates/` tree authored *in* claude.ai/design: the two system sets (`card-background`, `lang-switcher`) and, until they move, eight screen sets (`auth-gate`, `creation-chat`, `gallery`, `guest-rsvp`, `host-manage`, `landing-page`, `rsvp-notifications`, `share-panel`). It also carries app-generated `Canvas.dc.html`, `support.js`, `_ds_manifest.json`, `_adherence.oxlintrc.json` and `uploads/`. **That list has been wrong before** (`brand-name`, `feedback-sheet` and `gallery` were all missing from it until 2026-09-12), so treat it as a reminder that the tree is larger than this sync, not as an inventory. None are converter output. With a healthy anchor this is safe automatically (`deletePaths` only ever names our own paths). **The trap is the no-anchor branch of §5**, which says to review `list_files` for "files this build doesn't produce" and put them in `deletes`. Applied literally here, that deletes every mockup still in the DS. If the anchor is ever missing, pass `deletes: []` and re-anchor instead. **The design project is never a sync target**: nothing in this pipeline writes to `530d4226-b043-40eb-bdc2-326eed222b0f`.

## Registering a new template set (learned 2026-09-12)

This applies to **system** sets in the DS only. A new product screen goes in
the E-invitation design project as a plain canvas. A regular project has no
`_ds_manifest.json` of its own to register it in.

Writing `.dc.html` files into `templates/<name>/` is **not enough to make a set
appear** in the project, and two attempts were spent discovering that:

1. A set needs an **entry canvas** — `templates/<name>/<Name>.dc.html` carrying
   a first-line-in-`<x-dc>` marker,
   `<!-- @template name="…" description="…" -->`, a
   `<meta name="design_doc_mode" content="canvas">` helmet and one
   `<dc-import name="Artboard" hint-size="W,H">` per artboard. Sub-artboards
   carry no marker of their own. (`@dsCard group="…"` is the *other* thing —
   it registers a single foundation card, which is what `brand-name` is.)
2. **The Claude Design app does not recompile `_ds_manifest.json` for this
   project — only the CLI resync writes it.** Its `templates` array is what the
   project's list renders from, so until an entry is added there by hand, a new
   set is invisible however correct its markers are. The proof is that
   `brand-name`'s `@dsCard` was never compiled in either. A hand-added entry
   is `{name, description, folder, entryPath}`; `thumbnail` is optional and the
   app captures one later.

`ds-base.js` is a nine-line loader (`base = '../..'`) and can be copied
verbatim into a new folder. `support.js` is app-generated and a folder works
without it — `brand-name` has none.
