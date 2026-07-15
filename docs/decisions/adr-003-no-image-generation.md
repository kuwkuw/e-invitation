# ADR-003 — No full-image generation; design = closed-enum tokens

**Status:** accepted · **Date:** 2026-07

## Context

The obvious "AI invitation" approach is diffusion-generated images. That path
has unacceptable costs for this product: text inside generated images is
unreliable (especially Ukrainian), per-field editing becomes impossible,
latency and cost balloon, and output quality is unpredictable.

## Decision

The model never produces visuals. It selects **design tokens** from closed
enums — `palette`, `typography`, `layout`, `ornament`
(`server/src/schemas.ts`) — and the client maps each token 1:1 to
handcrafted CSS (`InvitationPreview.tsx` + `styles.css`). Rendering is fully
deterministic; model output is never interpreted as markup or styles.

An optional AI **background layer with no text** is permitted by this decision
but not built.

## Consequences

- Editing stays live text; latency stays in single-completion territory;
  every design combination is human-vetted CSS, so quality has a floor.
- Doubles as a security boundary: LLM output cannot inject markup/styles
  (NFR-4).
- Design variety is bounded by the enum space (currently 6×3×3×4 = 216
  combinations); growing variety means adding enum values + CSS, not loosening
  the schema. **Never widen tokens to free-form strings.**
