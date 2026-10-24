import type { GuestStrings } from "../../i18n";
import { CalendarIcon, PinIcon } from "./icons";

interface Props {
  /** Null when the date didn't parse: better no button than a wrong day in
   *  someone's calendar. */
  onAddToCalendar: (() => void) | null;
  /** "Venue, City"; empty when the brief has neither. */
  place: string;
  t: GuestStrings;
}

/**
 * The two quiet actions under the card (adr-019 §5.2): «У календар», offered
 * before a reply now rather than only after a yes (FR-4.5), and «Маршрут», a
 * plain maps search with no API, key or embed (§9.4). Each hides on its own.
 */
export function QuietActions({ onAddToCalendar, place, t }: Props) {
  if (!onAddToCalendar && !place) return null;
  return (
    <div className="gr-quiet">
      {onAddToCalendar && (
        <button type="button" className="gr-quiet-action" onClick={onAddToCalendar}>
          <CalendarIcon />
          {t.addToCalendar}
        </button>
      )}
      {place && (
        <a
          className="gr-quiet-action"
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <PinIcon />
          {t.route}
        </a>
      )}
    </div>
  );
}
