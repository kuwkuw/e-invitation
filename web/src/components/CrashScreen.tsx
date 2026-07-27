import { loadGuestLang } from "../guestLang";
import { CRASH, type CrashAudience, loadUiLang } from "../i18n";
import type { Language } from "../types";

/** The host's language lives in localStorage and the guest's came from an
 *  invitation we no longer have — and storage that throws is one of the things
 *  that can land someone on this screen, so both reads are wrapped. Ukrainian
 *  is the same default the rest of the app falls back to. */
function crashLang(audience: CrashAudience): Language {
  try {
    return audience === "guest" ? (loadGuestLang() ?? "uk") : loadUiLang();
  } catch {
    return "uk";
  }
}

/** Fallback behind `ErrorBoundary`: whatever broke, this renders from nothing
 *  but its own markup — no props from the crashed tree, no fetch, no state.
 *  A reload is the honest recovery; a route change would re-run the same code
 *  over the same in-memory state. */
export function CrashScreen({ audience }: { audience: CrashAudience }) {
  const t = CRASH[crashLang(audience)][audience];

  return (
    <div className="cr-page" role="alert">
      <div className="cr-card">
        <span className="cr-icon" aria-hidden="true">
          {/* Mirrors the manage dashboard's AlertIcon; kept local so this
              screen depends on no other route's folder. */}
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 7.5v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="12" cy="16" r="0.9" fill="currentColor" />
          </svg>
        </span>
        <h1 className="cr-title">{t.title}</h1>
        <p className="cr-body">{t.body}</p>
        <p className="cr-hint">{t.hint}</p>
        <button type="button" className="cr-action" onClick={() => window.location.reload()}>
          {t.reload}
        </button>
      </div>
      <p className="cr-brand">INVITO</p>
    </div>
  );
}
