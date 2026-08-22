import { useState } from "react";
import { FeedbackSheet } from "./components/FeedbackSheet";
import { LangSwitcher } from "./components/LangSwitcher";
import { HeadcountCard } from "./components/manage/HeadcountCard";
import { AlertIcon, DownloadIcon, KeyIcon, RefreshIcon } from "./components/manage/icons";
import { ManageEmpty } from "./components/manage/ManageEmpty";
import { ManageLinkPrompt } from "./components/manage/ManageLinkPrompt";
import { ManageMessage } from "./components/manage/ManageMessage";
import { ManageSkeleton } from "./components/manage/ManageSkeleton";
import { NotifyControl } from "./components/manage/NotifyControl";
import { ResponseList } from "./components/manage/ResponseList";
import { buildRsvpCsv } from "./csv";
import { downloadFile } from "./download";
import { useAuthSession } from "./hooks/useAuthSession";
import { useHostManage } from "./hooks/useHostManage";
import { useNotificationPref } from "./hooks/useNotificationPref";
import {
  AUTH,
  type AuthStrings,
  FEEDBACK,
  loadUiLang,
  MANAGE,
  type ManageStrings,
  saveUiLang,
} from "./i18n";
import { routeMeta, useDocumentMeta } from "./seo";
import type { Language } from "./types";

/**
 * Host response dashboard behind `/manage/:id` — the durable way back to an
 * invitation's replies once the editor tab is gone (adr-010 §1).
 *
 * Composition only; access logic lives in `useHostManage`. The layout follows
 * the "host-manage" template in the E-invitation DS project: mobile-first,
 * chrome stays quiet, colour belongs to the yes/no statuses alone.
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
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  function handleLang(lang: Language) {
    setUiLang(lang);
    saveUiLang(lang);
  }

  return (
    <div className="hm-page">
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
            notify={canNotify ? { ...notify, auth: AUTH[uiLang] } : null}
            onFeedback={() => setFeedbackOpen(true)}
            feedbackLabel={FEEDBACK[uiLang].link}
            t={t}
          />
        )}
      </div>

      {/* Feedback's second durable home (adr-017 §4). Only under a dashboard
          that actually loaded: the four failure states above are prompts to
          fix something, and a "write to us" beside them would read as the
          product giving up. It carries no invitation id — `page: "manage"` is
          the whole of what the message says about where it came from (§3). */}
      {feedbackOpen && (
        <FeedbackSheet
          page="manage"
          lang={uiLang}
          // A host on a pasted manage link has no session here, which is
          // ordinary: unlike the notification control above, feedback needs no
          // account.
          email={account.status === "signed_in" ? account.email : null}
          onClose={() => setFeedbackOpen(false)}
          t={FEEDBACK[uiLang]}
        />
      )}
    </div>
  );
}

function ReadyDashboard({
  id,
  manage,
  notify,
  onFeedback,
  feedbackLabel,
  t,
}: {
  id: string;
  manage: ReturnType<typeof useHostManage>;
  /** Null for a host with no session on this device, or a deployment that
   *  cannot send mail. */
  notify: { enabled: boolean; toggle: () => void; auth: AuthStrings } | null;
  /** Unconditional, unlike `notify`: feedback needs no account and no mail
   *  credentials, so there is no deployment where this is absent. */
  onFeedback: () => void;
  feedbackLabel: string;
  t: ManageStrings;
}) {
  const { published, summary, refreshing, refresh, newSinceLastVisit, seenAt } = manage;
  if (!published || !summary) return null;

  const { copy } = published.invitation;
  const shareUrl = `${window.location.origin}/i/${id}`;
  const hasResponses = summary.rsvps.length > 0;

  return (
    <>
      <header className="hm-header">
        <p className="hm-kicker">{t.kicker}</p>
        <h1 className="hm-title">{copy.title}</h1>
        <p className="hm-details">{copy.details_line}</p>
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
            <HeadcountCard summary={summary} t={t} />
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
        <NotifyControl enabled={notify.enabled} onToggle={notify.toggle} t={notify.auth} />
      )}

      {/* Below even the notification footnote, beside the wordmark: this page
          belongs to the host's event, and the one line about the product that
          renders it sits at the very bottom in the wordmark's own grey. */}
      <p className="hm-brand">
        INVINTO
        <button type="button" className="fb-link hm-feedback" onClick={onFeedback}>
          {feedbackLabel}
        </button>
      </p>
    </>
  );
}
