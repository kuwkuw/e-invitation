import { useState } from "react";
import { LangSwitcher } from "./components/LangSwitcher";
import { useHostManage } from "./hooks/useHostManage";
import { loadUiLang, MANAGE, saveUiLang } from "./i18n";
import type { Language } from "./types";

/**
 * Host response dashboard behind `/manage/:id` — the durable way back to an
 * invitation's replies once the editor tab is gone (adr-010 §1).
 *
 * This is the plumbing pass: every access state is wired and worded, and the
 * ready state renders the data plainly. The designed layout (headcount,
 * status pills, superseded rows, "N new") follows in the host-manage UI task.
 */
export function ManagePage({ id }: { id: string }) {
  const [uiLang, setUiLang] = useState<Language>(loadUiLang);
  const t = MANAGE[uiLang];
  const { status, published, summary, refreshing, refresh, applyManageLink, retry } =
    useHostManage(id);

  function handleLang(lang: Language) {
    setUiLang(lang);
    saveUiLang(lang);
  }

  return (
    <div className="hm-page">
      <div className="hm-lang">
        <LangSwitcher value={uiLang} onChange={handleLang} />
      </div>

      {status === "loading" && <p className="hm-status">{t.loading}</p>}

      {status === "no_token" && (
        <ManageLinkPrompt
          title={t.noTokenTitle}
          body={t.noTokenBody}
          hint={t.noTokenHint}
          onSubmit={applyManageLink}
          t={t}
        />
      )}

      {status === "invalid_token" && (
        <ManageLinkPrompt
          title={t.invalidTitle}
          body={t.invalidBody}
          hint={t.invalidReassure}
          onSubmit={applyManageLink}
          t={t}
        />
      )}

      {status === "not_found" && (
        <div className="hm-state">
          <h1>{t.notFoundTitle}</h1>
          <p>{t.notFoundBody}</p>
        </div>
      )}

      {status === "error" && (
        <div className="hm-state">
          <h1>{t.errorTitle}</h1>
          <p>{t.errorBody}</p>
          <button type="button" onClick={retry}>
            {t.retry}
          </button>
        </div>
      )}

      {status === "ready" && published && summary && (
        <div className="hm-ready">
          <p className="hm-kicker">{t.kicker}</p>
          <h1 className="hm-title">{published.invitation.copy.title}</h1>
          <p className="hm-when">{published.invitation.copy.details_line}</p>

          <button type="button" onClick={refresh} disabled={refreshing}>
            {refreshing ? "…" : t.refresh}
          </button>

          <p className="hm-counts">
            {summary.counts.yes} · {summary.counts.no} · {summary.counts.guests}
          </p>

          <ul className="hm-list">
            {summary.rsvps.map((rsvp) => (
              <li
                key={`${rsvp.created_at}:${rsvp.name}`}
                className={rsvp.superseded ? "hm-superseded" : undefined}
              >
                {rsvp.name} — {String(rsvp.attending)}
                {rsvp.guests_count > 1 && ` ×${rsvp.guests_count}`}
                {rsvp.note && ` — ${rsvp.note}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Shared by the two access states: they differ only in wording, never in the
 *  way out — paste the manage link. */
function ManageLinkPrompt({
  title,
  body,
  hint,
  onSubmit,
  t,
}: {
  title: string;
  body: string;
  hint: string;
  onSubmit: (input: string) => boolean;
  t: { pastePlaceholder: string; pasteInvalid: string; openDashboard: string };
}) {
  const [value, setValue] = useState("");
  const [rejected, setRejected] = useState(false);

  return (
    <form
      className="hm-state"
      onSubmit={(event) => {
        event.preventDefault();
        setRejected(!onSubmit(value));
      }}
    >
      <h1>{title}</h1>
      <p>{body}</p>
      <input
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setRejected(false);
        }}
        placeholder={t.pastePlaceholder}
        aria-label={t.pastePlaceholder}
      />
      {rejected && <p className="hm-reject">{t.pasteInvalid}</p>}
      <button type="submit">{t.openDashboard}</button>
      <p className="hm-hint">{hint}</p>
    </form>
  );
}
