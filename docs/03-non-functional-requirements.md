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
  **80.9 kB gzipped** (248.9 kB raw) as of the client-router iteration, up
  13.2 kB from 67.7 kB when react-router-dom was adopted
  ([adr-011](decisions/adr-011-client-router.md)). Measured with
  `pnpm --filter inv-app-web build`. There is no automated budget check —
  measure and record the delta when adding a runtime dependency.

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

## NFR-4 Security & privacy

- **No accounts, minimal data.** The only stored personal data is what a guest
  types into the RSVP form.
- Host authority = possession of the `manage_token` (128-bit random hex),
  compared in constant time (`timingSafeEqual`). It is returned only at
  publish time and never included in public payloads.
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
- Product counters (generations, regenerations, publishes, RSVPs,
  regenerate-rate) at `GET /api/metrics`.
- The regenerate-rate is the primary quality KPI (see
  [01-vision.md](01-vision.md)).

## NFR-7 Scale assumptions (explicit)

- Single-process deployment. The file-backed store and file-backed metrics
  counters are deliberate simplicity choices; both sit behind small function
  interfaces
  (`store.ts`, `metrics.ts`) so a DB / metrics backend can replace them without
  touching routes.
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
