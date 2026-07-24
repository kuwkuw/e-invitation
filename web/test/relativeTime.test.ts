import { describe, expect, it } from "vitest";
import { MANAGE } from "../src/i18n";
import { formatRelativeTime } from "../src/relativeTime";

const NOW = Date.parse("2026-08-10T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("formatRelativeTime", () => {
  it("covers the whole ladder in Ukrainian", () => {
    const uk = MANAGE.uk.time;
    expect(formatRelativeTime(ago(30_000), uk, NOW)).toBe("щойно");
    expect(formatRelativeTime(ago(5 * MIN), uk, NOW)).toBe("5 хв тому");
    expect(formatRelativeTime(ago(2 * HOUR), uk, NOW)).toBe("2 год тому");
    expect(formatRelativeTime(ago(DAY), uk, NOW)).toBe("вчора");
  });

  it("declines Ukrainian days, which is why plural forms are needed at all", () => {
    const uk = MANAGE.uk.time;
    expect(formatRelativeTime(ago(2 * DAY), uk, NOW)).toBe("2 дні тому");
    expect(formatRelativeTime(ago(6 * DAY), uk, NOW)).toBe("6 днів тому");
    // 11-14 take the "many" form despite ending in 1-4.
    expect(formatRelativeTime(ago(11 * DAY), uk, NOW)).toBe("11 днів тому");
    expect(formatRelativeTime(ago(21 * DAY), uk, NOW)).toBe("21 день тому");
  });

  it("reads naturally in English too", () => {
    const en = MANAGE.en.time;
    expect(formatRelativeTime(ago(5 * MIN), en, NOW)).toBe("5 min ago");
    expect(formatRelativeTime(ago(DAY), en, NOW)).toBe("yesterday");
    expect(formatRelativeTime(ago(3 * DAY), en, NOW)).toBe("3 days ago");
  });

  it("never renders NaN for a broken or future timestamp", () => {
    const uk = MANAGE.uk.time;
    expect(formatRelativeTime("not-a-date", uk, NOW)).toBe("щойно");
    expect(formatRelativeTime(new Date(NOW + HOUR).toISOString(), uk, NOW)).toBe("щойно");
  });
});
