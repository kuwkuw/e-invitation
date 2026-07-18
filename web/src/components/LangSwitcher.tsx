import type { Language } from "../types";

interface Props {
  value: Language;
  onChange: (lang: Language) => void;
  /** Guest-page variant: a wordless globe marks this as a language control
      for guests who can't read either label. */
  globe?: boolean;
}

// Canonical chrome language switcher from the "lang-switcher" template in the
// E-invitation DS project: a quiet segmented pill — white "tongue" on a warm
// track, no accent color (the invitation owns all color).
export function LangSwitcher({ value, onChange, globe }: Props) {
  const pill = (
    <div className="ls-track" role="group" aria-label="Language">
      {(["uk", "en"] as const).map((lang) => (
        <button
          key={lang}
          className={`ls-seg${value === lang ? " active" : ""}`}
          aria-pressed={value === lang}
          onClick={() => onChange(lang)}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );

  if (!globe) return pill;
  return (
    <div className="ls-globe-wrap">
      <span className="ls-globe" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3 12h18" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12 3c2.6 2.8 2.6 15.2 0 18M12 3c-2.6 2.8-2.6 15.2 0 18" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </span>
      {pill}
    </div>
  );
}
