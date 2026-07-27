# ADR-013 — Share-loop instrumentation

**Status:** proposed · **Date:** 2026-07 · Prerequisite for
[07-monetization.md](../07-monetization.md) §5.1; extends FR-4 and FR-7.
Guest-side data handling follows NFR-4; the token model is unchanged from
[adr-005](adr-005-capability-tokens.md).

## Context

[07-monetization.md](../07-monetization.md) §3 established the constraint that
decides everything about this product commercially: a private host organizes
one or two events a year, so lifetime value is approximately one transaction,
permanently, so customer acquisition cost must be approximately zero. The only
affordable channel is the share link itself — every published invitation is
opened by 20–100 guests who are precisely the target user.

§5.1 then makes one measurement the gate on every option below it. Below
**~0.3 new hosts per published invitation**, no pricing model rescues the
economics and the honest conclusion is that this stays a non-commercial
project. Above **~0.7**, acquisition is effectively free and §5.2's one-time
unlock works.

**That loop is not wired.** `web/src/components/guest/` contains no link back
to the product — the `gr-brand` INVITO wordmark on
[GuestPage.tsx](../../web/src/GuestPage.tsx) is a static `div`.
[metrics.ts](../../server/src/metrics.ts) counts generations, field
regenerations, publishes, RSVPs and backgrounds, and nothing about `/i/:id`
views or where a generation came from. The single number that decides whether
the product can pay for itself is not measurable today.

A second reason to take it now. Production has **9 generations, 4 publishes, 5
RSVPs and 0 field regenerations** lifetime. Three items in
[06-roadmap.md](../06-roadmap.md)'s backlog are gated on a host asking
(adr-010 §5, §8); at this traffic nobody will ask, and the regenerate-rate
that 01-vision calls the primary quality signal has no data to be a signal
with. This is the only backlog item that produces an input another decision is
actually waiting on.

What makes it worth a decision record is not the counter. It is that this is
the first thing the product measures about **people who are not its user**,
and the first write endpoint that carries no credential at all.

## Decision

### 1. Views are counted by the client, because the server route is crawler traffic

`GET /i/:id` is server-rendered so messenger link crawlers can read the `og:*`
tags (FR-3.5, [routes/og.ts](../../server/src/routes/og.ts)). It is the
obvious place to count, and it is the wrong one. Every Viber, Telegram and
WhatsApp unfurl hits it: a link pasted into three group chats registers three
views before a single human opens it, and crawlers re-fetch on their own
schedule. The number would be dominated by robots and would move with
**sharing** behaviour rather than **reading** behaviour — the opposite of the
quantity §5.1 needs.

So the count comes from a beacon the SPA fires after it has loaded the
invitation: `POST /api/invitations/:id/view`, no body, no credential. Crawlers
do not run JS and are excluded for free — which is also the second argument
against doing it server-side, where the only alternative filter is a
user-agent list: a permanent maintenance tax that fails silently every time a
messenger changes its crawler.

The beacon fires only on a successful load. A dead link is not a view.

### 2. "Unique" means "unique browser that has not cleared storage"

An `inv-viewed:<id>` flag in `localStorage` suppresses repeat beacons — the
same browser-local discipline as `inv-manage-seen:<id>` and `inv-invitations`
(NFR-4): it holds no secret and never leaves the device.

This is deliberately the weaker definition. The alternative is a server-side
set of hashed IPs per invitation. It measures better, and it stores a
derivative of a network identifier against a specific social event, for every
guest, indefinitely. NFR-4's entire posture is that the only personal data
stored is what a guest types into the RSVP form; buying precision on a
product metric with that is a bad trade, and it would be the first time the
product recorded anything about a guest who did not choose to answer.

What the weaker definition costs, stated plainly so the number is never read
as more than it is: a guest who opens the link on their phone and again on a
laptop counts twice, a private tab counts again, and cleared storage counts
again. **The number floats high.** It floats high consistently, and §5.1 needs
the magnitude of a ratio — 0.3 against 0.7 — not a precise count.

### 3. The referral records that a guest page sent them, never which one

The call to action links to `/create?ref=guest`, and the editor's generate
request carries `source: "direct" | "guest"` — a closed enum, the same
instinct that keeps design tokens enums-only (adr-003), validated like every
other body field.

It deliberately does not carry the invitation id. The id would make the
aggregate decomposable — *which* invitations convert — and that is a graph of
"this event produced this host". adr-012 refused to teach the server which
invitations belong to one host; teaching it which invitation begat which host
is the same thing approached from the other end, and it is the accounts model
adr-005 rejected arriving by the back door. §5.1's datum is one aggregate
ratio. It does not need the graph, so the graph is not collected.

The parameter is a hint, not a credential. A host who opens their own share
link and then creates something is counted as referred; anyone can type
`?ref=guest`. Both inflate the number. Neither matters at the precision a
magnitude needs, and the alternative is authenticating a metric.

### 4. The router strips `?ref`, the way it strips `#t=`

The parameter is read once when the editor mounts, held in component state for
the session, and removed with `navigate(..., { replace: true })`. adr-011 §4
ended the split ownership of the history stack that had `useHostManage` doing
raw `history.replaceState` surgery; a second hand-rolled URL rewrite would
reopen exactly that. The value has to survive to the generate call, which may
be several minutes and several chat turns later — so it lives in state, not in
the URL it was read from.

### 5. Global counters only; nothing is stored per invitation

`invitation_views` and `referred_generations` join the existing counters in
`metrics.json`, with derived `views_per_publish` and `new_hosts_per_publish`
in the snapshot. `PublishedRecord` is unchanged.

The tempting adjacent feature — showing a host how many people opened their
invitation — is a different question (host value, not unit economics),
answered by a different number (per invitation, needing a store change and a
dashboard treatment the mockups do not yet specify). Keeping it out holds the
iteration at the size §5.1 estimated and keeps this ADR about the loop rather
than about the dashboard. The beacon already carries the id, so adding
per-invitation reach later is a store change and a UI change — never an API
change.

### 6. The endpoint carries an id so that there is something to validate

A bare `POST /api/views` would be an unauthenticated public write with nothing
to check at all. With the id, an unknown or malformed record is a `404` that
never reaches a counter, so counting is gated on holding a real share link —
8 random bytes, the same unguessability adr-005 rests the whole guest side on.

Beyond that the beacon is not defended. adr-008's guardrails are keyed to LLM
spend and stay off endpoints that cost the operator nothing, as they already
do for the RSVP list and the counts batch (adr-012 §5). A process-lifetime
in-memory `ip:id` set removes trivial refresh-loop inflation for free; it
resets on deploy, which is the same leniency adr-008 already accepts for its
own counters. Anyone determined to inflate a public counter can, and a metric
nobody is paid on does not justify a rate limiter.

The response is `204` with no body, and failure is silence on the client. A
guest must never see anything — a spinner, a message, a delay — because a
metric failed.

### 7. One call to action, in one component, always visible

`GuestCta` replaces the static `gr-brand` wordmark: the wordmark, now a link
to `/create?ref=guest`, with one line of copy beneath it in the guest's chrome
language (NFR-5, and per FR-6.3 the switcher moves it — it is chrome, not host
content).

**One placement, not two.** The post-RSVP moment has higher intent; the
always-visible footer has more impressions. There is no data to choose between
them, and measuring one placement yields a number while measuring two yields
neither. It is also the thing 07-monetization §5.2 proposes selling the
removal of, so it must be one identifiable component rather than a treatment
scattered across guest states.

The guest experience does not degrade for it (§5.2, and the same reasoning
adr-010 §3 applied to the share panel): quiet, below the reply card, never a
modal, never ahead of the answer the guest came to give.

**Designed before built**, per adr-010 §9. The mockup is
`templates/guest-rsvp-extras/GuestCta` in the E-invitation DS project — an
addition to the guest-RSVP template rather than a template of its own, because
this is one element inside a screen that is already designed, and it has to be
judged in that screen rather than beside it.

The design problem the mockup exists to settle is narrower than "what should
the call to action look like". `styles.css` records the guest page's intent in
its own comment, carried over from the DS `guest-rsvp` template: **"INVITO
stays a whisper."** That is why the page reads as someone's invitation rather
than as a product surface, and this iteration has to turn that same whisper
into the only acquisition channel the economics can afford (§3 of
07-monetization). The question is therefore how far the whisper can grow before
the page stops belonging to the host.

The chosen treatment leaves the wordmark at exactly its current values and adds
one underlined line beneath it in `#8d8577` — the same treatment as "change
answer", an existing quiet action on the same page. Nothing on the page becomes
louder; one thing becomes legible as an action. Full spec in the mockup.

Four alternatives were drawn and rejected, three of them against rules already
written down rather than on taste:

- **A wordmark linked and nothing else** is the safest and cannot be read. A
  near-zero result would not distinguish a dead loop from an invisible link,
  which defeats the only purpose of the iteration.
- **The action given the accent colour**, wordmark demoted to attribution,
  competes with the RSVP submit button for the same colour and the same
  attention — against the answer the guest actually came to give.
- **A row in the calendar/directions/share pattern** reads as native, and those
  rows exist only after an *attending* RSVP. It cannot satisfy the one-placement
  rule above, and it would make the product a peer of the guest's own actions
  rather than a footer beneath them.
- **A tinted card** measures best and reads as advertising on someone's wedding
  invitation. §5.2's rule that guest experience must never degrade is what
  protects the channel, so the loudest option is excluded by the same reasoning
  that makes the channel worth having.

## Consequences

- **`server/src/schemas.ts` gains the optional `source` on `GenerateRequest`,
  and `web/src/types.ts` mirrors it by hand in the same PR** (NFR-8).
- **`metrics.json` gains two fields.** Its loader already ignores unknown keys
  and starts fresh on corruption (FR-7.2), so an existing file upgrades in
  place — production's current counts survive and the new counters start at
  zero. That is worth stating because the whole value of this work is a ratio
  measured over months.
- **One metrics write per guest view**, the same write-then-rename per event as
  `recordRsvp`. Irrelevant at current volume; if views ever dominate the write
  rate, batching the flush behind a dirty flag is the fix, and it costs at most
  the last few counts on a restart.
- **First endpoint with no credential of any kind.** `POST
  /api/invitations/:id/rsvp` is public but writes guest-authored content to a
  record; this writes only to an aggregate. If a third public-write endpoint
  ever appears, "validate the id, count, `204`" is the precedent to follow.
- **FR-4 gains the call to action, FR-7 gains the counters and derived rates,
  NFR-6 gains the beacon**, and `04-architecture.md` gains the endpoint.
- **Nothing is added to the bundle** — no dependency, so unlike adr-011 there
  is nothing to record under NFR-1.
- **The result may end the commercial question.** §5.1 is explicit that under
  ~0.3 the honest conclusion is a non-commercial project. Instrumentation
  capable only of confirming good news is not instrumentation; this is built to
  be able to return that answer, and the answer is to be taken.

### Deliberately not in scope

- **No per-invitation view counts**, on any surface — §5.
- **No call-to-action click counter.** View → referred generation is the gating
  funnel. Separating "clicked but never created" is the obvious next dial if
  the ratio comes back ambiguous, and it costs another public write endpoint to
  learn something no decision is currently waiting on.
- **No cookies, no third-party analytics, no fingerprinting.** The entire
  measurement is two integers.
- **No attribution beyond the enum** — no campaign parameters, no per-invitation
  credit, no host-facing "you brought N people".
- **No paywall, no badge removal, no pricing surface of any kind.**
  07-monetization stays an investigation until this number exists.

## Implementation plan

Five PRs, each independently mergeable, in order:

1. **The beacon endpoint.** `POST /api/invitations/:id/view` → `204`; unknown
   or malformed id → `404` with no increment; in-memory `ip:id` dedupe;
   `invitation_views` in `metrics.ts`. Server tests: a view counts once, an
   unknown id counts nothing, a repeat from the same ip is dropped, and an
   existing `metrics.json` written before this field loads and upgrades with
   its other counters intact.
2. **The client beacon.** Fired once per browser per invitation from the guest
   page on a ready load, guarded by `inv-viewed:<id>`; never on `not_found` or
   `error`; failure swallowed. Tests drive the hook (RTL, `afterEach(cleanup)`
   — `globals: false` means no auto-cleanup).
3. **The call to action.** `GuestCta` replacing `gr-brand`, strings in both
   languages, linking to `/create?ref=guest`. Tests: renders in both languages,
   carries the parameter, and is present in both the form and post-RSVP states.
4. **Attribution.** `?ref` read and stripped at editor mount through the
   router; `source` on `GenerateRequest` on both sides; `recordGeneration`
   takes it; `referred_generations`, `views_per_publish` and
   `new_hosts_per_publish` in the snapshot. Tests: a referred generation
   increments both counters and a direct one only the first, the parameter
   leaves the URL, and the source still reaches a generate call made several
   chat turns after the strip.
5. **A docs pass** — FR-4.7, the FR-7 sub-items, NFR-6, the route table, the
   roadmap, and this ADR to accepted. The pattern the last four iterations
   used.

Then leave it alone and let it collect. §5.1's thresholds need published
invitations that real guests open; the number means nothing until production
has traffic, and production currently has almost none.
