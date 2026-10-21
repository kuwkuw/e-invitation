# Spec — the paper direction (A2)

**Date:** 2026-10-21 · **Status:** chosen visually, not yet settled as an ADR ·
**Lands as:** amends NFR-9's token values and adds four FR changes (§9). Keeps
the adr-018 *system* — the `:root` block, the `CONVERTED` ratchet, the contrast
tests — and replaces its *direction*.

Intended to be settled as **adr-019** before implementation, following this
repo's pattern (`Settle X as adr-N` → implementation plan → PRs). Written to
convert to that structure nearly verbatim.

## Context

**adr-018 installed a system and chose a look. Only the look is being
replaced.** In September four bearings were rendered and D1, full Liquid Glass,
won. In October three new directions were rendered against the real copy —
editorial paper, bold/playful, calm utility — on a Claude Design canvas,
*Invinto Redesign — Directions*. **A (editorial paper) was chosen** and then
refined into **A2** after a round of consumer research. The canvas rows `A2 ·
Landing`, `A2 · Guest — envelope`, `A2 · Guest — RSVP`, `A2 · Editor` and `A2 ·
Replies` are the reference for everything below. Where this spec and the
mockups disagree, this spec wins: it was written after reading the code, and
§6.4 and §5.6 correct two things the mockups got wrong.

Glass did what it promised for the editor. It did nothing for the two surfaces
that decide whether this product spreads: the **guest page**, which every guest
sees, and the **landing page**, where the "create your own" referral lands
(FR-4.7, [07-monetization.md](../../07-monetization.md) §5.1). Neither surface
was the subject of D1.

**What the research said, and what it changes here.**

| Finding | Source | Consequence in this spec |
|---|---|---|
| The opening moment sells the product, but Paperless Post's ~9 s envelope hid the RSVP; their faster rebuild pinned RSVP beside the key details and cut load time by 30% | InVision, *Paperless Post* | §5.1 envelope ≤ 1.2 s, skippable, first open only; §5.2 pinned bar |
| 2026 stationery is tactile and editorial: deckled edges, wax seals, monograms, the envelope as a main event, modern high-contrast serif over heavy script | Paperlust; Stationery HQ | §3 paper materials; §2 Literata |
| Personality and instant feedback make guests talk about it; hosts see the count on the event itself | Pratt IXD critique of Partiful; CNBC on Partiful | §5.3 reply copy and feedback; §7.2 counts in the editor header |
| UA competitors sell features and reassurance. Invito: 2,500–5,000 ₴ and ≥ 4 working days for custom work. Evonta: "800+ clients". Vivati: free to create, pay to publish | invito.ua, evonta.com.ua, vivati.com.ua | §6.1 the speed claim; §6.3 trust blocks with real numbers only |

**Why paper suits this codebase as much as the market.**

1. **It leaves the card alone, as D1 did.** All the paper material — grain, the
   deckled mat, the envelope, the seal — sits *around* `.inv`, never on it. The
   six palettes, `type-*`, `layout-*`, `ornament-*` and their OG twin in
   `server/src/og/render.ts` ship unchanged. FR-10.5's token-only share card is
   untouched.
2. **adr-018 already built the exit.** Its rule that "every glass surface must
   be legible with its blur removed" is what makes the move from glass to paper
   a token swap rather than a rewrite (§4.1).
3. **It retires a hand-mirror** (§4.2) instead of adding one.

**Tailwind stays rejected** for adr-018's reasons. Nothing in this direction
needs a compiler.

## Decision

### 1. Token values change; token names do not

Every converted section already reads tokens, so the nine converted sections
re-skin by editing `:root` alone. The table gives each new value with its
contrast on the grounds it must clear. Ratios were computed with the same WCAG
formula `cssTokens.ts` uses.

| Token | Today | Paper | Floor it owes · measured |
|---|---|---|---|
| `--ground` | `#f3ece2` | `#F4EFE6` (paper) | — |
| `--app-bg` | `#f6f5f2` | `#F4EFE6` | collapses onto `--ground`: same job, now the same value |
| `--surface` | `#ffffff` | `#FBF8F2` (card stock) | — |
| new `--table` | — | `#EAE3D6` | the darker field a card is set on (editor canvas, landing hero) |
| `--ui-ink` | `#23211d` | `#1C1A17` | 4.5 · 15.2 paper / 13.6 table |
| `--ink-muted` | `#6b6659` | `#5E574C` | 4.5 · 6.2 paper / 6.7 surface / 5.6 table |
| `--ink-faint` | `#8d8577` | `#7E7668` | 3.0 · 3.9 paper / 4.2 surface / 3.5 table |
| `--ui-accent` | `#b3592e` | `#8C2F2B` (oxblood) | white on it 8.2; on paper 7.2 |
| `--accent-hi` | `#a04e27` | `#73241F` | hover/pressed |
| `--ui-accent-rgb` | `179, 89, 46` | `140, 47, 43` | pinned to `--ui-accent` by the existing test |
| `--edge` | `#e4ddd0` | `#D6CCBA` (the ruled line) | non-text |
| `--edge-soft` | `#ece7dd` | `#E6DDCD` | non-text |
| `--rsvp-yes` | `#3d6b47` | unchanged | 5.4 paper / 5.8 surface |
| `--rsvp-no` | `#a83f3f` | unchanged | 5.3 paper / 5.8 surface |
| `--r-sm…--r-xl` | 8–22 px | 3 / 4 / 4 / 6 px | stationery corners; `--r-pill` stays for the language switch |
| `--e-1…--e-3` | soft drops | flatter, warmer `rgba(28,26,23,…)` | paper lies on a table and doesn't float |

The `--caution-*` group keeps its *job* (the manage-token block must not read
as clean chrome, adr-010 §3) and is re-tuned toward a kraft tone. The test that
pins it to a dE distance from `--wash`/`--surface` runs unchanged.

The sub-faint inks (`--ink-placeholder`, `--ink-whisper`) keep their role and
their test: wordmarks and aria-hidden icons only. `--ink-whisper` becomes
`#8D8577` (3.2 on paper, still a logotype).

**One mockup error is corrected here.** A2's disabled RSVP submit is white on
`#B5A99A`, which is 2.3:1, and `textFloors` already holds `.gr-submit:disabled`
to 3:1. Disabled becomes `--ink-muted` on `--edge-soft` (5.3:1).

### 2. Type: Literata and Golos Text for chrome; the card's faces untouched

- `--ui-font-display`: Playfair Display → **Literata** (opsz 7–72, 400/500,
  italic 400). It is high-contrast at display sizes and readable at 14 px,
  which is what lets one family carry headings, numbers and pull-quotes.
- new `--ui-font-body`: **Golos Text** (400/500/600). It was designed for
  Cyrillic first; until now the chrome inherited the system stack.
- Both cover Cyrillic, as the `@import` comment requires.
- The `@import` gains two families and keeps the four card families, because
  `.type-*` still needs them. **Budget:** request only the axes above, and
  record the gzipped CSS plus font bytes in the PR against NFR-1's bundle line.
- Wordmark: `INVINTO` in Literata 500, tracked 0.32 em. The name and its
  casing don't change (adr-016 §9).

### 3. Three paper materials, all chrome, all CSS

| Material | Where it may appear | Built from | Fallback |
|---|---|---|---|
| **Grain** | the page ground and `--table` fields | two `radial-gradient` dot layers at 3/7 px, ≤ 5% alpha | none needed. It is under the noise floor for contrast and the tests composite without it |
| **Deckled mat** | the wrapper around `.inv` on guest, editor canvas, landing hero, gallery | `clip-path: polygon(…)` on a `--surface` wrapper with an 11–14 px pad | `clip-path` polygon is Baseline Widely available; without it the mat is a plain rectangle |
| **Seal** | envelope (§5.1), guest pinned bar, editor header, manage header, landing | radial-gradient disc in the accent family plus inset shadows, monogram in Literata italic | — |

**The rule, stated so it can be tested:** no material class may appear on
`.inv` or any descendant of it. A new test asserts that no `.inv …` selector
uses `.deckle`, `.grain` or `.seal`, and that `InvitationPreview.tsx` renders
none of them. This is the paper equivalent of D1's "glass in the chrome only",
and it is what keeps the OG mirror honest.

### 4. What goes away

#### 4.1 Glass, by the token swap adr-018 designed

`.glass` and `.glass-solid` keep their class names in this iteration and get
paper values: tint set to `--surface` at alpha 1, blur `none`, edge set to a 1 px
`--edge` hairline. Because the tint already carried the contrast, no
text-bearing surface needs re-measuring beyond the alpha change, and the glass
contrast test passes trivially. Renaming to `.sheet` / `.sheet-solid` is a
follow-up rename PR with zero pixel change, kept separate so the re-skin diff
stays reviewable.

#### 4.2 The palette-tinted editor ground and its hand-mirror

The six-entry `.cc-shell[data-palette=…]` map is **removed**. The editor sets
the card on `--table` with grain, as stationery is shown, and the card's own
palette does the colour work. This deletes one NFR-8 hand-mirror and its
enum-coverage test.

The alternative was to keep the map and tint `--table` per palette. It was
rejected because, in mockup, a kraft table under the festive navy card read
better than any tint. Keeping the attribute costs nothing if this ever returns,
so `data-palette` stays on `.cc-shell` as an unused hook.

### 5. Guest page — first, because every share depends on it

#### 5.1 The envelope

- Shown on the **first open per browser only**, keyed on the existing
  `inv-viewed:<id>` flag (`viewedInvitations.ts`). A returning guest lands on
  the invitation with no ceremony.
- Kraft envelope on a dark ground. The recipient line reads "для …" only when a
  named link exists, which today it never does, so it shows the invitation
  title. The seal carries the monogram (§9.2).
- Tap the seal or "Пропустити" → flap rotates, envelope drops, card rises.
  **Total ≤ 1.2 s**, `--ease-ios`. The RSVP becomes reachable the moment the
  card settles, and the page never waits for the animation to finish loading
  anything.
- `prefers-reduced-motion: reduce` → no envelope at all; straight to the
  invitation.
- Crawlers and the server-rendered `/i/:id` head are unaffected (FR-3.5). The
  envelope is client-only.
- The view beacon fires on load as today, not on open, so adr-013's
  denominator doesn't move.

#### 5.2 The page

- **Pinned bar** (sticky, `--surface`): seal, date and time, venue, «Відповісти»
  anchor. The date and venue lines come from `copy.details_line`; nothing new
  is parsed.
- Card on the deckled mat, language switch above it (FR-6.3 unchanged).
- Two quiet actions under the card: **«У календар»** (the existing `.ics`,
  now offered before RSVP when a date parses, not only after an attending
  reply — a one-line amendment to FR-4.5) and **«Маршрут»** (§9.4).
- **Countdown** «До свята N днів» (§9.4). It is hidden whenever
  `parseEventStart` returns null or the date is past.

#### 5.3 The reply card

- Heading «Ви з нами?», three choices as tactile tiles (§9.1 decides whether
  the third ships), party-size stepper only after «Буду!», note labelled as a
  wish to the hosts.
- Feedback is immediate on tap (state, border, lift). The thanks state turns the
  seal into a ✓ with copy matched to the answer, and «Змінити відповідь» keeps
  FR-4.4's re-submit model.
- FR-4.3's limits (name ≤ 100, party 1–10, note ≤ 500) are unchanged.

#### 5.4 The referral line

FR-4.7 is unchanged: one link, the wordmark at a whisper plus one muted line,
below the reply card, in both states. A2 keeps it exactly so.

#### 5.5 Dead link and loading states

These were not mocked. `GuestNotFound` and the status line take the paper
ground and Literata, and need no new layout. Design them in the PR rather than
on the canvas.

#### 5.6 Tests that move

The `textFloors("Guest page", …)` table is re-pointed. The selectors stay; the
grounds change from `--app-bg` to `--ground` (now equal) and from `--surface`
to the new `--surface`. Every row must still pass at its existing floor, and
the §1 values were chosen so they do.

### 6. Landing page

#### 6.1 The hero shows the product working

A sentence types itself into the composer and the invitation rises out of an
envelope on the `--table` field. It is CSS-only (`steps()` typing, one rise
keyframe) and is skipped under reduced motion. The sub-line gains the
differentiator: «За хвилину, а не за чотири робочі дні.»

`prerender.ts` emits the hero as string literals, and the crawler copy must stay
static text. The typing effect is a class on an element whose text is already
the full sentence, so prerendered and hydrated markup match.

#### 6.2 "What guests see"

A new section with a still of the envelope and seal. Copy comes from new
`LANDING` strings in both languages.

#### 6.3 Trust, with real numbers or none

- **Stat strip**: «1 хвилина» (true by NFR-1) is shippable today. Any count of
  guests or hosts renders only once it comes from `GET /api/metrics`, and the
  strip collapses to the one true cell until then. No placeholder number ever
  reaches production.
- **Testimonials**: the section is absent until there are real ones with
  consent.
- **FAQ**: four `<details>`. It is crawlable, so its strings join the
  `LANDING`/SEO mirror discipline, and FAQ structured data is a follow-up under
  adr-016.

#### 6.4 Pricing copy, corrected

A2's composer footnote («платите лише при публікації») and its FAQ answer
contradict [07-monetization.md](../../07-monetization.md) §5.2: publishing stays
free, and the paid step is a one-time unlock that removes the badge. Gating
publish "severs the loop". The copy becomes:

- composer footnote: «Безкоштовно · без реєстрації для гостей»
- FAQ «Скільки це коштує?»: «Створення й надсилання — безкоштовно. Якщо
  захочете прибрати позначку INVINTO і відкрити додаткові можливості — разова
  оплата [ЦІНА].» This ships only when §5.2 does; until then the answer is just
  «Безкоштовно.»

#### 6.5 Unchanged

Returning-host block, account footer, the gallery link in the nav (FR-14.7),
and SEO strings other than the FAQ.

### 7. Editor

1. **Canvas**: card on the deckled mat on grain `--table`. The adr-018 §3
   near-bleed inset becomes the mat's pad, so WYSIWYG with the guest card holds
   on both breakpoints.
2. **Header**: back, seal, title, and, **after first publish only**, a live
   «16 буде · 3 ні» link to `/manage/:id`. This reuses the manage token the
   editor already holds and the existing `/rsvps` summary, and it fails silent
   like adr-012 §6.
3. **Design tabs**: underlined tabs replace the segmented glass bar. Палітра /
   Шрифт / Макет / **Конверт** / Фон. «Конверт» holds the monogram field and
   three seal colours (§9.2).
4. **Chat**: the peek line and composer keep their behaviour. The peek line is
   set in Literata italic, as the assistant's voice. The FR-1.8 banner is
   unchanged.
5. **Not yet mocked, needed before this PR**: desktop two-pane layout, the
   share panel (`SharePanel`, including the manage-token block), `FieldSheet`,
   `AuthGate`, BYOK. Each restyles by tokens, but the desktop layout and the
   share panel need one board each on the canvas first.

### 8. Manage dashboard

1. Header with seal, title, and date with a countdown.
2. **Summary**: large Literata total, a thin three-part bar (yes / no /
   maybe-if-§9.1), counts beneath.
3. **«Нагадати гостям»**: copies the public link. It is the existing share
   action, relabelled for its purpose here.
4. **«Побажання від гостей»**: the newest RSVP `note` as a pull-quote, with a
   link to all of them. Notes already exist (FR-4.3), so this is presentation
   only.
5. The response list, CSV, refresh, "N new since your last visit", superseded
   history and the notify toggle are unchanged in behaviour.
6. The «Відкрили N раз» line depends on §9.3 and is omitted until it is
   decided.

### 9. Product decisions this direction raises

Each row is an FR change and is listed so the ADR can accept or defer it
separately. **The visual re-skin (§1–§4) does not depend on any of them.**

| # | Decision | What it costs | Recommendation |
|---|---|---|---|
| 9.1 | **Third reply, «Ще не знаю»** | `attending: z.boolean()` becomes a three-value enum in `schemas.ts` and its hand-mirror in `types.ts`; `rsvpSummary.ts` counts; CSV; notification email copy; manage UI. Existing rows map `true`/`false` → `yes`/`no` at read | **Accept, as its own PR after the guest re-skin.** It is the single most "consumer" feature in the research, and a maybe is information a host wants. Maybe never counts toward the headcount |
| 9.2 | **Monogram on the seal** | Default derives from `brief.hosts` initials, so nothing new is stored: «Марія», «Андрій» → «М&А»; one host → one letter; none → the INVINTO «І». An optional override (`design.monogram?: string`, ≤ 4 chars, plain text, never markup) needs a schema field and the editor's «Конверт» tab | **Ship the derived default with the guest re-skin; the override later.** It is the cheapest high-delight item in the set |
| 9.3 | **Per-invitation open count** | Today `recordInvitationView()` increments one *global* counter in `metrics.ts`. A per-record count needs a field on the stored invitation, written behind the same `claimView` dedupe, and returned only on the token-gated `/rsvps`. Per-guest "opened but didn't reply" would need named links (rejected territory, monetization §6) | **Defer.** Useful but not needed for the look, and it adds a write to every guest load on a file-backed store (NFR-7) |
| 9.4 | **Countdown and «Маршрут»** | Countdown reuses `parseEventStart`, so it is client-only. «Маршрут» is a plain maps search URL built from `brief.venue` + `brief.city`, with no API, key or embed; hidden when both are null | **Accept with the guest re-skin.** No server change, no new data |

### 10. Not in this iteration

- **Gallery.** It isn't in A2. It converts by taking its section (22 hex) onto
  the new tokens and the mat. That is one `CONVERTED` line, after the landing.
- **Crash screen, Sign-in gate, Account sheets, Share panel: signed in, Reply
  notifications.** They inherit the new values wherever they already read
  tokens, and stay on the allowlist otherwise. The sign-in gate shares the share
  sheet's first frame (adr-014 §2), so it converts with the share panel board.
- **Photo cover / monogram printed on the card.** That would change the card
  and its OG mirror; it belongs in a separate ADR if it comes back.
- **Music, gift list, love story.** Competitor features, not design.

### 11. Rollout

Each step is a PR with its own green suite. The order is chosen so that every
step either changes pixels or behaviour, never both.

1. **Tokens and fonts** (§1, §2, §4.1). Pixel change across every converted
   section; no DOM change. Update the contrast assertions' expected grounds,
   add the material-isolation test (§3), and record bundle bytes.
2. **Remove the palette ground map** (§4.2), including its test.
3. **Guest page** (§5) plus monogram default (§9.2), countdown and
   «Маршрут» (§9.4).
4. **Landing** (§6), including the corrected pricing copy and the
   `LANDING`/SEO string mirror.
5. **Editor** (§7). Needs the desktop and share-panel boards first.
6. **Manage** (§8).
7. **«Ще не знаю»** (§9.1), schema-first.
8. **Gallery** onto the ratchet (§10).
9. **Rename** `.glass*` → `.sheet*` (zero pixels).

`.design-sync/` ships `styles.css`'s closure. Run the DS sync after step 1 so
the design project's screens render against paper.

### 12. Risks

- **Rendered colours drift from this table.** The values are new and every
  floor was computed rather than eyeballed, but `cssTokens.ts` remains the
  judge. If a row fails, move the value; don't lower the floor.
- **Font weight.** Two added families on a messenger webview's first load. If
  NFR-1's line is exceeded, drop Literata's italic axis first and set the
  pull-quotes upright.
- **Animation on low-end Android webviews.** The envelope uses transform and
  opacity only, and runs once per browser. If it janks on a real device test,
  it ships as a cross-fade.
- **Taste risk.** The research supports the direction, but the canvas was
  judged by one person. Step 3 ships first partly so real guests see it before
  the host-side screens follow.

## Sources

- InVision, *Inside Design: Paperless Post* — https://www.invisionapp.com/inside-design/paperless-post
- Pratt IXD, *Design critique: Partiful iOS app* (2026) — https://ixd.prattsi.org/2026/09/design-critique-partiful-ios-app/
- CNBC via NBC New York, *Meet Partiful* — https://www.nbcnewyork.com/news/business/money-report/meet-partiful-the-gen-z-party-planning-staple-thats-taking-on-apple/6231135/
- Design Compass, *Apple Invites* — https://designcompass.org/en/2025/02/05-1tp-3tea/apple-invites/
- Paperlust, *2026 Wedding Invitation Trends* — https://paperlust.co/blog/?p=12758
- Stationery HQ, *10 Best Wedding Invitation Trends of 2026* — https://www.stationeryhq.com/pages/the-10-best-wedding-invitation-trends-of-2026
- Vivati — https://vivati.com.ua/ · Invito — https://invito.ua/ · Evonta — https://evonta.com.ua/
