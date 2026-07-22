# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product

E-invitation web app: the user describes an event in one sentence → AI generates an editable invitation → share link + RSVP page (not yet built). Bilingual Ukrainian/English; guests never register; sharing targets Viber/Telegram/WhatsApp.

## Commands

pnpm monorepo (`pnpm-workspace.yaml`: `server` + `web`). Use pnpm, not npm. From the root:

- `pnpm install` — all workspaces (new native deps needing postinstall scripts must be added to `onlyBuiltDependencies` in `pnpm-workspace.yaml`)
- `pnpm dev` — both dev servers in parallel
- `pnpm test` / `pnpm typecheck` / `pnpm build` — recursive across workspaces
- `pnpm --filter inv-app-server <script>` — one workspace (`inv-app-web` for web)

**server/** (Fastify API, port 3001): dev server reloads via tsx watch. Provider keys live in `server/.env` (see `.env.example`): `GROQ_API_KEY` + `GEMINI_API_KEY` are the free-tier MVP pair the default routes run on; `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` are optional paid fallbacks. The server boots keyless but generation then fails. Tests mock the LLM boundary — no keys needed. Single test file: `pnpm --filter inv-app-server exec vitest run test/routing.test.ts`; single test: `... vitest run -t "name"`.

**web/** (Vite + React, port 5173, proxies `/api` → localhost:3001): `build` includes typecheck.

## Architecture

Pipeline (`server/src/pipeline/`): sentence → `extractBrief` (cheap model, structured `EventBrief` JSON) → **parallel** `generateCopy` + `resolveDesign` → `Invitation` JSON returned to the client. Copy and design depend only on the brief, so `generate.ts` always runs them with `Promise.all`. Latency target: sentence in → editable invitation out in ~3s.

LLM gateway (`server/src/llm/`):
- `routing.ts` is the **single operator switch point**: task → primary model → fallbacks (+ per-task `maxTokens`), plus `MODEL_PROVIDERS` (model → transport) and `BYOK_FALLBACK_MODELS`. Change models here and nowhere else. Routing is **free-tier-first** (adr-007): Groq `llama-3.3-70b-versatile` primary for volume tasks, Gemini `gemini-2.5-flash` for copy-quality tasks, paid Claude models as fallbacks that engage only when `ANTHROPIC_API_KEY` is set.
- `gateway.ts` `completeJson()` walks that list until a model succeeds, requests schema-conformant JSON (Anthropic structured outputs via `zodOutputFormat`; `response_format` json_schema on the compat transport), validates the response with lenient JSON extraction + zod (some providers wrap JSON in prose), and emits one JSON log line per request: task, model, fallback flag, latency, tokens, cost, and on failure an `error_class` (`auth`/`quota`/`connectivity`/`output-invalid`/`other`). When every model fails it throws `AllModelsFailedError`; the 502 body carries per-model `causes` (class only — raw messages stay in logs) and the web chat maps quota/auth causes to actionable messages. `GET /healthz` reports the effective routing (`llm.providers` key presence + per-task model walks).
- `pricing.ts` must have an entry for every routed model — `test/routing.test.ts` enforces this.
- Multi-provider is **in-process** (adr-007; the former LiteLLM Proxy sidecar OOM-killed on small plans): `openaiCompat.ts` calls Gemini/OpenAI/Groq/Ollama through their OpenAI-compatible `/chat/completions` endpoints with plain `fetch` — adding a provider is one entry in its `PROVIDERS` table. It owns the provider quirks the proxy used to handle: reasoning off for GPT models, Gemini thinking budget 0 via `extra_body.google.thinking_config` (otherwise reasoning consumes small `maxTokens` caps before any JSON is emitted), and the `gemma3-4b → gemma3:4b` Ollama alias. Gemini free-tier quotas: zero for `gemini-2.5-pro`, ~20 `gemini-2.5-flash` requests/day (expect daily 429s in heavy dev). Do not add a multi-provider client library — the walker plus this adapter is the whole design.

Rendering: **no full-image generation.** The model only picks design tokens — closed enums in `schemas.ts` (`palette`/`typography`/`layout`/`ornament`). `web/src/components/InvitationPreview.tsx` maps tokens 1:1 to CSS classes in `web/src/styles.css`; model output is never interpreted as markup or styles. Keep tokens enums-only.

OG images (`server/src/og/render.ts`): satori + resvg render the share-link preview (1200×630 PNG) server-side from the same tokens — the token→style maps there mirror `web/src/styles.css` by hand and `test/og.test.ts` enforces enum coverage. Fonts are vendored TTFs in `server/assets/fonts/` (the runtime Google-Fonts `@import` can't feed satori). `GET /i/:id` serves the SPA shell (`web/dist`, when built) with `og:*` meta injected so messenger crawlers see them; `?v=<version>` on the image URL busts messenger caches on republish.

Regeneration is **per-field, never whole-invitation**: `POST /api/invitations/regenerate-field` takes the brief + field + current value and returns one rewritten field.

AI background layer (adr-009): `POST /api/invitations/background` is an explicit editor action (never part of the 3s generate path) — `server/src/llm/imageGen.ts` calls `gemini-2.5-flash-image` (single model, no fallback; gemini-only for BYOK) with a server-built no-text prompt, stores the PNG under `DATA_DIR/backgrounds/`, and the invitation carries only an opaque nullable `background.id` served via `GET /api/backgrounds/:id`. The client composites it under the copy with a palette-tinted scrim (`--bg-rgb` custom props in `styles.css`, spec synced from the E-invitation DS `templates/card-background` mockups); `split` confines the image to a side panel; `minimal` rejects backgrounds; the OG card stays token-only.

BYOK (adr-006, transport per adr-007): the host's own provider key rides generate/regenerate requests as `x-llm-provider`/`x-llm-key` headers (browser localStorage only, editor "AI key" panel). The gateway then walks **only that provider's models** — never operator-key fallbacks; if the free-first route has none, `BYOK_FALLBACK_MODELS` applies — and spends the key directly: Anthropic keys via a per-request SDK client, Gemini/OpenAI keys as the bearer token of the in-process call. Groq/Ollama are operator-side only, never BYOK. Keys are never stored or logged (`byok: true` is the only log trace; fastify redacts the header).

Metrics: `server/src/metrics.ts` counts generations and per-field regenerations, persisted to `DATA_DIR/metrics.json` (write-then-rename) so counters survive restarts; `GET /api/metrics` exposes the regenerate-rate (the main copy-quality signal) and publish-rate. Per-request LLM logs come from the gateway.

Guardrails (adr-008): `server/src/guardrails.ts` gates the two LLM-backed endpoints for non-BYOK requests — per-IP daily allowances (`LIMIT_GENERATIONS_PER_DAY`/`LIMIT_REGENERATIONS_PER_DAY`, 429 when over) and a daily operator budget breaker (`DAILY_BUDGET_USD`, 503 when exhausted) fed by the gateway's cost estimates. BYOK requests bypass both; `/healthz` reports limits and today's spend; env var 0 disables a guardrail.

Schemas: `server/src/schemas.ts` (zod, v4) is the source of truth; `web/src/types.ts` mirrors it and must be updated in sync by hand.

Language handling: `EventBrief.language` (`uk`/`en`) is detected from the input sentence and drives the copy language; the UI language toggle in `web/src/i18n.ts` is independent of it.

## Status

Implemented: generate + per-field regeneration + deterministic preview; publish (versioned snapshot + share link + OG image) + guest RSVP page; in-process multi-provider gateway with free-tier-first routing — Groq/Gemini primaries, Claude/Ollama fallbacks (adr-007, replaced the LiteLLM Proxy sidecar that OOM-killed on small plans); production Docker image (single container: API + SPA + OG, file store on a volume — see `docs/05-deployment.md` for the Northflank setup); BYOK per-request user keys (adr-006); operator-cost guardrails — per-IP daily limits + budget breaker (adr-008); durable metrics with publish-rate; guest-page add-to-calendar (.ics); RSVP CSV export; optional AI background layer (adr-009, Gemini image, palette-tinted scrim); custom-domain support (`CANONICAL_HOST` redirect + runbook in `docs/05-deployment.md`). Not yet built: per-key metering.
