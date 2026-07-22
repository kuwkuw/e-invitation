import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { fetchInvitation, submitRsvp } from "./api";
import { buildIcs, parseEventStart } from "./calendar";
import { downloadFile } from "./download";
import { GUEST } from "./i18n";
import { InvitationPreview } from "./components/InvitationPreview";
import { LangSwitcher } from "./components/LangSwitcher";
import type { Language, PublishedInvitation } from "./types";

// Guest-side chrome-language override. The page follows the invitation's
// language by default; a guest who can't read it may switch the CHROME only
// (form labels, buttons, thanks copy) — never the invitation text itself.
const GUEST_LANG_KEY = "inv-guest-lang";

function loadGuestLang(): Language | null {
  const stored = localStorage.getItem(GUEST_LANG_KEY);
  return stored === "en" || stored === "uk" ? stored : null;
}

interface Props {
  id: string;
}

// 1 гість / 2 гості / 5 гостей (uk); 1 guest / N guests (en).
function guestWord(n: number, forms: [string, string, string]): string {
  if (n === 1) return forms[0];
  if (n >= 2 && n <= 4) return forms[1];
  return forms[2];
}

const CheckIcon = ({ size = 18, color = "currentColor", width = 2.2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M5 13l4 4L19 7" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CrossIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M7 7l10 10M17 7L7 17" stroke={color} strokeWidth="2.1" strokeLinecap="round" />
  </svg>
);

const Twinkle = ({ className, style, size }: { className: string; style?: CSSProperties; size: number }) => (
  <svg className={className} style={style} width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 2l2 8 8 2-8 2-2 8-2-8-8-2 8-2z" fill="currentColor" />
  </svg>
);

// Public page behind the share link: the invitation plus an RSVP form.
// Guests never register; everything is keyed by the invitation id.
// Visuals follow templates/guest-rsvp in the E-invitation DS project:
// invitation is the hero, the reply is a quiet white card below/beside it.
export function GuestPage({ id }: Props) {
  const [published, setPublished] = useState<PublishedInvitation | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "not_found" | "error">("loading");
  const [langOverride, setLangOverride] = useState<Language | null>(loadGuestLang);

  const [name, setName] = useState("");
  const [attending, setAttending] = useState<boolean | null>(null);
  const [guestsCount, setGuestsCount] = useState(1);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchInvitation(id)
      .then((data) => {
        setPublished(data);
        setStatus("ready");
      })
      .catch((error: Error) => {
        setStatus(error.message.includes("not found") ? "not_found" : "error");
      });
  }, [id]);

  // Until the invitation loads we don't know its language; default to uk
  // (the app's primary audience) for the loading/error shell.
  const chromeLang = langOverride ?? published?.invitation.brief.language ?? "uk";
  const t = GUEST[chromeLang];

  function handleLang(lang: Language) {
    setLangOverride(lang);
    localStorage.setItem(GUEST_LANG_KEY, lang);
  }

  if (status === "loading") {
    return (
      <div className="gr-page">
        <p className="gr-status">{t.loading}</p>
      </div>
    );
  }

  if (status === "not_found" || status === "error" || !published) {
    const body = status === "error" ? t.error : t.notFoundBody;
    return (
      <div className="gr-page gr-notfound">
        <div className="gr-notfound-icon" aria-hidden="true">
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="6" width="18" height="13" rx="2.5" stroke="#b7ae9e" strokeWidth="1.6" strokeDasharray="3 2.4" />
            <path d="M4 8l8 6 8-6" stroke="#b7ae9e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="gr-notfound-title">{t.notFoundTitle}</h1>
        <p className="gr-notfound-body">{body}</p>
        <p className="gr-notfound-hint">{t.notFoundHint}</p>
        <div className="gr-brand">INVITO</div>
      </div>
    );
  }

  const { brief, copy, design } = published.invitation;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || attending === null || sending) return;
    setSending(true);
    setSubmitError(false);
    try {
      await submitRsvp(id, {
        name: name.trim(),
        attending,
        guests_count: attending ? guestsCount : 1,
        note: note.trim() ? note.trim() : null,
      });
      setSent(true);
    } catch {
      setSubmitError(true);
    } finally {
      setSending(false);
    }
  }

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: copy.title, url });
        return;
      } catch {
        // fall through to clipboard (user cancelled or share unavailable)
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const place = [brief.venue, brief.city].filter(Boolean).join(", ");
  const canSubmit = name.trim().length > 0 && attending !== null && !sending;

  // Hidden when the free-text date doesn't parse — better no button than a
  // wrong day in someone's calendar.
  const eventStart = parseEventStart(brief.date, brief.time);

  function handleAddToCalendar() {
    if (!eventStart) return;
    const ics = buildIcs({
      uid: `${id}@invito`,
      title: copy.title,
      location: place || undefined,
      start: eventStart,
    });
    downloadFile("invitation.ics", ics, "text/calendar;charset=utf-8");
  }

  return (
    <div className="gr-page">
      <div className="gr-layout">
        <div className="gr-inv">
          <InvitationPreview copy={copy} design={design} background={published.invitation.background} />
        </div>

        <div className="gr-side">
          <div className="gr-lang">
            <LangSwitcher globe value={chromeLang} onChange={handleLang} />
          </div>
          {sent ? (
            <>
              <section className="gr-card gr-thanks">
                {attending ? (
                  <div className="gr-badge-wrap gr-accent" aria-hidden="true">
                    <div className="gr-badge-halo" />
                    <div className="gr-badge">
                      <CheckIcon size={34} color="#ffffff" width={2.6} />
                    </div>
                    <Twinkle className="gr-tw" style={{ top: -4, right: 2, color: "#d98a4f" }} size={16} />
                    <Twinkle className="gr-tw" style={{ bottom: 2, left: -6, color: "#c98a3e", animationDelay: "0.6s" }} size={12} />
                    <Twinkle className="gr-tw" style={{ top: 14, left: -10, color: "#b3592e", animationDelay: "1.1s" }} size={9} />
                  </div>
                ) : (
                  <div className="gr-badge-wrap" aria-hidden="true">
                    <div className="gr-badge gr-badge-muted">
                      <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M12 20s-6.5-4.35-9-8.5C1.4 8.5 3 5.5 6 5.5c1.9 0 3.2 1.1 4 2.3.8-1.2 2.1-2.3 4-2.3 3 0 4.6 3 3 6-2.5 4.15-9 8.5-9 8.5z"
                          stroke="#9a9384"
                          strokeWidth="1.7"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </div>
                )}
                <h2 className="gr-thanks-title">{attending ? t.thanksTitle : t.declinedTitle}</h2>
                <p className="gr-thanks-body">
                  {t.thanksSent}
                  <br />
                  {attending ? t.thanksGlad : t.declinedSorry}
                </p>
                <div className={`gr-pill${attending ? "" : " muted"}`}>
                  {attending && <CheckIcon size={16} color="#b3592e" width={2.4} />}
                  {attending
                    ? `${t.attendingPill} · ${guestsCount} ${guestWord(guestsCount, t.guestForms)}`
                    : t.declinedPill}
                </div>
                <button className="gr-change" onClick={() => setSent(false)}>
                  {t.changeAnswer}
                </button>
              </section>

              {attending && (
                <div className="gr-rows">
                  {eventStart && (
                    <button className="gr-row" onClick={handleAddToCalendar}>
                      <div className="gr-row-icon">
                        <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
                          <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke="#b3592e" strokeWidth="1.7" />
                          <path d="M3.5 9.5h17M8 2.8v4M16 2.8v4" stroke="#b3592e" strokeWidth="1.7" strokeLinecap="round" />
                        </svg>
                      </div>
                      <div className="gr-row-text">
                        <div className="gr-row-title">{t.addToCalendar}</div>
                        <div className="gr-row-sub">{[brief.date, brief.time].filter(Boolean).join(", ")}</div>
                      </div>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                        <path d="M9 6l6 6-6 6" stroke="#c3bbac" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                  {place && (
                    <a
                      className="gr-row"
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <div className="gr-row-icon">
                        <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
                          <path d="M12 21s-7-6.3-7-11a7 7 0 1114 0c0 4.7-7 11-7 11z" stroke="#b3592e" strokeWidth="1.7" strokeLinejoin="round" />
                          <circle cx="12" cy="10" r="2.4" stroke="#b3592e" strokeWidth="1.7" />
                        </svg>
                      </div>
                      <div className="gr-row-text">
                        <div className="gr-row-title">{t.directions}</div>
                        <div className="gr-row-sub">{place}</div>
                      </div>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                        <path d="M9 6l6 6-6 6" stroke="#c3bbac" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </a>
                  )}
                  <button className="gr-row" onClick={handleShare}>
                    <div className="gr-row-icon">
                      <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M9 15l6-6M11 6.5l1-1a3.5 3.5 0 015 5l-2 2M13 17.5l-1 1a3.5 3.5 0 01-5-5l2-2"
                          stroke="#b3592e"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                    <div className="gr-row-text">
                      <div className="gr-row-title">{t.share}</div>
                      <div className="gr-row-sub">{copied ? t.linkCopied : t.shareHint}</div>
                    </div>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                      <path d="M9 6l6 6-6 6" stroke="#c3bbac" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              )}
            </>
          ) : (
            <section className="gr-card">
              <form onSubmit={handleSubmit}>
                <div className={sending ? "gr-lock" : undefined}>
                  <div className="gr-kicker">{t.replyKicker}</div>

                  <label className="gr-label" htmlFor="rsvp-name">
                    {t.yourName}
                  </label>
                  <input
                    id="rsvp-name"
                    className="gr-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.namePlaceholder}
                    maxLength={100}
                    required
                  />

                  <div className="gr-question">{t.attendingQuestion}</div>
                  <div className="gr-tiles" role="radiogroup" aria-label={t.attendingQuestion}>
                    <button
                      type="button"
                      className={`gr-tile${attending === true ? " active" : ""}`}
                      role="radio"
                      aria-checked={attending === true}
                      onClick={() => setAttending(true)}
                    >
                      <CheckIcon size={18} color={attending === true ? "#ffffff" : "#b3592e"} width={attending === true ? 2.4 : 2.2} />
                      {t.yes}
                    </button>
                    <button
                      type="button"
                      className={`gr-tile decline${attending === false ? " active" : ""}`}
                      role="radio"
                      aria-checked={attending === false}
                      onClick={() => setAttending(false)}
                    >
                      <CrossIcon size={16} color={attending === false ? "#ffffff" : "#8d8577"} />
                      {t.no}
                    </button>
                  </div>

                  {attending === true && (
                    <div className="gr-guests">
                      <div className="gr-label centered">{t.guestsCount}</div>
                      <div className="gr-stepper-wrap">
                        <div className="gr-stepper">
                          <button
                            type="button"
                            className="gr-step"
                            aria-label="−"
                            disabled={guestsCount <= 1}
                            onClick={() => setGuestsCount((n) => Math.max(1, n - 1))}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                              <path d="M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                            </svg>
                          </button>
                          <div className="gr-count">{guestsCount}</div>
                          <button
                            type="button"
                            className="gr-step"
                            aria-label="+"
                            disabled={guestsCount >= 10}
                            onClick={() => setGuestsCount((n) => Math.min(10, n + 1))}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <label className="gr-label" htmlFor="rsvp-note">
                    {t.noteLabel} <span className="gr-optional">{t.noteOptional}</span>
                  </label>
                  <textarea
                    id="rsvp-note"
                    className="gr-input gr-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t.notePlaceholder}
                    maxLength={500}
                    rows={2}
                  />

                  {submitError && <p className="error">{t.error}</p>}
                </div>

                <button className="gr-submit" type="submit" disabled={!canSubmit}>
                  {sending && (
                    <svg className="gr-spin" width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.35)" strokeWidth="2.6" />
                      <path d="M21 12a9 9 0 00-9-9" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" />
                    </svg>
                  )}
                  {sending ? t.sending : t.send}
                </button>
              </form>
            </section>
          )}

          <div className="gr-brand">INVITO</div>
        </div>
      </div>
    </div>
  );
}
