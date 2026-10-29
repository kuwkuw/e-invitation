# Manage Page on Paper: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/manage/:id` in the paper direction (adr-019 rollout step 6):
- a header with the seal, the title, and the date with a countdown;
- a large total over a thin bar of yes and no, with the counts beneath;
- «Нагадати гостям»;
- the newest guest note as a pull-quote;
- reply email as the checkbox the landing footer already has.

**Architecture:** One PR, built in tasks that each leave the suite green. Two pieces are shared, because they already exist on other surfaces: `Countdown` moves from `components/guest/` to `components/` and takes its strings as a prop, and `NotifyControl` renders `NotifyCheckbox`. The copy action that the empty state and «Нагадати гостям» share becomes a hook, `useCopyLink`, which also stops a blocked clipboard throwing an unhandled rejection. The summary bar and the pull-quote are new components under `components/manage/`. `ManagePage.tsx` stays composition only (`web/CLAUDE.md`). There's no server change: the public payload already carries `brief.hosts`, `date` and `time`, and `/rsvps` already returns every note.

**Tech Stack:** React 19, CSS custom properties, Vitest with jsdom and `@testing-library/react`, Biome.

**Spec:** [adr-019](../../../decisions/adr-019-paper-direction.md) §8 and §10. Its long form is the [paper-direction spec](../specs/2026-10-21-paper-direction-design.md). Like steps 3 and 4, this was planned from adr-019's text alone. The reply-email checkbox on this page is redone from PR #66's design pass, at `58a504e` on `feat/ds-notify-checkbox`.

**Order:** the owner chose to take this step before step 5. Step 5, the editor, waits on two boards in the design project, and this step needs none (adr-019 §7.5 names boards for the editor only). adr-019 §12 orders the steps to avoid stacked PRs, and no code here depends on step 5's.

## Global Constraints

- **The card is untouched.** This page doesn't render the card. `InvitationPreview.tsx` and the `Invitation card` section stay byte-identical.
- **No server change, no schema change, no new request.** «Ще не знаю» is step 7. The bar is built so the maybe can join it there as a third segment.
- **The response list, CSV, refresh, "N new since your last visit" and the superseded history behave exactly as they do now** (§8.5). Their tests don't change.
- **No raw hex** in `Host manage dashboard` (already in `CONVERTED`), in `Reply email checkbox`, or in any manage component. Task 3 extends the component hex test to `components/manage/`. Icons stroke `currentColor`.
- **An element that carries `.grain` sets `background-color`, never the `background` shorthand** (`web/CLAUDE.md`). `.hm-page` uses the shorthand today, and Task 3 fixes it.
- **The reply-email control stays absent, never disabled**, for a host without a session on this device or on a deployment without mail (FR-12.11). Its existing tests for both cases stay.
- **The accent means the public link** (adr-010 §3). «Нагадати гостям» copies exactly that link and is the one control here that may rhyme with it. Even so, it is bordered, not filled: this page's job is reading replies.
- Every user-visible string is in `MANAGE` or `AUTH` in `i18n.ts`, in both languages, with the same shape.
- Branch `feat/paper-manage` from `main`.
- Run one file with `pnpm --filter inv-app-web exec vitest run test/<file>`. Run everything with `pnpm build && pnpm test`, and **check the exit code**: a `grep` on the output can pass while a test fails.

### What this plan decides that adr-019 left open (review these first)

| # | Question | This plan's answer | Why |
|---|---|---|---|
| 1 | `feat/ds-notify-checkbox` "after this lands" (§12.6) | Kept until step 5 lands | Step 5's share panel is the last surface it's the reference for, and it hasn't been built |
| 2 | The header | The seal (`monogramFrom(brief.hosts)`, about 44 px) beside the title. The kicker stays above the title, then `details_line`, then the countdown | The guest page's seal and monogram, unchanged. The kicker tells a host arriving from an email which page they're on |
| 3 | The countdown's strings | `MANAGE.countdown` and `countdownToday`, in the host's UI language, with `MANAGE.time.dayForms`. `Countdown` moves to `components/Countdown.tsx` and takes `{ countdown, countdownToday, dayForms }` plus a class | The guest's countdown follows the invitation's language and the host's follows the UI's. One component, two string sources |
| 4 | "A large Literata total" | `counts.guests`, as now: what a host caters for. The "+N with companions" line stays | It's the number the page exists for |
| 5 | "A thin three-part bar" before the maybe exists | Two segments, yes and no, sized by `flex-grow` equal to their counts. It's `aria-hidden`, and the counts beneath, each over its label, are the text. Step 7 adds a third segment and a third count | No width arithmetic, and a zero count collapses its segment by itself |
| 6 | The "Replied" tile | Retired with the tiles, along with `tileReplied` | It was yes + no, and the list's heading already says «Відповіді · N» |
| 7 | «Нагадати гостям» | A bordered button under the summary, shown only once someone has replied. It copies `/i/:id` and says «Посилання скопійовано». The empty state keeps its own share row | §8.3: "copies the public link". The native share sheet stays the editor's (FR-3.6). With no replies, the empty state's row already is this action |
| 8 | One copy action, two places | `useCopyLink(url)` returns `{ copied, copy }`, and both the empty state and the reminder use it. A blocked clipboard leaves `copied` false instead of throwing | `ManageEmpty` awaits `writeText` today with no catch. New state goes in a hook (`web/CLAUDE.md`) |
| 9 | «Побажання від гостей» | The newest **live** answer with a note, as a pull-quote in Literata italic, with the guest's name. «Усі побажання · N» links to `#hm-responses`, and only when more than one live answer has a note. It's absent when none does | A replaced answer is history (FR-5.5), so its note isn't quoted. A link to "all of them" when there's one is a link to this |
| 10 | Reply email | `NotifyCheckbox`, named `notifyOptIn`. The on state is #66's `notifyStateOnEvent`, "To {email} — for all your invitations, not just this one", and the off state is `notifyStateOffNow`. It renders only when the session has an email. `notifyOnAccount` and `notifyAllEvents` retire, because this page was their last reader | The scope rides the line the host reads. It names the boundary against this event without naming the event (#66's test) |
| 11 | Paper | `.hm-page` takes `.grain` with `background-color`. `.hm-card` takes `--r-xl` and `--e-2` in place of its glass-era 20 px radius and literal shadow, and buttons and fields take `--r-md`. The 46 px targets stay | The guest reply card's step-3 move, applied here |
| 12 | The skeleton | It holds the new shape: a bar and two counts where the three tiles were | A loading state that promises the old layout would jump |

**New copy, for review.** Every string is in both languages.

| Key | Українська | English |
|---|---|---|
| `MANAGE.countdown` | До свята {n} {form} | {n} {form} to go |
| `MANAGE.countdownToday` | Свято сьогодні! | It's today! |
| `MANAGE.remindGuests` | Нагадати гостям | Remind guests |
| `MANAGE.remindCopied` | Посилання скопійовано | Link copied |
| `MANAGE.wishesTitle` | Побажання від гостей | Wishes from your guests |
| `MANAGE.wishesAll` | Усі побажання · {n} | All wishes · {n} |
| `AUTH.notifyStateOnEvent` | Пишемо на {email} — про всі ваші запрошення, не лише про це. | To {email} — for all your invitations, not just this one. |

Retired: `MANAGE.tileReplied`, `AUTH.notifyOnAccount` and `AUTH.notifyAllEvents`.

## Review Focus

1. **The scope sentence.** With mail on, the state line names the host's address and "all your invitations, not just this one". With it off, it says no invitation is written about. Neither line names the event.
2. **The bar at the edges:** all yes, all no, and a single reply. No segment shows when its count is 0, and the bar never reads as a progress meter.
3. **The pull-quote picks the live note.** A guest who changed their answer has their old note dropped.
4. **The empty state and «Нагадати гостям» never both show.** Copying works on both, and a blocked clipboard fails quietly.
5. **360 px:** the header's seal beside a two-line title, the summary card, the button and the quote, with no horizontal scroll.

---

## Task 1: The strings, and a countdown both pages share

**Files:**
- Modify: `web/src/i18n.ts` (`ManageStrings`, `MANAGE` and `AuthStrings`, `AUTH`)
- Move: `web/src/components/guest/Countdown.tsx` to `web/src/components/Countdown.tsx`
- Modify: `web/src/GuestPage.tsx` (the import and the props)
- Test: `web/test/GuestPage.test.tsx` (unchanged, and must stay green), plus `web/test/i18n.test.ts`

**Interfaces:**
- Produces: `Countdown({ days, t, className }: { days: number | null; t: CountdownStrings; className: string })`, where `CountdownStrings = { countdown: string; countdownToday: string; dayForms: [string, string, string] }`, exported from the component.
- `MANAGE` gains `countdown`, `countdownToday`, `remindGuests`, `remindCopied`, `wishesTitle` and `wishesAll`. `AUTH` gains `notifyStateOnEvent`. Nothing retires yet: each key goes in the task that removes its last reader.

- [ ] **Step 1: Write the test.** In `test/i18n.test.ts`:

```ts
describe("the manage page's new copy (adr-019 §8)", () => {
  it("says the reminder copies the link, and counts wishes", () => {
    expect(MANAGE.uk.remindGuests).toBe("Нагадати гостям");
    expect(MANAGE.uk.wishesAll).toContain("{n}");
    expect(MANAGE.en.wishesAll).toContain("{n}");
  });

  // #66's rule: the scope is in the line a host reads, and the line names the
  // boundary against this event without naming the event.
  it("puts the address and the account-wide scope in the dashboard's on state", () => {
    for (const lang of ["uk", "en"] as const) {
      expect(AUTH[lang].notifyStateOnEvent).toContain("{email}");
    }
    expect(AUTH.en.notifyStateOnEvent).toContain("not just this one");
  });
});
```

- [ ] **Step 2: Run it and see it fail.**

- [ ] **Step 3: Implement**
- Add the keys from the copy table, each with a one-line doc comment. `countdown` says it pairs with `time.dayForms`.
- Move `Countdown`. It renders `<p className={className}>`, and its doc comment names both pages. `GuestPage` passes `t={t}` (whose `GuestStrings` already satisfy `CountdownStrings`) and `className="gr-countdown"`.

- [ ] **Step 4: Run the guest and i18n tests.** Expected: PASS, with `GuestPage.test.tsx` unchanged.

- [ ] **Step 5: Commit**

```bash
git commit -m "Share the countdown between the guest and manage pages, and write the dashboard's copy (adr-019 §8)"
```

## Task 2: Reply email as the checkbox on the dashboard (adr-019 §10)

**Files:**
- Modify: `web/src/components/manage/NotifyControl.tsx`, `web/src/ManagePage.tsx`, `web/src/i18n.ts` and `web/src/styles.css` (the `.hm-notify*` rules)
- Test: `web/test/manageNotify.test.tsx` and `web/test/styles.test.ts`

**Interfaces:**
- `NotifyControl({ enabled, onToggle, email, t })` renders `NotifyCheckbox`. `ManagePage` passes `account.email` and renders the control only when `canNotify && account.email`.

- [ ] **Step 1: Write the tests.** Replace `describe("NotifyControl")` with #66's version, adapted to the strings that exist:

```tsx
describe("NotifyControl", () => {
  const renderControl = (enabled: boolean, onToggle = () => {}) =>
    render(<NotifyControl enabled={enabled} onToggle={onToggle} email="host@example.com" t={auth} />);

  it("names the setting identically in both states", () => {
    const off = renderControl(false);
    expect(off.container.querySelector(".notify-name")?.textContent).toBe(auth.notifyOptIn);
    cleanup();
    const on = renderControl(true);
    expect(on.container.querySelector(".notify-name")?.textContent).toBe(auth.notifyOptIn);
  });

  // The rule this surface exists to not break, inside the line a host reads.
  it("names the boundary against this event, in the state row", () => {
    const on = renderControl(true);
    expect(on.container.querySelector(".notify-state")?.textContent).toBe(
      "To host@example.com — for all your invitations, not just this one.",
    );
    cleanup();
    const off = renderControl(false);
    expect(off.container.querySelector(".notify-state")?.textContent).toBe(auth.notifyStateOffNow);
  });

  // If the text reads correctly without knowing which event is open, the
  // control has not annexed the surface.
  it("says nothing about the event it sits on", () => {
    const { container } = renderControl(true);
    expect(container.textContent).not.toContain("Хрестини");
    expect(container.textContent?.toLowerCase()).not.toContain("this invitation");
  });

  it("toggles through a real checkbox", () => {
    const onToggle = vi.fn();
    const { container } = renderControl(false, onToggle);
    fireEvent.click(container.querySelector("label.notify-check input[type=checkbox]") as HTMLElement);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
```

In `describe("the manage page's notification control")`, the three page tests look for `auth.notifyOptIn` in place of `auth.notifyAllEvents`.

In `test/styles.test.ts`, drop the `.hm-notify-scope` row from `textFloors("Host manage dashboard", …)`. The checkbox's own floors on `--app-bg` already cover this ground.

- [ ] **Step 2: Run them and see them fail.**

- [ ] **Step 3: Implement**
- `NotifyControl` keeps its header comment and gains #66's paragraph on how the "event surface for an account-level setting" objection is honoured: *if the control's text reads correctly without knowing which event is open, it has not annexed the surface.* It renders `<div className="hm-notify"><NotifyCheckbox checked={enabled} onToggle={onToggle} name={t.notifyOptIn} state={(enabled ? t.notifyStateOnEvent : t.notifyStateOffNow).replace("{email}", email)} /></div>`.
- `.hm-notify` becomes `margin: 26px 4px 0; padding-top: 6px; border-top: 1px solid var(--edge-soft);`. Delete `.hm-notify-copy`, `.hm-notify-text`, `.hm-notify-scope` and `.hm-notify-toggle*`.
- Retire `AUTH.notifyOnAccount` and `AUTH.notifyAllEvents`, and fix any comment that names them. `grep -rn 'notifyOnAccount\|notifyAllEvents' web/src web/test` should come back empty.

- [ ] **Step 4: Run the tests.** Expected: PASS, including `the share panel`'s, which still read `notifyOn`, `notifyOffer`, `notifyTurnOff` and `notifyOptIn`.

- [ ] **Step 5: Commit**

```bash
git commit -m "Make reply email the checkbox on the host dashboard too (adr-019 §10)"
```

## Task 3: The header on paper: seal, countdown, grain

**Files:**
- Modify: `web/src/ManagePage.tsx` and `web/src/styles.css`
- Test: create `web/test/managePage.test.tsx`. Modify `web/test/manageNotify.test.tsx` (the fixture gains a `brief`) and `web/test/styles.test.ts`.

- [ ] **Step 1: Write the tests**

`web/test/managePage.test.tsx` renders `ManagePage` with a stored token and a stubbed `fetch`, with `inv-ui-lang` set to `uk`. The fixture invitation carries a full `brief`: hosts `["Марія", "Андрій"]`, a date with an explicit future year (`"20 грудня 2030"`), and venue and city. The session answers signed out, so no account calls are made. `rsvps` is a parameter of the stub, so later tasks can vary it. The first describe:

```tsx
describe("the dashboard's header (adr-019 §8.1)", () => {
  it("seals the page with the hosts' monogram beside the title", async () => {
    stubApi({ rsvps: [] });
    const { container } = renderManage();
    await screen.findByRole("heading", { level: 1, name: TITLE });
    expect(container.querySelector(".hm-header .seal")?.textContent).toBe("М&А");
  });

  it("counts down to the day, in the host's language", async () => {
    stubApi({ rsvps: [] });
    renderManage();
    const days = daysUntil(parseEventStart("20 грудня 2030", null) as EventStart) as number;
    const text = MANAGE.uk.countdown
      .replace("{n}", String(days))
      .replace("{form}", pluralForm(days, MANAGE.uk.time.dayForms));
    expect(await screen.findByText(text)).toBeTruthy();
  });

  it("shows no countdown when the date doesn't parse", async () => {
    stubApi({ rsvps: [], date: "колись навесні" });
    const { container } = renderManage();
    await screen.findByRole("heading", { level: 1, name: TITLE });
    expect(container.querySelector(".hm-countdown")).toBeNull();
  });
});
```

`manageNotify.test.tsx`: the fixture invitation gains a `brief`, with `hosts: []` and null date fields. The real payload always carries one (`Invitation.brief` isn't optional).

`test/styles.test.ts`:
- Extend `the guest page's and the landing's components` to `components/manage/` and `ManagePage.tsx`.
- Add `[".hm-countdown", "--app-bg", 4.5]` to the manage floors.
- Add a grain test as the guest page's has: `.hm-page` sets `background-color: var(--app-bg)` and no shorthand, and `ManagePage.tsx` renders `hm-page grain`.
- Add: `.hm-card`'s `border-radius` is `var(--r-xl)` and its `box-shadow` is `var(--e-2)`.

- [ ] **Step 2: Run them and see them fail.**

- [ ] **Step 3: Implement**
- In `ManagePage`, the root becomes `hm-page grain`. `ReadyDashboard` reads `published.invitation.brief`, computes `monogramFrom(brief.hosts)` and `parseEventStart(brief.date, brief.time)`, and renders the header as `.hm-header-row` (the seal, then a column with the kicker and the title), then `details_line`, then `<Countdown days={…} t={{ countdown: t.countdown, countdownToday: t.countdownToday, dayForms: t.time.dayForms }} className="hm-countdown" />`.
- CSS:
  - `.hm-page` uses `background-color`.
  - `.hm-header-row` is `display: flex; gap: 14px; align-items: center`.
  - `.hm-seal` is about 44 px, with `font-size: 0.85rem` and `flex: 0 0 auto`.
  - `.hm-countdown` is in the display face at 400, about 0.95rem, `--ink-muted`, with `margin: 8px 0 0`.
  - `.hm-card` takes `--r-xl` and `--e-2`. `.hm-btn`, `.hm-share-row input` and `button`, `.hm-paste` and `.hm-primary` take `--r-md` in place of 12–14 px.
  - Above 960 px the seal grows to about 52 px.

- [ ] **Step 4: Run the full web suite.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "Seal the dashboard's header and count down to the day, on a grained page (adr-019 §8.1)"
```

## Task 4: The summary: a large total over a thin bar

**Files:**
- Create: `web/src/components/manage/SummaryCard.tsx`
- Delete: `web/src/components/manage/HeadcountCard.tsx`
- Modify: `web/src/ManagePage.tsx`, `web/src/components/manage/ManageSkeleton.tsx`, `web/src/i18n.ts` (retire `tileReplied`) and `web/src/styles.css`
- Test: `web/test/managePage.test.tsx` and `web/test/styles.test.ts`

**Interfaces:**
- Produces: `SummaryCard({ summary, t })`. Step 7 adds a maybe segment and count to it.

- [ ] **Step 1: Write the tests**

```tsx
describe("the summary (adr-019 §8.2)", () => {
  const replies = [yesReply("Оксана", 3), yesReply("Ігор", 1), noReply("Влад")];

  it("leads with the headcount, then a bar sized by the answers, then the counts", async () => {
    stubApi({ rsvps: replies, counts: { yes: 2, no: 1, guests: 4 } });
    const { container } = renderManage();
    await screen.findByText("4");
    const bar = container.querySelector(".hm-bar") as HTMLElement;
    expect(bar.getAttribute("aria-hidden")).toBe("true");
    const grow = (cls: string) => (bar.querySelector(cls) as HTMLElement | null)?.style.flexGrow;
    expect(grow(".hm-bar-yes")).toBe("2");
    expect(grow(".hm-bar-no")).toBe("1");
    const counts = [...container.querySelectorAll(".hm-count")].map((c) => c.textContent);
    expect(counts).toEqual([`2${MANAGE.uk.tileYes}`, `1${MANAGE.uk.tileNo}`]);
  });

  it("draws no segment for an answer nobody gave", async () => {
    stubApi({ rsvps: [yesReply("Оксана", 1)], counts: { yes: 1, no: 0, guests: 1 } });
    const { container } = renderManage();
    await screen.findByText(MANAGE.uk.guestsComing);
    expect(container.querySelector(".hm-bar-no")).toBeNull();
  });

  it("has retired the replied tile", async () => {
    stubApi({ rsvps: replies, counts: { yes: 2, no: 1, guests: 4 } });
    const { container } = renderManage();
    await screen.findByText(MANAGE.uk.guestsComing);
    expect(container.querySelector(".hm-tile")).toBeNull();
  });
});
```

`yesReply` and `noReply` are small fixture builders at the top of the file.

`test/styles.test.ts`: replace the two `.hm-tile-* .hm-tile-label` floors with `[".hm-count-label", "--surface", 3]`, and add `[".hm-count-num", "--surface", 4.5]`.

- [ ] **Step 2: Run them and see them fail.**

- [ ] **Step 3: Implement**
- `SummaryCard`: the top row (`.hm-bignum` and `.hm-bigunit`) and `.hm-breakdown` move over from `HeadcountCard`. Then:
  - `<div className="hm-bar" aria-hidden="true">`, holding `.hm-bar-yes` and `.hm-bar-no` spans with `style={{ flexGrow: n }}`. Each renders only when its count is above 0.
  - Then `.hm-counts`, with one `.hm-count` per answer (`.hm-count-num` over `.hm-count-label`, the labels `tileYes` and `tileNo`).
  - A comment says the maybe joins as a third segment and count in step 7, and that a maybe never adds to the headcount (adr-019 §9.1).
- CSS: delete every `.hm-tile*` rule.
  - `.hm-bar`: `display: flex; gap: 3px; height: 6px; margin-top: 18px; border-radius: var(--r-pill); overflow: hidden; background-color: var(--edge-soft)`. The segments are `flex-basis: 0`, coloured `--rsvp-yes` and `--rsvp-no`.
  - `.hm-counts`: `display: flex; gap: 22px; margin-top: 10px`.
  - `.hm-count-num`: the display face at 500, about 1.3rem. Each takes its status colour: `.hm-count-yes .hm-count-num { color: var(--rsvp-yes) }`, and the same for no, both of which clear 4.5:1 on `--surface`.
  - `.hm-count-label`: about 0.76rem, weight 600, `--ink-faint`.
- `ManageSkeleton` draws a 6 px bar and two short count blocks where the tiles were.
- Retire `MANAGE.tileReplied`.

- [ ] **Step 4: Run the full web suite.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "Lead the summary with the headcount over a thin bar of answers (adr-019 §8.2)"
```

## Task 5: «Нагадати гостям», and one copy action

**Files:**
- Create: `web/src/hooks/useCopyLink.ts` and `web/src/components/manage/RemindGuests.tsx`
- Modify: `web/src/components/manage/ManageEmpty.tsx`, `web/src/ManagePage.tsx` and `web/src/styles.css`
- Test: create `web/test/useCopyLink.test.ts`. Modify `web/test/managePage.test.tsx` and `web/test/styles.test.ts`.

**Interfaces:**
- Produces: `useCopyLink(url: string): { copied: boolean; copy: () => Promise<void> }`. `copied` is true for 2 s after a successful write, and stays false when the clipboard refuses.

- [ ] **Step 1: Write the tests**

`useCopyLink.test.ts` covers three cases: a successful write sets `copied` and clears it after 2 s (fake timers); a rejected `writeText` leaves it false without throwing; and it writes exactly the URL it was given.

`managePage.test.tsx`:

```tsx
describe("remind guests (adr-019 §8.3)", () => {
  it("copies the public link once someone has replied", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    stubApi({ rsvps: [yesReply("Оксана", 1)], counts: { yes: 1, no: 0, guests: 1 } });
    renderManage();
    fireEvent.click(await screen.findByRole("button", { name: MANAGE.uk.remindGuests }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/i/${ID}`);
    expect(await screen.findByText(MANAGE.uk.remindCopied)).toBeTruthy();
  });

  it("leaves an empty dashboard to its own share row", async () => {
    stubApi({ rsvps: [] });
    renderManage();
    await screen.findByText(MANAGE.uk.emptyTitle);
    expect(screen.queryByRole("button", { name: MANAGE.uk.remindGuests })).toBeNull();
  });
});
```

`test/styles.test.ts`: add `[".hm-remind", "--surface", 4.5]`.

- [ ] **Step 2: Run them and see them fail.**

- [ ] **Step 3: Implement**
- `useCopyLink` wraps `navigator.clipboard.writeText` in try/catch, and its timer is cleared on unmount.
- `ManageEmpty` uses it. Its markup and strings don't change.
- `RemindGuests({ url, t })` renders `<button type="button" className="hm-remind" aria-live="polite">`, holding a link icon (new in `icons.tsx`, stroking `currentColor`) and `{copied ? t.remindCopied : t.remindGuests}`.
- `ReadyDashboard` renders it under `SummaryCard` in `.hm-summary-col`, only when there are replies.
- `.hm-remind` is a full-width bordered button, 46 px tall: `--surface` with a `--edge` border, `--r-md` corners, and `--ink` at weight 600. Its hover takes the accent's border, as `.hm-btn` does. There's no fill.

- [ ] **Step 4: Run the full web suite.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "Remind guests from the dashboard, and copy the link through one hook (adr-019 §8.3)"
```

## Task 6: «Побажання від гостей»

**Files:**
- Create: `web/src/components/manage/GuestWishes.tsx`
- Modify: `web/src/ManagePage.tsx`, `web/src/components/manage/ResponseList.tsx` (the `id="hm-responses"` anchor) and `web/src/styles.css`
- Test: `web/test/managePage.test.tsx` and `web/test/styles.test.ts`

**Interfaces:**
- Produces: `GuestWishes({ summary, t })`. It reads live answers through `groupResponses`, so it shares the list's idea of who said what last.

- [ ] **Step 1: Write the tests**

```tsx
describe("wishes from guests (adr-019 §8.4)", () => {
  it("quotes the newest live note, with its guest's name", async () => {
    stubApi({
      rsvps: [
        withNote(yesReply("Оксана", 1, "2026-10-20T10:00:00Z"), "Будемо!"),
        withNote(yesReply("Ігор", 1, "2026-10-21T10:00:00Z"), "Вітаємо від усієї родини"),
      ],
      counts: { yes: 2, no: 0, guests: 2 },
    });
    const { container } = renderManage();
    const quote = await screen.findByText("Вітаємо від усієї родини");
    expect(quote.closest(".hm-wishes")?.querySelector(".hm-wish-who")?.textContent).toBe("Ігор");
    const all = container.querySelector(".hm-wishes a") as HTMLAnchorElement;
    expect(all.getAttribute("href")).toBe("#hm-responses");
    expect(all.textContent).toBe(MANAGE.uk.wishesAll.replace("{n}", "2"));
  });

  it("never quotes an answer the guest has since replaced", async () => {
    stubApi({
      rsvps: [
        superseded(withNote(yesReply("Оксана", 1, "2026-10-20T10:00:00Z"), "Старе")),
        noReply("Оксана", "2026-10-22T10:00:00Z"),
      ],
      counts: { yes: 0, no: 1, guests: 0 },
    });
    const { container } = renderManage();
    await screen.findByText(MANAGE.uk.guestsComing);
    expect(container.querySelector(".hm-wishes")).toBeNull();
  });

  it("offers no link to all of them when there is one", async () => {
    stubApi({ rsvps: [withNote(yesReply("Оксана", 1), "Будемо!")], counts: { yes: 1, no: 0, guests: 1 } });
    const { container } = renderManage();
    await screen.findByText("Будемо!");
    expect(container.querySelector(".hm-wishes a")).toBeNull();
  });
});
```

`groupResponses` takes the newest answer per normalized name as live. `superseded()` also sets `superseded: true`, which is what the server sends for the older one (adr-010 §5).

`test/styles.test.ts`: add `[".hm-wish-quote", "--surface", 4.5]`, `[".hm-wish-who", "--surface", 3]` and `[".hm-wishes a", "--surface", 4.5]`. The quote sets the display face at weight 400, italic, which the display-face weight test holds.

- [ ] **Step 2: Run them and see them fail.**

- [ ] **Step 3: Implement**
- `GuestWishes`: `const live = groupResponses(summary.rsvps).map((g) => g.live).filter((r) => r.note?.trim())`. Render nothing when `live` is empty. Otherwise render a `.hm-card .hm-wishes` section holding:
  - an `h2.hm-section-title` with `wishesTitle`;
  - a `blockquote` with `p.hm-wish-quote` («note») and `p.hm-wish-who` (the name);
  - and, when `live.length > 1`, `<a href="#hm-responses">` with `wishesAll`.
- `ResponseList`'s section gets `id="hm-responses"` and `scroll-margin-top: 16px`.
- `ReadyDashboard` renders `GuestWishes` in `.hm-summary-col`, after the "N new" line.
- CSS: `.hm-wish-quote` is the display face, italic 400, about 1.1rem, `--ink`, `line-height: 1.45`, with `margin: 6px 0 0`. `.hm-wish-who` is about 0.8rem, weight 600, `--ink-faint`. `.hm-wishes a` is `--ui-accent`, about 0.85rem, weight 600, underlined on hover.

- [ ] **Step 4: Run the full suite** with `pnpm build && pnpm test`, checking the exit code.

- [ ] **Step 5: Commit**

```bash
git commit -m "Quote the newest guest wish on the dashboard (adr-019 §8.4)"
```

## Task 7: Docs in the same PR

- `docs/02-functional-requirements.md`:
  - New FR-5.8, the dashboard on paper: the header's seal and countdown, the total over a bar of answers, «Нагадати гостям» (copies `/i/:id`, shown with replies), and the newest live note quoted (§8). FR-5.2–5.7 are unchanged.
  - FR-12.11 amended: the dashboard's control is FR-12.12's checkbox, with the address and "not just this one" in its state line.
  - FR-12.12: the dashboard joins the landing footer, and the share panel remains.
- `docs/03-non-functional-requirements.md`: re-measure NFR-1. NFR-9's grain sentence adds the manage page's ground.
- `docs/decisions/adr-019-paper-direction.md`:
  - A dated "**Amended 2026-xx-xx, step 6.**" under §8, recording the decisions table and the order (step 6 before step 5, and why).
  - §10's status line: the manage page is built, the share panel remains, and the reference branch stays until step 5.
- `docs/decisions/adr-015-rsvp-notifications.md`: the 2026-10-24 note names the dashboard too.
- `docs/06-roadmap.md`, the "Unported: PR #66" note: the manage page shipped, and the share panel is the last.
- `web/CLAUDE.md`:
  - Structure: `Countdown` and `NotifyCheckbox` are the shared components, and `useCopyLink` joins the hooks.
  - Host access: the dashboard's reply email is `NotifyCheckbox`.

- [ ] **Commit**

```bash
git commit -m "Record the manage page on paper: FR-5.8, FR-12.11–12.12, NFR-1, NFR-9, adr-019 §8"
```

## Task 8: Look, then the PR

- [ ] **Step 1: Look at it**

Build, then start the server **from `server/`** (`cd server && node dist/index.js`): it serves the SPA relative to its working directory. Restart it after every rebuild, because it holds the old shell. Drive it with Playwright, mocking `/api/invitations/:id`, `/rsvps` and the session, at 360, 390 and 1280 px in both languages. Check:
- 0, 1 and many replies, all yes, all no, and with and without notes
- a replaced answer whose old note mustn't be quoted
- signed out (no checkbox) and signed in with mail on and off (Tab and Space)
- a date that parses, one that doesn't, and one that's past
- every Review Focus item, and no horizontal scroll

- [ ] **Step 2: Open the PR.** Follow `.github/pull_request_template.md`, with the decisions table, the copy table, the NFR-1 figure and what the look checked. **Confirm the branch is still on the remote before creating the PR.** GitHub deletes a merged head branch, and a re-push recreates it as an orphan.

## After this plan

- **Step 7, «Ще не знаю»**, is schema-first. It adds the maybe as a third segment and count in `SummaryCard`, a third tile in the reply card, and a count in the CSV and the email.
- **Step 5, the editor**, still waits on its two boards. When it lands, delete `feat/ds-notify-checkbox`, and retire `notifyOn`, `notifyOffer` and `notifyTurnOff` with the share panel's old control.
- **Design sync** after merge, as after step 4.
- When this ships, move this plan to `docs/superpowers/archive/plans/`, as steps 1–4's were.

### Not in this plan

- **The open count** (§8.6 and §9.3, deferred).
- **The native share sheet for the reminder.** §8.3 says copy, and FR-3.6's sheet stays the editor's.
- **A notes-only view.** "All of them" is the list, where each note already sits under its guest's name.
