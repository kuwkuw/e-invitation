# 02 — Functional requirements

IDs are stable; reference them in PRs and ADRs. "Status: built" means
implemented and covered by the current code; file references point at the
implementation.

## FR-1 Generate invitation from one sentence

**Status: built** — `POST /api/invitations/generate`
([routes/invitations.ts](../server/src/routes/invitations.ts),
[pipeline/generate.ts](../server/src/pipeline/generate.ts))

- FR-1.1 Input is a single free-text sentence, 1–500 chars (`GenerateRequest`).
- FR-1.2 The system extracts a structured `EventBrief`: event type, hosts,
  date, time, venue, city, tone, language, extra details. Facts absent from the
  sentence are `null` — never invented.
- FR-1.3 From the brief the system produces, **in parallel**, the invitation
  copy (6 fields: title, greeting, body, details_line, rsvp_prompt, closing)
  and the design tokens (palette, typography, layout, ornament).
- FR-1.4 The response is a complete `Invitation` JSON (brief + copy + design);
  the client renders it immediately as an editable preview.
- FR-1.5 The copy is written in the language of the input sentence
  (`EventBrief.language`, `uk` or `en`).
- FR-1.6 If all routed models fail, respond `502` with a user-safe error.
- FR-1.7 When the resulting brief carries no date a calendar can read — absent,
  or written too vaguely to yield a day ("у вересні") — the editor chat asks the
  host for one, once, after the invitation appears
  ([useInvitationEditor.ts](../web/src/hooks/useInvitationEditor.ts)). The test
  is the same `parseEventStart` the guest page uses, because a date that fails
  it is exactly the date that hides add-to-calendar there (FR-4.5) — and FR-1.2
  plus the copy stage's write-around-it rule otherwise leave the host with a
  card that looks complete. The prompt never blocks generating or publishing: a
  save-the-date without a day is a valid invitation.

## FR-2 Edit and regenerate per field

**Status: built** — `POST /api/invitations/regenerate-field`
([pipeline/copy.ts](../server/src/pipeline/copy.ts), [App.tsx](../web/src/App.tsx))

- FR-2.1 Every copy field is directly editable in the UI; edits are local state
  until published.
- FR-2.2 Any single copy field can be regenerated: request carries the brief,
  the field name, and the current value; response is one rewritten value.
- FR-2.3 Whole-invitation regeneration is intentionally not offered
  (see [decisions/adr-004-per-field-regeneration.md](decisions/adr-004-per-field-regeneration.md)).
- FR-2.4 Each regeneration is counted per field for the regenerate-rate metric.

## FR-3 Publish & share

**Status: built** — `POST /api/invitations/publish`
([store.ts](../server/src/store.ts))

- FR-3.1 Publishing snapshots the current invitation and returns `{id, version,
  manage_token}`. The share URL is `/i/:id`.
- FR-3.2 Republishing (same `id` + valid `manage_token`) appends a new
  **version**; the guest page always serves the latest version. Old versions
  are retained.
- FR-3.3 The `manage_token` is the only host credential (capability token — no
  accounts). The web client stores it at publish under `inv-manage:<id>` and
  reads it back at `/manage/:id` (FR-5.4), so host access outlives the editor
  session that published it.
- FR-3.4 A fresh generation in the editor detaches from any previously
  published link (new event → new link).
- FR-3.5 OG image for messenger link unfurling: `GET
  /api/invitations/:id/og.png` renders a 1200×630 PNG server-side from the
  design tokens ([render.ts](../server/src/og/render.ts)); `GET /i/:id` serves
  the SPA shell with `og:*` meta injected for crawlers.

## FR-4 Guest page & RSVP

**Status: built** — `GET /api/invitations/:id`,
`POST /api/invitations/:id/rsvp`, `POST /api/invitations/:id/view`
([GuestPage.tsx](../web/src/GuestPage.tsx))

- FR-4.1 The share link renders the published invitation publicly — no
  authentication, no registration.
- FR-4.2 The public payload contains only the latest invitation version: never
  the manage token, never other guests' RSVPs.
- FR-4.3 A guest RSVPs with: name (≤100 chars), attending yes/no, party size
  1–10, optional note (≤500 chars).
- FR-4.4 RSVPs append to the invitation record and are never mutated or
  removed — a guest changes their mind by submitting again. Collapsing those
  re-submissions is a read-time concern of the host view (FR-5.5), so the
  stored record stays a full history.
- FR-4.5 After an attending RSVP the guest can download an `.ics` calendar
  event built client-side from the brief ([calendar.ts](../web/src/calendar.ts)):
  best-effort bilingual parsing of the free-text date/time (all-day without a
  time, 2 hours with one); the action is hidden when no date parses.
- FR-4.6 A share link that cannot resolve — unpublished, deleted, truncated in
  a chat app, or otherwise malformed — renders the dead-link state, never the
  marketing page. An id that cannot be one the server minted is answered
  without a request, since there is nothing to ask about
  ([adr-011](decisions/adr-011-client-router.md) §3).
- FR-4.7 The guest page carries exactly one link back to the product
  ([GuestCta.tsx](../web/src/components/guest/GuestCta.tsx),
  [adr-013](decisions/adr-013-share-loop-instrumentation.md) §7): the INVITO
  wordmark plus one muted line, below the reply card, in the guest's chrome
  language (FR-6.3), present in both the form and post-RSVP states. It links to
  `/create?ref=guest` and never becomes a modal, a card, or an accent-coloured
  action — the guest experience must not degrade for it, since that experience
  is what makes the link worth having ([07-monetization.md](07-monetization.md)
  §5.2). One placement, not two: measuring one yields a number, measuring two
  yields neither.

## FR-5 Host views responses

**Status: built** — `GET /api/invitations/:id/rsvps`,
`POST /api/invitations/counts`,
[adr-010](decisions/adr-010-host-manage-link.md),
[adr-012](decisions/adr-012-batch-response-counts.md),
[ManagePage.tsx](../web/src/ManagePage.tsx)

- FR-5.1 Requires the `x-manage-token` header matching the record's token
  (constant-time comparison).
- FR-5.2 Returns the full RSVP list plus aggregate counts: yes, no, and total
  guests among attendees. Counts cover the live answers only (FR-5.5).
- FR-5.3 The dashboard exports the list as CSV, built client-side from the
  fetched data ([csv.ts](../web/src/csv.ts)): UTF-8 BOM (so Excel reads
  Cyrillic), localized headers/answers, guest count blank on declines, and a
  status column marking superseded rows — every row is exported, so the file
  is a full record.
- FR-5.4 **Durable host access.** `/manage/:id` is a read-only response
  dashboard ([useHostManage.ts](../web/src/hooks/useHostManage.ts)), composed
  from the public invitation endpoint plus the token-gated RSVP one. The token
  resolves in order: `#t=` URL fragment → `localStorage` → an empty state
  asking the host to paste their manage link. A fragment token is persisted
  and then stripped from the URL; it rides the fragment and never the query
  string, so the credential stays out of server logs and referrer headers.
  Missing token, refused token (`403`), unknown invitation (`404`) and network
  failure are four distinct states with their own wording, and the two
  recoverable ones share one way out.
- FR-5.5 **Re-submissions collapse per guest.** At read time the server groups
  entries by normalized name (trimmed, inner whitespace collapsed,
  case-folded); the latest `created_at` is live, earlier ones are flagged
  `superseded` and excluded from the counts. The full list is still returned
  and the dashboard shows a superseded answer as history beneath the live one.
  Only an exact name match collapses, so two guests sharing a name stay
  visible as two rows rather than silently merging.
- FR-5.6 The share panel offers the manage link as an explicitly subordinate,
  masked action beside the public share link, and the landing page lists the
  invitations published from this browser (`inv-invitations`, browser-local,
  no secrets) so a returning host finds their events by name.
- FR-5.7 **Per-row response counts on the returning-host list.**
  `POST /api/invitations/counts` ([adr-012](decisions/adr-012-batch-response-counts.md))
  answers a batch of `{id, token, seen_at?}` items — the app's first request
  carrying more than one capability token. Each item is authorized on its own
  id through the same constant-time compare (FR-5.1), so the response is a
  per-item `status` (`ok`/`forbidden`/`not_found`) and a stale token blanks
  only its own row: the batch is a normal `200` even when every item fails,
  and a `400` is reserved for a malformed or over-cap (>25) body. An `ok`
  result carries the same live-answer `counts` as FR-5.2 (never the RSVP list)
  plus `new_since` — live answers newer than the client's `seen_at` baseline,
  0 when it is absent, computed by the same rule the dashboard uses. Response
  is `no-store`. The landing list renders synchronously from `localStorage`
  ([useHostInvitationCounts.ts](../web/src/hooks/useHostInvitationCounts.ts))
  and fills counts in after: no spinner, no layout shift, and a failed fetch
  is silent — rows show their reply count and a "new" marker where a token
  checked out, and stay plain title/time rows where it did not.

## FR-6 Bilingual UI

**Status: built** — [i18n.ts](../web/src/i18n.ts)

- FR-6.1 The landing page, editor, and guest page each toggle between
  Ukrainian and English (`LangSwitcher`; host surfaces share the persisted
  choice).
- FR-6.2 UI language is independent of invitation copy language (FR-1.5): a
  host can drive an English UI while producing a Ukrainian invitation.
- FR-6.3 On the guest page the toggle switches chrome only and defaults to
  the invitation's language; invitation text is host content and is never
  translated by the switcher.

## FR-7 Operational metrics

**Status: built** — `GET /api/metrics` ([metrics.ts](../server/src/metrics.ts))

- FR-7.1 Expose counters: generations, per-field regenerations, backgrounds,
  publishes, RSVPs, and the derived regenerate-rate and publish-rate.
- FR-7.2 Counters persist to `DATA_DIR/metrics.json` (write-then-rename, same
  discipline as the store) and reload on boot, so the KPIs survive restarts
  and deploys. A missing or corrupt file starts them fresh. A counter absent
  from an older file starts at zero rather than resetting the file, so adding
  one never discards history — the whole value of these numbers is that they
  are measured over months.
- FR-7.3 Share-loop counters
  ([adr-013](decisions/adr-013-share-loop-instrumentation.md)):
  `invitation_views` counts guest-page views, and `referred_generations` counts
  generations that arrived from a guest page. Both are **global** — nothing is
  counted per invitation, and no host-facing surface shows reach.
- FR-7.4 The derived `views_per_publish` and `new_hosts_per_publish` accompany
  them. The second is the datum [07-monetization.md](07-monetization.md) §5.1
  gates every commercial option on; when publishing is gated on an account
  (FR-11.5) the baseline block reports it before and after the gate, since the
  gate moves the denominator for reasons unrelated to the share loop
  ([adr-014](decisions/adr-014-host-accounts.md) §7).
- FR-7.5 A view is counted by a beacon the guest page fires after a successful
  load, once per browser per invitation — never from the server-rendered
  `GET /i/:id`, which serves messenger crawlers (FR-3.5) and would count
  unfurls instead of guests. A dead link is not a view. "Unique" therefore
  means "unique browser that has not cleared storage", so the number floats
  high, consistently, by design (adr-013 §2).

## FR-8 BYOK — host's own AI key

**Status: built** — [adr-006](decisions/adr-006-byok-passthrough.md),
`x-llm-provider`/`x-llm-key` headers on the two LLM-backed endpoints

- FR-8.1 A host can save their own provider API key (Gemini, Anthropic, or
  OpenAI) in the editor; it is stored in the browser only and sent as
  headers on generate/regenerate requests.
- FR-8.2 The server uses the key transiently for that request's LLM calls:
  never persisted, never logged (log lines carry only `byok: true`).
- FR-8.3 A BYOK request's model walk is restricted to the key's provider —
  it never falls back onto operator keys.
- FR-8.4 Without the headers, operator-key routing applies unchanged.

## FR-9 Operator-cost guardrails

**Status: built** — [adr-008](decisions/adr-008-operator-cost-guardrails.md),
[guardrails.ts](../server/src/guardrails.ts)

- FR-9.1 Non-BYOK requests to the two LLM-backed endpoints are subject to a
  per-IP daily allowance (defaults: 10 generations, 30 regenerations per UTC
  day); over-limit requests return `429` with a user-safe message.
- FR-9.2 A daily global budget (`DAILY_BUDGET_USD`, default 5) caps operator
  LLM spend using the gateway's per-request cost estimates; once exhausted,
  operator-key requests return `503` until the next UTC day.
- FR-9.3 BYOK requests (FR-8) bypass both guardrails — they spend the
  caller's key. The web client maps `429`/`503` to a bilingual message
  pointing at the BYOK panel.
- FR-9.4 `GET /healthz` reports the configured limits and today's estimated
  spend.

## FR-10 Optional AI background layer

**Status: built** — [adr-009](decisions/adr-009-ai-background-layer.md),
`POST /api/invitations/background`, `GET /api/backgrounds/:id`
([imageGen.ts](../server/src/llm/imageGen.ts))

- FR-10.1 From the editor, a host can add an AI-generated background image to
  an existing invitation. The server builds the image prompt from the brief +
  design tokens (explicit no-text instruction), calls `gemini-2.5-flash-image`
  (single model, no fallback), and stores the PNG under `DATA_DIR/backgrounds`.
- FR-10.2 The invitation carries only an opaque `background.id`; the client
  composites `GET /api/backgrounds/:id` under the deterministically rendered
  copy with the DS-specified palette-tinted scrim. Text colors never change.
- FR-10.3 Regenerating replaces the reference; removing reverts to the
  CSS-only card; failure leaves the invitation untouched. The `minimal`
  palette rejects backgrounds (server and UI).
- FR-10.4 Guarded per adr-008: `LIMIT_BACKGROUNDS_PER_DAY` per IP (default 3)
  and $0.039/image against the daily budget. BYOK: Gemini keys only.
- FR-10.5 The OG share card stays token-only (v1 decision, adr-009 §7).

## FR-11 Host accounts

**Status: built** — [adr-014](decisions/adr-014-host-accounts.md),
`/api/auth/*`, `/api/account/*` ([accounts.ts](../server/src/accounts.ts),
[routes/auth.ts](../server/src/routes/auth.ts))

The first reversal of part of [adr-005](decisions/adr-005-capability-tokens.md).
An account is a **keyring, not an owner**: the `manage_token` remains the
credential every host-facing endpoint checks, and a session's only new powers
are reading back the tokens it holds and authorizing a first publish.

- FR-11.1 A host signs in with Google (OpenID Connect, authorization code +
  PKCE, scopes `openid email`). The account keys on the Google `sub`; the
  verified email is stored as data, never as identity. No password, no profile
  data, no other provider.
- FR-11.2 The session is an opaque id in an httpOnly `SameSite=Lax` cookie
  scoped to `Path=/api`, so it never rides `GET /i/:id` or the OG image
  request. Sign-out revokes it server-side, not just in the browser.
- FR-11.3 `GET /api/account/keyring` returns every invitation the account has
  published, with its manage token, title, publish date and palette — what
  `localStorage` would hold had this browser never been cleared. The client
  seeds `inv-manage:<id>` and `inv-invitations` from it, so every other host
  surface is unchanged.
- FR-11.4 Publishing while signed in links the invitation to the account.
  Republishing links too, which is how a host claims an invitation they first
  published anonymously.
- FR-11.5 A **first** publish requires an account when
  `PUBLISH_REQUIRES_ACCOUNT` is on (default once OAuth is configured).
  Generating, editing, per-field regeneration, backgrounds and the entire
  guest side stay anonymous. Republishing with a valid manage token is **never**
  gated — everything already published keeps working forever, signed in or not.
- FR-11.6 With no OAuth client configured, the server boots and publish stays
  anonymous; `GET /healthz` reports `auth.google` and `auth.publish_gate`
  separately. The client shows no sign-in affordance at all in that mode.
- FR-11.7 `DELETE /api/account` removes the user, their sessions and their
  keyring, and **not** the invitations they published or the RSVPs guests left:
  guests' share links must not break, RSVP rows are the guests' data, and the
  manage token survives on the record. The response reports how many
  invitations were retained.
- FR-11.8 Sign-out and deletion both leave this browser's manage tokens in
  place — neither revokes a capability the host held before signing in.
- FR-11.9 The gate is the first frame of the share sheet, not a separate
  screen: the invitation stays visible, and the editor's draft is parked before
  the redirect and restored on return, so a host comes back to exactly what
  they left. Declining at Google is a distinct, non-error state from a failed
  handshake, which carries a coarse `state`/`exchange`/`identity` class for
  support.
- FR-11.10 The returning-host list is served from the keyring for a signed-in
  host, laid over what this browser already knew and without a reload: an event
  published on one device appears on another that is already open, and a device
  that has published nothing shows the account's events on first load. An
  invitation this browser holds that the account does not — published before
  signing in, or anonymously — stays on the list.
- FR-11.11 The landing page carries one sign-in link for a host with no session
  on this device, so reaching their events never requires publishing something
  first. It is not a gate: nothing is refused and FR-11.5 is unchanged. It
  renders only where sign-in is configured (FR-11.6), and only while signed
  out. Declining at Google returns the host to where they started it.

## FR-12 Reply notifications

**Status: built** — [adr-015](decisions/adr-015-rsvp-notifications.md),
`GET|POST /unsubscribe/:token`, `GET|PUT /api/account/notifications`
([email/](../server/src/email/), [notifications.ts](../server/src/notifications.ts))

Closes the latency gap FR-5 left open. adr-010 made the responses *reachable*
after a closed tab; this makes them *timely* — a host who checks once a week
otherwise learns about replies on a schedule unrelated to when guests sent
them.

- FR-12.1 When replies arrive for an invitation published while signed in, the
  host is emailed at the Google-verified address from FR-11.1 **if they have
  asked to be**. An account is the eligibility rule and asking is the second:
  an invitation published anonymously notifies nobody, silently and
  permanently, until someone republishes it signed in (FR-11.4), and an account
  that has never opted in notifies nobody either. There is no second address
  and no verification flow of our own.
- FR-12.2 The email carries the invitation title, **a count, and a link** — no
  guest name, no attendance, no party size, no note. Guest data does not leave
  the system: what a third-party mail provider learns is that this host has an
  event with replies ([adr-015](decisions/adr-015-rsvp-notifications.md) §3).
- FR-12.3 Links point at bare `/manage/:id` with **no `#t=` fragment**. The
  keyring supplies the manage token once the host signs in (FR-11.3), so a
  forwarded notification or a breached mailbox grants nothing. The unsubscribe
  URL is the only credential in the message.
- FR-12.4 At most one email per invitation per window
  (`NOTIFY_WINDOW_MINUTES`, default 60). The first reply mails immediately;
  replies inside the window mail nothing; the next one after it carries every
  reply since the last notification, counted by the same `countNewSince` the
  dashboard uses (FR-5.7) so the two can never disagree. A host who has never
  been told gets every live reply counted, since all of them are news.
- FR-12.5 Sending never blocks or fails an RSVP. It is dispatched after the
  guest's response, never awaited, and every failure is swallowed and logged —
  a dropped notification costs a nudge, and the next reply after the window
  carries the full count anyway. There is no retry queue.
- FR-12.6 A host can turn reply email off, **for their whole account**, from
  the share panel or from any message. The switch is account-wide because a
  mail client's one-click unsubscribe (RFC 8058) promises to stop the sender,
  not one message; honouring it per invitation earns the spam button instead,
  which costs deliverability for everything the product sends. Per-invitation
  control is deliberately deferred (adr-015 §7).
- FR-12.7 The **choice** is made where it is caused: the share panel asks, at
  the moment the host publishes, whether replies should be emailed and to which
  address — not in a settings screen this app does not have, and not discovered
  from the first email. **The control also has a durable home** in the landing
  page's account footer and on the host dashboard (FR-12.11), because a moment
  is not an address; without them a host who declined at publish would have no
  way back to the choice at all. It is absent, never disabled, where the
  deployment cannot send mail or the host has published nothing yet.
- FR-12.8 `GET /unsubscribe/:token` never mutates — mail scanners and link
  prefetchers follow links without a human, so it renders a confirm step;
  `POST` is the mutation and RFC 8058's one-click posts to it. An unresolvable
  token says the link no longer works without revealing whether it ever
  existed, and never reads as an error. Unsubscribing touches no manage token,
  no keyring row and no invitation.
- FR-12.9 With no mail credentials the server boots and every other feature is
  unchanged; nothing in the UI offers a preference that cannot be honoured.
  `GET /healthz` reports `notifications.configured` and
  `notifications.window_minutes`, and `/api/auth/session` reports
  `notifications` so the share panel knows whether to promise anything.
- FR-12.10 Reply email is **opt-in**. The absence of a stored preference is
  *off*, so publishing while signed in starts no mail on its own, and the host
  is asked at publish rather than told. The reason is deliverability rather
  than consent: the sending domain is new, and a spam press on unasked-for mail
  costs inbox placement for every message the product sends, guests' share
  links included (adr-015 §7, amended). Asking once covers the whole account,
  including invitations published later.
- FR-12.11 The host dashboard carries the same control, stating in words that
  it governs every invitation in the account rather than the one on screen. It
  is absent, never disabled, for a host with no session on this device: the
  preference is session-authorized while `/manage/:id` is authorized by a
  manage token, so a host who arrived on a pasted link cannot reach it.

| Path | Page | Audience |
| --- | --- | --- |
| `/` | Landing page; lists this browser's invitations with response counts when it has any (FR-5.6, FR-5.7) | Public |
| `/create` | Editor (generate → edit → publish → share). `?ref=guest` attributes the session (FR-7.3) and is stripped from the URL at mount | Host |
| `/manage/:id` | Response dashboard; needs the manage token (FR-5.4) | Host |
| `/i/:id` | Published invitation + RSVP form | Guest |

### Account endpoints (FR-11)

| Endpoint | Purpose | Authorized by |
| --- | --- | --- |
| `GET /api/auth/google` | Start sign-in; redirects to Google | — (`503` when unconfigured) |
| `GET /api/auth/google/callback` | Finish sign-in; sets the session cookie | One-time `state` + verified `id_token` |
| `GET /api/auth/session` | Is sign-in available, and am I signed in | Session cookie (optional) |
| `POST /api/auth/signout` | Revoke this session | Session cookie + origin check |
| `GET /api/account/keyring` | This account's invitations + manage tokens | Session cookie |
| `DELETE /api/account` | Delete the account, keep the invitations | Session cookie + origin check |

### Notification endpoints (FR-12)

| Endpoint | Purpose | Authorized by |
| --- | --- | --- |
| `GET /api/account/notifications` | Is reply email on for this account | Session cookie |
| `PUT /api/account/notifications` | Turn it on or off | Session cookie + origin check |
| `GET /unsubscribe/:token` | Confirm step — never mutates | Unsubscribe token |
| `POST /unsubscribe/:token` | Turn reply email off; RFC 8058 one-click posts here | Unsubscribe token (no origin check — one-click is cross-origin by definition) |

`/unsubscribe` sits **outside `/api`** on purpose: the session cookie is scoped
`Path=/api`, and this URL arrives from an inbox where a mail provider may fetch
it on the reader's behalf.

## Not yet built (backlog)

- ~~Optional AI background image layer~~ — ✅ shipped as FR-10
  ([adr-009](decisions/adr-009-ai-background-layer.md)).
