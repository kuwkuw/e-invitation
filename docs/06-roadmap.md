# 06 — Roadmap: next iteration

Written 2026-07-23, after the AI background layer (adr-009) and the editor
decomposition landed; updated 2026-07-24 when the manage-view and
client-routing iterations shipped, 2026-07-25 when batch response counts
(adr-012) shipped as FR-5.7, 2026-07-27 when share-loop instrumentation
(adr-013) was planned, 2026-07-30 when host accounts (adr-014) shipped as
FR-11, 2026-07-31 when the share loop got the docs pass it had been owed since
its code landed and RSVP notifications (adr-015) shipped as FR-12, and
2026-08-02 when production was read against
[07-monetization.md](07-monetization.md) §5.1 for the first time and the next
iteration was taken, and 2026-08-08 when six days of the standing "wait for
numbers" candidate were read back and the share sheet was taken, and
2026-09-12 when the gallery shipped as FR-14 and this file paid off the two
sections it owed — public discoverability and the date rules had both shipped
with only a backlog strikethrough between them — and 2026-09-15 when the
material system (adr-018) shipped as **NFR-9**, the first iteration this file
records that changed how the product looks rather than what it does, recorded
the same day it shipped. This
doc plans the **next** iteration; when an item ships it moves into [02-functional-requirements.md](02-functional-requirements.md) /
[03-non-functional-requirements.md](03-non-functional-requirements.md) with a
stable ID, per the docs conventions.

## Where we are

The MVP loop is complete end to end: one-sentence generate → per-field
edit/regenerate → publish (versioned snapshot, share link, OG image) → guest
RSVP → host dashboard. Free-tier-first routing (Groq/Gemini) with paid
fallbacks, BYOK for power users, operator-cost guardrails, durable metrics,
add-to-calendar, CSV export, optional AI backgrounds, single-container deploy
on a custom domain.

Fourteen iterations have shipped since (three were missing from this list
until 2026-08-08, and the last three until 2026-09-12 — this list has now
twice been the thing that fell behind):

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
- **Reply notifications** — [adr-015](decisions/adr-015-rsvp-notifications.md),
  below. Shipped as FR-12.
- **The returning host on a new device** — below. Shipped as FR-11.10–11.11,
  no new ADR.
- **Reply notifications become opt-in** — below. Shipped as FR-12.10–12.11,
  amending adr-015 §7.
- **The native share sheet at publish** — below. Shipped as FR-3.6, no new ADR.
- **Public discoverability** — [adr-016](decisions/adr-016-public-discoverability.md),
  below. Shipped as FR-13.
- **The missing-date nudge and the past-date gate** — below. Shipped as
  FR-1.7 and FR-1.8, no new ADR.
- **The invitation gallery** — [adr-017](decisions/adr-017-invitation-gallery.md),
  below. Shipped as FR-14, amending FR-13.2.
- **The material system and the editor canvas** —
  [adr-018](decisions/adr-018-material-system.md), below. Shipped as
  **NFR-9**, amending NFR-1's bundle line and NFR-8's hand-mirror list. No new
  FR.

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
   project — against the constraint `styles.css` already stated in its own
   words, *"INVITO stays a whisper"*: the wordmark keeps its exact current
   values and gains one underlined line beneath it, in the same muted grey as
   "change answer". (The wordmark is **INVINTO** since
   [adr-016](decisions/adr-016-public-discoverability.md) §9, and the comment
   now phrases the same rule without a name. The rule is unchanged.) Four louder treatments were drawn and rejected, three
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

## Shipped: notify the host when replies arrive

Settled in [ADR-015](decisions/adr-015-rsvp-notifications.md) (accepted) and
shipped as **FR-12**. Taken because
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
7. **Default on, disclosed at publish, revocable in one click** (RFC 8058)
   behind a row-key token — nothing signed, on adr-014's no-session-secret
   precedent. The plan said *off per invitation*; that was wrong and is the one
   thing the build changed — see below.

Six PRs plus this docs pass, delivered as one branch: the store and the reverse
lookup, the sender and the message, the trigger, the share-panel disclosure and
its endpoint, the unsubscribe routes and page, a DS pass, and the scope
correction below. The docs pass was called out in the plan as not optional and
not later — adr-013's arrived an iteration late — and this iteration also
produces DNS records that exist in no other file, now in
[05-deployment.md](05-deployment.md).

**The scope of unsubscribe was wrong as planned, and the design pass caught
it.** §7 specified a per-invitation preference, following adr-014 §8. But a
mail client's one-click unsubscribe promises to stop *the sender*: a host with
three events who clicks it and keeps receiving mail about the other two presses
**Spam** next, and that costs deliverability for every message the product
sends, guests' share links included. The preference is account-wide; per-event
control is deferred with its own revisit trigger. Two smaller corrections are in
the ADR's implementation notes — `GET` must not mutate, because mail scanners
follow links without a human, and the routes therefore moved off `/api`.

**The first revisit trigger was never settled, and shipping did not settle
it.** adr-013 produced the measurement
[07-monetization.md](07-monetization.md) §5.1 gates every commercial option on,
and that measurement needs published invitations real guests open — not another
feature. Building for hosts who are not here yet is the failure mode this
roadmap has now flagged three times. What this iteration cost was a second
external dependency and a DNS setup; what it bought is a loop that closes
without the host thinking to check. The honest position is that the trigger
still stands over whatever comes next.

## Shipped: the returning host on a new device

Planned 2026-08-02. The operational candidate the previous version of this
section named was taken and is done — the mail domain is configured
(`notifications.configured`) and the publish gate is closed
(`auth.publish_gate`) — so this begins by reading what accumulated.

**What production said**, lifetime and since the adr-014 baseline: 20 / 5
generations, 10 / 3 publishes, 11 / 2 RSVPs, 6 / 4 guest-page views, and
**0 / 0 referred generations**. `new_hosts_per_publish` is 0 and
`views_per_publish` is 0.6 — fewer than one guest opening each published
invitation. §5.1's thresholds are not merely unmet, they are unreadable at this
n, and nothing here changes that. **This doc's three previous warnings about
building for hosts who are not here yet all still stand**, and this iteration
is scoped to be answerable to them.

Two things came first because they were not features:

1. **Groq is configured in production.** `/healthz` reported `groq: false`,
   `anthropic: false`, `openai: false` — one provider, with the remaining three
   entries of every task walk unset. Gemini's free tier is ~20 requests/day and
   a generate spent three of them, so the live product returned 502 above
   roughly six invitations a day, with no degradation path and no fallback to
   walk to. Brief extraction and design resolution now route to Groq first —
   adr-007's free-tier-first order with both tiers actually present — leaving
   one Gemini call per generate. This is the ceiling that any traffic at all
   would have hit before it hit anything else.
2. **The publish gate stays closed.** adr-014 §2's revisit trigger and the
   `PUBLISH_REQUIRES_ACCOUNT=0` switch were both weighed and declined:
   publishing requires an account. Post-gate `publish_rate` reads 0.6 against
   the baseline's 0.47, which on three publishes is noise. The gate's cost
   stays unmeasured until traffic exists, and that is the honest statement of
   it rather than a defence of the number.

The iteration itself is a **correctness fix, not a growth item**, and rests on
that: FR-11's cross-device event list was built, shipped, and is effectively
unreachable.

1. **The landing list never refreshes after the keyring seed.**
   [LandingPage.tsx](../web/src/LandingPage.tsx) reads `loadHostInvitations()`
   once, synchronously, in a `useState` initializer;
   [useAuthSession.ts](../web/src/hooks/useAuthSession.ts) fetches the keyring
   and writes those entries **after** that read, and nothing re-reads them. A
   signed-in host on a new device sees an empty list until they reload. Two
   comments in that file assert the opposite, which is what let it through, and
   no test covers the seed-to-render path.
2. **There is no way to sign in except by publishing.** The product's only
   sign-in affordance is `AuthGate`, which adr-014 makes the first frame of the
   share sheet. A returning host on a new phone who wants to check their RSVPs
   has to open `/create`, generate an invitation they do not want, and press
   Publish to reach it. That is not what §2 gates — §2 puts a gate at publish,
   and a door on the landing page is not a gate — but it is what having no
   other entry point produced.

What is settled:

1. **The keyring becomes authoritative for the list** when the host is signed
   in, with `hostInvitations.ts` as the fallback. Better than refreshing the
   local copy, because it also ends the staleness of publishing on one device
   and not seeing it on another.
2. **The manage tokens stay in the browser.** With the gate closed the keyring
   is a complete record, which weakens but does not remove the case: the gate
   is a runtime switch that flips without a deploy, deletion must keep working
   without destroying access (FR-11.7), and local development and self-hosting
   run with no OAuth client at all (adr-014 §7), where the browser copy is the
   only path there is. Server-only tokens would make the account an owner
   rather than a keyring, which is a larger reversal of
   [adr-005](decisions/adr-005-capability-tokens.md) than adr-014 took and
   would need its own record.
3. **Sign-in is a quiet header link**, not a button competing with the Create
   call to action. A first-time visitor and a returning host on a new device
   are indistinguishable — both have empty storage and no session — so the
   affordance has to cost the first one nothing.
4. **adr-014 §5 is amended rather than worked around.** *"This hook owns no
   invitation state and exposes no list"* stops being true, and that property
   was load-bearing: it is why `useHostManage`, `usePublishing` and
   `useHostInvitationCounts` need no account awareness. They keep it — only the
   landing list learns.
5. **No new endpoint and no new ADR.** `/api/account/keyring` already returns
   the list shape and `/api/auth/google/start` already takes a guarded
   `redirect_to`. The one server change is that cancelling sign-in returns
   where it started instead of to `/create`.

Shipped as **FR-11.10** and **FR-11.11**, in three code commits plus this docs
pass: the keyring-first list, the declined-sign-in return path, and the link
itself. adr-014's implementation notes carry the §5 amendment.

**adr-010 §9's design-before-code rule was not followed, on purpose.** It was
written for substantial new surfaces — the gate, the dashboard, the share
panel — and the whole UI here is one muted text link in an existing header. The
constraint it had to respect was already written down and already tested:
`accountUi.test.tsx` holds adr-014 §10's ruling that the invitations card
carries no sign-in offer, because that would be an advertisement in the place a
host simply wants their list. The header was the only place left, which is
most of what a mockup would have concluded.

## Shipped: reply notifications become opt-in

adr-015 §7 shipped **default on** on 2026-07-31 and this reverses it two days
later, which is worth stating plainly rather than folding into the section
above.

1. **The reason is deliverability, not consent.** The consent case is weak —
   this is transactional mail to the account owner's own Google-verified
   address about their own event, disclosed at the moment it is caused and off
   in one click. What carries it is that `invinto.app` is an unwarmed sending
   domain: [05-deployment.md](05-deployment.md) already flags Ukrainian inbox
   placement as the one claim to verify rather than reason about, and spam
   presses at this volume damage the **share links** too, not only the
   notifications.
2. **The choice moves to the publish moment**, rather than the default merely
   flipping. A switch on the landing footer that a first-time host never
   scrolls to would reinstate exactly the *"without the host thinking to
   check"* that adr-015 existed to remove. The share panel already renders the
   block; it stops disclosing a default and starts asking.
3. **"Absent row means enabled" inverts, and it is load-bearing.**
   `notifications.ts`'s eligibility join and its own comment about a default
   that cannot drift both move with it, as does `useNotificationPref`'s
   optimistic `true`. Accounts with no row go from on to off with no migration;
   at this scale that is a choice, and it is recorded here rather than
   discovered later.
4. **The manage page gains the control**, absent rather than disabled when
   signed out — the preference endpoints are session-authorized while
   `/manage/:id` is manage-token-authorized, so a pasted manage link genuinely
   cannot reach it. Opt-in makes this surface more necessary, not less: a host
   who declined at publish and later wonders why no mail arrives looks at that
   event's dashboard, not at the landing page.
5. **Account-wide, and labelled as such.** Per-event control stays deferred
   with adr-015 §7's trigger intact — one-click unsubscribe must still stop
   everything, so per-event is both layers rather than a replacement.

Shipped as **FR-12.10** and **FR-12.11**, in three code commits plus this docs
pass: the server default and its eligibility join, the publish-moment choice,
and the dashboard control. adr-015 carries the §7 amendment.

Two things this iteration is answerable for. **It contradicts a note in
adr-015's own implementation record**, which rejected `/manage/:id` as "an
event surface for an account-level setting" — the amendment argues that the
objection was decided under default-on and is outweighed rather than
overturned, and that the scope line is what it costs. And **the tests carried
the reversal rather than being patched around it**: opting in is now visible in
every case that expects mail, which is what makes the default readable from the
test file instead of only from the schema.

Not done, deliberately: no migration. An account with a stored answer keeps it
either way; what changes is the accounts with **no** row, which were implicitly
on and are now off. Preserving their old behaviour would mean writing `enabled
= 1` rows for hosts who never asked for anything — inventing consent to
preserve a default, which is the opposite of what this iteration is for. At
production's account count the cost is a handful of hosts who opt in again.

## Shipped: the native share sheet at publish

Planned and shipped 2026-08-08. The previous version of this file made **doing
nothing** the standing candidate — publish real events, let the numbers
accumulate, read §5.1 when there is something to read. Six days later that is
readable as an experiment, and this is its result:

| | 2026-08-02 | 2026-08-08 |
|---|---|---|
| generations | 20 | 21 |
| publishes | 10 | 12 |
| RSVPs | 11 | 11 |
| guest-page views | 6 | **6** |
| referred generations | 0 | 0 |
| `views_per_publish` | 0.6 | **0.5** |

Two invitations were published in six days and **neither was opened by
anybody**. `views_per_publish` fell only because the denominator moved. Waiting
did not produce the measurement, and there is no version of continuing to wait
that produces it either — so of the two backlog items that touch anything, the
one on the loop being measured was taken.

The gap it closes is an asymmetry that had been sitting in the code since the
guest page shipped: [GuestPage.tsx](../web/src/GuestPage.tsx) calls
`navigator.share` with a clipboard fallback, and
[SharePanel.tsx](../web/src/components/editor/SharePanel.tsx) was
`onCopyLink` and nothing else. The **guest** — the least invested person in the
loop — got the native sheet, while the host, at the one moment the whole
product turns on, got "copy, leave the app, find Viber, paste". Intent 4 in
[01-vision.md](01-vision.md) is messenger-native sharing and
[07-monetization.md](07-monetization.md) §3 names that channel the only
affordable one.

What is settled, shipped as **FR-3.6**:

1. **The primary action becomes Share where the browser can share**, with
   copying stepping down to an outline button beneath it. Not a replacement:
   pasting the link somewhere that is not a chat is ordinary, and this branch
   is not mobile-only — desktop Safari and Windows Chrome both share natively.
2. **The panel's hierarchy is a rule about count, not about which action is
   filled.** [adr-010](decisions/adr-010-host-manage-link.md) §3 keeps the
   manage link subordinate with one filled accent; there is still exactly one,
   and both public controls sit above the divider. The secondary is neutral
   chrome rather than the manage block's warm `.sp-ghost`, so the two copy
   buttons never read as a pair.
3. **A dismissed sheet is a decision, not a failure.** Only a genuine error
   falls back to the clipboard. The guest page copies on any rejection, which
   pops "Copied!" over a deliberate cancel — that behaviour was not carried
   across, and the guest side keeps it for now rather than being changed in an
   iteration that is not about it.
4. **The sheet carries the title as published**, not as edited since. The
   editor keeps running after a publish, and what the link resolves to does not
   change until the host republishes.
5. **Never the manage token**, which is a bearer secret whose targets here
   would be group chats. Held by a test rather than by care.
6. **The capability is read once, in the hook**, so the panel stays
   presentational and `canShare: false` — jsdom, and every browser without the
   API — is the panel exactly as it shipped.

One commit plus this docs pass. **adr-010 §9's design-before-code rule was not
followed**, on the precedent the FR-11.10 section set two iterations ago: it is
written for substantial new surfaces, and this is one button added to an
existing block whose governing constraint was already written down and already
tested. The constraint here is the filled-accent count, held by
`SharePanel.test.tsx`, and the new cases assert it in the new state rather than
around it.

**What this iteration is answerable for**: it cannot manufacture guests. It
removes friction at the step where the loop measurably breaks, and the numbers
above are the reason to believe that step is where it breaks — but n is 12
publishes lifetime, the two most recent may well have been our own testing, and
a share sheet does not move `new_hosts_per_publish` by itself. This doc's four
previous warnings about building for hosts who are not here yet all still
stand.

## Shipped: public discoverability

Settled in [adr-016](decisions/adr-016-public-discoverability.md) (accepted),
shipped 2026-08-21 as **FR-13**. This section was owed when the code landed and
is written late, from the ADR and the commits.

The app shipped **one** `index.html` whose entire head was
`<title>Invitation Studio</title>` — a name that appeared nowhere else in the
product, which at that point had four. Three separate problems followed: the
product was not findable; everything it served was indexable *including* guest
pages and dashboards; and there was no `robots.txt`, sitemap, icon or share
card at all.

What landed: one module (`server/src/seo.ts`) deciding what each path's head
says, the shell's default block **replaced** rather than appended to (`og:title`
is first-one-wins, so an appended card would unfurl every share link as the
marketing page), `/` indexed and every private surface `noindex` with an
`X-Robots-Tag` to match, `robots.txt`/`sitemap.xml` as routes rather than
files, `?lang=en` as the English landing page's own address, one name —
**INVINTO** — everywhere, brand icons and a per-language share card, and
finally (§10) the landing page's copy prerendered into the shell, because
Google's JS rendering is a queued second pass that gets the least budget on
exactly this kind of domain.

The rule that must not be "tidied": `robots.txt` does **not** disallow `/i/`,
and explicitly `Allow`s the OG image before `Disallow: /api/`. Either omission
stops every published link unfurling, with nothing in the logs.

What it delivered is the **floor** — the landing page can be found and says
what it is. What it deliberately did not deliver is anything to rank *for*,
which is the gallery below.

## Shipped: the missing-date nudge and the past-date gate

Shipped 2026-09-05 as **FR-1.7** and **FR-1.8**, no new ADR. Also owed and
written late.

Two rules about the same silence, deliberately unequal. A date that will not
parse into a calendar start is a **nudge**: the chat asks once per session and
publishing is untouched, because a save-the-date without a day is a real
invitation. A date that parses into a day **already gone by** is a **gate**:
`usePublishing.publish` refuses it outright — the one funnel the button press,
a republish and the post-sign-in resume all run through — so it is a rule
rather than a disabled button, and it is said on every turn it is still true
because a reason that scrolls off the top of the log explains nothing.

Both sides read one predicate, `isPastDate`, and it compares by **calendar day
in the host's local time**: an event that started this morning is not past.
That is also why the check is client-side and not on the server, whose "today"
is UTC and would refuse a legitimate same-day publish for hosts east of it.

## Shipped: the invitation gallery

Settled in [adr-017](decisions/adr-017-invitation-gallery.md) (accepted),
shipped 2026-09-12 as **FR-14**, amending FR-13.2.

The 2026-09-11 reading is what took it:

| | 2026-08-02 | 2026-08-08 | 2026-09-11 |
|---|---|---|---|
| generations | 20 | 21 | **26** |
| publishes | 10 | 12 | **15** |
| guest-page views | 6 | 6 | **8** |
| referred generations | 0 | 0 | **0** |
| `views_per_publish` | 0.6 | 0.5 | **0.53** |
| `new_hosts_per_publish` | 0 | 0 | **0** |

The experiment the previous version of this file set — whether
`views_per_publish` moves off 0.5 after the share sheet — **did not conclude.**
Three publishes and two views in thirty-four days is not an answer; it ran out
of denominator rather than failing. The honest reading is that the loop is not
broken, **nobody is entering it**, and FR-13 had made the front door findable
without giving anyone a reason to walk through it.

What shipped: `/gallery` plus six occasion pages in two languages (16 indexed
addresses, up from 2), 24 ready-to-use invitations rendered through the real
`InvitationPreview`, "use this one" seeding the editor with **no model call**,
prerendering extended from one block per language to one per (page × language),
and gallery-attributed generations *and publishes*.

Three things worth carrying forward:

1. **The publish is attributed, not only the generate.** A gallery host can
   take a sample, hand-edit two lines and publish having generated nothing —
   the host this channel exists to produce, and invisible to every counter that
   existed before. The cost is that `publish_rate` (publishes ÷ generations)
   now inflates and can exceed 1; subtract `gallery_publishes` to recover it.
2. **The copy is hand-written, not pipeline-sourced**, which adr-017 §2 asked
   for and records the reason for: no keyed non-production environment existed,
   and generating against production would have damaged the very counters this
   iteration exists to read. The copy-quality reading §2 promised did not
   happen.
3. **The bundle budget's trigger fired, against a stale number.** 101.2 kB
   gzipped, past the ~100 kB adr-017 §5 set — but that threshold was derived
   from an NFR-1 figure 3.2 kB out of date. The gallery's real cost is +9.1 kB
   on a 92.1 kB baseline, inside its own estimate. Content stayed in the
   bundle; the trigger was re-derived as 115 kB against a measured number.

**What this iteration is answerable for**: nothing yet, and deliberately so. A
new domain with no inbound links takes three to six months to rank. **No
conclusion before roughly 2026-12-15** — this doc has a documented habit of
reading too early, and the share sheet above was taken on six days and an n of
two. The only check worth making sooner is whether Search Console reports the
pages indexed at all, which is plumbing and answers in about two weeks.

## Shipped: the material system and the editor canvas

Settled in [adr-018](decisions/adr-018-material-system.md) (accepted), shipped
2026-09-15 as **NFR-9** (new), amending NFR-1's bundle line and NFR-8's
hand-mirror list. No new FR — this is the first iteration this file records
that changed how the product looks rather than what it does.

Taken because reading the stylesheet turned two vague complaints — "looks
dated and amateur", "inconsistent across screens" — into a measurement: 1719
lines, 77.8 kB raw / 19.4 kB gzipped, **443** raw hex literals, **106**
distinct colours, and exactly **one** `:root` token block in the whole file,
holding only the two RSVP status colours. Three different values served as
"the accent" depending on which section of the file you were in. Four visual
bearings were rendered against the real product — the existing direction done
properly, an editorial/paper direction, a soft-modern direction, and an
iOS-derived one — and **Full Liquid Glass** was chosen: translucent chrome
over a colour field, with the invitation itself as the solid object beneath
it. The editor went first because it was measurably the cheapest surface to
restructure: three class/DOM test assertions against roughly fifty-six spread
across the rest of the suite, because the editor's behaviour is tested at the
`useInvitationEditor`/`usePublishing` hook level rather than through markup.

What shipped:

1. **A `:root` token block** — ground, glass, ink, accent, radius, elevation,
   motion — in its own "Material system" banner section at the top of
   `styles.css`, ahead of "App chrome" rather than inside it, so the token
   definitions themselves are never mistaken for the literals the ratchet
   test polices.
2. **A ratchet, not a promise.** `web/test/styles.test.ts`'s `CONVERTED`
   allowlist names the sections required to carry no raw hex — today exactly
   `["App chrome", "Creation chat"]` — and each future surface conversion adds
   a name to it, the same idiom `gallery.test.ts`, `i18n.test.ts`,
   `seo.test.ts` and `og.test.ts` already use for a rule the types can't hold.
   `.palette-*`, `.type-*`, `.layout-*` and `.ornament-*` stay permanently
   exempt: those values are mirrored by hand into `server/src/og/render.ts`,
   and a raw hex there is what keeps that mirror visible rather than silent.
3. **Glass as two composed classes**, not a token — `.glass` for the header
   and toolbars, `.glass-solid` for text-bearing surfaces (composer, banner,
   sheets), with the rule that makes the `prefers-reduced-transparency`
   fallback a token swap rather than a second design: every glass surface
   must stay legible with its blur removed. `prefers-reduced-motion` is
   honoured the same way, for sheet springs.
4. **The ground reads the invitation's own palette**, via `data-palette` on
   `.cc-shell` rather than the `palette-*` class itself, which would leak the
   card's own ink and accent into the chrome. The six-entry
   `.cc-shell[data-palette="…"]` map is a new hand-mirror of the `.palette-*`
   rules, now on NFR-8's list beside the others, with enum coverage held by
   `web/test/styles.test.ts`.
5. **Four stacked control rows became one floating segmented toolbar** whose
   sheets read the real `palette-*` custom properties for their swatches, so
   an option can never drift from what the card actually shows — the one part
   of the visual pass that is a genuine usability change, not only a restyle.
6. **The chat log collapses into a floating composer with a peek line**, and
   FR-1.8's per-turn publish refusal moved to a banner rendered purely from
   `dateBlocked` so the guarantee survives a layout that no longer keeps the
   log on screen at all times. The log's own emission is untouched —
   `useInvitationEditor.ts` and its test carry zero diff lines, which was the
   task's defining property, because the log entry and the banner do
   different jobs and both were already correct.
7. **Two status tokens, `--danger` and `--success`, were minted at their
   pre-existing hex values** rather than reusing the RSVP pair or excluding
   their rules from the ratchet. Both sit inside a converted section but
   belong to out-of-scope surfaces — `.error` renders on the guest page,
   `.cc-key-active` in the BYOK panel — so an identical value means zero
   pixel change today, and the token is ready when those surfaces convert.

Delivered as eight tasks (13 commits, `15ed45c..921c40c`), each independently
spec- and quality-reviewed before the next was dispatched, plus this docs pass
the same day — unlike three of the iterations above, nothing here was owed.

**What this iteration is answerable for, and what it is not:**

- **One surface converted, five still on literals.** The editor is the only
  converted surface; landing, gallery, guest, manage and crash still carry raw
  hex, named individually below.
- **A section is not a surface.** The ratchet's unit is a stylesheet section
  (`App chrome`, `Creation chat`); adr-018 §8's scope boundary's unit is a
  surface. Tokenising those two sections also touched two things §8 lists as
  out of scope — the language switcher shared by the landing, guest and
  manage screens, and the share-panel/BYOK-panel shells — because both live
  inside those sections. Kept rather than reverted: the deltas are
  imperceptible or improvements (the globe icon's contrast goes
  2.22:1 → 3.20:1). The next conversion should expect the same mismatch.
- **Not every bespoke shadow consolidated.** Three — `.ls-seg.active`,
  `.cc-share-panel` and `.cc-skeleton` — stayed literal `rgba()` rather than
  snapping to `--e-1`/`--e-2`/`--e-3`, a
  disclosed judgment call: the plan gave ranges for radii but none for
  shadows, and snapping unasked would have moved pixels nobody approved. This
  weakens adr-018's "~9 bespoke shadows" framing somewhat; the token exists
  and has consumers, just fewer than the ADR implied.
- **The toolbar sits above the card, not floating over its bottom edge as the
  approved mockup showed.** The CSS matches the plan exactly
  (`.cc-design { position: sticky; bottom: 0 }` as the preview pane's first
  child); the gap is between the approved mockup and the plan written from
  it, not an implementation defect. Parked this iteration rather than
  reworked, because fixing it means repositioning the DOM and changes desktop
  too, which nothing here specified.
- **adr-018 §7's hardware gate has not been run.** The ADR is explicit that
  glass should not ship before a DevTools throttle pass and a check on a real
  mid-range Android inside Viber's in-app webview — "it does not ship
  stuttering." Neither has happened yet; this is still owed before the glass
  direction should be trusted on the hardware hosts are actually opening
  their invitations on.

## Candidate backlog

- **Five surfaces still carry raw hex** — landing, gallery, guest, manage,
  crash. The material system ([adr-018](decisions/adr-018-material-system.md))
  shipped with the editor as its only converted surface, and
  `web/test/styles.test.ts`'s allowlist names the rest. The share panel, BYOK
  panel and auth gate come first: they open from the editor header, so the seam
  is visible at the moment the host presses Publish.
- ~~**The RSVP prompt is the only field anyone rewrites.**~~ — **gone cold, and
  it should be said plainly.** `field_regenerations` has read
  `{"rsvp_prompt": 6}` since before 2026-08-02 and read exactly that on
  2026-09-11: **not one field regeneration in thirty-four days.** The 2026-08-08
  caveat — "six events could be one host with a habit" — is now the most likely
  reading, and six observations spread over the product's whole life is not a
  copy-quality signal at any rate. Revisit only if the number moves.
- **Nothing has ever used the AI background layer.** `backgrounds` is **0
  lifetime** — a feature with its own ADR ([adr-009](decisions/adr-009-ai-background-layer.md)),
  an image model, a scrim spec synced from the DS and a per-IP guardrail, and
  not one invocation in production. That is not a bug report; it is a fact
  about where effort went, and it belongs on this list next to every proposal
  to build something else for hosts who are not here. The cheap reading first:
  the control may simply be hard to find in the editor.
- **Re-source the gallery copy from the pipeline** once a keyed
  non-production environment exists. adr-017 §2 wanted the gallery to show what
  the *product* writes, not what a careful writer writes; it shipped
  hand-written because the only keyed environment was production, where forty
  generations would have damaged the counters the iteration exists to read.
  Cheap, and it restores the copy-quality reading §2 promised.
- ~~**Invitation gallery on the landing page**~~ — shipped as FR-14; see
  [adr-017](decisions/adr-017-invitation-gallery.md) and the section above. It
  landed as its own seven-page section rather than a strip on the landing page:
  a conversion surface wants to be on `/`, but a *search asset* wants one page
  per query, and the numbers said acquisition was the problem.
- **RSVP deletion** — needs stable per-RSVP ids and a mutating token-gated
  endpoint; adr-010 §5's superseding covers the common case. Wait for a host
  to ask.
- ~~**Notify the host on a new RSVP**~~ — shipped as FR-12; see
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
- ~~**Native share sheet at publish**~~ — shipped as FR-3.6; see the section
  above. The panel's hierarchy survived it, which was the only thing this item
  had ever been waiting on.
- ~~**Public discoverability**~~ — shipped as FR-13; see
  [adr-016](decisions/adr-016-public-discoverability.md). Organic search is the
  second of the two zero-cost channels
  [07-monetization.md](07-monetization.md) §3 allows, and the only one that
  reaches a host nobody has invited yet. What it delivers is the *floor*: the
  landing page is indexable in both languages with copy written for a listing,
  and every private surface — the editor, dashboards, guest pages — is
  `noindex` without losing a single messenger unfurl. What it does not deliver
  is anything to rank *for*; that is the gallery item above.
- ~~**Share-loop instrumentation**~~ — shipped as FR-4.7 and FR-7.3–7.5; see
  [adr-013](decisions/adr-013-share-loop-instrumentation.md) and the section
  above. What it produces is now waiting on traffic, not on code.
- ~~**React Router in `web/`**~~ — shipped; see
  [adr-011](decisions/adr-011-client-router.md), which records the original
  declining evaluation, the fact that none of its revisit triggers had fired,
  and what widening the scope past declarative mode would take.
