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
  accounts). The web client writes it to `localStorage` at publish, but does
  **not** yet read it back: host access to an invitation currently lasts only
  as long as the editor session that published it (planned fix:
  [adr-010](decisions/adr-010-host-manage-link.md), roadmap iteration "the host
  can come back").
- FR-3.4 A fresh generation in the editor detaches from any previously
  published link (new event → new link).
- FR-3.5 OG image for messenger link unfurling: `GET
  /api/invitations/:id/og.png` renders a 1200×630 PNG server-side from the
  design tokens ([render.ts](../server/src/og/render.ts)); `GET /i/:id` serves
  the SPA shell with `og:*` meta injected for crawlers.

## FR-4 Guest page & RSVP

**Status: built** — `GET /api/invitations/:id`,
`POST /api/invitations/:id/rsvp` ([GuestPage.tsx](../web/src/GuestPage.tsx))

- FR-4.1 The share link renders the published invitation publicly — no
  authentication, no registration.
- FR-4.2 The public payload contains only the latest invitation version: never
  the manage token, never other guests' RSVPs.
- FR-4.3 A guest RSVPs with: name (≤100 chars), attending yes/no, party size
  1–10, optional note (≤500 chars).
- FR-4.4 RSVPs append to the invitation record; duplicates are not deduplicated
  (a guest may change their mind by submitting again).
- FR-4.5 After an attending RSVP the guest can download an `.ics` calendar
  event built client-side from the brief ([calendar.ts](../web/src/calendar.ts)):
  best-effort bilingual parsing of the free-text date/time (all-day without a
  time, 2 hours with one); the action is hidden when no date parses.

## FR-5 Host views responses

**Status: built** — `GET /api/invitations/:id/rsvps`

- FR-5.1 Requires the `x-manage-token` header matching the record's token
  (constant-time comparison).
- FR-5.2 Returns the full RSVP list plus aggregate counts: yes, no, and total
  guests among attendees. Re-submissions (FR-4.4) are currently counted twice —
  collapsing them per guest is planned in
  [adr-010](decisions/adr-010-host-manage-link.md) §5.
- FR-5.3 The dashboard exports the list as CSV, built client-side from the
  fetched data ([csv.ts](../web/src/csv.ts)): UTF-8 BOM (so Excel reads
  Cyrillic), localized headers/answers, guest count blank on declines.

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

- FR-7.1 Expose counters: generations, per-field regenerations, publishes,
  RSVPs, and the derived regenerate-rate and publish-rate.
- FR-7.2 Counters persist to `DATA_DIR/metrics.json` (write-then-rename, same
  discipline as the store) and reload on boot, so the KPIs survive restarts
  and deploys. A missing or corrupt file starts them fresh.

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

## Routing map (web)

| Path | Page | Audience |
| --- | --- | --- |
| `/` | Landing page | Public |
| `/create` | Editor (generate → edit → publish → RSVP dashboard) | Host |
| `/i/:id` | Published invitation + RSVP form | Guest |

## Not yet built (backlog)

- ~~Optional AI background image layer~~ — ✅ shipped as FR-10
  ([adr-009](decisions/adr-009-ai-background-layer.md)).
