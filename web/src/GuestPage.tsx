import { useState } from "react";
import { buildIcs, parseEventStart } from "./calendar";
import { GuestActions } from "./components/guest/GuestActions";
import { GuestNotFound } from "./components/guest/GuestNotFound";
import { RsvpForm } from "./components/guest/RsvpForm";
import { ThanksCard } from "./components/guest/ThanksCard";
import { InvitationPreview } from "./components/InvitationPreview";
import { LangSwitcher } from "./components/LangSwitcher";
import { downloadFile } from "./download";
import { loadGuestLang, saveGuestLang } from "./guestLang";
import { usePublishedInvitation } from "./hooks/usePublishedInvitation";
import { useRsvpForm } from "./hooks/useRsvpForm";
import { GUEST } from "./i18n";
import type { Language } from "./types";

// Public page behind the share link: the invitation plus an RSVP form.
// Guests never register; everything is keyed by the invitation id.
// Visuals follow templates/guest-rsvp in the E-invitation DS project:
// invitation is the hero, the reply is a quiet white card below/beside it.
export function GuestPage({ id }: { id: string }) {
  const { published, status } = usePublishedInvitation(id);
  const [langOverride, setLangOverride] = useState<Language | null>(loadGuestLang);
  const form = useRsvpForm(id);
  const [copied, setCopied] = useState(false);

  // Until the invitation loads we don't know its language; default to uk
  // (the app's primary audience) for the loading/error shell.
  const chromeLang = langOverride ?? published?.invitation.brief.language ?? "uk";
  const t = GUEST[chromeLang];

  function handleLang(lang: Language) {
    setLangOverride(lang);
    saveGuestLang(lang);
  }

  if (status === "loading") {
    return (
      <div className="gr-page">
        <p className="gr-status">{t.loading}</p>
      </div>
    );
  }

  if (status === "not_found" || status === "error" || !published) {
    return <GuestNotFound body={status === "error" ? t.error : t.notFoundBody} t={t} />;
  }

  const { brief, copy, design } = published.invitation;
  const place = [brief.venue, brief.city].filter(Boolean).join(", ");
  // Hidden when the free-text date doesn't parse — better no button than a
  // wrong day in someone's calendar.
  const eventStart = parseEventStart(brief.date, brief.time);

  function handleAddToCalendar() {
    if (!eventStart) return;
    downloadFile(
      "invitation.ics",
      buildIcs({
        uid: `${id}@invito`,
        title: copy.title,
        location: place || undefined,
        start: eventStart,
      }),
      "text/calendar;charset=utf-8",
    );
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

  return (
    <div className="gr-page">
      <div className="gr-layout">
        <div className="gr-inv">
          <InvitationPreview
            copy={copy}
            design={design}
            background={published.invitation.background}
          />
        </div>

        <div className="gr-side">
          <div className="gr-lang">
            <LangSwitcher globe value={chromeLang} onChange={handleLang} />
          </div>
          {form.sent ? (
            <>
              <ThanksCard
                attending={form.attending === true}
                guestsCount={form.guestsCount}
                onChangeAnswer={form.reopen}
                t={t}
              />
              {form.attending && (
                <GuestActions
                  when={eventStart ? [brief.date, brief.time].filter(Boolean).join(", ") : null}
                  onAddToCalendar={handleAddToCalendar}
                  place={place}
                  onShare={handleShare}
                  shareSubtitle={copied ? t.linkCopied : t.shareHint}
                  t={t}
                />
              )}
            </>
          ) : (
            <RsvpForm form={form} t={t} />
          )}

          <div className="gr-brand">INVITO</div>
        </div>
      </div>
    </div>
  );
}
