# Guest Page on Paper: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/i/:id` in the paper direction (adr-019 rollout step 3): the envelope on first open, the pinned bar, the card on the deckled mat, the countdown and «Маршрут», «У календар» before a reply, the derived monogram on the seal, and the re-skinned reply card.

**Architecture:** One PR, built in tasks that each leave the suite green. The seal's monogram and the countdown are pure functions with their own tests. The envelope is a hook that decides **once at mount** whether this is a first open, plus an overlay component; the page renders beneath it from the start, so nothing waits on the animation. `.deckle` and `.seal` join `.grain` in the Material system section of `styles.css`. Pinned bar, quiet actions and countdown are new components under `components/guest/`, and `GuestPage.tsx` stays composition only (`web/CLAUDE.md`). No server change: the public payload already carries `brief.hosts`, `venue`, `city`, `date` and `time`.

**Tech Stack:** React 19, CSS custom properties and keyframes (transform and opacity only), Vitest with jsdom and `@testing-library/react`, Biome.

**Spec:** [adr-019](../../../decisions/adr-019-paper-direction.md) §3, §5, §9.2 and §9.4. Its long form is the [paper-direction spec](../../specs/2026-10-21-paper-direction-design.md). The canvas rows `A2 · Guest — envelope` and `A2 · Guest — RSVP` on *Invinto Redesign — Directions* are the visual reference. That canvas wasn't reachable when this plan was written (it isn't in the E-invitation DS or the design project), so the plan works from adr-019's text alone. **Open the canvas before Task 9's visual check** if it can be found, and record any disagreement in the PR. adr-019 wins over the canvas.

## Global Constraints

- **The card is untouched.** `InvitationPreview.tsx` and the `Invitation card` section of `styles.css` stay byte-identical, as do every `.palette-*`, `.type-*`, `.layout-*` and `.ornament-*` rule. No material class sits on `.inv` or inside it (adr-019 §3); the existing `paper materials` tests hold it.
- **WKWebView is the floor** (`CLAUDE.md`, Browser support). Everything here is Baseline Widely available: `clip-path: polygon()`, `position: sticky`, `inert`, `matchMedia`, `filter: drop-shadow()`, `scroll-margin-top`. No feature detection and no polyfill.
- **No schema change.** `schemas.ts` and `types.ts` don't move. «Ще не знаю» is step 7.
- **The view beacon is untouched.** It fires on load, not on open, so adr-013's denominator doesn't move (§5.1).
- **No raw hex** in the `Guest page` section, which is already in `CONVERTED`, **or in any guest component**. Task 6 extends the accent-literal test to every hex.
- **A rule on an element that carries `.grain` sets `background-color`, never the `background` shorthand**, which would wipe the grain (`web/CLAUDE.md`). `.gr-page` uses the shorthand today, and Task 7 fixes it.
- Every user-visible string is in `GUEST` in `i18n.ts`, in both languages, with the same shape (`test/i18n.test.ts`).
- Branch `feat/paper-guest` from `main`. **The PR doesn't merge until the real-device check in Task 9 has passed** (adr-019 §5.1).
- Run one file with `pnpm --filter inv-app-web exec vitest run test/<file>`. Run everything with `pnpm build && pnpm test`.

### What this plan decides that adr-019 left open (review these first)

| Question | This plan's answer | Why |
|---|---|---|
| Monogram for three or more hosts | The first two initials | A seal fits three glyphs. «М&А» is the shape §9.2 gives |
| One host string naming two people («Марія та Андрій») | Split on ` та `, ` і `, ` й `, ` and ` and `&` before taking initials | The model emits either form, and both mean two hosts |
| The share action, today a row shown only after a yes | Kept, as a quiet action in the thanks card after a yes. `GuestActions` and its `.gr-row*` rules go | §5.2 moves calendar and directions under the card and doesn't mention share. Dropping it would remove a feature nobody decided to remove |
| Countdown on the day itself | «Свято сьогодні!» / "It's today!" | The day isn't past (`isPastEventStart`), and «До свята 0 днів» reads as a bug |
| How the pinned bar shows `details_line` | Its first line as the date line, any further lines joined with « · » as the venue line, each truncated with an ellipsis | §5.2: "nothing new is parsed". `details_line` is "one or two lines" by schema |
| How reduced motion is read | `matchMedia("(prefers-reduced-motion: reduce)")`, once at mount, beside the viewed flag | "No envelope at all" means not mounting it, which CSS alone can't do. It is still the media query, never a device check (NFR-9) |
| When the envelope appears | Only once the invitation is `ready`. Loading keeps the status line | The envelope shows the title and the monogram, which need the invitation |
| Envelope colours | New tokens `--kraft` `#c8a97e`, `--kraft-deep` `#b8966a` (the flap) and `--night` `#24201c` (the ground), each pinned by a contrast test | adr-019 names "kraft on a dark ground" without values. Tune them in Task 9's visual check and record the final values |
| A decline in the thanks card | A muted seal (an `--edge` disc, ✓ in `--ink-muted`) and the existing declined copy | "The seal turns into a ✓ with copy matched to the answer" (§5.3). A yes gets the accent seal |

## Review Focus

1. **The envelope closing itself on a first open.** `useViewBeacon` writes `inv-viewed:<id>` as soon as the invitation is ready. Anything that re-reads `hasBeenViewed` after mount sees it flip and drops the envelope mid-animation. Task 3 has a test for exactly this.
2. **The page behind the envelope.** It's `inert` while the envelope is up, so a tab or a screen reader can't reach a form the guest can't see. It must stop being inert the moment the envelope goes.
3. **The pinned bar over the card on a 360 px phone.** It must not cover the card's title on load, and «Відповісти» must land the reply card's heading below the bar (`scroll-margin-top`), not under it.
4. **The deckle's shadow.** `clip-path` clips `box-shadow`, so the shadow lives on a wrapper as `filter: drop-shadow()`. Check it isn't cut off and doesn't stutter on scroll.
5. **Faux italic or bold on the seal.** Literata italic is requested at 400 only. The monogram sets `font-style: italic; font-weight: 400`, and the existing weight test holds the weight.

---

## Task 1: The monogram

**Files:**
- Create: `web/src/monogram.ts`
- Test: `web/test/monogram.test.ts`

**Interfaces:**
- Produces: `monogramFrom(hosts: string[]): string`. Tasks 4, 5 and 6 render it on the seal.

- [ ] **Step 1: Write the tests**

```ts
import { describe, expect, it } from "vitest";
import { LANDING } from "../src/i18n";
import { monogramFrom } from "../src/monogram";

describe("monogramFrom (adr-019 §9.2)", () => {
  it("joins two hosts' initials with an ampersand", () => {
    expect(monogramFrom(["Марія", "Андрій"])).toBe("М&А");
  });
  it("gives one host one letter", () => {
    expect(monogramFrom(["Олена"])).toBe("О");
  });
  it("splits one string that names two people", () => {
    expect(monogramFrom(["Марія та Андрій"])).toBe("М&А");
    expect(monogramFrom(["Олена й Андрій"])).toBe("О&А");
    expect(monogramFrom(["Mary & John"])).toBe("M&J");
    expect(monogramFrom(["Anna and Tom"])).toBe("A&T");
  });
  it("keeps the first two of three or more", () => {
    expect(monogramFrom(["Мама", "Тато", "Бабуся"])).toBe("М&Т");
  });
  it("reads the first letter, past quotes and capitalisation", () => {
    expect(monogramFrom(["«квітка»"])).toBe("К");
  });
  it("falls back to the product's own letter when no host is named", () => {
    const brandLetter = [...LANDING.uk.brand][0];
    expect(monogramFrom([])).toBe(brandLetter);
    expect(monogramFrom(["  ", "—"])).toBe(brandLetter);
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm --filter inv-app-web exec vitest run test/monogram.test.ts`
Expected: FAIL, because the module doesn't exist.

- [ ] **Step 3: Implement**

```ts
import { LANDING } from "./i18n";

// The seal's monogram (adr-019 §9.2), derived from the brief so nothing new is
// stored. With no host named it is the letter lp-brand-mono derives from
// INVINTO, so the product's mark is never spelled a second way.
const TWO_PEOPLE = /\s+(?:та|і|й|and)\s+|\s*&\s*/iu;

function initial(name: string): string | null {
  const letter = /\p{L}/u.exec(name);
  return letter ? letter[0].toLocaleUpperCase() : null;
}

export function monogramFrom(hosts: string[]): string {
  const initials = hosts
    .flatMap((host) => host.split(TWO_PEOPLE))
    .map(initial)
    .filter((letter): letter is string => letter !== null)
    .slice(0, 2);
  return initials.length ? initials.join("&") : [...LANDING.uk.brand][0];
}
```

- [ ] **Step 4: Run the tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/monogram.ts web/test/monogram.test.ts
git commit -m "Derive the seal's monogram from the hosts (adr-019 §9.2)"
```

## Task 2: The deckled mat, the seal, and the envelope's colours

**Files:**
- Modify: `web/src/styles.css`. In `:root`, add `--kraft`, `--kraft-deep` and `--night`, with a comment. In the Material system section, after `.grain`, add `.deckle` and `.seal`.
- Test: `web/test/styles.test.ts`

**Interfaces:**
- Produces: `.deckle` (a `--surface` wrapper with a deckled `clip-path`) and `.seal` (the accent disc, with a monogram or a glyph inside). Tasks 4–7 use both. The landing, editor and manage steps reuse them unchanged.

- [ ] **Step 1: Write the tests**

In `describe("paper materials (adr-019 §3)")`:

```ts
const material = (selector: string) =>
  ruleBlocks(stripComments(sections(css).get("Material system") ?? "")).find((r) =>
    r.selectors.includes(selector),
  )?.body ?? "";

it("defines the deckled mat as a --surface wrapper with an 11–14px pad and a polygon edge", () => {
  const deckle = material(".deckle");
  expect(deckle).toMatch(/background-color:\s*var\(--surface\)/);
  expect(deckle).toMatch(/clip-path:\s*polygon\(/);
  const pad = Number(/padding:\s*(\d+)px/.exec(deckle)?.[1]);
  expect(pad).toBeGreaterThanOrEqual(11);
  expect(pad).toBeLessThanOrEqual(14);
});

it("sets the seal's monogram in Literata italic 400, the one italic requested", () => {
  const seal = material(".seal");
  expect(seal).toMatch(/var\(--ui-accent\)/);
  expect(seal).toMatch(/font-family:\s*var\(--ui-font-display\)/);
  expect(seal).toMatch(/font-style:\s*italic/);
  expect(seal).toMatch(/font-weight:\s*400/);
  expect(seal).toMatch(/color:\s*var\(--surface\)/);
});
```

In `describe("token contrast (WCAG 2.1)")`:

```ts
it("keeps the seal's monogram, the envelope's title and its skip link legible", () => {
  const on = (ink: string, ground: string) =>
    contrast(tokens.get(ink) as string, tokens.get(ground) as string);
  expect(on("--surface", "--ui-accent")).toBeGreaterThanOrEqual(4.5);
  expect(on("--ui-ink", "--kraft")).toBeGreaterThanOrEqual(4.5);
  expect(on("--surface", "--night")).toBeGreaterThanOrEqual(4.5);
});
```

- [ ] **Step 2: Run them and see them fail**

Expected: FAIL on all three.

- [ ] **Step 3: Implement**

- `:root`, after `--table`: `--kraft: #c8a97e;`, `--kraft-deep: #b8966a;` and `--night: #24201c;`, with a comment saying the envelope (adr-019 §5.1) is the only reader.
- `.deckle`: `background-color: var(--surface); padding: 12px;` and a hand-written `clip-path: polygon(…)`. About 12 points per edge, each pushed in by 0–0.8%, so the edge reads torn rather than zig-zagged. Keep every point within 1% of the box so the 12 px pad absorbs it and the card is never clipped. Comment that without `clip-path` the mat is a plain rectangle, which is the fallback (adr-019 §3).
- `.seal`: a circle (`border-radius: 50%`, `display: inline-grid; place-items: center`, `aspect-ratio: 1`) filled with `radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.22), transparent 60%), var(--ui-accent)`, with `box-shadow: inset 0 0 0 2px rgba(var(--ui-accent-rgb), 0.6), inset 0 -2px 4px rgba(28, 26, 23, 0.25)`. Set `color: var(--surface)`, `font-family: var(--ui-font-display)`, `font-style: italic` and `font-weight: 400`. Size comes from the context rule (`width`), not from `.seal`.

- [ ] **Step 4: Run the stylesheet tests**

Expected: PASS, including `never sit on the card or inside it`.

- [ ] **Step 5: Commit**

```bash
git add web/src/styles.css web/test/styles.test.ts
git commit -m "Define the deckled mat and the seal, and the envelope's kraft (adr-019 §3)"
```

## Task 3: `useEnvelope`, decided once at mount

**Files:**
- Create: `web/src/hooks/useEnvelope.ts`
- Test: `web/test/useEnvelope.test.ts`

**Interfaces:**
- Consumes: `hasBeenViewed` from `viewedInvitations.ts`, and `LoadStatus`.
- Produces: `useEnvelope(id, status)`, which returns `{ phase: "none" | "closed" | "opening", open: () => void }`, plus `export const ENVELOPE_MS = 1200`. `"none"` means no envelope: a returning guest, reduced motion, not yet ready, or already opened.

- [ ] **Step 1: Write the tests**

```ts
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../src/api";
import type { LoadStatus } from "../src/hooks/usePublishedInvitation";
import { ENVELOPE_MS, useEnvelope } from "../src/hooks/useEnvelope";
import { useViewBeacon } from "../src/hooks/useViewBeacon";

afterEach(cleanup);
beforeEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  localStorage.clear();
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q }));
});
afterEach(() => vi.unstubAllGlobals());

describe("useEnvelope (adr-019 §5.1)", () => {
  it("shows on a first open once the invitation is ready", () => {
    const { result, rerender } = renderHook(({ s }) => useEnvelope("abc123", s), {
      initialProps: { s: "loading" as LoadStatus },
    });
    expect(result.current.phase).toBe("none");
    rerender({ s: "ready" });
    expect(result.current.phase).toBe("closed");
  });

  it("stays shut for a returning guest", () => {
    localStorage.setItem("inv-viewed:abc123", new Date().toISOString());
    const { result } = renderHook(() => useEnvelope("abc123", "ready"));
    expect(result.current.phase).toBe("none");
  });

  // The beacon writes the flag on ready. Re-reading it would close the
  // envelope during the very open it exists for.
  it("keeps the first-open decision when the beacon writes the flag", () => {
    vi.spyOn(api, "recordInvitationView").mockImplementation(() => {});
    const { result, rerender } = renderHook(
      ({ s }) => {
        useViewBeacon("abc123", s);
        return useEnvelope("abc123", s);
      },
      { initialProps: { s: "loading" as LoadStatus } },
    );
    rerender({ s: "ready" });
    expect(localStorage.getItem("inv-viewed:abc123")).not.toBeNull();
    rerender({ s: "ready" });
    expect(result.current.phase).toBe("closed");
  });

  it("never shows under reduced motion", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q }));
    const { result } = renderHook(() => useEnvelope("abc123", "ready"));
    expect(result.current.phase).toBe("none");
  });

  it("opens, then is gone within the 1.2 s budget", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useEnvelope("abc123", "ready"));
    act(() => result.current.open());
    expect(result.current.phase).toBe("opening");
    act(() => vi.advanceTimersByTime(ENVELOPE_MS));
    expect(result.current.phase).toBe("none");
    expect(ENVELOPE_MS).toBeLessThanOrEqual(1200);
  });

  it("shows every time when storage is blocked, which is skippable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = renderHook(() => useEnvelope("abc123", "ready"));
    expect(result.current.phase).toBe("closed");
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Expected: FAIL, because the module doesn't exist.

- [ ] **Step 3: Implement**

- `const [firstOpen] = useState(() => !hasBeenViewed(id) && !prefersReducedMotion())`. This is read once and never again. `prefersReducedMotion` returns `false` when `matchMedia` is missing, so jsdom without the stub behaves like a browser with no preference.
- `const [stage, setStage] = useState<"closed" | "opening" | "gone">("closed")`.
- `phase` is `"none"` unless `firstOpen && status === "ready" && stage !== "gone"`. Otherwise it is `stage`.
- `open()` sets `"opening"` and starts a `setTimeout(ENVELOPE_MS)` that sets `"gone"`. Clear the timer on unmount. A timer rather than `animationend` because the latter doesn't fire under 1 ms reduced-motion durations or in a background tab.
- A header comment saying why the decision is captured once (Review Focus 1), and that blocked storage shows the envelope every time on purpose (§5.1).

- [ ] **Step 4: Run the tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/hooks/useEnvelope.ts web/test/useEnvelope.test.ts
git commit -m "Decide the envelope once at mount, before the beacon writes the flag"
```

## Task 4: The envelope on the guest page

**Files:**
- Create: `web/src/components/guest/Envelope.tsx`
- Modify: `web/src/GuestPage.tsx`, `web/src/styles.css` (`Guest page` section), `web/src/i18n.ts` (`GuestStrings` and both `GUEST` tables)
- Test: create `web/test/GuestPage.test.tsx`, and modify `web/test/GuestCta.test.tsx`

**Interfaces:**
- Consumes: `useEnvelope` (Task 3), `monogramFrom` (Task 1), `.seal` and `--kraft`/`--night` (Task 2).
- Produces: `GUEST[lang].openInvitation` and `.skip`, and the `GuestPage.test.tsx` fixture that Tasks 5–7 extend.

- [ ] **Step 1: Write the tests**

Move the published fixture from `GuestCta.test.tsx` into a shared `web/test/guestFixture.ts` (with `hosts: ["Олена", "Андрій"]`), and import it from both files. In `GuestCta.test.tsx`'s two page tests, set `localStorage.setItem("inv-viewed:abc123", "…")` first, so they render as a returning guest and keep testing what they were written for.

New tests in `GuestPage.test.tsx` (stub `matchMedia` as in Task 3, spy `recordInvitationView`):
- **a first open shows the envelope**: a `dialog` named after the invitation's title, a button named `GUEST.uk.openInvitation` whose text is «О&А», and a `GUEST.uk.skip` button. The page behind it carries `inert`.
- **opening it reveals the page**: click the seal, advance `ENVELOPE_MS` with fake timers, and the dialog is gone and the page is no longer `inert`. Do the same for «Пропустити», and for Escape.
- **a returning guest gets no envelope**: no `dialog` with the flag preset.
- **the beacon fires on load, not on open**: `recordInvitationView` is called once before the envelope is touched (adr-013's denominator).
- **the envelope takes focus**: the seal is `document.activeElement` after it mounts.

- [ ] **Step 2: Run them and see them fail**

- [ ] **Step 3: Implement**

- `Envelope.tsx`: `role="dialog"`, `aria-modal="true"` and `aria-label={title}` on `.gr-env`, which fills the viewport on `--night`. Inside it, `.gr-env-body` (`--kraft`) holds `.gr-env-flap` (`--kraft-deep`, `transform-origin: top`), the title in `.gr-env-to` (`--ui-ink`, display face 400), and `<button className="seal gr-env-seal" aria-label={t.openInvitation}>{monogram}</button>`. Below the body sits `<button className="gr-env-skip">{t.skip}</button>` (`--surface` text on `--night`). Focus the seal in an effect with a ref (not `autoFocus`, which Biome's a11y rules reject). Escape calls `open`.
- `data-phase="opening"` runs three keyframes inside 1.2 s with `--ease-ios`, transform and opacity only: the flap `rotateX(180deg)` over 0–400 ms, the envelope dropping (`translateY(110%)`, fading out) over 300–900 ms, and the page rising (`translateY(16px)` → 0, opacity 0 → 1) over 600–1200 ms. The page's rise is a `.gr-page[data-rising]` class that `GuestPage` sets while `phase === "opening"`.
- `GuestPage.tsx`: `const envelope = useEnvelope(id, status)`. Render the page as today with `inert={envelope.phase !== "none"}` on `.gr-page`, then `{envelope.phase !== "none" && <Envelope … />}` after it. The page is mounted and loaded underneath from the start (§5.1: nothing waits on the animation).
- Add a `@media (prefers-reduced-motion: reduce)` rule hiding `.gr-env` as a backstop for a preference that changes after mount.
- Strings: `openInvitation` is "Open the invitation" / «Відкрити запрошення». `skip` is "Skip" / «Пропустити».

- [ ] **Step 4: Run the guest tests and the stylesheet tests**

Expected: PASS, including `never sit on the card or inside it` (the envelope is a sibling of the page, not a parent of `.inv`).

- [ ] **Step 5: Commit**

```bash
git commit -m "Open the invitation from an envelope on a guest's first visit (adr-019 §5.1)"
```

## Task 5: The pinned bar, the countdown and the quiet actions

**Files:**
- Modify: `web/src/calendar.ts` (add `daysUntil`), `web/src/GuestPage.tsx`, `web/src/i18n.ts`, `web/src/styles.css`
- Create: `web/src/components/guest/GuestBar.tsx`, `web/src/components/guest/QuietActions.tsx`, `web/src/components/guest/Countdown.tsx`
- Delete: `web/src/components/guest/GuestActions.tsx` once its share row has moved (Task 6)
- Test: `web/test/calendar.test.ts`, `web/test/GuestPage.test.tsx`

**Interfaces:**
- Produces: `daysUntil(start: EventStart, now?: Date): number | null`, and the strings `reply`, `countdown` ("{n} {form} to go" / «До свята {n} {form}»), `countdownToday`, `dayForms` and `route`. `addToCalendar` keeps its key, and its Ukrainian becomes «У календар».

- [ ] **Step 1: Write the tests**

`calendar.test.ts`:

```ts
describe("daysUntil", () => {
  const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);
  const start = (y: number, m: number, d: number) => ({ year: y, month: m, day: d, hour: null, minute: 0 });
  it("counts calendar days in local time", () => {
    expect(daysUntil(start(2027, 8, 12), at(2027, 8, 12, 23))).toBe(0);
    expect(daysUntil(start(2027, 8, 12), at(2027, 8, 11, 23))).toBe(1);
  });
  // Crosses Kyiv's 2027-03-28 change. CI runs in UTC, where this passes
  // trivially, so run the file once with TZ=Europe/Kyiv before committing.
  it("is not thrown by a daylight-saving change in between", () => {
    expect(daysUntil(start(2027, 4, 1), at(2027, 3, 27))).toBe(5);
  });
  it("is null once the day has passed, exactly when isPastEventStart is true", () => {
    const now = at(2027, 8, 13, 0);
    expect(daysUntil(start(2027, 8, 12), now)).toBeNull();
    expect(isPastEventStart(start(2027, 8, 12), now)).toBe(true);
  });
});
```

`GuestPage.test.tsx`, rendering as a returning guest:
- **the bar** shows `details_line`'s first line, then a `link` named `GUEST.uk.reply` with `href="#rsvp"`, and the reply card's wrapper has `id="rsvp"`.
- **the countdown** reads «До свята N днів» for a parsed future date (fake the clock), «Свято сьогодні!» on the day, and is absent when the date doesn't parse or has passed.
- **«У календар» is offered before a reply** when the date parses, and is absent when it doesn't (amends FR-4.5).
- **«Маршрут»** is a link to `https://www.google.com/maps/search/?api=1&query=` plus the encoded `venue, city`, and is absent when both are null.

- [ ] **Step 2: Run them and see them fail**

- [ ] **Step 3: Implement**

- `daysUntil`: build both days as local midnight, as `isPastEventStart` does, then `Math.round(diff / 86_400_000)`. Rounding absorbs a 23- or 25-hour day. Return `null` when the result is below 0.
- `GuestBar`: `.gr-bar` is sticky at `top: 0` on `--surface`, with a `1px solid var(--edge)` bottom border and a z-index above the card and below the envelope. It holds a small `.seal` with the monogram (`aria-hidden`; the title is already the page's heading), `.gr-bar-when` (the first line, `--ink`) and `.gr-bar-where` (the rest, `--ink-muted`), each on one line with an ellipsis. Then `<a className="gr-bar-reply" href="#rsvp">{t.reply}</a>` in `--ui-accent`.
- `#rsvp` gets `scroll-margin-top` equal to the bar's height. Add `scroll-behavior: smooth` on `html` under `prefers-reduced-motion: no-preference` only.
- `Countdown`: `.gr-countdown` in the display face at 400, `--ink-muted` on the ground. It renders nothing when `daysUntil` is null.
- `QuietActions`: two text actions under the mat, each an icon in `currentColor` and a label in `--ink-muted`. «У календар» reuses `handleAddToCalendar`; «Маршрут» reuses today's `place` and maps URL. Each is hidden on its own condition.
- Order under the card: countdown, then quiet actions, then the reply card, then `GuestCta`. The language switch stays above the card (§5.2, FR-6.3).

- [ ] **Step 4: Run the tests**

- [ ] **Step 5: Commit**

```bash
git commit -m "Pin the details and reply link, count down, and offer calendar and route before a reply (adr-019 §5.2, §9.4)"
```

## Task 6: The reply card and the thanks seal

**Files:**
- Modify: `web/src/components/guest/RsvpForm.tsx`, `ThanksCard.tsx` and `icons.tsx`, plus `web/src/i18n.ts` and `web/src/styles.css`
- Test: `web/test/GuestPage.test.tsx`, `web/test/styles.test.ts`

**Interfaces:**
- Produces: the strings `replyTitle` ("Will you join us?" / «Ви з нами?»), `yes` ("I'll be there!" / «Буду!») and `no` (unchanged). `replyKicker` and `attendingQuestion` go, and the heading labels the radio group through `aria-labelledby`.

- [ ] **Step 1: Write the tests**

- In `styles.test.ts`, replace `describe("the guest page's components")`'s accent-only check with **"carry no hex literal at all"**: scan every `components/guest/*.tsx` for `#[0-9a-f]{3,8}\b`, expecting `[]`. Today that fails on `RsvpForm.tsx`, `ThanksCard.tsx` and four strokes in `icons.tsx`. Keep the old test's comment about why the stylesheet ratchet can't see components.
- `GuestPage.test.tsx`: the reply card's heading is `GUEST.uk.replyTitle`, and the radio group is labelled by it. After a yes, the thanks card shows the seal with a ✓, `thanksTitle`, the pill, `changeAnswer`, and a share action named `GUEST.uk.share`. After a no, it shows `declinedTitle` and no share action. `changeAnswer` reopens the form with its values intact (FR-4.4, unchanged).

- [ ] **Step 2: Run them and see them fail**

- [ ] **Step 3: Implement**

- `RsvpForm`: `<h2 id="rsvp-title" className="gr-reply-title">` replaces `.gr-kicker` and `.gr-question`. Tiles become tactile: an active border in `--ui-accent`, a lift of `translateY(-1px)` with `--e-1`, and a transition at `--dur-fast`. Icons colour through `currentColor` with the tile's `color` set in CSS. The decline tile's idle cross (today a literal `#8d8577`, the old whisper) takes `--ink-faint`, not `--ink-whisper`, so the `sub-faint inks` list doesn't grow. The limits (100, 1–10, 500) are unchanged.
- `ThanksCard`: `.seal.gr-thanks-seal` with a `CheckIcon` in `currentColor` replaces the badge, halo and twinkles. A decline gets `.seal.gr-thanks-seal.muted`. The share action moves here from `GuestActions` (yes only, same handler, same copied state), styled like the quiet actions. Then delete `GuestActions.tsx` and the `.gr-row*`, `.gr-badge*` and `.gr-tw` rules along with `@keyframes gr-tw`.
- `icons.tsx`: every remaining hex stroke becomes `currentColor`, coloured by the CSS rule that places it.
- `.gr-reply-title` is in the display face at 500 (the weight test).

- [ ] **Step 4: Run the web suite**

Expected: PASS. `sub-faint inks` still lists `.gr-brand` and `.gr-cta-mark` and nothing new, because the CTA doesn't change (FR-4.7).

- [ ] **Step 5: Commit**

```bash
git commit -m "Ask «Ви з нами?» on tactile tiles, and seal the thanks (adr-019 §5.3)"
```

## Task 7: The card on the mat, the grained ground, and the loading and dead-link states

**Files:**
- Modify: `web/src/GuestPage.tsx`, `web/src/components/guest/GuestNotFound.tsx`, `web/src/styles.css`
- Test: `web/test/styles.test.ts`

- [ ] **Step 1: Write the tests**

- In `describe("the guest page's text")`, delete the rows for selectors that are gone and add the new ones:
  - `.gr-bar-when` on `--surface` at 4.5
  - `.gr-bar-where` on `--surface` at 4.5
  - `.gr-bar-reply` on `--surface` at 4.5
  - `.gr-countdown` on `--app-bg` at 4.5
  - `.gr-quiet-action` on `--app-bg` at 4.5
  - `.gr-env-to` on `--kraft` at 4.5
  - `.gr-env-skip` on `--night` at 4.5

  Every surviving row keeps its floor.
- Add: **"keeps the grain on the guest page"**: `.gr-page` sets `background-color: var(--app-bg)` and no `background` shorthand, and `GuestPage.tsx` and `GuestNotFound.tsx` both render `gr-page grain`.
- Add: **"sets the card on the deckled mat, and the mat's shadow outside its clip"**: `GuestPage.tsx` wraps `<InvitationPreview` in a `deckle` element, and the rule placing that wrapper's parent uses `filter: drop-shadow(`.

- [ ] **Step 2: Run them and see them fail**

- [ ] **Step 3: Implement**

- `.gr-inv` becomes `<div className="gr-inv"><div className="deckle"><InvitationPreview … /></div></div>`, with `filter: drop-shadow(var(--e-2))` on `.gr-inv`.
- `.gr-page`: replace the `background` shorthand with `background-color: var(--app-bg)`, and add `grain` to the class list in both components.
- `.gr-status` takes the display face at 400. `GuestNotFound` gets no new layout (§5.5): it is on paper and its title is already Literata 500.
- Update `GuestPage.tsx`'s header comment: visuals follow adr-019 §5 (A2), not the pre-paper `GuestRsvp` boards.
- The ≥ 960 px layout keeps its two columns, and the bar spans both.

- [ ] **Step 4: Run the full suite**

Run: `pnpm build && pnpm test`
Expected: all green. Then `git diff main -- web/src/styles.css` should show no hunk inside the `Invitation card` section.

- [ ] **Step 5: Commit**

```bash
git commit -m "Set the guest's card on the deckled mat, on a grained paper ground (adr-019 §5.2, §5.5)"
```

## Task 8: Docs in the same PR

**Files:**
- `docs/02-functional-requirements.md`, FR-4:
  - FR-4.5 amended: the `.ics` is offered whenever a date parses, before or after a reply.
  - New FR-4.8, the envelope: first open per browser, decided once at mount, skippable, ≤ 1.2 s, never under reduced motion, never delays the beacon.
  - New FR-4.9: the pinned bar, the countdown, «Маршрут», and the monogram from `brief.hosts`.
- `docs/03-non-functional-requirements.md`:
  - NFR-9's reduced-motion bullet now covers the envelope, read through the same media query from `matchMedia` because it must not mount at all.
  - Re-measure NFR-1's bundle line, as the line instructs. If it nears the 145 kB trigger, say so and name the code split.
- `docs/decisions/adr-019-paper-direction.md`: a dated "Amended 2026-xx-xx (step 3)" note under §5 recording the decisions table at the top of this plan, and the device check's result.
- `web/CLAUDE.md`, under "Share loop (adr-013)": the envelope reads `inv-viewed:<id>` once at mount, before `useViewBeacon` writes it, and must never re-read it. Under Structure, add `useEnvelope` to the hooks list.

- [ ] **Commit**

```bash
git commit -m "Record the guest page on paper: FR-4.5, FR-4.8–4.9, NFR-1, NFR-9, adr-019 §5"
```

## Task 9: Look, then the real-device check, then the PR

- [ ] **Step 1: Look at it**

Run `pnpm build && pnpm --filter inv-app-server start` (it serves the built SPA on port 3001). Publish a gallery sample from `/create?sample=wedding-romantic` and open the guest link at 360 px and 1280 px in both languages. Check:
- first open, a returning visit, and reduced motion (DevTools rendering emulation)
- a date that parses, one that doesn't, and one that's past
- 0, 1 and 2 hosts
- every Review Focus item

Tune `--kraft`, `--kraft-deep` and `--night` here if they read wrong, and record the final values.

- [ ] **Step 2: The device check (adr-019 §5.1). This blocks the merge**

On the same Wi-Fi, send yourself `http://<this machine's LAN IP>:3001/i/<id>` in Viber and open it on a mid-range Android phone inside Viber's in-app browser. It must be the production build: the dev server's unminified bundle stutters for reasons that aren't the envelope's. Clear Viber's site data, or publish a fresh invitation, so it is a first open. Watch the envelope open twice.
- **Smooth:** record the device, the Android version and the Viber version in the PR.
- **Stutter:** replace the three keyframes with a single cross-fade (the envelope's opacity to 0 and the page's to 1 over the same 1.2 s), keep the first-open rule, and record why (adr-019's revisit trigger).

- [ ] **Step 3: Open the PR**

Follow `.github/pull_request_template.md`. Put the decisions table and the device check's result in the description, along with screenshots at 360 px of the envelope, the page with its bar, and the thanks seal.

## After this plan

Step 4 (landing) reuses `.deckle` and `.seal` for its hero and nav. Step 7 («Ще не знаю») adds a third tile to the reply card built here, and its count to the thanks pill.
