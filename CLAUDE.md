# CLAUDE.md

Guidance for Claude Code in this repository. This file is loaded every
session, so it holds only what applies everywhere. Area rules live beside the
code and load when you work there: **`server/CLAUDE.md`** (API, LLM pipeline,
accounts, email, SEO, OG) and **`web/CLAUDE.md`** (routes, hooks, styles,
i18n, gallery). The reasons behind decisions are in `docs/decisions/` (ADRs);
requirements carry stable ids (`FR-x`, `NFR-x`) in `docs/`.

## Product

INVINTO (invinto.app): the host describes an event in one sentence → AI
generates an editable invitation → publish a share link with a guest RSVP page
and an OG preview. Bilingual Ukrainian/English; guests never register; sharing
targets Viber/Telegram/WhatsApp.

## Commands

pnpm monorepo (`server`, `web`). Use pnpm, not npm. Its version comes from
`packageManager` via Corepack, which Node 25+ no longer bundles: run
`npm install -g corepack && corepack enable` once per machine.

- `pnpm install`: a new native dependency with a postinstall script must be
  added to `onlyBuiltDependencies` in `pnpm-workspace.yaml`
- `pnpm dev`: API on 3001 and UI on 5173 (Vite proxies `/api`)
- `pnpm lint` / `pnpm lint:fix` / `pnpm format`: Biome, one root config.
  CSS and Markdown formatting are off on purpose; `.gitattributes` pins LF
  so the formatter sees the same bytes everywhere
- `pnpm typecheck`, `pnpm build` (web `build` includes typecheck)
- `pnpm test`: runs the two suites **one after the other** on purpose.
  Running them in parallel oversubscribes the CPU and pushes the server's
  app-building `beforeAll` hooks past Vitest's 10 s timeout
- One workspace: `pnpm --filter inv-app-server <script>` (`inv-app-web`).
  One test file: `pnpm --filter inv-app-server exec vitest run test/x.test.ts`;
  one test: `... -t "name"`
- `pnpm --filter inv-app-server probe` / `eval`: the only commands that call
  real models (unit tests mock the LLM boundary). See `server/eval/README.md`

## Workflow

- **Never push to `main`.** Northflank deploys every push to `main` and runs
  no checks. Work on a branch and merge through a PR with CI green.
- CI (`.github/workflows/ci.yml`): lint, typecheck, build, test (build first,
  or the SPA-shell tests skip themselves), `pnpm audit --prod --audit-level
  high`, Docker build. `llm-eval.yml` runs the probe and eval nightly and on
  PRs touching prompts or routing.
- When behaviour changes, update the matching FR/NFR/architecture section in
  the same PR.
- **Stacked PRs:** merge the lower one before the one on top, or retarget the
  top one to `main` first. Otherwise it merges into the lower branch and never
  reaches `main`.
- Hooks in `.claude/settings.json` enforce part of this (scripts in
  `.claude/hooks/`, tested by `server/test/claudeHooks.test.ts`): no commit
  on `main` and no push to it; Biome on every edited file, with what it
  can't fix sent back to you; a reminder naming an edited file's hand-kept
  twin, or the eval for a prompt; and a typecheck of changed workspaces before
  you finish. Respect a hook's message; don't route around it.
- Node is pinned in four places that move together: `.npmrc`
  (`use-node-version`), `.nvmrc`, `engines` in `package.json`, and both `FROM`
  lines in the `Dockerfile`.

## Reviewing

Every PR gets an independent review (`.github/workflows/claude-review.yml`).
Beyond correctness, a review of this repo checks:

- **Mirrors**: a change to one side of a hand-kept pair (list below) without
  the other.
- **Docs in the same PR**: behaviour changed but the matching FR/NFR,
  `docs/04-architecture.md` section or ADR did not; a new env var missing from
  `server/.env.example` and `docs/05-deployment.md`.
- **Prompts and routing**: a change under `server/src/pipeline/` or to
  `routing.ts` with no eval run behind it, or a routed model without a
  `pricing.ts` entry.
- **Strings**: user-visible text outside `i18n.ts`, or present in one
  language only.
- **Stored data**: a change to what lands in `DATA_DIR` that older files can't
  load (there is no migration step), or a write that isn't whole-then-rename.
- **Guest surfaces**: anything served at `/i/:id` that needs a feature
  WKWebView lacks, or breaks the `robots.txt` and `noindex` rules
  (`server/CLAUDE.md`).
- **Secrets and privacy**: a key, manage token or guest name reaching a log,
  a URL query string or an email.

## Browser support

Baseline Widely available by default. A Newly available feature is allowed
when it is feature-detected and degrades gracefully, with **no polyfill and no
dependency added for the fallback**: a fallback of about 20 lines or fewer, or
redesign. Guest links open inside messenger webviews, so on iOS the floor is
WKWebView: Safari, not Chrome, constrains anything served at `/i/:id`. Scope
the fallback before using the feature (adr-018's "every glass surface must be
legible with its blur removed" is the model). The `modern-web-guidance` skill
reads this policy.

## Where things live

| Area | Code | Decision | Notes |
|---|---|---|---|
| Generation pipeline, LLM gateway, routing, BYOK, guardrails | `server/src/pipeline/`, `server/src/llm/` | adr-002, 006, 007, 008 | server |
| Evals and model probe | `server/eval/` | NFR-6 | `server/eval/README.md` |
| Design tokens → card (no image generation) | `schemas.ts`, `InvitationPreview.tsx`, `og/render.ts` | adr-003 | both |
| Publish, share link, OG image | `server/src/routes/`, `server/src/og/` | | server |
| Host manage link and dashboard | `useHostManage`, `/manage/:id` | adr-010, 012 | web |
| Host accounts (Google sign-in, keyring) | `server/src/accounts.ts`, `auth/`, `useAuthSession` | adr-014 | both |
| RSVP reply emails | `server/src/email/`, `notifications.ts` | adr-015 | server |
| Share loop instrumentation | `views.ts`, `useViewBeacon`, `GuestCta` | adr-013 | both |
| SEO, prerendering, gallery | `server/src/seo.ts`, `web/src/prerender.ts`, `web/src/gallery/` | adr-016, 017 | both |
| Material system (styles) | `web/src/styles.css`, `web/test/styles.test.ts` | adr-018, 019 | web |
| Client routing | `web/src/AppRoutes.tsx` | adr-011 | web |
| Deployment, domain, volume | `Dockerfile`, `docs/05-deployment.md` | | |

## Rules that span both sides

**Hand-kept mirrors.** Each pair below has no shared source, so change both
sides in one pass. The `TWINS` table in `.claude/hooks/after-edit.mjs`
reminds you when you edit one side; keep it in step with this list (a test
checks the paths):

- `server/src/schemas.ts` (the source of truth) ↔ `web/src/types.ts`
- the server's `InvitationId` ↔ `isInvitationId` in `web/src/invitationId.ts`
- `SEO_STRINGS` in `server/src/seo.ts` ↔ `SEO` in `web/src/i18n.ts`
- `GALLERY_OCCASIONS` in `server/src/seo.ts` ↔ `web/src/gallery/occasions.ts`.
  A slug on one side only is a URL offered for indexing that renders as a
  dead link
- `prerenderKey` in `server/src/seo.ts` ↔ `prerenderMarkers` in
  `web/src/prerender.ts` (`<page>:<lang>`; the server's scanning regex expects
  exactly that shape)
- the OG renderer's token→style maps ↔ `.palette-*`/`.type-*`/`.layout-*`/
  `.ornament-*` in `styles.css`. Enum coverage is tested on both sides
  (`server/test/og.test.ts`, `web/test/InvitationPreview.test.tsx`)
- the share-card PNGs and their copy ↔ `LANDING` (regenerate with
  `node scripts/build-brand-assets.mjs`, never edit the PNGs)
- the DS `InvitationPreview.d.ts` and `.design-sync/conventions.md` ↔ the
  component's props

**One name.** The product is `INVINTO`, spelled as the domain, everywhere a
name appears. It is the one untranslated string in `LANDING`, and
`lp-brand-mono` derives its monogram from it. adr-013 and
`docs/06-roadmap.md` quote the earlier `INVITO` from mockups on purpose,
with a pointer to adr-016 §9: don't "fix" those.

**Model output is data, never markup.** The model picks design tokens from
closed enums; keep them enums-only.

**Every user-visible string** is in an `i18n.ts` table in both languages
(see `web/CLAUDE.md`).

## Status

Built: generation with per-field regeneration, publish with OG image, guest
RSVP, multi-provider gateway with BYOK and cost guardrails, metrics, host
dashboard and manage links, Google sign-in with keyring, RSVP reply email,
share-loop instrumentation, SEO with prerendered landing and gallery, LLM
eval and probe, backups (volume schedules plus an hourly consistent
`app.db` snapshot reported on `/healthz`). Not yet built: per-key metering, RSVP deletion. Roadmap:
`docs/06-roadmap.md`.
