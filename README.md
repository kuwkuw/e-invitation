# Invitation App

E-invitation web app: describe your event in one sentence → get an AI-generated, editable invitation. Bilingual (Ukrainian/English). Planned: share link + RSVP page, no guest registration.

## Layout

- `server/` — Fastify + TypeScript API. Pipeline: brief extraction → parallel copy + design tokens → invitation JSON. LLM routing table in `src/llm/routing.ts`.
- `web/` — Vite + React editor and deterministic invitation preview (design tokens → CSS, no image generation).

## Quick start

```sh
# terminal 1 — API (port 3001)
cd server
cp .env.example .env   # add your ANTHROPIC_API_KEY
npm install
npm run dev

# terminal 2 — UI (port 5173)
cd web
npm install
npm run dev
```

Open http://localhost:5173, type a sentence like
`Олена запрошує друзів на день народження 12 серпня о 18:00, кафе «Затишок», Львів` — and edit the result.

## Tests

```sh
cd server && npm test
```
