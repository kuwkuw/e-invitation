# ADR-008 — Operator-cost guardrails: per-IP daily limits + budget breaker

**Status:** accepted · **Date:** 2026-07 · Settles the "consumer cost model"
open question from the FR backlog; complements
[adr-006](adr-006-byok-passthrough.md) (BYOK) and
[adr-007](adr-007-in-process-providers.md) (free-tier-first routing).

## Context

The two LLM-backed endpoints (`generate`, `regenerate-field`) spend the
operator's provider quota/keys and were open to anyone with the URL — the
blocker to sharing the app with real hosts. The consumer cost model was
deliberately undecided between (a) operator-paid + limits and (b) per-key
metering/credits. Measured cost is ~$0.0007/generation on paid-tier
`gemini-2.5-flash` (2026-07-20); free tiers cover normal traffic. BYOK
(adr-006) already lets a power user spend their own key.

## Decision

Option (a): **operator-paid, free-tier-first routing, bounded by two
in-process guardrails** (`server/src/guardrails.ts`), checked after request
validation and before any LLM work:

1. **Per-IP daily allowance** — `LIMIT_GENERATIONS_PER_DAY` (default 10) and
   `LIMIT_REGENERATIONS_PER_DAY` (default 30) per client IP per UTC day.
   Over-limit requests get `429` with a user-safe message; the web client
   maps it to a bilingual message pointing at the BYOK escape hatch.
2. **Daily global budget breaker** — the gateway reports each successful
   operator-key request's estimated cost; past `DAILY_BUDGET_USD` (default 5)
   operator-key requests get `503`. Catches distributed abuse that per-IP
   limits miss.

Shared properties:

- **BYOK requests bypass both** — they spend the caller's key, making "add
  your own key" the documented way past every limit.
- An allowance unit is consumed at admission, not on success — failed
  generations still hammer providers, so they count.
- State is in-process and resets on restart/deploy — same single-process
  assumption as NFR-7. Per-IP entries all expire together at UTC midnight,
  bounding memory at one day of distinct IPs.
- `GET /healthz` exposes the configured limits and today's spend
  (`guardrails` key); setting a limit env var to `0` disables that guardrail.

## Consequences

- The app can be shared publicly: worst-case operator spend per day is capped
  by the budget breaker regardless of traffic shape.
- Shared IPs (offices, CGNAT) share an allowance; the ceiling is deliberately
  generous relative to real usage (one host ≈ 1–2 generations per event) and
  BYOK is the pressure valve. Revisit only on real complaints.
- A restart refills the day's allowances and budget — acceptable leniency;
  persistence would buy little at this scale.
- Per-key metering/credits stays rejected-for-now (adr-006); revisit if
  free-tier + limits proves too tight for real traffic.

## Amendment 2026-10-29: guest replies share the per-IP allowance

`POST /api/invitations/:id/rsvp` spends no LLM capacity, so this ADR left it
out. It is still the app's only unauthenticated write: it had no limit of any
kind, each reply rewrites the whole record file, and the link it serves is
made to be posted in group chats. The cost is disk and a host's reply list,
not money, but the mechanism above already fits it.

- **A third per-IP allowance**: `LIMIT_RSVPS_PER_DAY` (default 30) replies per
  client IP per UTC day, across every invitation, through the same
  `consumeIpAllowance`. Over it, `429`. A guest replies once and may change
  their mind (FR-4.4), so 30 leaves room for a household on one connection
  answering several invitations.
- **Admitted after validation**, as the LLM endpoints are: a dead link (`404`)
  or a malformed reply (`400`) spends nothing.
- **No BYOK bypass**, because there is no key to spend, and **no budget
  breaker**: nothing here has a cost estimate to feed one.
- **The guest page says so**: a `429` shows its own message in the
  invitation's language, that the day's replies from this network are used
  up, rather than "try again", which would only fail again (FR-9.5).
- `/healthz` reports it beside the others as `rsvps_per_ip_per_day`.

The shared-IP consequence above weighs more here. Guests, unlike hosts,
arrive in numbers and often on mobile carriers that put many subscribers
behind one address. The allowance counts per day across every invitation,
and at today's traffic (ten guest views in the product's life) no real IP
comes near 30. If a real guest is ever refused, raise the default before
reaching for anything finer.

Not done: **a cap per record**. It would bound one invitation's file however
many addresses wrote to it, but once reached it locks out that invitation's
real guests, which turns a disk problem into an outage for one host. It waits
for a record that actually grows.
