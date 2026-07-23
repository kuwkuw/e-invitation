# 06 — Roadmap: next iteration

Written 2026-07-23, after the AI background layer (adr-009) and the editor
decomposition landed. This doc plans the **next** iteration; when an item
ships it moves into [02-functional-requirements.md](02-functional-requirements.md) /
[03-non-functional-requirements.md](03-non-functional-requirements.md) with a
stable ID, per the docs conventions.

## Where we are

The MVP loop is complete end to end: one-sentence generate → per-field
edit/regenerate → publish (versioned snapshot, share link, OG image) → guest
RSVP → host dashboard. Free-tier-first routing (Groq/Gemini) with paid
fallbacks, BYOK for power users, operator-cost guardrails, durable metrics,
add-to-calendar, CSV export, optional AI backgrounds, single-container deploy
on a custom domain.

The previous iteration ("safe to open to real hosts") shipped in full:
guardrails as FR-9 / [adr-008](decisions/adr-008-operator-cost-guardrails.md),
durable metrics as FR-7, guest add-to-calendar as FR-4.5, plus FR-10 /
[adr-009](decisions/adr-009-ai-background-layer.md) for backgrounds.

What that leaves exposed:

1. **The host dashboard is session-bound.** The manage token is written to
   `localStorage` at publish and never read back; there is no host route in
   `main.tsx`. Close the tab and the RSVP list is unreachable — the only way
   back is re-publishing, which mints a new share link and orphans the one
   guests already have. Checking responses is a come-back-later action, so
   this is the feature not working, not a rough edge.
2. **The headcount can be wrong.** RSVPs are append-only by design (FR-4.4),
   but the counts sum every attending row, so a guest who answers no→yes is
   counted twice — in the one number the host caters on.
3. **Response fetch failures are invisible.** `refreshRsvps` has no `catch`;
   a stale-token `403` stops the spinner and says nothing. And the panel
   renders no content at all — not even the empty state — until the host
   clicks Refresh.

## Iteration theme: the host can come back

Goal: publishing an invitation and checking its responses are two separate
visits, days apart, possibly on two different devices — and both work.

Settled in [ADR-010](decisions/adr-010-host-manage-link.md) (proposed → accept
before implementation).

### 1. `/manage/:id` — the durable response dashboard (blocker)

A read-only host screen composed from two endpoints that already exist: the
public `GET /api/invitations/:id` for the event, the token-gated
`GET /api/invitations/:id/rsvps` for the responses. No new host-facing server
route.

- Token resolution in order: `#t=<token>` fragment → `localStorage`
  (`inv-manage:<id>`, the key publish already writes) → an empty state with a
  paste-your-link field. A fragment token is persisted and then stripped from
  the URL with `history.replaceState`.
- Fragment, never query string — the credential stays out of server logs and
  referrer headers (adr-010 §2).
- Route added to `main.tsx` beside `/i/:id`, same strict id regex.

Acceptance: publish, close the tab, open the manage link on another device →
the response list loads. Clearing site data without the link → the empty
state, not a crash.

### 2. Manage link + "your invitations" index

- The share panel gains a **second, explicitly-labelled** copy action for the
  manage link, visually subordinate to the share link, with a one-line "keep
  this private" warning (adr-010 §3).
- Publish also maintains a browser-local `inv-invitations` index
  (`{ id, title, published_at }`) so the landing page can show "Your
  invitations" with recognizable titles instead of opaque ids (adr-010 §4).

Acceptance: after publishing twice from one browser, `/` lists both by title
and each row opens its manage view.

### 3. Correct counts + honest failures

- `GET /api/invitations/:id/rsvps` groups entries by normalized name, flags
  earlier ones `superseded: true`, and computes `counts` over the
  non-superseded set (adr-010 §5). The full list stays in the response; CSV
  keeps every row and gains a column. Schema change → `web/src/types.ts`
  mirrors it in the same PR (NFR-8).
- Fetch on mount and on `visibilitychange → visible`; "N new since your last
  visit" from a local last-seen timestamp (adr-010 §6). No polling.
- `403` / `404` / network failures get real messages in both the manage view
  and the in-editor panel; the panel renders its empty state without needing
  a manual refresh first (adr-010 §7).

Acceptance: one guest answering no then yes yields yes=1, no=0, and one
superseded row; a tampered token shows the invalid-link message instead of a
silent stall.

### 0. Design first: three DS templates (adr-010 §9) — ✅ done

The host dashboard was the only screen in the app with no `templates/*` mockup
in the E-invitation DS project — every other host/guest surface got one before
it got code, and adr-009 §4 settled the scrim spec that way. Now landed in the
E-invitation DS project:

- `templates/host-manage` (HostMain/HostStates/HostSpec) — five states,
  mobile-primary, with the superseded-row and "N new" treatments.
- `templates/share-panel` (ShareMain/ShareStates/ShareSpec) — the manage-link
  action's visual subordination (adr-010 §3), plus an anti-pattern card.
- `templates/landing-page` returning-host variant (…Returning).

Settled tokens `--rsvp-yes: #3d6b47` / `--rsvp-no: #a83f3f` (both AA on white)
and the visual treatments are recorded in adr-010 §9 for implementation.

The `.design-sync` **component** pipeline needs nothing — no token, copy-field,
or `InvitationPreview` prop changes, so `dtsPropsFor`/`conventions.md` stay as
they are and no re-sync runs (NOTES.md re-sync triggers don't fire).

### Sequencing

0 comes first and unblocks all the UI work. 1 is the blocker and carries the
route + token plumbing. 3's server half (counts) is independent of the design
entirely and can land first as a small PR; 3's UI half wants 0 and 1 in place.
2 is the smallest and can ride with either. Nothing here touches the pipeline,
the routing table, the invitation schema, or the store.

### Implementation plan (PR breakdown)

The plan of record. The three iteration items above (1/2/3) decompose into
these discrete PRs — **one PR per task**, merged in dependency order. This
supersedes the prose sequencing above at finer grain.

**Base branch.** This work builds on `refactor/decompose-web-screens`, **not
`main`** — the decomposed hooks (`web/src/hooks/`) and editor components
(`web/src/components/editor/SharePanel.tsx`) that tasks C–F edit exist only on
that branch; `main` does not have them yet. So the feature branch bases on the
decompose tip and its PRs target that branch (or `main` once the decompose PR
merges). The committed `styles.css` on the decompose branch is identical to
`main`, so nothing else is entangled.

| # | PR | Depends on | Maps to | Notes |
|---|----|-----------|--------|------|
| A | Base branch + land docs and `--rsvp-*` tokens | — | §9 | bookkeeping; docs + token commits |
| B | Server: dedupe-aware RSVP summary | A | item 3 (server) | design-free; superseded flag + collapsed counts; `schemas.ts` + `types.ts` same PR; tests in `publish.test.ts` |
| C | Web: `/manage/:id` route + token plumbing | B | item 1 | fragment→localStorage→paste; strip fragment; 403/404/network states; no UI yet |
| D | Web: host-manage dashboard UI | C | item 1 + 3 (UI) | HostMain/HostStates mockups; headcount, pills, superseded rows, "N new", auto-fetch on mount + `visibilitychange` |
| E | Web: share-panel rebuild | C | item 2 (link) | ShareMain/ShareStates; public dominant / manage subordinate+masked+warned; `#t=` link; folds in the in-editor panel fixes |
| F | Web: landing "your invitations" list | A | item 2 (index) | `inv-invitations` index on publish; returning-host landing variant |
| G | Docs: flip to shipped | D, E, F | — | FR-5.4/5.5, adr-010 → accepted, roadmap items → shipped |

Critical path **A → B → C → D**. F needs only A (independent of server/UI); E
needs C but not D. B fixes a correctness bug (double-counted re-submissions)
that is live today, so it is the best standalone first PR after the branch.

**Progress:** the `--rsvp-yes`/`--rsvp-no` tokens (task A's token half) are
already applied to `styles.css` and verified live; task A's remaining piece is
committing docs + tokens onto the feature branch. Everything else is pending.

## Deliberately not this iteration (candidate backlog)

- **RSVP deletion** — needs stable per-RSVP ids and a mutating token-gated
  endpoint; adr-010 §5's superseding covers the common case. Wait for a host
  to ask.
- **Notify the host on a new RSVP** — the honest version needs an email
  channel (and an address, which the accounts-free model doesn't collect).
  Revisit with any account-adjacent work.
- **Per-guest edit tokens** so a guest can amend their own answer instead of
  re-submitting — real infrastructure for a rare case (adr-010 §5).
- **SQLite (or similar) store** — only when multi-instance hosting or RSVP
  volume breaks the NFR-7 single-process assumption; interfaces are ready.
- **Per-key metering/credits** — stays rejected-for-now (adr-006); revisit
  only if the free-tier + rate-limit model proves too tight for real traffic.
