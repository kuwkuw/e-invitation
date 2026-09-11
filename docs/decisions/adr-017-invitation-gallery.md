# ADR-017 — Invitation gallery

**Status:** accepted · **Date:** 2026-09 · Lands as **FR-14**, and **amends
FR-13.2**. Completes the organic-search channel opened by
[adr-016](adr-016-public-discoverability.md); the content it serves is
deterministic by [adr-003](adr-003-no-image-generation.md), the editor it seeds
is the one [adr-014](adr-014-host-accounts.md) §2 taught to start from an
invitation no generate produced, and the attribution follows
[adr-013](adr-013-share-loop-instrumentation.md) §3. The client half follows
[adr-011](adr-011-client-router.md) §4.

## Context

**The product has no traffic, and that is now a measured fact rather than an
impression.** Production on 2026-09-11, lifetime:

| | 2026-08-02 | 2026-08-08 | 2026-09-11 |
|---|---|---|---|
| generations | 20 | 21 | **26** |
| publishes | 10 | 12 | **15** |
| guest-page views | 6 | 6 | **8** |
| referred generations | 0 | 0 | **0** |
| `views_per_publish` | 0.6 | 0.5 | **0.53** |
| `new_hosts_per_publish` | 0 | 0 | **0** |

[06-roadmap.md](../06-roadmap.md) set the reading to take after the share sheet
shipped: whether `views_per_publish` moves off 0.5 for publishes made after it.
Three publishes and two views in thirty-four days is not an answer, and the
experiment did not fail so much as run out of denominator. Two further readings
come with it: `field_regenerations` is still `{"rsvp_prompt": 6}`, unchanged in
a month, so the one specific copy-quality signal the product ever produced has
gone cold; and `backgrounds` is **0 lifetime**, meaning an entire shipped
feature with its own ADR has never once been invoked.

The honest conclusion is that the loop is not broken — **nobody is entering
it.** Every remaining backlog item except one builds product for hosts who are
not here, which this roadmap has warned about five times in its own words.

**[adr-016](adr-016-public-discoverability.md) delivered the floor and said so.**
The landing page is indexable in both languages with copy written for a
listing, every private surface is `noindex`, and messenger unfurls survive
intact. What it explicitly did not deliver is anything to rank *for*: one page,
targeting one query cluster, on a domain with no inbound links.
[07-monetization.md](../07-monetization.md) §3 allows exactly two zero-cost
acquisition channels. adr-013 took the share link. This is the other one, and
it is the only one that reaches a host nobody has invited to anything.

**The risk this ADR has to answer for.** Six occasion pages differing mainly by
keyword is the shape of a doorway page, and thin near-duplicate pages built per
keyword are named in Google's spam policies. A gallery of pretty cards with a
call to action would be exactly that. What makes these pages legitimate is that
**the thing people search for and the thing the product makes are the same
object** — someone typing «текст запрошення на весілля» wants invitation
wording, and invitation wording is the product's entire output. The pages are
not about the product; they are the product, published.

## Decision

### 1. Seven pages, fourteen addresses, and FR-13.2 is amended

`/gallery` is a hub listing six occasions. `/gallery/:occasion` is the page
written to rank. English keeps the existing scheme — `?lang=en` is the English
address (FR-13.6), not a separate path — so the site's indexed URL count goes
from 2 to 14, each carrying the complete hreflang set.

Slugs are English (`/gallery/wedding`), matching every identifier in the
codebase. A path keyword is a weak signal beside title, `h1` and body, and a
Ukrainian URL vocabulary would add a second naming scheme for no measurable
gain.

FR-13.2 today reads that the landing page is **the one** page offered for
indexing. That was a real decision — everything else is an application,
someone's private event, or a dashboard — and the gallery is the first thing
that is none of those. The rule is amended explicitly rather than allowed to
erode: `/gallery` and `/gallery/<known occasion>` are `index, follow` **with**
a canonical, the first canonical links in the product. Every other surface is
untouched.

**An unknown occasion is a 404 on both sides.** `shellMeta` gives
`/gallery/xyz` the `notFound` strings and `noindex`, and the React route must
render a not-found too — `<Route path="*">` currently sends unknown paths to
the marketing page, which would serve marketing copy under a URL we have just
told crawlers not to index. The occasion list is therefore mirrored by hand in
`server/src/seo.ts` and the web gallery table, the way `types.ts` mirrors
`schemas.ts` (NFR-8). That mirror deserves a louder comment than a type mirror:
drift means a slug the server indexes and the client refuses.

`robots.txt` is unchanged, and that was checked rather than assumed — it still
does not disallow `/i/`, and still `Allow`s the OG image before `Disallow:
/api/`. Either omission stops every published link unfurling with nothing in
the logs.

### 2. The wording examples are the content

An occasion page is a set of ready-to-use invitation texts, each rendered
through `InvitationPreview` in a different style, each with its own call to
action. There is no separate marketing prose, and that is the point: prose
about invitations is a second body of copy that nothing in the product
generates or keeps honest, and it is the part most likely to rot. Here the
content and the conversion are one object.

Four examples per occasion, and **they must look genuinely different.** Four
cards in `warm`/`serif`/`classic` would tell a visitor the product has one
look. Range is half the promise, so it is held by a test rather than by care —
the same reason `SharePanel.test.tsx` holds the filled-accent count.

Six occasions × four examples × two languages is roughly **500 short strings**
— 24 examples, each carrying six copy fields, the brief's handful of words, and
the sentence it was generated from. They are sourced by running the real pipeline and freezing its
output, then hand-editing: the gallery then honestly shows what the product
produces rather than copy polished beyond what any host will get, and the
review pass doubles as the first real look at copy quality since
`regenerate_rate` went cold.

### 3. Every example is a full invitation, and none of them has a date

An example is `{ id, sentence, brief, copy, design }` — a complete
`Invitation`, not a card. The editor regenerates fields from
`invitation.brief`, so an example without one breaks on the first "rewrite this
line".

**Every example carries `date: null`, `time: null`, `venue: null`,
`city: null`.** This is the load-bearing rule:

- A hardcoded date eventually becomes a past date, and **FR-1.8 refuses to
  publish an invitation dated before today** — the template would silently stop
  being publishable on a calendar boundary.
- `date: null` is a save-the-date, which FR-1.8 deliberately keeps publishable.
- It trips FR-1.7's nudge, and "when is it?" is exactly the right thing to ask
  someone who has just taken a template.
- The content becomes timeless, which for pages meant to rank for years is the
  whole point.

The consequence for copy is that `details_line` does not disappear; it becomes
a save-the-date line («Дату та місце повідомимо особисто»). When the host
answers the nudge, the pipeline rewrites it as an ordinary details line.

### 4. "Use this one" seeds the editor with no model call

The copy and tokens are already data (adr-003), so the editor opens with **the
invitation that was clicked** — instantly, free, and honestly. Generating afresh
would hand back something else, which on a conversion surface is a
bait-and-switch.

The address is `<a href="/create?sample=wedding-romantic">` — a full page load,
not a `<Link>`: crawlable, reload-safe, pasteable. A `useGallerySample` hook
mirrors `useReferralSource` exactly: read the parameter once at mount, resolve
it, then strip it with `navigate(…, { replace: true })` and never
`history.replaceState` (adr-011 §4). One parameter, not two — `?sample=` names
the example and its presence implies the origin.

**This is not a new mechanism.** `useInvitationEditor(chat, source, restored)`
already accepts an invitation no generate produced; adr-014 §2 built it for the
sign-in draft, and a gallery sample is the identical state. The parameter's
documentation widens to cover both origins.

Two things must be fixed for the seed to work, and neither is optional:

1. **The date nudge must fire.** It currently lives inside `send()`, the
   generate handler, so a seeded invitation bypasses it — and a gallery sample
   *always* has a null date, so the entire argument in §3 depends on this. The
   check lifts out into a function called after a generate and after a seed,
   preserving both behaviours: the nudge once per session via the
   `datePrompted` ref, the past-date refusal on every turn with no ref.
2. **`description` must be seeded from the example's sentence.** It starts
   empty, so the host's first chat turn would generate from "12 жовтня,
   ресторан Софія" alone — no wedding, no hosts, no tone — and they would watch
   the invitation they chose be replaced by a generic one. Each example stores
   the sentence it was generated from, which §2 already produces.

When both a parked sign-in draft and `?sample=` exist, **the draft wins**:
someone returning from Google is mid-publish, and the sample is a stale
parameter from before the redirect.

### 5. The content ships in the client bundle, and NFR-1 records the price

Roughly **+10 kB gzipped on an 88.9 kB budget**, downloaded by every guest
opening a Viber link who will never see the gallery. Taken deliberately, on the
precedent of adr-011, which paid +13.2 kB for the router and recorded it rather
than reaching for code splitting.

The alternative — content held server-side and injected into the shell as JSON
— keeps the bundle flat but needs a fetch fallback for in-app navigation, which
is a second way to obtain the same data and the shape of bug this codebase
keeps designing out. Route-level code splitting is worse again here: it was
declined in adr-011, and it conflicts directly with §6, since a lazily-loaded
route blanks the prerendered HTML on exactly the pages built to be landed on
from search.

**Revisit trigger:** measure the gzipped delta at the end of the iteration. Past
roughly 100 kB, move the content server-side.

### 6. Prerendering becomes per (path × language)

`prerender.ts` emits one block per language because exactly one page is
prerendered. Seven pages × two languages is fourteen blocks, and
`selectPrerender` chooses by (path, language) rather than language alone. The
built `index.html` therefore stops being a small file; the server strips
thirteen blocks per request, which is one string pass over a file already held
in memory.

This is not an optimisation to be tidied away later. adr-016 §10 states the
reason prerendering exists — Google's JS rendering is a second, queued pass
that gets the least budget on exactly this kind of domain, and Bing is weaker
again. **A gallery page that ships as an empty `#root` does not rank**, which
makes the whole iteration pointless. Held by a test asserting that one block
survives and the rest are stripped.

### 7. `GenerateSource` gains `gallery`, and the publish carries the source

adr-013 §3 made that enum closed for a specific reason: never carry the
referring invitation id, because per-invitation credit builds the host graph
adr-012 and adr-005 both refused. A third origin value carries no id and builds
no graph, so this respects the rule rather than bending it.

**The publish is attributed, not only the generate** — and this is the part
that is easy to get wrong. §4 means taking a sample *does not generate*, so a
visitor can arrive from search, take an example, hand-edit two lines and
publish with zero generations. Attributing only generates would score the very
host this iteration exists to produce as invisible. `usePublishing.publish` is
already the single funnel every publish runs through, which makes it the one
place to add it. Two counters go in `SCALAR_COUNTERS` and nowhere else.

**A baseline is frozen at ship** (`markBaseline`), as adr-014 did for the auth
gate: the gallery adds an acquisition channel, so it changes what `publish_rate`
is a rate *of*, and without a baseline the before and after get compared as if
they measured the same population.

**The top of the funnel needs no code.** Google Search Console gives
impressions, clicks and position per query for free, and `sitemap.xml` already
exists to submit. It separates two failures our own counters cannot tell apart:
*no impressions* means the pages never ranked, which is an authority problem
and implicates nothing about the product; *impressions but no publishes* means
they rank and do not convert, which does. Choosing wrongly between those would
send the next iteration in exactly the wrong direction.

### 8. Design preceded code

Per [adr-010](adr-010-host-manage-link.md) §9, and this is squarely a case for
it — the largest new surface since the host dashboard, well past the
"one button on an existing block" exemption FR-3.6 used. Three artboards live
in the E-invitation DS project under `templates/gallery`: `GalleryHub`,
`GalleryOccasion` and `GallerySpec`, composed by a `Gallery.dc.html` canvas.

A finding from building them belongs in the record: **the Claude Design app
does not recompile `_ds_manifest.json` for this project — only the CLI resync
writes it.** A new template set is therefore invisible until its manifest entry
is written by hand, regardless of its `@template` marker. The same staleness
explains why `brand-name` and `feedback-sheet` have never appeared.
`.design-sync/NOTES.md` carries this.

## Consequences

- The product gains its first pages written for someone who has not heard of
  it. Every prior surface assumed the visitor had a link or an intention.
- **No conclusion before roughly 2026-12-15.** A new domain with no inbound
  links takes three to six months to rank. This document has a documented habit
  of reading too early — the share sheet was taken on six days and an n of two,
  and the roadmap says so in its own words. The only check worth making sooner
  is whether Search Console reports the pages *indexed at all*, which is
  plumbing and answers in about two weeks.
- `index.html` grows to carry fourteen prerendered blocks; the bundle grows by
  about 10 kB gzipped. Both recorded under NFR-1.
- Roughly 500 hand-maintained strings enter the repo, guarded by the existing
  `i18n.test.ts` parity walk extended over the gallery tables.
- The gallery is a new front door for a product whose copy quality has one cold
  signal behind it. If the pages rank and the invitations are mediocre, we will
  find out at a larger n than we have ever had — which is the point, and also
  the risk.

### Deliberately not in scope

- **A view beacon for gallery pages.** adr-013's `/view` beacon exists because a
  guest page view has no other witness. These pages have Search Console above
  and attributed publishes below; a counter between them would cost a route, an
  in-process dedupe set and a test to measure something already visible from
  both ends.
- **More than six occasions.** Adding a seventh is a data entry once the
  machinery exists, and there is no reason to guess at demand before any of the
  six has an impression.
- **A `compact` prop on `InvitationPreview`** for the hub thumbnails. The
  component's contract is mirrored by hand in `InvitationPreview.d.ts` and
  `conventions.md`, and NOTES.md records that this pair has already gone stale
  once. A `transform: scale()` in gallery CSS touches no contract.
- **A second card renderer.** There are already two hand-mirrored token→style
  maps, each held by enum-coverage tests. A third would triple that cost.

## Revisit triggers

- **Bundle past ~100 kB gzipped** at the end of the iteration → move gallery
  content server-side per §5.
- **Search Console shows healthy impressions and zero gallery-attributed
  publishes** after the 2026-12-15 reading → the pages rank and do not convert;
  the next iteration is about the pages, not about acquisition.
- **Search Console shows almost no impressions** after that reading → organic
  search is closed to a domain this size, both zero-cost channels in
  07-monetization §3 are then exhausted, and the honest conclusion in §5.1 gets
  materially closer.
- **A seventh occasion is asked for by an actual host** → add it as data.
