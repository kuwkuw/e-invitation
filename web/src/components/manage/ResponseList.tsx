import type { ManageStrings } from "../../i18n";
import { formatRelativeTime } from "../../relativeTime";
import { groupResponses } from "../../responseGroups";
import type { RsvpEntry, RsvpSummary } from "../../types";
import { ChangedAnswerIcon } from "./icons";

interface Props {
  summary: RsvpSummary;
  /** Replies newer than this get the "new" dot; null on a first visit. */
  newerThan: string | null;
  t: ManageStrings;
}

/** One row per guest, newest reply first, with any replaced answer nested
 *  underneath as history (adr-010 §5). */
export function ResponseList({ summary, newerThan, t }: Props) {
  const groups = groupResponses(summary.rsvps);

  return (
    <section className="hm-card hm-responses">
      <h2 className="hm-section-title">{t.responsesTitle.replace("{n}", String(groups.length))}</h2>
      <ul className="hm-list">
        {groups.map(({ live, previous }) => (
          <li key={`${live.created_at}:${live.name}`} className="hm-item">
            <ResponseRow rsvp={live} isNew={!!newerThan && live.created_at > newerThan} t={t} />
            {previous.map((old) => (
              <PreviousAnswer key={`${old.created_at}:${old.name}`} rsvp={old} t={t} />
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ResponseRow({ rsvp, isNew, t }: { rsvp: RsvpEntry; isNew: boolean; t: ManageStrings }) {
  return (
    <div className="hm-row">
      <span className="hm-avatar" aria-hidden="true">
        {[...rsvp.name.trim()][0]?.toUpperCase() ?? "?"}
      </span>
      <div className="hm-row-main">
        <p className="hm-name">
          {isNew && <span className="hm-new-dot" aria-hidden="true" />}
          {rsvp.name}
          {rsvp.attending && rsvp.guests_count > 1 && (
            <span className="hm-plus">+{rsvp.guests_count - 1}</span>
          )}
        </p>
        {rsvp.note && <p className="hm-note">«{rsvp.note}»</p>}
        <p className="hm-when">{formatRelativeTime(rsvp.created_at, t.time)}</p>
      </div>
      <span className={`hm-pill ${rsvp.attending ? "hm-pill-yes" : "hm-pill-no"}`}>
        {rsvp.attending ? t.yes : t.no}
      </span>
    </div>
  );
}

/** Present but not counted: legible, visibly demoted, and never styled as an
 *  error — the guest simply changed their mind. */
function PreviousAnswer({ rsvp, t }: { rsvp: RsvpEntry; t: ManageStrings }) {
  return (
    <p className="hm-previous">
      <span className="hm-previous-icon">
        <ChangedAnswerIcon />
      </span>
      <s>{rsvp.attending ? t.yes : t.no}</s> · {t.previousAnswer}
      <span className="hm-previous-when">{formatRelativeTime(rsvp.created_at, t.time)}</span>
    </p>
  );
}
