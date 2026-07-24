# ADR-010 — Host manage link: durable access to responses

**Status:** accepted · **Date:** 2026-07 · Extends
[adr-005](adr-005-capability-tokens.md) (capability URLs instead of accounts);
shipped as FR-5.4–5.6, refining FR-3.3 and FR-4.4.

## Context

Checking RSVPs is inherently a *come-back-later* action: the host publishes on
Monday and wants the headcount on Friday. Today they cannot.

The manage token is minted at publish and written to `localStorage`
(`usePublishing.ts`), but **nothing ever reads it back**, there is no host
route in `main.tsx` (`/`, `/create`, `/i/:id` only), and editor state is
in-memory. So the RSVP dashboard exists only inside the browser tab that
published the invitation. Closing that tab means the only way to see responses
is re-publishing — which mints a *new* id and a *new* share link, orphaning
the one already sent to guests. FR-3.3's claim that the host "survives a
reload" is aspirational, not implemented.

Two smaller problems sit in the same surface and are cheapest to settle here:
what the host sees when a guest answers twice, and what happens when a token
is stale.

## Decision

### 1. A dedicated host route, `/manage/:id`

Not the editor. Publishing, regenerating and editing stay in `/create`; the
manage view is a **read-only response dashboard**: which event, how many
coming, who answered, CSV export. Separating them keeps the editor free of
"resume an old session" state (the reason the token was never restored in the
first place) and makes the host's recurring task one bookmarkable URL.

It composes two existing endpoints — the public `GET /api/invitations/:id`
for the invitation itself and the token-gated `GET /api/invitations/:id/rsvps`
for the responses. No new host-facing server route.

### 2. Token resolution: fragment → localStorage → paste

In order:

1. **`#t=<token>` in the URL fragment.** Validated by attempting the RSVP
   fetch, then persisted to `inv-manage:<id>` and **stripped from the URL**
   (`history.replaceState`) so it does not linger in the address bar.
2. **`localStorage`** (`inv-manage:<id>`), the same key publish already
   writes.
3. **Neither** — an empty state asking the host to open their manage link,
   with a paste field as the manual path.

The token goes in the **fragment, never the query string**: fragments are not
sent to the server, so the credential stays out of access logs, referrer
headers and the OG/SPA-shell request path.

### 3. The manage link is a deliberate second capability URL

`/manage/:id#t=<token>` is a bearer secret of exactly the class adr-005
already accepted for the share link: whoever holds it can read responses and
republish. That is the point — in an accounts-free model it is the *only*
way for a host to move from laptop to phone, or to recover after clearing
site data.

Guardrails on the affordance rather than the mechanism:

- It is a separate, explicitly-labelled copy action in the share panel —
  never the same button as the share link, never pre-copied, with a one-line
  "keep this private, it opens your responses" warning.
- The share panel keeps showing the plain `/i/:id` link as the primary,
  visually dominant action, because that is the one that gets pasted into
  Viber.

Accepted risk: a host who pastes the wrong link into a group chat hands over
republish rights. Mitigated by labelling only. Rejected alternatives: a
short-lived signed link (needs server state and a mail channel we don't
have), and requiring accounts (rejected wholesale by adr-005).

### 4. A local "your invitations" index

`localStorage` already accumulates `inv-manage:<id>` keys, but an id is not
something a host recognizes. Publish additionally maintains
`inv-invitations`: a JSON array of `{ id, title, published_at }`, browser-only,
written from data the client already has. The landing page renders "Your
invitations" from it when non-empty, each row linking to `/manage/:id`.

This is a convenience cache, not a record: it is per-browser, it can be
cleared, and it never round-trips to the server. The manage link (§3) stays
the portable path.

### 5. Re-submissions: append-only storage, collapsed host counts

FR-4.4 keeps its append-only rule — a guest changing their mind re-submits,
and the record is an audit trail. But the *host-facing summary* currently
counts both answers, so a guest who switches no→yes inflates both the yes
count and the headcount the host caters on. The headcount is the whole point
of the screen, so it has to be right.

`GET /api/invitations/:id/rsvps` therefore reports both views:

- Entries are grouped by **normalized name** (trim, collapse inner
  whitespace, case-fold); within a group the latest `created_at` wins and the
  earlier ones are flagged `superseded: true`.
- `counts` (yes / no / guests) are computed over the **non-superseded** set.
- The full list, superseded entries included, stays in the response — the UI
  de-emphasizes them, and CSV export keeps every row so the audit trail
  survives the export.

Accepted risk: two distinct guests with identical names collapse into one.
The list still shows both rows (one marked superseded) so the host can see it
happened, and typical invitations are tens of guests, not thousands. The
alternative — a per-guest edit token in the RSVP link — is real
infrastructure for a rare case, and is rejected for now.

### 6. Freshness without polling

Fetch on mount, refetch on `visibilitychange → visible`, plus the existing
manual refresh. No timers, no server push, no new infrastructure — a host
returning to a backgrounded tab sees current numbers, which is the actual
behaviour pattern. A locally stored last-seen timestamp drives a "N new since
your last visit" line.

### 7. Failure states are visible

Today `refreshRsvps` has no `catch`: a `403` from a stale token becomes an
unhandled rejection and the spinner simply stops. The manage view maps
`403` → "this manage link is no longer valid" (with the paste-a-link
recovery), `404` → invitation not found, network failure → retry. The
in-editor panel gets the same handling.

### 8. No RSVP deletion in v1

Removing a bogus or test entry needs stable per-RSVP ids and a mutating
token-gated endpoint. §5 already covers the common "guest changed their mind"
case; deletion waits for a host to actually ask.

### 9. Design precedes code (E-invitation DS templates) — done

Every host/guest screen in the app has a `templates/*` mockup in the
E-invitation DS project except this one — the share panel and response list
were built straight in code, and are correspondingly thin. Following the
adr-009 §4 precedent, three mockups landed before implementation:

- **`templates/host-manage`** (HostMain, HostStates, HostSpec) — mobile-first
  (375) primary, desktop two-column secondary. Five states: responses present ·
  none yet · no token · invalid token · loading — all calm, no "error" chrome.
- **`templates/share-panel`** (ShareMain, ShareStates, ShareSpec) — the §3
  guardrail rendered as visual hierarchy, with an explicit anti-pattern card.
- **`templates/landing-page`** returning-host variant (LandingDesktopAReturning,
  LandingMobileAReturning) carrying the §4 "your invitations" list.

The event is identified in the manage view by a plain title/date header, not
a shrunken `InvitationPreview` — a compact card variant would be a component
change and would pull the `.design-sync` component pipeline (`dtsPropsFor`,
conventions) into an iteration that otherwise touches no tokens, copy fields,
or component props. **The `.design-sync` component pipeline therefore stays
untouched: no re-sync, no `dtsPropsFor`/`conventions.md` edit** — the templates
are reference mockups only.

**Settled tokens (from the mockups), to lift into `styles.css` as custom
properties — replacing the scattered `#2f7d4f`/`#a4262c` literals in both
`.rsvp-*` and `.lp-rsvp-*`:**

| Token | Value | Pill background | Pill edge | Contrast on white |
| --- | --- | --- | --- | --- |
| `--rsvp-yes` | `#3d6b47` (muted forest) | `#eef3ee` | `#cfe0d1` | 6.2:1 (AA) |
| `--rsvp-no` | `#a83f3f` (muted brick) | `#f6ebe9` | `#e6cfc9` | 6.1:1 (AA) |

Both are warm and muted to sit in the chrome rather than read as system
alerts; `--rsvp-no` is deliberately distinct from accent terracotta `#b3592e`.

**Settled visual treatments:**

- **Superseded row (§5):** indented under the current answer with a
  return-arrow hook, the prior answer struck through in neutral grey (never
  red/green), labelled "previous answer" — reads as *changed their mind*, not
  error or deletion.
- **"N new" line (§6):** between headcount and list, an orange dot (accent
  `#b3592e`, the same marker that flags new rows in the list), warm-brown
  text, hidden entirely at zero.
- **Manage-link subordination (§3):** the public `/i/:id` link is the single
  filled-accent button, first, above a divider; the manage link sits below in
  a warm "sensitive" tint (`#f8f2ea` bg, `#ecdcc9` edge), value masked by
  default, outline-only copy button, inline "don't send to chat" warning
  repeated on the copy confirmation.
- **Access-recovery states** (no token / invalid token) share one layout: a
  reassuring line ("your responses haven't gone anywhere"), a paste-your-link
  field, and a filled-accent "Open dashboard" action.

## Consequences

- The RSVP list response shape gains `superseded` per entry and redefines
  `counts` — `server/src/schemas.ts` and `web/src/types.ts` change in the
  same PR (NFR-8), and `csv.ts` gains a column.
- One new web route and one new screen; the share panel gains a second copy
  action. Host surfaces stay bilingual through `i18n.ts` (NFR-5).
- No new authentication surface: the manage view reuses the adr-005 token and
  the existing constant-time compare. Brute-forcing 128 bits over HTTP is not
  a threat model worth a rate limiter, and the endpoint costs no LLM spend, so
  the adr-008 guardrails stay off it.
- adr-005's "losing the token means losing host access" trade-off is softened,
  not removed: the manage link is a recovery path only for a host who kept it.
- No store changes and no schema change to the invitation itself — the
  NFR-7 single-process file store carries this feature unchanged.

## Notes from implementation

Two things the plan did not anticipate, recorded so the next reader doesn't
rediscover them:

- **The "N new" baseline must be read during render**, behind a ref guard, not
  in an effect. React StrictMode double-invokes effects in development, so an
  effect that reads the last-seen marker and then writes "now" reads its own
  write on the second pass and reports zero new replies every time.
- **The grouping key is duplicated** — the server groups for `superseded` and
  `counts`, the client regroups to nest a replaced answer under its live one.
  They must agree on what "the same guest" means or rows nest under the wrong
  answer. Kept in sync by hand, like `types.ts` mirrors `schemas.ts` (NFR-8).
  A server-supplied group id would remove the hazard if this ever bites.

The mockups' per-row response counts and "N new" badges on the landing list
were **not** built: the browser-local index has no such data, and fetching it
would mean one token-authenticated request per invitation on an otherwise
static marketing page. Revisit with a batch endpoint if hosts ask.
