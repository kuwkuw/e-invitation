// The editor's work in progress, parked across the sign-in redirect.
//
// The publish gate (adr-014 §2) sends the browser to Google with a full-page
// navigation, and `useInvitationEditor` holds the invitation entirely in
// memory. Without this the host would come back from Google to an empty
// editor — losing their work at the exact moment they committed to it, which
// is worse than the gate itself. The DS `AuthGateSpec` says the same thing in
// its own words: without a saved draft the `returning` state is impossible and
// the whole sheet falls apart into two screens.
//
// Deliberately narrow. This is not autosave: it is written when we are about
// to navigate away and read only when coming back from that navigation, so a
// draft can never resurface unasked days later on an ordinary visit.

import type { GenerateSource, Invitation } from "./types";

const KEY = "inv-draft";
// Belt to the "only read on the auth return" braces. A draft older than this
// is from a redirect that never completed, and restoring it would be a
// surprise rather than a rescue.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface EditorDraft {
  invitation: Invitation;
  /** Kept so an interrupted publish still counts as referred (adr-013 §3). */
  source: GenerateSource;
  /** The already-published invitation being republished, if any. */
  published: { id: string; manage_token: string } | null;
  saved_at: string;
}

export function saveDraft(draft: Omit<EditorDraft, "saved_at">): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...draft, saved_at: new Date().toISOString() }));
  } catch {
    // A blocked or full store must not stop the sign-in it was preparing for.
    // The host loses the draft rather than the ability to publish at all, and
    // the gate's "draft saved" line is the only thing that becomes a lie —
    // which is why `hasDraft` exists for the gate to check rather than assume.
  }
}

/** Null for absent, unreadable, or stale. Never throws — this runs on the
 *  return path from Google, where a throw would be a blank page. */
export function loadDraft(): EditorDraft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EditorDraft>;
    if (!parsed?.invitation?.copy || !parsed.saved_at) return null;
    if (Date.now() - new Date(parsed.saved_at).getTime() > MAX_AGE_MS) return null;
    return {
      invitation: parsed.invitation,
      source: parsed.source === "guest" ? "guest" : "direct",
      published: parsed.published ?? null,
      saved_at: parsed.saved_at,
    };
  } catch {
    return null;
  }
}

/** Whether the draft actually made it to storage — the gate says "draft saved
 *  in this browser", and it must not say that when storage refused the write. */
export function hasDraft(): boolean {
  return loadDraft() !== null;
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do: an unreadable store cannot be holding a draft either.
  }
}
