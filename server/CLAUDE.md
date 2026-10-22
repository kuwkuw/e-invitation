# server/ — Fastify API

Loaded when working under `server/`. Repo-wide rules and commands are in the
root `CLAUDE.md`.

Provider keys live in `server/.env` (see `.env.example`). `GROQ_API_KEY` and
`GEMINI_API_KEY` are the free-tier pair the default routes run on;
`ANTHROPIC_API_KEY`/`OPENAI_API_KEY` are optional paid fallbacks. The server
boots keyless, but generation then fails.

## Generation pipeline (`src/pipeline/`)

Sentence → `extractBrief` (cheap model, structured `EventBrief`) →
**in parallel** `generateCopy` + `resolveDesign` → `Invitation`. Copy and
design depend only on the brief, so `generate.ts` always runs them with
`Promise.all`. Target: about 3 s from sentence to editable invitation.

- Regeneration is **per field, never the whole invitation**:
  `POST /api/invitations/regenerate-field` takes brief + field + current value.
- `EventBrief.language` (`uk`/`en`) is detected from the sentence and drives
  the copy language. It is independent of the UI language toggle.
- **After any prompt change, run `pnpm --filter inv-app-server eval`**, and
  when production shows a bad output, add its sentence to `eval/cases.ts`.
  The eval checks for invented facts (deadlines, years), placeholders and
  wrong language. Unit tests can't see those.

## LLM gateway (`src/llm/`)

- `routing.ts` is the **single operator switch point**: task → primary →
  fallbacks (plus per-task `maxTokens`), `MODEL_PROVIDERS` (model → transport)
  and `BYOK_FALLBACK_MODELS`. Change models here and nowhere else. Routing is
  free-tier-first (adr-007): Groq `openai/gpt-oss-120b` for volume tasks,
  Gemini `gemini-2.5-flash` for copy, paid Claude models as fallbacks only
  when `ANTHROPIC_API_KEY` is set.
- **A routed model can disappear with no code change.** Groq moved
  `llama-3.3-70b-versatile` to a paid tier on 2026-09-12 and every call
  silently fell through to Gemini's ~20/day tier. `/healthz` reports key
  *presence*, not reachability. `pnpm --filter inv-app-server probe` checks
  reachability (nightly in CI), or check `/v1/models` with the operator key.
  Try a replacement with `eval --model <id>` before editing routing.
- `gateway.ts` `completeJson()` walks the route until a model succeeds:
  schema-conformant JSON (Anthropic structured outputs via `zodOutputFormat`;
  `response_format` json_schema on the compat transport), lenient JSON
  extraction, then zod. It logs **one JSON line per request** (task, model,
  fallback, latency, tokens, cost, and `error_class`
  `auth`/`quota`/`connectivity`/`output-invalid`/`other`). The eval reads
  these lines, so keep their shape. When every model fails it throws
  `AllModelsFailedError`; the 502 body carries per-model `causes` (class only;
  raw messages stay in logs).
- `pricing.ts` needs an entry for every routed model (`test/routing.test.ts`).
- Providers are **in-process** (adr-007; the LiteLLM sidecar OOM-killed on
  small plans). `openaiCompat.ts` calls Gemini/OpenAI/Groq/Ollama over their
  OpenAI-compatible endpoints with plain `fetch`; a new provider is one entry
  in `PROVIDERS`. It owns the quirks: reasoning off for GPT models, Gemini
  thinking budget 0 via `extra_body.google.thinking_config` (or reasoning eats
  small `maxTokens` caps before any JSON), and the `gemma3-4b → gemma3:4b`
  alias. **Do not add a multi-provider client library.**
- Gemini free tier: zero for `gemini-2.5-pro`, ~20 `gemini-2.5-flash`
  requests/day. Expect daily 429s in heavy dev.

**BYOK** (adr-006): the host's key rides `x-llm-provider`/`x-llm-key` headers.
The walk then uses **only that provider's models**, never operator-key
fallbacks (`BYOK_FALLBACK_MODELS` when the route has none), and spends the key
directly. Groq/Ollama are never BYOK. Keys are never stored or logged:
`byok: true` is the only trace, and Fastify redacts the header.

**Guardrails** (adr-008, `src/guardrails.ts`): per-IP daily limits
(`LIMIT_GENERATIONS_PER_DAY`, `LIMIT_REGENERATIONS_PER_DAY` → 429) and a daily
budget breaker (`DAILY_BUDGET_USD` → 503) fed by the gateway's cost estimates,
for non-BYOK requests only. `0` disables one. `/healthz` reports limits and
today's spend.

**AI background** (adr-009): `POST /api/invitations/background` is an explicit
editor action, never part of the 3 s path. `llm/imageGen.ts` calls
`gemini-2.5-flash-image` (single model, Gemini-only for BYOK) with a
server-built no-text prompt and stores the PNG under `DATA_DIR/backgrounds/`.
The invitation carries only an opaque `background.id`
(`GET /api/backgrounds/:id`). The OG card stays token-only.

## Data and state

- `src/schemas.ts` (zod v4) is the source of truth for the data model.
  Design tokens are **closed enums**; never widen them to free text.
- Invitations are one JSON file per id in the file store (`store.ts`).
  Accounts live in SQLite **beside** it: `db.ts` opens `DATA_DIR/app.db` with
  `node:sqlite` through `createRequire`, because a plain import fails under
  Vite (Node 22 left `sqlite` out of `builtinModules`).
- **Module caches**: `db.ts`, `auth/google.ts`, `metrics.ts` and
  `snapshot.ts` hold process-lifetime state and export resets (`closeDb`,
  `resetJwksCache`, `resetMetricsCache`, `resetSnapshotState`). Tests give every case its own `DATA_DIR`; a new
  caching module ships with a reset too.
- **Backups** (`docs/05-deployment.md`, Backups): everything is on the one
  `/data` volume, backed up by Northflank volume schedules. `snapshot.ts`
  writes a consistent `snapshots/app.db` with `VACUUM INTO` on a timer
  (`DB_SNAPSHOT_MINUTES`), because the live WAL-mode database is two files a
  platform snapshot can catch out of step. It never runs at boot and never
  after a failed `quick_check`, so it can't replace the last good copy with a
  bad one. The timer starts in `index.ts`, not `buildApp()`, so tests start
  none. **Anything written to `DATA_DIR` must be safe to snapshot mid-write**:
  write whole and rename, as `store.ts` and `metrics.ts` do.
- **Metrics** (`metrics.ts`, `GET /api/metrics`): persisted to
  `DATA_DIR/metrics.json` by write-then-rename. Regenerate-rate is the copy
  quality signal; `views_per_publish` and `new_hosts_per_publish` (adr-013)
  gate every commercial option (`docs/07-monetization.md` §5.1). A new scalar
  counter goes in `SCALAR_COUNTERS` **and** in `load()`'s defaults,
  `readBaseline`'s literal and `totals()` (TypeScript catches all three). A
  key missing from an older file starts at 0. `gallery_publishes` makes
  `publish_rate` exceed 1 (subtract it to recover the old meaning).
  `markBaseline` is idempotent and already frozen in production: not reusable.

## Host accounts (adr-014)

An account is a **keyring, not an owner**. `manage_token` stays the
credential every host endpoint checks in constant time; a session can only
read back the tokens it holds and authorize a *first* publish.
`accounts.ts` authorizes nothing and stores no manage token: the keyring is
`(user_id, invitation_id)`, and `routes/account.ts` joins the token off the
record.

- Google OIDC (code + PKCE, `openid email`, no JS SDK) in `auth/google.ts`.
  The session is an opaque hashed id in an httpOnly `SameSite=Lax` cookie with
  **`Path=/api`**, so it never rides `/i/:id` or the OG request.
- No OAuth client = no gate. `PUBLISH_REQUIRES_ACCOUNT=0` keeps publishing
  anonymous while sign-in works. `/api/auth/session` reports `publish_gate`.
  Closing the gate froze the metrics baseline (`markBaseline`).
- `POST /api/account/claim` files every manage token the browser proves it
  holds into the account: per-item authorized, idempotent, deliberately not
  exclusive. `linked` counts rows *inserted*.
- Sign-out and account deletion keep every invitation and RSVP (FR-11.7).
- A request carrying many manage tokens authorizes **each item on its own**:
  `POST /api/invitations/counts` (adr-012, the first one) and the claim above.

## Reply notifications (adr-015)

Three modules, three jobs: `notifications.ts` is state, `email/send.ts` is
transport (one `fetch`, never throws, every failure a returned reason),
`email/replyNotifier.ts` decides.

- The **preference is per account** (`notification_prefs`), the **rate window
  per invitation** (`notification_sends`).
- **Opt-in**: no prefs row means disabled, the eligibility join requires
  `enabled = 1`, and `ensurePref` mints a row that is off.
- Eligibility is the keyring, so an anonymous invitation notifies nobody.
- Count-only email, **never a guest name**, linking to bare `/manage/:id`
  with no `#t=`.
- Sent from the RSVP route, **never awaited**. `addRsvp` is immutable: hand
  the notifier its *return value*.
- `/unsubscribe/:token` is **outside `/api`**: `GET` renders a confirm step and
  must never mutate (mail scanners follow links); `POST` mutates, with no
  origin check (RFC 8058 one-click is cross-origin), through a form-encoded
  body parser Fastify doesn't register by default.

## Share loop (adr-013)

Measured, not incentivized. `POST /api/invitations/:id/view` is a counter, not
a security control, deduplicated by `views.ts` (an in-process `(ip,
invitation)` set that resets at UTC midnight). `GenerateSource` is a closed
`direct`/`guest`/`gallery` enum on purpose: carrying the referring id would
build the host graph adr-005 and adr-012 refused.

## SEO and the SPA shell (adr-016, adr-017)

`src/seo.ts` is the **single place** that decides each path's head:
`SEO_STRINGS`, `headTags`, `shellMeta`, `robotsTxt`, `sitemapXml`. Its callers
are the SPA fallback in `app.ts` and `/i/:id` in `routes/og.ts`.

- The shell's default block between `<!--seo:start-->`/`<!--seo:end-->` in
  `web/index.html` is **replaced, never appended to**: `og:title` is
  first-one-wins in unfurlers. `test/seo.test.ts` pins it to
  `shellMeta("/", "", DEFAULT_ORIGIN)`.
- **Only `/` and the gallery are indexed.** `/create`, `/manage/:id`, `/i/:id`
  and unknown paths are `noindex` with an `X-Robots-Tag` header and **no
  canonical** (`og:url` stays on `/i/:id`).
- **Don't tidy `robots.txt`**: it does **not** disallow `/i/`, and it
  `Allow`s `/api/invitations/*/og.png` before `Disallow: /api/`. Messenger
  crawlers obey robots.txt, so either change silently stops every share link
  unfurling (FR-3.5).
- `robots.txt`/`sitemap.xml` are routes (they need an absolute origin from
  `CANONICAL_HOST`), not files in `web/public/`.
- `SITE_IMAGE_PATHS` picks one share card per language (`/og-cover.png`,
  `/og-cover-en.png`); `test/seo.test.ts` checks each PNG exists.
- `selectPrerender` keeps the requested page×language block and **strips the
  rest on every other path** (or a guest sees the marketing hero under their
  link). It **scans for whatever markers are present** rather than walking a
  fixed list. Keep it that way.

## OG images

`og/render.ts`: satori + resvg render the 1200×630 share preview from the same
tokens. Its style maps mirror `styles.css` by hand. Fonts are vendored TTFs in
`assets/fonts/` (satori can't use the runtime Google Fonts import).
`GET /i/:id` serves the SPA shell with the invitation's head swapped in;
`?v=<version>` on the image URL busts messenger caches on republish. A satori
upgrade can move layout without failing a test (0.63 changed how padding adds
to a 100% box), so diff a rendered PNG before and after.
