# ADR-007 — In-process provider calls, free-tier-first routing

**Status:** accepted · **Date:** 2026-07 · Supersedes the LiteLLM-Proxy
portions of [adr-002](adr-002-llm-gateway.md) and
[adr-006](adr-006-byok-passthrough.md).

## Context

ADR-002 planned multi-provider/BYOK via a LiteLLM Proxy sidecar, and that is
how it shipped: a second container translating the gateway's Anthropic-format
requests to Gemini/OpenAI/Ollama and carrying BYOK keys via
`configurable_clientside_auth_params`.

In production the sidecar was the deployment's memory problem: LiteLLM idles
at ~1 GiB, and on the memory-constrained Northflank plan it was OOM-killed
(verified: 512 MB → exit 137, silent restart loop, no logs). Paying for a
≥1 GB plan to run a translation layer — for what were fallback models — was
the wrong trade.

A second pressure: for the MVP the operator wants generation to run on
**free-tier LLMs**, with paid Claude models as fallbacks rather than
primaries. That means free providers must be first-class in the routing
table, not proxy-only extras.

## Decision

1. **Delete the proxy.** Every non-Anthropic provider we route (Gemini,
   OpenAI, Groq, Ollama) exposes an OpenAI-compatible `/chat/completions`
   endpoint, so one small fetch-based adapter
   (`server/src/llm/openaiCompat.ts`) calls them in-process. Anthropic keeps
   its direct SDK path. The gateway's shape is unchanged: routing walk,
   lenient JSON extraction + zod, failure classes, per-request log lines.
2. **Model → transport is an explicit map** (`MODEL_PROVIDERS` in
   `routing.ts`, replacing prefix sniffing), keeping `routing.ts` the single
   operator switch point. Provider quirks the proxy used to handle live in
   the adapter: reasoning off for GPT models, thinking budget 0 for Gemini
   (small per-task `maxTokens` caps must go to JSON, not reasoning), the
   `gemma3-4b → gemma3:4b` Ollama alias.
3. **Free-tier-first routing.** Groq's free `llama-3.3-70b-versatile`
   (~1k req/day) is primary for the volume tasks (brief extraction, design);
   Gemini's free `gemini-2.5-flash` (~20 req/day, best free Ukrainian) is
   reserved for the copy-quality tasks (copy, field regeneration). Claude
   models are paid fallbacks: with no `ANTHROPIC_API_KEY` they fail
   instantly (local auth error) and the walker moves on.
4. **BYOK simplifies** (mechanism change only; adr-006's rules stand): the
   per-request key is used directly — Anthropic keys as a per-request SDK
   client, Gemini/OpenAI keys as the bearer token of the in-process call.
   The body-override hack and the `LLM_BASE_URL` requirement are gone. Groq
   and Ollama stay operator-side only, never part of a BYOK walk; a BYOK
   provider absent from a task's free-first route walks that provider's
   `BYOK_FALLBACK_MODELS` list instead.

## Consequences

- Single-container deployment again; the ~1 GiB sidecar and its sharp edges
  (silent OOM, config baked into the image, unauthenticated internal
  endpoint) are gone.
- Provider-quirk maintenance moves in-house (~150 lines). Adding a provider
  with an OpenAI-compatible endpoint is one entry in the adapter's table.
- adr-002's "do not adopt another multi-provider client library" is
  reaffirmed differently: the adapter is plain `fetch`, no client library —
  SDK-internal retries would fight the walker and the ~3 s latency target.
- LiteLLM virtual keys are no longer the path to per-key metering/budgets;
  when metering is needed it will be designed fresh (still deferred, as in
  adr-006).
- The Gemini thinking-off parameter over the OpenAI-compat endpoint
  (`extra_body.google.thinking_config`) is asserted by unit test against our
  request shape; it must be re-verified against the live endpoint if Gemini
  changes its compat surface.
