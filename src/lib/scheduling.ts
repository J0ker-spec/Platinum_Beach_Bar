/**
 * Pure scheduling helpers shared by the store and the screens.
 *
 * Everything here is free of React and Firestore so the rules that decide which shift an
 * employee may clock into, whether two shifts collide, which days a repeating shift covers,
 * and how an attendance row is labelled can be unit-tested directly.
 */
import type { AttendanceStatus, Shift } from "../types";

/** One minute of grace so a scan a few seconds after the start time is still "On time". */
export const LATE_GRACE_MS = 60_000;

/** Used when workplaceSettings/main has not been saved yet (the rules use the same defaults). */
export const DEFAULT_CLOCK_IN_EARLY_MINUTES = 15;
export const DEFAULT_CLOCK_IN_LATE_MINUTES = 120;

/** The minimum fields needed to decide whether two shifts collide. */
export type ShiftSpan = {
  id: string;
  employeeId: string;
  status: string;
  startAt?: number;
  endAt?: number;
  date?: string;
};

/**
 * A shift blocks another one when it belongs to the same employee, is not cancelled, and the
 * half-open intervals [start, end) intersect. Missing timestamps cannot be compared, so they
 * never count as a collision (the caller validates timestamps separately).
 */
export function findOverlappingShift<T extends ShiftSpan>(
  shifts: readonly T[],
  employeeId: string,
  startAt: number,
  endAt: number,
  excludedIds: readonly string[] = []
): T | undefined {
  return shifts.find(
    (shift) =>
      shift.employeeId === employeeId &&
      shift.status !== "Cancelled" &&
      !excludedIds.includes(shift.id) &&
      typeof shift.startAt === "number" &&
      typeof shift.endAt === "number" &&
      startAt < shift.endAt &&
      endAt > shift.startAt
  );
}

/** Throws a message naming the conflicting date when the employee is already booked. */
export function assertNoShiftOverlap<T extends ShiftSpan>(
  shifts: readonly T[],
  employeeId: string,
  startAt: number,
  endAt: number,
  excludedIds: readonly string[] = []
): void {
  const overlap = findOverlappingShift(shifts, employeeId, startAt, endAt, excludedIds);
  if (overlap) {
    throw new Error(
      overlap.date
        ? `This employee already has a shift that overlaps ${overlap.date}.`
        : "This employee already has a shift that overlaps the selected time."
    );
  }
}

/** Weekday (0 = Sunday … 6 = Saturday) of a yyyy-mm-dd date, independent of the device zone. */
export function weekdayOfIsoDate(dateIso: string): number {
  const [year, month, day] = dateIso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Number of minutes after midnight for an "h:mm AM/PM" time; NaN when it cannot be parsed. */
export function minutesOfDay(time: string): number {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return Number.NaN;
  const hour = Number(match[1]) % 12 + (match[3].toUpperCase() === "PM" ? 12 : 0);
  return hour * 60 + Number(match[2]);
}

export type ClockInWindow = { opensAt: number; closesAt: number };

/** Server-enforced clock-in window for a shift: [start − early, start + late]. */
export function clockInWindow(
  startAt: number,
  earlyMinutes = DEFAULT_CLOCK_IN_EARLY_MINUTES,
  lateMinutes = DEFAULT_CLOCK_IN_LATE_MINUTES
): ClockInWindow {
  return {
    opensAt: startAt - earlyMinutes * 60_000,
    closesAt: startAt + lateMinutes * 60_000,
  };
}

export function isWithinClockInWindow(
  startAt: number,
  now: number,
  earlyMinutes = DEFAULT_CLOCK_IN_EARLY_MINUTES,
  lateMinutes = DEFAULT_CLOCK_IN_LATE_MINUTES
): boolean {
  const window = clockInWindow(startAt, earlyMinutes, lateMinutes);
  return now >= window.opensAt && now <= window.closesAt;
}

export type ClockInCandidate = ShiftSpan & { date: string };

/**
 * Choose the shift an employee is clocking into today.
 *
 * Preference order:
 * 1. a published shift whose clock-in window currently contains `now` (earliest first),
 * 2. otherwise the next published shift that has not started yet,
 * 3. otherwise the latest published shift of the day.
 *
 * Shifts that already have an attendance record are skipped so a second scan on a day with two
 * shifts opens the other one instead of reporting a duplicate.
 */
export function pickShiftForClockIn<T extends ClockInCandidate>(
  shifts: readonly T[],
  employeeId: string,
  todayIso: string,
  now: number,
  options: {
    earlyMinutes?: number;
    lateMinutes?: number;
    recordedShiftIds?: readonly string[];
  } = {}
): T | undefined {
  const recorded = new Set(options.recordedShiftIds ?? []);
  const candidates = shifts.filter(
    (shift) =>
      shift.employeeId === employeeId &&
      (shift.status === "Published" || shift.status === "Updated") &&
      typeof shift.startAt === "number" &&
      !recorded.has(shift.id) &&
      // A shift that started late yesterday (overnight) still has an open clock-in window today.
      (shift.date === todayIso ||
        isWithinClockInWindow(shift.startAt, now, options.earlyMinutes, options.lateMinutes))
  );
  if (!candidates.length) return undefined;
  const byStart = [...candidates].sort((a, b) => (a.startAt as number) - (b.startAt as number));
  const open = byStart.find((shift) =>
    isWithinClockInWindow(shift.startAt as number, now, options.earlyMinutes, options.lateMinutes)
  );
  if (open) return open;
  const upcoming = byStart.find((shift) => (shift.startAt as number) > now);
  return upcoming ?? byStart[byStart.length - 1];
}

/** The open attendance record for an employee (clock-in without clock-out), newest first. */
export function pickOpenAttendance<T extends { id: string; employeeId: string; clockInAt?: number; clockOutAt?: number }>(
  records: readonly T[],
  employeeId: string
): T | undefined {
  return records
    .filter((record) => record.employeeId === employeeId && typeof record.clockInAt === "number" && typeof record.clockOutAt !== "number")
    .sort((a, b) => (b.clockInAt as number) - (a.clockInAt as number))[0];
}

/** True when a confirmed clock-in happened more than the grace period after the scheduled start. */
export function isLateClockIn(clockInAt: number | undefined, scheduledStartAt: number | undefined): boolean {
  if (typeof clockInAt !== "number" || typeof scheduledStartAt !== "number") return false;
  return clockInAt > scheduledStartAt + LATE_GRACE_MS;
}

export type AttendanceStatusRecord = {
  lastCorrectionId?: string;
  reviewStatus?: "confirmed" | "pending_review" | "rejected" | string;
  clockInAt?: number;
  clockOutAt?: number;
  late?: boolean;
};

/**
 * Derive the attendance badge shown in the admin and employee screens.
 *
 * `late` is stored by administrator corrections; when it was never set we fall back to comparing
 * the clock-in with the scheduled start so the "Late" filter and dashboard counters are accurate.
 */
export function attendanceStatus(
  record: AttendanceStatusRecord,
  shift: Pick<Shift, "startAt" | "endAt"> | undefined,
  now: number
): AttendanceStatus {
  if (record.lastCorrectionId) return "Corrected";
  if (record.reviewStatus === "pending_review") return "Incomplete";
  if (
    typeof record.clockInAt === "number" &&
    typeof record.clockOutAt !== "number" &&
    typeof shift?.endAt === "number" &&
    shift.endAt <= now
  ) {
    return "Incomplete";
  }
  if (record.reviewStatus === "confirmed") {
    if (record.late === true) return "Late";
    if (isLateClockIn(record.clockInAt, shift?.startAt)) return "Late";
    return "On time";
  }
  if (record.reviewStatus === "rejected") return "Late";
  return "Scheduled";
}
