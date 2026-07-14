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

export interface DesignTokens {
  palette: "warm" | "elegant" | "playful" | "minimal" | "festive" | "romantic";
  typography: "serif" | "sans" | "script";
  layout: "classic" | "banner" | "split";
  ornament: "none" | "floral" | "geometric" | "sparkle";
}

export interface Invitation {
  brief: EventBrief;
  copy: InvitationCopy;
  design: DesignTokens;
}
