import type { Language } from "./types";

// Guest-side chrome-language override. The guest page follows the
// invitation's language by default; a guest who can't read it may switch the
// CHROME only (form labels, buttons, thanks copy) — never the invitation text
// itself, which is the host's content.
const GUEST_LANG_KEY = "inv-guest-lang";

/** null = no override stored, so the invitation's own language wins. */
export function loadGuestLang(): Language | null {
  try {
    const stored = localStorage.getItem(GUEST_LANG_KEY);
    return stored === "en" || stored === "uk" ? stored : null;
  } catch {
    // Private-mode Safari and blocked-storage settings throw on access; the
    // page must still render, just without a remembered choice.
    return null;
  }
}

export function saveGuestLang(lang: Language): void {
  try {
    localStorage.setItem(GUEST_LANG_KEY, lang);
  } catch {
    // Non-fatal: the switch still applies for this page view.
  }
}
