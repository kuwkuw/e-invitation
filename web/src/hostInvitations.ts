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

/**
 * The account's keyring laid over whatever this browser already knew, newest
 * first. `null` means the keyring has not answered — no session, or the fetch
 * has not landed — and leaves the local list exactly as it is.
 *
 * Entries match by id and the keyring's copy wins: it is read off the record
 * itself, so a title changed and republished on another device is current
 * there and stale here.
 *
 * **A union, not a replacement.** The two sets legitimately differ: anything
 * published by this browser before it ever signed in — or before accounts
 * existed at all — sits in the local index and in no keyring. Rendering the
 * keyring alone would hide invitations the host can see today, which is a
 * worse failure than the staleness it fixes.
 */
export function mergeHostInvitations(
  local: HostInvitation[],
  keyring: HostInvitation[] | null,
): HostInvitation[] {
  if (!keyring) return local;
  const byId = new Map(local.map((entry) => [entry.id, entry]));
  for (const entry of keyring) byId.set(entry.id, entry);
  return [...byId.values()].sort((a, b) => b.published_at.localeCompare(a.published_at));
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
