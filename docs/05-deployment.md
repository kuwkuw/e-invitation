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
4. **Environment** (runtime secrets) — provider calls are made in-process
   ([adr-007](decisions/adr-007-in-process-providers.md)); set only the keys
   for providers you use, missing ones fail instantly and the routing walk
   moves on:
   - `GROQ_API_KEY` + `GEMINI_API_KEY` — the free-tier MVP pair; the default
     routes in `routing.ts` run entirely on these.
   - Optional: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` — paid fallbacks. (The
     `gemma3-4b` Ollama entry always fails in prod — it points at a
     dev-machine host — and is skipped the same way.)
5. Deploy. Northflank rebuilds on every push to `main` (CI is built in).

**Free-tier quotas**: one generation costs 3 calls (brief + copy + design).
Groq's free tier (~1k requests/day) carries brief extraction and design;
Gemini's free tier (~20 requests/day observed) is reserved for copy and
field regeneration, so expect roughly 20 copy calls/day before Gemini 429s
push copy onto the Groq fallback. `gemini-2.5-pro` has zero free-tier quota;
it only matters with a paid key.

**BYOK** ([adr-006](decisions/adr-006-byok-passthrough.md)) needs no
deployment config at all: the per-request key from the `x-llm-key` header is
used directly as that request's provider credential (Anthropic keys via a
per-request SDK client, Gemini/OpenAI keys as the bearer token of the
in-process call). Hosts with their own keys spend their own quota, so the
operator-key limits above stop being the ceiling.

> History: until adr-007 the non-Anthropic providers resolved through a
> hosted LiteLLM Proxy sidecar. It idled at ~1 GiB and was OOM-killed on
> smaller plans (verified: 512 MB → exit 137, silent restart loop), which is
> why it was replaced with in-process calls.

## What the server does differently in production

- `trustProxy` is enabled, so `og:image` URLs honor `x-forwarded-proto`
  (https) behind the platform proxy.
- When `web/dist/index.html` exists next to the server (as in the image), the
  server serves the SPA: static assets via `@fastify/static`, and any
  non-`/api` GET falls back to the SPA shell (`/`, `/create`, deep links).
  `/i/:id` stays dynamic — SPA shell with per-invitation OG meta injected.
- Without `web/dist` (local dev), behavior is unchanged: Vite serves the SPA
  on 5173 and proxies `/api`.

## Custom domain

Nothing in the app hardcodes the host — share URLs come from
`window.location.origin` and OG meta/image URLs from the request's
`Host`/`x-forwarded-proto` (trustProxy) — so a custom domain is pure
platform config plus one env var:

1. **Northflank**: service → *Networking* → *Domains* → add your domain
   (e.g. `invito.example.com`) to the port-3001 public endpoint.
2. **DNS**: at your registrar, create the **CNAME** record Northflank shows
   for the domain (apex domains need ALIAS/ANAME or the platform's A
   records). Wait for it to verify; Northflank then provisions and renews
   the TLS certificate automatically.
3. **`CANONICAL_HOST=invito.example.com`** (runtime env): requests hitting
   the service on any other host — the old `*.code.run` endpoint in
   particular — get a `301` (GET/HEAD; `308` otherwise) to the same path on
   the canonical domain. Share links published before the switch keep
   working, and messengers re-unfurl them from one origin. `/healthz` is
   exempt so platform health checks pass on the internal address. Leave the
   var unset until DNS + TLS verify — setting it early would redirect onto a
   domain that doesn't resolve yet.
4. Verify: `https://invito.example.com/healthz`, publish an invitation and
   check the share link + `og:image` URL use the new domain, and confirm the
   old `*.code.run/i/:id` link 301s.

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

- Per-key metering/budgets — deferred (see
  [adr-006](decisions/adr-006-byok-passthrough.md)).
