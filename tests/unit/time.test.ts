import { describe, expect, it } from "vitest";
import {
  isValidIsoDate,
  isValidTimeZone,
  normalizeTime,
  repeatDates,
  repeatDatesForMonths,
  shiftInterval,
  workplaceDateTime,
  workplaceIsoDate,
} from "../../src/lib/time";

describe("normalizeTime", () => {
  it.each([["9", "9:00 AM"], ["930a", "9:30 AM"], ["14:30", "2:30 PM"], ["9:30 pm", "9:30 PM"], ["12am", "12:00 AM"], ["0:15", "12:15 AM"]])("%s -> %s", (i, o) =>
    expect(normalizeTime(i)).toBe(o));
  it.each(["", "25", "9:75", "13pm", "abc"])("rejects %s", (i) => expect(normalizeTime(i)).toBeNull());
});

describe("repeatDates", () => {
  it("lists chosen weekdays across weeks", () => {
    expect(repeatDates("2026-10-19", 2, [1, 3])).toEqual(["2026-10-19", "2026-10-21", "2026-10-26", "2026-10-28"]);
  });
});

describe("repeatDatesForMonths", () => {
  it("repeats selected weekdays until the matching calendar date next month", () => {
    expect(repeatDatesForMonths("2026-10-19", 1, [1])).toEqual([
      "2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16",
    ]);
  });

  it("clamps month-end dates and handles leap years", () => {
    expect(repeatDatesForMonths("2024-01-31", 1, [3])).toEqual([
      "2024-01-31", "2024-02-07", "2024-02-14", "2024-02-21", "2024-02-28",
    ]);
  });

  it("rejects durations outside one to twelve months", () => {
    expect(() => repeatDatesForMonths("2026-10-19", 0, [1])).toThrow("Invalid repeat schedule");
    expect(() => repeatDatesForMonths("2026-10-19", 13, [1])).toThrow("Invalid repeat schedule");
  });
});

describe("workplace date and time", () => {
  it("validates calendar dates instead of accepting normalized invalid dates", () => {
    expect(isValidIsoDate("2026-02-28")).toBe(true);
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("2026-2-03")).toBe(false);
  });

  it("converts workplace wall time independent of the device time zone", () => {
    expect(workplaceDateTime("2026-07-01", "9:00 AM", "America/New_York").toISOString())
      .toBe("2026-07-01T13:00:00.000Z");
    expect(workplaceIsoDate(new Date("2026-07-01T02:00:00.000Z"), "America/Los_Angeles"))
      .toBe("2026-06-30");
  });

  it("rejects a local time skipped by the daylight-saving transition", () => {
    expect(() => workplaceDateTime("2026-03-08", "2:30 AM", "America/New_York"))
      .toThrow("daylight-saving");
  });

  it("rejects an ambiguous local time repeated by the daylight-saving transition", () => {
    expect(() => workplaceDateTime("2026-11-01", "1:30 AM", "America/New_York"))
      .toThrow("occurs twice");
  });

  it("handles an overnight shift and enforces the maximum duration", () => {
    const interval = shiftInterval("2026-07-01", "10:00 PM", "6:00 AM", "America/New_York");
    expect(interval.endAt.getTime() - interval.startAt.getTime()).toBe(8 * 60 * 60 * 1000);
    expect(() => shiftInterval("2026-07-01", "9:00 AM", "9:00 AM", "UTC")).toThrow("equal start time");
  });

  it("rejects unknown IANA zones", () => {
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("Not/A_Timezone")).toBe(false);
  });
});
