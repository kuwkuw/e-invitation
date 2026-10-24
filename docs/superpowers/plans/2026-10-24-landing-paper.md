# Landing on Paper: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/` in the paper direction (adr-019 rollout step 4). The hero shows the product working: a sentence types itself into a composer, and the invitation it describes rises out of an envelope on the `--table`. Add a "What guests see" section, a stat strip with the one true number, four FAQ questions, and the corrected pricing copy. Make reply email a checkbox on the account footer, the first of §10's three surfaces.

**Architecture:** One PR, built in tasks that each leave the suite green. The copy lands first, all in `LANDING` and `AUTH`. The checkbox is a shared component, `NotifyCheckbox`, because steps 5 and 6 put it on the share panel and the manage page. The hero, the guests section and the FAQ are new components under `components/landing/`, and `LandingPage.tsx` stays composition only (`web/CLAUDE.md`). Every animation is CSS in one `prefers-reduced-motion: no-preference` block, so reduced motion gets the finished hero and never has to be detected. Every new line of copy goes into `landingBodyHtml` in the same task that renders it, in the same classes. That way the prerendered page and the mounted one never say different things between tasks. There's no server change and no new fetch.

**Tech Stack:** React 19, CSS custom properties and keyframes, Vitest with jsdom and `@testing-library/react`, Biome.

**Spec:** [adr-019](../../decisions/adr-019-paper-direction.md) §3, §6 and §10. Its long form is the [paper-direction spec](../specs/2026-10-21-paper-direction-design.md) §6. The canvas row `A2 · Landing` on *Invinto Redesign — Directions* is the visual reference. Like step 3's, this plan was written without the canvas, from adr-019's text alone. **Open the canvas before Task 8's look** if it can be found, and record any disagreement in the PR. adr-019 wins over the canvas. The reply-email checkbox and the sign-in pair are redone from PR #66's design pass. Its code is on `feat/ds-notify-checkbox` (commits `58a504e` and `9e08178`) and is the reference, not something to merge.

## Global Constraints

- **The card is untouched.** `InvitationPreview.tsx` and the `Invitation card` section of `styles.css` stay byte-identical, as do every `.palette-*`, `.type-*`, `.layout-*` and `.ornament-*` rule. No material class sits on `.inv` or inside it (adr-019 §3); the `paper materials` tests hold it. Context rules that resize the hero's card (`.lp-stage-card .inv …`) live in the `Landing page` section, as the fan's did.
- **WKWebView is the floor** (`CLAUDE.md`, Browser support). Everything here is Baseline Widely available: `clip-path: polygon()`, `<details>`/`<summary>`, `steps()`, flex alignment, `filter: drop-shadow()`. Safari still draws the disclosure triangle unless `summary::-webkit-details-marker` is hidden, so hide both markers. No feature detection and no polyfill.
- **No server change and no new request.** The stat strip fetches nothing (decision 7). The landing test stubs throw on any URL they don't expect, so an accidental `/api/metrics` call fails them.
- **No schema change.** `schemas.ts` and `types.ts` don't move.
- **No raw hex** in `Landing page`, `Landing: account footer` or the new `Reply email checkbox` section, all of which are in `CONVERTED`. None in any component this plan touches either: Task 3 extends the component hex test to `components/landing/`, `NotifyCheckbox.tsx` and `AccountFooter.tsx`. Icons stroke `currentColor`.
- **An element that carries `.grain` sets `background-color`, never the `background` shorthand**, which would wipe the grain (`web/CLAUDE.md`). `.landing` uses the shorthand today, and Task 4 fixes it.
- **Motion lives in one block.** Every `animation` in the `Landing page` section sits inside its single `@media (prefers-reduced-motion: no-preference)` block. The rise moves only `transform` and `opacity`, and the typing moves only `max-width`. Tasks 3 and 4 add a test for it.
- **Prerendered and mounted markup say the same thing** (adr-016 §10, FR-13.10). Each task that adds copy adds it to `landingBodyHtml` in the same classes and tests it. Decoration (the stage and the guests' envelope) stays out of the prerender, as the fan did.
- Every user-visible string is in `LANDING` or `AUTH` in `i18n.ts`, in both languages, with the same shape (`test/i18n.test.ts`).
- **The share cards need no regeneration.** The after-edit hook names them when `LANDING` changes. Their headline and chips don't move, and their two lines paraphrase `heroText` without the «за хвилину» clause this plan moves (decision 6). Say so in the PR, so the mirror check has its answer.
- Branch `feat/paper-landing` from `main`.
- Run one file with `pnpm --filter inv-app-web exec vitest run test/<file>`. Run everything with `pnpm build && pnpm test`.

### What this plan decides that adr-019 left open (review these first)

| # | Question | This plan's answer | Why |
|---|---|---|---|
| 1 | The hero's three-card fan | One invitation, the wedding sample, rising out of the envelope. The kids and corporate samples are retired: `LANDING.samples` becomes `LANDING.sample`, and FR-6.4 is amended | §6.1 raises *the* invitation. Range lives in the gallery (FR-14), one link away in the nav |
| 2 | What the composer types | «Весілля Марії та Андрія, 6 червня, Одеса» / "Mariya and Andriy's wedding, 6 June, Odesa" | The sentence that would make the card that rises: same couple, day and city (tested). At most 44 characters, so it types on one line |
| 3 | How a proportional, Cyrillic sentence types in CSS alone | `max-width` from 0 in `steps(40)` on a `nowrap` span, inside a `flex-end` line, with `margin-right: auto` on the span. While the sentence fits it sits left. Once it outgrows the box it overflows to the left, keeping the newest words in view the way an input scrolls | A wrapped line can't be typed without per-letter markup, and adr-019 wants the text to be one full sentence. All of this sits in the no-preference block. Under reduced motion the sentence is static and wraps |
| 4 | The typing class in the prerender | Kept: the prerendered span carries `lp-typing` too | On a fast connection React mounts inside the 0.4 s delay and the swap is invisible. On a slow one the typing restarts at mount, which beats a full sentence flashing up and vanishing |
| 5 | Is the composer an input? | No. It's labelled «Наприклад» / "For example", its only control is the call to action, and it has no send glyph | A box that looks typeable but isn't is a dead control. A live composer is a behaviour change (Not in this plan) |
| 6 | "The sub-line gains the differentiator" | `heroText` drops «за хвилину» / "in a minute", and a new `heroPromise` line says «За хвилину, а не за чотири робочі дні.» | Two lines that both said "a minute" would read as a stammer |
| 7 | The stat strip | One cell: «1 хвилина» / «від речення до готового запрошення». No fetch. Markup is a strip of `.lp-stat` cells, so a count arrives later as one more cell | adr-019 collapses the strip to the one true cell. `/api/metrics` does carry `publishes` and `rsvps`. But wiring them puts a request on every landing load for numbers nobody has decided are worth showing |
| 8 | "A still of the envelope and seal" | A closed kraft envelope on `--night`, carrying the sample's title and a seal with «М&А» (`monogramFrom([sample.closing])`). Copy is a heading, a sentence and three points, each true by FR-4.5/4.8/4.9 | The guest's first frame, shown rather than played. Built as landing rules on the envelope tokens, not by reusing `.gr-env-*`, which is a fixed overlay driven by phases |
| 9 | The FAQ | Four questions, below. «Скільки це коштує?» answers «Безкоштовно.» (§6.4). The strings live in `LANDING` only, and the prerender reads them. No `FAQPage` JSON-LD | "Joins the `LANDING`/SEO mirror discipline" means one source that the crawler reads too. No server copy exists to mirror, because there's no structured data: Google retired FAQ rich results (adr-016 §7) |
| 10 | A seal in the nav | None | The step-3 plan's "hero and nav" isn't in adr-019 §6. The nav fits a 360 px phone with nothing to spare (`styles.test.ts` pins that measurement) |
| 11 | Where grain goes | On the `.landing` ground and on the hero's `--table` stage. The nav, the replies band and the cards are card stock and stay plain | adr-019 §3: page grounds and `--table` fields |
| 12 | The footer's envelope | Stays as the label for the address, never struck. The strike and its knockout go | §10's "the envelope leaves the account footer" read as the *state-carrying* envelope. #66 kept the plain glyph as the address's label. If the ADR meant the glyph itself, delete the `svg` and its entry in the sub-faint list |
| 13 | Checkbox copy | The name is the existing `notifyOptIn`. The states are #66's `notifyStateOnAccount` and `notifyStateOffNow`. `notifyOff` retires: the footer was its only reader. The share panel and manage keep their keys until steps 5 and 6 | One name for both states. The scope rides the state row, before the host agrees |
| 14 | Where the checkbox's CSS lives | Its own banner section, `Reply email checkbox`, added to `CONVERTED`. The checked box fills with `--ink-muted`, the empty box is edged in `--ink-faint` (3:1 on both grounds), and the focus ring is `--ink`. Never the accent | Steps 5 and 6 reuse it without moving it. The accent means "the public link" (adr-010 §3) |
| 15 | The sign-in link as "a quiet pair" with the switcher | Its order is already right on `main` (sign-in, switcher, Create), and #66's order test pins it. **No colour change** | The switcher's idle segment is `--ink-faint`, 4.23:1 on `--surface`. Matching it would put the link under the 4.5:1 floor `styles.test.ts` holds it to, and it's been on paper tokens since step 1 |
| 16 | Where the new components go | `components/landing/`: `HeroComposer`, `HeroStage`, `GuestsSection` and `LandingFaq`. `NotifyCheckbox` goes at the `components/` root, because three surfaces will share it. `AccountFooter` and `YourInvitations` stay put | Moving them would be churn in a PR that's already large |

**The copy, for review.** Every claim below is true today, and the FR it rests on is named.

| Key | Українська | English | True by |
|---|---|---|---|
| `heroText` | Опишіть подію словами — отримайте гарне запрошення. | Describe your event in words — get a beautiful invitation. | |
| `heroPromise` | За хвилину, а не за чотири робочі дні. | In a minute, not four working days. | NFR-1, adr-019 §6.1 |
| `composerLabel` | Наприклад | For example | |
| `heroSentence` | Весілля Марії та Андрія, 6 червня, Одеса | Mariya and Andriy's wedding, 6 June, Odesa | the sample |
| `composerNote` | Безкоштовно · без реєстрації для гостей | Free · no sign-up for guests | §6.4, FR-4.1 |
| `statValue` / `statLabel` | 1 хвилина / від речення до готового запрошення | 1 minute / from a sentence to a finished invitation | NFR-1 |
| `guestsTitle` | Що побачать гості | What your guests see | |
| `guestsText` | Запрошення приходить конвертом із печаткою — вашими ініціалами. Гість відкриває його одним дотиком і відповідає там само. | The invitation arrives as an envelope sealed with your initials. Guests open it with one tap and reply right there. | FR-4.8 |
| `guestsPoints[0]` | Відкривається у Viber, Telegram чи WhatsApp — без реєстрації й застосунків | Opens in Viber, Telegram or WhatsApp — no sign-up, no app | FR-4.1, FR-3.5 |
| `guestsPoints[1]` | Зворотний відлік до свята, маршрут і додавання в календар | A countdown to the day, directions, and add to calendar | FR-4.5, FR-4.9 |
| `guestsPoints[2]` | Відповідь «так» чи «ні» — і ви одразу її бачите | A yes or no reply — and you see it straight away | FR-4.3, FR-5.2 |
| `faqTitle` | Часті запитання | Common questions | |
| `faq[0]` | Скільки це коштує? — Безкоштовно. | How much does it cost? — It's free. | §6.4, 07-monetization §5.2 |
| `faq[1]` | Чи треба гостям реєструватися? — Ні. Гості відкривають посилання в будь-якому месенджері й відповідають без реєстрації та без застосунку. | Do guests need to sign up? — No. Guests open the link in any messenger and reply without signing up or installing anything. | FR-4.1, FR-4.3 |
| `faq[2]` | Як я побачу, хто прийде? — Усі відповіді збираються на вашій сторінці відповідей: хто прийде, скільки з ними гостей і їхні побажання. Список можна завантажити у CSV. | How do I see who's coming? — Every reply lands on your replies page: who's coming, how many guests they're bringing, and their notes. You can download the list as a CSV. | FR-5.2, FR-5.3, FR-4.3 |
| `faq[3]` | Якою мовою буде запрошення? — Тією, якою ви опишете подію: українською або англійською. Гості можуть перемкнути мову сторінки, але слова запрошення залишаться вашими. | What language will the invitation be in? — The one you describe the event in: Ukrainian or English. Guests can switch the page's language, but your invitation's words stay as you wrote them. | FR-1.5, FR-6.3 |
| `AUTH.notifyStateOnAccount` | Пишемо про всі ваші запрошення. | For all your invitations. | FR-12.6 |
| `AUTH.notifyStateOffNow` | Зараз не пишемо — про жодне з ваших запрошень. | Not emailing you right now — about any of your invitations. | FR-12.6 |

## Review Focus

1. **The typing on a 360 px phone, in both languages.** The sentence stays on one line, overflows to the left like an input, and never pushes the page sideways (`scrollWidth === innerWidth`).
2. **Reduced motion.** No animation at all. The sentence is whole and wraps, and the card has already risen.
3. **The swap on mount.** The prerendered block and the mounted page carry the same classes and the same text, and there are still exactly two `a.lp-cta` in the block.
4. **Pricing.** No string anywhere says that publishing costs money (Task 1's test). The FAQ's cost answer is exactly «Безкоштовно.»
5. **The checkbox.** A real input in the tab order, a visible focus ring on `--app-bg`, the whole label as a 44 px target, ink rather than accent, and the scope stated in the off state.
6. **The rise.** The card clears the pocket far enough to show its title and details line, the deckle's shadow isn't clipped, and nothing jumps when the animation ends.

---

## Task 1: The landing's new copy

**Files:**
- Modify: `web/src/i18n.ts`, `LandingStrings` and both `LANDING` tables
- Test: `web/test/i18n.test.ts`

**Interfaces:**
- Produces, on `LandingStrings`: `heroPromise`, `heroSentence`, `composerLabel`, `composerNote`, `statValue`, `statLabel`, `guestsTitle`, `guestsText`, `guestsPoints: string[]`, `faqTitle` and `faq: { q: string; a: string }[]`. `heroText` changes value. `samples` stays until Task 4.

- [ ] **Step 1: Write the tests**

In `test/i18n.test.ts`, after `describe("the landing page's demo content")`:

```ts
/** adr-019 §6.3–6.4: the landing page states only what is true today. */
describe("the landing page's claims", () => {
  it.each(["uk", "en"] as const)("types a sentence about the sample the hero raises (%s)", (lang) => {
    const t = LANDING[lang];
    const details = t.samples.wedding.details_line;
    const city = details.split(",").at(-1)?.trim() ?? "";
    const day = /^\d+/.exec(details)?.[0] ?? "";
    expect(city).not.toBe("");
    expect(t.heroSentence).toContain(city);
    expect(t.heroSentence).toContain(day);
  });

  // `lp-type` animates max-width to 46ch, which holds 44 characters of Golos
  // with room. A longer sentence needs that number raised, not this one.
  it.each(["uk", "en"] as const)("keeps the %s sentence short enough to type on one line", (lang) => {
    expect([...LANDING[lang].heroSentence].length).toBeLessThanOrEqual(44);
  });

  it("states one number, the one NFR-1 makes true", () => {
    expect(LANDING.uk.statValue).toBe("1 хвилина");
    expect(LANDING.en.statValue).toBe("1 minute");
  });

  it("answers four questions and makes three points about the guest's page", () => {
    for (const lang of ["uk", "en"] as const) {
      expect(LANDING[lang].faq).toHaveLength(4);
      expect(LANDING[lang].guestsPoints).toHaveLength(3);
    }
  });

  // 07-monetization §5.2: publishing stays free, and the paid step is a
  // one-time unlock that removes the badge. A2's «платите лише при
  // публікації» said the opposite.
  it("says it's free, and never that publishing costs", () => {
    expect(LANDING.uk.faq[0]).toEqual({ q: "Скільки це коштує?", a: "Безкоштовно." });
    expect(LANDING.en.faq[0]).toEqual({ q: "How much does it cost?", a: "It's free." });
    expect(LANDING.uk.composerNote).toBe("Безкоштовно · без реєстрації для гостей");
    const PAY = /плат|pay/i;
    const PUBLISH = /публік|publish/i;
    const gated = Object.entries(tables)
      .flatMap(([name, table]) => [...leaves(table.uk, `${name}.uk`), ...leaves(table.en, `${name}.en`)])
      .filter(([, text]) => PAY.test(text) && PUBLISH.test(text))
      .map(([path]) => path);
    expect(gated).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm --filter inv-app-web exec vitest run test/i18n.test.ts`
Expected: FAIL, because the keys don't exist.

- [ ] **Step 3: Implement**

- Add the keys to `LandingStrings`, each with a one-line doc comment. Name its section (`heroSentence`: "what the hero's composer types; names the sample the stage raises"). `faq` and `guestsPoints` say that the shape test holds their lengths.
- Fill both tables from the copy table above. The `heroText` values become «Опишіть подію словами — отримайте гарне запрошення.» and "Describe your event in words — get a beautiful invitation."
- Add a sentence to the block comment over `LANDING`: every claim on the landing page is true today (FR-13.11, added in Task 7), and the FAQ's cost answer changes only when 07-monetization §5.2 ships.

- [ ] **Step 4: Run the tests**

Expected: PASS, including both shape tests.

- [ ] **Step 5: Commit**

```bash
git add web/src/i18n.ts web/test/i18n.test.ts
git commit -m "Write the paper landing's copy: the promise, the composer, guests, the stat and four questions (adr-019 §6)"
```

## Task 2: Reply email as one checkbox on the account footer (adr-019 §10)

**Files:**
- Create: `web/src/components/NotifyCheckbox.tsx`
- Modify: `web/src/components/AccountFooter.tsx` and `web/src/i18n.ts` (`AuthStrings` and `AUTH`)
- Modify: `web/src/styles.css`. Add a new `/* Reply email checkbox ---- */` section directly before `Landing: account footer`, and edit the footer section.
- Test: `web/test/accountUi.test.tsx`, `web/test/styles.test.ts`, `web/test/landingList.test.tsx`

**Interfaces:**
- Produces: `NotifyCheckbox({ checked, onToggle, name, state })`. Steps 5 (share panel) and 6 (manage) reuse it unchanged.
- `AUTH` gains `notifyStateOnAccount` and `notifyStateOffNow`, and loses `notifyOff`.

- [ ] **Step 1: Write the tests**

In `test/accountUi.test.tsx`, replace `describe("AccountFooter reply notifications")` with:

```tsx
// adr-019 §10, from PR #66's design pass. Under opt-in this control is the only
// thing between the feature and its non-existence, so it is a control, not a
// sentence with a text button beside it.
describe("AccountFooter reply email", () => {
  const footer = (notify: { enabled: boolean; onToggle: () => void } | null, t = auth) =>
    render(<AccountFooter email="olena@example.com" onSignOut={() => {}} notify={notify} t={t} />);
  const box = () =>
    screen.getByRole("checkbox", { name: new RegExp(auth.notifyOptIn) }) as HTMLInputElement;

  it("is a real checkbox, checked while mail is on, with the scope in its state line", () => {
    footer({ enabled: true, onToggle: () => {} });
    expect(box().checked).toBe(true);
    expect(screen.getByText(auth.notifyStateOnAccount)).toBeTruthy();
  });

  it("keeps its name when off, and says no invitation is written about", () => {
    footer({ enabled: false, onToggle: () => {} });
    expect(box().checked).toBe(false);
    expect(screen.getByText(auth.notifyOptIn)).toBeTruthy();
    expect(screen.getByText(auth.notifyStateOffNow)).toBeTruthy();
  });

  it("toggles from anywhere on its label, which is the 44px target", () => {
    const onToggle = vi.fn();
    footer({ enabled: false, onToggle });
    fireEvent.click(screen.getByText(auth.notifyStateOffNow));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("never repeats the address the row above already shows", () => {
    const { container } = footer({ enabled: true, onToggle: () => {} });
    expect(container.querySelector(".lp-account-mail")?.textContent).not.toContain("olena@example.com");
  });

  // Absent, never disabled: a deployment without mail, or a host with nothing
  // published, has nothing to promise.
  it("renders no control at all when there is nothing to promise", () => {
    footer(null);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByText("olena@example.com")).toBeTruthy();
    expect(screen.getByText(auth.signOut)).toBeTruthy();
  });

  // The square carries the state now. Two state glyphs in one stack would
  // argue, so the envelope only labels the address.
  it("labels the address with one plain envelope, struck in neither state", () => {
    const glyph = (enabled: boolean) => {
      const { container } = footer({ enabled, onToggle: () => {} });
      const counts = [
        container.querySelectorAll(".lp-account-id svg").length,
        container.querySelectorAll(".lp-account-id svg path").length,
      ];
      cleanup();
      return counts;
    };
    expect(glyph(false)).toEqual(glyph(true));
    expect(glyph(true)[0]).toBe(1);
  });

  it("carries the copy in Ukrainian too", () => {
    footer({ enabled: true, onToggle: () => {} }, AUTH.uk);
    expect(screen.getByText("Пишемо про всі ваші запрошення.")).toBeTruthy();
    expect(screen.getByText("Повідомляти про відповіді")).toBeTruthy();
  });
});
```

In `test/landingList.test.tsx`, inside `describe("the landing sign-in link")`. This passes on `main` already; it pins the order §10 keeps:

```tsx
// adr-019 §10: beside the accent the link reads as Create's caption ("create…
// or sign in?"), so it stands on the switcher's far side, with the chrome.
it("sits with the language switcher, never beside Create", async () => {
  stubApi({ signedIn: false });
  const { container } = renderLanding();
  await screen.findByText(label);
  const order = [...(container.querySelector(".lp-nav-right")?.children ?? [])].map(
    (el) => el.className.split(" ")[0],
  );
  expect(order).toEqual(["lp-nav-signin", "ls-track", "lp-cta"]);
});
```

In `test/styles.test.ts`:
- Add `"Reply email checkbox"` to `CONVERTED`.
- In `describe("the landing page's text")`, drop the `.lp-account-mail p` and `.lp-notify-all` rows.
- Add:

```ts
/** adr-019 §10. It sits on --app-bg in the landing footer, and on --surface in
 *  the share panel and the manage page once steps 5 and 6 bring it there. */
describe("the reply email checkbox", () => {
  textFloors("Reply email checkbox", [
    [".notify-name", "--app-bg", 4.5],
    [".notify-name", "--surface", 4.5],
    [".notify-state", "--app-bg", 4.5],
    [".notify-state", "--surface", 4.5],
  ]);

  const rules = () => ruleBlocks(stripComments(sections(css).get("Reply email checkbox") ?? ""));
  const body = (selector: string) => rules().find((r) => r.selectors.includes(selector))?.body ?? "";

  it("fills the checked box with ink, never the accent, which means the public link", () => {
    expect(body(".notify-input:checked + .notify-box")).toMatch(/background-color:\s*var\(--ink-muted\)/);
    expect(rules().map((r) => r.body).join("\n")).not.toMatch(/accent/);
  });

  it("edges the empty box at 3:1 on both grounds it sits on (WCAG 1.4.11)", () => {
    const edge = /border:\s*[\d.]+px solid var\((--[\w-]+)\)/.exec(body(".notify-box"))?.[1];
    expect(edge).toBeDefined();
    for (const ground of ["--app-bg", "--surface"]) {
      const ratio = contrast(tokens.get(edge as string) as string, tokens.get(ground) as string);
      expect(ratio, ground).toBeGreaterThanOrEqual(3);
    }
  });

  it("makes the whole label a 44px target and keeps the input in the tab order", () => {
    expect(body(".notify-check")).toMatch(/min-height:\s*44px/);
    expect(body(".notify-input")).not.toMatch(/display:\s*none/);
    expect(body(".notify-input:focus-visible + .notify-box")).toMatch(/outline:/);
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm --filter inv-app-web exec vitest run test/accountUi.test.tsx test/styles.test.ts test/landingList.test.tsx`
Expected: the footer and checkbox tests FAIL. The nav order test passes.

- [ ] **Step 3: Implement**

`web/src/components/NotifyCheckbox.tsx`. Carry over #66's header comment on why it's a checkbox and not a quieter sentence: two rows with two roles, and the whole label as the target. Re-point it at adr-019 §10, and say the box is ink because the accent means the public link:

```tsx
export function NotifyCheckbox({
  checked,
  onToggle,
  name,
  state,
}: {
  checked: boolean;
  onToggle: () => void;
  /** The setting's name. Identical in both states, by design. */
  name: string;
  /** What is true right now, scope included. Changes entirely with the state. */
  state: string;
}) {
  return (
    // A real input, so it is reachable by keyboard and announced as a
    // checkbox. The square is decoration driven by it.
    <label className="notify-check">
      <input type="checkbox" className="notify-input" checked={checked} onChange={onToggle} />
      <span className="notify-box" aria-hidden="true">
        {checked && (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="notify-copy">
        <span className="notify-name">{name}</span>
        <span className="notify-state">{state}</span>
      </span>
    </label>
  );
}
```

`AccountFooter.tsx`:
- Delete `off` and the struck paths. The envelope keeps its two strokes in `currentColor`.
- The mail row becomes `<div className="lp-account-mail"><NotifyCheckbox checked={notify.enabled} onToggle={notify.onToggle} name={t.notifyOptIn} state={notify.enabled ? t.notifyStateOnAccount : t.notifyStateOffNow} /></div>`.
- Rewrite the header comment's notification paragraph and the glyph comment: the square carries the state, and the envelope labels the address.

`i18n.ts`:
- Add `notifyStateOnAccount` and `notifyStateOffNow` to `AuthStrings`, with #66's doc comment: the state row says what's true now, with the scope inside it, one string per surface and state. Fill both tables from the copy table.
- Delete `notifyOff`. Fix `notifyOffer`'s comment, which names it.
- Add to `notifyOptIn`'s comment that it is also the checkbox's name, identical in both states.

`styles.css`, the new `Reply email checkbox` section (converted from the start). The banner comment gives #66's reasons in a sentence each:

```css
.notify-check { position: relative; display: flex; align-items: flex-start; gap: 10px; min-height: 44px; padding: 7px 6px 7px 0; margin-left: -3px; cursor: pointer; }
.notify-input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.notify-box { flex: 0 0 auto; display: inline-grid; place-items: center; width: 19px; height: 19px; margin-top: 1px; border: 1.5px solid var(--ink-faint); border-radius: var(--r-sm); background-color: var(--surface); color: var(--surface); }
.notify-input:checked + .notify-box { border-color: var(--ink-muted); background-color: var(--ink-muted); }
.notify-input:focus-visible + .notify-box { outline: 2px solid var(--ink); outline-offset: 2px; }
.notify-check:hover .notify-box { border-color: var(--ink-muted); }
.notify-copy { flex: 1; min-width: 0; }
.notify-name { display: block; font-size: 0.86rem; font-weight: 600; line-height: 1.4; color: var(--ink); }
.notify-state { display: block; margin-top: 2px; font-size: 0.8rem; line-height: 1.45; color: var(--ink-muted); overflow-wrap: anywhere; }
```

The `Landing: account footer` section:
- Delete `.lp-account-knockout`, `.lp-account-mail p`, `.lp-notify-all` and `.lp-notify-all:hover`.
- `.lp-account-mail` becomes `margin-top: 2px; padding-left: 26px;`. The 26 px is the glyph plus its gap, and the checkbox's own −3 px keeps the square optically under the address.
- Replace the heights comment with one that says Task 8 re-measures them.

- [ ] **Step 4: Run the tests**

Expected: PASS, including `sub-faint inks`, whose list keeps `.lp-account-id svg`.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/NotifyCheckbox.tsx web/src/components/AccountFooter.tsx web/src/i18n.ts web/src/styles.css web/test/accountUi.test.tsx web/test/styles.test.ts web/test/landingList.test.tsx
git commit -m "Make reply email one checkbox on the landing footer (adr-019 §10)"
```

## Task 3: The hero's composer

**Files:**
- Create: `web/src/components/landing/HeroComposer.tsx`
- Modify: `web/src/LandingPage.tsx`, `web/src/prerender.ts` and `web/src/styles.css` (the `Landing page` section)
- Test: create `web/test/landingPage.test.tsx`. Modify `web/test/prerender.test.ts` and `web/test/styles.test.ts`.

**Interfaces:**
- Produces: `HeroComposer({ t, onStart }: { t: LandingStrings; onStart: () => void })`, which renders the composer box (label, typed sentence, the call to action) and its note.

- [ ] **Step 1: Write the tests**

`web/test/landingPage.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LANDING } from "../src/i18n";
import { LandingPage } from "../src/LandingPage";
import { forgetHeldManageTokens } from "../src/manageTokens";

/** A first-time visitor: signed out, nothing held. Any request but the session
 *  throws, so a section that starts fetching (a count for the stat strip, say)
 *  fails here rather than shipping a request nobody decided on. */
function stubSession() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/auth/session")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ configured: true, signed_in: false, email: null, publish_gate: true, notifications: true }),
        } as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    }),
  );
}

function renderLanding(entry = "/") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/create" element={<p>editor</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  forgetHeldManageTokens();
  stubSession();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const t = LANDING.uk;

describe("the hero composer (adr-019 §6.1)", () => {
  it("types the whole sentence from one text node, so crawlers and screen readers get all of it", () => {
    const { container } = renderLanding();
    const typing = container.querySelector(".lp-composer .lp-typing");
    expect(typing?.textContent).toBe(t.heroSentence);
    expect(typing?.childNodes).toHaveLength(1);
  });

  it("labels the box an example, with the call to action as its only control", () => {
    const { container } = renderLanding();
    const composer = container.querySelector(".lp-composer") as HTMLElement;
    expect(composer.querySelector(".lp-composer-label")?.textContent).toBe(t.composerLabel);
    const controls = [...composer.querySelectorAll("a, button, input, textarea")];
    expect(controls.map((el) => el.textContent)).toEqual([t.cta]);
  });

  it("starts the editor from the composer's button", () => {
    const { container } = renderLanding();
    fireEvent.click(container.querySelector(".lp-composer .lp-cta") as HTMLElement);
    expect(screen.getByText("editor")).toBeTruthy();
  });

  it("gains the differentiator under the headline, and says it's free under the composer", () => {
    renderLanding();
    expect(screen.getByText(t.heroPromise)).toBeTruthy();
    expect(screen.getByText(t.composerNote)).toBeTruthy();
  });
});
```

In `test/prerender.test.ts`:

```ts
/** The landing block as a crawler, or a visitor before React mounts, reads it. */
const landingBlock = (lang: "uk" | "en") => {
  const html = prerenderBlocks();
  const { open, close } = prerenderMarkers(`landing:${lang}`);
  return html.slice(html.indexOf(open), html.indexOf(close));
};

describe("the landing hero before React mounts (adr-019 §6.1)", () => {
  it.each(["uk", "en"] as const)("carries the composer's sentence in the class React types (%s)", (lang) => {
    const t = LANDING[lang];
    const typed = /<span class="lp-typing">([^<]*)<\/span>/.exec(landingBlock(lang))?.[1];
    expect(typed).toBe(t.heroSentence.replaceAll("&", "&amp;"));
    expect(landingBlock(lang)).toContain(t.heroPromise);
    expect(landingBlock(lang)).toContain(t.composerNote);
  });

  it("puts no Ukrainian in the English landing block", () => {
    expect(landingBlock("en")).not.toMatch(/[Ѐ-ӿ]/);
  });
});
```

The existing `keeps the hero's single call to action` test still expects two `class="lp-cta"` (the composer's and the final one). Leave it as it is.

In `test/styles.test.ts`:
- Rename the `textFloors` row `.lp-hero-copy p` to `.lp-hero-text`, and add `[".lp-hero-promise", "--app-bg", 4.5]`, `[".lp-composer-line", "--surface", 4.5]`, `[".lp-composer-label", "--surface", 3]` and `[".lp-composer-note", "--app-bg", 4.5]`.
- Generalise `describe("the guest page's components")`'s hex test into a loop over `components/guest/`, `components/landing/`, `components/NotifyCheckbox.tsx` and `components/AccountFooter.tsx`, keeping its message.
- Add:

```ts
describe("the landing's motion (adr-019 §6.1)", () => {
  const landing = () => stripComments(sections(css).get("Landing page") ?? "");
  const welcome = () => {
    const span = atRuleSpan(landing(), /@media\s*\(prefers-reduced-motion:\s*no-preference\)/);
    expect(span, "no no-preference block").not.toBeNull();
    return span as { start: number; end: number };
  };
  const keyframeProps = (name: string) => {
    const span = atRuleSpan(landing(), new RegExp(`@keyframes\\s+${name}\\b`));
    expect(span, name).not.toBeNull();
    const { start, end } = span as { start: number; end: number };
    return new Set([...landing().slice(start, end).matchAll(/([\w-]+)\s*:/g)].map((m) => m[1]));
  };

  // Reduced motion is honoured by never starting, not by detection (NFR-9).
  it("animates only inside its one no-preference block", () => {
    const { start, end } = welcome();
    const animated = ruleBlocks(landing()).filter((r) => /(?:^|[;\s])animation\s*:/.test(r.body));
    expect(animated.flatMap((r) => r.selectors).sort()).toEqual([".lp-typing"]);
    for (const r of animated) expect(r.at > start && r.at < end, r.selectors.join(", ")).toBe(true);
  });

  it("types by width and blinks by colour, and moves nothing else", () => {
    expect(keyframeProps("lp-type")).toEqual(new Set(["max-width"]));
    expect(keyframeProps("lp-caret")).toEqual(new Set(["border-right-color"]));
  });

  // The line is flex-end and the sentence takes margin-right: auto, so it sits
  // left while it fits and scrolls left, like an input, once it doesn't.
  it("keeps the typed line to one line that scrolls like an input, only where it types", () => {
    const { start, end } = welcome();
    const inside = ruleBlocks(landing().slice(start, end));
    const line = inside.find((r) => r.selectors.includes(".lp-composer-line"))?.body ?? "";
    const typing = inside.find((r) => r.selectors.includes(".lp-typing"))?.body ?? "";
    expect(line).toMatch(/justify-content:\s*flex-end/);
    expect(line).toMatch(/overflow:\s*hidden/);
    expect(typing).toMatch(/white-space:\s*nowrap/);
    expect(typing).toMatch(/margin-right:\s*auto/);
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm --filter inv-app-web exec vitest run test/landingPage.test.tsx test/prerender.test.ts test/styles.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`HeroComposer.tsx`:

```tsx
<>
  <div className="lp-composer">
    <p className="lp-composer-label">{t.composerLabel}</p>
    <p className="lp-composer-line">
      <span className="lp-typing">{t.heroSentence}</span>
    </p>
    <button type="button" className="lp-cta" onClick={onStart}>
      {t.cta}
    </button>
  </div>
  <p className="lp-composer-note">{t.composerNote}</p>
</>
```

Give it a header comment: an example of what a host types, not an input (decision 5). The typing is CSS on a span whose text is already the whole sentence (decisions 3 and 4).

`LandingPage.tsx`: the hero copy becomes `h1`, then `<p className="lp-hero-text">{t.heroText}</p>`, then `<p className="lp-hero-promise">{t.heroPromise}</p>`, then `<HeroComposer t={t} onStart={startEditing} />`. The old hero button goes, because the composer carries the call to action. The fan stays until Task 4.

`prerender.ts`, the hero in `landingBodyHtml`:

```ts
`<section class="lp-hero"><div class="lp-hero-copy">` +
`<h1>${escapeHtml(t.heroTitle)}</h1>` +
`<p class="lp-hero-text">${escapeHtml(t.heroText)}</p>` +
`<p class="lp-hero-promise">${escapeHtml(t.heroPromise)}</p>` +
`<div class="lp-composer">` +
`<p class="lp-composer-label">${escapeHtml(t.composerLabel)}</p>` +
`<p class="lp-composer-line"><span class="lp-typing">${escapeHtml(t.heroSentence)}</span></p>` +
cta +
`</div>` +
`<p class="lp-composer-note">${escapeHtml(t.composerNote)}</p>` +
`</div></section>` +
```

Add to its doc comment why the typing class is kept (decision 4).

`styles.css`, the `Landing page` section:
- `.lp-hero-copy p` becomes `.lp-hero-text`, here and in the 1000 px block.
- `.lp-hero-promise` is the line's point: `--ink`, weight 600, the same size as `.lp-hero-text`, and close under it.
- `.lp-composer` is card stock: `background-color: var(--surface); border: 1px solid var(--edge); border-radius: var(--r-xl); box-shadow: var(--e-1);`, `display: grid; gap: 12px`, `max-width: 460px`, with padding around 14–16 px. `.lp-composer .lp-cta { justify-self: start; }`. In the 1000 px block the composer centres (`margin-inline: auto`) and keeps `text-align: left`.
- `.lp-composer-label`: `margin: 0`, about 0.75rem, weight 600, uppercase, tracked, in `--ink-faint` (it's a label).
- `.lp-composer-line`: `margin: 0`, about 1.02rem, `--ink`. Static and wrapping here.
- `.lp-composer-note`: `margin: 12px 0 0`, about 0.88rem, `--ink-muted`.
- At the end of the section, the one motion block (Task 4 adds the rise to it):

```css
@media (prefers-reduced-motion: no-preference) {
  .lp-composer-line { display: flex; justify-content: flex-end; overflow: hidden; }
  .lp-typing { flex: 0 0 auto; margin-right: auto; white-space: nowrap; overflow: hidden; border-right: 2px solid transparent; animation: lp-type 2.2s steps(40, end) 0.4s both, lp-caret 0.55s step-end 0.4s 5; }
}
@keyframes lp-type { from { max-width: 0; } to { max-width: 46ch; } }
@keyframes lp-caret { 50% { border-right-color: var(--ink); } }
```

Comment each part: why flex-end with an auto margin, why `46ch` (Task 1's 44-character test is its twin), and why the caret ends transparent.

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter inv-app-web exec vitest run`
Expected: PASS. `navigation.test.tsx` still finds the nav's `.lp-cta` first.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/landing/HeroComposer.tsx web/src/LandingPage.tsx web/src/prerender.ts web/src/styles.css web/test/landingPage.test.tsx web/test/prerender.test.ts web/test/styles.test.ts
git commit -m "Type the sentence into the hero's composer, and promise a minute, not four days (adr-019 §6.1)"
```

## Task 4: The stage: the invitation rises out of the envelope, and the fan goes

**Files:**
- Create: `web/src/components/landing/HeroStage.tsx`
- Modify: `web/src/LandingPage.tsx`, `web/src/i18n.ts`, `web/src/prerender.ts` and `web/src/styles.css`
- Test: `web/test/landingPage.test.tsx`, `web/test/styles.test.ts`, `web/test/i18n.test.ts`

**Interfaces:**
- Produces: `HeroStage({ copy, design, monogram })`. Task 5 reads the same `monogram`.
- `LANDING.samples: Record<SampleId, InvitationCopy>` becomes `LANDING.sample: InvitationCopy` (the wedding one), and `SampleId` is deleted.

- [ ] **Step 1: Write the tests**

`test/landingPage.test.tsx`:

```tsx
describe("the hero stage (adr-019 §6.1)", () => {
  it("raises one invitation, the composer's, on the deckled mat on a grained table", () => {
    const { container } = renderLanding();
    const stage = container.querySelector(".lp-stage") as HTMLElement;
    expect(stage.getAttribute("aria-hidden")).toBe("true");
    expect(stage.className).toMatch(/\bgrain\b/);
    const cards = stage.querySelectorAll(".lp-stage-card > .deckle > .inv");
    expect(cards).toHaveLength(1);
    expect(cards[0].querySelector(".inv-title")?.textContent).toBe(t.sample.title);
    // The fan's other two are gone; range lives in the gallery.
    expect(container.querySelectorAll(".inv")).toHaveLength(1);
  });

  it("seals the envelope with the sample couple's monogram, in both languages", () => {
    const { container, unmount } = renderLanding();
    expect(container.querySelector(".lp-stage .seal")?.textContent).toBe("М&А");
    unmount();
    const en = renderLanding("/?lang=en");
    expect(en.container.querySelector(".lp-stage .seal")?.textContent).toBe("M&A");
  });
});
```

In `test/i18n.test.ts`:
- `gives %s three complete sample invitations` becomes `gives %s one complete sample invitation`, over `Object.values(LANDING[lang].sample)`.
- `LANDING.en.samples.wedding.title` becomes `LANDING.en.sample.title`.
- Task 1's sentence test reads `t.sample.details_line`.

In `test/styles.test.ts`, the motion test now expects `[".lp-stage-card", ".lp-typing"]`, and add:

```ts
it("raises the card by transform and opacity alone", () => {
  expect(keyframeProps("lp-rise")).toEqual(new Set(["transform", "opacity"]));
});
```

and:

```ts
describe("the landing on paper (adr-019 §3)", () => {
  const rule = (selector: string) =>
    ruleBlocks(stripComments(sections(css).get("Landing page") ?? "")).find((r) =>
      r.selectors.includes(selector),
    )?.body ?? "";

  it("grains the page ground and the hero's table, each coloured without the shorthand", () => {
    for (const [selector, ground] of [[".landing", "--app-bg"], [".lp-stage", "--table"]]) {
      expect(rule(selector), selector).toMatch(new RegExp(`background-color:\\s*var\\(${ground}\\)`));
      expect(rule(selector), selector).not.toMatch(/(?:^|[;\s])background\s*:/);
    }
    expect(source("LandingPage.tsx")).toMatch(/className="landing grain"/);
    expect(source("prerender.ts")).toMatch(/class="landing grain"/);
    expect(source("components/landing/HeroStage.tsx")).toMatch(/className="lp-stage grain"/);
  });

  it("sets the hero's card on the deckled mat, with the mat's shadow outside its clip", () => {
    expect(source("components/landing/HeroStage.tsx")).toMatch(
      /<div className="lp-stage-card">\s*<div className="deckle">\s*<InvitationPreview/,
    );
    expect(rule(".lp-stage-card")).toMatch(/filter:\s*drop-shadow\(/);
  });
});
```

`source` is defined inside the guest describe today. Hoist it to file scope.

- [ ] **Step 2: Run them and see them fail**

Expected: FAIL.

- [ ] **Step 3: Implement**

`HeroStage.tsx`:

```tsx
<div className="lp-stage grain" aria-hidden="true">
  <div className="lp-stage-env">
    <div className="lp-stage-card">
      <div className="deckle">
        <InvitationPreview copy={copy} design={design} />
      </div>
    </div>
    <div className="lp-stage-pocket">
      <span className="seal lp-stage-seal">{monogram}</span>
    </div>
  </div>
</div>
```

Give it a header comment: decorative, `aria-hidden`, and left out of the prerender for the reason the fan was. The card rises once the typing ends.

`LandingPage.tsx`:
- `SAMPLE_DESIGNS` and `SAMPLE_ORDER` become `const SAMPLE_DESIGN: DesignTokens = { palette: "romantic", typography: "script", layout: "classic", ornament: "floral" };`. Rewrite the "split by kind" comment for one sample.
- `const monogram = monogramFrom([t.sample.closing]);` with a comment: the sample has no brief, and its closing is the hosts' names.
- The `lp-fan` block becomes `<HeroStage copy={t.sample} design={SAMPLE_DESIGN} monogram={monogram} />`.
- The root becomes `<div className="landing grain">`.

`i18n.ts`:
- `samples` becomes `sample` with the wedding copy only, in both tables. Delete `SampleId`.
- Rewrite the block comment over `LANDING`, which talks about "the three sample invitations", for one.

`prerender.ts`: `<div class="landing">` becomes `<div class="landing grain">`. The doc comment's "left out" list names the stage instead of the fan.

`styles.css`, the `Landing page` section:
- `.landing`: `background` becomes `background-color: var(--app-bg)`.
- Delete every `.lp-fan*` rule, here and in the 1000 px block. Rewrite that block's comment: the fan's min-width reasoning goes with the fan. Keep the 1000 px collapse unless Task 8's look shows the two columns fit lower.
- The stage, as a starting point to tune in Task 8:
  - `.lp-stage`: `background-color: var(--table)`, `border-radius: var(--r-xl)`, `justify-self: center; width: min(440px, 100%)`, padding of about `36px 20px 28px`, and `overflow: hidden`, so a rising card never widens the page.
  - `.lp-stage-env` is the envelope's back: `--kraft-deep`, about 300 × 170 px, centred at the bottom, `position: relative`.
  - `.lp-stage-card`: about 236 px wide, centred, `position: absolute` and bottom-anchored, so its lower third stands inside the envelope. `filter: drop-shadow(var(--e-2))` and `z-index: 1`.
  - `.lp-stage-pocket` is the front: `--kraft`, the envelope's lower ~65%, with a V-notched top (`clip-path: polygon(…)`) and `z-index: 2`. `.lp-stage-seal` is about 52 px, centred on the notch.
  - Move the fan's card tuning over: `.lp-stage-card .inv { min-height: 0; padding: 22px 18px; box-shadow: none; }`, plus its `.inv-title`, `.inv-body` and `.inv-details` sizes.
  - At rest, the title, greeting and details line show above the pocket.
- Add to the motion block: `.lp-stage-card { animation: lp-rise 900ms var(--ease-ios) 2.7s both; }`. The 2.7 s is the typing's 0.4 s delay plus its 2.2 s, plus a beat. Add `@keyframes lp-rise { from { transform: translateY(38%); opacity: 0; } }`.
- Update `--kraft`'s comment in `:root`: the envelope's readers are now the guest page and the landing.

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter inv-app-web exec vitest run`
Expected: PASS. Then `git diff main -- web/src/styles.css` shows no hunk inside `Invitation card`.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/landing/HeroStage.tsx web/src/LandingPage.tsx web/src/i18n.ts web/src/prerender.ts web/src/styles.css web/test/landingPage.test.tsx web/test/styles.test.ts web/test/i18n.test.ts
git commit -m "Raise the hero's invitation out of an envelope on a grained table, in place of the fan (adr-019 §6.1)"
```

## Task 5: The stat strip, and what guests see

**Files:**
- Create: `web/src/components/landing/GuestsSection.tsx`
- Modify: `web/src/LandingPage.tsx`, `web/src/prerender.ts` and `web/src/styles.css`
- Test: `web/test/landingPage.test.tsx`, `web/test/prerender.test.ts`, `web/test/styles.test.ts`

**Interfaces:**
- Produces: `GuestsSection({ t, monogram })`.

- [ ] **Step 1: Write the tests**

`test/landingPage.test.tsx`:

```tsx
describe("the stat strip (adr-019 §6.3)", () => {
  it("shows the one number that is true today, and fetches no other", () => {
    const { container } = renderLanding();
    const cells = container.querySelectorAll(".lp-stats .lp-stat");
    expect(cells).toHaveLength(1);
    expect(cells[0].querySelector(".lp-stat-value")?.textContent).toBe(t.statValue);
    expect(cells[0].querySelector(".lp-stat-label")?.textContent).toBe(t.statLabel);
    const urls = vi.mocked(fetch).mock.calls.map(([input]) => String(input));
    expect(urls.filter((url) => url.includes("/api/metrics"))).toEqual([]);
  });
});

describe("what guests see (adr-019 §6.2)", () => {
  it("shows the guest's first frame as a still: the sealed envelope, beside the copy", () => {
    const { container } = renderLanding();
    const still = container.querySelector(".lp-guests-still") as HTMLElement;
    expect(still.getAttribute("aria-hidden")).toBe("true");
    expect(still.querySelector(".lp-guests-to")?.textContent).toBe(t.sample.title);
    expect(still.querySelector(".seal")?.textContent).toBe("М&А");
    // A picture of the envelope, not the envelope: nothing on it opens.
    expect(still.querySelector("button, a")).toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: t.guestsTitle })).toBeTruthy();
    const points = [...container.querySelectorAll(".lp-guests-point")].map((li) => li.textContent);
    expect(points).toEqual(t.guestsPoints);
  });
});
```

`test/prerender.test.ts`:

```ts
it.each(["uk", "en"] as const)("carries the stat and the guests' copy, but not their envelope (%s)", (lang) => {
  const t = LANDING[lang];
  const block = landingBlock(lang);
  for (const text of [t.statValue, t.statLabel, t.guestsTitle, t.guestsText, ...t.guestsPoints]) {
    expect(block).toContain(text);
  }
  expect(block).not.toContain("lp-guests-still");
});
```

Compare after escaping if a string carries `&`, as in Task 3. None of the table above does.

`test/styles.test.ts`, in `textFloors("Landing page", …)`: `[".lp-stat-value", "--app-bg", 4.5]`, `[".lp-stat-label", "--app-bg", 4.5]`, `[".lp-guests-text", "--app-bg", 4.5]`, `[".lp-guests-point", "--app-bg", 4.5]` and `[".lp-guests-to", "--kraft", 4.5]`.

- [ ] **Step 2: Run them and see them fail**

Expected: FAIL.

- [ ] **Step 3: Implement**

`GuestsSection.tsx`:

```tsx
<section className="lp-guests">
  <div className="lp-guests-still" aria-hidden="true">
    <div className="lp-guests-env">
      <div className="lp-guests-flap" />
      <p className="lp-guests-to">{t.sample.title}</p>
      <span className="seal lp-guests-seal">{monogram}</span>
    </div>
  </div>
  <div className="lp-guests-copy">
    <h2 className="lp-guests-title">{t.guestsTitle}</h2>
    <p className="lp-guests-text">{t.guestsText}</p>
    <ul className="lp-guests-points">
      {t.guestsPoints.map((point) => (
        <li key={point} className="lp-guests-point">
          {point}
        </li>
      ))}
    </ul>
  </div>
</section>
```

Give it a header comment: the guest's first frame (FR-4.8) as a still, and `.gr-env-*` is the living one.

`LandingPage.tsx`. The order becomes the hero, then `<section className="lp-stats"><div className="lp-stat"><p className="lp-stat-value">…</p><p className="lp-stat-label">…</p></div></section>`, then the steps, the chips, `<GuestsSection t={t} monogram={monogram} />` and the replies demo. Comment on the strip: one cell until a count comes from `/api/metrics`, and no placeholder number ever ships (adr-019 §6.3).

`prerender.ts` emits, in the same order, `<section class="lp-stats">…</section>` and `<section class="lp-guests"><div class="lp-guests-copy"><h2 class="lp-guests-title">…</h2><p class="lp-guests-text">…</p><ul class="lp-guests-points"><li class="lp-guests-point">…</li>…</ul></div></section>`.

`styles.css`, the `Landing page` section:
- Add `.lp-guests-title` to the heading rule (`.landing h1, .lp-steps h2, …`). It carries its own class, so the bare-`h2` list in `headings that carry their own class` doesn't grow.
- `.lp-stats` is a quiet centred band between the hero and the steps. `.lp-stat-value` is in the display face at 500, large, `--ink`. `.lp-stat-label` is `--ink-muted`.
- `.lp-guests`: two columns (`1fr 1fr`, `max-width: 1080px`, centred, `align-items: center`) above 800 px, and stacked below, with the copy first on a phone.
- `.lp-guests-still` is the `--night` ground: `border-radius: var(--r-xl)`, padding of about 40 px, the envelope centred. `.lp-guests-env` is `--kraft`, `aspect-ratio: 4 / 3`, `width: min(300px, 100%)`, `box-shadow: var(--e-3)`, with the title at the bottom. `.lp-guests-flap` is `--kraft-deep`, 58% tall, `clip-path: polygon(0 0, 100% 0, 50% 100%)`. `.lp-guests-seal` is about 60 px, centred at the flap's point. `.lp-guests-to` is `--ui-ink`, in the display face at 400. These are the guest page's proportions, and a comment says so.
- `.lp-guests-text` and `.lp-guests-point` are `--ink-muted`. The points are a plain list with a small accent mark (`::before`, aria-free) and no bullets.

- [ ] **Step 4: Run the tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/landing/GuestsSection.tsx web/src/LandingPage.tsx web/src/prerender.ts web/src/styles.css web/test/landingPage.test.tsx web/test/prerender.test.ts web/test/styles.test.ts
git commit -m "Show what guests see, and state the one number that's true (adr-019 §6.2, §6.3)"
```

## Task 6: Four questions

**Files:**
- Create: `web/src/components/landing/LandingFaq.tsx`
- Modify: `web/src/LandingPage.tsx`, `web/src/prerender.ts` and `web/src/styles.css`
- Test: `web/test/landingPage.test.tsx`, `web/test/prerender.test.ts`, `web/test/styles.test.ts`

**Interfaces:**
- Produces: `LandingFaq({ t })`.

- [ ] **Step 1: Write the tests**

`test/landingPage.test.tsx`:

```tsx
describe("the FAQ (adr-019 §6.3)", () => {
  it("asks four questions, each closed until opened", () => {
    const { container } = renderLanding();
    const items = [...container.querySelectorAll(".lp-faq details")] as HTMLDetailsElement[];
    expect(items.map((d) => d.querySelector("summary")?.textContent)).toEqual(t.faq.map((f) => f.q));
    expect(items.map((d) => d.querySelector(".lp-faq-a")?.textContent)).toEqual(t.faq.map((f) => f.a));
    expect(items.every((d) => !d.open)).toBe(true);
  });
});
```

`test/prerender.test.ts`:

```ts
it.each(["uk", "en"] as const)("serves every question and its answer to a crawler (%s)", (lang) => {
  const block = landingBlock(lang);
  expect(block.match(/<details class="lp-faq-item">/g)).toHaveLength(4);
  for (const { q, a } of LANDING[lang].faq) {
    expect(block).toContain(`<summary class="lp-faq-q">${q}</summary><p class="lp-faq-a">${a}</p>`);
  }
});
```

Escape as in Task 3 if a question ever carries `&`, `<`, `>` or `"`.

`test/styles.test.ts`, in `textFloors("Landing page", …)`: `[".lp-faq-q", "--app-bg", 4.5]` and `[".lp-faq-a", "--app-bg", 4.5]`.

- [ ] **Step 2: Run them and see them fail**

Expected: FAIL.

- [ ] **Step 3: Implement**

`LandingFaq.tsx`:

```tsx
<section className="lp-faq">
  <h2 className="lp-faq-title">{t.faqTitle}</h2>
  {t.faq.map((item) => (
    <details key={item.q} className="lp-faq-item">
      <summary className="lp-faq-q">{item.q}</summary>
      <p className="lp-faq-a">{item.a}</p>
    </details>
  ))}
</section>
```

Give it a header comment: crawlable because the answers are in the prerendered block. There's no `FAQPage` JSON-LD (adr-016 §7). The cost answer gains its §5.2 sentence only when that ships.

`LandingPage.tsx`: the FAQ goes after the replies demo, before the final call to action. `prerender.ts` emits `<section class="lp-faq"><h2 class="lp-faq-title">…</h2><details class="lp-faq-item"><summary class="lp-faq-q">…</summary><p class="lp-faq-a">…</p></details>…</section>` in the same place.

`styles.css`, the `Landing page` section:
- Add `.lp-faq-title` to the heading rule.
- `.lp-faq` has `max-width: 720px` and is centred.
- `.lp-faq-item` is ruled with `border-bottom: 1px solid var(--edge)`.
- `.lp-faq-q` is `--ink`, weight 600, `cursor: pointer`, `list-style: none`, with padding of about 16 px. Hide both markers (`.lp-faq-q::marker` and `.lp-faq-q::-webkit-details-marker`), and draw a `+` in `::after`, turned 45° by `.lp-faq-item[open] > .lp-faq-q::after`. No transition, so the motion block stays the only motion.
- `.lp-faq-a` is `--ink-muted`.

- [ ] **Step 4: Run the full suite**

Run: `pnpm build && pnpm test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/landing/LandingFaq.tsx web/src/LandingPage.tsx web/src/prerender.ts web/src/styles.css web/test/landingPage.test.tsx web/test/prerender.test.ts web/test/styles.test.ts
git commit -m "Answer four questions on the landing, the price among them (adr-019 §6.3, §6.4)"
```

## Task 7: Docs in the same PR

**Files:**
- `docs/02-functional-requirements.md`:
  - FR-6.4 amended: the hero's **one** sample invitation, raised out of an envelope after the sentence that describes it types itself, plus the mocked reply rows.
  - FR-11.11, a placement note: the link stands on the far side of the language switcher from Create, as a quiet pair with it (tested).
  - New FR-12.12: on the landing page's account footer, the control is one checkbox. It's a real input whose whole label is the target, 44 px tall. Its name reads the same in both states, and its state line carries the account-wide scope before the host agrees. The checked box is ink, never the accent (adr-010 §3). The share panel and the host dashboard keep their sentence and button until adr-019 steps 5 and 6.
  - New FR-13.11: every claim on the landing page is true today. The one number, «1 хвилина», holds by NFR-1. A count appears only from `GET /api/metrics`, none does yet, and no placeholder number ships. There are no testimonials until real ones exist, given with consent. The price is stated as free, and nothing says publishing costs (07-monetization §5.2).
  - New FR-13.12: four questions in `<details>`, prerendered with the rest of the copy (FR-13.10). No `FAQPage` structured data (adr-016 §7).
- `docs/03-non-functional-requirements.md`:
  - Re-measure NFR-1's bundle line, as the line instructs. If it nears the 145 kB trigger, say so and name the code split.
  - NFR-9's materials bullet: grain now also on the landing's ground and its hero table, and the deckled mat on the hero's card.
  - NFR-9's reduced-motion bullet: the landing's typing and rise live in one `no-preference` block, so reduced motion gets the finished hero, with the sentence whole.
- `docs/decisions/adr-019-paper-direction.md`: a dated "**Amended 2026-xx-xx, step 4.**" note under §6, recording the decisions table at the top of this plan in step 3's format. A line under §10: the landing footer's checkbox and the sign-in pair are built, and the share panel and manage remain.
- `docs/decisions/adr-015-rsvp-notifications.md` §7: one line saying the control is a checkbox on the landing footer (FR-12.12), with the other two surfaces to follow.
- `docs/06-roadmap.md`, the "Unported: PR #66" note: the landing's checkbox and sign-in pair shipped in adr-019 step 4. The branch stays until step 6.
- `web/CLAUDE.md`:
  - Under Structure, markup also goes in `components/landing/`, and `NotifyCheckbox` is the shared reply-email control.
  - Under i18n, `LANDING.sample` (one, keyed by nothing) and `SAMPLE_DESIGN` in `LandingPage.tsx`.
  - Under Host access, the reply-email control is `NotifyCheckbox` on the landing footer, and still a sentence and button on the share panel and `/manage/:id` until steps 5 and 6.
  - Under Material system, grain on `.landing` and `.lp-stage`, and the landing's motion in one `no-preference` block.
- `web/test/landingList.test.tsx`: the `inList` comment's "three sample invitations" becomes one.

- [ ] **Commit**

```bash
git commit -m "Record the landing on paper: FR-6.4, FR-11.11, FR-12.12, FR-13.11–13.12, NFR-1, NFR-9, adr-019 §6"
```

## Task 8: Look, then the PR

- [ ] **Step 1: Look at it**

Run `pnpm build && pnpm --filter inv-app-server start` (it serves the built SPA on port 3001). Drive it with Playwright (preinstalled; `require('playwright')`, `chromium.launch()`), with `/api/auth/session` and the account endpoints routed to fixtures for the signed-in states. Open `/` and `/?lang=en` at 360, 390 and 1280 px. Check:
- the typing at each width in both languages: one line, overflowing left at 360 px, and `document.documentElement.scrollWidth === window.innerWidth`
- the rise after the typing, with the title and details line clear of the pocket, and the mat's shadow not clipped
- reduced motion (`page.emulateMedia({ reducedMotion: "reduce" })`): the sentence whole and wrapping, the card risen, and nothing moving
- JavaScript disabled: the prerendered page reads in order and carries the composer, the stat, the guests' copy and the FAQ
- signed in with mail on and off: the checkbox, Tab focus visible on `--app-bg`, and Space toggles it. Re-measure the footer heights and fix their comment
- every Review Focus item

Tune the stage's geometry and the typing's timing here, and record the final values.

- [ ] **Step 2: Open the PR**

Follow `.github/pull_request_template.md`. Include the decisions table, the copy table, the NFR-1 figure, the share-card note from Global Constraints, and screenshots at 360 px of the hero (at rest and mid-typing), the guests section, the FAQ open, and the footer's checkbox in both states. There's no real-device gate on this step (adr-019 §12 sets one for step 3 only). Ask the owner to look at the hero on a phone after deploy, as step 3 did.

## After this plan

- **Design sync.** `styles.css` changed, so the design project's landing board renders against the old stylesheet until the owner runs `/design-sync` (the CSS-only path in `.design-sync/NOTES.md`) and refreshes the binding.
- **Step 5 (editor)** reuses `NotifyCheckbox` in the share panel and writes adr-010 §3.1. It needs the desktop and share-panel boards first (adr-019 §7.5).
- When this ships, move this plan to `docs/superpowers/archive/plans/`, as steps 1–3's were.

### Not in this plan

- **A live composer** that carries a host's own sentence into `/create`. That's a behaviour change, with its own questions about generating on arrival and the draft rules.
- **Counts in the stat strip.** They need someone to decide which numbers are worth showing, and then one fetch from `/api/metrics`.
- **Testimonials.** None exist with consent.
- **FAQ structured data** (adr-016 §7).
- **The share cards' palette.** `scripts/build-brand-assets.mjs` still draws them in pre-paper terracotta and Playfair. This step doesn't change their copy, so no regeneration is owed, but they're the last brand surface not on paper.
- **A seal in the nav** (decision 10), and **the gallery** (step 8).
