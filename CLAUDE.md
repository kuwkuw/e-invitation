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

**litellm/** (LiteLLM Proxy, port 4000): `docker compose up -d litellm` — multi-provider gateway (Anthropic + Gemini). Reads keys from `server/.env`; the API routes through it when `LLM_BASE_URL=http://localhost:4000` is set there. Model aliases in `litellm/config.yaml` must match the ids in `routing.ts` exactly. Config changes need `docker compose restart litellm`.

**web/** (Vite + React, port 5173, proxies `/api` → localhost:3001): `build` includes typecheck.

## Architecture

Pipeline (`server/src/pipeline/`): sentence → `extractBrief` (cheap model, structured `EventBrief` JSON) → **parallel** `generateCopy` + `resolveDesign` → `Invitation` JSON returned to the client. Copy and design depend only on the brief, so `generate.ts` always runs them with `Promise.all`. Latency target: sentence in → editable invitation out in ~3s.

LLM gateway (`server/src/llm/`):
- `routing.ts` is the **single operator switch point**: task → primary model → fallbacks (+ per-task `maxTokens`). Change models here and nowhere else.
- `gateway.ts` `completeJson()` walks that list until a model succeeds, sends the zod schema as an Anthropic structured-output format (`zodOutputFormat`), validates the response with lenient JSON extraction + zod (proxied providers sometimes wrap JSON in prose), and emits one JSON log line per request: task, model, fallback flag, latency, tokens, cost.
- `pricing.ts` must have an entry for every routed model — `test/routing.test.ts` enforces this.
- Multi-provider goes through **LiteLLM Proxy** (`litellm/config.yaml`, run via docker compose): with `LLM_BASE_URL` set the Anthropic SDK talks to the proxy's Anthropic-format endpoint and any configured provider resolves; unset, the SDK calls Anthropic directly and non-Anthropic models in `routing.ts` simply fail over. Gemini quirks handled in config: free-tier keys have zero `gemini-2.5-pro` quota (use flash), and thinking must be disabled (`reasoning_effort: "disable"`) or small `maxTokens` caps are consumed by reasoning before any JSON is emitted. Do not replace LiteLLM with another multi-provider library.

Rendering: **no full-image generation.** The model only picks design tokens — closed enums in `schemas.ts` (`palette`/`typography`/`layout`/`ornament`). `web/src/components/InvitationPreview.tsx` maps tokens 1:1 to CSS classes in `web/src/styles.css`; model output is never interpreted as markup or styles. Keep tokens enums-only.

Regeneration is **per-field, never whole-invitation**: `POST /api/invitations/regenerate-field` takes the brief + field + current value and returns one rewritten field.

Metrics: `server/src/metrics.ts` counts generations and per-field regenerations; `GET /api/metrics` exposes the regenerate-rate (the main copy-quality signal). Per-request LLM logs come from the gateway.

Schemas: `server/src/schemas.ts` (zod, v4) is the source of truth; `web/src/types.ts` mirrors it and must be updated in sync by hand.

Language handling: `EventBrief.language` (`uk`/`en`) is detected from the input sentence and drives the copy language; the UI language toggle in `web/src/i18n.ts` is independent of it.

## Status

Implemented: generate + per-field regeneration + deterministic preview; publish (versioned snapshot + share link) + guest RSVP page; LiteLLM Proxy with Gemini fallbacks (local dev). Not yet built: OG image for share links, BYOK/user-level keys, hosted proxy deployment.
