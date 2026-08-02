# ADR-015 — Notify the host when replies arrive

**Status:** accepted · **Date:** 2026-07-31 · Builds on
[adr-014](adr-014-host-accounts.md) §8, which supplies the address and
deliberately left the sender to this iteration. Lands as **FR-12**, extends
FR-5, and adds a paragraph to NFR-4 that this ADR argues is the whole cost of
the feature.

## Context

The host publishes, sends the link to a group chat, and then has no idea
anything has happened until they think to open `/manage/:id` again. Every
other part of the loop notifies somebody: the guest sees their answer land,
the messenger unfurls the card, the dashboard updates the moment it is
opened. The host learns nothing unless they go and look.

[adr-010](adr-010-host-manage-link.md) fixed *reachability* — the manage link
survives a closed tab and a second device. It did not fix *latency*: a host
who checks once a week finds out on a delay that has nothing to do with when
their guests actually replied. For an event with a catering deadline that is
the difference between the dashboard being useful and being a record.

[adr-014](adr-014-host-accounts.md) §8 named this as the next iteration and
listed exactly what it needs — "a transactional email sender: a second
external dependency, deliverability work for Ukrainian inboxes, a
per-invitation preference, and an unsubscribe path" — and said bundling it
with accounts "would put two external services and a privacy-surface change in
one review." That reasoning was right, and it is why this is a separate ADR
rather than a follow-up PR.

**What makes this worth a decision record is not the sending.** Sending an
email is one `fetch`. It is that this is the first time the product speaks to
a user unprompted, and the first time anything about a guest could leave the
system. adr-014 §9 rewrote NFR-4 to say the product *holds* a verified email
address. Using it for outbound messaging is a different claim, and the address
was collected under `openid email` for identity — not because the host asked
to be mailed.

Two constraints from earlier decisions bound the design before it starts:

- **The guest experience must never degrade** for something that serves the
  host ([07-monetization](../07-monetization.md) §5.2, applied by
  [adr-013](adr-013-share-loop-instrumentation.md) §6 to the view beacon). The
  RSVP response cannot wait on a mail API, and a mail failure cannot fail an
  RSVP.
- **NFR-4's posture on guest data.** adr-013 §2 refused a more accurate view
  count because it would have stored a derivative of a network identifier
  about guests who never chose to answer. Guest data leaving the system
  entirely is a larger step than the one that ADR declined to take.

## Decision

### 1. An account is the eligibility rule, and there is no second address

Notifications go to `users.email` — the Google-verified address adr-014
already stores — resolved through the keyring. There is no notification
address field, no "send my replies to…" input, and no verification flow of our
own, because building one would mean owning a confirm-your-address email in
order to send a notification email.

The consequence is stated plainly rather than worked around: **an invitation
published anonymously notifies nobody**, forever, and silently. With
`PUBLISH_REQUIRES_ACCOUNT=0` (adr-014 §7 — a supported mode, and the one
self-hosting runs in) that is most invitations. The host is not told they are
missing something they never asked for; the feature simply does not exist for
them, and republishing while signed in turns it on, which is the same claim
path FR-11.4 already defines.

This is the first host-facing *feature* that requires an account. adr-014 §1
was careful that an account is "a keyring, not an owner" and that a session's
only powers are reading back tokens and authorizing a first publish — that
stays true, because notification is not a session power and grants no access
to anything. But the honest summary changes: the account was a place to keep
keys, and it is now also **a delivery address**. That is the sentence NFR-4
has to gain, and §7 below is what pays for it.

### 2. The email carries no credential — and that is only possible because accounts shipped

Every link in the email points at bare `/manage/:id` with no `#t=` fragment.
The host signs in; FR-11.3's keyring seeds the manage token; the dashboard
opens. The email is a pointer, not a key.

This matters more than it looks. [adr-010](adr-010-host-manage-link.md) §2 put
the manage token in a URL *fragment* precisely so it would stay out of server
logs and referrer headers, and adr-014's NFR-4 rewrite calls the manage link a
"bearer secret" whose UI treatment is the only control against a host pasting
it into the wrong chat. An email is a worse place for a bearer secret than a
chat window: it is forwarded, it sits in an inbox for years, it is indexed by
the mail provider, and it is the single most common thing an attacker already
has when they have anything.

So the notification is the first host-facing surface that reaches the
dashboard **without carrying the token at all**. A forwarded notification
grants nothing. A breached mailbox grants nothing. Before adr-014 this was not
buildable — with no keyring, a useful link had to carry `#t=`, and this
iteration would have had to choose between a useless email and a token in
every host's inbox.

**The one exception is unsubscribe**, which must work from a mail client
without a sign-in, and therefore must carry something. It gets a token of its
own (§7) that can do exactly one thing.

### 3. The email says replies arrived; it does not say who

The body carries the invitation title, **a count**, and a link. No guest name,
no yes/no, no party size, no note.

The tempting version — "Anna is coming, +2" — is more useful at a glance and
is what most products send. It also means that every RSVP ships a guest's name
and their attendance at a named private event to a third-party mail provider,
for storage and scanning on their infrastructure, for guests who never agreed
to anything beyond typing their name into a form on the host's page.

adr-013 §2 declined a better view count because storing a hashed IP against a
social event was too much to spend on a product metric. This is the same trade
with the numbers moved: the data is more identifying, the recipient is a third
party rather than our own disk, and what it buys is convenience rather than
even a metric. The consistent answer is the same answer.

What the count-only design costs: the host clicks through to learn anything.
That is one tap on the device the email was read on, to a dashboard that
already exists, is already designed, and is the only place the numbers are
authoritative anyway (FR-5.5's dedupe means a raw per-RSVP email would
sometimes contradict the dashboard — a guest who answers no→yes would have
generated two emails and one row).

It also makes the whole feature **naturally batchable**, which §4 depends on:
counts coalesce, and "3 new replies" is one email where "Anna, then Petro,
then Olena" is three.

Rejected in favour of this, and recorded in full below: name-and-answer in the
body, and a host-configurable verbosity.

### 4. Rate-limited per invitation, not queued and not debounced

At most **one email per invitation per window** (default 60 minutes,
`NOTIFY_WINDOW_MINUTES`). The first reply to an invitation mails immediately —
that one has the most value and the least competition. Any reply arriving
inside the window mails nothing. The next reply after the window mails once,
carrying every reply since the last notification.

The count comes from `countNewSince` in
[rsvpSummary.ts](../../server/src/rsvpSummary.ts), the function FR-5.7 and the
dashboard already share, with `last_notified_at` as the baseline instead of the
client's `seen_at`. adr-012 §3's "one counting implementation" extends to this
for the same reason: an email that disagrees with the dashboard it links to is
worse than no email.

The two alternatives are worse in ways this project has already ruled on:

- **A debounce timer** (wait N minutes, then send once) coalesces better and
  needs an in-process timer holding unsent state. NFR-7 is a single process
  with no job queue; a restart mid-window silently drops notifications, and the
  state that decides whether to send lives in memory where it cannot be
  inspected. The rate-limit's entire state is one column in SQLite, so a
  restart costs nothing and `last_notified_at` is readable.
- **One email per RSVP, uncapped** is what a 100-guest wedding turns into 100
  emails for one host, and it is how a sender's reputation and a free tier are
  both spent at once.

The window is deliberately long. This is not a chat application; the host is
catering an event, not watching a feed.

### 5. Sending happens after the reply, and can never fail it

`POST /api/invitations/:id/rsvp` writes the RSVP, records the metric, and
returns `{ok: true}`. The notification is dispatched after the response, not
awaited, and every error inside it is caught and logged.

A guest waiting on a mail API is the failure adr-013 §6 already refused for a
counter, and the stake here is higher: the RSVP is durable on disk before the
send is attempted, so a dropped notification costs a nudge while a blocked or
failed reply costs the answer the guest came to give. Notifications get no
retry and no dead-letter queue — the dashboard is the complete record, and the
next reply after the window notifies anyway, which is a self-healing property
worth more than a retry table.

One structured log line per attempt (invitation, ok/error, provider status,
latency), following the gateway's precedent under NFR-6.

### 6. One provider, one function, plain `fetch`

The sender is a single module (`server/src/email/send.ts`) exposing one
function, calling one REST endpoint with `fetch`. No SDK, no nodemailer, no
transport abstraction until there is a second transport.

This is [adr-007](adr-007-in-process-providers.md)'s finding applied to a new
dependency: that ADR removed a multi-provider proxy and a client library in
favour of `fetch` against OpenAI-compatible endpoints, and the resulting
adapter is the smallest module in the gateway. A mail API is a POST with a
JSON body and a bearer token; a library for that is a supply-chain entry and a
version to keep current in exchange for nothing.

**Recommended provider: Resend** — a plain REST API, a free tier sized for a
product with four lifetime publishes, and DKIM/SPF setup that is three DNS
records at Cloudflare, where `invinto.app` is already hosted
([05-deployment](../05-deployment.md) §Custom domain). Alternatives considered:
Postmark (the best transactional deliverability reputation, and a free tier too
small to run on), Brevo (EU-resident, which is a real argument under NFR-4, and
a heavier API), and Amazon SES (cheapest at volume this product does not have,
and the most setup).

**Verify the current free-tier limits and the Ukrainian-inbox behaviour before
committing** — provider pricing moves, and the deliverability claim above is
the one thing in this ADR that cannot be settled by reasoning from our own
constraints. The check is: send to `ukr.net`, `meta.ua` and Gmail from the
verified domain and confirm inbox placement, not just a `200` from the API.
The swap cost is one module either way, which is the point of §6.

### 7. Consent, preference and unsubscribe

- **Default on** for invitations published while signed in. A host who
  publishes an invitation and receives replies to it is the least surprising
  possible use of the address, and an opt-in checkbox at publish is one more
  decision at the exact moment adr-014 §2 already added one.
- **Disclosed where it is caused.** The share panel says, in one line, that
  replies will be emailed to the signed-in address, with the off switch beside
  it. The host learns this at publish, not from the first email.
- **Per account, not per invitation** — reversing what adr-014 §8 assumed, and
  the one place the design changed after the mockups. One-click unsubscribe
  (RFC 8058) is presented by every mail client as *"stop sending me this kind
  of mail"*. Honouring that for a single event leaves a host who organizes
  three still receiving mail about the other two, and their second click is the
  **spam** button — which costs sender reputation for everything the product
  sends, including the share links guests unfurl. A preference narrower than
  the promise the button makes is not a smaller feature, it is a broken one.

  Per-event control is deferred rather than rejected: it is a real want for a
  host running several events at once, and the revisit trigger below is what
  brings it back. Nothing here forecloses it — the table gains an
  `invitation_id` and the token gains a scope when it arrives.

- **Two tables, because the preference and the window have different
  lifetimes.** `notification_prefs` is keyed by `user_id` and carries `enabled`
  and the `unsub_token`; `notification_sends` is keyed by
  `(user_id, invitation_id)` and carries `last_notified_at`, because §4's
  window is per invitation — a host with two busy events should hear about
  each rather than have one silence the other. Splitting them also means
  unsubscribing and resubscribing cannot reset every window.

  A prefs row is **a deviation from the default, not a copy of it**: no row
  means enabled, and rows appear when a host changes the setting or when the
  first notification is sent. That is what makes "default on" an actual default
  — a value stamped into every account would have to be migrated if the default
  ever changed. It also keeps the dependency pointing one way: publishing
  creates no notification state, so `linkInvitation` and the account layer need
  no notion that this feature exists.

- **The copy says what the switch does.** In the share panel the action reads
  "Turn off all emails", not "Turn off", because it is pressed from one event's
  panel and takes effect on all of them; in the email footer the link reads
  "turn these emails off" rather than naming the invitation. A control whose
  scope is discovered after pressing it is the same defect as the one this
  section exists to avoid, moved one screen earlier.

- **Disclosure is a moment; a preference needs an address.** These are
  different questions and this section originally answered only the first,
  which is how the switch shipped reachable *only* from the post-publish share
  sheet — a sheet that appears once and is then gone, leaving the email footer
  as the only durable way out. That is precisely the friction that earns the
  spam button.

  The rule, corrected: **the disclosure lives where the cause arises; the
  control lives on the surface of its own level** — account-level in the
  account, event-level in the event. So the share-panel line stays exactly
  where it is, and the switch also has a permanent home in the landing page's
  account footer, which is the only account surface the app has.

  Absent, never disabled, on two conditions: a deployment that cannot send mail
  promises nothing, and before a host's first invitation a preference about
  replies is about nothing. It appears with the first published invitation.
- **One-click unsubscribe.** `GET|POST /api/notifications/unsubscribe/:token`
  sets `enabled = 0`, plus `List-Unsubscribe` and `List-Unsubscribe-Post`
  headers (RFC 8058) so a mail client can do it without opening a page.
  Unsubscribing is not a sign-in.

The `unsub_token` is 16 random bytes and **nothing is signed**, following
adr-014's implementation note that there is no session secret because the
cookie's value "means nothing except as a row key." The same applies here: the
token is a row key whose only power is to turn one invitation's notifications
off. An HMAC would introduce the first signing secret in the codebase in order
to avoid a column.

Account deletion (FR-11.7) drops the prefs rows with the user, since they hang
off `user_id`. Invitations and RSVPs are untouched, exactly as before.

### 8. Unconfigured is a supported mode

No `RESEND_API_KEY` (or no `NOTIFY_FROM`) means notifications are off: the
server boots, publishes, RSVPs, and every existing surface behaves identically,
and nothing in the UI offers a preference that cannot be honoured. `/healthz`
reports `notifications: { configured, window_minutes }`.

This is NFR-3's keyless-boot rule and adr-014 §7's auth-unconfigured mode
applied a third time. It is also what keeps the test suite honest — no test
sends mail, and the send boundary is mocked the way the LLM boundary already
is.

### 9. The email is in the invitation's language

`invitation.brief.language` (`uk`/`en`) — the language the host wrote their
sentence in. Not the UI toggle, which is browser-local and never reaches the
server, and not the guest's chrome language, which is the guest's choice about
someone else's page (FR-6.3).

Strings live in one server-side module. NFR-5's rule is that user-facing
strings live in `i18n.ts` on the web side and in the prompts on the server;
this is the first server-side user-facing *copy* that is not a prompt, so it
gets the same treatment — one module, both languages, no string in a handler.

### 10. Design precedes code

Per adr-009 §4 and adr-010 §9. The mockup is `templates/notification-email` in
the E-invitation DS project, and it has one real problem to solve: an HTML
email cannot use the design system. No web fonts, no custom properties, no
flexbox worth relying on, table layout, inline styles, and a dark-mode
rendering the client decides. The mockup settles what the card degrades to —
which is a different question from what the card looks like, and the reason
this needs a mockup rather than a developer's best guess at one.

A plain-text alternative part ships with it. Not optional: a transactional
email without one is a spam-filter signal, and it is the version that renders
correctly everywhere.

**Both surfaces were built before their mockups existed, deliberately and on
the record.** adr-009 §4 and adr-010 §9 make design precede code, and this is
the first iteration to go the other way, so it is written here rather than
discovered in a diff:

- **The email** (PR 2). §3 made it count-only, which dissolved most of what
  the mockup was for: with no invitation card in the message there is nothing
  to decide about how the card degrades, and what remains is a sentence, a
  button and a footer. It is table layout with inline styles and no web fonts
  — the constraints, not a composition. A DS pass can restyle it without
  touching the sender.
- **The share-panel line** (PR 5). This one had a real template to extend —
  adr-014's `templates/share-panel` signed-in variant — and did not wait for
  it. The mitigation is that it invents nothing: the line reuses
  `.sp-account-note`'s values and the switch reuses `.sp-manage-hide`'s, so it
  is a composition of two controls the DS already specified rather than a new
  one. A toggle switch would have been a new control and was rejected for
  exactly that reason.

The standing rule is unchanged and this is not a precedent for the next
iteration. What made it defensible here is that neither surface needed a
design *decision* — one had its problem removed by §3, the other had its
answer already written in the panel it joins.

## Consequences

- **A second external dependency**, and the first one in the request path of
  something a guest triggers. §5's fire-and-forget is what keeps that from
  being a guest-visible dependency; the provider being down costs
  notifications and nothing else.
- **Guest data still does not leave the system.** §3 is what buys this: the
  provider learns the host's address and that they have an event with replies,
  which is unavoidable for anything that mails them, and learns nothing about
  any guest.
- **NFR-4 gains a paragraph**: what the address is now used for, that the use
  is disclosed at publish and revocable per invitation, and that no guest data
  is transmitted. NFR-6 gains the send log line. NFR-3 gains the unconfigured
  mode.
- **One new table** (`notification_prefs`) and **one new index** — the keyring
  is keyed `(user_id, invitation_id)` and this feature needs the reverse
  lookup, so `keyring_invitation_id` is added. The file store is untouched;
  `PublishedRecord` gains nothing, as in adr-013.
- **DNS becomes part of deployment.** SPF, DKIM and a DMARC record at
  Cloudflare, plus a `NOTIFY_FROM` on the verified domain. This is the first
  thing the product needs that cannot be fixed by a deploy — a misconfigured
  DKIM record means mail silently lands in spam, so the runbook gets a verify
  step that checks inbox placement rather than API success.
- **A restart between the reply and the send loses that notification.** No
  retry, per §5. The next reply after the window carries the full count, so
  the loss is bounded and self-correcting.
- **Two hosts can hold the same invitation** in their keyrings (FR-11.4 allows
  a republish by another signed-in account). Both get notified; the prefs row
  is per `(user_id, invitation_id)`, so they unsubscribe independently. This
  is a co-host by accident rather than by design, and it is left working
  rather than blocked.

### Deliberately not in scope

- **No digest of any other shape** — no daily summary, no weekly roundup, no
  "your event is tomorrow" reminder. Each is a separate scheduled job and this
  iteration adds no scheduler.
- **No email to guests.** No confirmation of their own RSVP, no reminders, no
  updates when the host republishes. That would be mailing addresses the
  product does not collect, and FR-4.3 does not ask a guest for one.
- **No notification of anything except replies** — not views (adr-013 §5 keeps
  reach global on purpose), not publishes, not failures.
- **No in-app or push notification**, no web-push, no service worker.
- **No second identity provider and no email/password sign-in**, which a
  "notify me without Google" request would otherwise pull in — that is
  adr-014's boundary and this ADR does not move it.
- **No entitlement or pricing surface.** adr-014 §8's second half stands:
  everything commercial stays gated on adr-013's measurement.

## Rejected alternatives

**Guest names and answers in the email body.** More useful, and the reason
§3 says no is written there. Worth restating as a *rejection* rather than a
preference: this is the only option in this ADR that would make guest data
leave the system, and it would do so on every reply, permanently, in exchange
for saving the host one tap. If hosts report the count-only email is not worth
opening, the revisit trigger below is the honest way to reopen it — with the
disclosure that would then be owed to guests, not by quietly adding a field.

**A host-supplied notification address.** Frees the feature from requiring a
Google account, which is adr-014's stated price and the thing most likely to
be resented. It also means owning address verification: an unverified address
is an open relay for one message to anyone, and a verified one is a
confirmation email sent in order to enable a notification email. adr-014 §3
already decided a host without a Google account cannot publish; a host without
one not receiving notifications is strictly smaller than that.

**SMTP with nodemailer to a generic mailbox.** No provider account and no free
tier to outgrow. It also has the worst deliverability of any option — a small
VPS-shaped sender with no domain reputation is the profile spam filters are
tuned against — and it puts a connection-pooled SMTP client in a single-process
server that NFR-7 keeps deliberately simple. The failure mode is silent, which
is the mode this feature can least afford.

**Notifying through the existing metrics/log path only** (i.e. build nothing,
tell the host to check the dashboard). This is the status quo, and it is a real
option given that production has almost no traffic. It is rejected on the
grounds that the dashboard's usefulness is bounded by how often a host thinks
to open it, and no amount of traffic changes that — but see the first revisit
trigger, which takes this seriously enough to gate the whole iteration on it.

## Implementation plan

Six PRs, each independently mergeable, in order:

1. **The prefs table and the reverse lookup.** `notification_prefs`, the
   `keyring_invitation_id` index, and the accessors — enable/disable, read by
   invitation, `last_notified_at`, resolve by unsubscribe token. No sending, no
   routes. Tests: a publish while signed in makes the host a target and an
   anonymous one makes nobody a target, an absent row reads as enabled and
   never notified, disabling drops a host from the targets, a token disables
   exactly its own pair, two hosts on one invitation unsubscribe
   independently, account deletion drops the rows by cascade, and invitations
   and RSVPs survive deletion (FR-11.7 unchanged).
2. **The sender.** `email/send.ts` — one `fetch`, one log line, unconfigured is
   a no-op returning a reason. Strings module with both languages, HTML plus
   plain-text parts. Tests mock the boundary; no test sends mail.
3. **The trigger.** Dispatch after the RSVP response, rate-limited per §4 via
   `countNewSince`. Tests: first reply notifies, a second inside the window
   does not, one after it carries the count since `last_notified_at`, an
   anonymous invitation notifies nobody, a send failure leaves the RSVP intact
   and returns `{ok: true}`.
4. **Unsubscribe.** The token routes, `List-Unsubscribe` headers, and the
   page.

   **`GET` must not mutate.** Mail scanners, corporate link checkers and
   Gmail's proxy all follow links in mail with no human involved, so a `GET`
   that unsubscribed would opt hosts out through their own provider —
   silently, and with nothing to tell them it happened. `GET` renders a
   confirm state with a button; `POST` is the mutation, and RFC 8058's
   one-click posts straight to it. That third state is not in the mockup,
   which was drawn for a done/dead pair.

   The routes live at `/unsubscribe/:token`, **outside `/api`**: the session
   cookie is scoped `Path=/api` (adr-014 §4) and this URL arrives from an
   inbox, so it should carry no session credential to a link a mail provider
   may fetch on the reader's behalf. It also answers HTML where everything
   under `/api` answers JSON. The `POST` takes no origin check, unlike the
   cookie-authorized mutations — a one-click request comes from the provider's
   servers and is cross-origin by definition, and the unguessable token is
   what authorizes it.

   The token is not consumed, so the page is idempotent: a second arrival
   confirms rather than reporting a dead link. Tests: `GET` changes nothing, a
   `POST` stops every invitation the account holds, the form-encoded one-click
   body is accepted, an unresolvable token says so without revealing whether
   it ever existed, and unsubscribing touches no manage token and no keyring
   row.
5. **The share-panel disclosure and switch.** Also the session-authorized
   preference endpoint the switch needs — `GET`/`PUT
   /api/account/notifications/:id`, which is where this feature departs from
   adr-014 §1's rule that the manage token is the authority: the preference
   belongs to an account rather than to an invitation, and two accounts
   holding one invitation share a token but not a preference, so the token
   cannot name whose to change. `/api/auth/session` gains `notifications`, the
   deployment's answer to whether it can send at all. Tests: the line renders
   only when mail is configured *and* the host is signed in, toggling
   round-trips, a session cannot touch an invitation its keyring does not
   hold, and the write takes the adr-014 §4 origin check.
6. **A docs pass** — FR-12, the NFR-4 paragraph, NFR-3/NFR-6, the route table,
   `.env.example`, the deployment runbook's DNS + inbox-placement step, the
   roadmap, and this ADR to accepted.

**PR 6 is not optional and does not come later.** The share loop shipped its
four code PRs, host accounts was taken next, and adr-013's docs pass arrived an
iteration late — recorded in 06-roadmap because the convention is what slipped.
This iteration is the one where that must not repeat, and the DNS records in
PR 6 are operational state that exists nowhere else.

## Notes from implementation

- **The unsubscribe scope was wrong as designed, and the DS pass caught it.**
  §7 originally specified a per-invitation preference, following adr-014 §8.
  RFC 8058's one-click is presented by mail clients as "stop sending me this
  kind of mail"; honouring it for one event leaves a host who runs three still
  receiving mail about the other two, and their second click is **Spam** —
  which costs deliverability for everything the product sends, guests' share
  links included. The preference is account-wide, per-event control is
  deferred with its own trigger below, and §7 was rewritten rather than
  patched. The mockups had already been drawn against the old model, so their
  done-state copy — naming the invitation and promising "your other events are
  unchanged" — had to be replaced with account-scoped copy.
- **`GET` must not mutate**, which the plan did not anticipate. Mail scanners,
  corporate link checkers and Gmail's proxy follow links in mail with no human
  involved, so the obvious single-route design would have unsubscribed hosts
  through their own provider, silently. There are three page states, not the
  mockup's two: `GET` confirms, `POST` mutates. Fastify parses JSON only, so
  the form-encoded one-click body needed a content-type parser — without it
  the `List-Unsubscribe-Post` header advertises a button that `415`s.
- **The routes moved off `/api`.** The session cookie is scoped `Path=/api`
  and the URL arrives from an inbox, so `/unsubscribe/:token` keeps a session
  credential away from a link a mail provider may fetch on the reader's
  behalf. It also answers HTML where everything under `/api` answers JSON.
- **Two tables, not one.** The preference is per account but §4's window is per
  invitation, so `notification_prefs` (keyed by user) and `notification_sends`
  (keyed by user + invitation) are separate. A single row would have made the
  account's answer depend on which invitation was looked at, and would have let
  unsubscribing and resubscribing reset every window.
- **A bug the tests caught, which the design could not have.** `addRsvp` is
  immutable, and the RSVP route was passing the notifier its *pre-reply*
  record — so the count excluded the reply being notified about, which for a
  first reply is zero and therefore no email at all. Only a test through the
  real route finds this; the notifier was correct throughout and the caller was
  not.
- **`countNewSince` could not serve the first email.** It returns 0 without a
  baseline, which is right for the dashboard — "everything is new" tells a host
  nothing on a first visit — and wrong for a first notification, where every
  live reply is news. The first send counts live replies instead.
- **`absoluteBase` was extracted** from `routes/og.ts` into `publicUrl.ts`,
  because the `og:image` host and the manage link in a host's inbox have to
  agree and a drifted copy breaks either one silently.
- **`absoluteBase` now reads `CANONICAL_HOST` instead of the request's `Host`**
  (hardened after a security review of the merged iteration). It originally
  derived the origin from the header, on the grounds that app.ts's redirect hook
  has already turned away every other host by the time a handler runs. True, and
  the wrong thing to depend on: a guest can POST an RSVP with any `Host` they
  like, what this builds is a link that sits in a host's inbox permanently, and
  "safe because something upstream checks it" holds only until the hook moves.
  With the variable set it is the origin; unset — localhost, a test — it still
  derives from the request, which is what keeps development configuration-free.
- **The one-click content-type parser is scoped to the two unsubscribe routes**
  (same review). It was registered on the root instance, which taught every
  endpoint in the app to accept a form body — and form-encoded is the only thing
  a cross-site HTML form can post, so the `415` the rest of the app answers
  those with is a free layer beneath `SameSite=Lax` and adr-014 §4's origin
  checks. Parsers are encapsulated, so the fix is a plugin wrapper and one
  `await` in app.ts. This feature needs exactly one exception and now takes
  exactly one.
- **Both surfaces shipped before their mockups**, recorded in §10. The
  unsubscribe page did not: it was designed first, as the convention intends,
  and neither did the account footer below.
- **The switch had no durable home, and production found it before we did.**
  §7 answered "where is this disclosed" and never "where does it live", so the
  control shipped reachable only from the post-publish share sheet — visible
  once, then unreachable, leaving the email footer as the only way out. Fixed
  by the account-footer line (DS `LandingAccountNotify`), with §7 amended so
  the next preference does not repeat it. The design pass answered the
  placement question in full: the footer already carried two account facts that
  merely fitted on one line, so the rule was never "one thing" but "the
  account"; the alternatives each failed for a reason (a row in the list reads
  as another invitation, a line beside "delete account" puts the routine next
  to the irreversible, and `/manage/:id` is an event surface for an
  account-level setting).
- **"Delete account" deliberately did not move** with it. The split is by
  consequence rather than by topic: inside the card are the things a host can
  press and change their mind about; outside it, in the page's quietest colour,
  is the one that opens a confirmation. Collecting all account controls in one
  block is the path to the settings screen this ADR keeps refusing.
- **Bundle cost: +0.71 kB gzipped** (88.20 → 88.91), recorded under NFR-1.

### Amended 2026-08-02 — reply email is opt-in

Two days after this shipped. §7's first bullet said **default on**; it is now
default off, and a host asks at publish.

- **The reason is deliverability, not consent.** The consent case for opt-in is
  weak and this ADR's original argument against it still holds: transactional
  mail to the account owner's own verified address about their own event,
  disclosed where it is caused, off in one click. What reversed it is that
  `invinto.app` is an unwarmed sending domain with no reputation.
  [05-deployment.md](../05-deployment.md) already flags Ukrainian inbox
  placement as the one claim to verify rather than reason about, and a spam
  press on mail nobody asked for costs inbox placement for **everything the
  product sends** — including the share links guests unfurl, which
  [07-monetization.md](../07-monetization.md) §3 calls the only affordable
  acquisition channel. §7 weighed one host's surprise; it did not weigh the
  sending domain.
- **The invariant inverts, and it was load-bearing.** "Absence of a row means
  enabled" was chosen so a default that is never written cannot drift from one
  that is. That property is kept and the default flipped: the eligibility join
  requires `enabled = 1`, and `ensurePref` mints a row that is *off*. Nothing
  that merely touches the row can start mail — only `setNotificationsEnabled`
  can. Accounts with no row go from on to off with no migration, which at this
  scale is a choice rather than an oversight.
- **The choice moved rather than the default merely flipping.** A switch a host
  has to go and find is a switch nobody finds, and this ADR exists to close a
  latency gap *"without the host thinking to check"*. The share panel already
  rendered the block at publish; it stops reporting a default and starts
  asking. "Turn emails back on" is gone from every surface: under opt-in
  nothing can tell a host who turned mail off from one who never asked, and
  "back on" is false for the second.
- **`/manage/:id` now carries the control, which the notes above rejected.**
  That objection — *"an event surface for an account-level setting"* — is not
  overturned; it is outweighed, and it was decided under a different default.
  With mail arriving by default the dashboard needed nothing: a host knew the
  feature existed because they had received it, and the account footer was
  enough to stop it. Under opt-in a host who declined at publish has no signal
  the feature exists at all, and the dashboard is exactly where they go when
  wondering about replies. The objection survives as the constraint on the
  design rather than as a veto: the control **says in words that it covers
  every invitation in the account**, because a switch that looks per-event and
  acts account-wide is how a host silences three events by accident and
  presses Spam — the outcome this amendment exists to avoid.
- **Per-event control is still deferred**, with the trigger below intact. It
  did not become more attractive; the scope line is a disclosure, not a
  substitute.

## Revisit triggers

- **Before PR 1: is this the right iteration at all?** adr-013 shipped the
  measurement 07-monetization §5.1 gates every commercial option on, and it
  needs traffic rather than features. If the honest read is that nobody is
  publishing enough for a notification to matter, the right move is to say so
  and stop — the rejected alternative above is real, and this ADR is proposed
  rather than accepted for that reason.
- **A host asks to silence one event without silencing the rest** — most
  likely someone running several at once, where one has gone quiet and another
  has not. This is the deferred half of §7 and the most probable of these
  triggers to fire. It arrives as an `invitation_id` on the prefs row and a
  scope on the token; what it must **not** do is narrow what
  `List-Unsubscribe` points at, which stays account-wide whatever else is
  added, because that header answers to the mail client's promise rather than
  to ours.
- **A host asks for the guest's name in the email.** Reopens §3, with the
  guest-side disclosure that would then be owed.
- **A host asks to be notified without a Google account.** Reopens §1 and puts
  pressure on adr-014 §3, not on this ADR.
- **Notifications land in spam for Ukrainian providers** despite correct
  SPF/DKIM/DMARC. Reopens §6's provider choice, which §6 is deliberately
  structured to make a one-module change.
- **The window is wrong in practice** — hosts describing the first email as too
  slow, or a busy invitation producing more mail than expected. It is an env
  var (`NOTIFY_WINDOW_MINUTES`), so the first correction is not a deploy, on
  the adr-008 and `PUBLISH_REQUIRES_ACCOUNT` precedent.
