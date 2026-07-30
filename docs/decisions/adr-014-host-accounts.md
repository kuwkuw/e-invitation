# ADR-014 — Host accounts: Google sign-in, a server-side keyring, SQLite

**Status:** proposed · **Date:** 2026-07-30 · Partially supersedes
[adr-005](adr-005-capability-tokens.md) (capability URLs instead of accounts);
reverses a scope boundary drawn by [adr-012](adr-012-batch-response-counts.md);
extends [adr-010](adr-010-host-manage-link.md). Rewrites NFR-4, amends NFR-7,
and lands as **FR-11**.

## Context

[adr-005](adr-005-capability-tokens.md) chose capability tokens over accounts
and closed with an accepted, unmitigated trade-off:

> Anyone holding the manage token owns the invitation; losing it means losing
> host access (no recovery path — a known trade-off).

[adr-010](adr-010-host-manage-link.md) softened it, and said so precisely: the
manage link is "a recovery path only for a host who kept it." A host who
publishes from a phone and then clears site data, changes device, or loses the
message they pasted the link into has no path back. Re-publishing does not help
— it mints a new id and orphans the share link guests already hold.

Four ADRs re-affirm the accounts-free model by name (006, 010, 012, 013), and
none of them was wrong. What has changed is that **every remaining item in the
06-roadmap backlog now converges on the same missing primitive**:

- **Notify the host on a new RSVP** — "needs an email channel (and an address,
  which the accounts-free model doesn't collect). Revisit with any
  account-adjacent work."
- **A cross-device list of your events** — adr-012 explicitly refused to teach
  the server "whose is this?", which is exactly the question a durable host
  index asks.
- **The organizer tier** ([07-monetization](../07-monetization.md) §5.3) — the
  only segment with the frequency a subscription needs, and the only one that
  §4.3 concedes does not fit the no-accounts model.

One primitive unblocks three items and closes adr-005's one recorded defect.
That is the case for taking it.

**The case against, recorded so it is not discovered later.** Traffic is thin —
adr-013's context puts production at 9 generations, 4 publishes and 5 RSVPs
lifetime. adr-005 argued that signup before demonstrated value would kill the
funnel, and §2 below accepts a gate at the one chokepoint
[07-monetization](../07-monetization.md) §4.2 identifies as the place value has
been demonstrated. This ADR takes that cost deliberately; §2 states what has to
be measured first so the cost is legible rather than inferred.

## Decision

### 1. Accounts are additive. The manage token stays the authority

An account is a **server-side keyring**, not an identity that owns anything.
adr-005's own last line left this door open:

> If accounts arrive later, tokens can be attached to users without changing
> the guest-side model.

So: `manage_token` remains the credential every host-authorized endpoint
checks, in constant time, unchanged. `GET /api/invitations/:id/rsvps`,
`POST /api/invitations/:id/publish` (republish) and
`POST /api/invitations/counts` are not modified. A session grants exactly one
new *read*: fetch the tokens this account holds. The signed-in client then
behaves precisely like a host whose `localStorage` was never cleared.

Three properties follow, and they are why this shape was chosen over "the user
owns the invitation":

- **No new class of secret.** `manage_token` already sits in plaintext on every
  record under `DATA_DIR`. The keyring adds a join, not an exposure.
- **The blast radius is one new table and one new route group.** Every shipped
  authorization path keeps its existing test coverage and its existing
  constant-time compare.
- **Nothing published is invalidated, ever.** Every share link in the wild,
  every `#t=` manage link, and every `inv-manage:<id>` in a browser keeps
  working forever, for hosts who never sign in. Auth never revokes a
  capability.

### 2. The gate is at publish — and the baseline is measured before it ships

`POST /api/invitations/publish` requires a session for a **first** publish.
Generate, edit, per-field regeneration, backgrounds, the whole guest side, and
republish-with-a-token stay anonymous.

Publish is the gate because [07-monetization](../07-monetization.md) §4.2
already identified it as "the only place a paywall can attach without a
schema-wide change" — the single point where value has been demonstrated and
the host has committed. 01-vision intent 1 ("zero-effort creation") survives
intact: the host still types one sentence and gets an editable invitation
without meeting a login.

**Accepted risk, stated plainly.** This is the friction adr-005 warned about,
placed at the most expensive possible point. Two measurement consequences make
it worse than it looks:

- **Publish-rate is a 01-vision success signal**, and it will drop. A drop
  caused by a sign-in wall is not separable after the fact from a drop caused
  by copy quality.
- **adr-013's `new_hosts_per_publish` has publishes in the denominator.** The
  ratio 07-monetization §5.1 gates every commercial option on will move for a
  reason that has nothing to do with the share loop, and §5.1's thresholds
  (0.3 against 0.7) were written against an ungated denominator.

Therefore **PR 0 of this iteration is a metrics baseline**, shipped and left to
run before the gate lands: publishes, generations and the adr-013 pair
recorded against a pre-gate denominator. Without it the gate is untestable and
adr-013's number becomes unreadable — which would waste the iteration that
produced it.

Rejected placement: a gate at `/create`. It contradicts 01-vision intent 1
outright and would put a login in front of the guest→host conversion adr-013
exists to measure.

### 3. Google OAuth — authorization code with PKCE, entirely server-side

Chosen for one tap, a verified email address (§7 needs one), and no
transactional-email infrastructure.

Mechanics:

- Redirect flow on the server. **No Google JavaScript SDK** — the web bundle
  gains nothing measurable, which matters under NFR-1's mobile-first budget
  (80.9 kB gzipped today; adr-011 records what a 13.2 kB addition costs to
  justify).
- Scopes are `openid email` and nothing else. No profile photo, no contacts.
- The account key is the Google **`sub`**, which is stable. Email is stored as
  data (for §7), never as the identity key — people change addresses.
- The `id_token` is verified against Google's JWKS, with `iss`, `aud`, `exp`
  and `nonce` checked. The `state` parameter is single-use and stored
  server-side.

**What this costs, named:** a host without a Google account cannot publish.
That is the real price of §2's hard gate, and it falls hardest in the market
01-vision targets. Two alternatives were weighed and are recorded in "Rejected
alternatives" — the Telegram Login Widget (market-native for a
Viber/Telegram/WhatsApp audience, but yields no address, so §7 stays blocked)
and an email magic link (yields an address and *is* §7's channel, but needs a
sender and deliverability work for UA inboxes).

If the gate proves too costly, adding a second provider is additive under §1 —
the keyring does not care which provider minted the account.

### 4. The session authorizes two things, and both get an origin check

An opaque session id in an httpOnly cookie: `Secure`, `SameSite=Lax`,
`Path=/api`, backed by a row in SQLite. Not a JWT — there is a database now,
and a revocable session is worth more than a stateless one at this size.

`Path=/api` is deliberate: the cookie must never ride `GET /i/:id` or the OG
image request. Those are crawler-visible, cacheable, server-rendered paths
(FR-3.5), and adr-010 §2 already spent this project's care on keeping host
credentials out of exactly that request path.

The session authorizes exactly two operations:

1. `GET /api/account/keyring` — read your own tokens.
2. `POST /api/invitations/publish` for a **first** publish, where no token
   exists yet to authorize with.

Operation 2 is **the first cookie-authorized mutation in the app**, and it is
the CSRF surface the capability-token model was immune to. `SameSite=Lax`
already withholds the cookie from a cross-site POST; an explicit `Origin`
check on both cookie-authorized routes is the belt to that braces. Every other
mutating endpoint stays token-authorized and therefore stays immune by
construction.

### 5. The keyring seeds the client; it does not restructure it

`GET /api/account/keyring` returns
`[{ id, manage_token, title, published_at, palette }]` with
`Cache-Control: no-store` — the same discipline adr-012 §1 applied to batched
per-host data.

On sign-in the client writes those entries into the keys it *already* uses:
`inv-manage:<id>` and `inv-invitations`. So `useHostManage`, `usePublishing`,
`useHostInvitationCounts`, `/manage/:id` and the returning-host list need no
change to their token resolution — the keyring is a new *source* for storage
that already exists, not a new path through the hooks.

Two refinements fall out for free:

- The seed lands in an in-memory map first, with the `localStorage` write
  best-effort behind the existing try/catch guards. A signed-in host on
  private-mode Safari — where today every host feature degrades — gets a
  working session-length dashboard.
- The keyring is fetched once per session, not per route. The landing page's
  "never waits" rule (adr-012 §6) applies unchanged: rows render from local
  state, and a failed keyring fetch is silence.

**This reverses adr-012's boundary, deliberately.** That ADR closed with "the
server still has no idea which invitations belong to one host, and this
endpoint does not teach it." This endpoint teaches it. The reason adr-012 held
that line was that a *decorative count* did not justify building the host
graph; recovery, notification and the organizer tier do. The line worth
keeping from adr-012 is the narrower one, and it is kept: the server still
never learns **which invitation begat which host** (adr-013 §3). Referral stays
a closed `direct | guest` enum.

### 6. SQLite beside the file store, via `node:sqlite`

`DATA_DIR/app.db` holds users, sessions, keyring entries and (later, §8)
entitlements. **Invitation records stay one JSON file per id.** `store.ts`
keeps its interface and its write-then-rename discipline; nothing shipped
migrates.

[07-monetization](../07-monetization.md) §7 already anticipated this: the
backlog SQLite item "moves from optional to prerequisite" once anything durable
is owed. Sessions and a user→invitation index are exactly the shapes flat files
stop being simple for.

`node:sqlite` over `better-sqlite3`: zero dependencies, a synchronous API that
matches `store.ts`'s existing `readFileSync` idiom, no native build in the
`node:22-alpine` image, and no `onlyBuiltDependencies` entry in
`pnpm-workspace.yaml`. Cost: an `ExperimentalWarning` on boot and an API that
may change under us — bounded by the pinned base image and by using only
`exec`/`prepare`/`get`/`all`/`run`. Swapping to `better-sqlite3` is a
one-module change if the warning is unacceptable in production logs.

WAL mode on. NFR-7 stays true as written — single process, one volume, and
`DATA_DIR` already carries the database because the deployment mounts it at
`/data`. "Do not scale above 1 instance" is now enforced by two subsystems
instead of one.

### 7. Auth-unconfigured is a supported mode

Without `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, the server boots and
**publish stays anonymous** — the §2 gate is skipped entirely and the app
behaves exactly as it does today.

This follows NFR-3's existing precedent ("the server boots and serves
`/healthz` without an API key; only generation calls fail"). It keeps local
development, `pnpm test` and any self-hosted instance working without
registering an OAuth client, and it makes the gate a deployment decision rather
than a code path that cannot be turned off. `/healthz` reports whether auth is
configured, beside `llm.providers`.

### 8. RSVP notifications and entitlements are unblocked here, not built here

This ADR delivers what both need — a verified address and a durable per-user
row — and builds neither.

- **Notifications** need a transactional email sender: a second external
  dependency, deliverability work for Ukrainian inboxes, a per-invitation
  preference, and an unsubscribe path. That is its own iteration and its own
  FR. Bundling it here would put two external services and a privacy-surface
  change in one review.
- **Entitlements** get no speculative column. 07-monetization §4.3 is still
  right that the one-time unlock (§5.2) attaches to the **record**, not the
  user; only the organizer tier (§5.3) attaches to the user. Both stay gated on
  adr-013's measurement, which §2 above is careful not to destroy. No pricing
  surface, no payment rail, no schema for either.

### 9. NFR-4 stops being true and must be rewritten

"**No accounts, minimal data**" is the first line of NFR-4 and this makes it
false. The rewrite states what is now held and what is deliberately not:

- **Held:** Google `sub`, verified email, account creation time, session rows,
  and the id↔token pairs of invitations published while signed in.
- **Not taken:** no password, no profile photo, no name beyond what `openid
  email` returns, no contacts scope, no third-party analytics, no cookies
  outside `Path=/api`.
- **New obligation:** a host-side deletion path. Deleting an account drops the
  user, sessions and keyring rows; **published invitations and their guest
  RSVPs are not deleted**, because the share links guests hold must not break
  and the RSVP rows are the guests' data, not the host's. The manage token
  survives on the record, so a host who kept their manage link keeps access —
  deletion removes the account, not the invitation.
- **New disclosure:** signing in tells Google that this user publishes
  invitations here. Unavoidable with a third-party IdP, and worth one line in
  NFR-4 rather than discovering it in a privacy question later.

### 10. Design precedes code

Following the adr-009 §4 / adr-010 §9 precedent, mockups land in the
E-invitation DS project before implementation. Three surfaces are new:

- **`templates/auth-gate`** — the sign-in step inside the publish flow. The
  hardest screen in the iteration: it interrupts the one moment the host is
  committed, and it has to read as "keep this safe", not as "register to
  continue". States: prompt · redirecting · returned-and-publishing · declined
  (what the host can still do).
- **`templates/landing-page`** signed-in variant — the returning-host list
  (FR-5.6/5.7) sourced from the keyring rather than the browser, plus the
  account affordance and sign-out.
- **`templates/share-panel`** signed-in variant — adr-010 §3's hierarchy is
  unchanged, but the manage link's "keep this private, it's your only way
  back" framing is no longer strictly true for a signed-in host, and the copy
  has to stop overstating it without inviting hosts to paste it into a chat.

The `.design-sync` component pipeline stays untouched, as it did for adr-010
and adr-012: no `InvitationPreview` prop changes, no token changes, no
`dtsPropsFor`/`conventions.md` edit.

## Consequences

- **NFR-4 is rewritten** (§9) and **NFR-7 amended** (§6: SQLite beside the file
  store, still one instance, still one volume).
- **adr-005 is partially superseded.** "No users table, no sessions, no
  passwords" becomes false on the first two counts. Its core — *host authority
  is possession of an unguessable token, compared in constant time* — survives
  unchanged, and is what §1 is built on.
- **adr-012's scope boundary is reversed** (§5), with the narrower adr-013 §3
  line about the host graph kept.
- **01-vision's "no guest accounts" stays literally true**; intent 1 needs a
  caveat naming the publish gate.
- **New environment variables:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and
  `GOOGLE_REDIRECT_URI` — the last because Google validates the redirect
  against a fixed allowlist, which interacts with `CANONICAL_HOST`.
  `docs/05-deployment.md` gains the runbook; `server/.env.example` gains the
  keys. No session secret: see the implementation notes.
- **`server/src/schemas.ts` gains the keyring and account shapes and
  `web/src/types.ts` mirrors them by hand in the same PR** (NFR-8).
- **`docs/02-functional-requirements.md`** gains FR-11 and three route-table
  rows (`/api/auth/google`, `/api/auth/google/callback`,
  `/api/account/keyring`).
- **Web bundle cost is near zero** (§3, redirect flow, no SDK) — measured and
  recorded under NFR-1 like adr-011's +13.2 kB, even if the delta is noise.
- **Test surface:** the first tests in the repo needing an OAuth double. The
  IdP is stubbed at the token-exchange and JWKS boundary, the way the LLM
  boundary is mocked so tests need no keys.

## Rejected alternatives

- **Optional post-publish claim** ("keep access to this", offered *after* a
  successful anonymous publish). Preserves the funnel and adr-013's
  denominator completely, and was the recommendation. Declined in favour of
  §2's hard gate; recorded here because if publish-rate craters after PR 4,
  this is the fallback that requires no new infrastructure — only moving the
  gate.
- **Telegram Login Widget.** The best market fit for a messenger-native
  audience (01-vision intent 4) and one tap with no email at all. Yields no
  address, so §7's notifications stay blocked, and it ties account identity to
  one messenger. Additive later under §1 if the Google gate proves too narrow.
- **Email magic link.** Yields an address and the sender doubles as §7's
  notification channel — one dependency, two features. Declined for now on
  "one external dependency at a time" grounds; it is the natural first
  addition when notifications are taken.
- **Email + password.** No third-party dependency, most work (hashing, reset —
  which needs a sender anyway), worst funnel.
- **JWT sessions.** No revocation, and §6 puts a database in the process
  regardless.
- **Accounts replacing capability tokens outright.** Would invalidate every
  published link, every stored `inv-manage:<id>` and every manage link already
  sent — an unbounded migration for hosts who cannot be contacted, which is
  the exact population accounts exist to help.
- **Postgres / a hosted auth provider (Auth0, Clerk, Supabase).** Both add a
  network dependency and a monthly floor to a project whose entire fixed cost
  is one container and a 1 GB volume, for an auth surface that is one table and
  two routes.

## Implementation plan

Seven PRs plus a docs pass, in order. PR 0 must ship and run before PR 4.

**Status:** 0, 1, 2, 3, 4 (server), 6 and the docs pass are **done**. PR 4's
editor sign-in step and PR 5's signed-in UI are **outstanding**, blocked on the
§10 mockups — so this ADR stays *proposed* until they land, and a deployment
runs either unconfigured (§7) or with `PUBLISH_REQUIRES_ACCOUNT=0`.

0. **Metrics baseline (§2).** Record publishes, generations and the adr-013
   pair against the pre-gate denominator, with the date the gate lands noted in
   `metrics.json`, so the conversion cost of §2 is measurable and
   `new_hosts_per_publish` stays interpretable across the boundary.
1. **The SQLite module.** `DATA_DIR/app.db`, schema creation, WAL, the
   users/sessions/keyring tables, and a small typed interface mirroring
   `store.ts`'s shape. No callers. Tests point `DATA_DIR` at a scratch dir, as
   the store tests already do.
2. **OAuth + session, with no gate.** `/api/auth/google`, the callback, JWKS
   verification, the `Path=/api` cookie, sign-out, `/healthz` reporting, and
   the §7 unconfigured no-op. Signing in does nothing visible yet.
3. **The keyring.** Write an entry on publish when a session is present;
   `GET /api/account/keyring`; the client seed (§5). Still no gate — a
   signed-in host simply gets their invitations back on a new device.
4. **The gate (§2).** Publish requires a session when auth is configured, plus
   the editor's sign-in step. **Design mockups (§10) precede this PR.**
5. **Signed-in UI.** Landing-page variant, account affordance, sign-out, the
   share-panel copy revision (§10).
6. **Account deletion (§9).** The host-side path, plus what it does and does
   not remove.
7. **Docs pass.** NFR-4 rewrite, NFR-7 amendment, FR-11, the route table, the
   deployment runbook, `06-roadmap.md`, and this ADR flipped to accepted —
   the pattern the last four iterations used.

## Notes from implementation

Recorded as the PRs land, so the next reader does not rediscover them.

- **The keyring stores no manage token** (PR 1). §1 called the account "a join,
  not an exposure" and §5 describes the *response* carrying `manage_token` —
  which it still does. But the table itself holds only
  `(user_id, invitation_id, created_at)`, and the read path joins the token
  from the record that already carries it. One copy of the credential means
  none to drift, and it makes the account database worthless on its own: an
  attacker who reads `app.db` and not `DATA_DIR` gets a list of ids and no way
  to use them.
- **`node:sqlite` needs `createRequire`, not a plain import** (PR 1). §6
  claimed the cost of choosing it over `better-sqlite3` was an
  `ExperimentalWarning`. There is a second cost: `sqlite` is absent from Node
  22's `module.builtinModules` *because* it is experimental, so Vite — which
  vitest runs the server through — does not treat `node:sqlite` as a builtin,
  tries to resolve it as a package, and fails at import time. Neither
  `test.server.deps.external` nor a `resolveId` plugin fixed it; the module
  runner still fetched the bare specifier. Loading it through `createRequire`
  is opaque to that static analysis and behaves identically under `tsx`,
  `tsc` → node and vitest, with no config file. `import type` keeps the typing
  free. It comes out when `sqlite` graduates into `builtinModules`.
- **Session ids are stored hashed**, unlike manage tokens, which the file store
  keeps raw. Not an inconsistency: a manage token authorizes one invitation and
  already sits in the record it protects, while a session id authorizes every
  invitation an account holds.
- **There is no session secret** (PR 2). The consequences originally listed
  one. Nothing is signed: the cookie carries 32 random bytes whose only meaning
  is as a row key in `sessions`, so there is no claim to forge and a signature
  would protect nothing. `@fastify/cookie` is registered without a `secret`.
  One fewer piece of deployment configuration to get wrong.
- **The in-flight sign-in state lives in SQLite**, per §3's "stored
  server-side" — including the exact `redirect_uri`, because the token exchange
  has to repeat it byte-for-byte and re-deriving it at callback time from a
  different request is how that silently breaks behind a proxy. Reading a state
  deletes it, so single-use is structural rather than a check.
- **`GOOGLE_REDIRECT_URI` is optional** (PR 2). Unset, the callback URI is
  derived from the incoming request, which is what lets localhost development
  run with no second registration. Google's allowlist is the real control — a
  forged `Host` header can only produce a URI Google refuses. Production should
  still set it explicitly, because a deployment behind `CANONICAL_HOST` must
  send the canonical host rather than the platform one.
- **The callback returns `?auth=ok|failed|declined`** on the path the host
  started from. `declined` is separate from `failed` on purpose: pressing
  cancel on Google's screen is a choice, not a breakage, and must not be
  rendered as one. The client reads the parameter once and strips it through
  the router, exactly as adr-011 §4 has it strip `?ref` — PR 5 owes that.
- **The gate is on a *first* publish only** (PR 4). Republish stays purely
  token-authorized and always will: §1 says auth never revokes a capability,
  and every share link in production was minted before accounts existed. A host
  holding a valid manage token republishes signed out, forever. A bad token on
  a republish is still `403`, not `401` — the token is what authorizes there,
  and being signed out is beside the point.
- **The baseline is frozen when OAuth is first configured**, not on a separate
  operator action (PR 4). Configuring a client is what turns the gate on, so it
  is exactly the instant the "before" period ends. That also softens §2's
  ordering claim: PR 0 did not strictly have to run first, because
  `markBaseline` freezes the *lifetime counters at that instant* whenever it is
  called. What PR 0 shipping first actually bought was a pre-gate period whose
  counters were already accumulating — which they were.
- **Three module caches needed a test reset** — `closeDb`, `resetJwksCache`,
  `resetMetricsCache`. The last one was found by three tests failing: `metrics.ts`
  caches counters for the process lifetime, so a per-case `DATA_DIR` was reading
  the previous case's numbers and its frozen baseline. Worth noting as a pattern
  rather than three accidents: every module in this server that caches across
  requests now owns an explicit way to drop it, and a new one should ship with
  the same.
- **Sign-out does not clear this browser's manage tokens** (PR 3). Ending the
  account session must not revoke a capability the host had before they ever
  signed in, and doing so would destroy access on a shared device in a way no
  host would predict.
- **`PUBLISH_REQUIRES_ACCOUNT` separates the gate from sign-in** (added after
  PR 4). §2 and §7 together implied one switch: no OAuth client, no gate;
  configure one, gate closed. That conflates two decisions and creates a window
  where publishing `401`s and the client has nothing to offer, because the gate
  is server-side and the sign-in UI is not. The flag is on by default once
  OAuth is configured and `0` disables it, following adr-008's convention. It
  also makes this ADR's own revisit trigger — *publish-rate drops → move the
  gate* — a config change rather than a deploy, which is what a revisit trigger
  should cost.
  The baseline moved with it: it freezes when the **gate closes**, not when
  OAuth is configured, or staging the rollout would freeze "before" while
  anonymous publishes were still landing.
- **Account deletion reports what it kept** (PR 6). §9 settled that
  invitations and RSVPs survive; the endpoint returns
  `invitations_retained` so the UI can say so. "Delete my account" and "lose my
  invitations" are different things and the host has no way to know that unless
  told.
- **`web/src/manageTokens.ts` is where host tokens live now** (PR 3). The
  keyring made it the third writer of `inv-manage:<id>`, so the accessors moved
  out of `useHostManage.ts` into one module with a memory layer in front of
  `localStorage`. Two reads in `useHostManage` were unguarded during render and
  are now behind the shared try/catch. `localStorage.clear()` cannot reach the
  memory layer — `forgetHeldManageTokens()` exists so that is stated rather
  than discovered.

## Revisit triggers

Written down now so the decision is falsifiable later:

- **Publish-rate drops more than ~30% against PR 0's baseline** → move the gate
  to the optional post-publish claim in "Rejected alternatives". No new
  infrastructure required; §1 was built so this is a UI change.
- **Hosts sign in and never return** → the keyring is solving a problem nobody
  had; notifications (§8) become the load-bearing reason for accounts, or the
  gate comes off.
- **A second provider is asked for more than once** → add Telegram (§3), which
  is additive under §1.
