# 06 — Roadmap: next iteration

Written 2026-07-23, after the AI background layer (adr-009) and the editor
decomposition landed; updated 2026-07-24 when the manage-view and
client-routing iterations shipped, batch response counts (adr-012) were taken
as the next one, and a review of the shipped surfaces added four gaps and one
enabler to the backlog. This doc plans the **next** iteration; when an item ships it moves
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

Three iterations have shipped since:

- **"Safe to open to real hosts"** — guardrails as FR-9 /
  [adr-008](decisions/adr-008-operator-cost-guardrails.md), durable metrics as
  FR-7, guest add-to-calendar as FR-4.5, plus FR-10 /
  [adr-009](decisions/adr-009-ai-background-layer.md) for backgrounds.
- **"The host can come back"** — below.
- **Client-side routing** — [adr-011](decisions/adr-011-client-router.md),
  below. Internal: no new requirement, no user-visible feature beyond one
  behaviour fix.

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

## Shipped: client-side routing

React Router in `web/`, settled in
[ADR-011](decisions/adr-011-client-router.md) (accepted). An internal
iteration: no new requirement, and nothing user-visible except one behaviour
fix.

It was **groundwork, not a response to pressure** — the 2026-07-24 evaluation
declined a router and none of its revisit triggers had fired. Two things made
it the moment anyway: the manage view had left `useHostManage` doing raw
`history.replaceState` surgery to strip the `#t=` token, which is a router's
job done by hand; and at four routes the migration was as cheap as it would
ever be.

What landed:

1. **The route table moved** to `web/src/AppRoutes.tsx` on react-router-dom in
   declarative mode, with `main.tsx` reduced to the `BrowserRouter` entry
   point. Same four routes, same URLs.
2. **The id guard survived the regexes.** Those patterns doubled as the
   path-traversal check mirroring the server's `InvitationId`; a router's `:id`
   is permissive. `isInvitationId` now carries it, applied in the hooks that
   own the fetch rather than at the route boundary as planned — see the ADR's
   implementation notes.
3. **Three navigation points became transitions** — the editor back button, the
   landing calls to action, the invitations rows — dropping the `onStart` prop
   threaded through four buttons.
4. **The fragment token moved onto the router**, ending the split ownership of
   the history stack and, with it, a `localStorage` write and URL rewrite that
   were happening during render.
5. **A malformed id now says the link is dead** instead of rendering the
   marketing page. Not in the original plan: the parity PR preserved the old
   resolver's behaviour, correctly for a parity PR and wrongly on the merits.

Delivered as five PRs (plan, parity, transitions, not-found, fragment) plus
this docs pass. Cost: **+13.2 kB gzipped**, recorded under NFR-1.

Deliberately not done: data routers and loaders, nested layouts, route-level
code splitting. The ADR §1 keeps the declined evaluation's revisit triggers as
the conditions for widening that scope — nesting is the real one.

## Next iteration: batch response counts

Settled in [ADR-012](decisions/adr-012-batch-response-counts.md) (proposed),
to ship as **FR-5.7**, extending FR-5.6.

The returning-host list shipped as three-quarters of its mockup. The
`templates/landing-page` Returning variant gives each row a response count and
a "new since your last visit" marker; what
[YourInvitations.tsx](../web/src/components/YourInvitations.tsx) renders is a
monogram, a title and a relative publish time. adr-010's implementation notes
say why — the browser-local index holds no counts by design, and the only way
to get them was one token-authenticated request per invitation from the page
that has to be fastest — and closed with "revisit with a batch endpoint if
hosts ask."

**No host has asked.** It is being taken because it is the only backlog item
with nothing in front of it, and because closing the gap between a shipped
screen and the mockup it was built from is a better reason than adr-011's
groundwork turned out to be. Small, entirely inside the existing architecture,
no new dependency.

What makes it worth a decision record is not the endpoint but the shape:
`POST /api/invitations/counts` is the **first request in the app carrying more
than one capability token**, and the first place where a partial authorization
failure is a normal outcome rather than an error. So the ADR settles:

1. **POST, though it only reads** — a GET would put manage tokens in the query
   string, undoing the exact property adr-010 §2 chose the URL fragment for.
2. **Per-item authorization, `200` on partial success** — one stale token must
   never blank the other four rows.
3. **One counting implementation** — `summarizeRsvps` moves out of the route
   file so the row and the dashboard it links to cannot disagree.
4. **A 25-item cap**, which is also what bounds the multi-token oracle adr-010
   declined to rate-limit.
5. **The landing page never waits** — no spinner, no layout shift, failure is
   silence, and reading the list does not mark responses seen.

Four PRs (extract, endpoint, hook, rows) plus a docs pass. Out of scope: any
design work (the mockups already specify it), counts anywhere but the landing
list, and anything that would teach the server which invitations belong to one
host — that is the accounts model adr-005 rejected.

## Candidate backlog

Grouped by kind, because "wait for a host to ask" is the right answer for a
feature and the wrong one for a gap. Items in the first two groups came out of
a review of the shipped surfaces on 2026-07-24; nothing here is committed.

### Gaps in what has shipped

Things the app claims, or implies, that it does not actually do. Ranked.

- **Edit after publish.** The manage-view iteration set out to make publishing
  and coming back later two separate visits — and delivered that for
  *responses* only. The invitation itself is still session-bound:
  [usePublishing.ts](../web/src/hooks/usePublishing.ts) holds the published
  `{id, manage_token}` in `useState`, `/create` always starts blank, and
  nothing loads a published invitation back into the editor. A host who
  publishes on Monday, sends the link to forty people, and spots a wrong venue
  on Friday **cannot fix it** — the only path is publishing a new invitation,
  which mints a new id and orphans the link guests already have. That is
  verbatim the failure adr-010 §Context describes for responses, still open for
  the invitation.

  The server side is already done: `POST /api/invitations/publish` with `id` +
  `manage_token` appends a version (FR-3.2), versions are retained, and the
  token resolves three ways. The missing piece is rehydrating the editor from a
  published record instead of only from a fresh publish. Worth an ADR for the
  design questions, not the plumbing: whether editing republishes immediately
  or on an explicit action, what a guest sees mid-edit (versioning makes this
  safe), and whether adr-010 §1's read-only manage view still holds once
  "Edit" belongs somewhere.

- **The RSVP write endpoint is unguarded.** `POST /api/invitations/:id/rsvp`
  ([routes/invitations.ts](../server/src/routes/invitations.ts)) is the only
  unauthenticated write in the app and has no limit of any kind — no per-IP
  allowance, no per-record cap, and no global limiter in
  [app.ts](../server/src/app.ts). Each append rewrites the whole record file.
  adr-008's guardrails wrap the LLM endpoints only, and adr-010 kept them off
  the RSVP endpoint because it costs no LLM spend — sound for the *read* side,
  but the write side costs disk, and the share link is designed to land in a
  group chat. Small and contained: a per-IP daily allowance reusing
  `consumeIpAllowance`, or a cap per record. Needs a note extending adr-008's
  reasoning, not an ADR of its own.

- **No deletion or retention story.** Guests type names and free-text notes
  into a record with no removal path — not for the guest, not for the host,
  not on a timer. NFR-4 says "minimal data" and says nothing about how long it
  lives; the answer today is forever. Invitation deletion is the natural unit
  (it takes the RSVPs with it) and is a prerequisite for RSVP deletion below.

- **No accessibility requirement.** [03-non-functional-requirements.md](03-non-functional-requirements.md)
  has no a11y NFR at all — conspicuous for a mobile-first, bilingual,
  public-facing app whose core interaction is a form. Deliberately *not*
  written into the NFR doc yet: stating a requirement the app has not been
  audited against would make that doc dishonest. Writing it, and the audit
  behind it, is the work item.

### Enablers

- **Structured event date.** `EventBrief.date` and `.time` are free text, "as
  written by the user" ([schemas.ts](../server/src/schemas.ts)), so nothing in
  the system knows when the event is. That single fact is the ceiling on an
  "event has passed" state for the guest page, an RSVP deadline, sorting the
  landing list by event date rather than publish date, host reminders, and it
  is why the `.ics` export is best-effort prose parsing (FR-4.5). Adding
  `date_iso` alongside the free text is a schema field plus prompt work — the
  model already extracts the prose — but the timezone question has to be
  settled deliberately rather than bolted on later. Pays for several features
  rather than one; do it before something needs it urgently, not during.

### Features waiting on a trigger

- **RSVP deletion** — needs stable per-RSVP ids and a mutating token-gated
  endpoint; adr-010 §5's superseding covers the common case. Wait for a host
  to ask. (See also deletion/retention above, which is the larger question.)
- **Notify the host on a new RSVP** — the honest version needs an email
  channel (and an address, which the accounts-free model doesn't collect).
  Revisit with any account-adjacent work.
- **Per-guest edit tokens** so a guest can amend their own answer instead of
  re-submitting — real infrastructure for a rare case (adr-010 §5).
- **SQLite (or similar) store** — only when multi-instance hosting or RSVP
  volume breaks the NFR-7 single-process assumption; interfaces are ready.
- **Per-key metering/credits** — stays rejected-for-now (adr-006); revisit
  only if the free-tier + rate-limit model proves too tight for real traffic.
- ~~**React Router in `web/`**~~ — shipped; see
  [adr-011](decisions/adr-011-client-router.md), which records the original
  declining evaluation, the fact that none of its revisit triggers had fired,
  and what widening the scope past declarative mode would take.
