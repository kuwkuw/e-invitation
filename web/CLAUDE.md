# web/ — Vite + React client

Loaded when working under `web/`. Repo-wide rules and commands are in the
root `CLAUDE.md`.

## Structure and routing (adr-011)

Six routes in `src/AppRoutes.tsx` (`/`, `/create`, `/gallery`,
`/gallery/:occasion`, `/manage/:id`, `/i/:id`) on react-router-dom in
**declarative mode only**: no data routers, loaders or nested layouts.
`main.tsx` is only the `BrowserRouter` entry; the route table is separate so
tests drive it through a `MemoryRouter`.

- `:id` params are permissive: **`isInvitationId`** (`src/invitationId.ts`)
  guards them in the hooks that own the fetch, so a malformed id renders a
  dead-link state and never reaches the API.
- Navigate with `useNavigate`/`<Link>`, never `location.href`. Strip URL
  params and fragments with `navigate(..., { replace: true })`; **nothing may
  call `history.replaceState` behind the router**.
- Screens (`App.tsx`, `GuestPage.tsx`, `ManagePage.tsx`) are composition only.
  **New state goes in a hook** in `src/hooks/`, which is what tests drive;
  markup goes in `src/components/{editor,guest,manage,landing}/`
  (`LandingPage.tsx` is composition too; `AccountFooter` and `YourInvitations`
  predate `landing/` and stay at the root, beside the two components more than
  one page renders: `NotifyCheckbox`, the reply-email control, and
  `Countdown`, which takes its strings from the page because the guest's
  follow the invitation's language and the host's the UI's). Hooks:
  `useInvitationEditor` (what the invitation is), `usePublishing` (where it's
  published), `useHostManage`, `useHostInvitationCounts` and `useCopyLink`
  (host access; the last is the dashboard's one copy action, quiet when the
  clipboard refuses),
  `usePublishedInvitation`, `useRsvpForm`, `useViewBeacon` and `useEnvelope`
  (guest side),
  `useReferralSource` and `useGallerySample` (editor entry).

## Testing

Vitest under jsdom with `@testing-library/react`. **`vite.config.ts` sets
`globals: false`, so RTL never auto-cleans**: component tests using `screen`
need `afterEach(cleanup)`. Anything touching the router needs a router
wrapper. Between cases, call `forgetHeldManageTokens()`
(`localStorage.clear()` can't reach the in-memory token map).

## Editor date rules (FR-1.7, FR-1.8)

Deliberately unequal, and both read one predicate, `isPastDate` in
`calendar.ts`:

- A date that won't parse into a calendar start is a **nudge**: the chat asks
  once per session (`datePrompted` ref) and publishing is untouched.
- A date already gone by is a **gate**: `useInvitationEditor` exposes
  `dateBlocked`, `App` disables Publish, and **`usePublishing.publish`
  refuses it outright**. That's the one funnel the press, a republish and the
  post-sign-in resume all go through. The refusal is repeated on every turn
  it's still true (no ref).
- "Past" is by **calendar day in the host's local time**, which is why it's a
  client check: the server's UTC "today" would refuse a same-day publish east
  of UTC. `dateBlocked` is derived from the invitation, not set by a generate,
  because restored drafts and gallery samples never ran one.

## Host access and accounts (adr-010, adr-014)

- The manage token is stored at publish under `inv-manage:<id>`. `/manage/:id`
  also accepts it from a `#t=` fragment (persisted, then stripped) or a pasted
  link. **Keep it out of query strings**: the fragment never reaches the
  server.
- The share panel shows the manage link as a subordinate, masked action. That
  hierarchy is the only thing stopping a host pasting the wrong link into a
  chat. With `navigator.share` the primary action is the native sheet and
  copying steps down (FR-3.6). The rule is the **count** of filled accents.
  `canShare` is read once in `usePublishing`. The sheet gets the guest link
  and title, never the manage token, and a dismissed sheet (`AbortError`)
  does nothing.
- For a signed-in host the manage block collapses behind "Show", which is safe
  only because the copy button collapses with it. **The copy button never
  renders without its warning** (tested).
- `useAuthSession` seeds `inv-manage:<id>` and `inv-invitations` from the
  keyring, so **no other hook knows accounts exist**. The one exception:
  `LandingPage` renders `mergeHostInvitations(local, account.invitations)`, a
  **union where the keyring wins by id**. `null` (no answer yet) is not `[]`.
- **The landing list is account-only where accounts exist**:
  `showList = status === "unavailable" || signedIn`. A signed-out host keeps
  every token; the `lp-nav-signin` link (only when signed out *and* sign-in
  is configured, `redirect_to=/`, FR-11.11) carries the held-token count
  (`allHeldManageTokens`). That count uses a **thin-space separator**, which
  defeats exact text matching in tests. `lp-nav-counted` drives the ≤800 px
  wordmark shrink and ≤370 px monogram, and keys off whether the count
  *renders*, not the count.
- `src/hostInvitations.ts` keeps a browser-local `{id, title, published_at,
  palette}` index (no secrets) for the returning-host list.
- The reply-email switch (adr-015) is **asked at publish** in the share panel,
  and also lives on the landing footer and `/manage/:id`, where it must say in
  words that it governs the whole account. On the landing footer it is
  `NotifyCheckbox` (adr-019 §10, FR-12.12): a real input, a name that never
  changes, a state line carrying the scope, ink and never the accent. On
  `/manage/:id` it is the same checkbox, whose on state names the address and
  "not just this one" and never the event (FR-12.11), rendered only when the
  session has an address. The share panel keeps a sentence and a button until
  adr-019's step 5 moves it onto it.
- The sign-in gate is the **first frame of the share sheet** (`AuthGate.tsx`),
  opened on the Publish press, never on a 401. `draft.ts` parks the editor's
  invitation before the redirect. `declined` and `failed` are distinct states,
  and the resume is **ref-guarded** (StrictMode would mint two links). A
  declined sign-in returns to where it started. Sign-out goes through
  `SignOutSheet`.

## RSVP answers (adr-019 §9.1)

A reply is yes, no or «Ще не знаю». **Read `answer`, never `attending`**: the
server sends `attending` true for a yes only, beside `answer`, so code from
before the maybe counts right after a revert, and the guest form sends both
for the same reason (`buildRsvpInput`). A maybe carries no party size and
never adds to `guests`. A total of replies is `yes + no + maybe`
(`YourInvitations`' row label).

## Browser storage

Every key is `inv-*` (`inv-manage:<id>`, `inv-manage-seen:<id>`,
`inv-viewed:<id>`, `inv-invitations`, `inv-llm-key`, `inv-ui-lang`,
`inv-guest-lang`).

- Per-invitation host state goes through `src/manageTokens.ts`
  (`manageTokenKey`, `manageSeenKey`, `readManageToken`, `writeManageToken`),
  **both the reads and the writes**. It's memory first (seeded by the
  keyring), then `localStorage`.
- **Wrap every `localStorage` call in try/catch.** Private Safari throws on
  plain access, and these reads run in `useState` initializers, where a throw
  is a blank page. A blocked store degrades a feature, never the action
  around it (publish has already succeeded by the time the token is written).

## Share loop (adr-013)

`GuestCta.tsx` links back to `/create?ref=guest`. `useReferralSource` reads
the parameter once at mount and strips it via the router. `useViewBeacon`
fires once the invitation is **ready** (a dead link is not a view), guarded by
`inv-viewed:<id>`, which is written *before* the request so a re-run effect
can't double-count. `useEnvelope` reads the same flag to decide a first open
(FR-4.8), **once at mount and never again**: the beacon writes it as soon as the
invitation is ready, so a re-read would close the envelope during the open it
exists for.

## SEO, prerendering, gallery (adr-016, adr-017)

- `?lang=en` is the English landing page's only address. It wins over
  `inv-ui-lang` and writes it; the landing toggle moves the URL with
  `navigate(..., { replace: true })`.
- `src/seo.ts` re-applies title, description, robots, canonical and
  `<html lang>` after navigation, and **leaves `og:*` alone** (no unfurler
  runs JS).
- Landing and gallery copy is **prerendered into the shell at build time**,
  one block per page × language (`src/prerender.ts` via the
  `inv-prerender-landing` Vite plugin; build-time only, never import it from
  client code). It is not hydration: `createRoot` discards it,
  which keeps `react-dom/server` out of the bundle. The landing CTAs are real
  `<a href="/create">` links for crawlers (`a.lp-cta` exists for them).
- `public/` holds committed brand assets (favicon, icons, share cards,
  manifest).
- **Gallery**: content in `src/gallery/` (`content.uk.ts`, `content.en.ts`,
  shared `designs.ts`). Each example is a **full `Invitation`** with **no
  date, time, venue or city**, so it can never age into the past-date gate.
  It's a full `Invitation` because the editor regenerates fields from
  `invitation.brief`. Cards are `InvitationPreview` unchanged: hub thumbnails use
  `transform: scale()`, not a new prop. `gallery.test.ts` holds the rules
  (same ids in both languages, a distinct palette per example, no Cyrillic in
  `.en`, nothing dated).
- **Seeding**: "use this one" is `<a href="/create?sample=<id>">` (a full page
  load). `useGallerySample` mirrors `useReferralSource`. It reuses
  `useInvitationEditor`'s `restored` path, and a parked sign-in draft wins over
  `?sample=`. The date check lives in `noteDateState` (not `send()`) so a
  sample's null date still gets the nudge, and `description` is seeded from
  the example's sentence so the next chat turn doesn't replace the chosen
  invitation.

## i18n

Every user-visible string is in an `src/i18n.ts` table, **including demo
content** (`LANDING.sample`, the hero's one invitation, and
`LANDING.rsvpNames` keyed by `DemoGuest`; the sample's design tokens stay in
`SAMPLE_DESIGN` in `LandingPage.tsx`). The hero's `heroSentence` is held to
44 characters, the `46ch` its typing animates to. FR-6.3's "never
translated" is about a host's invitation on the guest page, not mockups.
`test/i18n.test.ts` fails on Cyrillic under `.en` and on any shape difference
between the languages. There's no reverse check: Viber, Telegram, Google, RSVP,
CSV and `INVINTO` belong in the Ukrainian tables.

## Card rendering

The model only picks tokens. `InvitationPreview.tsx` maps them 1:1 to
`.palette-*`/`.type-*`/`.layout-*`/`.ornament-*` classes and never interprets
model output as markup or styles. A background (adr-009) is composited under
the copy with a palette-tinted scrim (`--bg-rgb`, spec from the DS
`templates/card-background`); `split` confines it to a
side panel and `minimal` rejects backgrounds.

## Material system (adr-018, `src/styles.css`)

`styles.css` is organised in one section per component and keeps compact
one-line token rules (Biome's CSS formatting is off) so they stay scannable
against the OG renderer's maps. Because sections follow components, a
contextual override often comes before its base rule: descending specificity
is deliberate. The file opens with a `:root` token block (ground, glass, ink, accent,
radius, elevation, motion), the single source of colour for converted
sections. **`CONVERTED` in `test/styles.test.ts` is the ratchet**: it lists
the converted sections, and each conversion adds one. Unconverted sections
still have hex values and a `/* Title ---- */` banner each. Two converted
sections keep hex on purpose and the test allowlists them: `Creation chat`'s
`.cc-sk` shimmer (it needs a stop lighter than both ends) and the
`Material system` banner, which defines the tokens. The account sheets are
built on the sign-in gate's `.ag-*` shell, so they convert with it.

- **The unit is a section, not a surface.** A section runs from its banner to
  the next one, so a rule added after the last banner silently joins it. A
  section can also reach past its name (`Share panel` covers the account
  sheets but not the manage dashboard's `.hm-share-row`), so expect a
  conversion to move neighbours.
- Collapse a literal onto an existing token only when the two **do the same
  job**, not merely when they measure alike. Colour distance is the check, not
  the rule (`--caution-*` stays distinct from `--wash`/`--surface` on
  purpose).
- The ratchet only scans `styles.css` for hex. An accent written as `rgba(…)`
  must use `--ui-accent-rgb` (pinned to `--ui-accent` by a test), and icons
  stroke `currentColor` rather than a hex in the component.
- **`.palette-*` shadows `--ink`, `--accent`, `--wash` and `--edge`** on
  whatever element carries it (the card, and each design-sheet swatch). There,
  read the product's colours through `--ui-ink`/`--ui-accent` (tested).
- `--ink-placeholder` and `--ink-whisper` are **never for text anyone must
  read** (a test keeps them below `--ink-faint`: whisper < placeholder <
  faint). Body text uses `--ink-muted`, labels and
  timestamps `--ink-faint`; `textFloors` in `styles.test.ts` holds each
  selector to its floor, and a new reader of the faint tiers fails a test.
- **Chrome faces are tokens** (adr-019 §2): `--ui-font-display` (Literata) and
  `--ui-font-body` (Golos Text). A rule that reads the display face sets
  `font-weight` 400 or 500, which is all Literata is requested at (tested);
  never name a face in a rule.
- `.palette-*`/`.type-*`/`.layout-*`/`.ornament-*` are permanently exempt:
  their raw hex is what keeps the OG renderer's hand mirror visible.
- Glass is `.glass` and `.glass-solid` (the one that carries text). Since
  adr-019 both are **opaque paper** (`--surface`, no blur) and keep their
  names until its rename step. **No paper material (`.grain`, `.deckle`,
  `.seal`) may sit on `.inv` or inside it**; wrapping the card is fine
  (tested).
- The editor sets the card on `--table` with `.grain`, whatever its palette
  (adr-019 §4.2). `.grain` sets only `background-image`, so whatever carries
  it gives the colour with `background-color`, never the `background`
  shorthand, which would wipe the grain. `data-palette` stays on `.cc-shell`
  as an unused hook (an attribute, not the `palette-*` class, which would push
  the card's ink into the chrome). The landing carries `.grain` on `.landing`
  and on its hero's `.lp-stage` too, and the dashboard on `.hm-page`.
- **The landing's motion lives in one block**: every `animation` in the
  `Landing page` section sits inside its single
  `@media (prefers-reduced-motion: no-preference)`, so reduced motion gets the
  finished hero without detection (tested). The rise moves only `transform`
  and `opacity`, the typing only `max-width`.

## Design projects

"DS" means **E-invitation DS** only: the design system (`InvitationPreview`,
this stylesheet's tokens, the `card-background`/`lang-switcher` specs) and the
only `/design-sync` target (`.design-sync/config.json`). Product screens live
in the separate **E-invitation design** project; cite its boards as
``design project `Name` ``, never as DS. Its DS copy must be refreshed after
every DS sync (`.design-sync/NOTES.md`).
