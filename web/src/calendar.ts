// Add-to-calendar for the guest page. The brief's date/time are free text as
// the host wrote them ("12 серпня", "18:00", "August 12"), so parsing is
// best-effort: when no confident date emerges the UI hides the action rather
// than putting a wrong day in someone's calendar.

export interface EventStart {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number | null; // null = all-day
  minute: number;
}

// Month prefixes; Ukrainian ones cover both nominative and genitive forms
// (серпень / серпня → "серп"). Order = month number - 1.
const UK_MONTHS = [
  "січ",
  "лют",
  "бер",
  "кві",
  "тра",
  "чер",
  "лип",
  "серп",
  "вер",
  "жов",
  "лис",
  "гру",
];
const EN_MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

function monthFromWord(word: string): number | null {
  for (const [i, prefix] of UK_MONTHS.entries()) {
    if (word.startsWith(prefix)) return i + 1;
  }
  for (const [i, prefix] of EN_MONTHS.entries()) {
    if (word.startsWith(prefix)) return i + 1;
  }
  return null;
}

function isRealDate(year: number, month: number, day: number): boolean {
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

// No explicit year: the nearest future occurrence (an event a few hours past
// today still counts as this year's).
function pickYear(month: number, day: number, now: Date): number {
  const candidate = new Date(now.getFullYear(), month - 1, day, 23, 59);
  return candidate.getTime() >= now.getTime() - 24 * 3600 * 1000
    ? now.getFullYear()
    : now.getFullYear() + 1;
}

function parseDateText(
  text: string,
  now: Date,
): { year: number; month: number; day: number } | null {
  const lower = text.toLowerCase();

  const iso = lower.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    return isRealDate(y, m, d) ? { year: y, month: m, day: d } : null;
  }

  // 12.08 / 12/08 / 12.08.2026 — day-first, the local convention.
  const numeric = lower.match(/(\d{1,2})[./](\d{1,2})(?:[./](\d{4}))?/);
  if (numeric) {
    const d = Number(numeric[1]);
    const m = Number(numeric[2]);
    const y = numeric[3] ? Number(numeric[3]) : pickYear(m, d, now);
    return isRealDate(y, m, d) ? { year: y, month: m, day: d } : null;
  }

  // "12 серпня", "August 12", "Aug 12 2026" — a month word plus a day number.
  const words = lower.split(/[^\p{L}\d]+/u).filter(Boolean);
  const month = words.map(monthFromWord).find((m) => m !== null) ?? null;
  if (month === null) return null;
  const yearWord = words.find((w) => /^\d{4}$/.test(w));
  const dayWord = words.find((w) => /^\d{1,2}$/.test(w));
  if (!dayWord) return null;
  const day = Number(dayWord);
  const year = yearWord ? Number(yearWord) : pickYear(month, day, now);
  return isRealDate(year, month, day) ? { year, month, day } : null;
}

function parseTimeText(text: string): { hour: number; minute: number } | null {
  const clock = text.match(/(\d{1,2})[:.](\d{2})/);
  if (clock) {
    const hour = Number(clock[1]);
    const minute = Number(clock[2]);
    return hour <= 23 && minute <= 59 ? { hour, minute } : null;
  }
  const ampm = text.toLowerCase().match(/(\d{1,2})\s*(am|pm)/);
  if (ampm) {
    const raw = Number(ampm[1]);
    if (raw < 1 || raw > 12) return null;
    const hour = (raw % 12) + (ampm[2] === "pm" ? 12 : 0);
    return { hour, minute: 0 };
  }
  return null;
}

export function parseEventStart(
  dateText: string | null,
  timeText: string | null,
  now: Date = new Date(),
): EventStart | null {
  if (!dateText) return null;
  const date = parseDateText(dateText, now);
  if (!date) return null;
  const time = timeText ? parseTimeText(timeText) : null;
  return { ...date, hour: time?.hour ?? null, minute: time?.minute ?? 0 };
}

// RFC 5545 text escaping: backslash, semicolon, comma, newline.
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

const pad = (n: number) => String(n).padStart(2, "0");

function icsDate(year: number, month: number, day: number): string {
  return `${year}${pad(month)}${pad(day)}`;
}

/** Minimal single-event calendar. Timed events use floating local time (no
 *  timezone) — right for a physical event a guest attends where it happens;
 *  without a time the event is all-day. Timed events default to 2 hours. */
export function buildIcs(options: {
  uid: string;
  title: string;
  location?: string;
  start: EventStart;
}): string {
  const { uid, title, location, start } = options;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//INVITO//e-invitation//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "")}`,
  ];
  if (start.hour === null) {
    const dayAfter = new Date(start.year, start.month - 1, start.day + 1);
    lines.push(
      `DTSTART;VALUE=DATE:${icsDate(start.year, start.month, start.day)}`,
      `DTEND;VALUE=DATE:${icsDate(dayAfter.getFullYear(), dayAfter.getMonth() + 1, dayAfter.getDate())}`,
    );
  } else {
    const startStamp = `${icsDate(start.year, start.month, start.day)}T${pad(start.hour)}${pad(start.minute)}00`;
    const end = new Date(start.year, start.month - 1, start.day, start.hour + 2, start.minute);
    const endStamp = `${icsDate(end.getFullYear(), end.getMonth() + 1, end.getDate())}T${pad(end.getHours())}${pad(end.getMinutes())}00`;
    lines.push(`DTSTART:${startStamp}`, `DTEND:${endStamp}`);
  }
  lines.push(`SUMMARY:${escapeIcsText(title)}`);
  if (location) lines.push(`LOCATION:${escapeIcsText(location)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}
