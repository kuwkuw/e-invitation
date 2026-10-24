import type { ManageStrings } from "../../i18n";
import type { RsvpSummary } from "../../types";

/** The one number the host came for, over a thin bar of answers (adr-019
 *  §8.2). `guests` leads because it is what you cater on; the bar and the
 *  counts under it are the breakdown, not the headline. Counts arrive already
 *  collapsed by the server (adr-010 §5), so a guest who changed their mind is
 *  in here once.
 *
 *  The bar is a proportion, never a progress meter: there is no "full", so it
 *  has no track to fill and no total to reach. Each segment grows by its
 *  count, so a zero needs no arithmetic and simply isn't drawn. It is
 *  `aria-hidden` because the counts beneath it are the same facts as text.
 *  «Ще не знаю» joins in adr-019 step 7 as a third segment and a third count;
 *  a maybe never adds to the headcount (§9.1). */
export function SummaryCard({ summary, t }: { summary: RsvpSummary; t: ManageStrings }) {
  const { yes, no, guests } = summary.counts;
  // Everyone beyond the attendees themselves — the "+4 with companions" line.
  const extra = guests - yes;

  return (
    <section className="hm-card hm-summary">
      <div className="hm-summary-top">
        <span className="hm-bignum">{guests}</span>
        <span className="hm-bigunit">{t.guestsComing}</span>
      </div>
      {extra > 0 && (
        <p className="hm-breakdown">
          {t.comingBreakdown.replace("{yes}", String(yes)).replace("{extra}", String(extra))}
        </p>
      )}
      <div className="hm-bar" aria-hidden="true">
        {yes > 0 && <span className="hm-bar-yes" style={{ flexGrow: yes }} />}
        {no > 0 && <span className="hm-bar-no" style={{ flexGrow: no }} />}
      </div>
      <div className="hm-counts">
        <p className="hm-count hm-count-yes">
          <span className="hm-count-num">{yes}</span>
          <span className="hm-count-label">{t.tileYes}</span>
        </p>
        <p className="hm-count hm-count-no">
          <span className="hm-count-num">{no}</span>
          <span className="hm-count-label">{t.tileNo}</span>
        </p>
      </div>
    </section>
  );
}
