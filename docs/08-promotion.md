# 08 — Internet promotion: strategy and plan

**Status:** strategy · **Date:** 2026-08-03 · §4.2 (the name) settled and
propagated the same day; everything else is unbuilt

This doc answers one question: how does this product get in front of people on
the internet, given that [07-monetization.md](07-monetization.md) §3 proves the
acquisition budget is approximately zero and
[06-roadmap.md](06-roadmap.md) records that traffic "remains the one thing no
feature in this backlog produces."

It is a plan for promotion, not a growth-hacking wishlist. Every channel below
is tested against the §3 constraint, and the first phase is not promotion at
all — it is removing the things that would waste it.

## 1. What promotion is actually for, right now

The instinct is "get users." That is the wrong goal for this quarter, and
picking it would produce a plan that cannot be evaluated.

[07-monetization.md](07-monetization.md) §5.1 established that a single
number — new hosts produced per published invitation — decides whether this
product has a commercial future or is permanently a non-commercial project.
That number is instrumented ([adr-013](decisions/adr-013-share-loop-instrumentation.md))
and unreadable, because the denominator is a handful of the operator's own test
events.

**So the goal of the first promotion effort is a readable sample, not growth.**
Roughly 30–50 published events by real hosts with real guest lists. That is a
bounded, achievable, falsifiable target, and it is worth more than 10,000
landing-page visits that never publish anything. Everything in §7 is sequenced
toward it.

## 2. Where we actually are

Live figures from `https://invinto.app/api/metrics`, read 2026-08-03:

| Metric | Value |
| --- | --- |
| Generations | 21 |
| Publishes | 12 (publish rate 0.57) |
| RSVPs | 11 |
| Guest-page views | 6 |
| `views_per_publish` | **0.5** |
| `referred_generations` | 0 |
| `new_hosts_per_publish` | **0** |
| AI backgrounds used | 0 |
| Field regenerations | 6 — **all of them `rsvp_prompt`** |

Three readings matter, and two of them are cautions.

**`new_hosts_per_publish` = 0 is not a verdict.** 07-monetization §5.1 sets
< ~0.3 as the number that ends the commercial question. It must not be applied
here. Twelve publishes produced six guest views — a published invitation that
was genuinely sent to a guest list is opened by 20–100 people, so
`views_per_publish` of 0.5 does not describe a weak share loop, it describes
invitations that were never shared with anyone. This is dev traffic measuring
itself. The kill threshold applies to a sample of real events; we do not have
one.

**The regenerate-rate is concentrated, which is a gift.** Every one of the six
field regenerations was on `rsvp_prompt`, and none on title, body, or greeting.
The aggregate rate of 0.29 reads as a general copy-quality problem; the
breakdown says the model writes one field badly. That is a cheap, targeted
prompt fix, and it is worth doing before traffic arrives rather than after —
first impressions on cold traffic do not repeat.

**Nobody has ever used the AI background.** Zero, across 21 generations, on the
feature that is both the product's most demoable surface (§6.3) and the only
cost item that can trip the budget breaker. Either it is undiscoverable or
unwanted; with n=21 we cannot tell, and one more reason to want real traffic.

There is also **no product analytics of any kind** — no Plausible, no GA, no
event tracking anywhere in `web/` or `server/`. `GET /api/metrics` starts
counting at the generate call, so the landing page is entirely dark: we cannot
see visits, or how many visitors type a sentence. Any campaign run today is
unattributable past the first LLM call.

## 3. What we are competing against

Scanned 2026-08-03; sources in §11. The two markets are not the same fight.

### 3.1 Ukrainian market — done-for-you, expensive, slow

- **Invito** (`invito.ua`, also `invito.link`) — bespoke wedding invitation
  sites, **2,500₴ (MINI) / 3,500₴ (MAX)**, "1000+ couples," per-guest unique
  links with named greetings, RSVP tracking, companion app for the guest list.
- **Evonta** (`evonta.com.ua`) — templates plus custom design; ready templates
  instant after payment, custom **1–3 days**; price by request via Telegram.
- **wedding-invitation.website** — made to order, **2–4 business days**.
- **Weblium** — general site builder with a wedding-invitation landing page;
  free tier, but you build the thing yourself.

Every one of them is either done-for-you at tens of dollars with a turnaround
measured in days, or a builder that demands exactly the taste and time that
[01-vision.md](01-vision.md) says the target host does not have. **Not one is
instant, free, and self-serve.** That gap is the whole opportunity.

Note also what they all sell: *weddings*. A 2,500₴ bespoke site is a rational
purchase for a wedding and an absurd one for a five-year-old's birthday. The
long tail — birthdays, kids' parties, christenings, corporate year-ends, the
`chips` already on the landing page — is served today by a plain text message
in Viber. That is the incumbent to beat, and it is beatable.

### 3.2 English market — commodity, crowded, free

"AI invitation generator" returns Greetings Island, Venngage, Template.net,
Invitfull, partyinvitation.ai, birthdayinvitation.ai, RSVPify — most free, most
with RSVP built in, several explicitly "no signup." These are established
domains with content teams.

**Recommendation: do not fight for English search traffic.** The product has no
technical moat (07-monetization §7 says so plainly), no domain authority, and
no content budget. English stays available in the UI and rides the share loop
where it turns up naturally, but it is not a channel we spend on.

### 3.3 What that makes the positioning

The differentiator is *not* "AI invitations" — that is a commodity in English
and not what the Ukrainian incumbents compete on. It is:

> **One sentence, three seconds, free, in Ukrainian, straight into Viber.**
> No designer, no waiting three days, no 2,500₴, no accounts for your guests.

Against Invito the honest framing is not "cheaper" — it is *a different job*.
They sell a wedding centrepiece; we replace the text message you were going to
send anyway. Positioning against them on weddings is a fight on their ground
with their strengths. Positioning on the long tail is uncontested.

## 4. Blockers — nothing gets promoted until these are fixed

This section is the reason the plan has a Phase 0. Driving traffic at the
current deployment would waste it, and in one case would do harm.

### 4.1 There is no SEO surface at all

Verified against the live site, not inferred (the `<title>` has since been
fixed by §4.2's rename; everything below it still stands):

- `<html lang="en">` is hardcoded, on a product whose primary market is
  Ukrainian.
- No meta description, no canonical, no `hreflang`, no favicon, no OG tags on
  the landing page — `og:*` injection exists but only for `/i/:id`
  ([routes/og.ts](../server/src/routes/og.ts)).
- **`/robots.txt` and `/sitemap.xml` both return the SPA shell with HTTP 200**,
  because the catch-all serves `index.html` for every unmatched path. There is
  no `web/public/` directory at all.

The whole of `web/index.html` is nine lines of boilerplate. A search engine
crawling this today indexes a correctly-titled blank page. Any plan involving
search is dead on arrival until this is fixed, and it is a small fix.

### 4.2 The name — resolved: **Hostymo**

**Settled 2026-08-03 and propagated.** It took two attempts on the same day and
the discarded one is instructive, so both are recorded.

**Where it started.** The product was calling itself five things:
`Invitation Studio` (`web/index.html` and the `UI.appTitle` string),
`Запрошення` / `Zaproshennya` (the landing `LANDING.brand`), `Студія запрошень`
(the Ukrainian `appTitle`), and `INVITO` (the guest, manage, crash and
unsubscribe wordmarks, the email templates, the `.ics` `PRODID`) — on the
domain `invinto.app`. Nobody can recommend a product they cannot name.

`INVITO` was the dangerous one: **Invito is an established competitor in this
exact niche and language** (§3.1, `invito.ua`), so promoting it in a Ukrainian
wedding community would have sent the traffic to them.

**The first answer, and why it did not survive.** The domain looked like the
resolution: `invinto.app` was a **typo made at registration** — `invito` was
intended — and adopting the typo as the name cost only a source rename where
every alternative cost a domain migration. Two facts then arrived that the
first pass had not checked, and either alone would have been enough:

1. **`invinto.com` is a live business** — a UK invoicing and expense SaaS, with
   `@invintoapp` on Twitter and `@Invinto` on Facebook. Searching the bare word
   returns them, not us. So the name was never clean either; it merely traded a
   same-market collision for a same-spelling one.
2. **`.ua` second-level domains require a registered Ukrainian trademark**
   matching the word exactly. `invito.ua` exists, so `INVITO` is very probably
   a **registered mark** in this market — and `INVINTO` is one inserted letter
   from it, phonetically near-identical, conceptually the same (both are the
   Latin *invito*, "I invite"), for the same services. That is the exact
   configuration a confusion test is built to catch.

The lesson worth keeping: **domain availability is not trademark clearance, and
a name is not checked until it has been searched against live businesses and a
register.** The first pass checked neither.

**What Hostymo is.** `гостимо` — "we host", "we receive guests". Chosen
against the criteria the first attempt lacked:

- No `invit-` root, so nothing in it is near `Invito`.
- **Not a generic noun.** `Запрошення` was never a candidate for this reason —
  it is simply the Ukrainian word for "invitation", unsearchable and
  unregistrable. `Hostymo` is *suggestive* (it is about receiving guests, not
  about invitations), which is both brandable and a defensible position on the
  register.
- **Stable transliteration.** `гостимо` → `hostymo` is unambiguous under the
  official standard (`г`→`h`, `и`→`y`). Candidates like `завітай` were dropped
  for failing this — it transliterates officially to `zavitai` but phonetically
  to `zavitay`, which is the two-names problem again in a new costume.
- **Free everywhere checked** — `.app`, `.com`, `.net`, `.org` unregistered,
  `.com.ua` unresolved, and no company found under the name. `prosymo` was the
  strongest rival on meaning and was dropped because **Prosimo** is a funded US
  networking company one letter away: the same pattern, again.
- It contains *host*, which is this product's own word for its user throughout
  the codebase and the docs.

The known cost: to an English ear `Hostymo` suggests web hosting. That is real
and it is cheap here, because §3.2 already concludes English search is not a
channel this product should contest.

Two treatments, matching the existing visual system rather than flattening it:

| Treatment | Where | Value |
| --- | --- | --- |
| Letterspaced small-caps wordmark | guest CTA, guest-not-found, manage page, crash screen, unsubscribe page, email | `HOSTYMO` |
| Title case | landing nav and footer, `appTitle`, page `<title>` | `Hostymo` |

Latin script in both languages on purpose: transliterating to `Гостимо` for the
Ukrainian UI would reopen the two-names problem this section exists to close.

**The name and the domain do not match, deliberately and temporarily.** The
product is Hostymo; it is served from `invinto.app`. Renaming the source was
about an hour; moving the domain means DNS, the Northflank binding, the Google
OAuth redirect URI, and re-verifying the Resend sending domain — which restarts
the warm-up that adr-015 §7 made reply mail opt-in over. §10.7 carries what
this costs while it lasts and what closes it.

### 4.3 The publish gate is on in production

`/healthz` reports `"publish_gate": true` — a host cannot get a share link
without signing in with Google.

07-monetization §3 says the share link is the only affordable acquisition
channel, and §5.2 says explicitly: *gate the upgrade, never the publish —
gating publish severs the loop.* For a warm returning host the gate is a fair
trade. For cold campaign traffic it is a mandatory Google sign-in at the moment
of highest intent, and it is the largest single leak in the funnel we are about
to spend effort filling.

[adr-014](decisions/adr-014-host-accounts.md) anticipated exactly this:
`PUBLISH_REQUIRES_ACCOUNT=0` keeps sign-in available while publishing stays
anonymous, and flips **without a deploy**. The ADR also froze a metrics
baseline at the gate boundary, so the comparison is already set up.

Recommendation: **open the gate for the seeding phase.** The whole point of
Phase 1 is a readable share-loop number, and the gate sits on the loop. It can
close again once there is a sample.

### 4.4 Guest pages are indexable — **fixed 2026-08-03**

`/i/:id` emitted `og:*` and `twitter:card` but **no `robots` meta**. Published
invitations carry real people's names, home addresses, and dates. Nothing
crawled them while nothing linked to them; the moment promotion works, links
appear in public places and they become crawlable.

"Reachable only by link" is what makes the page unlisted, not what keeps it out
of Google. Search engines discover URLs from wherever they are pasted — a
public Facebook group, an open Telegram channel, a forum thread — and a host
pasting their own share link into a public group is a normal thing to do, not a
mistake. The link being unguessable stops enumeration; it does not stop
indexing.

Now `<meta name="robots" content="noindex">`, alongside the OG tags. The two
directives pull against each other and the resolution is worth stating, since
the obvious "stronger" fix is the broken one: a `Disallow: /i/` in robots.txt
would stop the messenger crawlers that FR-3.5's unfurl depends on, and would
*also* leave the page indexable, because a crawler blocked from fetching never
sees the `noindex` and Google will still list a URL it found elsewhere.
**Crawlable-but-noindex** is the only combination that unfurls and stays
unlisted. `server/test/og.test.ts` asserts both halves together so a future
robots.txt cannot quietly break one.

Ukrainian family events surfacing in Google search results is a trust incident
and runs against NFR-4's minimal-data posture.
[unsubscribePage.ts](../server/src/unsubscribePage.ts) already sets
`<meta name="robots" content="noindex">` — the guest page should do the same,
and this must land *before* Phase 1, not after.

### 4.5 The share sheet is still copy-link only

Already in the roadmap backlog and correctly identified there as "the only one
that touches the loop the measurement is about." At the highest-value moment in
the product, a mobile host has to copy a link, leave the app, find Viber, and
paste. The guest page already uses `navigator.share`; the host's panel does
not. **This is the one feature that should ship as part of the promotion push**,
because it is the loop.

### 4.6 Capacity, briefly

`/healthz` shows Groq and Gemini configured, 10 generations per IP per day, and
a $5 daily budget. 07-monetization §2 put free-tier throughput at ~6
invitations/day, which the Groq addition roughly tripled. A seeding phase of
30–50 events over several weeks fits comfortably. A TikTok video that lands
does not. Know which failure mode you are risking before §6.3.

## 5. Sequencing rule

The blockers above are not a to-do list to work through in parallel with
promotion. They gate it, and the order matters:

**~~Name (4.2)~~ → indexing safety (4.4) + SEO surface (4.1) → gate (4.3) →
share sheet (4.5) → traffic.**

The name came first because every asset produced before it — every post, every
share link, every indexed page — would have to be redone after it. That one is
now done (§4.2). Indexing safety is next, because it comes before anything that
attracts a crawler.

## 6. Channels

Ranked by fit with the ~zero-CAC constraint, not by reach.

### 6.1 Tier 1 — the share loop itself

This is the channel. Every published invitation reaches 20–100 people who are
by definition the target user, at zero marginal cost. Nothing else in this
document has those economics.

Built: the guest CTA and referral attribution
([adr-013](decisions/adr-013-share-loop-instrumentation.md)). Missing: the
share sheet (§4.5), and the "made with …" badge that 07-monetization §5.2
describes as simultaneously the acquisition channel and the thing being sold.
The badge is worth building now for the acquisition half alone, independent of
whether the payment half is ever built.

### 6.2 Tier 1 — Ukrainian-language search

The only durable, compounding, zero-cost channel available, and viable in
Ukrainian precisely because §3.2 is not.

The backlog's **invitation gallery** item is the asset. Sample invitations are
deterministic (adr-003 — no LLM call, no cost), so a gallery is both a
conversion surface for visitors who want to see before typing, and the only
plausible indexable content the product could have. Pair it with long-tail
informational pages, where intent is high and competition is thin:

- `запрошення на день народження` / `на хрестини` / `на корпоратив`
- **`текст запрошення на весілля`** — people search for the *wording*, and this
  product generates wording. The closest possible match between a query and a
  product's actual function.
- `як запросити гостей` — the problem-shaped query

Each becomes a page that demonstrates the product on the query's own topic and
ends in the create flow. This is weeks of work, not days, and it only pays back
after §4.1 exists.

### 6.3 Tier 2 — short-form video (TikTok / Instagram Reels)

Highest ceiling for the Ukrainian consumer market, and the format is unusually
well matched: *type one sentence → a finished invitation appears.* Three
seconds of generation is the entire hook, with no editing required. The AI
background (§2, unused) is the visually strongest asset in the product and
belongs here.

Costs time only, which is what the §3 constraint permits. Requires consistency
over weeks to mean anything, and §4.6 capacity should be checked before a video
is pushed hard.

### 6.4 Tier 2 — community seeding

Ukrainian Facebook groups and Telegram communities for brides, parents, and
event organizers are where the target host already asks these questions.

Two honest caveats. First, **this must be done as a participant, not a
spammer** — answering "how do I invite people to my kid's party" with a working
free tool is welcome; dropping links is a ban. Second, **I could not verify
specific active groups from here** — the searches returned generic directory
spam rather than real communities. Identifying the actual venues is a manual
research step in Phase 1, and inventing group names in this document would be
worse than leaving the gap visible.

### 6.5 Tier 3 — one-shot launch platforms

Product Hunt, Show HN, `r/SideProject`, DOU and Ukrainian dev communities.
These produce a spike of technically-minded visitors who are mostly not the
target host, and no compounding return.

They are still worth exactly one round, for one reason: Phase 1 needs a
*readable sample* fast, and a spike of 200 curious visitors that yields 20
published events achieves the measurement goal even though it fails as a
growth channel. Use it as a measurement instrument, then stop.

### 6.6 Rejected

- **Paid advertising** — LTV is approximately one transaction (07-monetization
  §3). No consumer-priced paid channel survives that. This is arithmetic, not
  caution.
- **Vendor / wedding-agency partnerships** — this is the §5.3 organizer segment
  and it is a sales-led motion. Real, but not staffed, and not a promotion
  plan.
- **Email marketing** — no list, and adr-015 §7 made reply mail opt-in
  specifically because the sending domain is unwarmed. Marketing mail from it
  would burn deliverability the product actually depends on.
- **Ads or vendor placements on the guest page** — already rejected in
  07-monetization §6 for burning the only acquisition asset. Promotion does not
  reopen it.
- **SEO on English "AI invitation generator"** — §3.2.

## 7. The plan

### Phase 0 — make the product promotable (prerequisite)

Nothing here is a marketing task; all of it gates marketing. In the §5 order:

1. ~~**Settle the name**~~ — **done** (§4.2): `Hostymo` / `HOSTYMO`,
   propagated across `web/index.html`, `i18n.ts`, the four UI wordmarks,
   `unsubscribePage.ts`, the email strings, the `.ics` `PRODID`, and the docs.
   Still open behind it: the register search (§10.3) and the domain (§10.7).
2. **`noindex` on `/i/:id`** (§4.4). One meta tag. Must precede any traffic.
3. **SEO surface** (§4.1): real bilingual title and description, `lang`
   matching the UI language, landing OG tags, favicon, a `web/public/` with a
   real `robots.txt` and `sitemap.xml` served ahead of the SPA catch-all.
4. **Open the publish gate** (§4.3) — `PUBLISH_REQUIRES_ACCOUNT=0`, no deploy.
5. **Native share sheet at publish** (§4.5) — the backlog item, ~one PR.
6. **Fix the `rsvp_prompt` copy** (§2) — the only field anyone regenerates.
7. **Add landing-page analytics** (§2) — privacy-respecting and self-hosted or
   Plausible-class, consistent with NFR-4. Without it Phase 1 cannot be read.

*Exit criterion: ~~one name everywhere~~ (done); a stranger can go from landing
page to a shared Viber link without signing in; `/robots.txt` is a real file;
guest pages are `noindex`.*

### Phase 1 — seed to a readable sample

Target: **30–50 published events by hosts who are not the operator**, with real
guest lists. Deliberately manual and unscalable — this is measurement, not
growth.

- Personal network first. Ten real events from people who will actually send
  the link beats a thousand anonymous visitors, and they will tell you why they
  did not send it, which no metric will.
- Community seeding (§6.4), starting with the research step.
- One launch-platform round (§6.5).
- Start the video cadence (§6.3) — it needs weeks of lead time regardless.

*Exit criterion: `views_per_publish` in the tens rather than below 1. That
number, not the publish count, is what says invitations are reaching real
guests and the sample is real.*

### Phase 2 — read the number

With a real sample, read `new_hosts_per_publish` against 07-monetization §5.1,
using the post-baseline block and remembering §5.1's own two cautions about
imprecision and the moved denominator.

- **< ~0.3** — the honest conclusion is a non-commercial project. That is a
  legitimate, valuable answer, and it retires an open question that has been
  open since July.
- **> ~0.7** — acquisition is effectively free, §5.2's model works, and
  Phase 3 begins.

### Phase 3 — conditional, and not planned here

Compounding SEO (§6.2) at real scale, the badge as a paid-removal surface, and
the §5.3 organizer segment. Deliberately unplanned: every one of these is
contingent on Phase 2, and planning them now would be planning against a number
we do not have.

## 8. What we cannot currently measure

Worth stating plainly, because a promotion plan that cannot be evaluated is a
hobby:

1. **Landing-page conversion** — no analytics at all (§2). Phase 0 item 7.
2. **Campaign attribution.** `GenerateSource` is a closed `direct` | `guest`
   enum ([schemas.ts](../server/src/schemas.ts)), so every visitor from every
   channel in §6 records as `direct` and no channel can be told from another.
   Widening it is a real decision, not a config change: adr-013 and adr-005
   both refused to carry a *referring id* because that builds a host graph. A
   **campaign label** (`tiktok`, `facebook`) is categorically different — it
   identifies a channel, not a person, and stays compatible with the no-accounts
   posture. It should still get an ADR nod rather than being slipped in.
3. **Guest → host conversion timing.** The beacon counts a view and the
   referral tags a generation, but nothing connects a guest who returned three
   weeks later for their own event — which is the realistic path. The number
   will therefore understate the loop. Live with it; closing that gap means
   cross-visit identity, which the product has deliberately refused.

## 9. Open questions

1. ~~**What is the product called?**~~ — answered: Hostymo (§4.2). What remains
   is the register search that neither name has had (§10.3) and the domain it
   is served from (§10.7).
2. Does the Ukrainian long tail (§3.3) actually search for a self-serve tool,
   or does it never occur to them that one exists? A market that does not know
   the category needs demonstration (§6.3), not SEO (§6.2) — and that changes
   which tier-1 channel gets the effort.
3. Is the operator willing to sustain a video cadence for 8–12 weeks? §6.3 is
   the highest-ceiling consumer channel and it is worthless done twice.
4. Does Phase 1's sample size actually make §5.1's thresholds meaningful, or
   does the ratio need hundreds of publishes to stabilize? Worth deciding the
   stopping rule before the number starts moving, so it is not decided by
   whichever reading is most encouraging.

## 10. Trademark position

Not legal advice, and nothing here substitutes for a Ukrainian IP attorney at
the point of filing. It is the fact-finding that decides whether an attorney is
needed at all.

### 10.1 What the rename did and did not settle

Choosing `Hostymo` (§4.2) closed the two collisions the earlier names carried —
`Invito`, a competitor in this exact market, and `Invinto`, a live UK invoicing
SaaS that owns the word in search. Neither is adjacent to `Hostymo` in
spelling, sound, or meaning.

It does not follow that the name is clear. **Nothing has been searched against
a register yet** — only against domains and live businesses, which is what
§4.2's post-mortem says is insufficient. `Hostymo` is a better-founded guess
than `Invinto` was, and it is still a guess. §10.3 is what turns it into a fact.

What *is* worth talking down, whatever the register says, is the fear of being
sued. Enforcement follows commercial harm, and at twelve published events with
no revenue there is none. The realistic risk is **building a brand and then
having to abandon it** — a cost that grows with every share link, indexed page
and messenger unfurl. That is the asymmetry that made renaming twice in one day
cheap and renaming after Phase 1 expensive.

### 10.2 Ukraine is first-to-file, which cuts both ways

Ukraine grants rights to the **first to file**, not the first to use,
regardless of who was trading first. Two consequences, and the second is the
one that gets missed:

- A registered mark that is confusingly similar to ours holds priority over our
  use, however long we have been using it.
- If **nobody** has filed, the register is open — including to us.

There is a concrete instance of the first half already on the record. **`.ua`
second-level domains require a registered Ukrainian trademark matching the
domain word**, so `invito.ua` is strong evidence that `INVITO` is registered
here. That is what disqualified `Invinto`, and it is a live demonstration that
a competitor in this market does use the register.

It also sets a marker for later: a `.ua` domain is not purchasable without a
mark, so `hostymo.ua` is only reachable on the far side of a registration.
`hostymo.com.ua` needs no trademark and was unregistered when checked.

### 10.2b Why the register search is the same hour it always was

`Hostymo` was checked against every major TLD and searched for live companies;
all clear. That is the check the first attempt skipped, and it is still only
half of one. Domain availability tells you nobody took the address. It tells
you nothing about a mark registered by someone who never wanted the domain,
which is the case that actually bites.

### 10.3 What to search, and where — free, no lawyer needed

The Ukrainian register is public and searchable without login at
**<https://sis.nipo.gov.ua/>** (the old `sis.ukrpatent.org` now redirects
there; the office was renamed from Ukrpatent to UANIPIO in 2022). Cross-check
against **WIPO Global Brand Database** and **EUIPO TMview**, which cover
international registrations designating Ukraine — a mark can bind here without
appearing in a purely national search.

Search for `hostymo` and `гостимо`, plus the near neighbours an examiner would
pull in — `hostym`, `hosty`, `гостим` — filtered to the classes this product
would sit in:

| Nice class | Covers | Relevance |
| --- | --- | --- |
| **42** | software as a service, hosting | The core one — this is a SaaS |
| **41** | organising events, entertainment | Likely, given the subject matter |
| 35 | advertising, business administration | Only if the organizer tier (07-monetization §5.3) happens |

Record what is found — registered marks *and* pending applications, since a
pending application carries the priority date that matters.

*This was not run from the development environment: the register is a
JavaScript interface that does not answer to a plain fetch. It is perhaps an
hour of manual work and it is the input every decision below depends on.* If
the interface is the obstacle, Ukrainian IP firms advertise preliminary
searches free or cheap as lead generation — one email buys an authoritative
answer from someone qualified to give it.

### 10.4 What each outcome means

- **Nothing similar in 42 or 41** — the expected case on the evidence so far.
  Exposure is low, the register is open, and filing waits for Phase 2.
- **Something similar registered in 42** — get an attorney's read before the
  name goes anywhere expensive. This is the branch that ended `Invinto`, and it
  is why the search happens before Phase 1 rather than after.
- **Something similar only in 41** — ambiguous, and exactly where an hour of
  professional advice replaces a week of speculation.

One point to raise with whoever runs it: class 42 covers **hosting services**
by name, and `Hostymo` reads as *host* to an English speaker. In Ukrainian
`гостимо` is about receiving guests and is suggestive rather than descriptive,
which is the assessment that matters for a Ukrainian filing. It could land
differently in an English-reading jurisdiction, so it is worth asking about
before any international filing — not before a domestic one.

### 10.5 What to do regardless of the outcome

Free, useful in every branch, and worth doing now:

- **Do not converge visually** with Invito. Confusion is judged on the whole
  impression, not the spelling — and having moved the name well clear, the
  colours, typography and layout should stay clear too.
- **Do not position against them by name.** §3.3 already argues the wedge is
  the long tail rather than weddings; that keeps the products visibly different,
  which is the same argument in trademark terms.
- **Claim the handles now**, while the name is new and unused. `@invintoapp`
  was already gone when the previous name was checked, which is the cheapest
  possible reminder that social identities go before anyone thinks to want them.

### 10.6 Recommendation

Run 10.3 now; adopt 10.5 permanently; defer any filing decision to Phase 2,
when the product either has a future worth protecting or does not.

### 10.7 The name/domain gap, and what closes it

Hostymo is served from `invinto.app`, deliberately (§4.2). Three costs while
that holds, none fatal and all growing:

1. **Word-of-mouth loses its address.** "Always present the name with the
   domain" was the standing advice here, and it does not survive a brand and a
   domain that share no letters. Until they agree, marketing copy has to spell
   out both — "Hostymo, at invinto.app" — which is exactly the friction the
   one-name decision was meant to end.
2. **The domain keeps a collision the name shed.** `invinto.com` is a live UK
   invoicing SaaS (§4.2), so the *address* still sits one TLD from another
   company even though the name no longer does.
3. **Email says one thing and links to another.** Reply notifications sign off
   as `HOSTYMO` from `replies@invinto.app`. Mismatched sender identity is a
   deliverability liability on an unwarmed domain, which is the exact fragility
   adr-015 §7 made reply mail opt-in over.

**`hostymo.app`, `hostymo.com` and `hostymo.com.ua` were all unregistered when
checked (2026-08-03).** Registering them is roughly $15 a year and is not the
migration — it only stops the name being taken while the decision waits. The
migration itself is DNS, the Northflank binding, `CANONICAL_HOST`, the Google
OAuth redirect URI, and re-verifying the Resend sending domain; old links keep
working through the existing canonical-host redirect. Half a day, and it should
happen **before Phase 1 puts the address in front of anyone** — after that,
every posted link, indexed page and video caption carries the wrong host.

## 11. Sources

Live product figures read 2026-08-03 from `https://invinto.app/api/metrics` and
`/healthz`. Competitor scan, same date:

- <https://invito.ua/> · <https://invito.ua/pricing/>
- <https://evonta.com.ua/>
- <https://www.wedding-invitation.website/>
- <https://ua.weblium.com/zaproshennya-na-vesillya>
- <https://www.greetingsisland.com/ai-invitation-generator>
- <https://venngage.com/ai-tools/invitation-generator>
- <https://invitfull.com/> · <https://rsvpify.com/online-invitations/>

Trademark registers and procedure (§10), checked 2026-08-03:

- <https://sis.nipo.gov.ua/> — Ukrainian register, public, no login
  (`sis.ukrpatent.org` 301s here)
- <https://branddb.wipo.int/> · <https://www.tmdn.org/tmview/>
- <https://www.wipo.int/classifications/nice/> — Nice classes 41 / 42
