# Editor on Paper: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/create` in the paper direction (adr-019 rollout step 5):
- the card on the deckled mat, the width the guest gets;
- a header bar with the seal, the title and, after the first publish, a live «16 буде · 3 ні» link to the dashboard;
- underlined design tabs, «Конверт» among them, that stay pinned under the card;
- the peek line in Literata italic;
- reply email as the checkbox in the share panel, the last of its three surfaces;
- the share panel, the sign-in gate and the account sheets on paper, the manage-token block re-tuned toward kraft.

**Architecture:** One PR, built in tasks that each leave the suite green. Two pieces are new: a hook, `useReplyCounts`, which reads the one published invitation's counts from adr-012's batch endpoint, and a component, `EditorHeader`, so the header can be tested without rendering `App` (this suite has no `App` render test). Everything else is existing components on new markup and tokens. `App.tsx` stays composition only (`web/CLAUDE.md`). There's no server change: the counts endpoint already returns yes, no, maybe and guests for any id and token.

**Tech Stack:** React 19, react-router-dom (declarative), CSS custom properties, Vitest with jsdom and `@testing-library/react`, Biome.

**Spec:** [adr-019](../../decisions/adr-019-paper-direction.md) §7, §10, §11 and §1's step-1 amendment (the `--caution-*` re-tune "belongs to the share-panel step (5)"). Its long form is the [paper-direction spec](../specs/2026-10-21-paper-direction-design.md) §7. The share panel's checkbox is redone from PR #66's design pass, at `58a504e` on `feat/ds-notify-checkbox`.

**The boards §7.5 asks for were waived by the owner.** §7.5 names two boards in the design project before this step: the desktop two-pane layout and the share panel. The owner chose to build without them. This plan settles what they would have, in the table below, and the PR records the waiver as an adr-019 amendment, as step 6's reordering was. The visual references that do exist still hold: the canvas row `A2 · Editor`, and the design project's `ShareSignedIn`, `NotifyLine` and `AuthGate` boards for the panel's hierarchy and the gate's frames.

## Global Constraints

- **The card is untouched.** `InvitationPreview.tsx`, the `Invitation card` section and the OG renderer stay byte-identical. The mat wraps the card and never sits on it (§3); the existing material-isolation test holds that.
- **No server change, no schema change, no stored-data change.** The header reads an endpoint that exists.
- **The share panel's hierarchy is the safeguard** (adr-010 §3). One filled accent, and it acts on the public link, in every state: signed out or in, with or without `navigator.share`, mail on or off. **The manage copy button never renders without its warning.** The existing tests for both stay, unchanged.
- **The editor's behaviour doesn't change**, apart from the header link. The chat, the date nudge and gate (FR-1.7, FR-1.8), per-field editing, the sign-in round trip, BYOK and publishing behave as they do now. `useInvitationEditor.ts`, `usePublishing.ts` and their tests have no diff.
- **No raw hex** in the sections this step converts (`Sign-in gate`, `Share panel: signed in`, `Account sheets`) or in any editor component, except the Google mark's four brand colours. Icons stroke `currentColor`.
- **An element that carries `.grain` sets `background-color`, never the `background` shorthand** (`web/CLAUDE.md`).
- Every user-visible string is in `UI` or `AUTH` in `i18n.ts`, in both languages, with the same shape.
- Branch `feat/paper-editor` from `main`.
- Run one file with `pnpm --filter inv-app-web exec vitest run test/<file>`. Run everything with `pnpm build && pnpm test`, and **check the exit code**: a `grep` on the output can pass while a test fails.

### What this plan decides that adr-019 left open (review these first)

| # | Question | This plan's answer | Why |
|---|---|---|---|
| 1 | The two boards (§7.5) | Waived by the owner. This table answers what they would have, and the PR amends §7 to say so | The owner's call. Every answer below is something a board would have settled |
| 2 | "WYSIWYG with the guest's card at both breakpoints" (§7.1) | The canvas wraps the card in `.cc-mat > .deckle`, the guest page's `.gr-mat > .deckle`. On a phone the canvas's side padding is the guest page's 20 px, so the card is the guest's width at 360–430 px. On desktop the mat is 460 px wide, the guest's `.gr-inv`. The `.cc-canvas .inv` near-bleed override is deleted | The mat's 12 px pad is the old near-bleed inset (§7.1). Matching the guest's padding is what makes the wrap the guest sees the wrap the host sees |
| 3 | The toolbar that never pins (roadmap: `.cc-design` is `position: sticky; bottom: 0` as the scroller's first child) | The tabs move **after** the card in the DOM and stay sticky at the pane's bottom, as the approved adr-018 mockup drew them. The pane centres its content with `margin: auto` on the child, so a card taller than the pane can be scrolled to its top | §4.1: with no blur there's nothing left to re-gate, so this is now an ordinary layout fix. `align-items: center` on a scroller clips the top of tall content |
| 4 | Which tabs | Five, as §7.3 names them: Палітра, Шрифт, **Макет**, **Конверт**, Фон. «Макет» holds composition and ornament as two rows in one sheet. Фон hides as it does now (no handler, or the minimal palette) | The ADR's list has no ornament tab, and six don't fit a 360 px phone in English. Ornament is a layout choice |
| 5 | Tabs or disclosures | Disclosure buttons with `aria-expanded`, drawn as underlined tabs. None is open at rest, and a second press closes the sheet, as now | ARIA's tab pattern always has one panel open. This behaviour has none, so `role="tab"` would announce something that isn't true |
| 6 | The tabs' look | A strip on card stock with an `--edge` rule above it. Idle tabs `--ink-muted`; the open one `--ui-ink` with a 2 px `--ui-accent` underline. The strip shares its width (`flex: 1`), so five fit 360 px in both languages | An underline spends no fill (decision 15). `--ui-*` because the swatches above carry `palette-*` |
| 7 | «Конверт» while the override is deferred (§9.2) | A still of the closed envelope, kraft with its flap, the invitation's title and the seal with the derived monogram, over one line saying when guests see it. **No input.** Its own `.cc-env-*` rules | It shows the host the first thing every guest sees. An input would be the deferred override. The landing's still is a picture in the landing's section; sharing its rules would move the landing for one small figure |
| 8 | The header | A full-width bar on `--surface` with an `--edge` rule beneath, in place of the floating pill: back, seal, title, then the AI key, language and Publish. The title is in the display face at 500 and starts beside the seal | Paper lies flat (§1's elevation note). Dropping the pill's 14 px side margins gives the title back 28 px at 360, where today it's about 58 px wide |
| 9 | The seal on a phone | Hidden at ≤ 480 px, as the Publish label already is | The title carries the invitation's name and loses the width fight first (the existing rule's own reason). The seal is decoration there |
| 10 | Where the counts come from (§7.2: "the existing `/rsvps` summary") | **`POST /api/invitations/counts`**, adr-012's batch endpoint, with one item: `{ id, token }` from the publish result. No `seen_at` | It returns exactly FR-5.2's counts and never the RSVP list. `/rsvps` would bring every guest's name and note into the editor to draw two numbers. This amends §7.2 |
| 11 | "Live" | Fetch after each publish or republish (a new `version`), and again on `visibilitychange → visible`. No timer. A failure keeps the last counts, or none, and says nothing | adr-010 §6's rule for the dashboard. The host leaves for Viber to share and comes back, which is exactly when the number should move. adr-012 §6: a decorative fetch fails silent |
| 12 | The line | «{guests} буде · {no} ні · {maybe} можливо», in that order (§8.2's), each part only when its count is above 0. «Ще без відповідей» when no one has replied, and «Відповіді» before the first answer arrives or when the fetch fails | «буде» is the headcount, FR-5.2's `guests`, the number the dashboard leads with. A maybe never joins it (§9.1). The link is never blank, because it's the way to the dashboard as well as a count |
| 13 | Where the link sits | A router `<Link>` to `/manage/:id`, in the same tab. Under the title on desktop. At ≤ 480 px, a row of its own across the bottom of the bar. It's one element in both cases, placed by the header's grid areas | At 360 px the title column is about 88 px, and «16 буде · 3 ні» needs about 91 px. The share panel's own «Переглянути відповіді» already leaves in the same tab, and a new tab inside a messenger webview opens without the token |
| 14 | Reply email in the share panel (§10) | `NotifyCheckbox`, named `notifyOptIn`. Off: #66's offer, «На {email} — про всі ваші запрошення.» On: the dashboard's `notifyStateOnEvent`, «Пишемо на {email} — про всі ваші запрошення, не лише про це.» The envelope icons leave the panel. `notifyOn`, `notifyOffer`, `notifyTurnOff`, `MailIcon`, `MailOffIcon` and the `Reply notifications` section retire | The panel is about one event, as the dashboard is, so it says "not just this one" in the same words. #66's on state carried no scope, so the scope would vanish the moment the host agreed |
| 15 | adr-010 §3, amended by §10 | Written as adr-010 §3.1: the hierarchy counts fills, not affordances. The checkbox and the tab underline spend no fill | §10 says the requirement text is written in the PR that builds it |
| 16 | The manage-token block toward kraft (§1, amended) | `--caution-wash` `#f8f2ea` → `#f2e7d5`, `--caution-surface` `#fffdfa` → `#f9f2e6`, `--caution-edge` → `#e3d3b9`, `--caution-edge-hi` → `#dccab0`, `--caution-edge-strong` → `#d2bfa2`, `--caution-ink-faint` `#a89478` → `#937859`, `--caution-ink-masked` `#9a8f7d` → `#928672`. `--caution-ink` stays `#7a5638`. A new test pins the distance | Under paper `--caution-wash` is 2.4 (CIE76) from the `--surface` it sits on, inside the 2.5 at which this block collapses values. At `#f2e7d5` it's 8.9 from `--surface` and 7.4 from `--wash`. `--caution-ink-faint` is 2.63:1 on today's wash, under the 3:1 a label owes. Measured below |
| 17 | The share panel's geometry | Its literal 12–16 px radii take `--r-md` and `--r-lg`, and the panel `--r-xl`. `.sp-primary`'s glow reads `--ui-accent-rgb`, as the guest's submit does: today it's glass's terracotta, `rgba(179, 89, 46, …)`. `.cc-share-panel`'s literal shadow becomes `--e-3` | The guest reply card's step-3 move. The glow is a stale colour, not a choice |
| 18 | The sign-in gate and the account sheets | Both convert here (`Sign-in gate`, 35 literals; `Account sheets`, 14), with `Share panel: signed in` (10), and join `CONVERTED`. The gate's retry, spinner and progress take the paper accent; today they're glass's `#b3592e`. Sentences take `--ink-muted`, labels `--ink-faint`. The Google mark keeps its brand colours | §11: the gate is the share sheet's first frame and "converts with the share panel's board". The sheets are built on its `.ag-*` shell (`web/CLAUDE.md`), so they move when it does |
| 19 | Pills | Every `--r-pill` in `Creation chat` except the sheet's grab handle takes `--r-md`: the Publish button, the chips, the composer and the AI key's two buttons. The send and back buttons stay round | §1: stationery corners, and the pill stays for the language switch. A round icon button isn't a pill |
| 20 | Publish before it can publish | `--edge-soft` fill with an `--ink-muted` label, the guest's disabled submit (5.30:1) | Today it's `--accent-wash` on what is now card stock, at 1.0:1 against the bar |
| 21 | The peek line | The display face, italic 400, about 0.9 rem, `--ink-muted`. The desktop transcript's bubbles don't change | §7.4 names the peek line. 0.8 rem in a serif italic is too small to read in a messenger webview |
| 22 | `FieldSheet`, `AuthGate`'s frames and the BYOK panel | Tokens only. Beyond decision 19's pills nothing moves in `FieldSheet` or BYOK | §7.5: they "restyle by tokens and need none" |
| 23 | `feat/ds-notify-checkbox` | Deleted after this PR merges | §10 and §12.6: the share panel is the last surface it's the reference for |

**The kraft set, measured.** WCAG ratios, and CIE76 ΔE, the measure the `:root` comment's "dE 2.5" uses (`#f8f2ea` vs `--wash` reads 2.18 there).

| Pair | Today | This plan | Floor |
|---|---|---|---|
| `--caution-wash` vs `--surface` | ΔE 2.4 | ΔE 8.9 | ≥ 6 (new test) |
| `--caution-wash` vs `--wash` | ΔE 2.2 | ΔE 7.4 | ≥ 6 (new test) |
| `--caution-surface` vs `--surface` | ΔE 2.3 | ΔE 3.9 | ≥ 2.5 (new test) |
| `--caution-ink` on `--caution-wash` | 5.87 | 5.34 | 4.5 |
| `--rsvp-no` (the warning) on `--caution-wash` | 5.48 | 4.98 | 4.5 |
| `--caution-ink-faint` on `--caution-wash` | 2.63 | 3.38 | 3 |
| `--caution-ink-masked` on `--caution-surface` | 3.13 | 3.21 | 3 |

**New copy, for review.** Every string is in both languages.

| Key | Українська | English |
|---|---|---|
| `UI.chat.repliesLink` | Відповіді | Replies |
| `UI.chat.repliesNone` | Ще без відповідей | No replies yet |
| `UI.chat.repliesComing` | {n} буде | {n} coming |
| `UI.chat.repliesNo` | {n} ні | {n} no |
| `UI.chat.repliesMaybe` | {n} можливо | {n} maybe |
| `UI.design.layoutTab` | Макет | Layout |
| `UI.design.envelope` | Конверт | Envelope |
| `UI.design.envelopeNote` | Гості отримують запрошення в конверті, коли вперше відкривають посилання. Печатка — ініціали з вашого опису. | Guests get the invitation in an envelope the first time they open the link. The seal is the initials from your description. |
| `UI.design.envelopeNoHosts` | Гості отримують запрошення в конверті, коли вперше відкривають посилання. Без імен господарів печатка несе знак INVINTO. | Guests get the invitation in an envelope the first time they open the link. With no hosts named, the seal carries the INVINTO mark. |
| `AUTH.notifyStateOffer` | На {email} — про всі ваші запрошення. | To {email} — for every invitation in your account. |

Changed: `UI.design.layout` in English, "Layout" → "Composition", because «Макет» / "Layout" is now the tab and this is a row inside it. The Ukrainian «Композиція» is unchanged.

Retired: `AUTH.notifyOn`, `AUTH.notifyOffer` and `AUTH.notifyTurnOff`.

## Review Focus

1. **The share panel's hierarchy, in every state.** One `.sp-primary`, acting on the public link: signed out and in, with and without the share sheet, mail on and off. The checkbox spends no fill. The manage copy button never appears without its warning.
2. **WYSIWYG.** At 360, 390 and 1280 px the editor's card is the guest page's width, on the same mat.
3. **The tabs pin.** At rest they sit at the pane's bottom over the card's lower edge, and an open sheet rises above them. A card taller than the desktop pane scrolls to its top.
4. **The header at 360 px** in both languages, before and after publishing: a readable title, the AI key, the language switch and Publish, then the counts row. No horizontal scroll.
5. **The counts never carry a name.** The editor calls only the counts endpoint, never `/rsvps`, and a failure shows «Відповіді» and logs nothing.
6. **No glass terracotta left** on the share panel, the gate or the account sheets.

---

## Task 1: The strings

**Files:**
- Modify: `web/src/i18n.ts` (`ChatStrings`, `DesignStrings`, `AuthStrings` and both tables of each)
- Test: `web/test/i18n.test.ts`

**Interfaces:**
- `ChatStrings` gains `repliesLink`, `repliesNone`, `repliesComing`, `repliesNo` and `repliesMaybe`. `DesignStrings` gains `layoutTab`, `envelope`, `envelopeNote` and `envelopeNoHosts`. `AuthStrings` gains `notifyStateOffer`. Nothing retires yet: each key goes in the task that removes its last reader.

- [ ] **Step 1: Write the test.** In `test/i18n.test.ts`:

```ts
describe("the editor's new copy (adr-019 §7, §10)", () => {
  it("counts replies with one placeholder per part", () => {
    for (const lang of ["uk", "en"] as const) {
      const chat = UI[lang].chat;
      for (const key of ["repliesComing", "repliesNo", "repliesMaybe"] as const) {
        expect(chat[key].match(/\{n\}/g)).toHaveLength(1);
      }
    }
    expect(UI.uk.chat.repliesComing).toBe("{n} буде");
  });

  // #66's rule: the scope is in the offer, read before the host agrees.
  it("puts the address and the account-wide scope in the share panel's offer", () => {
    expect(AUTH.uk.notifyStateOffer).toBe("На {email} — про всі ваші запрошення.");
    expect(AUTH.en.notifyStateOffer).toContain("every invitation in your account");
  });

  it("names the five design tabs adr-019 §7.3 lists", () => {
    const d = UI.uk.design;
    expect([d.palette, d.typography, d.layoutTab, d.envelope, d.background]).toEqual([
      "Палітра", "Шрифт", "Макет", "Конверт", "Фон",
    ]);
  });
});
```

- [ ] **Step 2: Run it and see it fail.**

- [ ] **Step 3: Implement.** Add the keys from the copy table, each with a one-line doc comment. `repliesComing` says it counts FR-5.2's `guests`, the headcount; `repliesMaybe` says a maybe never joins it. Change `UI.en.design.layout` to "Composition".

- [ ] **Step 4: Run the i18n tests.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "Write the editor's paper copy: the header's counts, the envelope tab, the share panel's offer (adr-019 §7, §10)"
```

## Task 2: Reply email as the checkbox in the share panel (adr-019 §10)

**Files:**
- Modify: `web/src/components/editor/SharePanel.tsx`, `web/src/components/editor/icons.tsx` (drop `MailIcon` and `MailOffIcon`), `web/src/i18n.ts` and `web/src/styles.css` (delete the `Reply notifications` section)
- Test: `web/test/SharePanel.test.tsx` and `web/test/styles.test.ts`

**Interfaces:**
- `SharePanel`'s props don't change. It renders `<div className="sp-notify"><NotifyCheckbox … /></div>` where the sentence and button were.

- [ ] **Step 1: Write the tests.** Replace `describe("SharePanel reply notifications")` with #66's version, adapted to the strings that exist:

```tsx
describe("SharePanel reply email (adr-019 §10)", () => {
  function renderNotify(overrides: Partial<Parameters<typeof SharePanel>[0]> = {}) {
    return renderPanel({
      signedIn: true,
      manageShown: true,
      notifyEmail: "host@example.com",
      t: UI.en,
      ...overrides,
    });
  }

  it("names the setting identically in both states", () => {
    const off = renderNotify({ notifyEnabled: false });
    expect(off.container.querySelector(".notify-name")?.textContent).toBe(UI.en.auth.notifyOptIn);
    cleanup();
    const on = renderNotify({ notifyEnabled: true });
    expect(on.container.querySelector(".notify-name")?.textContent).toBe(UI.en.auth.notifyOptIn);
  });

  // The scope rides the offer, so the host agrees knowing it; and it stays
  // in the on state, so it doesn't vanish the moment they do.
  it("says where mail goes and what it covers, before and after agreeing", () => {
    const off = renderNotify({ notifyEnabled: false });
    expect(off.container.querySelector(".notify-state")?.textContent).toBe(
      "To host@example.com — for every invitation in your account.",
    );
    cleanup();
    const on = renderNotify({ notifyEnabled: true });
    expect(on.container.querySelector(".notify-state")?.textContent).toBe(
      "To host@example.com — for all your invitations, not just this one.",
    );
  });

  it("defaults to unchecked, an offer rather than a promise", () => {
    const { container } = renderNotify();
    expect((container.querySelector(".notify-input") as HTMLInputElement).checked).toBe(false);
  });

  it("toggles through a real checkbox", () => {
    const onToggleNotify = vi.fn();
    const { container } = renderNotify({ onToggleNotify });
    fireEvent.click(container.querySelector("label.notify-check input[type=checkbox]") as HTMLElement);
    expect(onToggleNotify).toHaveBeenCalledTimes(1);
  });

  // A square carries the state now; the envelope keeps its job only where
  // nothing is pressable (the email footer, the unsubscribe page).
  it("carries no envelope icon", () => {
    const { container } = renderNotify({ notifyEnabled: false });
    expect(container.querySelector(".sp-notify svg:not(.notify-box svg)")).toBeNull();
  });

  // adr-010 §3.1: the hierarchy counts fills. The checkbox spends none.
  it("leaves the public link the only filled accent", () => {
    const { container } = renderNotify({ notifyEnabled: true });
    expect(container.querySelectorAll(".sp-primary")).toHaveLength(1);
    expect(screen.getByText(UI.en.copyLink).className).toContain("sp-primary");
  });

  it("renders nothing when the deployment cannot send mail, or for a signed-out host", () => {
    const noMail = renderNotify({ notifyEmail: null });
    expect(noMail.container.querySelector(".sp-notify")).toBeNull();
    cleanup();
    const signedOut = renderNotify({ signedIn: false });
    expect(signedOut.container.querySelector(".sp-notify")).toBeNull();
  });

  it("carries the copy in Ukrainian too", () => {
    const { container } = renderNotify({ notifyEnabled: false, t: UI.uk });
    expect(container.querySelector(".notify-state")?.textContent).toBe(
      "На host@example.com — про всі ваші запрошення.",
    );
  });
});
```

`test/styles.test.ts` needs nothing here: `edges the empty box at 3:1 on both grounds it sits on` already checks `--surface`, the share panel's ground (4.23:1).

- [ ] **Step 2: Run them and see them fail.**

- [ ] **Step 3: Implement**
- `SharePanel` renders `NotifyCheckbox` with `checked={notifyEnabled}`, `onToggle={onToggleNotify ?? noop}`, `name={t.auth.notifyOptIn}` and `state={(notifyEnabled ? t.auth.notifyStateOnEvent : t.auth.notifyStateOffer).replace("{email}", notifyEmail)}`. Keep #66's comment on why the envelope left, and rewrite the block comment above it: the control now spends no fill, which is adr-010 §3.1's rule, rather than being "the same quiet treatment" as the account note.
- Delete `notifyOnBefore`/`notifyOnAfter`, `MailIcon` and `MailOffIcon` (the gate has its own `MailIcon`).
- Delete the `Reply notifications` banner and section. `.sp-notify { margin: 0 0 12px; }` moves into `Share panel: signed in`, beside `.sp-account-note`.
- Retire `AUTH.notifyOn`, `notifyOffer` and `notifyTurnOff`. `grep -rn 'notifyOn\b\|notifyOffer\|notifyTurnOff\|MailOffIcon' web/src web/test` should come back empty.
- `NotifyCheckbox`'s header comment: the share panel carries it too.

- [ ] **Step 4: Run the web suite.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "Make reply email the checkbox in the share panel, its last surface (adr-019 §10)"
```

## Task 3: The share panel on paper, and the manage-token block toward kraft

**Files:**
- Modify: `web/src/styles.css` (`:root`'s `--caution-*`, `Creation chat`'s `.cc-share-panel`, `Share panel`, `Share panel: signed in`)
- Modify: `web/test/cssTokens.ts` (a `deltaE76` helper) and `web/test/styles.test.ts`

- [ ] **Step 1: Write the tests**

`cssTokens.ts` gains `deltaE76(a: string, b: string): number`: sRGB → linear → XYZ (D65) → CIELAB, then the Euclidean distance. Its doc comment says it's the measure the `:root` comment's "dE" figures use.

`styles.test.ts`:

```ts
// adr-010 §3: the manage-token block exists to not be the clean chrome. Under
// paper its wash sat 2.4 from the card stock it's set on.
describe("the manage-token block (adr-019 §1, step 5)", () => {
  it("stays a different material from the chrome around it", () => {
    const t = (name: string) => tokens.get(name) as string;
    expect(deltaE76(t("--caution-wash"), t("--surface"))).toBeGreaterThanOrEqual(6);
    expect(deltaE76(t("--caution-wash"), t("--wash"))).toBeGreaterThanOrEqual(6);
    expect(deltaE76(t("--caution-surface"), t("--surface"))).toBeGreaterThanOrEqual(2.5);
  });
});

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
    const body = stripComments(sections(css).get("Share panel") ?? "");
    expect([...body.matchAll(/border-radius:\s*(\d+px)/g)].map((m) => m[1])).toEqual([]);
  });
});
```

Add `"Share panel: signed in"` to `CONVERTED`.

- [ ] **Step 2: Run them and see them fail.**

- [ ] **Step 3: Implement**
- `:root`: the `--caution-*` values from decision 16. Rewrite the group's comment with the new distances and the reason for the re-tune (adr-019 §1), and point at the test that now pins them.
- `.cc-share-panel`: `box-shadow: var(--e-3)`.
- `Share panel`:
  - `.sp-link`, `.sp-secondary`, `.sp-manage`: `--r-lg`. `.sp-primary`: `--r-lg`, and its two shadows read `rgba(var(--ui-accent-rgb), …)`, as `.gr-submit` does. `.sp-manage-value`, `.sp-ghost`: `--r-md`. `.sp-badge`: `--r-sm`. `.sp-version`: `--r-pill`, a counter, not a control.
  - `.share-row input` and `button` (the BYOK panel's field, and the account sheets' key button): `--r-md`.
  - Each `textFloors` row reads `color: var(--token)`. `.sp-manage-value` takes `--caution-ink-masked` and `.sp-reveal` `--caution-ink-faint`, which already do.
- `Share panel: signed in`, onto tokens:
  - `.sp-account-note`: `--ink-muted` (a sentence), and its glyph `--rsvp-yes`.
  - `.sp-manage-collapsed`: `--caution-wash`, `--caution-edge`, `--caution-edge-hi` on hover, `--r-md`. Its glyph `--caution-ink-faint`, its label and action `--caution-ink`.
  - `.sp-manage-hide`: `--caution-ink-faint`, and `--caution-ink` on hover.

- [ ] **Step 4: Run the web suite.** Expected: PASS. If a floor fails, move the value, never the floor (adr-019's revisit trigger), and record the move in the amendment.

- [ ] **Step 5: Commit**

```bash
git commit -m "Set the share panel on paper, and its manage-token block toward kraft (adr-019 §1, §10)"
```

## Task 4: The sign-in gate and the account sheets on paper

**Files:**
- Modify: `web/src/styles.css` (`Sign-in gate`, `Account sheets`), `web/src/components/editor/AuthGate.tsx`, `web/src/components/SignOutSheet.tsx` and `web/src/components/DeleteAccountSheet.tsx` (icons to `currentColor`)
- Test: `web/test/styles.test.ts`. `web/test/accountUi.test.tsx` and `web/test/publishGate.test.tsx` don't change and must stay green.

- [ ] **Step 1: Write the tests**

Add `"Account sheets"` and `"Sign-in gate"` to `CONVERTED`, and:

```ts
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
});
```

Extend `the guest page's, the landing's and the dashboard's components` (renamed `…, the dashboard's and the editor's components`) to `components/editor/`, `App.tsx`, `ByokSettings.tsx`, `SignOutSheet.tsx` and `DeleteAccountSheet.tsx`, allowing exactly the Google mark's four brand colours in `AuthGate.tsx`:

```ts
// Google's sign-in mark must be drawn in Google's own colours.
const GOOGLE_MARK = ["#4285F4", "#34A853", "#FBBC05", "#EA4335"];
```

- [ ] **Step 2: Run them and see them fail.**

- [ ] **Step 3: Implement**
- `Sign-in gate`, literal by literal: `#fff` → `--surface`; `#23211d` → `--ink`; `#6b6659` → `--ink-muted`; `#8d8577` on a sentence (`.ag-note`) → `--ink-muted`, and on a text button (`.ag-textbtn`) → `--ink-faint`; `#c3bbac` (the disabled text button and the error code) → `--ink-faint`; `#e4ddd0`, `#ddd6c8` → `--edge`; `#c9bfab` → `--edge-strong`; `#ece7dd`, `#f0eadf`, `#eee8dd`, `#f4ece1` → `--edge-soft`; `#faf8f4`, `#f4efe6` → `--app-bg`; `#f7f5f1` → `--wash`; `#f2e7de` → `--accent-wash`; `#faf6f0` → `--caution-wash` (the manage block's skeleton); `#b3592e` → `--ui-accent`; `#9f4d26` → `--accent-hi`; `#fbf0ef`, `#eed3d1` → `--rsvp-no-bg`, `--rsvp-no-edge`.
  - The retry's glow reads `--ui-accent-rgb`. The scrim becomes `rgba(28, 26, 23, 0.3)`, the paper ink's warm black.
  - Radii: the sheet's top corners `--r-xl` (and `--r-xl` all round as the desktop popover), its buttons and fields `--r-lg`, the draft row `--r-md`. The grab handle keeps its pill.
  - The `≥ 800px` popover's shadow becomes `--e-3`.
- `Account sheets`: `#f4f7f4`, `#d9e5da`, `#2f5637` → `--rsvp-yes-bg`, `--rsvp-yes-edge`, `--rsvp-yes`; `#3f4f42` → `--ink`; `#6b6659` → `--ink-muted`; `#f8f2ea`, `#ecdcc9`, `#7a5638` → `--caution-wash`, `--caution-edge`, `--caution-ink`; `#a83f3f` → `--rsvp-no`. `.da-confirm:hover` underlines in place of its darker `#8f3535`, so no token is minted for one hover. `#23211d` → `--ink`. Radii to `--r-lg`.
- Icons:
  - `AuthGate.tsx`: the spinner's two strokes become `currentColor`, the track at `opacity="0.25"`, coloured by `.ag-spin { color: var(--ui-accent) }`. The mail and info glyphs: `currentColor`, coloured `--ink-faint` by `.ag-note svg`. The check: `--rsvp-yes`; the fail mark: `--rsvp-no`; the retry arrow: `currentColor`.
  - `SignOutSheet.tsx`, `DeleteAccountSheet.tsx`: the check `currentColor` in `--rsvp-yes`, the lock `currentColor` in `--caution-ink-faint`. `SignOutSheet`'s doc comment names `--ink-muted` instead of `#6b6659`.

- [ ] **Step 4: Run the web suite.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "Set the sign-in gate and the account sheets on paper (adr-019 §11)"
```

## Task 5: The card on the mat, and tabs that pin

**Files:**
- Modify: `web/src/components/editor/PreviewPanel.tsx`, `web/src/components/editor/DesignToolbar.tsx` (its sheet moves above the strip it now sits in) and `web/src/styles.css` (`Creation chat`)
- Test: `web/test/styles.test.ts` (`the editor canvas`) and a new `web/test/PreviewPanel.test.tsx`

- [ ] **Step 1: Write the tests**

`PreviewPanel.test.tsx` renders the panel with an invitation:

```tsx
describe("the editor's canvas (adr-019 §7.1)", () => {
  it("sets the card on the deckled mat, as the guest receives it", () => {
    const { container } = renderPreview();
    const mat = container.querySelector(".cc-mat > .deckle");
    expect(mat?.querySelector(".inv")).toBeTruthy();
  });

  // The roadmap's sticky bug: as the scroller's first child the toolbar never
  // pinned and scrolled away. After the card, it sticks to the pane's bottom.
  it("puts the design tabs after the card", () => {
    const { container } = renderPreview();
    const inner = container.querySelector(".cc-preview-inner") as HTMLElement;
    const kids = [...inner.children].map((el) => el.className);
    expect(kids[0]).toContain("cc-mat");
    expect(kids.at(-1)).toContain("cc-design");
  });
});
```

In `styles.test.ts`, `the editor canvas`:
- Replace `near-bleeds the card without touching InvitationPreview's own rules`: no `.cc-canvas .inv` rule remains, `.inv` keeps its 14 px radius, and `.cc-mat` sets `filter: drop-shadow(…)`.
- Add: `.cc-design` is `position: sticky` with `bottom: 0`, and `.cc-preview` doesn't set `align-items: center`.

- [ ] **Step 2: Run them and see them fail.**

- [ ] **Step 3: Implement**
- `PreviewPanel`: `.cc-preview-inner.cc-canvas` holds `<div className="cc-mat"><div className="deckle"><InvitationPreview …/></div></div>`, then the `DesignToolbar`. A comment names the guest page's `.gr-mat` as its twin, and says the mat wraps the card and never sits on it (§3).
- `DesignToolbar`: no markup change in this task. `.cc-design` is already a column of the open sheet over the strip, which is the order it needs at the bottom.
- CSS:
  - `.cc-mat { filter: drop-shadow(var(--e-2)); }`, beside a comment that names `.gr-mat`.
  - `.cc-preview`: drop `align-items: center` and `justify-content: center`. `.cc-preview-inner` gets `margin: auto` (safe centring), keeps `width: min(460px, 100%)` and gains `display: flex; flex-direction: column; gap: 14px`.
  - `.cc-design`: `position: sticky; bottom: 0; z-index: 2`. Rewrite its comment: what it is now, and that the bug it had is fixed (the roadmap's entry closes in Task 9).
  - `@media (max-width: 800px)`: `.cc-preview` padding becomes `12px 20px`, the guest page's side padding. Delete `.cc-canvas .inv { box-shadow: var(--e-1); }`.
  - Delete the near-bleed comment block, which describes an override that's gone, and the dead `.cc-preview-inner .design-controls` rule.

- [ ] **Step 4: Run the web suite.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "Set the editor's card on the guest's mat, and pin the design controls under it (adr-019 §7.1)"
```

## Task 6: Underlined tabs, and «Конверт»

**Files:**
- Modify: `web/src/components/editor/DesignToolbar.tsx`, `web/src/components/editor/PreviewPanel.tsx` (passes the title and monogram) and `web/src/styles.css` (`Creation chat` and `Design controls`)
- Test: `web/test/DesignToolbar.test.tsx` and `web/test/styles.test.ts`

**Interfaces:**
- `DesignToolbar` gains `envelope: { title: string; monogram: string; hasHosts: boolean }`. `PreviewPanel` computes it from the invitation: `copy.title`, `monogramFrom(brief.hosts)` and `brief.hosts.length > 0`.

- [ ] **Step 1: Write the tests.** `DesignToolbar.test.tsx`'s `renderToolbar` passes `envelope={{ title: "Весілля", monogram: "М&А", hasHosts: true }}`. Then:

```tsx
describe("DesignToolbar tabs (adr-019 §7.3)", () => {
  it("names five tabs, with ornament inside «Макет»", () => {
    const { container } = renderToolbar({ onBackgroundAdd: () => {} });
    const tabs = [...container.querySelectorAll(".cc-tab")].map((t) => t.textContent);
    expect(tabs).toEqual(["Палітра", "Шрифт", "Макет", "Конверт", "Фон"]);
  });

  it("opens composition and ornament together under «Макет»", () => {
    renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: "Макет" }));
    expect(screen.getByRole("group", { name: UI.uk.design.layout })).toBeTruthy();
    expect(screen.getByRole("group", { name: UI.uk.design.ornament })).toBeTruthy();
  });

  // Disclosures, not ARIA tabs: none is open at rest, and a second press closes.
  it("expands and collapses rather than selecting", () => {
    renderToolbar();
    const tab = screen.getByRole("button", { name: "Палітра" });
    expect(tab.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(tab);
    expect(tab.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(tab);
    expect(tab.getAttribute("aria-expanded")).toBe("false");
  });

  // The override is deferred (adr-019 §9.2), so the tab shows and never asks.
  it("shows the envelope guests open, with the hosts' seal, and no input", () => {
    const { container } = renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: "Конверт" }));
    const sheet = container.querySelector(".cc-design-sheet") as HTMLElement;
    expect(sheet.querySelector(".cc-env-to")?.textContent).toBe("Весілля");
    expect(sheet.querySelector(".cc-env .seal")?.textContent).toBe("М&А");
    expect(sheet.querySelector("input, textarea, select")).toBeNull();
    expect(sheet.textContent).toContain(UI.uk.design.envelopeNote);
  });

  it("says where the seal comes from when no host is named", () => {
    renderToolbar({ envelope: { title: "Свято", monogram: "I", hasHosts: false } });
    fireEvent.click(screen.getByRole("button", { name: "Конверт" }));
    expect(screen.getByText(UI.uk.design.envelopeNoHosts)).toBeTruthy();
  });
});
```

Update the existing cases from `.cc-seg-item` to `.cc-tab` and to five tabs where `Фон` shows. The ornament case opens «Макет».

`styles.test.ts`:
- `[".cc-tab", "--surface", 4.5]`, `[".cc-env-to", "--kraft", 4.5]` and `[".cc-env-note", "--surface", 4.5]` in a `textFloors("Creation chat", …)`.
- The open tab's underline reads `--ui-accent` and its text `--ui-ink`, never the palette-shadowed names.
- `.design-option` takes `--r-md` (the `Design controls` section has a literal 6 px).

- [ ] **Step 2: Run them and see them fail.**

- [ ] **Step 3: Implement**
- `DesignToolbar`: segments become `palette`, `typography`, `layout` (labelled `layoutTab`), `envelope`, then `background` when it shows. The «Макет» sheet holds two `role="group"` rows, labelled `layout` and `ornament`, with today's options. The strip is `<div className="cc-tabs" role="group">` of `<button className="cc-tab">`, keeping `aria-expanded`. Rewrite the component's doc comment: tabs that open sheets, and why they're disclosures.
- The «Конверт» sheet: `<div className="cc-env" aria-hidden="true">` holding `.cc-env-flap`, `p.cc-env-to` (the title) and `span.seal.cc-env-seal` (the monogram), then `p.cc-env-note` with `envelopeNote`, or `envelopeNoHosts` when `!hasHosts`. A comment says it's a picture of the guest page's `.gr-env-*`, and that the override is deferred (§9.2).
- `DesignSheet` takes its rows as children as now. `cc-design-sheet-title` stays the sheet's heading.
- CSS, in `Creation chat` (replacing `.cc-seg` and `.cc-seg-item`):
  - `.cc-tabs { display: flex; background-color: var(--surface); border-top: 1px solid var(--edge); box-shadow: var(--e-1); }`
  - `.cc-tab { flex: 1; padding: 12px 4px 10px; border: none; border-bottom: 2px solid transparent; background: none; font: inherit; font-size: 0.8rem; font-weight: 600; color: var(--ink-muted); cursor: pointer; }`, and `.cc-tab.on { color: var(--ui-ink); border-bottom-color: var(--ui-accent); }`.
  - `.cc-env`: 4:3, about 200 px wide, `--kraft`, `--r-sm`, `--e-2`, centred in the sheet. `.cc-env-flap` is the landing's 58 % `--kraft-deep` triangle. `.cc-env-to` is the display face at 400, `--ui-ink`, one line, ellipsized. `.cc-env-seal` is about 44 px on the flap's point. `.cc-env-note` is 0.82 rem, `--ink-muted`.
  - `.cc-design-sheet`'s grab handle stays.

- [ ] **Step 4: Run the web suite.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "Underline the design tabs, fold ornament into «Макет», and show the envelope (adr-019 §7.3)"
```

## Task 7: The header: a bar, the seal, and the replies so far

**Files:**
- Create: `web/src/hooks/useReplyCounts.ts` and `web/src/components/editor/EditorHeader.tsx`
- Modify: `web/src/App.tsx` (renders `EditorHeader`) and `web/src/styles.css` (`Creation chat`)
- Test: create `web/test/useReplyCounts.test.ts` and `web/test/EditorHeader.test.tsx`. Modify `web/test/styles.test.ts`.

**Interfaces:**
- `useReplyCounts(published: { id: string; manage_token: string; version: number } | null): RsvpCounts | null`.
- `EditorHeader({ title, monogram, published, counts, onBack, children, t })`, where `children` are the existing controls (the AI key, the language switch, Publish), so their props stay in `App`. `published` is the publish result or null; the link renders only when it's present.
- `repliesLine(counts: RsvpCounts | null, t: ChatStrings): string`, exported for the test.

- [ ] **Step 1: Write the tests**

`useReplyCounts.test.ts` stubs `fetchCounts` through `vi.mock("../src/api")`:

```ts
describe("useReplyCounts (adr-019 §7.2)", () => {
  it("asks for nothing before the first publish", () => {
    renderHook(() => useReplyCounts(null));
    expect(fetchCounts).not.toHaveBeenCalled();
  });

  // adr-012's endpoint: counts only. The editor never reads names or notes.
  it("asks the counts endpoint for this invitation, with its token and no seen marker", async () => {
    vi.mocked(fetchCounts).mockResolvedValue([{ id: "abc123", status: "ok", counts: COUNTS }]);
    const { result } = renderHook(() => useReplyCounts(PUBLISHED));
    await waitFor(() => expect(result.current).toEqual(COUNTS));
    expect(fetchCounts).toHaveBeenCalledWith([{ id: "abc123", token: TOKEN }]);
  });

  it("asks again after a republish, and when the tab comes back", async () => { /* version 3 → 4; then visibilitychange */ });

  it("keeps quiet when the request fails or the token is refused", async () => {
    vi.mocked(fetchCounts).mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useReplyCounts(PUBLISHED));
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current).toBeNull();
  });
});
```

`EditorHeader.test.tsx`, in a `MemoryRouter`:

```tsx
describe("the editor's header (adr-019 §7.2)", () => {
  it("seals the bar with the hosts' monogram beside the title", () => {
    const { container } = renderHeader({ published: null });
    expect(container.querySelector(".cc-header .seal")?.textContent).toBe("М&А");
    expect(container.querySelector(".cc-title")?.textContent).toBe("Весілля Марії та Андрія");
  });

  it("offers no replies link before the first publish", () => {
    renderHeader({ published: null });
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("links to the dashboard with the replies so far, headcount first", () => {
    renderHeader({ counts: { yes: 7, no: 3, maybe: 2, guests: 16 } });
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/manage/abc123");
    expect(link.textContent).toBe("16 буде · 3 ні · 2 можливо");
  });
});

describe("repliesLine", () => {
  const t = UI.uk.chat;
  it("leaves out an answer nobody gave", () => {
    expect(repliesLine({ yes: 2, no: 0, maybe: 0, guests: 4 }, t)).toBe("4 буде");
  });
  it("says so when no one has replied", () => {
    expect(repliesLine({ yes: 0, no: 0, maybe: 0, guests: 0 }, t)).toBe(t.repliesNone);
  });
  it("names the link when the counts are unknown", () => {
    expect(repliesLine(null, t)).toBe(t.repliesLink);
  });
});
```

The link's accessible name is `${t.repliesLink}: ${line}`, so the test's `getByRole("link")` stays unnamed and the `textContent` check reads the visible line.

`styles.test.ts`: `[".cc-title", "--surface", 4.5]` and `[".cc-replies", "--surface", 4.5]` join the `Creation chat` floors. `.cc-header` sets `background-color: var(--surface)` and no `border-radius: var(--r-pill)`. The display-face weight test covers `.cc-title`.

- [ ] **Step 2: Run them and see them fail.**

- [ ] **Step 3: Implement**
- `useReplyCounts`: the effect keys on `published?.id` and `published?.version`, calls `fetchCounts([{ id, token: manage_token }])` and keeps `counts` from an `ok` result. A `visibilitychange → visible` listener refetches, as `useHostManage` does (adr-010 §6). Every failure is swallowed (adr-012 §6). `active` guards a late answer after unmount. Its doc comment says why this endpoint and not `/rsvps`: the editor shows two numbers and has no business holding guests' names.
- `EditorHeader`: `<header className="cc-header">` with the back button, `<span className="seal cc-seal" aria-hidden="true">`, a title column (`.cc-title`, then `.cc-replies`, a `<Link>` when `published`), and `.cc-header-right` holding `children`. The seal is `aria-hidden`, because the title says the same thing in words.
- `App.tsx`: renders `EditorHeader` with `monogramFrom(editor.invitation?.brief.hosts ?? [])` and `useReplyCounts(publishing.published)`. It stays composition only. The `cc-header glass` markup moves out of `App`.
- CSS:
  - `.cc-header`: a grid, `grid-template-areas: "back seal title right" "back seal replies right"`, about 56 px tall, `padding: 0 8px`, `background-color: var(--surface)`, `border-bottom: 1px solid var(--edge)`. No margin, no radius, no `.glass`.
  - `.cc-seal`: about 30 px, `font-size: 0.62rem`.
  - `.cc-title`: the display face at 500, about 1.05 rem, left-aligned, ellipsized.
  - `.cc-replies`: 0.78 rem, weight 600, `--ink-muted`, ellipsized, underlined on hover.
  - `@media (max-width: 480px)`: the seal hides; the areas become `"back title right" "replies replies replies"`, and `.cc-replies` takes an `--edge-soft` rule above it and a 6 px pad, so it reads as a row of its own.
  - `.cc-share`: `--r-md`. Its idle state is `background-color: var(--edge-soft); color: var(--ink-muted)` (decision 20).
  - `.cc-share-panel`'s `top` and `.ag-scrim`'s desktop top padding follow the bar's new height.

- [ ] **Step 4: Run the web suite.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "Seal the editor's header, and show the replies so far after publishing (adr-019 §7.2)"
```

## Task 8: The chat on paper

**Files:**
- Modify: `web/src/styles.css` (`Creation chat`)
- Test: `web/test/styles.test.ts`. `web/test/ChatPanel.test.tsx` doesn't change and must stay green.

- [ ] **Step 1: Write the tests**

```ts
describe("the chat on paper (adr-019 §7.4)", () => {
  it("sets the peek line in the assistant's voice: Literata italic", () => {
    const peek = ruleBlocks(stripComments(css)).filter((r) => r.selectors.includes(".cc-peek"));
    const body = peek.map((r) => r.body).join(";");
    expect(body).toMatch(/font-family:\s*var\(--ui-font-display\)/);
    expect(body).toMatch(/font-style:\s*italic/);
  });

  // adr-019 §1: stationery corners; the pill stays for the language switch.
  it("keeps the pill for the grab handle alone", () => {
    const readers = ruleBlocks(stripComments(sections(css).get("Creation chat") ?? ""))
      .filter((r) => /var\(--r-pill\)/.test(r.body))
      .flatMap((r) => r.selectors);
    expect(readers).toEqual([".cc-sheet-grab"]);
  });
});
```

`[".cc-peek", "--surface", 4.5]` joins the `Creation chat` floors.

- [ ] **Step 2: Run them and see them fail.**

- [ ] **Step 3: Implement**
- `.cc-peek`: `font-family: var(--ui-font-display); font-style: italic; font-weight: 400; font-size: 0.9rem; color: var(--ink-muted)`.
- `.cc-chip`, `.cc-composer input`, `.cc-key-save`, `.cc-key-clear`: `--r-md`. `.cc-send` and `.cc-back` stay round.
- `.cc-skeleton`'s literal shadow becomes `--e-2`. `.cc-placeholder` takes `background-color: var(--surface)` in place of `rgba(255, 255, 255, 0.5)`, which on the table read as a grey wash.

- [ ] **Step 4: Run the full suite** with `pnpm build && pnpm test`, checking the exit code.

- [ ] **Step 5: Commit**

```bash
git commit -m "Set the chat on paper, with the peek line in the assistant's voice (adr-019 §7.4)"
```

## Task 9: Docs in the same PR

- `docs/02-functional-requirements.md`:
  - New FR-3.7, the editor on paper: the card on the guest's mat at the guest's width; the header's seal and, after a publish, its link to `/manage/:id` with the counts from adr-012's endpoint, refreshed on publish and on return to the tab, silent on failure; the five tabs, with «Конверт» showing the envelope and no override (§7).
  - FR-12.6 and FR-12.7: the share panel's control is FR-12.12's checkbox.
  - FR-12.12: the share panel joins the landing footer and the dashboard; its offer names the address and "every invitation in your account", its on state "not just this one". Delete "keeps its sentence and button until…".
- `docs/03-non-functional-requirements.md`: re-measure NFR-1. NFR-9: the deckled mat wraps the card in the editor too; the `--caution-*` distance is now tested; the sign-in gate and the account sheets are among the converted surfaces.
- `docs/04-architecture.md`: the editor's header reads the counts endpoint (check the route table and the client section name it).
- `docs/decisions/adr-019-paper-direction.md`:
  - A dated "**Amended 2026-xx-xx, step 5.**" under §7: the boards waived by the owner, then the decisions table (the counts' source amends §7.2's "`/rsvps`").
  - §1's step-1 amendment: the `--caution-*` re-tune is done, with its values, and the test that pins it exists.
  - §10's status: the share panel is built, all three surfaces carry the checkbox, and `feat/ds-notify-checkbox` is deleted.
  - §12.5: *Built 2026-xx-xx.*
- `docs/decisions/adr-010-host-manage-link.md`: a new §3.1, "The hierarchy counts fills, not affordances", quoting adr-019 §10's rule.
- `docs/decisions/adr-015-rsvp-notifications.md`: the 2026-10-24 amendment's last clause ("the share panel follows in the editor step") becomes what shipped.
- `docs/06-roadmap.md`:
  - The "Unported: PR #66" note: the share panel shipped, the reference branch is gone.
  - The toolbar entry ("coupled to adr-018 §7's hardware gate") is struck through as fixed, with why the gate no longer applies (adr-019 §4.1).
  - The raw-hex backlog: `Sign-in gate`, `Account sheets`, `Share panel: signed in` and `Reply notifications` are gone. `Gallery` 22 and `Crash screen` 12 remain.
- `web/CLAUDE.md`:
  - Host access: the share panel's reply email is `NotifyCheckbox`. Delete "keeps a sentence and a button until adr-019's step 5".
  - Structure: `useReplyCounts` joins the hooks, and `EditorHeader` the editor components.
  - Material system: the editor sets the card on the deckled mat, like the guest page; the account sheets converted with the gate.
- `.design-sync/NOTES.md`, "Re-sync risks": `conventions.md`'s "palette-tinted ground" sentence is now also wrong about the inset (the mat replaced the near-bleed). Leave `conventions.md` itself for the next full resync, as before.

- [ ] **Commit**

```bash
git commit -m "Record the editor on paper: FR-3.7, FR-12.6–12.12, NFR-1, NFR-9, adr-019 §7, adr-010 §3.1"
```

## Task 10: Look, then the PR

- [ ] **Step 1: Look at it**

Build, then start the server **from `server/`** (`cd server && node dist/index.js`): it serves the SPA relative to its working directory. Restart it after every rebuild, because it holds the old shell. Drive it with Playwright, mocking `/api/invitations/generate`, `/publish`, `/counts` and the session, at 360, 390 and 1280 px in both languages. Check:
- before an invitation, while generating, and with one: the placeholder, the skeleton and the card on the mat
- the card's width against `/i/:id` at the same viewport, measured, not by eye
- the tabs at rest and with each sheet open; «Конверт» with hosts and without; a long card on desktop scrolled to its top
- the header before publishing, then after it with 0 replies, with some, with a maybe, and with `/counts` failing; the counts row at 360
- the share panel signed out, signed in collapsed and open, mail on and off (Tab and Space on the checkbox), with and without `navigator.share`
- the gate's five frames, and the sign-out and delete sheets from the landing
- every Review Focus item, and no horizontal scroll

- [ ] **Step 2: Open the PR.** Follow `.github/pull_request_template.md`, with the decisions table, the kraft measurements, the copy table, the NFR-1 figure and what the look checked. Say plainly that the two boards were waived. **Confirm the branch is still on the remote before creating the PR.** GitHub deletes a merged head branch, and a re-push recreates it as an orphan.

## After this plan

- **Delete `feat/ds-notify-checkbox`** once this merges (§10, §12.6).
- **Design sync** after merge, as after steps 4 and 6. It's a full resync this time, not the CSS-only shortcut: the `--caution-*` and editor tokens should reach the token panel, and `conventions.md`'s ground and inset sentence is fixed in the same pass.
- **Step 8, the gallery**, onto the ratchet (§11), then **step 9**, the rename.
- When this ships, move this plan to `docs/superpowers/archive/plans/`, as steps 1–4, 6 and 7's were.

### Not in this plan

- **The monogram override** (§9.2, deferred). «Конверт» shows the derived seal and asks nothing.
- **Keeping unpublished edits across a trip to the dashboard.** The header link leaves the editor in the same tab, as the share panel's link and the back button already do. Edit-after-publish is the roadmap's open gap, and wants its own ADR.
- **A polling count.** adr-010 §6's rule holds: on publish and on return to the tab.
- **The crash screen's stale accent** (`rgba(179, 89, 46, 0.26)` on its button). It's a surface of its own on the allowlist (§11), and converts with it.
- **The desktop transcript's bubbles in Literata.** §7.4 names the peek line only.
