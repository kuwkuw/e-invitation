// Mirrors server/src/schemas.ts (zod is the source of truth) — keep in sync by hand.

export type Language = "uk" | "en";

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

// Batch response counts for the landing list (adr-012). One item per
// invitation this browser holds a manage token for; each pair authorizes only
// its own id, so a refused token is a per-item status inside a 200 rather than
// a failed request.
export interface RsvpCountsRequestItem {
  id: string;
  token: string;
  /** This browser's `inv-manage-seen:<id>` marker; omitted when it has none,
   *  and then `new_since` comes back 0 rather than "all of them". */
  seen_at?: string;
}

export interface RsvpCountsResult {
  id: string;
  status: "ok" | "forbidden" | "not_found";
  /** Both present exactly when `status` is "ok". */
  counts?: RsvpCounts;
  new_since?: number;
}

export interface RsvpCountsResponse {
  results: RsvpCountsResult[];
}

// BYOK (ADR-006): the host's own provider key, kept in this browser only.
export type ByokProvider = "anthropic" | "gemini" | "openai";

export interface ByokKey {
  provider: ByokProvider;
  key: string;
}
