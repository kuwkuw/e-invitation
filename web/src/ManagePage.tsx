import { useState } from "react";
import { LangSwitcher } from "./components/LangSwitcher";
import { HeadcountCard } from "./components/manage/HeadcountCard";
import { AlertIcon, DownloadIcon, KeyIcon, RefreshIcon } from "./components/manage/icons";
import { ManageEmpty } from "./components/manage/ManageEmpty";
import { ManageLinkPrompt } from "./components/manage/ManageLinkPrompt";
import { ManageMessage } from "./components/manage/ManageMessage";
import { ManageSkeleton } from "./components/manage/ManageSkeleton";
import { ResponseList } from "./components/manage/ResponseList";
import { buildRsvpCsv } from "./csv";
import { downloadFile } from "./download";
import { useHostManage } from "./hooks/useHostManage";
import { loadUiLang, MANAGE, type ManageStrings, saveUiLang } from "./i18n";
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
  const manage = useHostManage(id);

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

        {manage.status === "ready" && <ReadyDashboard id={id} manage={manage} t={t} />}
      </div>
    </div>
  );
}

function ReadyDashboard({
  id,
  manage,
  t,
}: {
  id: string;
  manage: ReturnType<typeof useHostManage>;
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

      <p className="hm-brand">INVITO</p>
    </>
  );
}
