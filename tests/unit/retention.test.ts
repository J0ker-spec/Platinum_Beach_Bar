import { describe, expect, it } from "vitest";
import { csvCell } from "../../src/lib/csv";
import { addCalendarMonths, exportReminder, isExpired, notificationExpiry } from "../../src/lib/retention";

const d = (s: string) => new Date(s);

describe("calendar-month retention", () => {
  it("is calendar months, not 150 days", () => {
    expect(notificationExpiry(d("2026-01-31T10:00:00Z")).toISOString()).toBe("2026-06-30T10:00:00.000Z");
    expect(notificationExpiry(d("2026-10-13T00:00:00Z")).toISOString()).toBe("2027-03-13T00:00:00.000Z");
  });
  it("clamps to the last day of short months and handles leap years", () => {
    expect(addCalendarMonths(d("2027-09-30T00:00:00Z"), 5).toISOString()).toBe("2028-02-29T00:00:00.000Z");
    expect(addCalendarMonths(d("2026-09-30T00:00:00Z"), 5).toISOString()).toBe("2027-02-28T00:00:00.000Z");
  });
  it("always lands in the 150..153 day range the security rules accept", () => {
    for (let i = 0; i < 730; i++) {
      const from = new Date(Date.UTC(2026, 0, 1) + i * 86_400_000);
      const days = (notificationExpiry(from).getTime() - from.getTime()) / 86_400_000;
      expect(days).toBeGreaterThanOrEqual(150);
      expect(days).toBeLessThanOrEqual(153);
    }
  });
  it("hides expired notifications logically", () => {
    expect(isExpired(d("2026-01-01T00:00:00Z"), d("2026-01-01T00:00:00Z"))).toBe(true);
    expect(isExpired(d("2026-01-02T00:00:00Z"), d("2026-01-01T00:00:00Z"))).toBe(false);
  });
});

describe("export reminders", () => {
  const now = d("2026-10-13T12:00:00Z");
  it("shows weekly reminder when never exported", () => {
    expect(exportReminder(null, null, now).level).toBe("weekly");
  });
  it("quiet after a recent export", () => {
    expect(exportReminder(d("2026-10-10T00:00:00Z"), d("2026-11-20T00:00:00Z"), now).level).toBe("none");
  });
  it("30-day, 7-day and overdue warnings escalate when export is stale", () => {
    const stale = d("2026-09-01T00:00:00Z");
    expect(exportReminder(stale, d("2026-11-05T00:00:00Z"), now).level).toBe("warn30");
    expect(exportReminder(stale, d("2026-10-18T00:00:00Z"), now).level).toBe("warn7");
    expect(exportReminder(stale, d("2026-10-01T00:00:00Z"), now).level).toBe("overdue");
  });
  it("does not warn about expiry if export is recent", () => {
    expect(exportReminder(d("2026-10-12T00:00:00Z"), d("2026-10-15T00:00:00Z"), now).level).toBe("none");
  });
});

describe("csv", () => {
  it("escapes quotes, commas, newlines and neutralises formulas", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell(null)).toBe("");
  });
});
