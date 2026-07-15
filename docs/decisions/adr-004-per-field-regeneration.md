# ADR-004 — Per-field regeneration, never whole-invitation

**Status:** accepted · **Date:** 2026-07

## Context

Hosts rarely reject an entire generated invitation; they dislike one line.
Whole-invitation "reroll" throws away text the host already accepted (or hand
edited), costs a full pipeline run, and destroys the user's sense of control.

## Decision

Regeneration is scoped to a single copy field:
`POST /api/invitations/regenerate-field` takes (brief, field, current value)
and returns one rewritten value. There is no whole-invitation regenerate in
the API or the UI.

## Consequences

- Hand edits to other fields are never clobbered; cost per retry is one small
  completion (512-token cap).
- Per-field regeneration counts feed the **regenerate-rate** — the primary
  copy-quality KPI — and reveal *which* field the prompt is weakest at.
- If the host wants a fundamentally different invitation, they edit the input
  sentence and generate anew (which intentionally detaches any published
  link).
