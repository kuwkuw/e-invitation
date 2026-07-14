# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product

E-invitation web app: the user describes an event in one sentence → AI generates an editable invitation → share link + RSVP page (not yet built). Bilingual Ukrainian/English; guests never register; sharing targets Viber/Telegram/WhatsApp.

## Commands

Two independent npm packages; run commands inside each directory.

**server/** (Fastify API, port 3001):
- `npm run dev` — dev server with reload (tsx watch). Needs `ANTHROPIC_API_KEY` in `server/.env` (see `.env.example`); boots without it but generation calls fail.
- `npm test` — vitest suite (mocks the LLM gateway, no API key needed)
- `npx vitest run test/routing.test.ts` — single test file; `npx vitest run -t "name"` — single test by name
- `npm run typecheck` / `npm run build`

**web/** (Vite + React, port 5173, proxies `/api` → localhost:3001):
- `npm run dev`
- `npm run build` (includes typecheck) / `npm run typecheck`

## Architecture

Pipeline (`server/src/pipeline/`): sentence → `extractBrief` (cheap model, structured `EventBrief` JSON) → **parallel** `generateCopy` + `resolveDesign` → `Invitation` JSON returned to the client. Copy and design depend only on the brief, so `generate.ts` always runs them with `Promise.all`. Latency target: sentence in → editable invitation out in ~3s.

LLM gateway (`server/src/llm/`):
- `routing.ts` is the **single operator switch point**: task → primary model → fallbacks (+ per-task `maxTokens`). Change models here and nowhere else.
- `gateway.ts` `completeJson()` walks that list until a model succeeds, enforces the zod schema via Anthropic structured outputs (`messages.parse` + `zodOutputFormat`), and emits one JSON log line per request: task, model, fallback flag, latency, tokens, cost.
- `pricing.ts` must have an entry for every routed model — `test/routing.test.ts` enforces this.
- The gateway calls the Anthropic SDK directly today. The settled plan for multi-provider/BYOK is to stand up **LiteLLM Proxy** later and point the client at it via `LLM_BASE_URL` — keep the routing-table interface stable so that swap stays cheap. Do not replace it with another multi-provider library.

Rendering: **no full-image generation.** The model only picks design tokens — closed enums in `schemas.ts` (`palette`/`typography`/`layout`/`ornament`). `web/src/components/InvitationPreview.tsx` maps tokens 1:1 to CSS classes in `web/src/styles.css`; model output is never interpreted as markup or styles. Keep tokens enums-only.

Regeneration is **per-field, never whole-invitation**: `POST /api/invitations/regenerate-field` takes the brief + field + current value and returns one rewritten field.

Metrics: `server/src/metrics.ts` counts generations and per-field regenerations; `GET /api/metrics` exposes the regenerate-rate (the main copy-quality signal). Per-request LLM logs come from the gateway.

Schemas: `server/src/schemas.ts` (zod, v4) is the source of truth; `web/src/types.ts` mirrors it and must be updated in sync by hand.

Language handling: `EventBrief.language` (`uk`/`en`) is detected from the input sentence and drives the copy language; the UI language toggle in `web/src/i18n.ts` is independent of it.

## Status

First milestone implemented: generate + per-field regeneration + deterministic preview. Not yet built: publish (versioned snapshot + share link + OG image), RSVP page, BYOK/user-level keys, LiteLLM Proxy.
