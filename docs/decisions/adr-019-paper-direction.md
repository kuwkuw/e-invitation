# ADR-019 — The paper direction

**Status:** accepted · **Date:** 2026-10 · Lands as amendments to **NFR-9**
(token values, and a paper-material rule in place of the glass one), **NFR-8**
(one hand-mirror retired), **NFR-1** (re-measured), **FR-4.3** (a third reply),
**FR-4.5** (add-to-calendar before replying), **FR-11.11** and **FR-12** (§10),
plus new guest-page requirements for the envelope, the countdown and the route
link, which take their ids when they ship.

Replaces [adr-018](adr-018-material-system.md)'s **direction** and keeps its
**system**: the `:root` token block, the `CONVERTED` ratchet and the contrast
tests stay exactly as they are, and this decision changes what they hold. The
long form, with the mockup references and the research sources, is the
[paper-direction spec](../superpowers/specs/2026-10-21-paper-direction-design.md).
Where the two differ, this ADR wins: it settles the four product questions the
spec left open (§9), takes in a design pass the spec did not mention (§10), and
pins one ordering constraint the spec did not state (§5.1).

## Context

**adr-018 installed a system and chose a look. Only the look is being
replaced.** In September four bearings were rendered and full Liquid Glass won.
Glass did what it promised for the editor. It did nothing for the two surfaces
that decide whether this product spreads, because neither was its subject: the
**guest page**, which every guest sees, and the **landing page**, where the
"create your own" referral lands (FR-4.7,
[07-monetization.md](../07-monetization.md) §5.1).

In October three new directions were rendered against the real copy on a Claude
Design canvas, *Invinto Redesign — Directions*: editorial paper, bold/playful
and calm utility. **Editorial paper was chosen**, then refined into **A2** after
a round of consumer research. The canvas rows `A2 · Landing`,
`A2 · Guest — envelope`, `A2 · Guest — RSVP`, `A2 · Editor` and `A2 · Replies`
are the visual reference for everything below.

| Finding | Source | Consequence here |
|---|---|---|
| The opening moment sells the product, but Paperless Post's ~9 s envelope hid the RSVP; their faster rebuild pinned the RSVP beside the key details and cut load time by 30% | InVision, *Paperless Post* | §5.1 envelope ≤ 1.2 s, skippable, first open only; §5.2 pinned bar |
| 2026 stationery is tactile and editorial: deckled edges, wax seals, monograms, the envelope as a main event, modern high-contrast serif over heavy script | Paperlust; Stationery HQ | §3 paper materials; §2 Literata |
| Personality and instant feedback make guests talk about it; hosts see the count on the event itself | Pratt IXD on Partiful; CNBC on Partiful | §5.3 reply feedback; §7 counts in the editor header |
| UA competitors sell features and reassurance. Invito: 2,500–5,000 ₴ and ≥ 4 working days for custom work. Evonta: "800+ clients". Vivati: free to create, pay to publish | invito.ua, evonta.com.ua, vivati.com.ua | §6.1 the speed claim; §6.3 trust with real numbers only |

**Why paper suits this codebase, not only the market.**

1. **It leaves the card alone, as glass did.** Every paper material — grain,
   the deckled mat, the envelope, the seal — sits *around* `.inv`, never on it.
   The six palettes, `type-*`, `layout-*`, `ornament-*` and their hand-mirrored
   twin in `server/src/og/render.ts` ship unchanged, and so does FR-10.5's
   token-only share card.
2. **adr-018 already built the exit.** Its rule that every glass surface must
   be legible with its blur removed is what makes this a token swap rather than
   a rewrite (§4.1). The tint always carried the contrast.
3. **It retires a hand-mirror** (§4.2) instead of adding one.

**What this decision cannot be measured against.** Production has carried
almost no traffic for its whole life: 27 generations, 16 publishes and 9 guest
views lifetime, with one generation in the forty days to 2026-10-22. No usage
number will say whether paper beat glass. The direction rests on the research
above and on one person's reading of the canvas, and §12 orders the rollout so
that real guests see the guest page before the host-side screens follow.

**Tailwind stays rejected**, for adr-018's three reasons. Nothing in this
direction needs a compiler.

## Decision

### 1. Token values change; token names do not

Every converted section already reads tokens, so the nine converted sections
re-skin by editing `:root` alone. Ratios below are WCAG contrast, computed with
the formula `web/test/cssTokens.ts` uses, and re-checked for this ADR.

| Token | Today | Paper | Floor owed · measured |
|---|---|---|---|
| `--ground` | `#f3ece2` | `#F4EFE6` (paper) | — |
| `--app-bg` | `#f6f5f2` | `#F4EFE6` | collapses onto `--ground`: same job, now the same value |
| `--surface` | `#ffffff` | `#FBF8F2` (card stock) | — |
| new `--table` | — | `#EAE3D6` | the darker field a card is set on (editor canvas, landing hero) |
| `--ui-ink` | `#23211d` | `#1C1A17` | 4.5 · 15.16 paper / 16.38 surface / 13.61 table |
| `--ink-muted` | `#6b6659` | `#5E574C` | 4.5 · 6.23 paper / 6.73 surface / 5.59 table |
| `--ink-faint` | `#8d8577` | `#7E7668` | 3.0 · 3.92 paper / 4.23 surface / 3.52 table |
| `--ui-accent` | `#b3592e` | `#8C2F2B` (oxblood) | white on it 8.21; on paper 7.17 |
| `--accent-hi` | `#a04e27` | `#73241F` | hover/pressed · white on it 10.49 |
| `--ui-accent-rgb` | `179, 89, 46` | `140, 47, 43` | pinned to `--ui-accent` by the existing test |
| `--edge` | `#e4ddd0` | `#D6CCBA` (the ruled line) | non-text |
| `--edge-soft` | `#ece7dd` | `#E6DDCD` | non-text |
| `--rsvp-yes` | `#3d6b47` | unchanged | 5.40 paper / 5.84 surface |
| `--rsvp-no` | `#a83f3f` | unchanged | 5.32 paper / 5.75 surface |
| `--r-sm…--r-xl` | 8–22 px | 3 / 4 / 4 / 6 px | stationery corners; `--r-pill` stays for the language switch |
| `--e-1…--e-3` | soft drops | flatter, warmer `rgba(28,26,23,…)` | paper lies on a table and doesn't float |

The `--caution-*` group keeps its **job** — the manage-token block must not read
as clean chrome ([adr-010](adr-010-host-manage-link.md) §3) — and is re-tuned
toward kraft. The test that holds it a dE distance from `--wash` and
`--surface` runs unchanged.

The sub-faint inks keep their role and their rule: wordmarks and aria-hidden
icons only. `--ink-whisper` becomes `#8D8577` (3.19 on paper, still a
logotype), and `--ink-placeholder` is re-derived in step 1 to sit between it and
`--ink-faint`, under the same test.

**One mockup error is corrected here.** A2 draws the disabled RSVP submit as
white on `#B5A99A`, which is 2.31:1, and `textFloors` already holds
`.gr-submit:disabled` to 3:1. The submit keeps today's rule — `--ink-muted`
text — and its fill moves from `--edge` to `--edge-soft`: 5.30:1. (On the new
`--edge` it would still clear, at 4.49, but the ruled-line value is darker than
a fill should be.) That row's ground changes in the test; every other guest
`textFloors` row keeps its selector, ground and floor, and is re-measured
against the new values rather than re-pointed.

**Amended 2026-10-22, step 1.** Putting the table into the stylesheet and
running the tests moved four things this section had stated:

- **The sub-faint tier is now held by order, not by a ceiling.** At 3.44:1 on
  `--surface` the whisper above breaks the test that kept both sub-faint inks
  under 3:1. The owner kept the darker whisper, so that test became an
  ordering one — whisper < placeholder < `--ink-faint` on `--surface` — and
  `--ink-placeholder` was re-derived to `#857d6f` (3.84). The rule about which
  selectors may read them is unchanged.
- **`--accent-ink`, which the table above omits, moved `#876955` →
  `#846652`.** At its old value it falls to 4.38:1 on paper, under
  `.hm-new-line`'s 4.5 floor. Same hue, the smallest move that clears it
  (4.58).
- **No test pins `--caution-*`.** The sentence above saying one "runs
  unchanged" was wrong: the dE distances live only in a stylesheet comment.
  The group stays at its glass values in step 1; its kraft re-tune, and a
  test that pins its distance, belong to the share-panel step (5), where its
  board is.
- **Elevation got numbers:** `--e-1` `0 1px 2px rgba(28, 26, 23, 0.06)`,
  `--e-2` `0 4px 12px rgba(28, 26, 23, 0.1)`, `--e-3`
  `0 12px 32px rgba(28, 26, 23, 0.16)`. `--glass-shadow` reads `--e-2`.
- **"Re-skin by editing `:root` alone" holds for colour, not geometry.** The
  radius and elevation tokens reach the editor, whose sections read them
  (`Creation chat` alone has 29 `var(--r-*)` reads); the guest page, share
  panel, manage dashboard and landing still set literal px radii and rgba
  shadows, so their corners stayed where they were while the editor's went
  to 3–6 px. Steps 3–6 move each surface's geometry onto the tokens as they
  rebuild it.
- **`--accent-wash` is the paper ground's own colour** (`#f7efe3` on
  `#f4efe6`, 1.00:1), so a borderless wash fill on the page vanishes. The
  landing's chips and step icons sat exactly there and became card stock
  with an `--edge` hairline; every other wash sits on a surface or carries
  a border. The token's re-tune toward the oxblood family is left to the
  steps that own its readers.

### 2. Type: Literata and Golos Text for the chrome; the card's faces untouched

- `--ui-font-display`: Playfair Display → **Literata** (opsz 7–72, 400/500,
  italic 400). High-contrast at display sizes and readable at 14 px, so one
  family carries headings, numbers and pull-quotes.
- new `--ui-font-body`: **Golos Text** (400/500/600), designed Cyrillic-first.
  Until now the chrome inherited the system stack.
- Both cover Cyrillic, as the `@import` comment requires. The `@import` gains
  the two families and keeps the four card families, which `.type-*` still
  needs. **Request only the axes above.**
- The wordmark is `INVINTO` in Literata 500, tracked 0.32 em. The name and its
  casing do not change ([adr-016](adr-016-public-discoverability.md) §9).

The fonts arrive through the Google Fonts `@import`, so NFR-1's bundle line
(CSS + JS, gzipped) does not count them. Step 1 re-measures that line as usual
**and** records the added font transfer beside it, because a messenger
webview's first load pays for both.

**Amended 2026-10-22, step 1.** Measured with `node scripts/measure-fonts.mjs`
(latin + cyrillic woff2), and three changes followed:

- **Golos Text is requested at 400–800, not 400–600.** The chrome already
  sets 700 and 800 in about 80 rules, which would otherwise be synthesized.
  The variable file is 58.7 kB at either range, so the wider request costs
  nothing.
- **Every rule that reads `--ui-font-display` sets 400 or 500**, held by a
  test. Sixteen chrome headings at 700 dropped to 500, since Literata is
  requested at 400–500 and anything heavier is a faux bold.
- **The wordmark's 0.32 em is the desktop tracking.** At phone width the
  tracked Literata wordmark took the signed-out landing nav to 419 px, so it
  overflowed every phone narrower than that; before this direction it fit a
  360 px phone with nothing to spare. Below 560 px the nav wordmark is
  1.02 rem at 0.12 em, the size the counted nav already used, and it fits at
  360–414 px in both nav states.
- **A third nav state already overflowed, and still does.** Signed out with
  the sign-in link but no held tokens — what every first-time visitor sees
  where sign-in is configured — needs the wordmark, the gallery link, the
  sign-in link and the switcher on one line: 62 px too wide at 360 px on
  `main`, 63 px here, still over at 414. It predates this direction and is
  left to the landing step (4), which rebuilds that nav.

The opsz axis ships, as decided above: a page in the chrome's two faces
fetches 189.3 kB of them (Literata 130.6, Golos 58.7), and 72.1 kB more where
it sets italic. NFR-1 records it.

### 3. Three paper materials, all chrome, all CSS

| Material | Where it may appear | Built from | Fallback |
|---|---|---|---|
| **Grain** | the page ground and `--table` fields | two `radial-gradient` dot layers at 3/7 px, ≤ 5% alpha | none needed: it is under the noise floor for contrast, and the tests composite without it |
| **Deckled mat** | the wrapper around `.inv` on the guest page, editor canvas, landing hero, gallery | `clip-path: polygon(…)` on a `--surface` wrapper with an 11–14 px pad | without `clip-path` the mat is a plain rectangle |
| **Seal** | envelope (§5.1), guest pinned bar, editor header, manage header, landing | a radial-gradient disc in the accent family plus inset shadows, monogram in Literata italic | — |

**The rule, stated so it can be tested: no material class appears on `.inv` or
inside it.** A new test asserts that no `.inv …` selector uses `.deckle`,
`.grain` or `.seal`, and that `InvitationPreview.tsx` renders none of them. It
is the paper form of glass's "chrome only", and it is what keeps the OG mirror
honest.

Everything in this section and in §5 is Baseline Widely available. Nothing
served at `/i/:id` needs feature detection, which matters because the floor
there is WKWebView inside a messenger (`CLAUDE.md`, Browser support).

### 4. What goes away

#### 4.1 Glass, by the token swap adr-018 designed

`.glass` and `.glass-solid` keep their class names in this iteration and take
paper values: tint `--surface` at alpha 1, blur `none`, edge a 1 px `--edge`
hairline. The tint already carried the contrast, so no text-bearing surface
needs re-measuring beyond the alpha change, and the glass contrast test passes
trivially. Renaming to `.sheet` / `.sheet-solid` is a separate PR with zero
pixel change (step 9), so the re-skin diff stays reviewable.

Three things in adr-018 change meaning with the blur gone, and are recorded so
nobody keeps honouring them by habit:

- **§7's hardware gate has nothing left to gate.** It existed because blur
  costs GPU fill rate on mid-range Android. Its environment — a real device in
  Viber's in-app webview — is still the right place to test, and §5.1 reuses
  it for the envelope.
- **The toolbar fix is no longer coupled to that gate.** The roadmap ties the
  `.cc-design` sticky bug to a re-run of the gate, because fixing it would put
  a blurred layer stationary over a scrolling backdrop. Without blur that costs
  nothing, and the bug becomes an ordinary layout fix in the editor step.
- **The `prefers-reduced-transparency` branch becomes a no-op**, since nothing
  is translucent. It goes with the rename in step 9; `prefers-reduced-motion`
  stays and gains the envelope (§5.1) and the hero (§6.1).

#### 4.2 The palette-tinted editor ground and its hand-mirror

The six-entry `.cc-shell[data-palette=…]` map is **removed**. The editor sets
the card on `--table` with grain, as stationery is shown, and the card's own
palette does the colour work. That deletes one NFR-8 hand-mirror and its
enum-coverage test.

Keeping the map and tinting `--table` per palette was considered and rejected:
in mockup, a kraft table under the festive navy card read better than any tint.
The attribute costs nothing to keep, so `data-palette` stays on `.cc-shell` as
an unused hook in case this ever returns.

### 5. Guest page — first, because every share depends on it

#### 5.1 The envelope

- Shown on the **first open per browser only**, keyed on the existing
  `inv-viewed:<id>` flag (`viewedInvitations.ts`). A returning guest lands on
  the invitation with no ceremony.
- **The decision is read once, before the beacon writes the flag.**
  `useViewBeacon` calls `markViewed` in an effect as soon as the invitation is
  ready, so a component that re-reads `hasBeenViewed` on render would see the
  flag flip during its own first open and close the envelope mid-animation.
  Capture the value at mount and never re-read it.
- **Blocked storage shows the envelope every time.** `hasBeenViewed` answers
  `false` when storage throws (private-mode Safari, blocked site data), which is
  the right answer for the counter and a tolerable one here: the envelope is
  skippable and ≤ 1.2 s.
- A kraft envelope on a dark ground. The recipient line reads "для …" only when
  a named link exists, which today it never does, so it shows the invitation
  title. The seal carries the monogram (§9.2).
- Tapping the seal or «Пропустити» rotates the flap, drops the envelope and
  raises the card. **Total ≤ 1.2 s**, `--ease-ios`, transform and opacity only.
  The RSVP is reachable the moment the card settles, and nothing waits on the
  animation to load.
- `prefers-reduced-motion: reduce` → no envelope at all; straight to the
  invitation.
- Crawlers and the server-rendered `/i/:id` head are unaffected (FR-3.5). The
  envelope is client-only.
- The view beacon fires on load as it does today, not on open, so adr-013's
  denominator doesn't move.

**Before step 3 merges**, the envelope runs once on a real mid-range Android
inside Viber's in-app webview — adr-018 §7's environment, the one the guests
are actually in. If it stutters there, it ships as a cross-fade.

#### 5.2 The page

- **Pinned bar** (sticky, `--surface`): seal, date and time, venue, and a
  «Відповісти» anchor. The date and venue come from `copy.details_line`;
  nothing new is parsed.
- The card on the deckled mat, with the language switch above it (FR-6.3
  unchanged).
- Two quiet actions under the card: **«У календар»** — the existing `.ics`,
  now offered **before** a reply whenever a date parses, not only after an
  attending one (amends FR-4.5) — and **«Маршрут»** (§9.4).
- A **countdown**, «До свята N днів» (§9.4), hidden whenever
  `parseEventStart` returns null or the date has passed.

#### 5.3 The reply card

- Heading «Ви з нами?». Three choices as tactile tiles (§9.1), a party-size
  stepper only after «Буду!», and the note labelled as a wish to the hosts.
- Feedback is immediate on tap: state, border, lift. The thanks state turns the
  seal into a ✓ with copy matched to the answer, and «Змінити відповідь» keeps
  FR-4.4's re-submit model.
- FR-4.3's limits (name ≤ 100, party 1–10, note ≤ 500) are unchanged.

#### 5.4 The referral line

FR-4.7 is unchanged: one link — the wordmark at a whisper plus one muted line —
below the reply card, in both states.

#### 5.5 Dead link and loading states

Not mocked. `GuestNotFound` and the status line take the paper ground and
Literata and need no new layout; they are designed in the PR, not on the canvas.

**Amended 2026-10-24, step 3.** Building §5 settled what it left open, as the
step's plan proposed (`docs/superpowers/plans/2026-10-24-guest-page-paper.md`):

- **Monogram:** the first two hosts' initials; a third and beyond go unnamed.
  One host string naming two people («Марія та Андрій», "Mary & John") splits on
  та / і / й / and / & first.
- **The share action:** kept, as a quiet action in the thanks card after a
  yes. Calendar and directions moved under the card, where §5.2 put them, and
  the post-yes rows went.
- **The countdown on the day:** «Свято сьогодні!» rather than «0 днів».
- **The pinned bar:** `details_line`'s first line, then any further lines
  joined with « · », each truncated.
- **Reduced motion:** read through `matchMedia` once at mount, so the envelope
  is never mounted. A preference switched on afterwards makes its opening
  instant rather than hiding it, which would leave the page inert beneath an
  invisible overlay.
- **Envelope colours:** `--kraft` `#c8a97e`, `--kraft-deep` `#b8966a` and
  `--night` `#24201c`, each pinned by a contrast test.
- **The mat's shadow:** on its own `.gr-mat` wrapper. `clip-path` cuts off a
  box-shadow on the mat, and a `drop-shadow` on the column would shadow the
  countdown's text too.
- **The reply card took stationery corners** (`--r-*`) and elevation
  (`--e-*`) in place of its glass-era 16–24 px radii and literal shadows.

The real-device check (§5.1) is recorded in the PR that merges this step.

### 6. Landing page

#### 6.1 The hero shows the product working

A sentence types itself into the composer and the invitation rises out of an
envelope on the `--table` field. CSS only — `steps()` for the typing, one rise
keyframe — and skipped under reduced motion. The sub-line gains the
differentiator: «За хвилину, а не за чотири робочі дні.»

`prerender.ts` emits the hero as string literals and crawler copy must stay
static text, so the typing effect is a class on an element whose text is
already the full sentence. The prerendered and the client-rendered markup say
the same thing ([adr-016](adr-016-public-discoverability.md) §10).

#### 6.2 "What guests see"

A new section with a still of the envelope and seal, its copy in new `LANDING`
strings in both languages.

#### 6.3 Trust, with real numbers or none

- **Stat strip.** «1 хвилина» is true by NFR-1 and ships now. Any count of
  guests or hosts renders only once it comes from `GET /api/metrics`, and the
  strip collapses to the one true cell until then. **No placeholder number
  ever reaches production.**
- **Testimonials** are absent until there are real ones, given with consent.
- **FAQ**: four `<details>`. They are crawlable, so their strings join the
  `LANDING` / `SEO` mirror discipline. FAQ structured data is a later item under
  adr-016.

#### 6.4 Pricing copy, corrected

A2's composer footnote («платите лише при публікації») and its FAQ answer
contradict [07-monetization.md](../07-monetization.md) §5.2, where publishing
stays free and the paid step is a one-time unlock that removes the badge;
gating publish "severs the loop". So:

- composer footnote: «Безкоштовно · без реєстрації для гостей»
- FAQ «Скільки це коштує?»: «Безкоштовно.» — until §5.2 ships. Only then does
  it gain the sentence about a one-time payment to remove the INVINTO mark.

#### 6.5 Unchanged, and one exception

The returning-host block, the gallery link in the nav (FR-14.7) and the SEO
strings other than the FAQ are unchanged. **The account footer is the
exception:** its reply-email control becomes the checkbox of §10.

### 7. Editor

1. **Canvas**: the card on the deckled mat on a grained `--table`. adr-018 §3's
   near-bleed inset becomes the mat's pad, so the editor stays WYSIWYG with the
   guest's card at both breakpoints.
2. **Header**: back, seal, title and, **after the first publish only**, a live
   «16 буде · 3 ні» link to `/manage/:id`. It reuses the manage token the editor
   already holds and the existing `/rsvps` summary, and fails silent as
   [adr-012](adr-012-batch-response-counts.md) §6 does.
3. **Design tabs**: underlined tabs replace the segmented glass bar — Палітра,
   Шрифт, Макет, **Конверт**, Фон. «Конверт» holds the monogram (§9.2). adr-018
   §4's one non-cosmetic rule survives the change: swatches read their colours
   from the real `palette-*` custom properties, so an option cannot drift from
   the card.
4. **Chat**: the peek line and composer keep their behaviour; the peek line is
   set in Literata italic, as the assistant's voice. The FR-1.8 banner is
   unchanged.
5. **Boards needed before this step**: the desktop two-pane layout and the
   share panel — `SharePanel` with its manage-token block and §10's checkbox —
   each get a board in the design project first. `FieldSheet`, `AuthGate` and
   the BYOK panel restyle by tokens and need none.

### 8. Manage dashboard

1. A header with the seal, title, and date with a countdown.
2. **Summary**: a large Literata total and a thin three-part bar — yes, no,
   maybe (§9.1) — with the counts beneath.
3. **«Нагадати гостям»** copies the public link: the existing share action,
   relabelled for its purpose here.
4. **«Побажання від гостей»**: the newest RSVP note as a pull-quote, with a link
   to all of them. Notes already exist (FR-4.3); this is presentation only.
5. The response list, CSV, refresh, "N new since your last visit" and the
   superseded history are unchanged. The reply-email control keeps its
   behaviour and becomes §10's checkbox.
6. The «Відкрили N раз» line is omitted: §9.3 is deferred.

### 9. The product decisions this direction raised

The visual re-skin (§1–§4) depends on none of these. Each is settled
separately.

| # | Decision | What it costs | Settled |
|---|---|---|---|
| 9.1 | **A third reply, «Ще не знаю»** | `attending` in `schemas.ts` becomes a three-value enum, with its `types.ts` mirror; `rsvpSummary.ts` counts; CSV; the notification email's counts; the manage summary | **Accepted, as its own PR after the guest re-skin** (step 7) |
| 9.2 | **A monogram on the seal** | Derived from `brief.hosts` initials, so nothing new is stored. An override (`design.monogram`) would need a schema field and the «Конверт» tab | **Derived default accepted** with the guest re-skin; **override deferred** |
| 9.3 | **A per-invitation open count** | A field on the stored invitation, written behind the existing `claimView` dedupe, returned only on the token-gated `/rsvps` | **Deferred** |
| 9.4 | **Countdown and «Маршрут»** | Client-only: `parseEventStart`, and a plain maps search URL | **Accepted** with the guest re-skin |

**9.1, the maybe reply.** The single most "consumer" feature in the research,
and a maybe is information a host wants. The rules that come with it:

- **Maybe never counts toward the headcount.** It is reported beside yes and
  no, never added to either.
- **Stored records keep loading.** There is no migration step (`CLAUDE.md`,
  Reviewing: stored data), so the schema reads an existing `true`/`false` as
  `yes`/`no` and only new replies are written in the enum form.
- **The email stays count-only.** A maybe joins the counts in the reply email;
  no guest name enters it ([adr-015](adr-015-rsvp-notifications.md) §3).
- It is schema-first: `schemas.ts` and `types.ts` in one pass, then the
  summary, CSV, email and UI.

**9.2, the monogram.** «Марія», «Андрій» → «М&А»; one host → one letter; no
hosts → the letter `lp-brand-mono` already derives from `INVINTO`, so the
product's mark is not spelled a second way. The seal is chrome, never the card
(§3), so the OG mirror is untouched. The override is deferred because it is
host-entered free text inside `design`, which until now has held only closed
enums ([adr-003](adr-003-no-image-generation.md)); that deserves its own
decision when someone asks for it.

**9.3, the open count, deferred.** It isn't needed for the look, and it adds a
write to the invitation record on every deduped guest load, on a file-backed
store whose single-process assumption is NFR-7's. A per-guest "opened but
didn't reply" would need a link per guest, which the product does not issue —
a decision of its own about what a guest's URL may carry, not part of a look.

**9.4, countdown and route.** «Маршрут» is a plain maps search URL built from
`brief.venue` and `brief.city`, with no API, key or embed, and hidden when both
are null. The countdown reuses `parseEventStart` and hides exactly when the
calendar action has no date to offer.

### 10. The 2026-08-02 design pass (PR #66) is taken into this direction

PR #66 merged into its base branch a minute after that branch had reached
`main`, so none of it shipped. It predates adr-018, so it is **redone on paper
tokens in the steps that rebuild the same surfaces**, not merged. The branch
`feat/ds-notify-checkbox` is the reference until step 6 lands, then goes.

**Reply email becomes one checkbox on all three surfaces** — the share panel
(step 5), the landing account footer (step 4) and `/manage/:id` (step 6). Today
it is a sentence with a text button on each. The pass's findings stand:

- Under opt-in ([adr-015](adr-015-rsvp-notifications.md) §7, amended) this
  control is the only thing between the feature and its non-existence, and a
  quiet sentence in a stack of quiet sentences is an offer nobody notices.
- **A real `input`**, so it is keyboard-reachable, with the **whole label as a
  44 px target**. A text button's target was about 17 px, on a product whose
  hosts are on phones inside a messenger.
- **Two rows, two roles.** A **name** that is identical in every state, and a
  **state** row that changes entirely and carries the **scope** — "every
  invitation in your account" — *before* the host agrees, not after.
- **The checked box is ink (`--ink-muted`), never `--ui-accent`**: the accent
  means "the public link" (adr-010 §3).
- **Glyphs:** a struck envelope states a condition where nothing is pressable
  (the notification email, the unsubscribe page); a square carries state where
  something is. The envelope therefore leaves the share panel and the account
  footer.

**The rule behind it amends adr-010 §3: the share panel's hierarchy counts
fills, not affordances.** The public link owns the only filled accent so that a
host reaching for "the link" reaches for the safe one. That made every later
addition default to *quieter*, which was right until the panel had to carry
something a host must act on. So:

> A new control in the share panel may take any affordance that spends no fill.
> It may not take colour, weight or button geometry that rhymes with the
> primary.

**The sign-in link stays a quiet pair with the language switcher.** On `main`
it already sits on the far side of the switcher from the Create button; beside
the accent it would read as that button's caption ("create… or sign in?"). The
landing step keeps that order and gives the pair its paper styling. The
invitations card still carries no sign-in **offer**, and the pass's refinement
holds: what the card may not carry is an offer, not a **fact**. *A line that
would disappear by itself after sign-in is a fact; one that disappears because
it was accepted is an offer.*

**Not taken, as #66 also declined it:** naming the account's invitation count
on the dashboard ("for all three of your invitations"). `/manage/:id` is
authorized by a manage token and the count belongs to the session — a new
cross-surface data dependency bought for a phrase. "Not just this one" names the
boundary without it.

The requirement text — FR-12.12 for the checkbox, the FR-11.11 placement note,
adr-010 §3.1 and the adr-015 note — is written in the PRs that build it,
because the docs describe what is built. That is also why #108 recovered #66 as
a roadmap note rather than porting its docs.

### 11. Not in this iteration

- **The gallery.** It isn't in A2. It converts by taking its section (22 hex)
  onto the new tokens and the mat — one `CONVERTED` line, after the landing
  (step 8).
- **Crash screen, Sign-in gate, Account sheets, Share panel: signed in, Reply
  notifications.** They inherit the new values wherever they already read
  tokens and stay on the allowlist otherwise. The sign-in gate is the share
  sheet's first frame ([adr-014](adr-014-host-accounts.md) §2), so it converts
  with the share panel's board.
- **A photo cover, or a monogram printed on the card.** Either would change the
  card and its OG mirror, and would need its own ADR.
- **Music, gift lists, love stories.** Competitor features, not design.
- **The monogram override** (§9.2) and **the open count** (§9.3).

### 12. Rollout

Each step is a PR with its own green suite, ordered so that every step changes
pixels or behaviour, never both. Merge each into `main` before the next is
based on it, or retarget the next to `main` first (`CLAUDE.md`, Workflow).
Stacked PRs have stranded work here at least four times, adr-018's own
implementation (#82) and #66 among them.

1. **Tokens and fonts** (§1, §2, §4.1). A pixel change across every converted
   section and no DOM change. Update the contrast rows (§1), add the
   material-isolation test (§3), re-measure NFR-1 and record the font transfer.
   **Run the design sync afterwards**, so the design project's screens render
   against paper.
2. **Remove the palette ground map** (§4.2) and its test.
3. **Guest page** (§5), with the derived monogram (§9.2), the countdown and
   «Маршрут» (§9.4). Gated on the real-device envelope check (§5.1).
4. **Landing** (§6), with the corrected pricing copy, the `LANDING` / `SEO`
   mirror, and the account footer's checkbox (§10).
5. **Editor** (§7), with the share panel's checkbox (§10). Needs the desktop
   and share-panel boards first.
6. **Manage** (§8), with its checkbox (§10). Delete `feat/ds-notify-checkbox`
   after this lands.
7. **«Ще не знаю»** (§9.1), schema-first.
8. **Gallery** onto the ratchet (§11).
9. **Rename** `.glass*` → `.sheet*`, and drop the reduced-transparency branch
   (§4.1). Zero pixels.

## Consequences

- **The app speaks two languages again, more briefly.** Step 1 re-skins every
  converted section at once, so the seam is between surfaces that have their
  A2 *layout* and surfaces that only have its *values*. That is a smaller seam
  than adr-018's glass-versus-flat.
- **NFR-9 is amended, not replaced.** Its token-block, contrast and
  reduced-motion commitments stand. The per-palette ground clause goes with
  §4.2, and the glass bullet is restated for paper: no material on the card,
  and every surface opaque.
- **NFR-8 loses an entry**, the palette→ground map: a hand-mirror retired
  rather than added.
- **The guest page gains behaviour, not only a look**: the envelope, the
  countdown, the route link, add-to-calendar before a reply, and later the
  maybe. Its class assertions are the first of the three heavily-asserted
  surfaces (guest, landing, manage) to move.
- **The maybe reply changes the stored RSVP shape.** It is the one step here
  that a careless implementation could make irreversible — a record written in
  the new form that the old reader cannot load — which is why it comes last
  among the behaviour changes and goes schema-first.
- **Two more font families on a guest's first load.** Measured in step 1,
  against NFR-1, and the reason §2 requests only the axes it names.
- **adr-018 stays accepted.** Its system is untouched and its §2 ratchet keeps
  shrinking; only its direction, §4's toolbar and §7's gate are overtaken here.

## Revisit triggers

- **A contrast row fails in `cssTokens.ts`** → move the value, never the floor.
  The table above is computed, but the test is the judge.
- **NFR-1's trigger, or a visibly slow first load in a messenger webview** →
  drop Literata's **optical-size** axis first (130.6 kB → 59.0 kB, on every
  page), then its italic (32.1 kB once opsz is gone, 72.1 kB with it, and
  only on pages that set it) with the pull-quotes set upright. *Corrected 2026-10-22: this said italic first,
  before either was measured.*
- **The envelope stutters on the real-device check** → it ships as a
  cross-fade, and the first-open rule stays.
- **A guest or host objects to the direction** before the host-side steps
  land → stop after step 3 and re-render, rather than carrying a look nobody
  but the canvas's judge has endorsed through four more surfaces.
- **Maybes outnumber yeses** across real events → the third choice is being
  used as a soft no, and the manage summary should say so rather than show
  three equal bars.
- **A host asks whether guests opened the link**, or records move off the file
  store (the roadmap's SQLite item) → reopen §9.3.
