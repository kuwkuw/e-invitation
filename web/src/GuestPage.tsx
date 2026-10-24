import { useState } from "react";
import { buildIcs, daysUntil, parseEventStart } from "./calendar";
import { Countdown } from "./components/guest/Countdown";
import { Envelope } from "./components/guest/Envelope";
import { GuestActions } from "./components/guest/GuestActions";
import { GuestBar } from "./components/guest/GuestBar";
import { GuestCta } from "./components/guest/GuestCta";
import { GuestNotFound } from "./components/guest/GuestNotFound";
import { QuietActions } from "./components/guest/QuietActions";
import { RsvpForm } from "./components/guest/RsvpForm";
import { ThanksCard } from "./components/guest/ThanksCard";
import { InvitationPreview } from "./components/InvitationPreview";
import { LangSwitcher } from "./components/LangSwitcher";
import { downloadFile } from "./download";
import { loadGuestLang, saveGuestLang } from "./guestLang";
import { useEnvelope } from "./hooks/useEnvelope";
import { usePublishedInvitation } from "./hooks/usePublishedInvitation";
import { useRsvpForm } from "./hooks/useRsvpForm";
import { useViewBeacon } from "./hooks/useViewBeacon";
import { GUEST } from "./i18n";
import { monogramFrom } from "./monogram";
import { useDocumentMeta } from "./seo";
import type { Language } from "./types";

// Public page behind the share link: the invitation plus an RSVP form.
// Guests never register; everything is keyed by the invitation id.
// Visuals follow `GuestRsvp` in the E-invitation design project:
// invitation is the hero, the reply is a quiet white card below/beside it.
export function GuestPage({ id }: { id: string }) {
  const { published, status } = usePublishedInvitation(id);
  // Share-loop instrumentation (adr-013): counted here, in the client, because
  // /i/:id is server-rendered for messenger crawlers and would count unfurls.
  useViewBeacon(id, status);
  // Decided at mount, before the beacon above writes inv-viewed:<id>.
  const envelope = useEnvelope(id, status);
  const [langOverride, setLangOverride] = useState<Language | null>(loadGuestLang);
  const form = useRsvpForm(id);
  const [copied, setCopied] = useState(false);

  // Until the invitation loads we don't know its language; default to uk
  // (the app's primary audience) for the loading/error shell.
  const chromeLang = langOverride ?? published?.invitation.brief.language ?? "uk";
  const t = GUEST[chromeLang];

  // Shareable and unindexable at the same time (adr-016 §3). The server
  // already served this page `noindex` with the invitation's own title in it;
  // this keeps that true after a client-side navigation, and keeps the tab
  // naming the event rather than the marketing page. `lang` follows the
  // invitation's language, not the chrome toggle — the invitation is the
  // page's content, the chrome around it is a preference. Null until it
  // loads, so nothing overwrites the shell with a placeholder.
  useDocumentMeta(
    published
      ? {
          lang: published.invitation.brief.language,
          title: published.invitation.copy.title,
          description: published.invitation.copy.details_line.replace(/\n+/g, " · "),
          robots: "noindex, nofollow",
          canonical: null,
        }
      : null,
  );

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
  const monogram = monogramFrom(brief.hosts);
  const place = [brief.venue, brief.city].filter(Boolean).join(", ");
  // Null when the free-text date doesn't parse, which hides both the calendar
  // action and the countdown — better nothing than a wrong day.
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
    // Without the fragment: «Відповісти» may have left #rsvp on the URL.
    const url = window.location.href.split("#")[0] ?? window.location.href;
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

  // The page renders beneath the envelope from the start, inert while it is
  // up so nobody tabs into a form they can't see, and rising as it opens.
  const envelopeUp = envelope.phase !== "none";
  return (
    <>
      <div
        className="gr-page"
        inert={envelopeUp}
        data-rising={envelope.phase === "opening" ? "" : undefined}
      >
        <GuestBar detailsLine={copy.details_line} monogram={monogram} t={t} />
        <div className="gr-layout">
          <div className="gr-inv">
            <div className="gr-lang">
              <LangSwitcher globe value={chromeLang} onChange={handleLang} />
            </div>
            <InvitationPreview
              copy={copy}
              design={design}
              background={published.invitation.background}
            />
            <Countdown days={eventStart ? daysUntil(eventStart) : null} t={t} />
            <QuietActions
              onAddToCalendar={eventStart ? handleAddToCalendar : null}
              place={place}
              t={t}
            />
          </div>

          <div className="gr-side" id="rsvp">
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
                    onShare={handleShare}
                    shareSubtitle={copied ? t.linkCopied : t.shareHint}
                    t={t}
                  />
                )}
              </>
            ) : (
              <RsvpForm form={form} t={t} />
            )}

            <GuestCta t={t} />
          </div>
        </div>
      </div>
      {envelopeUp && (
        <Envelope
          phase={envelope.phase === "opening" ? "opening" : "closed"}
          title={copy.title}
          monogram={monogram}
          onOpen={envelope.open}
          t={t}
        />
      )}
    </>
  );
}
