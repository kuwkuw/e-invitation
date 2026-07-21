# ADR-006 — BYOK as stateless per-request key pass-through

**Status:** accepted · **Date:** 2026-07 · The proxy transport described
here is superseded by [adr-007](adr-007-in-process-providers.md): the key
is now used directly by the in-process provider call. The BYOK rules
(browser-only storage, never logged, provider-restricted walk, no operator
fallback) stand unchanged.

## Context

ADR-002's endgame — user-level BYOK via the LiteLLM Proxy — is now unblocked:
the proxy runs hosted (internal Northflank service, PR #4). Prod currently
generates on the **operator's** free-tier Gemini key: ~20 requests/day shared
across every host of the app, i.e. roughly six invitations a day total. BYOK
is what makes the product scale at zero marginal cost: each host brings their
own (typically free-tier Gemini) key and spends their own quota.

Two constraints shape the design:

- **The product has no accounts** (ADR-005): hosts and guests are
  authenticated by capability tokens, not identity. "User-level keys" must
  not smuggle in registration or server-side user state.
- **LiteLLM offers two relevant mechanisms** (researched 2026-07-20):
  - *Virtual keys*: proxy-issued tokens with budgets/rate limits — but they
    require Postgres + a master key, and they meter access to the
    **operator's** provider keys. That is metering, not BYOK.
  - *Client-side credentials*: `configurable_clientside_auth_params:
    ["api_key"]` on a model entry lets each request carry the caller's own
    provider key. Stateless, no DB. Documented for the OpenAI-format
    endpoint; compatibility with the Anthropic-format endpoint our gateway
    uses is **unverified** (spike required, see Consequences).

## Decision

1. **The host's provider key lives in the browser only** (editor settings,
   `localStorage`), like the manage token does today. It is sent on
   `POST /api/invitations/generate` and `/regenerate-field` via
   `x-llm-key` + `x-llm-provider` headers.
2. **The server treats the key as transient request context**: used for that
   request's LLM calls, never persisted, never logged. Log redaction is part
   of the definition of done.
3. **Provider handling**: `anthropic` keys → per-request Anthropic client
   (direct, no proxy involvement). `gemini` (first target) and `openai` →
   through the proxy using client-side credentials on those model entries.
4. **BYOK routing never spends operator money.** A BYOK request's model walk
   is restricted to the key's provider (a Gemini key walks
   `gemini-2.5-flash` only); there is no silent fallback to operator keys.
   Failures surface as the normal 502.
5. **No key supplied → today's behavior, unchanged** (operator keys via
   routing table; this keeps dev and the current prod mode working).
6. **Virtual keys are deferred**, recorded here as rejected-for-now: they
   answer a different question (metering our keys for paying users) and
   require Postgres + key-issuance flows that contradict the no-accounts
   constraint today.

## Consequences

- Per-host free-tier quota replaces one shared operator quota; the product's
  generation cost goes to zero for BYOK hosts.
- The key transits our server on each request (HTTPS end-to-end; stateless —
  no at-rest exposure). The trust statement for hosts is honest and simple:
  "your key is used for your request and forgotten."
- **Spike resolved (2026-07-20)**: the Anthropic-format proxy endpoint does
  honor per-request client-side `api_key` (verified against the local proxy:
  a fake override key produced Gemini's `API_KEY_INVALID` while the control
  request succeeded on the env key), so the gateway keeps a single SDK
  transport for both modes.
- The editor gains a small settings surface (key entry + provider picker +
  "stored only in this browser" copy) — UI work in the E-invitation DS
  design system, unlike the rest of this iteration.
- Regenerate-rate metrics gain a `byok` dimension eventually; not required
  for v1.
