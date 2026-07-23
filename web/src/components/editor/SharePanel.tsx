import { buildRsvpCsv } from "../../csv";
import { downloadFile } from "../../download";
import { shareUrl } from "../../hooks/usePublishing";
import type { UiStrings } from "../../i18n";
import type { PublishResult, RsvpSummary } from "../../types";

interface Props {
  published: PublishResult;
  rsvps: RsvpSummary | null;
  rsvpsLoading: boolean;
  onCopyLink: () => void;
  copied: boolean;
  onRefreshRsvps: () => void;
  t: UiStrings;
}

/** Post-publish panel: the share link plus the host's response list. Opened
 *  by the header's share button; the RSVP list is fetched on demand rather
 *  than polled, so the host sees a refresh control instead of live counts. */
export function SharePanel({
  published,
  rsvps,
  rsvpsLoading,
  onCopyLink,
  copied,
  onRefreshRsvps,
  t,
}: Props) {
  const url = shareUrl(published.id);
  return (
    <div className="cc-share-panel">
      <p className="publish-status">
        {t.publishedVersion.replace("{n}", String(published.version))}
      </p>
      <p className="share-hint">{t.shareHint}</p>
      <div className="share-row">
        <input readOnly value={url} onFocus={(e) => e.target.select()} />
        <button type="button" onClick={onCopyLink}>
          {copied ? t.copied : t.copyLink}
        </button>
      </div>
      <div className="responses">
        <div className="responses-head">
          <h3>{t.responsesTitle}</h3>
          <button type="button" onClick={onRefreshRsvps} disabled={rsvpsLoading}>
            {rsvpsLoading ? "…" : `↻ ${t.refreshResponses}`}
          </button>
          {rsvps && rsvps.rsvps.length > 0 && (
            <button
              type="button"
              onClick={() =>
                downloadFile(
                  "rsvps.csv",
                  buildRsvpCsv(rsvps.rsvps, t.csv),
                  "text/csv;charset=utf-8",
                )
              }
            >
              {`⬇ ${t.exportCsv}`}
            </button>
          )}
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
                {rsvps.rsvps.map((r) => (
                  <li key={`${r.created_at}:${r.name}`}>
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
    </div>
  );
}
