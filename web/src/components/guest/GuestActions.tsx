import type { ReactNode } from "react";
import type { GuestStrings } from "../../i18n";
import { CalendarIcon, ChevronIcon, LinkIcon, PinIcon } from "./icons";

interface Props {
  /** Formatted date/time subtitle; the row is hidden when the date didn't
   *  parse — better no button than a wrong day in someone's calendar. */
  when: string | null;
  onAddToCalendar: () => void;
  /** "Venue, City"; empty when the brief has neither. */
  place: string;
  onShare: () => void;
  shareSubtitle: string;
  t: GuestStrings;
}

function Row({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <>
      <div className="gr-row-icon">{icon}</div>
      <div className="gr-row-text">
        <div className="gr-row-title">{title}</div>
        <div className="gr-row-sub">{subtitle}</div>
      </div>
      <ChevronIcon />
    </>
  );
}

/** Post-acceptance actions: save the date, find the venue, pass the link on.
 *  Only shown to guests who said yes. */
export function GuestActions({ when, onAddToCalendar, place, onShare, shareSubtitle, t }: Props) {
  return (
    <div className="gr-rows">
      {when && (
        <button type="button" className="gr-row" onClick={onAddToCalendar}>
          <Row icon={<CalendarIcon />} title={t.addToCalendar} subtitle={when} />
        </button>
      )}
      {place && (
        <a
          className="gr-row"
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Row icon={<PinIcon />} title={t.directions} subtitle={place} />
        </a>
      )}
      <button type="button" className="gr-row" onClick={onShare}>
        <Row icon={<LinkIcon />} title={t.share} subtitle={shareSubtitle} />
      </button>
    </div>
  );
}
