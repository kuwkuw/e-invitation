# ADR-012 — Batch response counts for the returning-host list

**Status:** proposed · **Date:** 2026-07 · Completes
[adr-010](adr-010-host-manage-link.md) §4 (the "your invitations" index) and
its implementation note; extends FR-5.6 as **FR-5.7**. Token handling follows
[adr-005](adr-005-capability-tokens.md).

## Context

The returning-host list shipped as three-quarters of its mockup.
`templates/landing-page` (Returning variant) shows each row carrying a
response count and a "new since your last visit" marker. What
[YourInvitations.tsx](../../web/src/components/YourInvitations.tsx) actually
renders is a monogram, a title, and a relative publish time — no numbers.

That was a deliberate omission, recorded in adr-010's implementation notes: the
browser-local index (`{id, title, published_at, palette}`) holds no counts by
design, and the only way to get them was one token-authenticated request per
invitation, fired from an otherwise static marketing page. Up to 20 requests
(`hostInvitations.ts` `LIMIT`) to render decoration on the page that has to be
fastest. The note ended "revisit with a batch endpoint if hosts ask."

Nobody asked. This is being taken anyway, and the honest reason is that it is
the only backlog item with nothing in front of it — RSVP deletion wants a host
to ask first (adr-010 §8), host notification wants an email channel and an
address the accounts-free model never collects, per-guest edit tokens are real
infrastructure for a rare case (adr-010 §5). It is also small, and it closes a
gap between a shipped screen and the mockup it was built from, which is a
better reason than "a router would be groundwork" (adr-011) turned out to be.

The thing that makes it worth an ADR rather than a quiet PR is not the endpoint.
It is that **this is the first endpoint that accepts more than one capability
token in a single request**, and the first place where a partial authorization
failure is a normal outcome rather than an error.

## Decision

### 1. One endpoint, `POST /api/invitations/counts`

Body: `{ items: [{ id, token, seen_at? }, ...] }`. Response: one result per
requested id, counts included where the token checked out.

**POST, though it reads nothing and mutates nothing.** A GET would have to
carry the tokens in the query string, and adr-010 §2 put the manage token in
the URL *fragment* precisely so it stays out of access logs, referrer headers
and proxy traces. Undoing that for a decorative count would be absurd. A
request body is the only place a batch of credentials can ride, so the endpoint
is a POST that happens to be a lookup. That is a known REST wart and it is the
right trade here; the alternative is worse in the one dimension (credential
leakage) that adr-005 spends its whole risk budget on.

`Cache-Control: no-store` on the response — this is per-host data keyed by
secrets, and nothing between the browser and the process should retain it.

### 2. Per-item authorization; partial success is a normal 200

Each `{id, token}` pair authorizes exactly its own id, through the same
constant-time `tokenMatches` the single-invitation endpoint uses. There is no
"the batch is authorized" state, because there is no such thing as a host —
there are only bearers of individual tokens (adr-005).

The response is therefore a per-item result, and the batch returns `200` even
when every item fails:

```jsonc
{ "results": [
  { "id": "abc123", "status": "ok", "counts": { "yes": 4, "no": 1, "guests": 7 },
    "new_since": 2 },
  { "id": "def456", "status": "forbidden" },   // token refused
  { "id": "ghi789", "status": "not_found" }    // no such record
] }
```

The whole-batch status codes stay for whole-batch failures only: `400` for a
malformed body or an over-cap batch (§5). One stale token must never blank the
other four rows — that is the failure mode a batch endpoint exists to avoid,
and it is why `status` is per item rather than a top-level error.

Item results carry **no error prose**, only a status the client maps to
wording, mirroring how the 502 body carries `causes` as classes and keeps raw
messages in logs.

### 3. Counts come from `summarizeRsvps`, not a second implementation

`summarizeRsvps` is currently a module-private function in
[routes/invitations.ts](../../server/src/routes/invitations.ts). It moves to
its own module and both endpoints call it.

This is not tidying. adr-010's implementation notes already flag that the
grouping key for "the same guest" is duplicated between server and client and
has to be kept in sync by hand; a third copy, computing a *different* number
for the same invitation, is how the landing page ends up saying 6 and the
dashboard says 5. The row and the dashboard it links to must agree, so they
must share the code that decides.

The batch returns only the `counts` object — never `rsvps`. Guest names have no
business on the landing page, and a batch of full RSVP lists would be a
meaningfully larger disclosure from a single request than the per-invitation
endpoint makes.

### 4. "New since last visit" is computed server-side from a client baseline

The optional per-item `seen_at` is the browser's existing
`inv-manage-seen:<id>` marker (written by `useHostManage`). The server counts
live answers newer than it and returns `new_since`.

The alternative — return the newest live `created_at` and let the client
compare — leaks less nothing and needs no baseline in the request, but it
cannot produce a *number*, only a dot. The mockup wants a number, the server
already has the live/superseded split that makes the number correct, and the
baseline is a timestamp the browser is sending back to the server that wrote
the data it came from. Sending it is not a disclosure.

Rules match the dashboard exactly: superseded answers never count as new (a
guest amending an answer is news, their replaced original is not), and a
**missing `seen_at` yields `0`, not "everything"** — on a first visit
"everything is new" tells a host nothing. `/manage/:id` moves the marker
forward on visit; the landing page must **not**, or opening the list would mark
responses seen that the host never looked at.

### 5. Cap the batch at 25 items

`hostInvitations.ts` keeps at most 20, so 25 is the local cap plus headroom.
Over-cap is a `400`, not a silent truncation — a truncated batch would show a
host some of their events with counts and some without, for no visible reason.

The cap is also what keeps this from being a bulk oracle. adr-010 argued that
brute-forcing 128 bits over HTTP is not worth a rate limiter; batching
multiplies attempts per request by 25, which against 2^128 changes nothing —
but it is the reason the multiplier is bounded and stated rather than left to
whatever a client sends. The adr-008 guardrails stay off this endpoint for the
same reason they are off the RSVP list: no LLM spend, no operator cost.

Duplicate ids in one batch are answered once per occurrence, positionally. Not
worth de-duplicating; not worth rejecting either.

### 6. The landing page never waits for it

The list renders from `localStorage` as it does today, synchronously. Counts
arrive afterwards and fill in. Specifically:

- **No spinner over the list, and no layout shift.** The count slot is sized
  from the start, empty until it isn't. The landing page's job is the pitch and
  the Create button; adr-010 §4 already insisted this block stay quieter than
  both.
- **Failure is silence.** Network error, `400`, server down — rows render
  exactly as they do today. A returning host must never be told their
  invitations are broken because a decorative fetch failed.
- **Only rows with a token are asked about.** An index entry whose
  `inv-manage:<id>` key is gone (cleared storage, an entry that outlived its
  token) is simply not in the request, and renders without a count. It still
  links to `/manage/:id`, which has the paste-your-link recovery.
- **One request, all rows.** `VISIBLE = 3` caps what is *shown*, not what is
  fetched — expanding the list must not fire a second round trip to fill in
  rows the browser already had tokens for.

### 7. No new state ownership

The fetch lives in a hook (`useHostInvitationCounts`), like every other piece
of state in `web/src/hooks/` — the landing page stays composition only, per
CLAUDE.md, and the hook is what the tests drive. `hostInvitations.ts` keeps
holding no secrets: the hook reads the tokens from their own keys at request
time and never writes them into the index.

## Consequences

- **`server/src/schemas.ts` gains the request and response shapes, and
  `web/src/types.ts` mirrors them by hand in the same PR** (NFR-8). The
  existing `RsvpSummary` is unchanged — the batch reuses its `counts` shape
  rather than defining a second one.
- **A new route table entry in `docs/02-functional-requirements.md`** and
  FR-5.7. `04-architecture.md` gains the endpoint; CLAUDE.md's "Not yet built"
  line drops the batch-endpoint item.
- **`summarizeRsvps` moving out of the route file** is the one change that
  touches shipped behaviour, so it lands as its own PR with the existing tests
  green and no other change riding along.
- **First multi-credential request in the app.** If a third caller ever wants
  the same shape, the per-item-status convention here is the precedent to
  follow rather than reinvent.
- **No store change.** Counts are computed from `record.rsvps` on read, like
  the dashboard's; the NFR-7 single-process file store carries this unchanged.
  N record reads per batch is N small `readFileSync` calls in one request
  instead of N HTTP requests — the point of the exercise.
- **Payload cost is negligible** and no dependency is added, so unlike adr-011
  there is nothing to record under NFR-1.

### Deliberately not in scope

- **No design pass.** adr-010 §9's `templates/landing-page` Returning mockups
  already specify the count and "new" treatments; this iteration implements
  what was already designed. The `.design-sync` component pipeline stays
  untouched, as it did for adr-010.
- **No counts anywhere else.** Not on the editor, not in the share panel.
- **No polling or freshness machinery on the landing page.** The dashboard's
  `visibilitychange` refetch (adr-010 §6) is for a page a host sits and
  watches. This is a page they pass through.
- **Not a general "list my invitations" API.** The server still has no idea
  which invitations belong to one host, and this endpoint does not teach it —
  the client supplies the ids from its own index every time. Making the server
  able to answer "whose is this?" is the accounts model adr-005 rejected.

## Implementation plan

Four PRs, each independently mergeable, in order:

1. **Extract `summarizeRsvps`** into its own server module, called by the
   existing RSVP route. No behaviour change; existing tests must pass
   untouched. Establishes the shared-counting property §3 depends on before
   there is a second caller.
2. **The endpoint.** Schemas both sides, `POST /api/invitations/counts`,
   per-item statuses, the §5 cap, `no-store`. Server tests: mixed batch (ok /
   forbidden / not_found in one response), over-cap `400`, malformed body,
   `new_since` with and without `seen_at`, superseded answers excluded from
   both `counts` and `new_since`, and counts identical to what
   `/api/invitations/:id/rsvps` reports for the same record.
3. **The hook.** `useHostInvitationCounts` — gathers ids that have tokens,
   one request, per-item results keyed by id, failure yields an empty map.
   Tests drive the hook directly (RTL, `afterEach(cleanup)` — `globals: false`
   means no auto-cleanup).
4. **The rows.** Count and "new" marker in `YourInvitations`, per the DS
   mockup; i18n strings for both languages (NFR-5); a test that rows render
   fully before counts arrive and do not shift when they do.

A fifth docs PR records the iteration as shipped, moves FR-5.7 into
`02-functional-requirements.md`, and flips this ADR to accepted — the pattern
the last three iterations used.
