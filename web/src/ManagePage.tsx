import { useState } from "react";
import { daysUntil, parseEventStart } from "./calendar";
import { Countdown } from "./components/Countdown";
import { LangSwitcher } from "./components/LangSwitcher";
import { AlertIcon, DownloadIcon, KeyIcon, RefreshIcon } from "./components/manage/icons";
import { ManageEmpty } from "./components/manage/ManageEmpty";
import { ManageLinkPrompt } from "./components/manage/ManageLinkPrompt";
import { ManageMessage } from "./components/manage/ManageMessage";
import { ManageSkeleton } from "./components/manage/ManageSkeleton";
import { NotifyControl } from "./components/manage/NotifyControl";
import { RemindGuests } from "./components/manage/RemindGuests";
import { ResponseList } from "./components/manage/ResponseList";
import { SummaryCard } from "./components/manage/SummaryCard";
import { buildRsvpCsv } from "./csv";
import { downloadFile } from "./download";
import { useAuthSession } from "./hooks/useAuthSession";
import { useHostManage } from "./hooks/useHostManage";
import { useNotificationPref } from "./hooks/useNotificationPref";
import { AUTH, type AuthStrings, loadUiLang, MANAGE, type ManageStrings, saveUiLang } from "./i18n";
import { monogramFrom } from "./monogram";
import { routeMeta, useDocumentMeta } from "./seo";
import type { Language } from "./types";

/**
 * Host response dashboard behind `/manage/:id` — the durable way back to an
 * invitation's replies once the editor tab is gone (adr-010 §1).
 *
 * Composition only; access logic lives in `useHostManage`. The layout follows
 * the "host-manage" screens in the E-invitation design project, on paper since
 * adr-019 §8: mobile-first, a grained page under the hosts' seal, chrome kept
 * quiet, colour belonging to the yes/no statuses alone.
 */
export function ManagePage({ id }: { id: string }) {
  const [uiLang, setUiLang] = useState<Language>(loadUiLang);
  const t = MANAGE[uiLang];
  // `noindex, nofollow`: this is a host's guest list, and the links out of it
  // are their own invitation and manage URLs. The title stays generic for the
  // same reason — a tab in a shared screen share should not name the event.
  useDocumentMeta(routeMeta("manage", uiLang));
  const manage = useHostManage(id);
  // The one thing on this page that is *not* authorized by the manage token
  // (adr-015 §7): reply email is a property of an account, and this page can be
  // reached without one. Both conditions render the control absent rather than
  // disabled — a host on a pasted link cannot read or write it, and a
  // deployment with no mail credentials must promise nothing.
  const account = useAuthSession();
  const canNotify = account.status === "signed_in" && account.notifications;
  const notify = useNotificationPref(canNotify);
  // The state line names the address mail goes to, so a session without one
  // has nothing true to say there.
  const notifyEmail = canNotify ? account.email : null;

  function handleLang(lang: Language) {
    setUiLang(lang);
    saveUiLang(lang);
  }

  return (
    <div className="hm-page grain">
      <div className="hm-shell">
        <div className="hm-topbar">
          <LangSwitcher value={uiLang} onChange={handleLang} />
        </div>

        {manage.status === "loading" && <ManageSkeleton label={t.loading} />}

        {manage.status === "no_token" && (
          <ManageLinkPrompt
            icon={<KeyIcon />}
            title={t.noTokenTitle}
            body={t.noTokenBody}
            hint={t.noTokenHint}
            onSubmit={manage.applyManageLink}
            t={t}
          />
        )}

        {manage.status === "invalid_token" && (
          <ManageLinkPrompt
            icon={<AlertIcon />}
            title={t.invalidTitle}
            body={t.invalidBody}
            hint={t.invalidReassure}
            onSubmit={manage.applyManageLink}
            t={t}
          />
        )}

        {manage.status === "not_found" && (
          <ManageMessage icon={<AlertIcon />} title={t.notFoundTitle} body={t.notFoundBody} />
        )}

        {manage.status === "error" && (
          <ManageMessage
            icon={<AlertIcon />}
            title={t.errorTitle}
            body={t.errorBody}
            action={{ label: t.retry, onClick: manage.retry }}
          />
        )}

        {manage.status === "ready" && (
          <ReadyDashboard
            id={id}
            manage={manage}
            notify={notifyEmail ? { ...notify, email: notifyEmail, auth: AUTH[uiLang] } : null}
            t={t}
          />
        )}
      </div>
    </div>
  );
}

function ReadyDashboard({
  id,
  manage,
  notify,
  t,
}: {
  id: string;
  manage: ReturnType<typeof useHostManage>;
  /** Null for a host with no session on this device, or a deployment that
   *  cannot send mail. */
  notify: { enabled: boolean; toggle: () => void; email: string; auth: AuthStrings } | null;
  t: ManageStrings;
}) {
  const { published, summary, refreshing, refresh, newSinceLastVisit, seenAt } = manage;
  if (!published || !summary) return null;

  const { brief, copy } = published.invitation;
  const eventStart = parseEventStart(brief.date, brief.time);
  const shareUrl = `${window.location.origin}/i/${id}`;
  const hasResponses = summary.rsvps.length > 0;

  return (
    <>
      <header className="hm-header">
        <div className="hm-header-row">
          {/* The guest page's seal and monogram, unchanged (adr-019 §8.1). The
              title is the heading; the seal is its mark. */}
          <span className="seal hm-seal" aria-hidden="true">
            {monogramFrom(brief.hosts)}
          </span>
          <div className="hm-header-text">
            {/* Kept above the title: it tells a host arriving from an email
                which page they're on. */}
            <p className="hm-kicker">{t.kicker}</p>
            <h1 className="hm-title">{copy.title}</h1>
          </div>
        </div>
        <p className="hm-details">{copy.details_line}</p>
        <Countdown
          days={eventStart ? daysUntil(eventStart) : null}
          t={{
            countdown: t.countdown,
            countdownToday: t.countdownToday,
            dayForms: t.time.dayForms,
          }}
          className="hm-countdown"
        />
      </header>

      <div className="hm-actions">
        <span className="hm-updated">{t.updatedJustNow}</span>
        <button type="button" className="hm-btn" onClick={refresh} disabled={refreshing}>
          <RefreshIcon />
          {t.refresh}
        </button>
        {hasResponses && (
          <button
            type="button"
            className="hm-btn"
            onClick={() =>
              downloadFile(
                "rsvps.csv",
                buildRsvpCsv(summary.rsvps, t.csv),
                "text/csv;charset=utf-8",
              )
            }
          >
            <DownloadIcon />
            {t.exportCsv}
          </button>
        )}
      </div>

      {hasResponses ? (
        <div className="hm-body">
          <div className="hm-summary-col">
            <SummaryCard summary={summary} t={t} />
            <RemindGuests url={shareUrl} t={t} />
            {newSinceLastVisit > 0 && (
              <p className="hm-new-line">
                <span className="hm-new-dot" aria-hidden="true" />
                {t.newSinceVisit.replace("{n}", String(newSinceLastVisit))}
              </p>
            )}
          </div>
          <div className="hm-list-col">
            <ResponseList summary={summary} newerThan={seenAt} t={t} />
          </div>
        </div>
      ) : (
        <ManageEmpty shareUrl={shareUrl} t={t} />
      )}

      {/* Below the responses, not above them: this page exists to show replies,
          and a preference about being told is a footnote to that. */}
      {notify && (
        <NotifyControl
          enabled={notify.enabled}
          onToggle={notify.toggle}
          email={notify.email}
          t={notify.auth}
        />
      )}

      <p className="hm-brand">INVINTO</p>
    </>
  );
}
