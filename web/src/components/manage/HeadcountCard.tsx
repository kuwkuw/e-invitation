import type { ManageStrings } from "../../i18n";
import type { RsvpSummary } from "../../types";

/** The one number the host came for. `guests` leads because it is what you
 *  cater on — the yes/no/replied tiles below are the breakdown, not the
 *  headline. Counts arrive already collapsed by the server (adr-010 §5), so a
 *  guest who changed their mind is in here once. */
export function HeadcountCard({ summary, t }: { summary: RsvpSummary; t: ManageStrings }) {
  const { yes, no, guests } = summary.counts;
  // Everyone beyond the attendees themselves — the "+4 with companions" line.
  const extra = guests - yes;
  const replied = yes + no;

  return (
    <section className="hm-card hm-headcount">
      <div className="hm-headcount-top">
        <span className="hm-bignum">{guests}</span>
        <span className="hm-bigunit">{t.guestsComing}</span>
      </div>
      {extra > 0 && (
        <p className="hm-breakdown">
          {t.comingBreakdown.replace("{yes}", String(yes)).replace("{extra}", String(extra))}
        </p>
      )}
      <div className="hm-tiles">
        <div className="hm-tile hm-tile-yes">
          <span className="hm-tile-num">{yes}</span>
          <span className="hm-tile-label">{t.tileYes}</span>
        </div>
        <div className="hm-tile hm-tile-no">
          <span className="hm-tile-num">{no}</span>
          <span className="hm-tile-label">{t.tileNo}</span>
        </div>
        <div className="hm-tile hm-tile-replied">
          <span className="hm-tile-num">{replied}</span>
          <span className="hm-tile-label">{t.tileReplied}</span>
        </div>
      </div>
    </section>
  );
}
