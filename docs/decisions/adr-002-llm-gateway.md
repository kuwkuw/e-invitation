# ADR-002 — In-house routing table now, LiteLLM Proxy later

**Status:** accepted · **Date:** 2026-07 · The LiteLLM-Proxy endgame is
superseded by [adr-007](adr-007-in-process-providers.md) (in-process
provider calls); the routing-table core stands.

## Context

The app needs task-based model routing (cheap model for brief extraction,
strong model for copy), fallbacks, and per-request cost/latency logging.
Multi-provider support and user-level BYOK are on the roadmap but not needed
for the first milestone.

## Decision

Build a minimal in-house gateway: a static routing table
(`llm/routing.ts` — task → primary → fallbacks → maxTokens) walked by
`completeJson()` in `llm/gateway.ts`, calling the Anthropic SDK directly with
structured outputs. The routing table is the **single operator switch point**.

When multi-provider/BYOK arrives, stand up a **LiteLLM Proxy** and point the
existing client at it via `LLM_BASE_URL`. Do not adopt another multi-provider
client library in the meantime.

## Consequences

- Model changes are one-line edits in one file; `pricing.ts` +
  `test/routing.test.ts` keep cost tracking honest.
- The proxy swap is a config change because the routing-table interface is the
  stability contract — keep it stable (NFR-8).
- Until the proxy exists, only Anthropic models are routable; fallbacks guard
  against model errors, not provider outages.
