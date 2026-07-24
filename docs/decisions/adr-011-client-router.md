# ADR-011 — Client-side routing with React Router

**Status:** proposed · **Date:** 2026-07 · Supersedes the "React Router in
`web/`" evaluation recorded in [06-roadmap.md](../06-roadmap.md); touches
FR-3.3 and FR-5.4, adds no requirement of its own.

## Context

`web/src/main.tsx` resolves routes in about eight lines: read
`window.location.pathname`, match two regexes, return one of four screens
(`/`, `/create`, `/i/:id`, `/manage/:id`). It has no dependencies and it works.

That arrangement was evaluated on 2026-07-24, immediately after the manage view
shipped, and a router was **declined** — four flat, mutually exclusive
top-level screens with no nesting and no shared chrome get little from one. The
evaluation recorded four triggers to revisit: a screen growing sub-routes,
query-param state synced to the URL, transitions needing to preserve state, or
the route count passing ~6–8.

**None of those triggers has fired.** This ADR adopts a router ahead of them,
as deliberate groundwork rather than in response to pressure — that is the
honest framing, and the reason this is a separate decision record instead of a
quiet dependency bump.

Two things do argue for doing it now rather than later:

- **The manage view left hand-rolled history surgery in a hook.**
  `adoptTokenFromFragment` ([useHostManage.ts:31-38](../../web/src/hooks/useHostManage.ts:31))
  reads `window.location.hash`, then calls `history.replaceState` directly to
  strip the credential from the address bar. That is the router's job, done by
  hand, in a file that is otherwise about fetching responses. It is also the
  piece most likely to break subtly if a router is added *around* it later,
  because two things would then own the history stack.
- **The migration is cheapest at four routes.** Ten call sites today; every
  route added before the trigger fires makes it more.

## Decision

### 1. `react-router-dom` v7, declarative mode only

`BrowserRouter` + `Routes`/`Route` — the same shape as v6, which is what the
codebase would have adopted had this been decided earlier. Explicitly **not**
adopted: data routers (`createBrowserRouter`, loaders, actions), nested
layouts, and route-level code splitting. Loaders would duplicate the hooks in
`web/src/hooks/`, which are where the tests drive this app and where CLAUDE.md
says state belongs. Code splitting is a Vite dynamic-import concern and needs
no router.

The declined evaluation's revisit triggers survive here, as the conditions
under which this scope should widen (**nesting is the real one, not route
count**): a screen grows sub-routes (`/manage/:id/guests`,
`/manage/:id/settings`); a route needs query-param state synced to the URL
(filters, sort); transitions need to preserve state instead of remounting; or
the route count passes ~6–8. Until one of those holds, declarative mode is the
whole of it.

### 2. The route table is a parity translation, not a redesign

Four routes in, four routes out, same components, same URLs. No route is
added, removed, renamed, or nested by this work. A migration that also changes
behaviour cannot be reviewed as a migration.

### 3. Id validation stays explicit

The strict `[A-Za-z0-9_-]{6,32}` regexes in `main.tsx` are not just routing —
they mirror the server's `InvitationId` shape and double as a path-traversal
guard. A router's `:id` param is permissive by design, so **removing the regex
must not remove the check**: it moves into a shared validator applied at the
route boundary, and a malformed id renders the not-found path rather than
reaching `fetchInvitation`. This is the single highest-risk part of the change
and gets its own tests.

### 4. Navigation becomes real transitions

The three navigation points stop being full page loads:

| Where | Today | After |
| --- | --- | --- |
| [App.tsx:43](../../web/src/App.tsx:43) editor back button | `location.href = "/"` | `useNavigate()` |
| [main.tsx:23](../../web/src/main.tsx:23) landing CTA | `location.href = "/create"` | `useNavigate()` inside `LandingPage` |
| [YourInvitations.tsx:48](../../web/src/components/YourInvitations.tsx:48) | `<a href>` | `<Link>` |

The landing CTA change drops the `onStart` prop threaded through four buttons
in `LandingPage`, which is the one structural simplification here.

Note the editor's in-memory state *should* reset when the host leaves — that
was cited in the original evaluation as a reason a reload is fine, and it stays
true. Losing the reload does not resurrect that state (a fresh `App` mounts on
return), but the change is now explicit rather than incidental, so it is worth
a test.

### 5. The fragment token moves onto the router's history

`useHostManage` stops calling `history.replaceState` and stops reading
`window.location.hash`. It takes the hash from `useLocation()` and strips it
with `navigate(pathname, { replace: true })`, so exactly one thing owns the
history stack. Behaviour is unchanged and adr-010 §2 still holds: fragment,
never query string.

### 6. The server does not change

`app.ts`'s `setNotFoundHandler` already serves the SPA shell for unknown paths
([app.ts:64-72](../../server/src/app.ts:64)), so deep links and reloads work on
any client route — that is why `/manage/:id` worked on day one. `/i/:id` keeps
its separate OG-meta shell in `og.ts`: crawlers do full loads, so client-side
routing never handles that request.

## Consequences

- **One runtime dependency** in a workspace that has shipped with react +
  react-dom only. The declined evaluation cited ~12–20 kB gzipped; the
  implementation should measure the actual delta rather than inherit that
  estimate, and NFR-1's budget is the check.
- **Tests need a router context.** Components using `Link`/`useNavigate` must
  render inside a `MemoryRouter`, and `useHostManage.test.ts` currently drives
  `window.location.hash` directly — it moves to `MemoryRouter` entries.
- **The four-state token resolution (adr-010 §7) must survive intact.** No
  token, refused token, unknown invitation and network failure stay four
  distinct screens; this change touches how the token is *read*, never what
  happens when it fails.
- **Reversible.** Nothing here changes URLs, the server, the schema, or the
  store. If the dependency proves unwelcome, the resolver it replaces is eight
  lines of git history.
- The roadmap's "React Router — not yet justified" backlog entry is retired by
  this ADR. Its revisit triggers remain useful reading for *why* the router
  stays in declarative mode (§1): nesting is what would justify more.
