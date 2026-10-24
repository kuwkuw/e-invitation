import { pluralForm } from "../plural";

/** What a countdown reads. `GuestStrings` satisfies it as it stands; the
 *  manage page builds one from `MANAGE`, whose day forms live under `time`. */
export interface CountdownStrings {
  /** "{n} {form}", with `{form}` from `dayForms`. */
  countdown: string;
  countdownToday: string;
  dayForms: [string, string, string];
}

/** «До свята N днів», on the guest page under the card (adr-019 §9.4) and on
 *  the manage page under the header (§8.1). The guest's follows the
 *  invitation's language and the host's follows the UI's, so the strings come
 *  in from each page. `days` is `daysUntil`'s answer: null when the date
 *  didn't parse or has passed, which is exactly when the calendar action has
 *  no day to offer either. */
export function Countdown({
  days,
  t,
  className,
}: {
  days: number | null;
  t: CountdownStrings;
  className: string;
}) {
  if (days === null) return null;
  const text =
    days === 0
      ? t.countdownToday
      : t.countdown.replace("{n}", String(days)).replace("{form}", pluralForm(days, t.dayForms));
  return <p className={className}>{text}</p>;
}
