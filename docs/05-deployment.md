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
   - Optional: `LLM_BASE_URL` — internal address of the hosted LiteLLM proxy
     (see below). Without it the SDK calls Anthropic directly and
     non-Anthropic fallbacks in `routing.ts` simply fail over.
5. Deploy. Northflank rebuilds on every push to `main` (CI is built in).

## Hosted LiteLLM proxy (optional; required for Gemini/OpenAI in prod)

Non-Anthropic models resolve only through LiteLLM. In prod that's a
**second Northflank service** in the same project:

1. **Combined service** from the same repo:
   - Build type: **Dockerfile**, path `/litellm/Dockerfile`, context
     `/litellm` (the config is baked into the image — rebuild on config
     changes).
2. **Networking**: port **4000** (HTTP), **internal only — do not enable the
   public endpoint.** The proxy has no auth (`master_key` unset); anyone who
   can reach it can spend the API keys.
3. **Environment**: only the keys for providers you use — `GEMINI_API_KEY`,
   `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`. Missing keys are fine: those
   models error at the proxy and the gateway's walker moves on. (The
   `gemma3-4b` Ollama entry always fails in prod — it points at a dev-machine
   host — and is skipped the same way.)
4. On the **app service**, set `LLM_BASE_URL` to the proxy's internal
   address (Northflank internal DNS: `http://<service-name>:4000`) and
   restart.

**Gemini free-tier testing** (no Anthropic key): this works — every task's
walker falls through the Claude/OpenAI entries (fast auth errors at the
proxy) and lands on `gemini-2.5-flash`. Mind the quota: ~20 requests/day on
the free tier and one generation costs 3 calls (brief + copy + design), so
expect roughly 6 generations/day before 429s. `gemini-2.5-pro` has zero
free-tier quota; its config entry only matters with a paid key.

**BYOK** ([adr-006](decisions/adr-006-byok-passthrough.md)) needs no extra
deployment config beyond the proxy being up to date: the per-request key
override rides on `configurable_clientside_auth_params` entries in
`litellm/config.yaml`, and the config is baked into the proxy image — a
config change without a proxy-service rebuild silently breaks BYOK for
Gemini/OpenAI keys. Hosts with their own keys spend their own quota, so the
operator-key limits above stop being the ceiling.

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

- BYOK / user-level keys through the proxy — see
  [adr-002](decisions/adr-002-llm-gateway.md).
- Custom domain: add it in Northflank's DNS settings when ready; nothing in
  the app hardcodes the host (share URLs and OG meta derive from the request).
