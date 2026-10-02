# Design-project split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move INVINTO's product screens out of the E-invitation DS into a new
"E-invitation" design project that binds the DS. Repoint the repo's citations to
match, re-ship the DS, and retire the two older projects.

**Architecture:** Probes decide how files cross between projects: the app's own
copy if it has one, the DesignSync tool if it accepts writes to a regular
project. Then copy → verify → prune, with nothing deleted from the DS until its
set is verified in the design project. The repo side changes comments and docs
only. A one-off replacement script holds the ~50 citation edits to an
exactly-once rule, and a real converter resync re-ships the DS README and
stylesheet.

**Tech Stack:** Claude Design projects through the `DesignSync` tool; the local
design-sync converter at `C:/projects/inv-app/.ds-sync/resync.mjs`; Node 22 for
the one-off script; pnpm, Vitest and Biome for the repo gates.

**Spec:** `docs/superpowers/specs/2026-10-02-design-project-split-design.md`

## Global Constraints

- DS project id: `53daa9fc-5618-4769-9cff-7fbf338169de` ("E-invitation DS"). Its
  name, id and `.design-sync/config.json` do not change.
- Old projects to retire: `d96adb40-4a0f-401c-8e5a-7a518a31b5d5` ("Design
  System") and `350a2663-afbf-4816-8ab4-e51a7bbabb71` ("E-invitation Design
  System"). The user deletes them in the UI. The tool cannot delete projects.
- New project name: **E-invitation**. Its id (`dpId`) comes from the user in
  Task 1.
- **Stays in the DS:** `templates/card-background/`, `templates/lang-switcher/`,
  all converter output, all app-generated root files, and any `uploads/` file no
  moved canvas references.
- **Moves to `screens/<set>/`:** `auth-gate`, `brand-name`, `creation-chat`,
  `feedback-sheet`, `gallery`, `guest-rsvp`, `guest-rsvp-extras`, `host-manage`,
  `landing-page`, `rsvp-notifications`, `share-panel`. That is 11 sets and 65
  files.
- **Moves to `explorations/`:** `Invitation Concepts.dc.html` from `350a2663`.
- `.thumbnail` and `support.js` are not copied, unless P4 shows the app's own
  copy brings them, in which case mirror the app.
- **Nothing is deleted from the DS before its set is verified** in the design
  project.
- **Never put `templates/**` (or any glob that could match `card-background` or
  `lang-switcher`) in a `deletes` list.** Name each moved set.
- `_ds_manifest.json` is uploaded whole. Re-read it immediately before every
  write, and change only its `templates` array.
- DesignSync's own contract ties it to the user-started `/design-sync` command.
  Before the **first DesignSync write** (Task 1 Step 4), ask the user to start
  `/design-sync` in this session. If their environment has no such command, stop
  and ask how they want to proceed.
- Citation vocabulary: "DS" means the system only. A moved board is cited as
  `design project \`Name\``, or "the E-invitation design project" in long form.
  Screen sets are `screens/<set>`, never `templates/<set>`.
- Files are LF (`.gitattributes`). Biome `lineWidth` is 100 and does not reflow
  comments.
- Working state lives in the gitignored `.design-sync/.cache/split/`:
  `state.json`, `stage/`, `check/` and `repoint.mjs`. Never commit it.
- Commit messages end with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A tool-copied canvas differs silently from its source** (a transcription
   slip that still renders). Expected: caught before the DS copy is deleted.
   Owner: Task 2's round-trip check, which refetches the uploaded copy and runs
   `diff -r` against the stage.
2. **The resync rewrites `_ds_manifest.json`'s `templates` back to 11 entries**,
   now pointing at deleted files (`_ds_needs_recompile` asks the app to
   recompile). Expected: the list shows exactly the two system sets. Owner:
   Task 6 Step 7.
3. **A prune pattern matches a system set** (for example `templates/l*`
   catching both `landing-page` and `lang-switcher`). Expected: both system
   sets survive. Owner: Task 3 Step 3's pattern assertion, and Step 6's
   survivor check.
4. **A snapshot binding stays on the pre-resync stylesheet**, because Task 6
   changes `styles.css` after the screens were copied. Expected: the bound
   copy carries the new comments. Owner: Task 6 Step 8.
5. **An `uploads/` reference gets rewired into `_ds/`, or a referenced PNG is
   never copied.** Expected: images render in the moved canvas. Owner: Task 2
   Step 6's rewire rule (uploads excluded) and Step 9's uploads inventory.

---

### Task 1: Preconditions and probes

Decides how files cross, and writes the decision down for every later task. No
file moves in this task except the two probe files, which are deleted again.

**Files:**
- Create: `.design-sync/.cache/split/state.json` (gitignored)

**Interfaces:**
- Produces `state.json`:

```json
{
  "dsId": "53daa9fc-5618-4769-9cff-7fbf338169de",
  "dpId": "<from the user>",
  "dsFolder": "<P1: the folder under _ds/>",
  "bindingHasFiles": true,
  "bindingHasTemplates": false,
  "binding": "live | snapshot",
  "refreshMethod": "<snapshot only: how the app refreshes the binding>",
  "designProjectHasManifest": false,
  "toolWrites": true,
  "nativeCopy": "start-from-template | in-app-agent | null",
  "nativeRewires": false,
  "nativeBrings": { "thumbnail": false, "supportJs": false },
  "moved": [],
  "stayedInDs": []
}
```

- [ ] **Step 1: Ask the user to create the project**

Say exactly this and wait:

> Please create a new project in Claude Design named **E-invitation**, choose
> **E-invitation DS** as its design system, and paste me its link.

Take the UUID from the link as `dpId`.

- [ ] **Step 2: Confirm the project type**

Call `DesignSync` `{"method":"get_project","projectId":"<dpId>"}`.

Expected: `"type":"PROJECT_TYPE_PROJECT"`, `"canEdit":true`.

If it says `PROJECT_TYPE_DESIGN_SYSTEM`, the user created a design system
instead. Ask them to create a regular project, and stop.

- [ ] **Step 3: P1, the binding**

Call `{"method":"list_files","projectId":"<dpId>"}`. Record:
- `dsFolder`: the segment after `_ds/`.
- `bindingHasFiles`: whether `_ds/<dsFolder>/_ds_bundle.css` is listed.
- `bindingHasTemplates`: whether any `_ds/<dsFolder>/templates/` path is listed.
- `designProjectHasManifest`: whether a root `_ds_manifest.json` exists.

If there is no `_ds/` at all, the project was not bound. Ask the user to bind
E-invitation DS in the project's settings (or recreate it with the DS
selected), then repeat this step.

- [ ] **Step 4: Ask the user to start `/design-sync`**

This is the first write. Ask:

> The next step writes a probe file to the DS. DesignSync's writes are meant to
> run under `/design-sync` — please start it in this session.

- [ ] **Step 5: P2, freshness**

1. Call `finalize_plan` with:

   ```json
   {"method":"finalize_plan","projectId":"53daa9fc-5618-4769-9cff-7fbf338169de","writes":["_probe/binding.txt"],"deletes":["_probe/binding.txt"]}
   ```

2. Call `write_files`:

   ```json
   {"files":[{"path":"_probe/binding.txt","data":"design-project split probe 2026-10-02"}]}
   ```

3. Call `list_files` on `<dpId>`.
   - If `_ds/<dsFolder>/_probe/binding.txt` is listed, `binding = "live"`.
   - If not, wait ~30 s and list again once. Still absent means
     `binding = "snapshot"`. Ask the user how Claude Design refreshes a
     project's design system (for example re-selecting it in project
     settings), and record their answer as `refreshMethod`.
4. Call `delete_files` on the DS with `{"paths":["_probe/binding.txt"]}` and the
   same `planId`.
5. Run `list_files` on the DS. Expected: no `_probe/` path.

- [ ] **Step 6: P3, tool writes to a regular project**

1. Call `finalize_plan` on `<dpId>` with `writes:["_probe.txt"]` and
   `deletes:["_probe.txt"]`.
2. Call `write_files` with `{"path":"_probe.txt","data":"probe"}`.
   - Success sets `toolWrites = true`.
   - Rejection at either call sets `toolWrites = false`.
3. On success, call `delete_files` `["_probe.txt"]` and confirm with
   `list_files`.

- [ ] **Step 7: P4, the app's own copy**

Ask the user:

> In the E-invitation project, please bring in the DS's **Guest RSVP · Phase 2
> add-ons** template set so it ends up at `screens/guest-rsvp-extras/`. Try
> starting a file from the DS template first. If Claude Design has no such
> option, ask its in-app agent to copy
> `_ds/<dsFolder>/templates/guest-rsvp-extras/` to
> `screens/guest-rsvp-extras/` (only if Step 3 found templates in the binding).
> Tell me which way worked, or that neither did.

Then call `list_files` on `<dpId>` and record:
- `nativeCopy`: the way that worked, or `null`.
- Whether the files landed at `screens/guest-rsvp-extras/`. If they landed
  elsewhere and the app cannot move them, keep that layout (spec §Migration)
  and use it in place of `screens/` everywhere below.
- `nativeBrings.thumbnail` / `nativeBrings.supportJs`.
- `nativeRewires`: `get_file` the copied `ds-base.js`, and record `true` if its
  `const base =` line already points into `_ds/<dsFolder>`.

- [ ] **Step 8: Apply the stop condition**

If `toolWrites` is `false` **and** `nativeCopy` is `null`, stop. Report to the
user:

> Neither path can copy files into the design project, so the split cannot be
> done safely with the tools here. Nothing has been moved or deleted; the DS is
> unchanged.

- [ ] **Step 9: Estimate the tool-copy cost, only if `nativeCopy` is `null`**

`get_file` the three `guest-rsvp-extras` files from the DS (needed for Task 2
anyway). Take their combined character count, ×65/3, ×2 for the round-trip
check, as the transcription estimate. Tell the user that figure and that the
tool path writes every file through the agent twice, and wait for a yes.

- [ ] **Step 10: Write `state.json`**

Write `.design-sync/.cache/split/state.json` with every field above. Run
`git status --short`. Expected: nothing under `.design-sync/.cache/` listed
(gitignored).

---

### Task 2: Copy and verify the screen sets

**Files:**
- Create (gitignored): `.design-sync/.cache/split/stage/**` and
  `.design-sync/.cache/split/check/**`, used only on the tool path
- Remote: `<dpId>`: `screens/<set>/**`, `explorations/Invitation Concepts.dc.html`,
  and the `uploads/draw-*.png` files the moved canvases reference

**Interfaces:**
- Consumes: `state.json` from Task 1.
- Produces: `state.json` `moved[]` (the sets verified in the design project) and
  `stayedInDs[]` (the sets that failed). Task 3 deletes only the sets in
  `moved`. Task 4 skips the citations of the sets in `stayedInDs`.

The source inventory, 65 files with `.thumbnail` and `support.js` excluded (all
under `templates/<set>/` in the DS):

| Set | Files |
|---|---|
| `guest-rsvp-extras` | `GuestCta.dc.html`, `Phase2.dc.html`, `ds-base.js` |
| `brand-name` | `BrandName.dc.html` |
| `feedback-sheet` | `FeedbackMain.dc.html`, `FeedbackSpec.dc.html`, `FeedbackStates.dc.html` |
| `auth-gate` | `AuthGate.dc.html`, `AuthGateMain.dc.html`, `AuthGateSpec.dc.html`, `AuthGateStates.dc.html`, `ds-base.js` |
| `gallery` | `Gallery.dc.html`, `GalleryHub.dc.html`, `GalleryOccasion.dc.html`, `GallerySpec.dc.html`, `ds-base.js` |
| `creation-chat` | `ChatActive.dc.html`, `ChatEmpty.dc.html`, `ChatField.dc.html`, `ChatGenerating.dc.html`, `CreationChat.dc.html`, `ds-base.js` |
| `guest-rsvp` | `GuestRsvp.dc.html`, `RsvpDefault.dc.html`, `RsvpNotFound.dc.html`, `RsvpSubmitting.dc.html`, `RsvpThanks.dc.html`, `ds-base.js` |
| `host-manage` | `HostMain.dc.html`, `HostManage.dc.html`, `HostNotify.dc.html`, `HostSpec.dc.html`, `HostStates.dc.html`, `ds-base.js` |
| `rsvp-notifications` | `NotifyEmail.dc.html`, `NotifyLine.dc.html`, `NotifySpec.dc.html`, `NotifyUnsub.dc.html`, `RsvpNotifications.dc.html`, `ds-base.js` |
| `share-panel` | `ShareMain.dc.html`, `ShareOptIn.dc.html`, `SharePanel.dc.html`, `ShareSignedIn.dc.html`, `ShareSpec.dc.html`, `ShareStates.dc.html`, `ds-base.js` |
| `landing-page` | `Canvas.dc.html`, `LandingAccountNotify.dc.html`, `LandingDesktopA.dc.html`, `LandingDesktopAReturning.dc.html`, `LandingDesktopASignedIn.dc.html`, `LandingDesktopB.dc.html`, `LandingDesktopC.dc.html`, `LandingListIsAccount.dc.html`, `LandingMobileA.dc.html`, `LandingMobileAReturning.dc.html`, `LandingMobileASignedIn.dc.html`, `LandingMobileB.dc.html`, `LandingMobileC.dc.html`, `LandingSignedInStates.dc.html`, `LandingSignedOut.dc.html`, `Returning.dc.html`, `ds-base.js` |

Process the sets in that order, smallest first. `guest-rsvp-extras` may already
be in place from P4. Steps 1–8 run **once per set**, and each set is finished
before the next starts.

- [ ] **Step 1: Re-list the source**

Call `list_files` on the DS. Confirm the set's files match the table. A
difference means the DS changed since this plan was written: stop and show the
user the difference.

- [ ] **Step 2 (native path, `nativeCopy` not null): Have the user bring the set in**

Ask the user to repeat the P4 action for this set. (`brand-name` and
`feedback-sheet` are not in the DS template list, so they always take the tool
path, Steps 3–5.) Then go to Step 6.

- [ ] **Step 3 (tool path): Stage the set**

For each file, call `get_file` and Write its `content` verbatim to
`.design-sync/.cache/split/stage/screens/<set>/<file>`. Skip `.thumbnail`. Skip
`support.js` unless `nativeBrings.supportJs` is `true`.

- [ ] **Step 4 (tool path): Rewire references to the system**

**In `ds-base.js`**, replace exactly:

```js
  const base = '../..';
```

with:

```js
  const base = '../../_ds/<dsFolder>';
```

**In each `.dc.html` file**, find every relative path that climbs to the DS
root:

```bash
grep -noE "\.\./\.\./[A-Za-z0-9_./-]+" .design-sync/.cache/split/stage/screens/<set>/*.dc.html
```

- Rewrite a hit to `../../_ds/<dsFolder>/<rest>` only when `<rest>` starts with
  one of: `_ds_bundle.css`, `_ds_bundle.js`, `styles.css`, `_vendor/`,
  `_preview/`, `components/`.
- Leave `../../uploads/…` untouched. Uploads live at the design project's root
  too.
- Any other `../../` target: stop and show it to the user.

`brand-name` and `feedback-sheet` have no `ds-base.js`, so this grep is how they
get rewired.

- [ ] **Step 5 (tool path): Upload, then run the round-trip check**

1. Call `finalize_plan` on `<dpId>` with
   `writes:["screens/<set>/*"]`, `deletes:[]` and
   `localDir:".design-sync/.cache/split/stage"`.
2. Call `write_files` with one entry per staged file:
   `{"path":"screens/<set>/<file>","localPath":"screens/<set>/<file>"}`.
3. For each uploaded file, `get_file` it from **`<dpId>`** and Write it to
   `.design-sync/.cache/split/check/screens/<set>/<file>`.
4. Run:

   ```bash
   diff -r .design-sync/.cache/split/stage/screens/<set> .design-sync/.cache/split/check/screens/<set>
   ```

   Expected: no output.

   Any difference is a transcription slip in one of the two writes. Refetch
   that file from the DS **source**, re-stage it, re-apply Step 4, re-upload,
   and re-check until `diff` is clean.

- [ ] **Step 6 (native path): Rewire `ds-base.js` if the app did not**

If `nativeRewires` is `false`:
- If `toolWrites` is `true`, write the rewired `ds-base.js` with
  `finalize_plan` `writes:["screens/<set>/ds-base.js"]`, then `write_files`
  with inline `data`. This file is nine lines the plan already gives: the DS
  `ds-base.js` with Step 4's base line.
- Otherwise ask the user to change that one line in the app.

- [ ] **Step 7: Check the inventory**

Call `list_files` on `<dpId>`. Expected: `screens/<set>/` holds exactly the
table's files, plus `.thumbnail`/`support.js` only where `nativeBrings` says the
app brings them. Then `get_file` `screens/<set>/ds-base.js` (where the set has
one) and confirm the base line points into `_ds/<dsFolder>`.

- [ ] **Step 8: The user opens the entry canvas**

Ask:

> Please open `screens/<set>/<entry canvas>` in the E-invitation project. Does
> it render styled, the same as it does in the DS, with no broken images?

The entry canvas is the set's capitalised one: `AuthGate`, `BrandName`,
`CreationChat`, `FeedbackMain`, `Gallery`, `GuestRsvp`, `Phase2`, `HostManage`,
`Canvas` (landing-page), `RsvpNotifications`, `SharePanel`.

- **Yes:** append the set to `state.json` `moved`.
- **No:** append it to `stayedInDs`, and leave the DS copy alone.

- [ ] **Step 9: Copy the `uploads/` the moved canvases reference**

On the tool path:

```bash
grep -rhoE "uploads/draw-[0-9a-f-]+\.png" .design-sync/.cache/split/stage/screens | sort -u
```

On the native path, use the PNGs the user reported broken in Step 8 (re-verify
those sets after this step).

For each hit:
1. `get_file` it from the DS. Expect `"isBase64":true`.
2. `finalize_plan` on `<dpId>` with `writes:["uploads/<name>"]`.
3. `write_files` with `{"path":"uploads/<name>","data":"<base64>","encoding":"base64","mimeType":"image/png"}`.
4. Confirm the file appears in `list_files`.

Record the names in `state.json` as `uploadsCopied`. Uploads that nothing
references stay in the DS.

- [ ] **Step 10: Bring over the concepts canvas**

1. `get_file` `Invitation Concepts.dc.html` from `350a2663-afbf-4816-8ab4-e51a7bbabb71`.
2. Grep it for `src=`/`href=` relative paths. Anything besides its own
   `support.js` means stop and show the user.
3. Upload it to `explorations/Invitation Concepts.dc.html`: tool path with the
   round-trip check from Step 5, or ask the user to copy it in the app.
4. Ask the user to open it and confirm it renders.

---

### Task 3: Prune the DS

**Files:**
- Remote: DS `_ds_manifest.json` (modified), plus `templates/<set>/**` for
  each set in `moved` (deleted)

**Interfaces:**
- Consumes: `state.json` `moved`.
- Produces: a DS whose `templates/` holds only `card-background`,
  `lang-switcher`, and any set in `stayedInDs`.

- [ ] **Step 1: Re-read the manifest**

Call `get_file` on the DS for `_ds_manifest.json`. Write it to
`.design-sync/.cache/split/manifest.before.json` and pretty-print it once to
confirm it parses:

```bash
node -e "JSON.parse(require('fs').readFileSync('.design-sync/.cache/split/manifest.before.json','utf8'))"
```

- [ ] **Step 2: Shrink `templates` only**

Write `manifest.after.json`, keeping every `templates` entry whose `folder` is
`templates/card-background`, `templates/lang-switcher`, or
`templates/<set>` for a set in `stayedInDs`:

```bash
node -e "
const fs=require('fs');const d='.design-sync/.cache/split/';
const s=JSON.parse(fs.readFileSync(d+'state.json','utf8'));
const keep=new Set(['card-background','lang-switcher',...s.stayedInDs].map(x=>'templates/'+x));
const m=JSON.parse(fs.readFileSync(d+'manifest.before.json','utf8'));
const before=m.templates.length;m.templates=m.templates.filter(t=>keep.has(t.folder));
fs.writeFileSync(d+'manifest.after.json',JSON.stringify(m));
console.log(before,'->',m.templates.length,m.templates.map(t=>t.folder));
const a=JSON.parse(fs.readFileSync(d+'manifest.before.json','utf8'));delete a.templates;
const b=JSON.parse(JSON.stringify(m));delete b.templates;
if(JSON.stringify(a)!==JSON.stringify(b)){console.error('non-templates field changed');process.exit(1)}
"
```

Expected (with nothing in `stayedInDs`):
`11 -> 2 [ 'templates/card-background', 'templates/lang-switcher' ]`, exit 0.

- [ ] **Step 3: Build the delete list and assert it**

The deletes are one `templates/<set>/**` per set in `moved`. Run:

```bash
node -e "
const s=JSON.parse(require('fs').readFileSync('.design-sync/.cache/split/state.json','utf8'));
const ok=new Set(['auth-gate','brand-name','creation-chat','feedback-sheet','gallery','guest-rsvp','guest-rsvp-extras','host-manage','landing-page','rsvp-notifications','share-panel']);
const del=s.moved.map(x=>'templates/'+x+'/**');
for(const x of s.moved){if(!ok.has(x)){console.error('not a movable set:',x);process.exit(1)}}
for(const p of del){if(/card-background|lang-switcher|\*\*\/|templates\/\*/.test(p.replace(/\/\*\*$/,''))){console.error('bad pattern',p);process.exit(1)}}
console.log(JSON.stringify(del));
"
```

Expected: a JSON array of `templates/<name>/**` entries, exit 0.

- [ ] **Step 4: Write the manifest first**

1. Re-read `_ds_manifest.json` with `get_file` once more and confirm it equals
   `manifest.before.json`. If it changed, redo Steps 1–2.
2. `finalize_plan` on the DS with `writes:["_ds_manifest.json"]`, `deletes` set
   to Step 3's array, and `localDir:".design-sync/.cache/split"`.
3. `write_files` `{"path":"_ds_manifest.json","localPath":"manifest.after.json"}`.

- [ ] **Step 5: Delete the moved sets' files**

`delete_files` with `paths` set to every listed path under each moved set (from
a fresh `list_files`), the `.thumbnail` and `support.js` files included. Use
the same `planId`.

- [ ] **Step 6: Check what survived**

Call `list_files` on the DS. Expected:
- `templates/` holds only `card-background/` (`CardBackground.dc.html`,
  `ScrimCard.dc.html`, `ds-base.js`, `support.js`, `.thumbnail`),
  `lang-switcher/` (`LangSwitcher.dc.html`, `ds-base.js`, `support.js`,
  `.thumbnail`), and any `stayedInDs` set.
- Every converter and app-generated root file is still listed.

Then `get_file` `_ds_manifest.json` and confirm `templates.length` is
`2 + stayedInDs.length`.

- [ ] **Step 7: Check the DS root canvas for links into the moved sets**

`get_file` `Canvas.dc.html` from the DS, Write its `content` to
`.design-sync/.cache/split/Canvas.dc.html`, and grep it for the moved set names:

```bash
grep -noE "templates/(auth-gate|brand-name|creation-chat|feedback-sheet|gallery|guest-rsvp|guest-rsvp-extras|host-manage|landing-page|rsvp-notifications|share-panel)" .design-sync/.cache/split/Canvas.dc.html
```

- No hits: done.
- Hits: show them to the user and ask whether to drop those references. It is
  an app-generated canvas, so do not edit it unasked.

---

### Task 4: Repoint the repo's citations

**Files:**
- Create (gitignored): `.design-sync/.cache/split/repoint.mjs`
- Modify: `CLAUDE.md`
- Modify: `web/src/GuestPage.tsx`, `web/src/LandingPage.tsx`,
  `web/src/ManagePage.tsx`, `web/src/draft.ts`, `web/src/i18n.ts`
- Modify: `web/src/components/AccountFooter.tsx`,
  `web/src/components/DeleteAccountSheet.tsx`,
  `web/src/components/SignOutSheet.tsx`,
  `web/src/components/YourInvitations.tsx`
- Modify: `web/src/components/editor/AuthGate.tsx`,
  `web/src/components/editor/SharePanel.tsx`,
  `web/src/components/editor/icons.tsx`,
  `web/src/components/guest/GuestCta.tsx`,
  `web/src/components/manage/icons.tsx`
- Modify: `web/src/hooks/usePublishing.ts`, `web/src/styles.css`
- Modify: `server/src/email/notification.ts`, `server/src/email/strings.ts`,
  `server/src/unsubscribePage.ts`
- Modify: `web/test/accountUi.test.tsx`, `web/test/GuestCta.test.tsx`,
  `web/test/landingList.test.tsx`, `web/test/SharePanel.test.tsx`,
  `web/test/YourInvitations.test.tsx`, `server/test/email.test.ts`

This is wider than the spec's file list. The spec's sweep missed
`YourInvitations`, `usePublishing`, `editor/icons`, `GuestCta`,
`unsubscribePage` and six test files. The spec's rule covers them and its
verification gate would fail without them.

**Interfaces:**
- Consumes: `state.json` `stayedInDs`. Citations of those sets are skipped,
  because they are still true.

- [ ] **Step 1: Write the replacement script**

Create `.design-sync/.cache/split/repoint.mjs`:

```js
// One-off: repoint citations of screen sets that moved from the E-invitation
// DS to the E-invitation design project. Two passes: validate every entry
// (old text occurs exactly once), then write. Nothing is written if any entry
// fails. Usage: node repoint.mjs [--dry]
import { readFileSync, writeFileSync } from "node:fs";

const state = JSON.parse(readFileSync(".design-sync/.cache/split/state.json", "utf8"));
const skip = new Set(state.stayedInDs);
const dry = process.argv.includes("--dry");

// [set, file, old, new]
const R = [
  // auth-gate
  ["auth-gate", "web/src/draft.ts", "The DS `AuthGateSpec`", "The design project's `AuthGateSpec`"],
  ["auth-gate", "web/src/i18n.ts", "verbatim from the DS `AuthGateSpec`,", "verbatim from the design project's `AuthGateSpec`,"],
  ["auth-gate", "web/src/components/editor/AuthGate.tsx", "(adr-014 §2, DS `templates/auth-gate`)", "(adr-014 §2, design project `screens/auth-gate`)"],
  ["auth-gate", "web/src/hooks/usePublishing.ts", "(adr-014 §2, DS\n *  `AuthGateStates`)", "(adr-014 §2, design\n *  project `AuthGateStates`)"],
  ["auth-gate", "web/src/styles.css", "From the \"auth-gate\" template in the E-invitation\n   DS project.", "From the \"auth-gate\" screens in the E-invitation\n   design project."],
  ["auth-gate", "CLAUDE.md", "The sign-in UI is built from three DS template sets:", "The sign-in UI is built from three template sets in the E-invitation design project:"],
  // landing-page
  ["landing-page", "web/src/LandingPage.tsx", "identity** (DS\n  // `LandingListIsAccount`).", "identity** (design\n  // project `LandingListIsAccount`)."],
  ["landing-page", "web/src/LandingPage.tsx", "(DS LandingAccountNotify)", "(design project LandingAccountNotify)"],
  ["landing-page", "web/src/LandingPage.tsx", "Reading order per the DS Returning template:", "Reading order per the design project's Returning board:"],
  ["landing-page", "web/src/LandingPage.tsx", "asks first (DS `LandingListIsAccount`).", "asks first (design project `LandingListIsAccount`)."],
  ["landing-page", "web/src/i18n.ts", "exist (DS `LandingListIsAccount`).", "exist (design project `LandingListIsAccount`)."],
  ["landing-page", "web/src/components/AccountFooter.tsx", "§7, DS `LandingSignedInStates`", "§7, design project `LandingSignedInStates`"],
  ["landing-page", "web/src/components/DeleteAccountSheet.tsx", "(adr-014 §9, DS `LandingSignedInStates`)", "(adr-014 §9, design project `LandingSignedInStates`)"],
  ["landing-page", "web/src/components/DeleteAccountSheet.tsx", "per the DS board:", "per the design-project board:"],
  ["landing-page", "web/src/components/SignOutSheet.tsx", "(DS `LandingListIsAccount`, case 2)", "(design project `LandingListIsAccount`, case 2)"],
  ["landing-page", "web/src/components/YourInvitations.tsx", "\"landing-page\" DS Returning template)", "\"landing-page\" design-project Returning board)"],
  ["landing-page", "web/src/components/YourInvitations.tsx", "identity** (DS\n * `LandingListIsAccount`)", "identity** (design\n * project `LandingListIsAccount`)"],
  ["landing-page", "web/src/styles.css", "(adr-014 §9, DS\n   \"LandingSignedInStates\")", "(adr-014 §9, design\n   project \"LandingSignedInStates\")"],
  ["landing-page", "web/src/styles.css", "(adr-015 §7, DS LandingAccountNotify)", "(adr-015 §7, design project LandingAccountNotify)"],
  ["landing-page", "web/test/accountUi.test.tsx", "// adr-014, DS `LandingSignedInStates`:", "// adr-014, design project `LandingSignedInStates`:"],
  ["landing-page", "web/test/accountUi.test.tsx", "per the DS board —", "per the design-project board —"],
  ["landing-page", "web/test/accountUi.test.tsx", "switch (DS\n// LandingAccountNotify)", "switch (design\n// project LandingAccountNotify)"],
  ["landing-page", "web/test/accountUi.test.tsx", "(DS `LandingListIsAccount`, case 2)", "(design project `LandingListIsAccount`, case 2)"],
  ["landing-page", "web/test/landingList.test.tsx", "identity (DS\n  // `LandingListIsAccount`)", "identity (design\n  // project `LandingListIsAccount`)"],
  ["landing-page", "web/test/landingList.test.tsx", "(DS `LandingListIsAccount`, case 1)", "(design project `LandingListIsAccount`, case 1)"],
  ["landing-page", "web/test/YourInvitations.test.tsx", "(DS `LandingListIsAccount`)", "(design project `LandingListIsAccount`)"],
  ["landing-page", "CLAUDE.md", "(§1, amended; DS `LandingListIsAccount`)", "(§1, amended; design project `LandingListIsAccount`)"],
  // brand-name (the INVITO quotations come from the screen mockups)
  ["brand-name", "CLAUDE.md", "in quotations from the DS on purpose", "in quotations from the design mockups on purpose"],
  // share-panel
  ["share-panel", "web/src/components/editor/SharePanel.tsx", "(adr-010 §3, \"share-panel\" DS template)", "(adr-010 §3, \"share-panel\" design-project screens)"],
  ["share-panel", "web/src/components/editor/SharePanel.tsx", "\"Show\" (DS\n * `ShareSignedIn`)", "\"Show\" (design\n * project `ShareSignedIn`)"],
  ["share-panel", "web/src/hooks/usePublishing.ts", "(DS `ShareSignedIn`)", "(design project `ShareSignedIn`)"],
  ["share-panel", "web/src/styles.css", "/* From the \"share-panel\" template in the E-invitation DS project.", "/* From the \"share-panel\" screens in the E-invitation design project."],
  ["share-panel", "web/src/styles.css", "(adr-014 §5, DS \"ShareSignedIn\")", "(adr-014 §5, design project \"ShareSignedIn\")"],
  ["share-panel", "web/test/SharePanel.test.tsx", "// adr-014 §5 / DS `ShareSignedIn`.", "// adr-014 §5 / design project `ShareSignedIn`."],
  // rsvp-notifications
  ["rsvp-notifications", "web/src/components/editor/icons.tsx", "The DS carries one envelope glyph", "The design project carries one envelope glyph"],
  ["rsvp-notifications", "server/src/email/notification.ts", "// Built from the DS `templates/rsvp-notifications/NotifyEmail` mockup.", "// Built from `screens/rsvp-notifications/NotifyEmail` in the design project."],
  ["rsvp-notifications", "server/src/email/strings.ts", "(adr-015 §9), from the DS\n// `templates/rsvp-notifications` mockups.", "(adr-015 §9), from the design project's\n// `screens/rsvp-notifications` mockups."],
  ["rsvp-notifications", "server/src/email/strings.ts", "(DS NotifyEmail)", "(design project NotifyEmail)"],
  ["rsvp-notifications", "server/src/unsubscribePage.ts", "(DS NotifyUnsub)", "(design project NotifyUnsub)"],
  ["rsvp-notifications", "server/src/unsubscribePage.ts", "in the DS this means", "in the design project this means"],
  ["rsvp-notifications", "web/src/styles.css", "(DS \"NotifyLine\" §4)", "(design project \"NotifyLine\" §4)"],
  ["rsvp-notifications", "web/src/styles.css", "(adr-015 §7, DS \"rsvp-notifications/NotifyLine\")", "(adr-015 §7, design project \"rsvp-notifications/NotifyLine\")"],
  ["rsvp-notifications", "web/test/SharePanel.test.tsx", "(DS NotifyLine §3)", "(design project NotifyLine §3)"],
  ["rsvp-notifications", "server/test/email.test.ts", "(DS NotifyEmail)", "(design project NotifyEmail)"],
  // guest-rsvp
  ["guest-rsvp", "web/src/GuestPage.tsx", "// Visuals follow templates/guest-rsvp in the E-invitation DS project:", "// Visuals follow screens/guest-rsvp in the E-invitation design project:"],
  ["guest-rsvp", "web/src/styles.css", "/* From the \"guest-rsvp\" template in the E-invitation DS project:", "/* From the \"guest-rsvp\" screens in the E-invitation design project:"],
  ["guest-rsvp", "web/test/GuestCta.test.tsx", "the DS guest-rsvp intent", "the design project's guest-rsvp intent"],
  // guest-rsvp-extras
  ["guest-rsvp-extras", "web/src/components/guest/GuestCta.tsx", "The DS\n * guest-rsvp template states", "The design\n * project's guest-rsvp screens state"],
  ["guest-rsvp-extras", "web/src/styles.css", "§7, DS templates/guest-rsvp-extras/GuestCta)", "§7, design project screens/guest-rsvp-extras/GuestCta)"],
  // host-manage
  ["host-manage", "web/src/ManagePage.tsx", "the \"host-manage\" template in the E-invitation DS project:", "the \"host-manage\" screens in the E-invitation design project:"],
  ["host-manage", "web/src/i18n.ts", "\"host-manage\"\n// template in the E-invitation DS project:", "\"host-manage\"\n// screens in the E-invitation design project:"],
  ["host-manage", "web/src/components/manage/icons.tsx", "\"host-manage\" template\n// in the E-invitation DS project.", "\"host-manage\" screens\n// in the E-invitation design project."],
  ["host-manage", "web/src/styles.css", "/* From the \"host-manage\" template in the E-invitation DS project.", "/* From the \"host-manage\" screens in the E-invitation design project."],
  // creation-chat
  ["creation-chat", "web/src/styles.css", "/* The \"creation-chat\" template in the E-invitation DS project was this\n   section's first spec. adr-018 superseded it, and the DS project marks it so;", "/* The \"creation-chat\" screens in the E-invitation design project were this\n   section's first spec. adr-018 superseded them, and the project marks them so;"],
];

const files = new Map();
const errors = [];
let applied = 0;
for (const [set, file, from, to] of R) {
  if (skip.has(set)) continue;
  if (!files.has(file)) files.set(file, readFileSync(file, "utf8"));
  const text = files.get(file);
  const n = text.split(from).length - 1;
  if (n !== 1) { errors.push(`${file}: expected 1 of ${JSON.stringify(from)}, found ${n}`); continue; }
  files.set(file, text.replace(from, () => to));
  applied++;
}
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
if (!dry) for (const [file, text] of files) writeFileSync(file, text);
console.log(`${dry ? "would apply" : "applied"} ${applied} replacements in ${files.size} files`);
```

- [ ] **Step 2: Dry-run it**

Run: `node .design-sync/.cache/split/repoint.mjs --dry`

Expected (nothing in `stayedInDs`):
`would apply 54 replacements in 26 files`, exit 0.

Any `expected 1 of …, found N` line means the file drifted from this plan.
Open that line in the file and fix the table entry, never the file. Re-run until
it passes.

- [ ] **Step 3: Apply it**

Run: `node .design-sync/.cache/split/repoint.mjs`

Expected: `applied 54 replacements in 26 files`.

Then run `git diff --stat`. Expected: 26 files, each with equal insertions and
deletions (the line counts don't change).

- [ ] **Step 4: Add the "Design projects" paragraph to `CLAUDE.md`**

Insert this paragraph immediately before the line that begins `Web structure:`,
with a blank line on each side:

```markdown
Design projects (2026-10-02 split): two Claude Design projects, and "DS" in this repo means only the first. **E-invitation DS** is the design system — `InvitationPreview`, this stylesheet's closure and its tokens, and the `card-background`/`lang-switcher` component specs — and the only `/design-sync` target (`.design-sync/config.json`). **E-invitation** is a regular design project that binds the DS and holds every product screen under `screens/<set>/`; comments cite its boards as `design project \`Name\``, never as DS. Which set lives where, and how the binding is kept fresh, is in `.design-sync/NOTES.md`.
```

The spec doesn't list this paragraph. It is added because the citation rule is
otherwise written down only in NOTES, which an agent writing a component
comment never reads.

- [ ] **Step 5: Run the citation gate**

Run:

```bash
grep -rnE "\bDS\b|E-invitation DS" CLAUDE.md web/src web/test server/src server/test | cut -c1-160
```

Expected: exactly these hits, all of them system citations:
- `web/src/GalleryHubPage.tsx:36`: the DS contract in `InvitationPreview.d.ts`
- `web/src/components/InvitationPreview.tsx:51`: the DS card-background spec
- `web/src/components/LangSwitcher.tsx:12`: the "lang-switcher" template in the
  E-invitation DS project
- `web/src/styles.css:8`, `:602`, `:1162`, `:1188`, `:1215`: the sync closure,
  the DS-synced card, the card-background recipes, the split decision, the token
  panel
- `server/src/email/notification.ts:83`: the DS's Playfair
- `CLAUDE.md`, by content: the AI background layer line (`templates/card-background`),
  the Invitation gallery line (`InvitationPreview.d.ts`), and the new Design
  projects paragraph

Any other hit cites a moved set: add it to the table in Step 1 and re-run from
Step 2. A set in `stayedInDs` keeps its hits, and those are expected too.

- [ ] **Step 6: Run the repo gates**

Run each:

```bash
pnpm lint
```

```bash
pnpm typecheck
```

```bash
pnpm test
```

Expected: all three exit 0. `web/test/styles.test.ts` parses `styles.css`'s
section banners, and none of them changed.

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md web/src web/test server/src server/test
git commit -F - <<'EOF'
Cite the screens where they now live: the E-invitation design project

The product screens moved out of the E-invitation DS into a regular design
project that binds it, so "DS" in a comment now means the system only. 54
citations repointed by exact-once replacement; the system ones (the card,
card-background, lang-switcher, the .d.ts contract, the token panel) stay.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 5: Design-sync docs and adr-018 §9

**Files:**
- Modify: `.design-sync/NOTES.md` (lines 12, 39–41, 77, 81, and the sections at
  50 and 83)
- Modify: `.design-sync/conventions.md` (top, line 18, line 46)
- Modify: `docs/decisions/adr-018-material-system.md` (§9, after line 291)

**Interfaces:**
- Consumes: `state.json`: `dpId`, `dsFolder`, `binding`, `refreshMethod`,
  `designProjectHasManifest`, `moved`, `stayedInDs`.
- Produces: `conventions.md` text that Task 6 ships as the DS `README.md`.

In the texts below, substitute `<dpId>`, `<dsFolder>` and `<refreshMethod>` from
`state.json`. These are runtime values, not placeholders to leave.

- [ ] **Step 1: NOTES, the two-projects paragraph**

Replace line 12 (the bullet that begins
`- The **separate** claude.ai/design project "Design System"`) with:

```markdown
- **Two Claude Design projects since 2026-10-02** (spec: `docs/superpowers/specs/2026-10-02-design-project-split-design.md`). **E-invitation DS** (`53daa9fc-5618-4769-9cff-7fbf338169de`, this sync's target) holds the system only: `InvitationPreview`, the stylesheet and its tokens, and the `card-background` and `lang-switcher` template sets. **E-invitation** (`<dpId>`, a regular project, never a sync target) binds the DS at `_ds/<dsFolder>/` and holds the product screens under `screens/<set>/` and theme ideas under `explorations/`. In this repo "DS" means the system; a screen board is cited as `design project \`Name\``. The older "Design System" project (`d96adb40-4a0f-401c-8e5a-7a518a31b5d5`, the 16 token cards) and the "E-invitation Design System" exploration (`350a2663-afbf-4816-8ab4-e51a7bbabb71`) were retired the same day. `scripts/build-design-cards.mjs` fed the first and now has no target.
```

If `stayedInDs` is non-empty, append this sentence to the paragraph, with the
set names filled in: `The split is partial: <sets> failed verification and are
still under the DS's templates/.`

- [ ] **Step 2: NOTES, the binding**

Insert this bullet directly after Step 1's, choosing the variant by
`state.binding`.

Live:

```markdown
- **The binding is live**: a file written to the DS appeared under `_ds/<dsFolder>/` in the design project with no action there (probe, 2026-10-02). A DS resync reaches the screens by itself.
```

Snapshot:

```markdown
- **The binding is a snapshot**: a file written to the DS did not appear under `_ds/<dsFolder>/` in the design project (probe, 2026-10-02). **After every DS sync, refresh it** — <refreshMethod> — or the screens render against the previous stylesheet. That is the two-month sync gap below, one level further out. Check by grepping the bound `_ds_bundle.css` for a comment that changed in the sync.
```

- [ ] **Step 3: NOTES, the CSS-only paragraph**

In the paragraph that ends
`` `templates/` loads the bundle through `ds-base.js`, so mockups that use
app classes render against the new CSS from now on. `` (lines 39–41), replace
that sentence with:

```markdown
`ds-base.js` loads the bundle, so mockups that use app classes render against the new CSS from now on — since the 2026-10-02 split, through the design project's binding (see above).
```

- [ ] **Step 4: NOTES, the "never sweep" bullet**

Replace the whole bullet that begins
`- **The DS project holds far more than this sync produces — never sweep it.**`
(line 81) with:

```markdown
- **The DS project holds more than this sync produces — never sweep it.** Since the 2026-10-02 split the product screens live in the E-invitation design project, but the DS still carries two hand-authored template sets (`templates/card-background`, `templates/lang-switcher`) plus app-generated `Canvas.dc.html`, `support.js`, `_ds_manifest.json`, `_adherence.oxlintrc.json` and `uploads/`. None are converter output. With a healthy anchor this is safe automatically (`deletePaths` only ever names our own paths). **The trap is the no-anchor branch of §5**, which says to review `list_files` for "files this build doesn't produce" and put them in `deletes` — applied literally here that deletes the system's two template sets. If the anchor is ever missing, pass `deletes: []` and re-anchor instead. **The design project is never a sync target**: nothing in this pipeline writes to `<dpId>`.
```

- [ ] **Step 5: NOTES, the stale layout figure in Re-sync risks**

In the bullet at line 77, replace the sentence that begins
`` The 2026-07-28 pass found a stale "~520 px" column claim `` and runs to the
end of the bullet with:

```markdown
The 2026-07-28 pass found a stale "~520 px" column claim with nothing behind it, restated as ~590 px from `.page`/`.workspace`; adr-018 then replaced that grid with the glass editor, and the 2026-10-02 pass found `.page`/`.workspace` still in the stylesheet but rendered by nothing. The figure is now 460 px, from `.cc-preview-inner { width: min(460px, 100%) }` inside `.cc-preview`'s 28 px padding. Re-derive it if those two rules change.
```

- [ ] **Step 6: NOTES, scope the two template-set procedures**

Directly under the heading `## Marking a template set superseded (2026-10-02)`,
insert:

```markdown
`creation-chat` has since moved to the E-invitation design project
(`screens/creation-chat/`, banner kept) with the other screens. The procedure
below applies to a **system** set superseded in the DS. A superseded screen in
the design project needs only step 3's banner, since a regular project has no
template list.
```

Directly under the heading `## Registering a new template set (learned 2026-09-12)`,
insert (choose by `designProjectHasManifest`):

`false`:

```markdown
This applies to **system** sets in the DS only. A new product screen goes in
the E-invitation design project as a plain canvas under `screens/<name>/`; a
regular project has no `_ds_manifest.json` to register it in.
```

`true`:

```markdown
This applies to **system** sets in the DS only. A new product screen goes in
the E-invitation design project as a plain canvas under `screens/<name>/`. That
project has an app-managed `_ds_manifest.json` of its own: check whether a new
canvas appears before hand-editing it.
```

- [ ] **Step 7: conventions.md, say what this DS is**

Insert after line 1 (`# inv-app invitation design system — conventions`),
with a blank line on each side:

```markdown
This design system is **the system only**: the invitation card, its closed design tokens, and the app's material (the adr-018 `:root` tokens and glass). INVINTO's product screens — landing, editor, share panel, guest page, host dashboard, notifications, gallery — are designed in the separate **E-invitation** design project, which binds this DS. Don't look for screen mockups here and don't add them; the two template sets kept here (`card-background`, `lang-switcher`) are component specs.
```

- [ ] **Step 8: conventions.md, the chrome tokens**

Replace this sentence on line 18:

```markdown
If you style your own surrounding UI, reuse those custom properties from a `.inv` context or the app-chrome palette in `styles.css` (page background `#f6f5f2`, ink `#23211d`, muted `#6b6659`).
```

with:

```markdown
If you style your own surrounding UI, reuse those custom properties from a `.inv` context, or the material tokens at the top of `styles.css` (`:root`): `--app-bg` page background, `--ground`/`--surface` for the editor's ground and its cards, `--ui-ink` ink, `--ink-muted` secondary text, `--ui-accent` accent. Read the product's ink and accent through `--ui-ink`/`--ui-accent`, never `--ink`/`--accent`: every `palette-*` class redefines those on the element that carries it.
```

Confirm the values before saving:

```bash
grep -nE "^\s*--(app-bg|ground|surface|ui-ink|ink-muted|ui-accent):" web/src/styles.css
```

Expected: `#f6f5f2`, `#f3ece2`, `#ffffff`, `#23211d`, `#6b6659`, `#b3592e`.

- [ ] **Step 9: conventions.md, the column figure**

Replace line 46's last sentence:

```markdown
For reference, the app renders it in a ~590 px column (`.page` caps at 1080 px; `.workspace` splits `minmax(280px, 420px) 1fr` with a 28 px gap, collapsing to one column under 800 px).
```

with:

```markdown
For reference, the editor renders it up to 460 px wide (`.cc-preview-inner`: `width: min(460px, 100%)`), centred on the palette-tinted ground with 28 px of padding.
```

- [ ] **Step 10: adr-018 §9 amendment**

Insert after the paragraph ending
`` `styles.css`'s Creation chat section no longer cites it as its source. ``
(line 291), before the `NOTES.md also records…` paragraph:

```markdown
**Amended 2026-10-02: the screens left the DS project.** The E-invitation DS now
holds the system only, and every product screen lives in a regular
**E-invitation** design project that binds it
([spec](../superpowers/specs/2026-10-02-design-project-split-design.md)). This
section's material spec still belongs to the DS when it is built. "The
segmented toolbar and its sheets" are screen work and belong to the design
project, and so does `creation-chat`, superseded banner and all. Citations of
screen boards in the code moved with them; read "DS project" above as it was
true on the day it was written.
```

- [ ] **Step 11: Check and commit**

Run: `pnpm lint`

Expected: exit 0. Biome ignores `.design-sync/` per `biome.jsonc:11`, and
Markdown is not linted, so this only confirms nothing else moved.

```bash
git add .design-sync/NOTES.md .design-sync/conventions.md docs/decisions/adr-018-material-system.md
git commit -F - <<'EOF'
Record the split in the design-sync notes, conventions and adr-018

NOTES gains both project ids, the binding's freshness, and a restated
never-sweep rule; conventions.md (the DS README the design agent reads first)
now says the DS is the system only, names the material tokens instead of
three pre-adr-018 hexes, and drops a column figure from a grid nothing
renders. adr-018 §9 notes that its toolbar and sheets are now screen work.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 6: Re-ship the DS

**Files:**
- Modify (gitignored): `.design-sync/.cache/remote-sync.json`, `ds-bundle/**`
- Remote: the DS converter output (`README.md`, `_ds_bundle.css`, `styles.css`, …)

**Interfaces:**
- Consumes: Task 4's `styles.css` comments, Task 5's `conventions.md`, and
  Task 3's pruned DS.
- Produces: a DS whose README and stylesheet match the repo, and a manifest
  whose `templates` still lists two sets.

- [ ] **Step 1: Fetch the remote anchor**

`get_file` `_ds_sync.json` from the DS. Write its `content` verbatim to
`.design-sync/.cache/remote-sync.json`.

- [ ] **Step 2: Run the converter**

Run from the worktree root:

```bash
node C:/projects/inv-app/.ds-sync/resync.mjs --config .design-sync/config.json --node-modules web/node_modules --entry web/src/components/InvitationPreview.tsx --out ./ds-bundle --remote .design-sync/.cache/remote-sync.json
```

Expected: exit 0. If it dies with `EPERM … rm '…ds-bundle'`, run
`rm -rf ds-bundle` and run it again (NOTES: a chromium handle from the last
render check).

- [ ] **Step 3: Read the verdict**

Run:

```bash
node -e "const v=require('./ds-bundle/.resync-verdict.json');console.log(JSON.stringify({ok:v.ok,anchor:v.anchor,pending:v.verification.pendingGrade,del:v.upload&&v.upload.deletePaths,any:v.upload&&v.upload.any}))"
```

Expected: `ok:true`, `anchor:"ok"`, `pending:[]`, `any:true`, and no
`deletePaths` entry starting with `templates/`.

- `pending` non-empty: stop and tell the user. Only the README and stylesheet
  comments changed, so a grade request means something else moved.
- A `templates/` delete path: stop. Do not upload.

Compare any validate warn lines against NOTES' "Known render warns". The
`[FONT_REMOTE]` warn is expected.

- [ ] **Step 4: Check the shipped bytes**

Run each:

```bash
grep -c "@kind" ds-bundle/_ds_bundle.css
```

```bash
grep -c "E-invitation design project" ds-bundle/_ds_bundle.css
```

```bash
grep -c "the system only" ds-bundle/README.md
```

Expected:
- `@kind`: ≥ 7.
- `E-invitation design project`: ≥ 5 (Task 4's `styles.css` comments).
- `the system only`: ≥ 1.

- [ ] **Step 5: Upload**

1. `finalize_plan` on the DS with `localDir:"ds-bundle"`, `deletes` set to the
   verdict's `deletePaths` (expected `[]`), and `writes`:

   ```json
   ["README.md","_ds_bundle.css","_ds_bundle.js","_ds_needs_recompile","_ds_sync.json","_preview/InvitationPreview.js","_vendor/react-dom.js","_vendor/react.js","components/general/InvitationPreview/InvitationPreview.d.ts","components/general/InvitationPreview/InvitationPreview.html","components/general/InvitationPreview/InvitationPreview.jsx","components/general/InvitationPreview/InvitationPreview.prompt.md","styles.css"]
   ```

2. `write_files`, one entry per path with `localPath` equal to the path.

This is the same 13-file list as the last full upload
(`.design-sync/.cache/upload-list.txt`). Re-uploading unchanged bytes is
harmless.

- [ ] **Step 6: Check the remote**

`get_file` `README.md` from the DS. Confirm it contains "the system only".

- [ ] **Step 7: Check the manifest after the recompile**

`_ds_needs_recompile` asks the app to rebuild the manifest. Wait ~60 s, then
`get_file` `_ds_manifest.json`. Expected:
- `templates` holds exactly the `card-background` and `lang-switcher` entries
  (plus any `stayedInDs`).
- `tokens` now includes `--ground` and `--glass-alpha`.

If `templates` came back with moved sets, redo Task 3 Steps 1–4 (manifest
write only; the files are already gone).

- [ ] **Step 8: Refresh the binding if it is a snapshot**

If `state.binding` is `"snapshot"`, ask the user to refresh the design
project's binding (`refreshMethod`). Then `get_file`
`_ds/<dsFolder>/_ds_bundle.css` from `<dpId>`. Expected: it contains
"E-invitation design project".

If `binding` is `"live"`, run the same check without asking. A miss means the
probe was wrong. Update NOTES' binding bullet to the snapshot variant, ask the
user for the refresh method, and commit that change.

---

### Task 7: Retire, remember, and close out

**Files:**
- Modify: `C:\Users\Oleh\.claude\projects\C--projects-inv-app\memory\design-system-sync.md`
- Modify: `C:\Users\Oleh\.claude\projects\C--projects-inv-app\memory\MEMORY.md` (one line)

**Interfaces:**
- Consumes: `state.json` and Tasks 2–6 being done.

- [ ] **Step 1: Ask the user to retire the two old projects**

> Everything is moved and verified. Please delete these two projects in Claude
> Design: **Design System** (the 16 token cards) and **E-invitation Design
> System** (its concepts canvas is now `explorations/Invitation Concepts.dc.html`
> in E-invitation).

Then call `DesignSync` `list_projects`. Expected: `d96adb40-…` is gone.
`350a2663` is a regular project and never appears there, so ask the user to
confirm that one.

- [ ] **Step 2: Rewrite the memory**

Overwrite `design-system-sync.md`:

```markdown
---
name: design-system-sync
description: "Claude Design project IDs after the 2026-10-02 split (DS vs E-invitation design project) and where the re-sync flow lives"
metadata:
  type: reference
---

Since 2026-10-02 there are two Claude Design projects (spec `docs/superpowers/specs/2026-10-02-design-project-split-design.md`):

- **E-invitation DS** (`53daa9fc-5618-4769-9cff-7fbf338169de`, design-system type): the system only — InvitationPreview, styles.css closure + tokens, and the `card-background` / `lang-switcher` template sets. The only `/design-sync` target, pinned in `.design-sync/config.json`; re-sync flow in `.design-sync/NOTES.md`.
- **E-invitation** (`<dpId>`, regular project): binds the DS at `_ds/<dsFolder>/` (<binding>), holds product screens under `screens/<set>/` and theme ideas under `explorations/`. Never a sync target.

In repo comments "DS" means the system; screen boards are cited as `design project \`Name\``.

Retired the same day: "Design System" (`d96adb40-…`, 16 token cards from `scripts/build-design-cards.mjs`, which now has no target) and "E-invitation Design System" (`350a2663-…`, concepts canvas).
```

In `MEMORY.md`, replace the line
`- [Design System sync](design-system-sync.md) — Claude Design project ID + card re-sync flow via scripts/build-design-cards.mjs`
with:
`- [Design system sync](design-system-sync.md) — two Claude Design projects since 2026-10-02: E-invitation DS (system, sync target) + E-invitation (screens)`

- [ ] **Step 3: Final verification**

Run:

```bash
pnpm test && pnpm typecheck && pnpm lint && git status --short && git log --oneline -4
```

Expected:
- All green.
- A clean tree: only gitignored state was touched outside the two commits.
- The log shows the spec, the plan, Task 4's commit and Task 5's commit (plus
  Task 6 Step 8's NOTES fix, if it was needed).

Also confirm:
- DS `list_files`: `templates/` is only `card-background/` and `lang-switcher/`.
- `<dpId>` `list_files`: 11 `screens/` sets and `explorations/`.

- [ ] **Step 4: Report**

Tell the user:
- which path moved the files (native or tool);
- whether the binding is live or a snapshot, and what that means for each
  future sync;
- the sets in `stayedInDs`, if any;
- the two commits.

Then offer the two follow-ups this work turned up but did not do:
- delete the dead `.page`/`.workspace` rules from `styles.css` (nothing renders
  them);
- delete or repurpose `scripts/build-design-cards.mjs` (its project is gone).
