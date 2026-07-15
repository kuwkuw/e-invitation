# ADR-005 — Capability URLs instead of accounts

**Status:** accepted · **Date:** 2026-07

## Context

Guests must never register (core product constraint), and forcing hosts
through signup before they've seen value would kill the funnel. The product
needs exactly two authorities: "can view + RSVP" and "can republish + read
RSVPs".

## Decision

Both authorities are unguessable random tokens, not identities:

- The **share id** (8 random bytes, base64url, in the URL `/i/:id`) grants
  view + RSVP.
- The **manage token** (16 random bytes, hex) is returned once at publish,
  grants republish + RSVP-list read, is compared in constant time, and is
  never included in any public payload. The web client stashes it in
  `localStorage`.

No users table, no sessions, no passwords.

## Consequences

- Zero-friction for both roles; nothing personal is stored beyond RSVP form
  contents (NFR-4).
- Anyone holding the link can view/RSVP — acceptable, that is what a share
  link means. Anyone holding the manage token owns the invitation; losing it
  means losing host access (no recovery path — a known trade-off).
- If accounts arrive later (e.g. for BYOK, ADR-002), tokens can be attached to
  users without changing the guest-side model.
