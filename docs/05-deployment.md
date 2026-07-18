# Deployment (Northflank)

The app deploys as **one container**: the Fastify server serves the API, the
built SPA (`web/dist`), the `/i/:id` share pages with OG meta, and the OG
images. The [Dockerfile](../Dockerfile) is a two-stage pnpm-workspace build;
the runtime image carries only the server's production deps plus built
artifacts.

## Why one service

- The share link and its OG image must be same-origin with the SPA — one
  host means `/i/:id` works with no reverse-proxy routing rules.
- The file store ([store.ts](../server/src/store.ts)) writes JSON files under
  `DATA_DIR`; a single instance with a persistent volume is the supported
  topology until a real DB lands (the store's five functions are the swap
  seam). **Do not scale above 1 instance.**

## Northflank setup

1. **Create a project**, then a **combined service** (build + deploy):
   - Repository: `kuwkuw/e-invitation`, branch `main`
   - Build type: **Dockerfile** (path `/Dockerfile`, context `/`)
2. **Networking**: expose port **3001** (HTTP), enable the public endpoint.
   Health check: `GET /healthz`.
3. **Volume**: create a persistent volume (1 GB is plenty) and mount it at
   **`/data`** (the image sets `DATA_DIR=/data`).
4. **Environment** (runtime secrets):
   - `ANTHROPIC_API_KEY` — required for generation (the primary models).
   - Optional: `LLM_BASE_URL` if a hosted LiteLLM proxy exists (none yet —
     without it, non-Anthropic fallbacks in `routing.ts` simply fail over,
     which is the intended prod behavior for now).
5. Deploy. Northflank rebuilds on every push to `main` (CI is built in).

## What the server does differently in production

- `trustProxy` is enabled, so `og:image` URLs honor `x-forwarded-proto`
  (https) behind the platform proxy.
- When `web/dist/index.html` exists next to the server (as in the image), the
  server serves the SPA: static assets via `@fastify/static`, and any
  non-`/api` GET falls back to the SPA shell (`/`, `/create`, deep links).
  `/i/:id` stays dynamic — SPA shell with per-invitation OG meta injected.
- Without `web/dist` (local dev), behavior is unchanged: Vite serves the SPA
  on 5173 and proxies `/api`.

## Local smoke test

```sh
docker build -t inv-app:test .
docker run --rm -p 3001:3001 -v inv-app-data:/data inv-app:test
# then: /healthz, / (landing), /create, POST /api/invitations/publish,
# GET /i/:id (og meta), GET /api/invitations/:id/og.png
```

Generation requires `ANTHROPIC_API_KEY` (pass with `-e`); everything else
works keyless.

## Not covered yet

- Hosted LiteLLM proxy (multi-provider in prod) and BYOK — see
  [adr-002](decisions/adr-002-llm-gateway.md).
- Custom domain: add it in Northflank's DNS settings when ready; nothing in
  the app hardcodes the host (share URLs and OG meta derive from the request).
