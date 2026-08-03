# 08 — Internet promotion: strategy and plan

**Status:** strategy, nothing built · **Date:** 2026-08-03

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

Scanned 2026-08-03; sources in §10. The two markets are not the same fight.

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

Verified against the live site, not inferred:

- `<title>` is **"Invitation Studio"** — a name that appears nowhere in the
  product, in neither target language.
- `<html lang="en">` is hardcoded, on a product whose primary market is
  Ukrainian.
- No meta description, no canonical, no `hreflang`, no favicon, no OG tags on
  the landing page — `og:*` injection exists but only for `/i/:id`
  ([routes/og.ts](../server/src/routes/og.ts)).
- **`/robots.txt` and `/sitemap.xml` both return the SPA shell with HTTP 200**,
  because the catch-all serves `index.html` for every unmatched path. There is
  no `web/public/` directory at all.

The whole of `web/index.html` is nine lines of boilerplate. A search engine
crawling this today indexes an English-titled blank page. Any plan involving
search is dead on arrival until this is fixed, and it is a small fix.

### 4.2 The product has three names, and one of them is a competitor's

| Where | Name |
| --- | --- |
| [web/index.html](../web/index.html) | Invitation Studio |
| [i18n.ts](../web/src/i18n.ts) `LANDING` | Запрошення / Zaproshennya |
| [unsubscribePage.ts](../server/src/unsubscribePage.ts) | **INVITO** |
| Domain ([05-deployment.md](05-deployment.md)) | invinto.app |

Three names across four surfaces is a promotion problem on its own — nobody can
recommend a product they cannot name. But the specific collision is worse:
**INVITO is an established competitor in exactly this niche and language**
(§3.1, `invito.ua`, 1000+ couples, ranking for the target keywords). Promoting
"INVITO" in a Ukrainian wedding community sends the traffic to them. The
domain, `invinto.app`, reads as a typo of it.

"Запрошення" is not a usable brand either — it is the generic Ukrainian noun
for "invitation," unsearchable and untrademarkable.

**Pick one name and propagate it before spending effort on any channel.** This
is the single highest-leverage item in this document, and it gets more
expensive with every published share link that carries the old one.

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

### 4.4 Guest pages are indexable, and promotion is what makes that bite

`/i/:id` emits `og:*` and `twitter:card` but **no `robots` meta**. Published
invitations carry real people's names, home addresses, and dates. Today nothing
crawls them because nothing links to them; the moment promotion works, links
appear in public places and they become crawlable.

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

**Name (4.2) → indexing safety (4.4) + SEO surface (4.1) → gate (4.3) →
share sheet (4.5) → traffic.**

The name comes first because every asset produced before it — every post, every
share link, every indexed page — has to be redone after it. Indexing safety
comes before anything that attracts a crawler.

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

1. **Settle the name** (§4.2) and propagate it to `web/index.html`, `i18n.ts`,
   `unsubscribePage.ts`, the email templates, and the docs. Check availability
   against `invito.ua` before committing.
2. **`noindex` on `/i/:id`** (§4.4). One meta tag. Must precede any traffic.
3. **SEO surface** (§4.1): real bilingual title and description, `lang`
   matching the UI language, landing OG tags, favicon, a `web/public/` with a
   real `robots.txt` and `sitemap.xml` served ahead of the SPA catch-all.
4. **Open the publish gate** (§4.3) — `PUBLISH_REQUIRES_ACCOUNT=0`, no deploy.
5. **Native share sheet at publish** (§4.5) — the backlog item, ~one PR.
6. **Fix the `rsvp_prompt` copy** (§2) — the only field anyone regenerates.
7. **Add landing-page analytics** (§2) — privacy-respecting and self-hosted or
   Plausible-class, consistent with NFR-4. Without it Phase 1 cannot be read.

*Exit criterion: one name everywhere; a stranger can go from landing page to a
shared Viber link without signing in; `/robots.txt` is a real file; guest pages
are `noindex`.*

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

1. **What is the product called?** (§4.2) Blocks everything else.
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

## 10. Sources

Live product figures read 2026-08-03 from `https://invinto.app/api/metrics` and
`/healthz`. Competitor scan, same date:

- <https://invito.ua/> · <https://invito.ua/pricing/>
- <https://evonta.com.ua/>
- <https://www.wedding-invitation.website/>
- <https://ua.weblium.com/zaproshennya-na-vesillya>
- <https://www.greetingsisland.com/ai-invitation-generator>
- <https://venngage.com/ai-tools/invitation-generator>
- <https://invitfull.com/> · <https://rsvpify.com/online-invitations/>
