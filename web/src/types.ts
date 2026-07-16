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

export interface Invitation {
  brief: EventBrief;
  copy: InvitationCopy;
  design: DesignTokens;
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
}

export interface RsvpSummary {
  rsvps: RsvpEntry[];
  counts: { yes: number; no: number; guests: number };
}
