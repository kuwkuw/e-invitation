# 06 — Roadmap: next iteration

Written 2026-07-23, after the AI background layer (adr-009) and the editor
decomposition landed; updated 2026-07-24 when the manage-view and
client-routing iterations shipped, 2026-07-25 when batch response counts
(adr-012) shipped as FR-5.7, 2026-07-27 when share-loop instrumentation
(adr-013) was planned, 2026-07-30 when host accounts (adr-014) shipped as
FR-11, and 2026-07-31 when the share loop got the docs pass it had been owed
since its code landed and RSVP notifications (adr-015) were planned. This doc
plans the **next** iteration; when an item
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

Six iterations have shipped since:

- **"Safe to open to real hosts"** — guardrails as FR-9 /
  [adr-008](decisions/adr-008-operator-cost-guardrails.md), durable metrics as
  FR-7, guest add-to-calendar as FR-4.5, plus FR-10 /
  [adr-009](decisions/adr-009-ai-background-layer.md) for backgrounds.
- **"The host can come back"** — below.
- **Client-side routing** — [adr-011](decisions/adr-011-client-router.md),
  below. Internal: no new requirement, no user-visible feature beyond one
  behaviour fix.
- **Batch response counts** — [adr-012](decisions/adr-012-batch-response-counts.md),
  below. Shipped as FR-5.7.
- **Share-loop instrumentation** — [adr-013](decisions/adr-013-share-loop-instrumentation.md),
  below. Shipped as FR-4.7 and FR-7.3–7.5.
- **Host accounts** — [adr-014](decisions/adr-014-host-accounts.md), below.
  Shipped as FR-11.

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

## Shipped: batch response counts

Settled in [ADR-012](decisions/adr-012-batch-response-counts.md) (accepted),
shipped as **FR-5.7**, extending FR-5.6.

The returning-host list had shipped as three-quarters of its mockup. The
`templates/landing-page` Returning variant gives each row a response count and
a "new since your last visit" marker; what
[YourInvitations.tsx](../web/src/components/YourInvitations.tsx) rendered was a
monogram, a title and a relative publish time. adr-010's implementation notes
say why it was left out — the browser-local index holds no counts by design,
and the only way to get them was one token-authenticated request per invitation
from the page that has to be fastest — and closed with "revisit with a batch
endpoint if hosts ask."

**No host asked.** It was taken because it was the only backlog item with
nothing in front of it, and because closing the gap between a shipped screen and
the mockup it was built from is a better reason than adr-011's groundwork turned
out to be. Small, entirely inside the existing architecture, no new dependency.

What made it worth a decision record is not the endpoint but the shape:
`POST /api/invitations/counts` is the **first request in the app carrying more
than one capability token**, and the first place where a partial authorization
failure is a normal outcome rather than an error. What the ADR settled and the
implementation delivered:

1. **POST, though it only reads** — a GET would put manage tokens in the query
   string, undoing the exact property adr-010 §2 chose the URL fragment for.
2. **Per-item authorization, `200` on partial success** — one stale token never
   blanks the other rows; it leaves its own row a plain title/time entry.
3. **One counting implementation** — `summarizeRsvps` (and the `new_since`
   count beside it) is shared, so the row and the dashboard it links to cannot
   disagree.
4. **A 25-item cap**, which is also what bounds the multi-token oracle adr-010
   declined to rate-limit.
5. **The landing page never waits** — no spinner, no layout shift, failure is
   silence, and reading the list does not mark responses seen.

Four PRs — the `summarizeRsvps` extraction had already landed in the
RSVP-summary iteration, so the work was the endpoint, the hook
(`useHostInvitationCounts`) and the rows — plus this docs pass. The row shows
replies received with a muted zero-state and an accent "new" badge; details in
the ADR's implementation notes. Out of scope, as planned: any design work (the
mockups specify it), counts anywhere but the landing list, and anything that
would teach the server which invitations belong to one host — the accounts
model adr-005 rejected.

## Shipped: share-loop instrumentation

Settled in [ADR-013](decisions/adr-013-share-loop-instrumentation.md)
(accepted) and shipped as **FR-4.7** and **FR-7.3–7.5**. Taken because it was
the only backlog item that produced an input another decision was waiting on:
[07-monetization.md](07-monetization.md) §5.1 gates every commercial option on
**new hosts per published invitation**, and that number was not measurable at
all — the guest page had no link back to the product, and `metrics.ts` counted
nothing about `/i/:id`.

The other reason was the state of the numbers. Production had 9 generations, 4
publishes, 5 RSVPs and 0 field regenerations lifetime. Three backlog items
below are gated on a host asking; at that traffic nobody will ask, and the
regenerate-rate 01-vision calls the primary quality signal had no data to be a
signal with. Instrumenting the one loop that could bring traffic was worth more
than another feature for the hosts who aren't here yet.

What the ADR settled, and the implementation delivered:

1. **Views are counted client-side**, because `/i/:id` is server-rendered for
   messenger crawlers (FR-3.5) — instrumenting there would count unfurls, not
   guests, and would move with sharing rather than reading. A beacon the SPA
   fires after load excludes crawlers without a user-agent list to maintain.
2. **"Unique" means "unique browser"**, via an `inv-viewed:<id>` flag, not a
   server-side set of hashed IPs. The number floats high, consistently, and a
   ratio's magnitude is all §5.1 needs — NFR-4 is not worth spending on
   precision here.
3. **The referral is an enum, not an id.** `?ref=guest` becomes
   `source: "direct" | "guest"` on the generate request. Recording *which*
   invitation converted would build the host graph adr-012 and adr-005 both
   refused.
4. **The router strips `?ref`**, as adr-011 §4 made it strip `#t=`.
5. **Global counters only** — no per-invitation reach on any surface, and no
   store change.
6. **One call to action**, replacing the static `gr-brand` wordmark. Designed
   first per adr-010 §9 — `templates/guest-rsvp-extras/GuestCta` in the DS
   project — against the constraint `styles.css` already states in its own
   words, *"INVITO stays a whisper"*: the wordmark keeps its exact current
   values and gains one underlined line beneath it, in the same muted grey as
   "change answer". Four louder treatments were drawn and rejected, three
   against rules already written down.

Four PRs — the beacon endpoint, the client beacon, the call to action, and
attribution — plus this docs pass. Explicitly out of scope, as planned:
per-invitation view counts, a click counter, cookies or third-party analytics,
and any pricing surface; 07-monetization stays an investigation until the
number says something.

**The docs pass came an iteration late.** The four code PRs landed, host
accounts was taken next and shipped in full, and only then did FR-4.7 and
FR-7.3–7.5 get written — so for one iteration the app collected a number that
no requirement described. Recorded here rather than quietly fixed, because the
convention at the top of this file is the thing that slipped, and this is the
first time it has.

That gap had a consequence worth noting: adr-014 put a sign-in in front of
publishing, and both of adr-013's derived rates divide by publishes. The
baseline adr-014 §7 froze is what keeps `new_hosts_per_publish` readable across
that boundary — but §5.1's 0.3/0.7 thresholds were written against an ungated
denominator, so it is the post-gate block that they apply to.

The ADR also committed in advance to taking the answer: under ~0.3 new hosts
per published invitation, §5.1's honest conclusion is that this stays a
non-commercial project. Nothing about that commitment changed by shipping it.
The number now needs traffic, which is the one thing this iteration cannot
supply.

## Shipped: host accounts

Settled in [ADR-014](decisions/adr-014-host-accounts.md) (accepted) and shipped
as **FR-11**. The first iteration to reverse part of
[adr-005](decisions/adr-005-capability-tokens.md), which four later ADRs
re-affirm by name.

Taken because **every remaining backlog item below converges on the same
missing primitive**: host notification needs an address the accounts-free model
never collects, a cross-device event list is the "whose is this?" question
adr-012 refused to teach the server, and the organizer tier
([07-monetization](07-monetization.md) §5.3) is the one segment §4.3 concedes
does not fit no-accounts. One primitive unblocks three items and closes
adr-005's one recorded defect — losing the manage token means losing the
invitation, with no recovery path.

What the ADR settles:

1. **An account is a keyring, not an owner.** The manage token stays the
   authority on every endpoint, unchanged; a session's only new power is to
   read back the tokens it holds. Nothing already published is ever
   invalidated.
2. **The gate is at publish** — the 07-monetization §4.2 chokepoint — not at
   `/create`. Generate, edit, regenerate and the entire guest side stay
   anonymous.
3. **Google OAuth**, server-side redirect flow, `openid email` only, no
   JavaScript SDK (NFR-1). A host without a Google account cannot publish;
   that is the gate's stated price.
4. **SQLite (`node:sqlite`) beside the file store**, not replacing it —
   invitation records stay one JSON file per id, and NFR-7's single process and
   single volume are unchanged.
5. **Auth-unconfigured is supported**: with no OAuth credentials the server
   boots and publish stays anonymous, following NFR-3's keyless-boot
   precedent.

The risk the ADR takes deliberately: adr-005 argued that signup before
demonstrated value kills the funnel, and §2 puts one at the most expensive
point. Hence **PR 0 is a metrics baseline** — publish-rate and adr-013's
`new_hosts_per_publish` both move for reasons unrelated to what they measure
once publishes are gated, and §5.1's 0.3/0.7 thresholds were written against an
ungated denominator. The ADR carries revisit triggers, including the fallback
(an optional post-publish claim) that needs no new infrastructure.

Seven PRs plus a docs pass. Explicitly not in scope: the RSVP email
notification itself (needs a transactional sender — its own iteration), any
entitlement schema or pricing surface, and a second identity provider.

Delivered as nine PRs: the metrics baseline, the SQLite account store, the
Google OAuth handshake and session cookie, the keyring endpoint and its browser
seed, the publish gate and its staging flag, account deletion, the sign-in gate,
the signed-in share panel and landing surfaces, and two docs passes. Design
preceded the UI as adr-009 §4 and adr-010 §9 require: three template sets in
the E-invitation DS project.

Two things the build corrected, both in the ADR's implementation notes. There
is no `SESSION_SECRET` — nothing is signed, because the cookie carries 32
random bytes whose only meaning is as a row key. And the editor's draft had to
be persisted before any of the UI worked: sign-in is a full-page navigation and
the invitation lived only in memory, so a host would have returned from Google
to an empty editor.

## Next iteration: notify the host when replies arrive

Settled in [ADR-015](decisions/adr-015-rsvp-notifications.md) (**proposed**) and
planned as **FR-12**. Taken because
[adr-014](decisions/adr-014-host-accounts.md) §8 named it the natural iteration
after accounts and supplied the one thing it needs — a verified address and a
durable per-user row — while deliberately building neither.

The gap it closes is not reachability, which
[adr-010](decisions/adr-010-host-manage-link.md) already fixed. It is latency:
a host who checks the dashboard once a week learns about their replies on a
schedule unrelated to when guests actually sent them, and for an event with a
catering deadline that is the difference between the dashboard being useful and
being a record.

What the ADR settles:

1. **An account is the eligibility rule.** The address is the Google-verified
   one adr-014 already stores; there is no second address and no verification
   flow of our own. An anonymously published invitation notifies nobody,
   silently — and with `PUBLISH_REQUIRES_ACCOUNT=0` that is most of them.
2. **The email carries no credential.** Links point at bare `/manage/:id` and
   the keyring supplies the token after sign-in (FR-11.3). A forwarded
   notification or a breached mailbox grants nothing — and this was not
   buildable before accounts, when a useful link had to carry `#t=`.
3. **It says replies arrived, not who replied** — title, count, link. Sending
   guest names to a third-party mail provider on every reply is a bigger step
   than adr-013 §2 declined to take for a metric, and it buys the host one tap.
4. **Rate-limited per invitation**, not queued and not debounced: first reply
   immediately, then at most one per window, with the count from the
   `countNewSince` the dashboard already uses (adr-012 §3). The whole state is
   one SQLite column, so a restart costs nothing.
5. **Sending never blocks or fails the RSVP** — dispatched after the response,
   never awaited, failures logged and dropped. No retry queue: the next reply
   after the window carries the full count, which is self-healing.
6. **One provider, one function, plain `fetch`** — adr-007's finding applied
   to a new dependency. Resend recommended, with the free-tier limits and the
   Ukrainian-inbox behaviour flagged as the one claim that has to be verified
   rather than reasoned about.
7. **Default on, disclosed at publish, off per invitation**, with one-click
   unsubscribe (RFC 8058) behind a row-key token — nothing signed, on adr-014's
   no-session-secret precedent.

Six PRs, the last of which is the docs pass — called out in the plan as not
optional and not later, because adr-013's arrived an iteration late and this
iteration also produces DNS records that exist in no other file.

**The ADR is proposed rather than accepted, and its first revisit trigger
questions the iteration itself.** adr-013 shipped the measurement
[07-monetization.md](07-monetization.md) §5.1 gates every commercial option on,
and that measurement needs published invitations real guests open — not another
feature. Building for hosts who are not here yet is the failure mode this
roadmap has flagged twice. The counter-argument is that a dashboard's usefulness
is bounded by how often someone thinks to open it, and no amount of traffic
fixes that. Worth settling before PR 1 rather than after PR 6.

## Candidate backlog

- **RSVP deletion** — needs stable per-RSVP ids and a mutating token-gated
  endpoint; adr-010 §5's superseding covers the common case. Wait for a host
  to ask.
- ~~**Notify the host on a new RSVP**~~ — taken as the next iteration; see
  [adr-015](decisions/adr-015-rsvp-notifications.md) and the section above.
  [adr-014](decisions/adr-014-host-accounts.md) §8 supplied the address and
  left the sender to it.
- **Per-guest edit tokens** so a guest can amend their own answer instead of
  re-submitting — real infrastructure for a rare case (adr-010 §5).
- **SQLite (or similar) store** for *invitation records* — still only when
  multi-instance hosting or RSVP volume breaks the NFR-7 single-process
  assumption; interfaces are ready.
  [adr-014](decisions/adr-014-host-accounts.md) §6 puts a database in the
  process for accounts but deliberately leaves records on the file store, so
  this item narrows rather than disappears.
- **Per-key metering/credits** — stays rejected-for-now (adr-006); revisit
  only if the free-tier + rate-limit model proves too tight for real traffic.
- ~~**Share-loop instrumentation**~~ — shipped as FR-4.7 and FR-7.3–7.5; see
  [adr-013](decisions/adr-013-share-loop-instrumentation.md) and the section
  above. What it produces is now waiting on traffic, not on code.
- ~~**React Router in `web/`**~~ — shipped; see
  [adr-011](decisions/adr-011-client-router.md), which records the original
  declining evaluation, the fact that none of its revisit triggers had fired,
  and what widening the scope past declarative mode would take.
