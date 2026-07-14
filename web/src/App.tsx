import { useState } from "react";
import { generateInvitation, publishInvitation, regenerateField, fetchRsvps } from "./api";
import { UI } from "./i18n";
import { InvitationPreview } from "./components/InvitationPreview";
import {
  COPY_FIELDS,
  type CopyField,
  type Invitation,
  type Language,
  type PublishResult,
  type RsvpSummary,
} from "./types";

export default function App() {
  const [uiLang, setUiLang] = useState<Language>("uk");
  const [text, setText] = useState("");
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyField, setBusyField] = useState<CopyField | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [published, setPublished] = useState<PublishResult | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rsvps, setRsvps] = useState<RsvpSummary | null>(null);
  const [rsvpsLoading, setRsvpsLoading] = useState(false);

  const t = UI[uiLang];

  async function handleGenerate() {
    if (!text.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      setInvitation(await generateInvitation(text));
      // A fresh generation is a new event — detach it from the old link.
      setPublished(null);
      setRsvps(null);
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

  async function handlePublish() {
    if (!invitation || publishing) return;
    setPublishing(true);
    setError(null);
    try {
      const result = await publishInvitation(
        invitation,
        published ? { id: published.id, manage_token: published.manage_token } : undefined,
      );
      setPublished(result);
      // Keep the manage token so the host can still see responses after a reload.
      localStorage.setItem(`inv-manage:${result.id}`, result.manage_token);
    } catch {
      setError(t.error);
    } finally {
      setPublishing(false);
    }
  }

  async function handleCopyLink() {
    if (!published) return;
    await navigator.clipboard.writeText(shareUrl(published.id));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRefreshRsvps() {
    if (!published || rsvpsLoading) return;
    setRsvpsLoading(true);
    try {
      setRsvps(await fetchRsvps(published.id, published.manage_token));
    } catch {
      setError(t.error);
    } finally {
      setRsvpsLoading(false);
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

            <div className="publish-panel">
              <button className="primary" onClick={handlePublish} disabled={publishing}>
                {publishing ? t.publishing : published ? t.republish : t.publish}
              </button>

              {published && (
                <>
                  <p className="publish-status">
                    {t.publishedVersion.replace("{n}", String(published.version))}
                  </p>
                  <p className="share-hint">{t.shareHint}</p>
                  <div className="share-row">
                    <input readOnly value={shareUrl(published.id)} onFocus={(e) => e.target.select()} />
                    <button onClick={handleCopyLink}>{copied ? t.copied : t.copyLink}</button>
                  </div>

                  <div className="responses">
                    <div className="responses-head">
                      <h3>{t.responsesTitle}</h3>
                      <button onClick={handleRefreshRsvps} disabled={rsvpsLoading}>
                        {rsvpsLoading ? "…" : `↻ ${t.refreshResponses}`}
                      </button>
                    </div>
                    {rsvps &&
                      (rsvps.rsvps.length === 0 ? (
                        <p className="responses-empty">{t.responsesEmpty}</p>
                      ) : (
                        <>
                          <p className="responses-counts">
                            ✓ {rsvps.counts.yes} {t.countYes} · ✗ {rsvps.counts.no} {t.countNo} ·{" "}
                            {rsvps.counts.guests} {t.countGuests}
                          </p>
                          <ul className="responses-list">
                            {rsvps.rsvps.map((r, i) => (
                              <li key={i}>
                                <span className={r.attending ? "rsvp-yes" : "rsvp-no"}>
                                  {r.attending ? "✓" : "✗"}
                                </span>{" "}
                                <strong>{r.name}</strong>
                                {r.attending && r.guests_count > 1 && ` ×${r.guests_count}`}
                                {r.note && <span className="rsvp-note"> — {r.note}</span>}
                              </li>
                            ))}
                          </ul>
                        </>
                      ))}
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function shareUrl(id: string): string {
  return `${window.location.origin}/i/${id}`;
}
