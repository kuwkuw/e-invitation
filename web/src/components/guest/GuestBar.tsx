import type { GuestStrings } from "../../i18n";

interface Props {
  /** `copy.details_line`, "one or two lines" by schema. */
  detailsLine: string;
  monogram: string;
  t: GuestStrings;
}

/**
 * The pinned bar (adr-019 §5.2): seal, when, where, and a way to the reply,
 * kept in view however far the guest scrolls into the card. Paperless Post's
 * rebuild pinned the RSVP beside the key details for the same reason.
 *
 * Nothing new is parsed: the first line of `details_line` is the when, and any
 * further lines join into the where. A one-line `details_line` stays one line.
 */
export function GuestBar({ detailsLine, monogram, t }: Props) {
  const [when, ...rest] = detailsLine
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const where = rest.join(" · ");

  return (
    <div className="gr-bar">
      {/* The title is already the page's heading; the seal is its mark. */}
      <span className="seal gr-bar-seal" aria-hidden="true">
        {monogram}
      </span>
      <div className="gr-bar-lines">
        {when && <div className="gr-bar-when">{when}</div>}
        {where && <div className="gr-bar-where">{where}</div>}
      </div>
      <a className="gr-bar-reply" href="#rsvp">
        {t.reply}
      </a>
    </div>
  );
}
