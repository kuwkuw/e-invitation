# 06 — Roadmap: next iteration

Written 2026-07-22, after the in-process provider gateway (adr-007) landed.
This doc plans the **next** iteration; when an item ships it moves into
[02-functional-requirements.md](02-functional-requirements.md) /
[03-non-functional-requirements.md](03-non-functional-requirements.md) with a
stable ID, per the docs conventions.

## Where we are

The MVP loop is complete end to end: one-sentence generate → per-field
edit/regenerate → publish (versioned snapshot, share link, OG image) → guest
RSVP → host dashboard. Free-tier-first routing (Groq/Gemini) with paid
fallbacks, BYOK for power users, single-container production deploy.

What that leaves exposed:

1. **The LLM endpoints are unprotected.** Anyone with the URL can spend the
   operator's quota/keys; the "consumer cost model" question in the FR backlog
   is still open. This is the blocker to sharing the app with real hosts.
2. **The primary KPI is volatile.** Regenerate-rate (and all counters) live in
   process memory and reset on every deploy — we cannot actually watch the
   quality signal the vision doc says we steer by.
3. **Guest-side conversion is unfinished.** The guest page has share and a
   maps link, but no add-to-calendar — the one action that turns an RSVP into
   attendance.

## Iteration theme: safe to open to real hosts

Goal: the share-with-strangers milestone — the app can be given to real hosts
without an operator-cost incident and with the quality KPI actually observable.

### 1. Abuse guardrails for operator-paid generation (blocker) — ✅ shipped

Shipped as FR-9 / [ADR-008](decisions/adr-008-operator-cost-guardrails.md).
Original plan for reference:

Settles the open consumer-cost-model question with the simple option:
**operator-paid free-tier routing + limits** (~$0.0007/generation measured on
paid-tier `gemini-2.5-flash`); per-key metering stays rejected-for-now.
Record the decision as **ADR-008**.

- Per-IP rate limit on the two LLM-backed endpoints (generate,
  regenerate-field). Suggested start: 10 generations + 30 regenerations per
  IP per day; over-limit returns `429` with a bilingual, user-safe message
  the web chat surfaces (same pattern as the 502 cause mapping).
- BYOK requests (valid `x-llm-provider`/`x-llm-key`) bypass the limit — they
  spend the user's key, and this makes BYOK the documented escape hatch.
- Daily global spend circuit breaker fed by the gateway's per-request cost
  estimates: past a configured USD cap, operator-key generation returns `503`
  (BYOK still works). Protects against distributed abuse that per-IP misses.
- In-process counters are fine (same NFR-7 single-process assumption as the
  store); no new infrastructure.

Acceptance: hammering generate from one IP hits 429; `/healthz` or metrics
expose remaining daily budget; BYOK requests are never limited.

### 2. Durable metrics — ✅ shipped

Shipped: see FR-7. Original plan for reference:

- Persist the `metrics.ts` counters through the file store (write-then-rename,
  like `store.ts`), loading on boot. Keep the `record*`/`metricsSnapshot`
  function interface unchanged so routes don't move.
- Add derived `publish_rate` (publishes ÷ generations) to the snapshot — the
  second success signal from the vision doc, currently only derivable by hand.

Acceptance: restart the server, `GET /api/metrics` shows pre-restart counts.

### 3. Guest page: add-to-calendar — ✅ shipped

Shipped as FR-4.5. Original plan for reference:

- "Add to calendar" action next to share/maps: a client-side generated `.ics`
  download built from the published brief's date/time/venue (Google Calendar
  URL as a second option). No server work, no LLM cost.
- Degrade gracefully when the brief has no date (hide the action).

Acceptance: an invitation with a date yields a valid `.ics` that imports with
correct title, date/time, and location; bilingual labels via `i18n.ts`.

### Sequencing

1 is the blocker and lands first (with ADR-008). 2 and 3 are independent of
it and of each other — either can ride along. All three together are one
small iteration; nothing here touches the pipeline, schemas, or routing table.

## AI background image layer — ✅ shipped

Shipped as FR-10 per [ADR-009](decisions/adr-009-ai-background-layer.md)
(accepted; scrim/split/ornament decisions synced from the E-invitation DS
`templates/card-background` mockups). Original implementation order for
reference:

1. **Schema + types** — nullable `background: { id }` on `Invitation`
   (`schemas.ts` + hand-mirrored `web/src/types.ts`, one PR).
2. **Image adapter + route entry** — small native-fetch Gemini image call
   beside `openaiCompat.ts`; routing + pricing entries so the coverage test
   applies.
3. **`POST /api/invitations/background`** — brief + tokens in, stored asset
   reference out; `GET /api/backgrounds/:id` serves bytes with cache
   headers. New `LIMIT_BACKGROUNDS_PER_DAY` guardrail (default 3), cost into
   the budget breaker, BYOK bypass per adr-008.
4. **Editor + preview** — "Add background" / regenerate / remove in the
   design controls; scrim layer in `InvitationPreview` + `styles.css` per
   the mockups; guest page composites the same way.
5. **Docs** — FR-10, ADR-009 → accepted, NFR cost/latency notes.

Acceptance: an invitation with a background stays readable in all
palette/layout combinations; generation failure leaves the CSS-only card
untouched; a non-BYOK fourth background request in a day gets 429; OG share
card is unchanged.

## Deliberately not this iteration (candidate backlog)

- ~~**RSVP CSV export** on the host dashboard~~ — ✅ shipped as FR-5.3.
- **Custom domain** — deployment work, independent of product code.
- **SQLite (or similar) store** — only when multi-instance hosting or RSVP
  volume breaks the NFR-7 single-process assumption; interfaces are ready.
- **Per-key metering/credits** — stays rejected-for-now (adr-006); revisit
  only if the free-tier + rate-limit model proves too tight for real traffic.
