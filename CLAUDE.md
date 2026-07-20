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

**server/** (Fastify API, port 3001): dev server reloads via tsx watch. Needs `ANTHROPIC_API_KEY` in `server/.env` (see `.env.example`); boots without it but generation calls fail. Tests mock the LLM gateway — no key needed. Single test file: `pnpm --filter inv-app-server exec vitest run test/routing.test.ts`; single test: `... vitest run -t "name"`.

**litellm/** (LiteLLM Proxy, port 4000): `docker compose up -d litellm` — multi-provider gateway (Anthropic + Gemini). Reads keys from `server/.env`; the API routes through it when `LLM_BASE_URL=http://localhost:4000` is set there. Model aliases in `litellm/config.yaml` must match the ids in `routing.ts` exactly. Config changes need `docker compose restart litellm`; changes to `server/.env` (new keys) need `docker compose up -d --force-recreate litellm` — env_file is only read at container creation.

**web/** (Vite + React, port 5173, proxies `/api` → localhost:3001): `build` includes typecheck.

## Architecture

Pipeline (`server/src/pipeline/`): sentence → `extractBrief` (cheap model, structured `EventBrief` JSON) → **parallel** `generateCopy` + `resolveDesign` → `Invitation` JSON returned to the client. Copy and design depend only on the brief, so `generate.ts` always runs them with `Promise.all`. Latency target: sentence in → editable invitation out in ~3s.

LLM gateway (`server/src/llm/`):
- `routing.ts` is the **single operator switch point**: task → primary model → fallbacks (+ per-task `maxTokens`). Change models here and nowhere else.
- `gateway.ts` `completeJson()` walks that list until a model succeeds, sends the zod schema as an Anthropic structured-output format (`zodOutputFormat`), validates the response with lenient JSON extraction + zod (proxied providers sometimes wrap JSON in prose), and emits one JSON log line per request: task, model, fallback flag, latency, tokens, cost, and on failure an `error_class` (`auth`/`quota`/`connectivity`/`output-invalid`/`other`). When every model fails it throws `AllModelsFailedError`; the 502 body carries per-model `causes` (class only — raw messages stay in logs) and the web chat maps quota/auth causes to actionable messages. `GET /healthz` reports the effective routing (`llm.mode` + per-task model walks).
- `pricing.ts` must have an entry for every routed model — `test/routing.test.ts` enforces this.
- Multi-provider goes through **LiteLLM Proxy** (`litellm/config.yaml`, run via docker compose): with `LLM_BASE_URL` set the Anthropic SDK talks to the proxy's Anthropic-format endpoint and any configured provider resolves; unset, the SDK calls Anthropic directly and non-Anthropic models in `routing.ts` simply fail over. Gemini quirks handled in config: free-tier keys have zero `gemini-2.5-pro` quota and only ~20 `gemini-2.5-flash` requests/day (use flash, expect daily 429s in heavy dev), and thinking must be disabled (`reasoning_effort: "disable"`) or small `maxTokens` caps are consumed by reasoning before any JSON is emitted. Do not replace LiteLLM with another multi-provider library.

Rendering: **no full-image generation.** The model only picks design tokens — closed enums in `schemas.ts` (`palette`/`typography`/`layout`/`ornament`). `web/src/components/InvitationPreview.tsx` maps tokens 1:1 to CSS classes in `web/src/styles.css`; model output is never interpreted as markup or styles. Keep tokens enums-only.

OG images (`server/src/og/render.ts`): satori + resvg render the share-link preview (1200×630 PNG) server-side from the same tokens — the token→style maps there mirror `web/src/styles.css` by hand and `test/og.test.ts` enforces enum coverage. Fonts are vendored TTFs in `server/assets/fonts/` (the runtime Google-Fonts `@import` can't feed satori). `GET /i/:id` serves the SPA shell (`web/dist`, when built) with `og:*` meta injected so messenger crawlers see them; `?v=<version>` on the image URL busts messenger caches on republish.

Regeneration is **per-field, never whole-invitation**: `POST /api/invitations/regenerate-field` takes the brief + field + current value and returns one rewritten field.

BYOK (adr-006): the host's own provider key rides generate/regenerate requests as `x-llm-provider`/`x-llm-key` headers (browser localStorage only, editor "AI key" panel). The gateway then walks **only that provider's models** — never operator-key fallbacks — and passes the key per request: Anthropic keys via a per-request direct client, Gemini/OpenAI keys as a client-side `api_key` body override through the proxy (`configurable_clientside_auth_params` in `litellm/config.yaml`). Keys are never stored or logged (`byok: true` is the only log trace; fastify redacts the header).

Metrics: `server/src/metrics.ts` counts generations and per-field regenerations; `GET /api/metrics` exposes the regenerate-rate (the main copy-quality signal). Per-request LLM logs come from the gateway.

Schemas: `server/src/schemas.ts` (zod, v4) is the source of truth; `web/src/types.ts` mirrors it and must be updated in sync by hand.

Language handling: `EventBrief.language` (`uk`/`en`) is detected from the input sentence and drives the copy language; the UI language toggle in `web/src/i18n.ts` is independent of it.

## Status

Implemented: generate + per-field regeneration + deterministic preview; publish (versioned snapshot + share link + OG image) + guest RSVP page; LiteLLM Proxy with Gemini/OpenAI/Ollama fallbacks (local via docker compose, hosted as an internal Northflank service); production Docker image (single container: API + SPA + OG, file store on a volume — see `docs/05-deployment.md` for the Northflank setup); BYOK per-request user keys (adr-006). Not yet built: per-key metering/budgets (LiteLLM virtual keys), custom domain.
