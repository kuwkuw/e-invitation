// RSVP export for the host dashboard, built client-side from the already-
// fetched list (FR-5). The UTF-8 BOM keeps Excel from mangling Cyrillic.

import type { RsvpEntry } from "./types";

export interface RsvpCsvStrings {
  // name, answer, guests, note, date, status
  headers: readonly [string, string, string, string, string, string];
  yes: string;
  no: string;
  /** Marks an answer a later one replaced (adr-010 §5). Every row is
   *  exported, superseded ones included, so the file stays a full record. */
  superseded: string;
}

function escapeCsvField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function buildRsvpCsv(rsvps: RsvpEntry[], strings: RsvpCsvStrings): string {
  const rows = rsvps.map((r) =>
    [
      r.name,
      r.attending ? strings.yes : strings.no,
      // guests_count only means anything for attendees (the server counts it
      // that way too); leave it blank on declines.
      r.attending ? String(r.guests_count) : "",
      r.note ?? "",
      r.created_at.slice(0, 16).replace("T", " "),
      // Blank for live answers — a status column that shouts on every row
      // would bury the handful that actually changed.
      r.superseded ? strings.superseded : "",
    ]
      .map(escapeCsvField)
      .join(","),
  );
  return `\uFEFF${[strings.headers.join(","), ...rows].join("\r\n")}\r\n`;
}
