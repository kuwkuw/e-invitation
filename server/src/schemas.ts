import { z } from "zod";

// Source of truth for the invitation data model.
// web/src/types.ts mirrors these shapes and must be kept in sync by hand.

export const Language = z.enum(["uk", "en"]);
export type Language = z.infer<typeof Language>;

// Structured brief extracted from the user's one-sentence description.
// Fields absent from the input must be null — the copy stage writes around them.
export const EventBrief = z.object({
  event_type: z.string().describe("Kind of event, e.g. wedding, birthday, housewarming"),
  hosts: z.array(z.string()).describe("Names of the people hosting/inviting; empty if not stated"),
  date: z.string().nullable().describe("Event date as written by the user, or null"),
  time: z.string().nullable().describe("Event time as written by the user, or null"),
  venue: z.string().nullable().describe("Venue name or address, or null"),
  city: z.string().nullable().describe("City, or null"),
  tone: z
    .string()
    .describe(
      "Short mood descriptor inferred from the wording, e.g. 'warm and familial', 'formal', 'playful'",
    ),
  language: Language.describe("Language of the user's input: 'uk' or 'en'"),
  extra_details: z
    .string()
    .nullable()
    .describe("Anything else the user mentioned (dress code, gifts, theme), or null"),
});
export type EventBrief = z.infer<typeof EventBrief>;

export const COPY_FIELDS = [
  "title",
  "greeting",
  "body",
  "details_line",
  "rsvp_prompt",
  "closing",
] as const;
export const CopyField = z.enum(COPY_FIELDS);
export type CopyField = z.infer<typeof CopyField>;

export const InvitationCopy = z.object({
  title: z.string().describe("Short festive headline"),
  greeting: z.string().describe("Opening address to the guest"),
  body: z.string().describe("2-3 sentences inviting the guest to the event"),
  details_line: z
    .string()
    .describe("Date / time / venue on one or two lines; omit unknown details gracefully"),
  rsvp_prompt: z.string().describe("One sentence asking the guest to confirm attendance"),
  closing: z.string().describe("Warm sign-off from the hosts"),
});
export type InvitationCopy = z.infer<typeof InvitationCopy>;

// Design is enums only — the model picks tokens, rendering is deterministic
// HTML/CSS on the client. Never widen these to free-form strings.
export const DesignTokens = z.object({
  palette: z.enum(["warm", "elegant", "playful", "minimal", "festive", "romantic"]),
  typography: z.enum(["serif", "sans", "script"]),
  layout: z.enum(["classic", "banner", "split"]),
  ornament: z.enum(["none", "floral", "geometric", "sparkle"]),
});
export type DesignTokens = z.infer<typeof DesignTokens>;

// Opaque server-issued asset reference (adr-009). The model never produces
// this — the server generates/stores the image and hands back the id. The
// regex doubles as the path guard for the backgrounds file store.
export const BackgroundId = z.string().regex(/^[A-Za-z0-9_-]{6,32}$/);
export const BackgroundRef = z.object({ id: BackgroundId });
export type BackgroundRef = z.infer<typeof BackgroundRef>;

export const Invitation = z.object({
  brief: EventBrief,
  copy: InvitationCopy,
  design: DesignTokens,
  // Optional AI background layer (adr-009); absent/null = CSS-only card.
  background: BackgroundRef.nullable().optional(),
});
export type Invitation = z.infer<typeof Invitation>;

// Share-loop attribution (adr-013 §3): where the host arrived from. A closed
// enum and deliberately nothing more — carrying the referring invitation id
// would make the aggregate decomposable into "this event produced this host",
// which is the graph adr-012 and adr-005 both refused to let the server build.
export const GenerateSource = z.enum(["direct", "guest"]);
export type GenerateSource = z.infer<typeof GenerateSource>;

// API request bodies
export const GenerateRequest = z.object({
  text: z.string().trim().min(1).max(500),
  // Absent means direct, so a client that predates this keeps working.
  source: GenerateSource.default("direct"),
});
export type GenerateRequest = z.infer<typeof GenerateRequest>;

// BYOK (ADR-006): the host's own provider key rides generate/regenerate
// requests as x-llm-provider / x-llm-key headers — transient request
// context, never part of a stored payload.
export const ByokProvider = z.enum(["anthropic", "gemini", "openai"]);
export type ByokProvider = z.infer<typeof ByokProvider>;

export const RegenerateFieldRequest = z.object({
  brief: EventBrief,
  field: CopyField,
  current_value: z.string(),
});
export type RegenerateFieldRequest = z.infer<typeof RegenerateFieldRequest>;

// Background generation (adr-009): server builds the image prompt from the
// brief + tokens; the response is a stored-asset reference, never image data.
export const BackgroundRequest = z.object({
  brief: EventBrief,
  design: DesignTokens,
});
export type BackgroundRequest = z.infer<typeof BackgroundRequest>;

// Publish + RSVP -------------------------------------------------------

// IDs are URL-safe slugs; the pattern also guards the file store against
// path traversal, so keep it strict.
export const InvitationId = z.string().regex(/^[A-Za-z0-9_-]{6,32}$/);

export const PublishRequest = z.object({
  invitation: Invitation,
  // Both present = republish (new version of an existing invitation).
  id: InvitationId.optional(),
  manage_token: z.string().optional(),
});
export type PublishRequest = z.infer<typeof PublishRequest>;

export const RsvpRequest = z.object({
  name: z.string().trim().min(1).max(100),
  attending: z.boolean(),
  guests_count: z.number().int().min(1).max(10).default(1),
  note: z.string().trim().max(500).nullable().default(null),
});
export type RsvpRequest = z.infer<typeof RsvpRequest>;

export const Rsvp = RsvpRequest.extend({
  created_at: z.string(),
});
export type Rsvp = z.infer<typeof Rsvp>;

// Host-facing view of a stored RSVP. `superseded` is computed at read time,
// never stored: a guest who changes their mind submits again (FR-4.4), so a
// later answer under the same name replaces this one. Superseded entries stay
// in the list as history but are excluded from the counts (adr-010 §5).
export const RsvpSummaryEntry = Rsvp.extend({
  superseded: z.boolean(),
});
export type RsvpSummaryEntry = z.infer<typeof RsvpSummaryEntry>;

// Over the live (non-superseded) answers only — `guests` is the headcount the
// host caters on, so double-counting a changed mind would be a real bug. Named
// so the batch-counts endpoint reuses this exact shape (adr-012 consequences)
// rather than defining a second one that could drift.
export const RsvpCounts = z.object({ yes: z.number(), no: z.number(), guests: z.number() });
export type RsvpCounts = z.infer<typeof RsvpCounts>;

export const RsvpSummary = z.object({
  rsvps: z.array(RsvpSummaryEntry),
  counts: RsvpCounts,
});
export type RsvpSummary = z.infer<typeof RsvpSummary>;

// Batch response counts for the returning-host landing list (adr-012, FR-5.7).
// The first request carrying more than one capability token: each item bears
// its own manage token, authorized on its own id, and a stale token blanks
// only its own row (a per-item `status`, never a whole-batch failure).
//
// `seen_at` is the browser's `inv-manage-seen:<id>` marker, sent back so the
// server can count live answers newer than it; absent means a first visit,
// which yields `new_since: 0` rather than "everything is new" (adr-012 §4).
export const CountsRequest = z.object({
  // Capped at 25 — `hostInvitations.ts` keeps at most 20, so this is the local
  // cap plus headroom, and it bounds the multi-token oracle (adr-012 §5). Over
  // the cap is a 400, never a silent truncation.
  items: z
    .array(
      z.object({
        id: InvitationId,
        token: z.string(),
        seen_at: z.string().optional(),
      }),
    )
    .max(25),
});
export type CountsRequest = z.infer<typeof CountsRequest>;

// Item results carry no error prose — only a status the client maps to
// wording, the way the 502 body carries `causes` as classes (adr-012 §2).
export const CountsResultStatus = z.enum(["ok", "forbidden", "not_found"]);
export type CountsResultStatus = z.infer<typeof CountsResultStatus>;

export const CountsResult = z.object({
  id: InvitationId,
  status: CountsResultStatus,
  // Present only when `status` is "ok"; never `rsvps` — guest names have no
  // business on the landing page (adr-012 §3).
  counts: RsvpCounts.optional(),
  new_since: z.number().optional(),
});
export type CountsResult = z.infer<typeof CountsResult>;

export const CountsResponse = z.object({ results: z.array(CountsResult) });
export type CountsResponse = z.infer<typeof CountsResponse>;

// The signed-in host's keyring (adr-014 §5). Exactly what `localStorage` holds
// for a host who never cleared it: the manage token per invitation, plus the
// three fields the returning-host list renders. It is a *seed* for the state
// the client already has, not a new shape for it to reason about — which is
// why `title`/`published_at`/`palette` match `hostInvitations.ts` field for
// field.
//
// The token is read off the record at request time and stored nowhere else:
// the keyring table holds only which invitations an account published.
export const KeyringEntry = z.object({
  id: InvitationId,
  manage_token: z.string(),
  title: z.string(),
  published_at: z.string(),
  palette: DesignTokens.shape.palette,
});
export type KeyringEntry = z.infer<typeof KeyringEntry>;

export const KeyringResponse = z.object({ invitations: z.array(KeyringEntry) });
export type KeyringResponse = z.infer<typeof KeyringResponse>;

// Reply notifications for one of an account's invitations (adr-015 §7). The
// whole preference is one boolean: there is no digest schedule, no verbosity
// and no second address to choose, by design.
export const NotificationPrefRequest = z.object({ enabled: z.boolean() });
export type NotificationPrefRequest = z.infer<typeof NotificationPrefRequest>;

export const NotificationPref = z.object({ enabled: z.boolean() });
export type NotificationPref = z.infer<typeof NotificationPref>;
