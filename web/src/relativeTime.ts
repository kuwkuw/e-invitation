// "коли відповіли" for the response list. The host-manage template shows
// coarse, human distances ("2 год тому", "вчора", "6 днів тому") rather than
// timestamps — nobody plans catering off a clock time, and a relative age
// reads the same in both languages.

import { type PluralForms, pluralForm } from "./plural";

export interface RelativeTimeStrings {
  justNow: string;
  /** "{n} хв тому" */
  minutesAgo: string;
  /** "{n} год тому" — abbreviated in both languages, so it doesn't decline. */
  hoursAgo: string;
  yesterday: string;
  /** "{n} {form} тому" — Ukrainian days do decline: 2 дні, 5 днів. */
  daysAgo: string;
  dayForms: PluralForms;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelativeTime(
  iso: string,
  strings: RelativeTimeStrings,
  now: number = Date.now(),
): string {
  const then = Date.parse(iso);
  // A malformed or future timestamp shouldn't render "NaN хв тому"; treat it
  // as just-arrived, which is the harmless reading.
  if (Number.isNaN(then) || then > now) return strings.justNow;

  const elapsed = now - then;
  if (elapsed < MINUTE) return strings.justNow;
  if (elapsed < HOUR) {
    return strings.minutesAgo.replace("{n}", String(Math.floor(elapsed / MINUTE)));
  }
  if (elapsed < DAY) {
    return strings.hoursAgo.replace("{n}", String(Math.floor(elapsed / HOUR)));
  }

  const days = Math.floor(elapsed / DAY);
  if (days === 1) return strings.yesterday;
  return strings.daysAgo
    .replace("{n}", String(days))
    .replace("{form}", pluralForm(days, strings.dayForms));
}
