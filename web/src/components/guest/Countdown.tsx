import type { GuestStrings } from "../../i18n";
import { pluralForm } from "../../plural";

/** «До свята N днів» (adr-019 §9.4). `days` is `daysUntil`'s answer: null when
 *  the date didn't parse or has passed, which is exactly when the calendar
 *  action has no day to offer either. */
export function Countdown({ days, t }: { days: number | null; t: GuestStrings }) {
  if (days === null) return null;
  const text =
    days === 0
      ? t.countdownToday
      : t.countdown.replace("{n}", String(days)).replace("{form}", pluralForm(days, t.dayForms));
  return <p className="gr-countdown">{text}</p>;
}
