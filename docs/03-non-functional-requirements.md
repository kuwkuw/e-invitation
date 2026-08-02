# 03 — Non-functional requirements

## NFR-1 Latency

- **Sentence in → editable invitation out in ~3 seconds** (p50 target). This
  is the defining UX constraint and drives the pipeline shape: copy and design
  depend only on the brief, so they always run in parallel
  ([pipeline/generate.ts](../server/src/pipeline/generate.ts)).
- Brief extraction is routed to a cheap/fast model; design resolution (tiny
  enum-only output, 256 max tokens) is the first candidate to downgrade if the
  target is missed ([llm/routing.ts](../server/src/llm/routing.ts)).
- Per-field regeneration should feel interactive (single small completion,
  512 max tokens).
- The client bundle is part of this budget for a mobile-first audience:
  **88.9 kB gzipped** (275.1 kB raw), measured with
  `pnpm --filter inv-app-web build`. It was 80.9 kB at the client-router
  iteration, itself up 13.2 kB from 67.7 kB when react-router-dom was adopted
  ([adr-011](decisions/adr-011-client-router.md)); ~2 kB of the rest is the
  share-loop client (adr-013), **+0.7 kB is reply notifications**
  ([adr-015](decisions/adr-015-rsvp-notifications.md) — a hook, one panel row
  and two icons, no dependency) and **+5.4 kB is host accounts**
  ([adr-014](decisions/adr-014-host-accounts.md)) — the sign-in gate, the
  signed-in share panel and the account surfaces. No Google SDK: the handshake
  is a server-side redirect flow, which is what kept that number to five
  kilobytes. There is no automated budget check — measure and record the delta when adding a runtime dependency.

## NFR-2 Cost

- Every LLM request logs estimated USD cost; every routed model **must** have
  a pricing entry ([llm/pricing.ts](../server/src/llm/pricing.ts)), enforced by
  `test/routing.test.ts`.
- Output caps per task (`maxTokens` in the routing table) bound worst-case
  spend per request.
- Model choice is an operator decision made in exactly one place — the routing
  table — so cost/quality trade-offs never require code changes elsewhere.
- Operator spend is bounded end to end (FR-9,
  [adr-008](decisions/adr-008-operator-cost-guardrails.md)): per-IP daily
  allowances on the LLM endpoints plus a daily global budget breaker fed by
  the gateway's cost estimates. BYOK requests are exempt from both.

## NFR-3 Reliability & degradation

- Each LLM task has an ordered fallback chain; a task fails only when **all**
  routed models fail, and then surfaces as a clean `502` with a user-safe
  message — internals are logged, not leaked.
- The server boots and serves `/healthz` without an API key (client is created
  lazily); only generation calls fail without credentials.
- Published records are written write-then-rename so a crash mid-write never
  leaves a truncated file ([store.ts](../server/src/store.ts)).
- **Mail-unconfigured is a supported mode**, the third application of the
  keyless-boot rule after provider keys and OAuth (FR-12.9): no
  `RESEND_API_KEY` means no notifications and no other change, and no UI offers
  a preference that cannot be honoured.
- **A notification never costs an RSVP.** Sending is dispatched after the
  guest's response and never awaited, the sender never throws, and a failed
  send is logged and dropped rather than retried — the next reply after the
  window carries the full count, which is self-healing where a retry queue
  would be state to maintain (adr-015 §5).

## NFR-4 Security & privacy

- **Minimal data, and optional accounts.** Until
  [adr-014](decisions/adr-014-host-accounts.md) this read "no accounts"; the
  guest side is unchanged (a guest never registers, and the only personal data
  stored about them is what they type into the RSVP form), but a host may now
  have one.
- **What a host account stores:** the Google `sub`, the verified email, a
  creation timestamp, session rows, and the ids of invitations published while
  signed in. **What it deliberately does not:** no password, no profile photo,
  no name beyond what `openid email` returns, no contacts scope, no third-party
  analytics, and no cookie outside `Path=/api`.
- **Signing in discloses to Google** that this person publishes invitations
  here. Unavoidable with a third-party identity provider, and stated rather
  than discovered.
- **The address collected for identity is now also used for messaging**
  (FR-12, [adr-015](decisions/adr-015-rsvp-notifications.md)). That is a
  different claim from holding it, so it comes with three commitments: the use
  is **disclosed at publish** rather than discovered from the first email, it
  is **revocable in one click** from any message without signing in, and
  turning it off covers the whole account, because a mail client's unsubscribe
  button promises to stop the sender rather than one message.
- **No guest data reaches the mail provider.** A notification carries the
  invitation title, a count and a link — never a guest's name, attendance or
  note. What the provider learns is that this host has an event with replies,
  which is unavoidable for anything that mails them. Sending guest names would
  be a larger step than adr-013 §2 declined to take for a metric, and it is
  declined for the same reason. The unsubscribe page echoes nothing at all:
  every string on it is ours and the token never appears in its body.
- **Deleting an account** (FR-11.7) removes the user, sessions and keyring and
  keeps every published invitation and RSVP: guests hold those share links, the
  RSVP rows are the guests' data, and the manage token survives on the record.
- Host authority = possession of the `manage_token` (128-bit random hex),
  compared in constant time (`timingSafeEqual`). It is returned only at
  publish time and never included in public payloads. **An account does not
  change this**: it is a durable place to keep tokens, not a second authority.
  Every host-facing endpoint still checks the token.
- The **session cookie** is an opaque 32-byte id, stored hashed, httpOnly,
  `Secure`, `SameSite=Lax`, scoped to `Path=/api` so it never rides `GET /i/:id`
  or the OG image request. It authorizes exactly two things — read your own
  keyring, and a first publish — and both also check `Origin`, because those
  are the only cookie-authorized operations in an app whose other mutations are
  immune to CSRF by construction. Nothing is signed and there is no session
  secret: the value means nothing except as a row key.
- The **manage link** (`/manage/:id#t=…`, FR-5.4) carries that token as a
  bearer secret so a host can move devices. It rides the URL **fragment**,
  which browsers never send to the server — so it stays out of access logs,
  referrer headers and the SPA-shell request path — and is stripped from the
  address bar once stored. In the UI it is masked, never pre-selected or
  auto-copied, and visually subordinate to the public share link: with no
  server-side protection against a host pasting the wrong one into a group
  chat, that hierarchy is the control ([adr-010](decisions/adr-010-host-manage-link.md) §3).
- Browser-local host state (`inv-manage:<id>`, `inv-manage-seen:<id>`,
  `inv-invitations`) never leaves the device. The invitations index holds
  titles and dates only — no tokens.
- **The guest side stores one flag and no identifier.** `inv-viewed:<id>`
  suppresses repeat view beacons (FR-7.5) and holds no secret — the id is
  already in the URL the guest followed. The precise alternative, a server-side
  set of hashed IPs per invitation, was rejected: it would store a derivative
  of a network identifier against a specific social event, for every guest,
  and would be the first thing recorded about a guest who never chose to answer
  ([adr-013](decisions/adr-013-share-loop-instrumentation.md) §2). The
  server's own dedupe is an in-process `(ip, invitation)` set that drops at UTC
  midnight — never persisted, never written to a record. No cookies, no
  third-party analytics, no fingerprinting: the whole measurement is two
  integers.
- Invitation IDs are 8 random bytes base64url; the `InvitationId` regex doubles
  as a path-traversal guard for the file store — keep it strict.
- All request bodies are zod-validated with length caps before any processing;
  validation errors return `400` with field-level messages.
- **Model output is data, not code**: design output is restricted to closed
  enums and copy is rendered as text — never interpreted as markup, styles, or
  URLs (see [adr-003](decisions/adr-003-no-image-generation.md)).

## NFR-5 Internationalization

- Ukrainian and English are first-class end to end: language detection from
  the input sentence drives copy language; the UI has its own toggle.
- No hardcoded user-facing strings outside [i18n.ts](../web/src/i18n.ts) (web)
  and the prompts (server).

## NFR-6 Observability

- One structured JSON log line per LLM request: task, model, fallback flag,
  ok/error, latency, tokens, estimated cost
  ([llm/gateway.ts](../server/src/llm/gateway.ts)).
- Product counters (generations, regenerations, backgrounds, publishes, RSVPs,
  guest-page views, referred generations, and the derived regenerate-rate,
  publish-rate, `views_per_publish` and `new_hosts_per_publish`) at
  `GET /api/metrics` (FR-7).
- The regenerate-rate is the primary quality KPI (see
  [01-vision.md](01-vision.md)).
- `new_hosts_per_publish` is the primary **commercial** KPI —
  [07-monetization.md](07-monetization.md) §5.1 gates every option on it. It is
  collected by the share-loop instrumentation in
  [adr-013](decisions/adr-013-share-loop-instrumentation.md): a guest-page
  beacon and a `direct`/`guest` enum on the generate request, both global, both
  deliberately imprecise. Read the magnitude of the ratio, never the counts.
- **Measurement never degrades the thing measured.** The view beacon returns
  `204` with no body and its failure is silence: a guest must never see a
  spinner, a message or a delay because a counter did or did not record.
- One structured JSON line per notification attempt — ok/error, provider
  status, latency ([email/send.ts](../server/src/email/send.ts)). The recipient
  is **not** logged: it is the host's address, and a log of them is a mailing
  list. Neither is the API key nor the body.

## NFR-7 Scale assumptions (explicit)

- Single-process deployment. The file-backed store and file-backed metrics
  counters are deliberate simplicity choices; both sit behind small function
  interfaces
  (`store.ts`, `metrics.ts`) so a DB / metrics backend can replace them without
  touching routes.
- **Account state is SQLite** (`DATA_DIR/app.db`, `node:sqlite`, WAL) —
  [adr-014](decisions/adr-014-host-accounts.md) §6. It sits *beside* the file
  store, not in front of it: published invitations stay one JSON file per id
  and `store.ts` is unchanged. Still one process, still one volume, so this
  assumption holds as written — but "do not scale above 1 instance" is now
  enforced by two subsystems instead of one. The backlog "SQLite store" item
  still refers to invitation records, which have not moved.
- No concurrency control on RSVP appends beyond process serialization —
  acceptable while single-process; revisit before multi-instance hosting.

## NFR-8 Maintainability constraints

- `server/src/schemas.ts` (zod v4) is the single source of truth for shapes;
  `web/src/types.ts` mirrors it **by hand** and must change in the same PR.
- The routing table interface must stay stable so provider/transport swaps
  stay local to the LLM gateway
  ([adr-002](decisions/adr-002-llm-gateway.md),
  [adr-007](decisions/adr-007-in-process-providers.md)).
- Design tokens stay closed enums — widening them to free-form strings is a
  breaking architectural change, not a tweak
  ([adr-003](decisions/adr-003-no-image-generation.md)).
