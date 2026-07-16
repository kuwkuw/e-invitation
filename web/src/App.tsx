import { useEffect, useRef, useState } from "react";
import { generateInvitation, publishInvitation, regenerateField, fetchRsvps } from "./api";
import { UI } from "./i18n";
import { InvitationPreview } from "./components/InvitationPreview";
import { DesignControls } from "./components/DesignControls";
import {
  type CopyField,
  type DesignTokens,
  type Invitation,
  type Language,
  type PublishResult,
  type RsvpSummary,
} from "./types";

type Phase = "empty" | "generating" | "active";
type FieldMode = "actions" | "manual" | "variants";

interface ChatMsg {
  role: "user" | "assistant";
  text: string;
}

export default function App() {
  const [uiLang, setUiLang] = useState<Language>("uk");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [phase, setPhase] = useState<Phase>("empty");
  // Full event description accumulated across chat turns; each new detail
  // re-runs the whole pipeline on the combined text.
  const [description, setDescription] = useState("");
  const [invitation, setInvitation] = useState<Invitation | null>(null);

  const [selectedField, setSelectedField] = useState<CopyField | null>(null);
  const [fieldMode, setFieldMode] = useState<FieldMode>("actions");
  const [manualValue, setManualValue] = useState("");
  const [variants, setVariants] = useState<string[]>([]);
  const [fieldBusy, setFieldBusy] = useState(false);

  const [published, setPublished] = useState<PublishResult | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rsvps, setRsvps] = useState<RsvpSummary | null>(null);
  const [rsvpsLoading, setRsvpsLoading] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const t = UI[uiLang];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, phase]);

  async function handleSend() {
    const text = input.trim();
    if (!text || phase === "generating") return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    const full = description ? `${description}. ${text}` : text;
    setPhase("generating");
    closeFieldSheet();
    try {
      const inv = await generateInvitation(full);
      setDescription(full);
      setInvitation(inv);
      // Edits invalidate the published snapshot's freshness, not the link.
      setMessages((m) => [...m, { role: "assistant", text: t.chat.doneMsg }]);
      setPhase("active");
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: t.chat.failMsg }]);
      setPhase(invitation ? "active" : "empty");
    }
  }

  function updateField(field: CopyField, value: string) {
    if (!invitation) return;
    setInvitation({ ...invitation, copy: { ...invitation.copy, [field]: value } });
  }

  function updateDesign(patch: Partial<DesignTokens>) {
    if (!invitation) return;
    setInvitation({ ...invitation, design: { ...invitation.design, ...patch } });
  }

  function openFieldSheet(field: CopyField) {
    if (!invitation) return;
    setSelectedField(field);
    setFieldMode("actions");
    setManualValue(invitation.copy[field]);
    setVariants([]);
  }

  function closeFieldSheet() {
    setSelectedField(null);
    setVariants([]);
    setFieldBusy(false);
  }

  async function handleFieldRegenerate() {
    if (!invitation || !selectedField || fieldBusy) return;
    setFieldBusy(true);
    try {
      const value = await regenerateField(
        invitation.brief,
        selectedField,
        invitation.copy[selectedField],
      );
      updateField(selectedField, value);
      closeFieldSheet();
    } catch {
      setFieldBusy(false);
    }
  }

  async function handleLoadVariants() {
    if (!invitation || !selectedField || fieldBusy) return;
    setFieldMode("variants");
    setFieldBusy(true);
    setVariants([]);
    const current = invitation.copy[selectedField];
    // Three independent per-field regenerations = three alternatives.
    const results = await Promise.allSettled([
      regenerateField(invitation.brief, selectedField, current),
      regenerateField(invitation.brief, selectedField, current),
      regenerateField(invitation.brief, selectedField, current),
    ]);
    const ok = results
      .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
      .map((r) => r.value);
    setVariants([...new Set(ok)]);
    setFieldBusy(false);
  }

  async function handleShare() {
    if (!invitation || publishing) return;
    if (shareOpen) {
      setShareOpen(false);
      return;
    }
    setPublishing(true);
    try {
      const result = await publishInvitation(
        invitation,
        published ? { id: published.id, manage_token: published.manage_token } : undefined,
      );
      setPublished(result);
      localStorage.setItem(`inv-manage:${result.id}`, result.manage_token);
      setShareOpen(true);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: t.chat.failMsg }]);
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
    } finally {
      setRsvpsLoading(false);
    }
  }

  const hasInvitation = invitation !== null && phase !== "generating";

  return (
    <div className="cc-shell">
      <header className="cc-header">
        <button className="cc-back" aria-label={t.chat.back} onClick={() => (window.location.href = "/")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="cc-title">{invitation?.copy.title ?? t.chat.newInvitation}</div>
        <div className="cc-header-right">
          <div className="lang-toggle" role="group" aria-label="Interface language">
            {(["uk", "en"] as const).map((lang) => (
              <button key={lang} className={uiLang === lang ? "active" : ""} onClick={() => setUiLang(lang)}>
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            className={`cc-share${hasInvitation ? " ready" : ""}`}
            disabled={!hasInvitation || publishing}
            onClick={handleShare}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 15V4M8 8l4-4 4 4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 13v5a2 2 0 002 2h10a2 2 0 002-2v-5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {publishing ? "…" : t.chat.share}
          </button>
        </div>
      </header>

      {shareOpen && published && (
        <div className="cc-share-panel">
          <p className="publish-status">{t.publishedVersion.replace("{n}", String(published.version))}</p>
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
                    ✓ {rsvps.counts.yes} {t.countYes} · ✗ {rsvps.counts.no} {t.countNo} · {rsvps.counts.guests}{" "}
                    {t.countGuests}
                  </p>
                  <ul className="responses-list">
                    {rsvps.rsvps.map((r, i) => (
                      <li key={i}>
                        <span className={r.attending ? "rsvp-yes" : "rsvp-no"}>{r.attending ? "✓" : "✗"}</span>{" "}
                        <strong>{r.name}</strong>
                        {r.attending && r.guests_count > 1 && ` ×${r.guests_count}`}
                        {r.note && <span className="rsvp-note"> — {r.note}</span>}
                      </li>
                    ))}
                  </ul>
                </>
              ))}
          </div>
        </div>
      )}

      <div className="cc-main">
        <section className="cc-chat">
          <div className="cc-messages">
            {phase === "empty" && messages.length === 0 ? (
              <div className="cc-start">
                <div className="cc-start-title">{t.chat.startTitle}</div>
                <div className="cc-start-hint">{t.chat.startHint}</div>
                <div className="cc-start-examples">{t.chat.tryExamples}</div>
                <div className="cc-chips">
                  {t.chat.examples.map((example) => (
                    <button key={example} className="cc-chip" onClick={() => setInput(example.replace(/…$/, ""))}>
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <div key={i} className={`cc-msg ${msg.role}`}>
                    <div className="cc-bubble">{msg.text}</div>
                  </div>
                ))}
                {phase === "generating" && (
                  <div className="cc-status">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M12 3l1.7 5L19 9.6l-4.4 3.1L16 18l-4-3-4 3 1.4-5.3L5 9.6 10.3 8 12 3z" fill="currentColor" />
                    </svg>
                    <span>{t.chat.creating}</span>
                    <span className="cc-dots">
                      <span className="cc-dot" />
                      <span className="cc-dot" />
                      <span className="cc-dot" />
                    </span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </>
            )}
          </div>
          <div className="cc-composer">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={invitation ? t.chat.placeholderRefine : t.chat.placeholderEmpty}
              maxLength={500}
            />
            <button
              className={`cc-send${input.trim() && phase !== "generating" ? " ready" : ""}`}
              aria-label={t.chat.send}
              disabled={!input.trim() || phase === "generating"}
              onClick={handleSend}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 19V6M6 12l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </section>

        <section className="cc-preview">
          {phase === "generating" ? (
            <div className="cc-skeleton" aria-label={t.chat.creating}>
              <div className="cc-sk cc-sk-badge" />
              <div className="cc-sk" style={{ width: "72%", height: 22 }} />
              <div className="cc-sk" style={{ width: "46%", height: 12 }} />
              <div className="cc-sk" style={{ width: "92%", height: 10, marginTop: 10 }} />
              <div className="cc-sk" style={{ width: "84%", height: 10 }} />
              <div className="cc-sk" style={{ width: "64%", height: 12, marginTop: 6 }} />
              <div className="cc-sk cc-sk-pill" />
            </div>
          ) : invitation ? (
            <div className="cc-preview-inner">
              <DesignControls design={invitation.design} labels={t.design} onChange={updateDesign} />
              <InvitationPreview
                copy={invitation.copy}
                design={invitation.design}
                activeField={selectedField}
                onFieldClick={openFieldSheet}
              />
            </div>
          ) : (
            <div className="cc-placeholder">
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
                <path d="M12 3l1.7 5L19 9.6l-4.4 3.1L16 18l-4-3-4 3 1.4-5.3L5 9.6 10.3 8 12 3z" fill="currentColor" />
              </svg>
              <div>{t.chat.previewPlaceholder}</div>
            </div>
          )}
        </section>
      </div>

      {selectedField && invitation && (
        <div className="cc-sheet">
          <div className="cc-sheet-head">
            <div>
              <div className="cc-sheet-kicker">{t.chat.editingLabel}</div>
              <div className="cc-sheet-title">{t.fields[selectedField]}</div>
            </div>
            <button className="cc-sheet-close" aria-label="Close" onClick={closeFieldSheet}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="cc-actions">
            <button className="cc-act" disabled={fieldBusy} onClick={handleFieldRegenerate}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                <path d="M4 12a8 8 0 0114-5.3M20 4v4h-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M20 12a8 8 0 01-14 5.3M4 20v-4h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {fieldBusy && fieldMode === "actions" ? "…" : t.chat.actionRegenerate}
            </button>
            <button
              className={`cc-act${fieldMode === "manual" ? " cc-act-on" : ""}`}
              onClick={() => setFieldMode("manual")}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                <path d="M4 20h4L18 10l-4-4L4 16v4z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t.chat.actionManual}
            </button>
            <button
              className={`cc-act${fieldMode === "variants" ? " cc-act-on" : ""}`}
              disabled={fieldBusy}
              onClick={handleLoadVariants}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                <path d="M12 3l9 5-9 5-9-5 9-5z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 13l9 5 9-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t.chat.actionVariants}
            </button>
          </div>
          {fieldMode === "manual" && (
            <div className="cc-manual">
              <textarea
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
                rows={selectedField === "body" ? 3 : 2}
              />
              <button
                className="primary"
                onClick={() => {
                  updateField(selectedField, manualValue);
                  closeFieldSheet();
                }}
              >
                {t.chat.save}
              </button>
            </div>
          )}
          {fieldMode === "variants" && (
            <div className="cc-variants">
              <div className="cc-sheet-kicker">
                {t.chat.variantsTitle} · {t.fields[selectedField]}
              </div>
              {fieldBusy ? (
                <div className="cc-status">
                  <span>{t.chat.creating}</span>
                  <span className="cc-dots">
                    <span className="cc-dot" />
                    <span className="cc-dot" />
                    <span className="cc-dot" />
                  </span>
                </div>
              ) : (
                variants.map((variant) => (
                  <button
                    key={variant}
                    className="cc-var"
                    onClick={() => {
                      updateField(selectedField, variant);
                      closeFieldSheet();
                    }}
                  >
                    {variant}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function shareUrl(id: string): string {
  return `${window.location.origin}/i/${id}`;
}
