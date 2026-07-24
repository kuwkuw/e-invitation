# 01 — Product vision & business intent

## One-liner

Describe your event in one sentence → get a beautiful, editable e-invitation
with a share link and an RSVP page. No design skills, no guest accounts.

## Problem

People organizing personal events (birthdays, weddings, housewarmings) in
Ukraine and similar markets today either send a plain text message in
Viber/Telegram or wrestle with generic design tools (Canva-style) that demand
taste, time, and English. Existing e-invite services assume guest registration
and email-centric sharing, which does not match how these communities actually
communicate (messenger links).

## Intent

1. **Zero-effort creation.** The host types one natural-language sentence in
   Ukrainian or English; AI extracts the event facts and produces both the copy
   and the visual design. Target: editable invitation on screen in ~3 seconds.
2. **Host stays in control.** Every text field is directly editable and can be
   individually regenerated. The AI is a draft-writer, not an author of record.
3. **Frictionless for guests.** The share link opens a public invitation page
   with a one-tap RSVP form. Guests never register, never install anything.
4. **Messenger-native sharing.** Distribution targets Viber, Telegram, and
   WhatsApp links (planned: OG image so the link unfurls as a card).
5. **Bilingual by design.** Ukrainian and English are first-class: the copy
   language follows the host's input sentence; the UI language is a separate
   toggle.

## Target users

- **Host** — a private person organizing a family/social event. Non-technical,
  mobile-first, communicates via messengers. Creates, edits, publishes, and
  watches RSVPs arrive.
- **Guest** — receives a link in a messenger. Opens it, reads, taps
  attending/not attending, optionally leaves a note. No account, no app.

## Success signals

- **Regenerate-rate** (per-field regenerations ÷ generations) — the primary
  copy-quality signal, exposed at `GET /api/metrics`. High rate = the model's
  first draft is not good enough.
- Publish rate (generations that end in a published link).
- RSVP responses per published invitation (guest-side friction check).
- Per-request LLM cost and latency (logged by the gateway) — the unit economics
  guardrail.

## Business model direction (not yet built)

Operator pays for LLM calls today (free-tier providers first); the settled
path is user-level BYOK (bring-your-own-key) so power users carry their own
model costs. See [decisions/adr-006-byok-passthrough.md](decisions/adr-006-byok-passthrough.md)
and [decisions/adr-007-in-process-providers.md](decisions/adr-007-in-process-providers.md).

Revenue is a separate, still-open question: [07-monetization.md](07-monetization.md)
records the unit economics (~$0.002 per text-only event, $0.039 per AI
background), why host frequency rules out consumer subscriptions, and why the
guest-page share loop — currently uninstrumented — gates every option.

## Explicit non-goals

- No full-image (diffusion) invitation generation — see
  [decisions/adr-003-no-image-generation.md](decisions/adr-003-no-image-generation.md).
- No guest accounts or guest data collection beyond the RSVP form.
- No email delivery; the share link is the distribution mechanism.
