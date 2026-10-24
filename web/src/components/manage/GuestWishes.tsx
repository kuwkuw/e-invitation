import type { ManageStrings } from "../../i18n";
import { groupResponses } from "../../responseGroups";
import type { RsvpSummary } from "../../types";

/** «Побажання від гостей» (adr-019 §8.4): the newest note a guest left, as a
 *  pull-quote with their name. It reads answers through `groupResponses`, so
 *  it shares the list's idea of who said what last: a note on a replaced
 *  answer is history (FR-5.5) and is never quoted, even when it is the newest
 *  note there is. Absent when no live answer carries one.
 *
 *  «Усі побажання» leads to the list, where every note already sits under its
 *  guest's name, and only when there is more than the one shown: a link to
 *  "all of them" when there is one would be a link to this. */
export function GuestWishes({ summary, t }: { summary: RsvpSummary; t: ManageStrings }) {
  const withNotes = groupResponses(summary.rsvps)
    .map((group) => group.live)
    .filter((rsvp) => rsvp.note?.trim());
  const newest = withNotes[0];
  if (!newest?.note) return null;

  return (
    <section className="hm-card hm-wishes">
      <h2 className="hm-section-title">{t.wishesTitle}</h2>
      {/* The attribution sits outside the quote, as HTML has it. */}
      <figure className="hm-wish">
        <blockquote>
          <p className="hm-wish-quote">«{newest.note.trim()}»</p>
        </blockquote>
        <figcaption className="hm-wish-who">{newest.name}</figcaption>
      </figure>
      {withNotes.length > 1 && (
        <a className="hm-wishes-all" href="#hm-responses">
          {t.wishesAll.replace("{n}", String(withNotes.length))}
        </a>
      )}
    </section>
  );
}
