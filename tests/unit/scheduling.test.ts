import { describe, expect, it } from "vitest";
import {
  assertNoShiftOverlap,
  attendanceStatus,
  clockInWindow,
  findOverlappingShift,
  isLateClockIn,
  isWithinClockInWindow,
  pickOpenAttendance,
  pickShiftForClockIn,
  weekdayOfIsoDate,
} from "../../src/lib/scheduling";

const HOUR = 3_600_000;
const now = Date.UTC(2026, 9, 22, 12, 0, 0); // 2026-10-22 12:00 UTC

const shift = (over: Partial<{ id: string; employeeId: string; status: string; startAt: number; endAt: number; date: string }> = {}) => ({
  id: "s1",
  employeeId: "EMP-0002",
  status: "Published",
  startAt: now,
  endAt: now + 8 * HOUR,
  date: "2026-10-22",
  ...over,
});

describe("shift overlap", () => {
  it("detects overlapping intervals and allows back-to-back shifts", () => {
    expect(findOverlappingShift([shift()], "EMP-0002", now + HOUR, now + 2 * HOUR)?.id).toBe("s1");
    expect(findOverlappingShift([shift()], "EMP-0002", now + 8 * HOUR, now + 10 * HOUR)).toBeUndefined();
    expect(findOverlappingShift([shift()], "EMP-0002", now - 2 * HOUR, now)).toBeUndefined();
    expect(findOverlappingShift([shift()], "EMP-0002", now - HOUR, now + HOUR)?.id).toBe("s1");
  });

  it("ignores cancelled shifts, other employees, and explicitly excluded ids", () => {
    expect(findOverlappingShift([shift({ status: "Cancelled" })], "EMP-0002", now, now + HOUR)).toBeUndefined();
    expect(findOverlappingShift([shift()], "EMP-0003", now, now + HOUR)).toBeUndefined();
    expect(findOverlappingShift([shift()], "EMP-0002", now, now + HOUR, ["s1"])).toBeUndefined();
    expect(findOverlappingShift([shift({ startAt: undefined })], "EMP-0002", now, now + HOUR)).toBeUndefined();
  });

  it("throws a message naming the conflicting date", () => {
    expect(() => assertNoShiftOverlap([shift()], "EMP-0002", now, now + HOUR)).toThrow(/2026-10-22/);
    expect(() => assertNoShiftOverlap([], "EMP-0002", now, now + HOUR)).not.toThrow();
  });
});

describe("weekdayOfIsoDate", () => {
  it("is independent of the device time zone", () => {
    expect(weekdayOfIsoDate("2026-10-19")).toBe(1); // Monday
    expect(weekdayOfIsoDate("2026-10-25")).toBe(0); // Sunday
  });
});

describe("clock-in window", () => {
  it("opens early and closes late relative to the shift start", () => {
    const window = clockInWindow(now, 15, 120);
    expect(window.opensAt).toBe(now - 15 * 60_000);
    expect(window.closesAt).toBe(now + 120 * 60_000);
    expect(isWithinClockInWindow(now, now, 15, 120)).toBe(true);
    expect(isWithinClockInWindow(now, now - 16 * 60_000, 15, 120)).toBe(false);
    expect(isWithinClockInWindow(now, now + 121 * 60_000, 15, 120)).toBe(false);
  });

  it("uses the documented defaults", () => {
    const window = clockInWindow(now);
    expect(window.opensAt).toBe(now - 15 * 60_000);
    expect(window.closesAt).toBe(now + 120 * 60_000);
  });
});

describe("pickShiftForClockIn", () => {
  const earlier = shift({ id: "morning", startAt: now - 6 * HOUR, endAt: now - 2 * HOUR, date: "2026-10-22" });
  const current = shift({ id: "now", startAt: now - 5 * 60_000, endAt: now + 3 * HOUR, date: "2026-10-22" });
  const later = shift({ id: "evening", startAt: now + 4 * HOUR, endAt: now + 8 * HOUR, date: "2026-10-22" });

  it("prefers the shift whose window is open right now", () => {
    expect(pickShiftForClockIn([earlier, current, later], "EMP-0002", "2026-10-22", now)?.id).toBe("now");
  });

  it("skips a shift that already has an attendance record", () => {
    expect(
      pickShiftForClockIn([earlier, current, later], "EMP-0002", "2026-10-22", now, {
        recordedShiftIds: ["now"],
      })?.id
    ).toBe("evening");
  });

  it("falls back to the next shift when nothing is inside its window", () => {
    expect(pickShiftForClockIn([later], "EMP-0002", "2026-10-22", now)?.id).toBe("evening");
  });

  it("finds an overnight shift that started yesterday while its window is still open", () => {
    const overnight = shift({ id: "overnight", startAt: now - 10 * 60_000, endAt: now + 7 * HOUR, date: "2026-10-21" });
    expect(pickShiftForClockIn([overnight], "EMP-0002", "2026-10-22", now)?.id).toBe("overnight");
  });

  it("never returns a draft, cancelled, other-day, or other-employee shift", () => {
    expect(pickShiftForClockIn([shift({ status: "Draft", id: "draft" })], "EMP-0002", "2026-10-22", now)).toBeUndefined();
    expect(pickShiftForClockIn([shift({ status: "Cancelled" })], "EMP-0002", "2026-10-22", now)).toBeUndefined();
    expect(
      pickShiftForClockIn(
        [{ ...current, date: "2026-10-23", startAt: now + 5 * HOUR, endAt: now + 9 * HOUR }],
        "EMP-0002",
        "2026-10-22",
        now
      )
    ).toBeUndefined();
    expect(pickShiftForClockIn([current], "EMP-0003", "2026-10-22", now)).toBeUndefined();
  });
});

describe("pickOpenAttendance", () => {
  it("returns the newest record that has a clock-in but no clock-out", () => {
    const records = [
      { id: "old", employeeId: "EMP-0002", clockInAt: now - 8 * HOUR },
      { id: "closed", employeeId: "EMP-0002", clockInAt: now - 4 * HOUR, clockOutAt: now - 3 * HOUR },
      { id: "new", employeeId: "EMP-0002", clockInAt: now - 1 * HOUR },
      { id: "other", employeeId: "EMP-0003", clockInAt: now },
    ];
    expect(pickOpenAttendance(records, "EMP-0002")?.id).toBe("new");
    expect(pickOpenAttendance(records, "EMP-0009")).toBeUndefined();
  });
});

describe("attendanceStatus", () => {
  const scheduled = { startAt: now, endAt: now + 8 * HOUR };

  it("marks a confirmed on-time clock-in", () => {
    expect(
      attendanceStatus({ reviewStatus: "confirmed", clockInAt: now + 30_000, clockOutAt: now + 4 * HOUR }, scheduled, now + 5 * HOUR)
    ).toBe("On time");
  });

  it("marks a late clock-in once the grace period has passed", () => {
    expect(isLateClockIn(now + 5 * 60_000, now)).toBe(true);
    expect(
      attendanceStatus({ reviewStatus: "confirmed", clockInAt: now + 5 * 60_000, clockOutAt: now + 4 * HOUR }, scheduled, now + 5 * HOUR)
    ).toBe("Late");
  });

  it("honours an administrator late flag and corrections", () => {
    expect(attendanceStatus({ reviewStatus: "confirmed", late: true, clockInAt: now }, scheduled, now)).toBe("Late");
    expect(attendanceStatus({ reviewStatus: "confirmed", clockInAt: now, lastCorrectionId: "c1" }, scheduled, now)).toBe("Corrected");
  });

  it("reports pending review and missing clock-outs as incomplete", () => {
    expect(attendanceStatus({ reviewStatus: "pending_review", clockInAt: now }, scheduled, now + HOUR)).toBe("Incomplete");
    expect(attendanceStatus({ reviewStatus: "confirmed", clockInAt: now }, scheduled, now + 9 * HOUR)).toBe("Incomplete");
    expect(attendanceStatus({}, scheduled, now)).toBe("Scheduled");
  });
});
