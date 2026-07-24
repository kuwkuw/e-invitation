# 06 — Roadmap: next iteration

Written 2026-07-23, after the AI background layer (adr-009) and the editor
decomposition landed; updated 2026-07-24 when the manage-view iteration
shipped. This doc plans the **next** iteration; when an item ships it moves
into [02-functional-requirements.md](02-functional-requirements.md) /
[03-non-functional-requirements.md](03-non-functional-requirements.md) with a
stable ID, per the docs conventions.

## Where we are

The MVP loop is complete end to end: one-sentence generate → per-field
edit/regenerate → publish (versioned snapshot, share link, OG image) → guest
RSVP → host dashboard. Free-tier-first routing (Groq/Gemini) with paid
fallbacks, BYOK for power users, operator-cost guardrails, durable metrics,
add-to-calendar, CSV export, optional AI backgrounds, single-container deploy
on a custom domain.

Two iterations have shipped since:

- **"Safe to open to real hosts"** — guardrails as FR-9 /
  [adr-008](decisions/adr-008-operator-cost-guardrails.md), durable metrics as
  FR-7, guest add-to-calendar as FR-4.5, plus FR-10 /
  [adr-009](decisions/adr-009-ai-background-layer.md) for backgrounds.
- **"The host can come back"** — below.

## Shipped: the host can come back

Goal was that publishing an invitation and checking its responses are two
separate visits, days apart, possibly on two different devices — and both
work. Settled in [ADR-010](decisions/adr-010-host-manage-link.md) (accepted)
and shipped as **FR-5.4–5.6**, refining FR-3.3 and FR-4.4.

What it fixed, against the three exposures that motivated it:

1. **The host dashboard was session-bound.** The manage token was written to
   `localStorage` at publish and never read back, and there was no host route
   at all — closing the tab made responses unreachable except by re-publishing,
   which orphaned the share link guests already had. Now `/manage/:id` resolves
   the token from the URL fragment, storage, or a pasted manage link (FR-5.4).
2. **The headcount could be wrong.** Counts summed every attending row, so a
   guest who answered no→yes was counted twice in the one number a host caters
   on. Re-submissions now collapse per guest at read time, with the replaced
   answer kept as history (FR-5.5).
3. **Response failures were invisible.** A stale-token `403` stopped the
   spinner and said nothing. Missing token, refused token, unknown invitation
   and network failure are now four distinct, recoverable states (FR-5.4).

Delivered as seven PRs — planning + status tokens, server counts, route and
token plumbing, the dashboard UI, the share-panel hierarchy, the landing
"your invitations" list, and this docs pass. Design preceded code: three
`templates/*` mockups in the E-invitation DS project (adr-010 §9).

Deliberately left out, with reasons in adr-010: RSVP deletion (§8), per-guest
edit tokens (§5), and the mockups' per-row response counts on the landing list
(one authenticated request per invitation on a static page — wants a batch
endpoint first).

## Next iteration: client-side routing

Adopt React Router in `web/`, settled in
[ADR-011](decisions/adr-011-client-router.md) (proposed → accept before
implementation).

This one is **groundwork, not a response to pressure** — the 2026-07-24
evaluation declined a router, and none of the revisit triggers it recorded has
fired since. Two things make now the moment anyway: the manage view left
`useHostManage` doing raw `history.replaceState` surgery to strip the `#t=`
token, which is precisely a router's job done by hand; and at four routes and
ten call sites the migration is as cheap as it will ever be.

Scope is a **parity translation**: same four routes, same URLs, same
components. What changes is who owns history — and three navigation points
(the editor back button, the landing CTA, the invitations list) become real
transitions instead of full reloads, which drops the `onStart` prop threaded
through four buttons in `LandingPage`.

The risk worth naming: the strict id regexes in `main.tsx` are also the
path-traversal guard mirroring the server's `InvitationId`. A router's `:id`
param is permissive, so that check has to move rather than vanish (adr-011 §3).

No server, schema, store, or DS work — nothing here needs a `templates/*`
mockup, and the `.design-sync` pipeline stays untouched.

### Implementation plan (PR breakdown)

One PR per task, merged in order, each against `main` — **not stacked on each
other** (the last iteration's stack tail sat unlanded because three PRs
targeted their predecessor instead of `main`).

| # | PR | Depends on | Maps to | Notes |
|---|----|-----------|--------|------|
| A | Adopt the router at parity | — | adr-011 §1–3 | dependency, `main.tsx` route table, id validator at the route boundary, `MemoryRouter` test wrapper; **no behaviour change** |
| B | Real transitions | A | adr-011 §4 | editor back button, landing CTA (`onStart` prop dropped), `YourInvitations` → `<Link>` |
| C | Fragment token onto router history | A | adr-011 §5 | `useHostManage` drops `replaceState`/`location.hash` for `useLocation` + `navigate(replace)`; the four token states must stay intact |
| D | Docs: flip to shipped | A, B, C | — | adr-011 → accepted, roadmap → shipped, measured bundle delta recorded against NFR-1 |

A is the whole risk surface (§3) and everything else waits on it. B and C are
independent of each other and can land in either order.

Acceptance: all four routes reachable by deep link and by reload; a malformed
id renders not-found rather than reaching `fetchInvitation`; a manage link with
`#t=` still lands, persists, and strips the fragment; the editor's in-memory
state still resets when the host leaves.

## Candidate backlog

- **RSVP deletion** — needs stable per-RSVP ids and a mutating token-gated
  endpoint; adr-010 §5's superseding covers the common case. Wait for a host
  to ask.
- **Notify the host on a new RSVP** — the honest version needs an email
  channel (and an address, which the accounts-free model doesn't collect).
  Revisit with any account-adjacent work.
- **Per-guest edit tokens** so a guest can amend their own answer instead of
  re-submitting — real infrastructure for a rare case (adr-010 §5).
- **Batch response counts** so the landing list can show activity per
  invitation without N authenticated requests (adr-010, implementation notes).
- **SQLite (or similar) store** — only when multi-instance hosting or RSVP
  volume breaks the NFR-7 single-process assumption; interfaces are ready.
- **Per-key metering/credits** — stays rejected-for-now (adr-006); revisit
  only if the free-tier + rate-limit model proves too tight for real traffic.
- **React Router in `web/`** — evaluated 2026-07-24 and declined, then picked
  up anyway as the iteration above; see
  [adr-011](decisions/adr-011-client-router.md), which records both the
  original reasoning and the fact that none of its revisit triggers had fired.
  Retired from the backlog.
