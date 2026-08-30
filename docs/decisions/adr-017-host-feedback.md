# ADR-017 — A feedback channel from the host to us

**Status:** accepted · **Date:** 2026-08-09 · Lands as **FR-14**.
**Numbered 017, not 016**: this was drafted as adr-016/FR-13 while
[adr-016](adr-016-public-discoverability.md) was being built on another branch,
and the two claimed the same pair of ids. Discoverability merged to `main`
first, so it keeps them and this record moved — an id that has shipped is a
reference other documents already carry, and the unmerged branch is the cheaper
of the two to renumber. Nothing about either decision changed. Reads the
posture [06-roadmap](../06-roadmap.md) has now stated five times — that
building for hosts who are not here yet is this project's failure mode — and
argues that this is the one item on the list that gets *smaller* rather than
larger the fewer hosts there are.

## Context

The product has, lifetime: 21 generations, 12 publishes, 11 RSVPs, 6
guest-page views, 0 referred generations. `views_per_publish` is 0.5 and
`new_hosts_per_publish` is 0. [07-monetization](../07-monetization.md) §5.1
gates every commercial option on the second of those numbers, and at this n
neither is readable. The share sheet (FR-3.6) shipped 2026-08-08 against the
most plausible mechanical cause of the publish→view gap, and the roadmap's
closing position is that the next thing to read is whether that number moves.

That position is right and this ADR does not disturb it. What it observes is
that **the product has no way to be told anything.** Every signal it has is a
counter it increments about itself. When two invitations are published in six
days and neither is opened, `metrics.ts` can say that it happened and cannot
say why — whether the host never sent the link, sent it and nobody tapped,
sent it to four people who all attended anyway, or published a test. Those
four have completely different responses and the instrument cannot separate
them.

There is a second, sharper gap. [adr-014](adr-014-host-accounts.md) §2 put a
sign-in in front of publishing and took a recorded risk in doing so:
[adr-005](adr-005-capability-tokens.md) argued that signup before demonstrated
value kills the funnel. The gate's cost is measured by `publish_rate` against
a frozen baseline — 0.6 post-gate against 0.47 before, which on three
publishes is noise — and **a host who bounces at the Google button leaves no
trace at all beyond a generation that never became a publish.** The one person
whose opinion would settle adr-014's revisit trigger is precisely the person
the product currently cannot hear from.

Four earlier decisions bound what a feedback channel is allowed to be:

- **No third-party analytics, no cookies for measurement**
  ([adr-013](adr-013-share-loop-instrumentation.md) §6, NFR-4). Whatever this
  is, it is ours, in our process, on our volume.
- **The server must not learn which invitations belong to one person**
  beyond what the keyring already records (adr-005,
  [adr-012](adr-012-batch-response-counts.md) §3, adr-013 §3). A feedback row
  carrying an invitation id would rebuild that graph through the side door.
- **The guest experience never degrades for something that serves the host**
  (07-monetization §5.2, applied by adr-013 §6). A guest is somebody else's
  invitee; the product does not get to interview them.
- **INVITO stays a whisper** (`styles.css`, upheld by adr-013 §6 against four
  louder treatments of the guest CTA). Feedback is chrome, and chrome does not
  compete with the invitation.

## Decision

### 1. One message, one direction, no inbox

A host writes free text and sends it. There is no thread, no reply inside the
product, no status, no ticket id, no attachment, no rating scale. The row is
`(id, message, page, lang, user_id?, created_at)` and nothing else.

The alternative — a support inbox — is a product with staff. What this needs
to be is the smallest thing that turns a host's sentence into something an
operator can read later, and the honest scope is "a suggestion box nailed to
the wall". Anything more would be building for hosts who are not here yet,
which is the thing this ADR is answerable to.

**No rating scale, specifically.** A 1–5 star widget produces a number at this
volume that means nothing — 12 publishes cannot support an average — while
costing the one thing the free-text box is for, which is a sentence nobody
predicted. Numbers are what the product already has too many of.

### 2. Anonymous-capable, account-attributed when there is an account

Sending requires no session. If a session cookie is present the row records
`user_id`; if not, the row is anonymous and stays anonymous forever.

This is the whole point rather than a convenience. **The hosts most worth
hearing from are the ones who are not signed in** — §2's bounce at the publish
gate is invisible by construction, and a feedback form that required an
account to submit would collect answers only from people who already got past
the thing being asked about.

We do **not** offer a "your email (optional)" field. adr-014 §3 holds one
identity, Google-verified, scope `openid email`; a typed-in address would be a
second identity channel with no verification, collected on a page that
promises nothing, and NFR-4's claim about what the product holds would have to
be rewritten for a reply we may never send. The rule is stated to the host in
one line: signed in, we can write back; signed out, we cannot. Both states say
so before they send, so nobody discovers it afterwards.

### 3. Context is captured, never asked, and is a closed enum

The row carries `page` (`landing` | `manage`) and `lang` (`uk` | `en`). Both
are known without asking, both are closed enums in `schemas.ts`, and neither
identifies anything.

`page` separates the two populations that can write: somebody looking at the
product and somebody running a live event. `lang` says which audience is
speaking, which matters for a product whose whole thesis is Ukrainian-first
and whose interface is bilingual.

**No invitation id, no URL, no referrer, no IP, no user agent.** An invitation
id is the exact edge adr-012 §3 and adr-013 §3 both refused to store, and it
would arrive here attached to free text — a worse version of the same graph. A
raw URL is an invitation id wearing a coat. This follows adr-013 §3's form
deliberately: a closed enum, not an identifier, for the same reason and with
the same consequence (the data cannot be decomposed into who).

### 4. It lives on the two durable host surfaces, and not in the editor

The trigger renders in the landing footer and at the bottom of `/manage/:id`.
It is a text link, not a floating button, not a slide-in, and never appears
uninvited.

The editor is deliberately excluded. `/create` is the three-second path the
entire product is built around (01-vision, NFR-1), and it is the one screen
where the host is doing the thing rather than considering it. A feedback
prompt there competes with the single action the page exists for. This is the
same reasoning adr-015 §7 used to keep a settings screen from existing, and
the cost is stated plainly: **the feedback we would most like — from somebody
stuck mid-generation — is the feedback this placement does not collect.** It
is a revisit trigger below rather than a silent omission.

The guest page is excluded on the constraint above: a guest came for somebody
else's wedding, and asking them what they think of our product inside a
personal invitation is the loud treatment adr-013 §6 already rejected in a
milder form.

### 5. Rate-limited per IP, on the guardrails mechanism, and nothing else

One new allowance in `guardrails.ts`: `LIMIT_FEEDBACK_PER_DAY`, default 5, 0
disables, consumed on admission exactly like the LLM tasks.

That module is named for operator *cost* and this endpoint spends no tokens,
so the reuse is worth justifying: what it implements is "a per-IP daily
allowance with a UTC rollover", which is precisely the control needed, and a
second copy of that logic in another file would be two places to fix a
rollover bug. The cost being guarded is real, merely not measured in dollars —
it is the operator's attention and the table's size.

**No CAPTCHA and no third-party spam service.** Both are external
dependencies on a form that, at this traffic, will receive single-digit
submissions; the allowance plus a 2000-character cap is proportionate, and if
it turns out not to be, the answer is a smaller number in an env var rather
than a deploy (the adr-008 precedent).

### 6. The operator reads it over a token-gated endpoint, and there is no admin UI

`GET /api/feedback` returns the rows, newest first, authorized by
`x-feedback-token` compared in constant time against `FEEDBACK_TOKEN`.
**Unset means the endpoint answers 404** — not 401, not 503: a deployment that
never configured a reader should not advertise that a reader exists. This
follows the keyless-boot convention (NFR-3, adr-014 §7, adr-015 §8) in the one
direction that also costs an attacker information.

There is no admin page, no login for it, no pagination UI. An operator with
`curl` and the token has everything; building a screen for an audience of one
is the definition of the failure mode this iteration is answerable to.

The response joins the account's email off `users` for attributed rows, in the
same shape adr-014 §1 established for the keyring: **the join is the exposure,
and it happens at read time behind a credential**, so the feedback table
itself holds no address and is worthless if lifted alone.

### 7. The message is stored in exactly one place, and the log line is metadata only

Each submission emits one JSON log line — `event: "feedback"` with the row id,
`page`, `lang`, whether it was attributed, and the message *length* — and
never the message body.

The body lives in the table and nowhere else. Logs on the hosting platform
have a different retention, a different access path and a different deletion
story than the volume does, and a host's sentence about their event should
have one copy that one `DELETE` removes. This is the same instinct adr-006
applied to BYOK keys, applied to something less secret and more personal.

### 8. Deleting an account detaches feedback; it does not delete it

`feedback.user_id` is `ON DELETE SET NULL`, not `CASCADE`.

adr-014 §9 settled that deleting an account removes the account and not the
work — invitations and RSVPs survive because guests hold links and the RSVP
rows are the guests' data. Feedback is a third case and lands the same way for
a different reason: **the message is about the product, and the identity is
incidental to it.** A host who deletes their account has withdrawn from the
product, not retracted what they told us about it; erasing the sentence would
throw away the only signal this iteration exists to collect, while keeping the
name attached to it would ignore what they just asked for. Detaching keeps
both promises, and it is why the column was nullable to begin with (§2) rather
than made nullable for this.

## What this is not

- **Not a metric.** Nothing here increments `metrics.json` and nothing appears
  on `/api/metrics`. A counter of feedback rows could only ever agree with
  `SELECT COUNT(*)` over the table, and metrics.ts is the funnel — generations,
  publishes, views, referrals — not an activity log. Adding a counter that
  restates a table is two sources of truth for one number, which is the fault
  adr-012 §3 named in a different context.
- **Not an NPS instrument.** See §1.
- **Not a moderation surface.** The table is readable by an operator and
  nothing acts on its contents automatically.
- **Not a support commitment.** The UI never promises a reply, in either
  state. Signed in it says we *can* write back, which is true; it does not say
  we will.

## Rejected alternatives

- **A `mailto:` link in the footer.** Free, no table, no endpoint, no rate
  limit — genuinely the smallest thing that could work, and it was the leading
  option for most of this decision. It loses on the population §2 exists for:
  a `mailto:` opens a mail client, which on a phone means leaving the product
  and composing from an address the host has to think about, at precisely the
  moment they were annoyed enough to say something. It also collects the one
  identifier this ADR spent §2 refusing to collect, from everybody, as a
  condition of speaking.
- **A third-party widget** (Canny, Usersnap, a Google Form). Zero code, and
  rejected on NFR-1 and NFR-4 together: a script tag on the landing page for a
  form with two fields, and every submission — including the free text —
  landing in somebody else's database. adr-013 §6 declined third-party
  analytics for a *counter*; this is more than a counter.
- **A feedback prompt after publishing**, in the share panel beside the notify
  control. The strongest rejected option, because it is the moment of highest
  engagement and adr-015 §7 makes exactly this argument for the notification
  choice. It loses because the share panel is already the product's most
  crowded moment — publish, share sheet, copy, manage link, notification
  choice, and adr-010 §3's filled-accent rule holding it together — and
  because feedback asked at the top of the funnel's happy path selects for
  hosts who just succeeded. The trigger below covers the case where the
  landing footer collects nothing.
- **Attaching the invitation the host was looking at.** Would make a bug
  report actionable in one step. Rejected under §3: it is the host graph, and
  the debugging value is not worth reversing three ADRs by accident.
- **A `POST` that also emails the operator** on every submission, reusing
  `email/send.ts`. Tempting and nearly free. Rejected because it makes the
  feedback path depend on the mail transport being configured, and because
  adr-015 §5's "never blocks, never fails" discipline would have to be
  repeated here for a message nobody is waiting on. An operator who wants a
  ping can poll the endpoint.

## Consequences

- The first table in the product that stores **user-authored prose** rather
  than identifiers, tokens and counts. NFR-4's statement of what the product
  holds gains a line, and §7 and §8 are what keep that line short.
- The first endpoint authorized by an **operator** credential rather than a
  host's. It is one constant-time comparison against an env var and is
  invisible when unset (§6), but it is a new class of access and is recorded
  as one.
- `guardrails.ts` now guards something that is not an LLM call (§5). Its
  header comment says so; the module was not renamed, because "operator-cost"
  remains true of everything else in it and a rename would touch four call
  sites to relabel one.
- A deployment with no `FEEDBACK_TOKEN` collects feedback that nobody reads.
  That is a real failure mode and it is why the token is in `.env.example`
  beside the feature rather than in a runbook.

## 9. Design pass (E-invitation DS templates) — done, and it came after the code

Per adr-009 §4 and adr-010 §9. The mockup is `templates/feedback-sheet` in the
E-invitation DS project — `FeedbackMain`, `FeedbackStates`, `FeedbackSpec` —
and it **landed after implementation, not before**. That is a departure from
the rule, and the interesting part is not the departure but what it caught.

The skip was justified on the precedent FR-11.10 and FR-3.6 set: adr-010 §9 is
written for substantial new surfaces, and this is a text link in two footers
opening the `ag-*` sheet shell that three other moments already use. **That
reasoning was two-thirds right.** The composition really was covered by
precedent — no new container, no new screen, no new state machine. But the
field and the button *inside* the borrowed shell were new, and all three of
their departures from the system survived code review:

| Shipped in the first commit | Corrected |
|---|---|
| `.fb-input` border `#ddd6c8` | `#e4ddd0` — `#ddd6c8` is `.ag-google`'s **button** border, not any field's |
| Focus as a 3px `box-shadow` glow ring | Border thickening with compensating padding — the app's one focus idiom (`.gr-input:focus`) |
| `.fb-send` at `height: 54px` | `56px`, i.e. `.ag-retry` exactly — a third button height inside the same sheet meant nothing |

The field is now `.gr-input` + `.gr-note` value for value, and the button is
`.ag-retry` plus a disabled state. `FeedbackSpec` records both derivations so
the next surface does not re-derive them.

**The honest lesson for the precedent**, which FR-11.10 and FR-3.6 both invoke
and which the next iteration will invoke again: those two really did add no new
values — one muted text link, one button that already existed in the panel
beside it. This one reused a *container* and drew new *contents*, and the rule
catches exactly that. The test for skipping design-first is not "is the shell
already there" but **"does anything inside it need a value that is not already
written down"**. In mitigation, the app already carried three unrelated field
treatments before this (`.gr-input`, `.hm-paste`, and two editor `textarea`
rules), so what happened here widened existing drift rather than breaking a
clean system — which is a reason to keep the spec card, not a reason to relax
the rule.

The `.design-sync` **component pipeline stays untouched** — no re-sync, no
`dtsPropsFor` or `conventions.md` edit — on adr-010 §9's own precedent: that
pipeline's trigger is a change to token enums, copy fields or
`InvitationPreview`'s props, and this iteration changes none of the three. The
templates are reference mockups only.

**The mockups that predate the rename keep the old name, and now say so.**
`templates/feedback-sheet` was authored after
[adr-016](adr-016-public-discoverability.md) §9 and uses INVINTO, but the
eleven template sets before it still render INVITO and `invito.ua`. Sweeping
them was considered and **rejected on §9's own rule** — *"earlier records are
left as written… rewriting a quotation to match a later decision would make the
record say something it did not say"* — which is the same reason adr-013 and
06-roadmap keep their INVITO quotations. §9 gives those two a pointer here
instead; the design project had no equivalent, so this iteration added one:
`templates/brand-name/BrandName.dc.html`, a card stating the current name, the
former one, and that a mockup dated before 2026-08-09 is to be read with the
wordmark and domain substituted. One card rather than fifty rewrites, and the
records stay records.

## Revisit triggers

- **The landing footer collects nothing for a month while hosts are clearly
  frustrated elsewhere** — most likely visible as generations that never
  publish. Reopens §4's exclusion of the editor, which is the placement this
  ADR knows it is giving up.
- **Somebody sends feedback that needs a reply and is signed out.** This is
  §2's stated cost arriving. The fix is not an email field: it is that the
  answer, if there is a common one, belongs in the product where the question
  was asked.
- **Spam arrives.** §5's allowance is an env var first. A second occurrence,
  or anything automated, reopens the CAPTCHA question — and the honest
  sequence is allowance → shorter cap → a human deleting rows → only then a
  dependency.
- **The operator stops reading it.** The most likely quiet failure. If the
  endpoint goes unread for a month, the feature is theatre and should be
  removed rather than left as an unanswered box — which is worse for a host
  than no box at all.
- **Volume outgrows `curl`.** Reopens §6's no-admin-UI decision, and not
  before. The threshold is somebody genuinely losing track of a message, not
  aesthetics.
