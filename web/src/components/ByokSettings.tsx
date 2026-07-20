import { useState } from "react";
import { clearByok, loadByok, saveByok } from "../byok";
import type { ByokStrings } from "../i18n";
import type { ByokProvider } from "../types";

// Provider names are brands — identical in both UI languages.
const PROVIDER_LABELS: Record<ByokProvider, string> = {
  gemini: "Google Gemini",
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI",
};

/** Header control for the host's own AI key (BYOK, ADR-006): a key icon
 *  that opens a small panel. The key never leaves this browser except as
 *  headers on generate/regenerate requests (api.ts). */
export function ByokSettings({ labels }: { labels: ByokStrings }) {
  const [open, setOpen] = useState(false);
  const [stored, setStored] = useState(loadByok);
  const [provider, setProvider] = useState<ByokProvider>(() => loadByok()?.provider ?? "gemini");
  const [key, setKey] = useState(() => loadByok()?.key ?? "");

  function handleSave() {
    const trimmed = key.trim();
    if (!trimmed) return;
    const next = { provider, key: trimmed };
    saveByok(next);
    setStored(next);
    setOpen(false);
  }

  function handleClear() {
    clearByok();
    setStored(null);
    setKey("");
  }

  return (
    <>
      <button
        className={`cc-back cc-key${stored ? " cc-key-on" : ""}`}
        aria-label={labels.button}
        title={labels.button}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
          <circle cx="8" cy="14" r="4.2" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M11.4 11L19 4M16 6.5l2.5 2.5M13.8 8.7l2 2"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {open && (
        <div className="cc-share-panel cc-key-panel">
          <h3 className="cc-key-title">{labels.title}</h3>
          <p className="cc-key-intro">{labels.intro}</p>
          {stored && <p className="cc-key-active">✓ {labels.active} · {PROVIDER_LABELS[stored.provider]}</p>}
          <label className="cc-key-label">
            {labels.provider}
            <select value={provider} onChange={(e) => setProvider(e.target.value as ByokProvider)}>
              {(Object.keys(PROVIDER_LABELS) as ByokProvider[]).map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="cc-key-label">
            {labels.keyLabel}
            <div className="share-row">
              <input
                type="password"
                value={key}
                autoComplete="off"
                placeholder={labels.keyPlaceholder}
                onChange={(e) => setKey(e.target.value)}
              />
            </div>
          </label>
          <div className="cc-key-actions">
            <button className="cc-key-save" disabled={!key.trim()} onClick={handleSave}>
              {labels.save}
            </button>
            {stored && (
              <button className="cc-key-clear" onClick={handleClear}>
                {labels.clear}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
