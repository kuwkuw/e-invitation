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

## Next iteration

Not yet chosen. The backlog below is the candidate pool; nothing in it is
committed.

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
- **React Router in `web/`** — evaluated 2026-07-24, **not yet justified**.
  The SPA has four routes (`/`, `/create`, `/i/:id`, `/manage/:id`), all
  mutually exclusive top-level screens with no nesting and no shared chrome —
  which is precisely the value a router adds. There are two navigation points
  in the whole app, both deliberate full reloads between screens with unrelated
  state models (the editor's in-memory state *should* reset on the way out).
  Against that, `main.tsx`'s resolver is ~8 lines with zero dependencies,
  `web/` ships only react + react-dom, and react-router-dom is ~12–20 kB
  gzipped against the NFR-1 latency budget for a mobile-first audience. The
  path regexes also double as validation — they mirror the server's
  `InvitationId` and its path-traversal guard — where a router's `:id` param is
  permissive and would need re-validating anyway.

  Revisit when any of these becomes true (**nesting is the real trigger, not
  route count**): a screen grows sub-routes (`/manage/:id/guests`,
  `/manage/:id/settings`); a route needs query-param state synced to the URL
  (filters, sort); transitions need to preserve state instead of reloading; or
  the count passes ~6–8. Route-level code splitting is *not* a reason — Vite
  does that with dynamic imports, no router required.
