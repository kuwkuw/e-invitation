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

**The domain is `invinto.app`**, registered and DNS-hosted at Cloudflare.

Nothing in the app hardcodes the host — share URLs come from
`window.location.origin` and OG meta/image URLs from the request's
`Host`/`x-forwarded-proto` (trustProxy) — so a custom domain is platform config
plus one env var. Two things about *this* domain and registrar are not
optional, though; both are below.

1. **Northflank**: service → *Networking* → *Domains* → add `invinto.app` to
   the port-3001 public endpoint.
2. **DNS at Cloudflare**: create the record Northflank shows. Cloudflare
   flattens CNAMEs at the apex, so `invinto.app` itself can be a CNAME — no
   ALIAS/A-record juggling. **Leave the record DNS-only (grey cloud) until
   Northflank has verified the domain and issued its certificate**; a proxied
   record can intercept the ACME challenge and the certificate never arrives.
3. **If you re-enable the Cloudflare proxy afterwards, set SSL/TLS mode to
   `Full (strict)`.** This is not a preference. `trustProxy` is on, so
   `request.protocol` follows `x-forwarded-proto`, and Cloudflare's *Flexible*
   mode talks plain HTTP to the origin — which would make the server emit
   `og:image` as an `http://` URL. On `.app` that URL is unfetchable (see
   below), so messenger previews would silently stop unfurling: FR-3.5 gone,
   with nothing in the logs. Flexible also drops the `Secure` flag from the
   session cookie. `Full (strict)` keeps `x-forwarded-proto: https` and both
   stay correct.
4. **`.app` is HSTS-preloaded as a whole TLD**, by Google, in every major
   browser. Every connection to `invinto.app` is HTTPS or it does not happen —
   there is no http to redirect *from*. That is a good default and it costs
   nothing here, but it does mean an accidental `http://` URL is a hard failure
   rather than a redirect, which is exactly why step 3 matters.
5. **`CANONICAL_HOST=invinto.app`** (runtime env): requests reaching the service
   on any other host — the `*.code.run` endpoint in particular — get a `301`
   (GET/HEAD; `308` otherwise) to the same path on the canonical domain. Share
   links published before the switch keep working, and messengers re-unfurl
   them from one origin. `/healthz` is exempt so platform health checks pass on
   the internal address. Leave the var unset until DNS + TLS verify — setting it
   early would redirect onto a domain that does not resolve yet.
6. Verify: `https://invinto.app/healthz`, publish an invitation and check the
   share link + `og:image` URL both use `https://invinto.app`, and confirm the
   old `*.code.run/i/:id` link `301`s.

## Host sign-in with Google (adr-014)

Optional. With `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` unset the server
boots, sign-in is not offered, and publishing stays anonymous — the supported
mode for local development and self-hosting
([adr-014](decisions/adr-014-host-accounts.md) §7). Account state lives in
`DATA_DIR/app.db`, so the volume in step 3 already carries it and no extra
storage is needed.

1. **Google Cloud console** → *APIs & Services* → *Credentials* → *Create
   credentials* → **OAuth client ID**, type *Web application*.
2. **Authorized redirect URI**: `https://<your-host>/api/auth/google/callback`.
   Google matches this against a fixed allowlist **character for character**,
   so it must be exact, including which host. An unregistered host fails at
   Google with `redirect_uri_mismatch` — nothing reaches the app, so nothing
   appears in its logs.

   **A registrable domain of your own is required. The Northflank preview
   hostname cannot be used, in any mode.** Google refuses any redirect URI
   whose host is not a *top private domain*, and `*.code.run` is on the
   [Public Suffix List](https://publicsuffix.org/list/), submitted by
   Northflank. The rule is a wildcard, so
   `p01--yourapp--xxxxxxxx.code.run` is not a domain *under* a public suffix —
   it **is** one, with no registrable domain beneath it. The console rejects it
   at entry with "must use a domain that is a valid top private domain". This
   is not a Testing-vs-Production distinction and there is no path, subpath or
   alternate spelling that gets round it. The same is true of every
   platform-preview domain on that list — `*.vercel.app`, `*.ngrok-free.app`
   and friends.

   So the order of operations is: **domain first, then sign-in**. Set up
   `invinto.app` above, confirm `https://invinto.app/healthz` answers, and only
   then create the OAuth client — against the canonical host:

   ```
   https://invinto.app/api/auth/google/callback
   ```

   `invinto.app` is a valid top private domain (`app` is a plain TLD on the
   Public Suffix List), so Google accepts it. Until the domain is live the
   deployment runs in the §7 unconfigured mode, which is fully functional —
   publishing simply stays anonymous.

   **Local development needs no domain.** Google exempts `localhost`, from both
   the HTTPS requirement and this one, so the whole flow can be exercised
   before any domain exists. Register both dev ports and leave
   `GOOGLE_REDIRECT_URI` unset so the server derives the URI from the request:

   ```
   http://localhost:5173/api/auth/google/callback   # what `pnpm dev` uses:
                                                    # Vite proxies /api and does
                                                    # not rewrite the Host header
   http://localhost:3001/api/auth/google/callback   # hitting the API directly
   ```

   Google allows several redirect URIs on one client, so the production URI is
   an **addition** later, not a swap — keep the localhost pair for development.

3. **Environment**:
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI=https://invinto.app/api/auth/google/callback` —
     set it explicitly in production. Unset, the server derives the URI from
     the incoming request, which is what makes `localhost` work with no second
     registration but is the wrong host behind `CANONICAL_HOST`.
4. **Roll the gate out separately from sign-in.** Deploy with
   `PUBLISH_REQUIRES_ACCOUNT=0` first, so hosts can sign in while anonymous
   publishing still works, then remove the var to close the gate. Turning both
   on at once means every publish returns `401` for as long as the client has
   no sign-in surface.
5. Verify `GET /healthz` → `auth: { google: true, publish_gate: … }`, then sign
   in and check `GET /api/account/keyring` returns your invitations.

**What closing the gate does to the numbers.** It freezes a baseline in
`metrics.json` — `GET /api/metrics` then reports `baseline.before` and
`baseline.since` alongside the lifetime figures. This matters because gating
publishes moves both `publish_rate` and adr-013's `new_hosts_per_publish` for
reasons unrelated to what either measures, and
[07-monetization](07-monetization.md) §5.1's thresholds were written against an
ungated denominator. The baseline is taken once and never moves; if
publish-rate drops sharply against it, `PUBLISH_REQUIRES_ACCOUNT=0` reopens
publishing without a deploy.

**Deleting an account** removes the user, their sessions and their keyring and
keeps every published invitation and RSVP (FR-11.7) — guests' share links must
not break.

## Reply notifications (adr-015)

Optional. Unset means no notifications and no other change (FR-12.9), which is
what local development and self-hosting run in.

This is the first thing the product needs that **cannot be fixed by a deploy**.
A misconfigured DKIM record does not fail — the API returns `200` and the mail
lands in spam, silently, for everyone.

1. **Create a Resend account** and add `invinto.app` as a sending domain.
   `server/src/email/send.ts` is one `fetch` at one endpoint, so switching
   providers later is that file and nothing else.
2. **DNS at Cloudflare**, alongside the records from the custom-domain section:
   - **SPF** — a `TXT` at the apex. If one already exists, **edit it**; a
     domain with two SPF records fails SPF entirely rather than merging them.
   - **DKIM** — the `CNAME`/`TXT` records Resend shows for the domain.
     **DNS-only (grey cloud)**, like the verification record above.
   - **DMARC** — a `TXT` at `_dmarc.invinto.app`. Start at
     `v=DMARC1; p=none; rua=mailto:…` so reports arrive without mail being
     rejected while the other two settle, and tighten to `p=quarantine` once
     the reports are clean.
3. **Runtime env**: `RESEND_API_KEY`, and `NOTIFY_FROM` on the verified domain
   (e.g. `HOSTYMO <replies@invinto.app>`). Optionally
   `NOTIFY_WINDOW_MINUTES` — default 60, `0` means notify on every reply.
4. **Notifications also need sign-in configured.** The address is the
   Google-verified one from adr-014; with no OAuth client there are no
   accounts, so nothing is ever sent.
5. **Verify by inbox placement, not by status code.** `GET /healthz` reports
   `notifications.configured`, which only says the two env vars are set.
   Publish a test invitation signed in, RSVP to it, and confirm the mail
   **arrives in the inbox** of a Gmail account *and* a Ukrainian provider
   (`ukr.net`, `meta.ua`) — the hosts this product actually serves, and the
   ones a new sending domain is most likely to be filtered by. Check the
   message's own headers for `dkim=pass` and `spf=pass`.
6. Verify the loop end to end: the email links to `/manage/:id` with **no**
   `#t=` fragment, its unsubscribe link opens a confirm page without
   unsubscribing, and pressing the button turns replies off across the account.

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
