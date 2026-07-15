# ADR-001 — TypeScript everywhere (Fastify API, not FastAPI)

**Status:** accepted · **Date:** 2026-07

## Context

The original plan called for a React frontend with a Python FastAPI backend.
The backend's real job is thin: validate requests, orchestrate 1–3 LLM calls,
persist small JSON records.

## Decision

One language across the stack: Fastify + TypeScript on the server, Vite +
React on the web, organized as a pnpm monorepo. Zod schemas on the server are
the source of truth; the web mirrors them by hand.

## Consequences

- One toolchain, one test runner (vitest), shared idioms; schema shapes can be
  read across the boundary without translation.
- Losing Python's ML ecosystem is acceptable — all model work happens behind
  the LLM provider API, not in-process.
- The hand-mirrored `web/src/types.ts` is a known sync liability (NFR-8);
  acceptable until the schema count grows enough to justify codegen or a
  shared package.
