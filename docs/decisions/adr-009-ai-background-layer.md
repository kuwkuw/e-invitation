# ADR-009 — Optional AI background image layer

**Status:** accepted · **Date:** 2026-07 · Extends
[adr-003](adr-003-no-image-generation.md) (which explicitly allows this
layer); interacts with [adr-007](adr-007-in-process-providers.md) (transport)
and [adr-008](adr-008-operator-cost-guardrails.md) (cost guardrails).

## Context

The invitation's visual ceiling is currently the six palettes × four
ornaments of deterministic CSS. ADR-003 rejected full-image generation
(text-in-image typography risk, no post-editing) but left the door open for
"an optional AI-generated *background* layer (no text in the image) composited
under the deterministically rendered copy". The cost guardrails (adr-008) now
exist, so a per-request image cost is boundable. This ADR settles how the
layer works before any code.

## Decision

### 1. The trust boundary of adr-003 holds unchanged

The model never returns URLs, markup, or styles. The flow is entirely
server-mediated:

- The **server** builds the image prompt from the structured brief + chosen
  design tokens (event type, tone, palette mood), with an explicit "no text,
  no lettering, no typography" instruction. The host does not type a free-form
  image prompt in v1 — less prompt-injection surface, less moderation surface.
- The **server** calls the image provider, receives raw image bytes, and
  stores them itself. The invitation JSON carries only an opaque
  `background: { id }` reference (nullable — absent means today's CSS-only
  card). The client composites `GET /api/backgrounds/:id` under the copy.
- Rendered text stays deterministic CSS on top; a background never carries
  words.

### 2. Post-generate action, not part of the 3s pipeline

Image generation is 5–20s and ~10–50× the cost of a text generation — it
would wreck NFR-1 if it sat in the generate pipeline. So it is an explicit
editor action ("Add background" in the design controls) on an existing
invitation: request carries the brief + design tokens, response is the asset
reference. Regenerating replaces the reference (per-field regeneration
philosophy, adr-004); removing it reverts to CSS-only. Publish snapshots the
reference like any other invitation field.

### 3. Provider: Gemini image model, single-model route

`gemini-2.5-flash-image` through the existing Gemini key — the operator
already has one and it is the cheapest capable option: $0.039/image on the
paid tier (checked 2026-07-22; the newer `gemini-3.1-flash-image` runs
$0.045–0.15/image by resolution and is the upgrade path if quality
disappoints). Google no longer publishes fixed free-tier image quotas —
check the current one in AI Studio at implementation time, and budget as if
every image were paid. Note free-tier prompts may be used to improve
Google's products; production should run on a paid-tier key. And
BYOK Gemini keys can ride the existing header mechanism unchanged. No
fallback chain in v1: image style consistency across providers isn't worth
the surface, and a failed generation degrades to the CSS-only card the host
already has. The adapter is a small native fetch call beside
`openaiCompat.ts` (image responses don't fit the chat-completions shape);
the routing-table entry + pricing entry keep `routing.ts`/`pricing.ts` the
single switch points, and `test/routing.test.ts`'s pricing-coverage rule
applies.

### 4. Readability: palette-owned scrim (settled by the E-invitation DS
### mockups, `templates/card-background`, 2026-07-22)

Palettes keep owning text colors; the scrim alone guarantees contrast
(target WCAG AA for body text). The DS comparison rejected neutral
white/black scrims (they wash the palette's warmth out) in favor of a
gradient tinted in the palette's own background hue:

- Each palette (except `minimal`) exposes its background as an RGB triplet
  (`--bg-rgb`); the scrim overlay is
  `linear-gradient(180deg, rgba(var(--bg-rgb), .74) 0%, rgba(var(--bg-rgb), .90) 100%)`
  (festive, the dark palette, starts at `.72`). Triplets: warm `247,239,227`,
  romantic `251,238,240`, elegant `252,251,248`, playful `255,248,225`,
  festive `31,42,68`.
- Default strength is **strong** (the values above) — it survives the DS's
  deliberately hostile high-contrast test image. A *soft* variant
  (`.45 → .60`) exists in the DS for photos known to be quiet, but is not
  exposed in v1.
- **`split` layout:** the image is confined to a side panel (~38% width,
  `object-fit: cover`, no scrim); the text panel stays solid `--bg`. Never
  whole-card — the DS comparison showed the accent details border and
  left-aligned text muddying over an image.
- **Ornaments stay**, rendered in the content layer above the scrim (banner
  already hides its top ornament; unchanged).
- **`minimal` is excluded** from backgrounds entirely: a scrim strong enough
  for AA on pure white erases the image, defeating both.
- With no image the overlay elements are simply not rendered — the card is
  identical to today's.

### 5. Storage next to the invitation store

Assets are PNG/WebP files under `DATA_DIR/backgrounds/<id>` (ids random
base64url, same regex guard discipline as invitation ids), written
write-then-rename. They ride the same volume/backup story as the store. An
asset generated in the editor but never published is garbage — v1 accepts
the leak (assets are ~100s of KB and rate-limited); a sweep can come later.

### 6. Guardrails: own counter, shared budget

A new per-IP allowance `LIMIT_BACKGROUNDS_PER_DAY` (default 3 — an order of
magnitude pricier than text, so an order of magnitude tighter) and the image
cost feeds the existing daily budget breaker. BYOK bypasses per adr-008.

### 7. OG share card stays token-only in v1

The satori render keeps mirroring the CSS token maps; it does not composite
the background. Messenger previews stay fast and deterministic; parity can
come later if hosts ask.

## Consequences

- The invitation schema gains its first nullable asset reference —
  `web/src/types.ts` must mirror it in the same PR (NFR-8), and the guest
  page + preview learn one conditional layer.
- A new binary-serving endpoint means content-type discipline and cache
  headers, but no new auth surface (backgrounds are as public as the
  invitation).
- Single-provider dependency for the feature: Gemini image trouble means
  "Add background" fails gracefully while everything else keeps working.
- Operator cost is bounded by design: 3/IP/day × $0.039 within the existing
  daily budget cap.

## Formerly open questions — both closed

1. ~~Scrim strength + `split` layout treatment~~ — settled by the
   E-invitation DS `templates/card-background` mockups (see §4).
2. ~~Verified pricing~~ — done ($0.039/image paid tier, 2026-07-22); the
   operator key's current free-tier image quota is still worth a glance in
   AI Studio, but the budget breaker treats every image as paid regardless.
