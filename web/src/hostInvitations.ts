// The invitations this browser has published, so a returning host recognises
// their events by name instead of by opaque id (adr-010 §4).
//
// A convenience cache, not a record: browser-only, never sent anywhere, and
// cleared with site data. The manage link stays the portable way back — this
// list is what makes the common case (same phone, same browser) pleasant.
// The manage tokens themselves live under their own `inv-manage:<id>` keys;
// this index deliberately holds no secrets.

import type { DesignTokens } from "./types";

const KEY = "inv-invitations";
const LIMIT = 20;

export interface HostInvitation {
  id: string;
  title: string;
  published_at: string;
  /** Drives the row's monogram tint, so an event reads as itself at a glance. */
  palette: DesignTokens["palette"];
}

function isHostInvitation(value: unknown): value is HostInvitation {
  const entry = value as Partial<HostInvitation> | null;
  return (
    !!entry &&
    typeof entry.id === "string" &&
    typeof entry.title === "string" &&
    typeof entry.published_at === "string"
  );
}

/** Newest first. Never throws: a corrupt or hand-edited value degrades to an
 *  empty list, which just renders the first-time landing page. */
export function loadHostInvitations(): HostInvitation[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isHostInvitation)
      .sort((a, b) => b.published_at.localeCompare(a.published_at));
  } catch {
    return [];
  }
}

/** Called on every publish. Republishing an invitation updates its entry in
 *  place — a new version is the same event, not a new one. */
export function recordHostInvitation(entry: HostInvitation): void {
  try {
    const rest = loadHostInvitations().filter((existing) => existing.id !== entry.id);
    const next = [entry, ...rest].slice(0, LIMIT);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // A full or disabled localStorage must never break publishing — the share
    // link is what matters, and this list is a nicety.
  }
}
