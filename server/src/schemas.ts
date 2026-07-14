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
  tone: z.string().describe("Short mood descriptor inferred from the wording, e.g. 'warm and familial', 'formal', 'playful'"),
  language: Language.describe("Language of the user's input: 'uk' or 'en'"),
  extra_details: z.string().nullable().describe("Anything else the user mentioned (dress code, gifts, theme), or null"),
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
  details_line: z.string().describe("Date / time / venue on one or two lines; omit unknown details gracefully"),
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

export const Invitation = z.object({
  brief: EventBrief,
  copy: InvitationCopy,
  design: DesignTokens,
});
export type Invitation = z.infer<typeof Invitation>;

// API request bodies
export const GenerateRequest = z.object({
  text: z.string().trim().min(1).max(500),
});
export type GenerateRequest = z.infer<typeof GenerateRequest>;

export const RegenerateFieldRequest = z.object({
  brief: EventBrief,
  field: CopyField,
  current_value: z.string(),
});
export type RegenerateFieldRequest = z.infer<typeof RegenerateFieldRequest>;
