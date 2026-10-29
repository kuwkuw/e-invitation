# «Ще не знаю»: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A third reply, «Ще не знаю» (adr-019 step 7, §9.1). A guest can answer yes, no or not sure yet, and a host sees the maybe beside the other two everywhere replies are counted:
- the dashboard's bar, counts and list;
- the CSV;
- the landing row;
- the first reply email.

**A maybe never adds to the headcount.**

**Architecture:** Schema first, in one PR, in tasks that each leave the suite green.
1. **Server and the `types.ts` mirror.** The server learns the answer before any client can send it.
2. **The guest's reply card.**
3. **The host's surfaces.**
4. **Docs.**
5. **A look, then the PR.**

The stored RSVP keeps `attending: boolean` and gains `answer: "yes" | "no" | "maybe"` beside it (decision 1). Every reader goes through one function, `answerOf`, so a record written before this step and one written after are read the same way.

**Tech Stack:** zod v4 and Fastify on the server. React 19, CSS custom properties, Vitest with jsdom and `@testing-library/react`, Biome.

**Spec:** [adr-019](../../../decisions/adr-019-paper-direction.md) §9.1, its Consequences ("the one step here that a careless implementation could make irreversible") and its revisit triggers ("maybes outnumber yeses"). The long form is the [paper-direction spec](../specs/2026-10-21-paper-direction-design.md) §9.1.

**Order:** step 7 follows step 6, at the owner's choice. Step 5, the editor, still waits on its two design-project boards (§7.5). Nothing here depends on step 5. Step 5's header link «16 буде · 3 ні» will read the maybe from the same `/rsvps` summary when it's built.

## Global Constraints

- **No migration step, and no rewrite of a stored record.** Records written before this step stay byte-for-byte as they are. `answerOf` reads them; nothing re-saves them (`CLAUDE.md`, Reviewing: stored data).
- **A record written by this step must read correctly on `main` as it is today.** That is the revert path, because Northflank deploys every push to `main`. Today's reader is `summarizeRsvps`, the CSV and the list. They test `attending` for truthiness, so `attending` stays a boolean that is true for a yes only. Task 1 has a test for this.
- **The card is untouched.** `InvitationPreview.tsx`, the `Invitation card` section and the OG renderer stay byte-identical. Nothing here touches the paper materials' placement either.
- **The email stays count-only** (adr-015 §3). No answer, name or note enters it.
- **`schemas.ts` and `types.ts` change in one pass** (`CLAUDE.md`, hand-kept mirrors).
- No raw hex in a converted section or a guest, landing or manage component. New colours are `:root` tokens with contrast rows.
- Every user-visible string is in `GUEST`, `MANAGE` or `LANDING` in both languages, with the same shape.
- Branch `feat/maybe-reply` from `main`.
- Run one server file with `pnpm --filter inv-app-server exec vitest run test/<file>` and one web file with `pnpm --filter inv-app-web exec vitest run test/<file>`. Run everything with `pnpm build && pnpm test`, and **check the exit code**.
- **Web tests aren't typechecked** (`web/tsconfig.json` includes `src` only). A fixture without `answer` won't fail `tsc`. It fails at runtime, or worse, passes for the wrong reason. Task 1 updates every RSVP fixture builder.

### What this plan decides that adr-019 left open (review these first)

| # | Question | This plan's answer | Why |
|---|---|---|---|
| 1 | "`attending` … becomes a three-value enum" | **`answer` is a new field beside `attending`**, not a replacement. `answer: "yes" \| "no" \| "maybe"` is what the reply was. `attending: boolean` stays, true for a yes only, meaning "counts toward the headcount" | An in-place enum is the irreversible step the ADR's Consequences warns about. Today's reader tests `attending` for truthiness, and `"no"` is truthy: after a revert, every no and maybe written in between would count as a yes, headcount included. Keeping the boolean leaves a reverted reader exactly right for yes and no, with a maybe read as a no. That's the meaning a two-answer reader can give it |
| 2 | Reading records written before this step | `answerOf(rsvp) = rsvp.answer ?? (rsvp.attending ? "yes" : "no")`, applied in `summarizeRsvps`. Every host-facing entry carries a normalized `answer` | One function on one side. `getRecord` doesn't parse with zod, so normalizing has to be explicit. Nothing rewrites the old file |
| 3 | The request | `RsvpRequest` accepts `answer`, or `attending` alone from a client that predates this step, and stores both. The new client sends both too. When both arrive, `answer` wins | A guest page loaded before the deploy still submits. A guest page loaded after it, still open when a revert ships, submits to the old server, whose zod object ignores `answer` and reads `attending` |
| 4 | A party size on a maybe | Hidden, sent as 1, never summed. Only a yes shows the stepper | §9.1: a maybe never counts toward the headcount. "Maybe +2" invites a host to add it |
| 5 | The third tile on a 360 px phone | Yes and no stay side by side as they are. «Ще не знаю» is a full-width tile beneath them, 48 px tall, in the decline tile's quieter ink, with a question-mark icon. It's in the same `radiogroup` | Three equal tiles don't fit about 284 px of card at 1rem bold. The question is still «Ви з нами?», and an equal third tile is how a maybe becomes a soft no (the ADR's revisit trigger) |
| 6 | The thanks card after a maybe | The muted seal and pill a no gets. «Дякуємо, що відповіли». A line pointing at «Змінити відповідь», which is already on the card. The pill «Ви ще вирішуєте». No share action, which stays a yes's | A maybe is a reply that expects a second one, so the card says how to give it |
| 7 | The host's label | «Можливо» / "Maybe" for the list's pill, the count and the CSV | Host labels are short and neutral («Так», «Ні»), and the guest's own words are longer («Буду!», «Не зможу») |
| 8 | Colour | New tokens `--rsvp-maybe` `#86621c` (5.24:1 on `--surface`), `--rsvp-maybe-bg` `#f6efdf` (4.85:1 under it) and `--rsvp-maybe-edge` `#e6d7b5`. The test is the judge, so it moves the value, never the floor | An ochre between the two statuses. `--caution-*` measures close but does another job (the manage-link warning), so it isn't reused (`web/CLAUDE.md`) |
| 9 | Bar and count order | Yes, no, maybe, as §8.2 lists them | The ADR's order. The bar is a proportion, so order carries no meaning beyond consistency |
| 10 | "How many replied" | Yes + no + maybe, in the two places that add it up by hand: the landing row's label and the first reply email | Both say `counts.yes + counts.no` today. A guest list of maybes would read as «без відповідей» and email nobody. `grep -rn "counts.yes + counts.no"` comes back empty after Task 1 |
| 11 | The landing's claim | `guestsPoints[2]` names all three answers | FR-13.11: «Відповідь «так» чи «ні»» stops being the whole truth the day this ships |
| 12 | Guest wishes | A maybe's note is quoted like any live note | It's a live answer (FR-5.5). The pull-quote doesn't care what the answer was |

**New copy, for review.** Every string is in both languages.

| Key | Українська | English |
|---|---|---|
| `GUEST.maybe` | Ще не знаю | Not sure yet |
| `GUEST.maybeTitle` | Дякуємо, що відповіли | Thanks for replying |
| `GUEST.maybeLater` | Коли знатимете напевно — змініть відповідь тут. | Once you know, change your reply here. |
| `GUEST.maybePill` | Ви ще вирішуєте | You're still deciding |
| `MANAGE.maybe` | Можливо | Maybe |
| `MANAGE.tileMaybe` | Можливо | Maybe |
| `MANAGE.csv.maybe` | Можливо | Maybe |
| `LANDING.guestsPoints[2]` | Відповідь «так», «ні» чи «ще не знаю» — і ви одразу її бачите | Yes, no or not sure yet — and you see the reply straight away |

## Review Focus

1. **The revert path.** A record this step writes is read on today's `main` with the right headcount, and with yes and no right. A maybe reads as a no there.
2. **Old records.** A file with `attending` only loads, reads yes and no, and is never re-saved by a read.
3. **Cached clients, both directions.** An old guest page posting `{ attending }` is accepted. A new one posting `{ answer, attending }` to an old server would be too.
4. **The headcount.** A maybe never adds to `guests`. It carries no party size and shows no «+N».
5. **"Replied" totals** include the maybe on the landing row and in the first email.
6. **360 px:** three choices in the reply card, the bar's three segments and the three counts, with no horizontal scroll.

---

## Task 1: The answer on the server, and its mirror

**Files:**
- Modify: `server/src/schemas.ts`, `server/src/rsvpSummary.ts`, `server/src/email/replyNotifier.ts`, `web/src/types.ts` and `web/src/components/YourInvitations.tsx` (`repliesLabel`)
- Test: `server/test/publish.test.ts`, `server/test/counts.test.ts`, `server/test/replyNotifier.test.ts`, and a new `server/test/rsvpAnswer.test.ts`. The web fixture builders in `web/test/managePage.test.tsx`, `csv.test.ts` and `responseGroups.test.ts` gain `answer`. Add `YourInvitations.test.tsx` cases.

**Interfaces:**
- `server/src/schemas.ts`:
  - `RsvpAnswer = z.enum(["yes", "no", "maybe"])`.
  - `RsvpRequest` accepts `answer?` and `attending?`, refines that one is present, and transforms to `{ name, answer, attending: answer === "yes", guests_count, note }`.
  - `Rsvp` (stored) has `attending: boolean` and `answer?: RsvpAnswer`, optional because old records lack it.
  - `RsvpSummaryEntry` has `answer: RsvpAnswer`, required.
  - `RsvpCounts` gains `maybe`.
- `server/src/rsvpSummary.ts` exports `answerOf(rsvp: Rsvp): RsvpAnswer`.
- `web/src/types.ts` mirrors all of it:
  - `RsvpAnswer`;
  - `RsvpInput` with `answer` and `attending`;
  - `RsvpEntry` with `answer` required and `attending` documented as "a yes only, kept for a reader that predates the maybe";
  - `RsvpCounts.maybe`.
- No web component reads `attending` after Task 3. Until then they still work, because `attending` stays exactly what it was for yes and no.

- [ ] **Step 1: Write the tests**

`server/test/rsvpAnswer.test.ts` builds the app with its own `DATA_DIR`, as `publish.test.ts` does:

```ts
describe("the maybe reply on the server (adr-019 §9.1)", () => {
  it("counts a maybe beside yes and no, and never in the headcount", async () => {
    const { id, manage_token } = await publish();
    for (const payload of [
      { name: "Ірина", answer: "yes", guests_count: 3 },
      { name: "Тарас", answer: "maybe", guests_count: 4 },
      { name: "Марко", answer: "no" },
    ]) {
      expect((await rsvp(id, payload)).statusCode).toBe(200);
    }
    const summary = await rsvps(id, manage_token);
    expect(summary.counts).toEqual({ yes: 1, no: 1, maybe: 1, guests: 3 });
    expect(summary.rsvps.map((r: { answer: string }) => r.answer)).toEqual(["yes", "maybe", "no"]);
  });

  // The revert path. Today's reader tests `attending` for truthiness; what
  // this step writes must read right there.
  it("stores a maybe so a reader that predates it counts it as a no", async () => {
    const { id } = await publish();
    await rsvp(id, { name: "Тарас", answer: "maybe" });
    const stored = JSON.parse(readFileSync(join(dataDir, `${id}.json`), "utf8"));
    expect(stored.rsvps[0]).toMatchObject({ answer: "maybe", attending: false });
  });

  it("reads a record written before the maybe existed, and leaves it as it was", async () => {
    const id = "legacy01";
    const before = {
      id, manage_token: TOKEN, versions: [invitation], created_at: T, updated_at: T,
      rsvps: [
        { name: "Ірина", attending: true, guests_count: 2, note: null, created_at: T },
        { name: "Марко", attending: false, guests_count: 1, note: null, created_at: T },
      ],
    };
    const path = join(dataDir, `${id}.json`);
    writeFileSync(path, JSON.stringify(before, null, 2));
    const summary = await rsvps(id, TOKEN);
    expect(summary.rsvps.map((r: { answer: string }) => r.answer)).toEqual(["yes", "no"]);
    expect(summary.counts).toEqual({ yes: 1, no: 1, maybe: 0, guests: 2 });
    expect(readFileSync(path, "utf8")).toBe(JSON.stringify(before, null, 2));
  });

  // A guest page loaded before the deploy, submitting after it.
  it("accepts a reply from a client that sends attending alone", async () => {
    const { id, manage_token } = await publish();
    expect((await rsvp(id, { name: "Ірина", attending: true, guests_count: 2 })).statusCode).toBe(200);
    expect((await rsvps(id, manage_token)).rsvps[0].answer).toBe("yes");
  });

  it("lets the answer win when a client sends both", async () => {
    const { id, manage_token } = await publish();
    await rsvp(id, { name: "Тарас", answer: "maybe", attending: false });
    expect((await rsvps(id, manage_token)).counts.maybe).toBe(1);
  });

  it("refuses a reply with neither, or with an answer it doesn't know", async () => {
    const { id } = await publish();
    expect((await rsvp(id, { name: "X" })).statusCode).toBe(400);
    expect((await rsvp(id, { name: "X", answer: "perhaps" })).statusCode).toBe(400);
  });
});
```

Elsewhere:
- **Exact counts assertions** gain `maybe: 0`: `publish.test.ts` (lines 124 and 157) and `counts.test.ts` (71, 99 and 130). Their `{ attending }` payloads stay as they are. They're now the cached-client tests.
- **`replyNotifier.test.ts`:** a first email to a host whose only replies are maybes counts them.
- **`YourInvitations.test.tsx`:** a row with `{ yes: 0, no: 0, maybe: 2 }` reads two replies, not «без відповідей».
- **Web fixture builders** set `answer` beside `attending`: `managePage.test.tsx`'s `yesReply`/`noReply`, the entries in `csv.test.ts`, and `responseGroups.test.ts`.

- [ ] **Step 2: Run them and see them fail.**

- [ ] **Step 3: Implement**
- **`schemas.ts`:**
  - The doc comment on `RsvpAnswer` gives decision 1's reason in two sentences and names the revert.
  - The comment on `attending` says it means "counts toward the headcount" and is true for a yes only.
- **`rsvpSummary.ts`:**
  - `answerOf` is beside `groupKey`, with a comment naming the two eras of record.
  - `summarizeRsvps` maps each entry to `{ ...rsvp, answer: answerOf(rsvp), superseded }`.
  - It counts `maybe`. `guests` still sums the yeses only.
- **`replyNotifier.ts`** adds `summary.counts.maybe` to the first send's count.
- **`YourInvitations.tsx`'s `repliesLabel`** adds `counts.maybe`.
- **`types.ts`** mirrors `schemas.ts`, with the same comments.

- [ ] **Step 4: Run both suites** with `pnpm build && pnpm test`. Expected: PASS. No guest or host surface has changed.

- [ ] **Step 5: Commit**

```bash
git commit -m "Store the reply's answer beside attending, and count the maybe (adr-019 §9.1)"
```

## Task 2: «Ще не знаю» on the guest's reply card

**Files:**
- Modify:
  - `web/src/hooks/useRsvpForm.ts`;
  - `web/src/components/guest/RsvpForm.tsx`, `ThanksCard.tsx` and `icons.tsx`;
  - `web/src/GuestPage.tsx`;
  - `web/src/i18n.ts` (`GUEST`, and `LANDING.guestsPoints[2]`);
  - `web/src/styles.css` (`Guest page`).
- Test: `web/test/useRsvpForm.test.ts`, `GuestPage.test.tsx`, `styles.test.ts` and `i18n.test.ts`

**Interfaces:**
- `useRsvpForm` exposes `answer: RsvpAnswer | null` and `setAnswer`, in place of `attending` and `setAttending`.
- `buildRsvpInput({ name, answer, guestsCount, note })` returns `{ name, answer, attending: answer === "yes", guests_count: answer === "yes" ? guestsCount : 1, note }`.
- `ThanksCard` takes `answer` in place of `attending`.

- [ ] **Step 1: Write the tests**

`useRsvpForm.test.ts`:
- `buildRsvpInput` for a maybe sends `{ answer: "maybe", attending: false, guests_count: 1 }`, whatever the stepper held.
- The yes and no cases now assert `answer` too.

`GuestPage.test.tsx`, in `describe("the reply card (adr-019 §5.3)")`. Its helper `answer(attending: boolean)` becomes `answer(choice: RsvpAnswer)`, picking the radio by `t.yes`, `t.no` or `t.maybe`, and `submitRsvp` is already a spy there:

```tsx
it("offers a third answer in the same radio group", async () => {
  renderPage();
  const group = await screen.findByRole("radiogroup", { name: t.replyTitle });
  expect(within(group).getAllByRole("radio").map((r) => r.textContent)).toEqual([t.yes, t.no, t.maybe]);
});

it("asks no party size for a maybe, and sends both fields", async () => {
  renderPage();
  fireEvent.click(await screen.findByRole("radio", { name: t.maybe }));
  expect(screen.queryByText(t.guestsCount)).toBeNull();
  await answer("maybe");
  expect(api.submitRsvp).toHaveBeenCalledWith(
    "abc123",
    expect.objectContaining({ answer: "maybe", attending: false, guests_count: 1 }),
  );
});

it("thanks a maybe quietly, and points at changing the reply", async () => {
  renderPage();
  await answer("maybe");
  expect(await screen.findByText(t.maybeTitle)).toBeDefined();
  expect(document.querySelector(".gr-thanks-seal")?.classList.contains("muted")).toBe(true);
  expect(screen.getByText(t.maybePill)).toBeDefined();
  expect(screen.getByText(t.maybeLater, { exact: false })).toBeDefined();
  expect(screen.queryByRole("button", { name: t.share })).toBeNull();
  expect(screen.getByRole("button", { name: t.changeAnswer })).toBeDefined();
});
```

The existing yes and no flows stay as they are, through the renamed helper.

`styles.test.ts`:
- Add `[".gr-tile.maybe", "--surface", 4.5]` to the guest floors.
- Add: the maybe tile spans the row (`flex-basis: 100%`), and the tiles wrap (`.gr-tiles` has `flex-wrap: wrap`).

`i18n.test.ts`: `LANDING[lang].guestsPoints[2]` names all three answers. In Ukrainian it contains «так», «ні» and «ще не знаю»; in English it contains "not sure yet".

- [ ] **Step 2: Run them and see them fail.**

- [ ] **Step 3: Implement**
- **`useRsvpForm`:**
  - `answer` state and `canSubmit` on `answer !== null`.
  - `buildRsvpInput` as in the interface. Its comment adds the maybe to "declined quietly resets the guest count".
- **`RsvpForm`:**
  - A third `button role="radio"`, `className="gr-tile maybe"`, after no, with `QuestionIcon` and `t.maybe`.
  - The stepper renders on `answer === "yes"`.
  - The header comment gains decision 5's reason.
- **`icons.tsx`:** `QuestionIcon`, stroking `currentColor`.
- **`ThanksCard`:** `answer` drives the seal, title, line and pill:
  - yes keeps its accent seal and share;
  - no keeps its copy;
  - maybe takes the muted seal and pill, `maybeTitle`, `maybeLater` and `maybePill`.
- **`GuestPage`** passes `form.answer` (when sent, it's never null).
- **CSS:**
  - `.gr-tiles` gains `flex-wrap: wrap`.
  - `.gr-tile.maybe` is `flex-basis: 100%; height: 48px; font-size: 0.95rem; color: var(--ink-muted)`.
  - Its icon at rest is `--ink-faint`, as the decline tile's is.
  - Its active state is the accent fill every chosen tile takes.
- **Strings:** `GUEST.maybe`, `maybeTitle`, `maybeLater` and `maybePill`, and `LANDING.guestsPoints[2]`, per the copy table, each with a one-line doc comment.

- [ ] **Step 4: Run the web suite and the prerender tests** (`landingPage`, `prerender`), which read `guestsPoints`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "Let a guest answer «Ще не знаю», with no party size and a reply still to come (adr-019 §9.1)"
```

## Task 3: The maybe on the host's surfaces

**Files:**
- Modify:
  - `web/src/components/manage/SummaryCard.tsx`, `ResponseList.tsx` and `ManageSkeleton.tsx`;
  - `web/src/csv.ts`;
  - `web/src/i18n.ts` (`MANAGE`, and `RsvpCsvStrings`);
  - `web/src/styles.css` (`:root` and `Host manage dashboard`).
- Test: `web/test/managePage.test.tsx`, `csv.test.ts` and `styles.test.ts`

- [ ] **Step 1: Write the tests**

`managePage.test.tsx` adds a `maybeReply(name, at?)` builder, and:

```tsx
describe("the maybe on the dashboard (adr-019 §9.1)", () => {
  const replies = [yesReply("Оксана", 3), noReply("Влад"), maybeReply("Тарас")];

  it("draws a third segment and a third count, and keeps it out of the headcount", async () => {
    stubApi({ rsvps: replies, counts: { yes: 1, no: 1, maybe: 1, guests: 3 } });
    const { container } = renderManage();
    await screen.findByText(MANAGE.uk.guestsComing);
    expect((container.querySelector(".hm-bar-maybe") as HTMLElement).style.flexGrow).toBe("1");
    const counts = [...container.querySelectorAll(".hm-count")].map((c) => c.textContent);
    expect(counts).toEqual([`1${MANAGE.uk.tileYes}`, `1${MANAGE.uk.tileNo}`, `1${MANAGE.uk.tileMaybe}`]);
    expect(container.querySelector(".hm-bignum")?.textContent).toBe("3");
  });

  it("marks a maybe in the list, with no party size", async () => {
    stubApi({ rsvps: [{ ...maybeReply("Тарас"), guests_count: 3 }], counts: { yes: 0, no: 0, maybe: 1, guests: 0 } });
    const { container } = renderManage();
    const pill = await screen.findByText(MANAGE.uk.maybe, { selector: ".hm-pill" });
    expect(pill.classList.contains("hm-pill-maybe")).toBe(true);
    expect(container.querySelector(".hm-plus")).toBeNull();
  });

  it("strikes a replaced maybe as history, by its own label", async () => {
    stubApi({
      rsvps: [superseded(maybeReply("Тарас", "2026-10-20T10:00:00Z")), yesReply("Тарас", 1, "2026-10-22T10:00:00Z")],
      counts: { yes: 1, no: 0, maybe: 0, guests: 1 },
    });
    const { container } = renderManage();
    await screen.findByText(MANAGE.uk.guestsComing);
    expect(container.querySelector(".hm-previous s")?.textContent).toBe(MANAGE.uk.maybe);
  });
});
```

Elsewhere:
- **The summary's existing tests** pass `maybe: 0` in their counts. "Draws no segment for an answer nobody gave" also asserts there's no `.hm-bar-maybe`.
- **`csv.test.ts`:** a maybe row exports `MANAGE.*.csv.maybe` with the guests cell blank, as a decline's is.
- **`styles.test.ts`:**
  - Add `[".hm-pill-maybe", "--rsvp-maybe-bg", 4.5]` and `[".hm-count-maybe .hm-count-num", "--surface", 4.5]`.
  - "Keeps the RSVP status pair" pins `--rsvp-yes` and `--rsvp-no` by value. It becomes the trio, pinning `--rsvp-maybe` too. The floors above are where its contrast is held.

- [ ] **Step 2: Run them and see them fail.**

- [ ] **Step 3: Implement**
- **`SummaryCard`:**
  - `.hm-bar-maybe` after no, with `flexGrow: maybe`, only above 0.
  - `.hm-count-maybe` third, labelled `tileMaybe`.
  - The step 7 comment becomes a statement: a maybe is reported beside yes and no and never added to `guests`.
- **`ResponseList`:**
  - The pill reads `answer`: `hm-pill-yes`, `hm-pill-no` or `hm-pill-maybe`, labelled `t.yes`, `t.no` or `t.maybe`.
  - `+N` shows on `answer === "yes"`.
  - The previous answer's struck label reads `answer` too.
  - **No component under `components/manage/` reads `attending` after this** (`grep` it).
- **`csv.ts`:**
  - The answer cell maps the three answers.
  - The guests cell is filled for a yes only.
  - `RsvpCsvStrings` gains `maybe`.
- **`ManageSkeleton`** draws a third count block.
- **CSS:**
  - The three `--rsvp-maybe*` tokens in `:root`, in the status block beside yes and no, with a comment naming decision 8.
  - `.hm-bar-maybe` gets `background-color: var(--rsvp-maybe)`.
  - `.hm-count-maybe .hm-count-num` gets `color: var(--rsvp-maybe)`.
  - `.hm-pill-maybe` mirrors the other two pills.
- **Strings:** `MANAGE.maybe`, `tileMaybe` and `csv.maybe`.

- [ ] **Step 4: Run the full suite** with `pnpm build && pnpm test`, checking the exit code.

- [ ] **Step 5: Commit**

```bash
git commit -m "Show the maybe beside yes and no on the dashboard, in the list and in the CSV (adr-019 §9.1)"
```

## Task 4: Docs in the same PR

- `docs/02-functional-requirements.md`:
  - **FR-4.3:** a guest answers yes, no or «Ще не знаю». The party size is for a yes only. Amended, with a date.
  - **FR-4.9 or a new FR-4.10:** the reply card's third tile, and the thanks card after a maybe.
  - **FR-5.2:** the counts are yes, no, maybe and guests, and a maybe never adds to `guests`. The entries carry `answer`.
  - **FR-5.3:** the CSV's answer column has three values, and the guest count is blank for a no or a maybe.
  - **FR-5.7:** the counts carry `maybe`, and the landing row counts every live reply.
  - **FR-5.8:** the bar's third segment and count.
  - **FR-12:** the first email counts every live reply, the maybe included. The sentence already says "every live reply" and only needs checking.
- `docs/04-architecture.md` §6: the `rsvps[]` line names `answer` beside `attending`, with the rule from decision 1.
- `docs/03-non-functional-requirements.md`: re-measure NFR-1.
- `docs/decisions/adr-019-paper-direction.md`:
  - "**Amended 2026-xx-xx, step 7.**" under §9.1, recording the decisions table. Decision 1 is the one a reviewer must see: it reads the ADR's "becomes a three-value enum" through its own Consequences.
  - Step 7 in §12 marked built.
- `docs/decisions/adr-012-batch-response-counts.md`: a dated note that the counts shape gained `maybe`, which the endpoint reuses unchanged (its consequences already say the shape is shared).
- `docs/decisions/adr-010-host-manage-link.md` §5: a dated note that the live answer may be a maybe, counted beside yes and no and never in the headcount.
- `server/CLAUDE.md` (Data and state) and `web/CLAUDE.md`:
  - **Read `answer`, never `attending`, to know what a guest said.** `attending` is true for a yes only and stays beside `answer` for a reader that predates the maybe.
  - Old records have no `answer`, and `answerOf` is the one place that reads them.

- [ ] **Commit**

```bash
git commit -m "Record the maybe reply: FR-4.3, FR-5.2–5.3, FR-5.7–5.8, NFR-1, adr-019 §9.1"
```

## Task 5: Look, then the PR

- [ ] **Step 1: Look at it**

Build, then start the server **from `server/`** (`cd server && node dist/index.js`) with a scratch `DATA_DIR`. Restart it after every rebuild.
- **Guest page, against the real API:** publish one invitation through `/api/invitations/publish`, then reply yes, no and maybe at 360 and 390 px in both languages, Tab and Space included. Check the thanks card for each, and «Змінити відповідь» from a maybe to a yes.
- **Dashboard:** `/manage/:id` with that record's token. Check the bar's three segments, the counts, the pills and a replaced maybe, at 360 and 1280 px. Download the CSV and read it.
- **A record written before this step:** drop a hand-written old-format file into the scratch `DATA_DIR` and open its dashboard.
- **The revert path:** check out `main` in a worktree, point its built server at the same scratch `DATA_DIR`, and open the dashboard of the record with a maybe. The headcount is right, and the maybe reads «Ні».
- Every Review Focus item, with no horizontal scroll.

- [ ] **Step 2: Open the PR.** Follow `.github/pull_request_template.md`. Include:
  - the decisions table, with decision 1 first;
  - the copy table;
  - the NFR-1 figure;
  - what the look checked, the revert path included.

  **Confirm the branch is still on the remote before creating the PR.**

## After this plan

- **Step 5, the editor**, still waits on its two boards. Its header link counts the maybe from the same summary when it's built.
- **Step 8, the gallery onto the ratchet**, and **step 9, the rename**, remain.
- **The revisit trigger "maybes outnumber yeses"** needs real events to answer, from the `/rsvps` data of live invitations. Nothing is built for it now.
- **Design sync**, run as `/design-sync`. The sync after steps 3, 4 and 6 is still owed. Both are CSS-only, unless something else moves the card.
- When this ships, move this plan to `docs/superpowers/archive/plans/`.

### Not in this plan

- **A party size for a maybe.** It's decision 4, and it stays out unless hosts ask.
- **A reminder to the guests who answered maybe.** «Нагадати гостям» copies the public link (§8.3). Messaging a subset of guests would need a channel to them the product doesn't have.
- **The landing demo's «Очікує» row.** It means "hasn't answered", which isn't a maybe, and it stays.
- **Any change to the email's copy.** It is count-only, and a maybe is a reply.
