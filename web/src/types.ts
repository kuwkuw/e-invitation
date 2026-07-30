// Mirrors server/src/schemas.ts (zod is the source of truth) — keep in sync by hand.

export type Language = "uk" | "en";

// Share-loop attribution (adr-013 §3): where the host arrived from. A closed
// enum and never the referring invitation id — per-invitation credit would
// build the host graph adr-012 and adr-005 both refused.
export type GenerateSource = "direct" | "guest";

export interface EventBrief {
  event_type: string;
  hosts: string[];
  date: string | null;
  time: string | null;
  venue: string | null;
  city: string | null;
  tone: string;
  language: Language;
  extra_details: string | null;
}

export const COPY_FIELDS = [
  "title",
  "greeting",
  "body",
  "details_line",
  "rsvp_prompt",
  "closing",
] as const;
export type CopyField = (typeof COPY_FIELDS)[number];

export type InvitationCopy = Record<CopyField, string>;

export const PALETTES = ["warm", "elegant", "playful", "minimal", "festive", "romantic"] as const;
export const TYPOGRAPHIES = ["serif", "sans", "script"] as const;
export const LAYOUTS = ["classic", "banner", "split"] as const;
export const ORNAMENTS = ["none", "floral", "geometric", "sparkle"] as const;

export interface DesignTokens {
  palette: (typeof PALETTES)[number];
  typography: (typeof TYPOGRAPHIES)[number];
  layout: (typeof LAYOUTS)[number];
  ornament: (typeof ORNAMENTS)[number];
}

// Opaque server-issued asset reference for the optional AI background layer
// (adr-009); absent/null = CSS-only card.
export interface BackgroundRef {
  id: string;
}

export interface Invitation {
  brief: EventBrief;
  copy: InvitationCopy;
  design: DesignTokens;
  background?: BackgroundRef | null;
}

// Publish + RSVP

export interface PublishResult {
  id: string;
  version: number;
  manage_token: string;
}

export interface PublishedInvitation {
  id: string;
  version: number;
  invitation: Invitation;
}

export interface RsvpInput {
  name: string;
  attending: boolean;
  guests_count: number;
  note: string | null;
}

export interface RsvpEntry extends RsvpInput {
  created_at: string;
  /** Computed server-side, never stored: a later answer from the same guest
   *  replaced this one (adr-010 §5). Superseded entries stay in the list as
   *  history but are excluded from `RsvpSummary.counts`. */
  superseded: boolean;
}

export interface RsvpCounts {
  yes: number;
  no: number;
  guests: number;
}

export interface RsvpSummary {
  rsvps: RsvpEntry[];
  counts: RsvpCounts;
}

// Batch response counts for the returning-host landing list (adr-012, FR-5.7).
// Mirrors the server's CountsRequest/CountsResponse by hand (NFR-8).
export interface CountsRequestItem {
  id: string;
  token: string;
  /** The browser's `inv-manage-seen:<id>` marker; absent on a first visit. */
  seen_at?: string;
}

export type CountsResultStatus = "ok" | "forbidden" | "not_found";

export interface CountsResult {
  id: string;
  status: CountsResultStatus;
  /** Present only when `status` is "ok". */
  counts?: RsvpCounts;
  new_since?: number;
}

export interface CountsResponse {
  results: CountsResult[];
}

// Host accounts (adr-014 §5). Mirrors the server's KeyringEntry by hand
// (NFR-8). Deliberately field-for-field compatible with `HostInvitation` in
// `hostInvitations.ts` plus the token: the keyring seeds the browser-local
// state the app already runs on rather than introducing a second one.
export interface KeyringEntry {
  id: string;
  manage_token: string;
  title: string;
  published_at: string;
  palette: DesignTokens["palette"];
}

export interface KeyringResponse {
  invitations: KeyringEntry[];
}

/** What deleting an account returns (adr-014 §9). The invitations are
 *  deliberately retained: guests hold their share links, the RSVPs are the
 *  guests' data, and the manage token survives on the record. */
export interface AccountDeletion {
  deleted: boolean;
  invitations_retained: number;
}

/** What `/api/auth/session` reports. `configured` is the deployment's answer
 *  to "is sign-in available at all" (adr-014 §7) — the client must not show a
 *  sign-in affordance when it is false. */
export interface AuthSession {
  configured: boolean;
  signed_in: boolean;
  email: string | null;
}

// BYOK (ADR-006): the host's own provider key, kept in this browser only.
export type ByokProvider = "anthropic" | "gemini" | "openai";

export interface ByokKey {
  provider: ByokProvider;
  key: string;
}
