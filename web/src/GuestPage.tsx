import { useEffect, useState, type FormEvent } from "react";
import { fetchInvitation, submitRsvp } from "./api";
import { GUEST } from "./i18n";
import { InvitationPreview } from "./components/InvitationPreview";
import type { PublishedInvitation } from "./types";

interface Props {
  id: string;
}

// Public page behind the share link: the invitation plus an RSVP form.
// Guests never register; everything is keyed by the invitation id.
export function GuestPage({ id }: Props) {
  const [published, setPublished] = useState<PublishedInvitation | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "not_found" | "error">("loading");

  const [name, setName] = useState("");
  const [attending, setAttending] = useState<boolean | null>(null);
  const [guestsCount, setGuestsCount] = useState(1);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState(false);

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
  const t = GUEST[published?.invitation.brief.language ?? "uk"];

  if (status === "loading") return <div className="guest-page"><p className="guest-status">{t.loading}</p></div>;
  if (status === "not_found") return <div className="guest-page"><p className="guest-status">{t.notFound}</p></div>;
  if (status === "error" || !published) return <div className="guest-page"><p className="guest-status">{t.error}</p></div>;

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

  return (
    <div className="guest-page">
      <InvitationPreview copy={published.invitation.copy} design={published.invitation.design} />

      <section className="rsvp-card">
        {sent ? (
          <p className="rsvp-thanks">{t.thanks}</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <h2>{t.formTitle}</h2>

            <label htmlFor="rsvp-name">{t.yourName}</label>
            <input
              id="rsvp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              required
            />

            <fieldset>
              <legend>{t.attendingQuestion}</legend>
              <div className="rsvp-choice">
                <label>
                  <input
                    type="radio"
                    name="attending"
                    checked={attending === true}
                    onChange={() => setAttending(true)}
                  />
                  {t.yes}
                </label>
                <label>
                  <input
                    type="radio"
                    name="attending"
                    checked={attending === false}
                    onChange={() => setAttending(false)}
                  />
                  {t.no}
                </label>
              </div>
            </fieldset>

            {attending === true && (
              <>
                <label htmlFor="rsvp-guests">{t.guestsCount}</label>
                <select
                  id="rsvp-guests"
                  value={guestsCount}
                  onChange={(e) => setGuestsCount(Number(e.target.value))}
                >
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </>
            )}

            <label htmlFor="rsvp-note">{t.noteLabel}</label>
            <textarea
              id="rsvp-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={2}
            />

            {submitError && <p className="error">{t.error}</p>}

            <button
              className="primary"
              type="submit"
              disabled={sending || !name.trim() || attending === null}
            >
              {sending ? t.sending : t.send}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
