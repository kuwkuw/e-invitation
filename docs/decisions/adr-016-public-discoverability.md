# ADR-016 — Public discoverability

**Status:** accepted · **Date:** 2026-08 · Lands as **FR-13**. Depends on the
share-page contract in [adr-003](adr-003-no-image-generation.md) (FR-3.5) and
on the privacy model in [adr-005](adr-005-capability-tokens.md); the client
half follows [adr-011](adr-011-client-router.md) §4.

## Context

The app ships **one** `index.html`. Every route — the marketing page, the
editor, a host's dashboard, a guest's invitation — is that same document, and
until now its entire head was:

```html
<title>Invitation Studio</title>
```

No description, no canonical, no crawl instruction, no share card, no icon, no
`robots.txt`, no sitemap. Three separate problems follow from that, and they
are not the same problem:

**1. The product is not findable.** A search result for the home page would be
titled "Invitation Studio" — a name that appeared nowhere else in the product.
The product had, at this point, **four** names: `Invitation Studio` in the
shell, `INVITO` on the guest page, in email and on the unsubscribe page,
«Запрошення»/"Zaproshennya" as the landing wordmark, and `invinto.app` in the
address bar. The snippet, meanwhile, was whatever Google chose to invent from
the page body. `07-monetization.md` §3 sets
the constraint that decides this: a private host organizes one or two events a
year, so lifetime value is approximately one transaction and acquisition cost
must be approximately zero. [adr-013](adr-013-share-loop-instrumentation.md)
took the first of the two channels that satisfy that — the share link itself.
Organic search is the other one, and it is the one that reaches a host who has
not been invited to anything yet.

**2. Everything the app serves is indexable, including what must not be.**
`/i/:id` carries a host's date, venue, family name and often their guests'
names. The id is unguessable precisely so that only the people handed the link
can read it (adr-005) — and nothing in the served HTML tells a crawler that.
`/manage/:id` is a guest list. Both would be indexed on the first external link
to them, and neither has any business in a search result.

**3. The two are in tension in a way that is easy to get backwards.** The
obvious way to keep guest pages out of the index — `Disallow: /i/` in
`robots.txt` — is the one that must not be used.
`facebookexternalhit`, `Twitterbot` and Telegram's fetcher all honour
robots.txt, and the share card's image is served from `/api/invitations/:id/og.png`.
A blanket `/api` disallow, or a `/i/` disallow, stops **every published link
unfurling** — FR-3.5 gone, in the product's only distribution channel, with
nothing in the logs to say why.

There is a fourth, quieter problem. The shell has no `og:*` tags at all, which
is *why* `/i/:id` has been able to append its own for two ADRs. The moment the
shell carries a default card, appending stops working: `og:title` is
first-one-wins in every unfurler that matters, and every share link in every
group chat would unfurl as the marketing page.

## Decision

### 1. One module decides what each path's head says

`server/src/seo.ts` holds the search copy, the head-tag builder and the
per-path resolution (`shellMeta`). Two callers use it: the SPA fallback in
`app.ts` and `/i/:id` in `routes/og.ts`. Nothing else composes meta tags.

The copy is **not** the landing page's copy. `LANDING.heroTitle` is written for
someone already looking at the page; a title and description are written for a
result listing, which is why they name the occasions — весілля, день
народження, корпоратив — that the headline deliberately does not.

### 2. The shell's head is replaced, never appended to

`index.html` carries the Ukrainian landing page's head between
`<!--seo:start-->` and `<!--seo:end-->`, and the server swaps what is between
them before sending the document. Appending was viable only while the shell
said nothing; with a default card in it, appending would show every share link
as the marketing page.

This is also what makes the shell's committed block safe to be wrong. It names
`https://invinto.app` because a file written before any request has to name
some origin, and every real response overrides it with the request's own
(`CANONICAL_HOST`, a preview deployment, localhost). `server/test/seo.test.ts`
pins the committed block to what the module generates, so a copy edit cannot
leave a stale title in the file every crawler reads first.

### 3. One page is indexed. Three are not.

| Path | Robots | Canonical | Why |
| --- | --- | --- | --- |
| `/` | `index, follow` | self | The page written to be found |
| `/create` | `noindex, follow` | none | An application, not a document |
| `/manage/:id` | `noindex, nofollow` | none | Someone's guest list |
| `/i/:id` | `noindex, nofollow` | none | Someone's private event |
| unknown paths | `noindex, follow` | none | `*` renders the landing page |

`/create` is the interesting one, because it is the conversion page and the
instinct is to index it. It renders nothing until the app boots and has nothing
a search result could quote; indexing it would put a blank shell in front of
searchers **and** split the home page's ranking with a page that says less.
`follow` is kept — this is a page we decline to list, not one we distrust.

Unknown paths matter for the same reason in reverse: `AppRoutes`' `*` renders
the landing component, which is a kindness to a person and, unlabelled, a
duplicate of the home page for every typo'd URL a crawler finds.

No `noindex` page names a canonical. Google reads noindex + canonical as
contradictory instructions about one URL, and a page that must not be indexed
has no ranking to consolidate. `og:url` is separate and survives on `/i/:id`:
an unindexed page still has one right address for a share card to point at.

### 4. `robots.txt` and `sitemap.xml` are routes, not files

Both need the deployment's absolute origin — the `Sitemap:` directive and every
`<loc>` are required to be absolute — and that is a runtime fact, not a
build-time one. Files in `web/public/` would also collide with
`@fastify/static`, which registers a route per file in `web/dist` and refuses
to boot beside a duplicate declaration. They are registered before the SPA
fallback, which would otherwise answer both paths with an HTML page.

The crawl policy has one load-bearing line:

```
Allow: /api/invitations/*/og.png
Disallow: /api/
```

`Allow` first, for the parsers that take the first match rather than the
longest. And **`/i/` is not disallowed at all.** Guest pages must not be
*indexed*, which is `noindex`'s job — and `noindex` has to be fetched to be
read. Disallowing the path would block the unfurl crawlers instead of the
search index: the one privacy control that costs the product its only
distribution channel. `X-Robots-Tag` repeats the instruction in a header on
every `noindex` response, for a crawler that indexes without parsing HTML.

### 5. The second language gets a URL

The UI language is a client-side preference (`inv-ui-lang`), and a crawler
holds no preferences — so the English site had no address and could not be
indexed at all. `?lang=en` is that address: `/` is Ukrainian, `/?lang=en` is
English, the two declare each other as `hreflang` alternates, `?lang=uk`
canonicalises back to `/` so the home page does not compete with itself, and
`x-default` points at the Ukrainian form because it is the primary market
(01-vision).

The parameter wins over the stored preference, because it is the more specific
answer — someone following an English link asked for English now — and arriving
on one **writes** the preference, or the first click through to `/create` would
silently switch back. The landing page's language toggle moves the URL with it
(`navigate(..., { replace: true })`, never `history.replaceState` — adr-011
§4), so what the canonical promises and what is on screen stay the same thing.

Only the landing page is parameterised. `/create` and `/manage/:id` are
`noindex`, so a second address for each would be two URLs nobody indexes.

### 6. The client mirrors the server, for navigations only

The server ships each path's head in the shell it serves, which is what
crawlers and unfurlers actually read: they fetch one URL and never navigate.
`web/src/seo.ts` covers what that cannot — a client-side route change, after
which the document still carries the head of the page the visitor arrived on,
leaving the tab lying and `/`'s canonical claiming every screen is the home
page.

It is deliberately narrow: title, description, robots, canonical, `<html
lang>`. It does **not** touch `og:*`, because no unfurler runs JavaScript and
the shell's values are already the ones the crawler was handed. Its copy lives
in `i18n.ts` and mirrors `SEO_STRINGS` by hand, the way `types.ts` mirrors
`schemas.ts`.

### 7. The head also gets the things a listing shows

An icon set (`favicon.svg` plus the PNG sizes a launcher and an iOS home
screen need), a web manifest, `theme-color`, and a 1200×630 share card at
`/og-cover.png`. The card and the icons are **committed build artifacts**,
generated by `scripts/build-brand-assets.mjs` from the favicon and a layout in
that script: neither varies, so a crawler should get a static file rather than
a satori render, and generating them keeps the icons from drifting from the
favicon.

`WebSite` + `WebApplication` JSON-LD goes on the landing page only. Not
`HowTo`, not `FAQPage` — Google retired both as rich results in 2023 and they
would be markup for nobody.

### 8. Fonts are requested from the document, and still `@import`ed

`styles.css` keeps its Google Fonts `@import`: the Claude Design sync renders
that file as a standalone closure and would lose the families without it
(`.design-sync/NOTES.md`). But an `@import` is discovered only after the
stylesheet containing it has been fetched and parsed, which serialises
html → css → fonts.css → font files and holds first paint for a round trip it
did not need. A `<link>` in the head starts the same request while the app CSS
is still downloading; the `@import` then resolves from cache. Both, on purpose.

### 9. One name, and it is the domain's

Writing copy for a search listing forced the question the product had been able
to avoid: what is it called? A listing has room for exactly one name, and it
sits next to the URL, where a mismatch is the first thing a reader sees.

The name is **INVINTO**, everywhere: the landing wordmark, the guest page, the
host dashboard, the crash screen, `.ics` files, reply email, the unsubscribe
page, the manifest, the icons, the share card and every search title. It is the
domain's spelling because that is the one name the product cannot restyle
later — links published to `invinto.app` outlive any copy decision, and a
wordmark that disagrees with the address bar reads as someone else's site.

This retires the translated landing wordmark («Запрошення» / "Zaproshennya").
`LANDING.brand` stays in the i18n table, holding the same value in both
languages, rather than moving out to a constant: the page reads its chrome from
that table, and a name kept half in i18n and half beside it is how a product
ends up with four of them. The `lp-brand-mono` monogram keeps deriving its
letter from the wordmark — it no longer has a translation to track, but
deriving still beats a second place to edit the name.

Earlier records are left as written. [adr-013](adr-013-share-loop-instrumentation.md)
quotes the DS `guest-rsvp` template verbatim ("INVITO stays a whisper") and
06-roadmap repeats it; rewriting a quotation to match a later decision would
make the record say something it did not say. Both carry a pointer here
instead.

## Consequences

- The landing page is indexable in two languages with copy written for a
  listing, a share card, and an icon. Two of the three inputs
  `07-monetization.md` §5.1 waits on come from the share loop (adr-013); this
  is the other channel, and it is the only one that reaches a host nobody has
  invited yet.
- Guest pages and dashboards stay out of the index without losing a single
  unfurl. That property is now enforced by tests rather than by care:
  `robots.txt` must not disallow `/i/`, and `/i/:id` must carry exactly one
  `og:title` and it must be the invitation's.
- Every page that serves the shell now does string work on it per request —
  two `indexOf` slices and one small regex. Measured against the disk read the
  handler already did, it is noise.
- **Two copies of the search strings**, server and client, kept in step by
  hand. Accepted for the same reason `types.ts` mirrors `schemas.ts`: the
  alternative is shipping the server's module to the browser or an endpoint the
  client would have to wait on before it could set a title.
- The `web/public/` PNGs are committed binaries. They are regenerated by a
  script, so a change is reviewable as a diff of the script; the images
  themselves are not.

### Deliberately not in scope

- **Prerendering or SSR of page content.** The head is server-rendered; the
  body is not. The landing page is the only page meant for a search result, and
  Google renders JavaScript. If the rendered-page report ever shows the body
  missing, that is the trigger to revisit — not before.
- **A blog, occasion landing pages, or a template gallery.** Pages built to
  rank for "запрошення на весілля" are a content strategy, not a change to the
  app, and there is no traffic yet to say which occasion is worth one.
- **Analytics or Search Console verification.** Verification is a DNS record or
  a file the operator drops in; the app should not carry a hard-coded token for
  one property. See `05-deployment.md`.
- **Indexing guest pages, ever, under any preference.** A host who wanted a
  public event page would be asking for a different product; the id is
  unguessable by construction and the whole model rests on that.

## Revisit triggers

- Search Console shows `/` indexed but ranking for nothing after a quarter of
  traffic — the answer is content (occasion pages), not more tags.
- A host asks for a public, indexable event page. That reopens §3 and adr-005
  together, and it is a product decision before it is a technical one.
- The rendered-page report shows the landing body empty to Googlebot — then
  prerendering the landing route becomes real work, not a hypothetical.
