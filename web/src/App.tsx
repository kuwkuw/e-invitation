import { useState } from "react";
import { generateInvitation, regenerateField } from "./api";
import { UI } from "./i18n";
import { InvitationPreview } from "./components/InvitationPreview";
import { COPY_FIELDS, type CopyField, type Invitation, type Language } from "./types";

export default function App() {
  const [uiLang, setUiLang] = useState<Language>("uk");
  const [text, setText] = useState("");
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyField, setBusyField] = useState<CopyField | null>(null);
  const [error, setError] = useState<string | null>(null);

  const t = UI[uiLang];

  async function handleGenerate() {
    if (!text.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      setInvitation(await generateInvitation(text));
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  }

  function updateField(field: CopyField, value: string) {
    if (!invitation) return;
    setInvitation({ ...invitation, copy: { ...invitation.copy, [field]: value } });
  }

  async function handleRegenerate(field: CopyField) {
    if (!invitation || busyField) return;
    setBusyField(field);
    setError(null);
    try {
      const value = await regenerateField(invitation.brief, field, invitation.copy[field]);
      updateField(field, value);
    } catch {
      setError(t.error);
    } finally {
      setBusyField(null);
    }
  }

  return (
    <div className="page">
      <header className="header">
        <h1>{t.appTitle}</h1>
        <div className="lang-toggle" role="group" aria-label="Interface language">
          {(["uk", "en"] as const).map((lang) => (
            <button
              key={lang}
              className={uiLang === lang ? "active" : ""}
              onClick={() => setUiLang(lang)}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <p className="tagline">{t.tagline}</p>

      <div className="composer">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.placeholder}
          rows={3}
          maxLength={500}
        />
        <button className="primary" onClick={handleGenerate} disabled={loading || !text.trim()}>
          {loading ? t.generating : t.generate}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {invitation && (
        <div className="workspace">
          <section className="editor">
            <h2>{t.editorTitle}</h2>
            {COPY_FIELDS.map((field) => (
              <div key={field} className="field">
                <div className="field-head">
                  <label htmlFor={`field-${field}`}>{t.fields[field]}</label>
                  <button
                    onClick={() => handleRegenerate(field)}
                    disabled={busyField !== null}
                    title={t.regenerate}
                  >
                    {busyField === field ? "…" : `↻ ${t.regenerate}`}
                  </button>
                </div>
                <textarea
                  id={`field-${field}`}
                  value={invitation.copy[field]}
                  onChange={(e) => updateField(field, e.target.value)}
                  rows={field === "body" ? 3 : 2}
                />
              </div>
            ))}
          </section>

          <section className="preview">
            <h2>{t.previewTitle}</h2>
            <InvitationPreview copy={invitation.copy} design={invitation.design} />
          </section>
        </div>
      )}
    </div>
  );
}
