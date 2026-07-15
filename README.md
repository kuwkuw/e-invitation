# Invitation App

E-invitation web app: describe your event in one sentence → get an AI-generated, editable invitation. Bilingual (Ukrainian/English). Planned: share link + RSVP page, no guest registration.

## Docs

Vision, functional/non-functional requirements, architecture, and ADRs live in
[docs/](docs/README.md).

## Layout

- `server/` — Fastify + TypeScript API. Pipeline: brief extraction → parallel copy + design tokens → invitation JSON. LLM routing table in `src/llm/routing.ts`.
- `web/` — Vite + React editor and deterministic invitation preview (design tokens → CSS, no image generation).

## Quick start

pnpm monorepo — one install and one command for both servers:

```sh
cp server/.env.example server/.env   # add your ANTHROPIC_API_KEY
pnpm install
pnpm dev   # API on 3001 + UI on 5173
```

Open http://localhost:5173, type a sentence like
`Олена запрошує друзів на день народження 12 серпня о 18:00, кафе «Затишок», Львів` — and edit the result.

## Tests

```sh
pnpm test
```
