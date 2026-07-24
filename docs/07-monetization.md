# 07 — Monetization investigation

**Status:** investigation, not a decision · **Date:** 2026-07-24

Nothing here is built or committed to. This doc records the unit economics,
the constraint they run into, and what the existing architecture forces about
any pricing model — so that the eventual ADR argues from measured numbers
rather than from a blank page. It expands the "Business model direction (not
yet built)" note in [01-vision.md](01-vision.md).

## 1. The question

The operator pays for LLM calls today, bounded by free-tier-first routing
([adr-007](decisions/adr-007-in-process-providers.md)) and two guardrails
([adr-008](decisions/adr-008-operator-cost-guardrails.md)). BYOK
([adr-006](decisions/adr-006-byok-passthrough.md)) lets a power user carry
their own cost, but it is a cost-avoidance mechanism, not revenue. Can this
product pay for itself, and how?

## 2. Unit economics

Per published invitation, from the cost figure measured in adr-008 and the
prices in [pricing.ts](../server/src/llm/pricing.ts):

| Item | Cost |
| --- | --- |
| Generate — 3 calls, paid `gemini-2.5-flash` | $0.0007 |
| ~3 field regenerations | ~$0.0005 |
| OG render, JSON store, guest-page bandwidth | rounding error |
| **Text-only event** | **~$0.001–0.002** |
| One AI background ([adr-009](decisions/adr-009-ai-background-layer.md)) | $0.039 |
| **Event where the host tries 2 backgrounds** | **~$0.08** |

Fixed cost is one Northflank container plus a 1 GB volume
([05-deployment.md](05-deployment.md)). At $3 net per paid event, roughly
**7 paid events per month** covers hosting.

Market anchors for the same deliverable (checked 2026-07-24, sources in §9):
Evite Premium $17.99–$36.99 per event; Paperless Post coins from 25/$12 with
premium designs at 3–8 coins per recipient (~$130 for 150 guests) and a ~$250/yr
Pro tier; Greenvelope memberships from $125/yr. The marginal cost here is
three to five orders of magnitude below those prices.

**Margin is not the constraint.** Two further numbers fall out of the
guardrail configuration and are worth carrying into any pricing decision:

1. The default `DAILY_BUDGET_USD=5` breaker equals **7,100 text generations
   or 128 background images**. With `LIMIT_BACKGROUNDS_PER_DAY=3`, 43 hosts
   maxing their background allowance exhaust the day's budget. Backgrounds
   are the only cost item that can realistically trip the breaker — which
   makes them the natural first thing to sit behind a paywall.
2. Free-tier routing currently caps throughput at **~6 invitations/day**
   (Gemini's ~20 req/day carries copy and field regeneration — see
   [05-deployment.md](05-deployment.md), "Free-tier quotas"), i.e. ~180
   events/month. That is below the volume any pricing model needs. Moving
   copy onto a paid Gemini key at that volume costs about **$0.13/month**.
   The free tier is a growth ceiling, not a saving.

## 3. The constraint that decides everything

A private host organizes one or two events a year (adr-008 already assumes
"one host ≈ 1–2 generations per event"). Lifetime value is therefore
approximately **one transaction**, permanently. Two consequences:

- **Consumer subscriptions cannot work.** There is no second month of value
  to sell to a host who threw one birthday party.
- **Customer acquisition cost must be ~zero.** No paid channel survives a
  one-transaction LTV at consumer price points. The only affordable channel
  is the share link itself: every published invitation is opened by 20–100
  guests who are precisely the target user.

**That loop is currently not wired.** `web/src/components/guest/` contains no
link back to the product — no call to action, no badge. And
[metrics.ts](../server/src/metrics.ts) counts generations, publishes, RSVPs
and backgrounds, but there is no `/i/:id` view count and no attribution from
a guest page to a subsequent generation (NFR-6 does not cover it). The single
number that determines whether any pricing model works — new hosts produced
per published invitation — is not measurable today.

## 4. What the architecture already forces

Three constraints are settled by existing decisions and should not be
re-litigated by a pricing model:

1. **The billable unit is the published event, not the guest.** Competitors
   price per recipient because they deliver the email. This product delivers
   nothing — the host pastes a link into a messenger (01-vision, intent 4).
   Guest count is neither known nor gateable. Coin-style per-recipient
   pricing is unenforceable here.
2. **There is exactly one server-side chokepoint** where value has been
   demonstrated and the host has committed: `POST /api/invitations/publish`
   → `createRecord` in [store.ts](../server/src/store.ts). It is the only
   place a paywall can attach without a schema-wide change.
3. **Payment fits the no-accounts model unchanged.** Under
   [adr-005](decisions/adr-005-capability-tokens.md) a paid receipt is just
   one more capability token on the record, beside `manage_token`: checkout
   → webhook → entitlement flag on `PublishedRecord`. No users table, no
   sessions. ADR-005's consequences already anticipate tokens being attached
   to identities later.

## 5. Recommendation

### 5.1 Instrument before pricing anything (prerequisite)

Count unique views on `/i/:id`, add a "create your own" call to action on the
guest page carrying a referral parameter, and attribute it in
`recordGeneration`. Roughly two days of work, no payment surface, and it
produces the gating datum:

- **< ~0.3 new hosts per published invitation** — no pricing model rescues
  the economics; the honest conclusion is that this stays a non-commercial
  project.
- **> ~0.7** — acquisition is effectively free and the model in §5.2 works.

Everything below is conditional on this measurement.

### 5.2 One-time premium unlock per event — $2–3 (UA) / $7–9 (EN)

Free stays fully functional and publishes with a small "made with …" badge on
the guest page. One payment removes the badge and unlocks AI backgrounds
(§2's cost driver), higher RSVP volume, and a custom link slug.

The badge is simultaneously the acquisition channel and the thing being sold,
so the payment falls on exactly the hosts for whom it stings — an unusually
clean freemium fit. Gate the **upgrade** at the §4.2 chokepoint, never the
publish itself: gating publish severs the loop that §3 says is the only
affordable channel.

Guest-side experience must never degrade behind the paywall, for the same
reason.

### 5.3 Organizer tier — where the recurring revenue actually is

Event planners, wedding agencies, restaurants and venues have the frequency
that a subscription needs (€10–20/month is plausible). This is also the only
segment for which per-key metering — rejected-for-now in adr-006 — starts to
make sense. Materially more work than §5.2: accounts-adjacent state, branding
controls, and the store migration in §7.

## 6. Rejected

- **Consumer subscription** — frequency (§3).
- **Per-guest / coin pricing** — unenforceable (§4.1).
- **Ads or vendor placements on the guest page** — burns the only acquisition
  asset the product has, and contradicts NFR-4's minimal-data posture.
- **Cash-gift collection** — regulated fintech, far outside the product's
  scope even though it is common at Ukrainian weddings.

## 7. What taking money breaks

- **[NFR-7](03-non-functional-requirements.md) becomes a liability.** "Do not
  scale above 1 instance" plus a file-backed store is a reasonable simplicity
  choice for a free product; the moment a host pays, durability and uptime
  become obligations. The SQLite item in
  [06-roadmap.md](06-roadmap.md)'s backlog moves from optional to
  prerequisite.
- **Guardrail state resets on deploy** (adr-008, accepted leniency). Harmless
  for free allowances, wrong once an entitlement is involved — entitlements
  must live in the store, not in process memory.
- **Payment rails are the hard part in this market.** Stripe's Ukraine
  availability needs verifying before anything is designed around it; the
  practical set is LiqPay / WayForPay / Fondy / Monobank acquiring. For the
  English-language market, a merchant of record (e.g. Paddle) would absorb
  cross-border VAT for a solo operator. At ~$300/month revenue, VAT
  registration and bookkeeping — not code — are the dominant overhead.
- **No technical moat.** The product is a prompt plus a closed CSS enum map
  (adr-003); it is a weekend to clone. The defensible parts are Ukrainian
  copy quality, the messenger-native rather than email-native flow, the
  design system's taste, and the returning-host index
  (`web/src/hostInvitations.ts`).

## 8. Open questions

1. New hosts per published invitation (§5.1) — unmeasured, gates everything.
2. Willingness to pay at the §5.2 price points in UA vs EN markets —
   untested; the price range is anchored on competitors serving a
   higher-income, email-centric market.
3. Whether the organizer segment (§5.3) exists in reachable numbers, or is a
   sales-led business this project is not staffed for.

## 9. Sources

Competitor pricing checked 2026-07-24:

- <https://www.womangettingmarried.com/paperless-post/>
- <https://www.invitedrop.com/blog/evite-vs-paperless-post>
- <https://www.invitedrop.com/blog/how-much-do-online-invitations-cost>
- <https://text-my-wedding.com/blog/paperless-post-greenvelope-evite>
