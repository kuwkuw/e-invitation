import { describe, expect, it } from "vitest";
import { buildIcs, parseEventStart } from "../src/calendar";

// The host wrote the invitation in July 2026.
const now = new Date(2026, 6, 22);

describe("parseEventStart", () => {
  it("parses Ukrainian month names (genitive and nominative)", () => {
    expect(parseEventStart("12 серпня", "18:00", now)).toEqual({
      year: 2026,
      month: 8,
      day: 12,
      hour: 18,
      minute: 0,
    });
    expect(parseEventStart("1 вересень", null, now)).toMatchObject({ month: 9, day: 1 });
    expect(parseEventStart("5 листопада", null, now)).toMatchObject({ month: 11, day: 5 });
  });

  it("parses English month names in either order", () => {
    expect(parseEventStart("August 12", null, now)).toMatchObject({ year: 2026, month: 8, day: 12 });
    expect(parseEventStart("12 Aug 2027", null, now)).toMatchObject({ year: 2027, month: 8, day: 12 });
  });

  it("parses numeric and ISO dates, day-first for dotted", () => {
    expect(parseEventStart("12.08", null, now)).toMatchObject({ year: 2026, month: 8, day: 12 });
    expect(parseEventStart("12.08.2027", null, now)).toMatchObject({ year: 2027, month: 8, day: 12 });
    expect(parseEventStart("2026-08-12", null, now)).toMatchObject({ year: 2026, month: 8, day: 12 });
  });

  it("rolls a passed month-day into next year when no year is given", () => {
    expect(parseEventStart("10 січня", null, now)).toMatchObject({ year: 2027, month: 1, day: 10 });
    // Today (and yesterday) still count as this year.
    expect(parseEventStart("22.07", null, now)).toMatchObject({ year: 2026 });
  });

  it("returns null when nothing parses confidently", () => {
    expect(parseEventStart(null, "18:00", now)).toBeNull();
    expect(parseEventStart("next Saturday", null, now)).toBeNull();
    expect(parseEventStart("31.02", null, now)).toBeNull();
    expect(parseEventStart("серпень десяте", null, now)).toBeNull(); // month but no day digit
  });

  it("parses times, defaulting to all-day without one", () => {
    expect(parseEventStart("12.08", "о 18:30", now)).toMatchObject({ hour: 18, minute: 30 });
    expect(parseEventStart("12.08", "6 pm", now)).toMatchObject({ hour: 18, minute: 0 });
    expect(parseEventStart("12.08", "12pm", now)).toMatchObject({ hour: 12, minute: 0 });
    expect(parseEventStart("12.08", "sometime", now)).toMatchObject({ hour: null });
    expect(parseEventStart("12.08", null, now)).toMatchObject({ hour: null });
  });
});

describe("buildIcs", () => {
  it("emits a timed 2-hour floating-local event with escaped text", () => {
    const ics = buildIcs({
      uid: "abc123@invito",
      title: "День народження, свято",
      location: "Кафе «Затишок», Львів",
      start: { year: 2026, month: 8, day: 12, hour: 18, minute: 30 },
    });
    expect(ics).toContain("DTSTART:20260812T183000");
    expect(ics).toContain("DTEND:20260812T203000");
    expect(ics).toContain("SUMMARY:День народження\\, свято");
    expect(ics).toContain("LOCATION:Кафе «Затишок»\\, Львів");
    expect(ics).toContain("UID:abc123@invito");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("emits an all-day event when there is no time", () => {
    const ics = buildIcs({
      uid: "abc123@invito",
      title: "Party",
      start: { year: 2026, month: 12, day: 31, hour: null, minute: 0 },
    });
    expect(ics).toContain("DTSTART;VALUE=DATE:20261231");
    expect(ics).toContain("DTEND;VALUE=DATE:20270101");
    expect(ics).not.toContain("LOCATION");
  });

  it("rolls a late-evening event's end past midnight", () => {
    const ics = buildIcs({
      uid: "x@invito",
      title: "Party",
      start: { year: 2026, month: 8, day: 12, hour: 23, minute: 0 },
    });
    expect(ics).toContain("DTEND:20260813T010000");
  });
});
