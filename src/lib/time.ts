/** Parse free-form input ("9", "930a", "14:30", "9:30 pm") into the app's "h:mm AM/PM" form, or null. */
export function normalizeTime(input: string): string | null {
  const m = input.trim().toLowerCase().replace(/\./g, "").match(/^(\d{1,2})(?::?(\d{2}))?\s*(a|p|am|pm)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  if (min > 59) return null;
  let pm: boolean;
  if (m[3]) {
    if (h < 1 || h > 12) return null;
    pm = m[3].startsWith("p");
  } else {
    if (h > 23) return null;
    pm = h >= 12;
    h = h % 12 || 12;
  }
  return `${h}:${String(min).padStart(2, "0")} ${pm ? "PM" : "AM"}`;
}

const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const timePattern = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;

export function isValidIsoDate(value: string): boolean {
  const match = value.match(datePattern);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function parseTime(value: string): { hour: number; minute: number } {
  const match = value.trim().match(timePattern);
  if (!match) throw new Error("Enter a valid time.");
  const [, hourText, minuteText, meridiem] = match;
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (hour < 1 || hour > 12 || minute > 59) throw new Error("Enter a valid time.");
  return {
    hour: hour % 12 + (meridiem.toUpperCase() === "PM" ? 12 : 0),
    minute,
  };
}

function partsAt(date: Date, timeZone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)])
  );
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

/** Convert workplace wall time to an instant, rejecting invalid dates and DST-skipped times. */
export function workplaceDateTime(date: string, time: string, timeZone: string): Date {
  if (!isValidIsoDate(date)) throw new Error("Enter a valid shift date.");
  if (!isValidTimeZone(timeZone)) throw new Error("Set a valid workplace time zone before saving shifts.");
  const { hour, minute } = parseTime(time);
  const [year, month, day] = date.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let instant = target;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = partsAt(new Date(instant), timeZone);
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    const delta = target - represented;
    if (delta === 0) {
      const matchesRequestedTime = (candidate: Date) => {
        const candidateParts = partsAt(candidate, timeZone);
        return candidateParts.year === year &&
          candidateParts.month === month &&
          candidateParts.day === day &&
          candidateParts.hour === hour &&
          candidateParts.minute === minute;
      };
      for (let offset = 30; offset <= 180; offset += 30) {
        if (
          matchesRequestedTime(new Date(instant - offset * 60_000)) ||
          matchesRequestedTime(new Date(instant + offset * 60_000))
        ) {
          throw new Error("That local time occurs twice because of a daylight-saving clock change.");
        }
      }
      return new Date(instant);
    }
    instant += delta;
  }
  throw new Error("That local time does not exist because of a daylight-saving clock change.");
}

export function formatWorkplaceTime(date: Date | null | undefined, timeZone: string): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function workplaceIsoDate(date: Date, timeZone: string): string {
  const parts = partsAt(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function workplaceToday(timeZone: string): string {
  return workplaceIsoDate(new Date(), timeZone);
}

export function shiftInterval(date: string, start: string, end: string, timeZone: string): { startAt: Date; endAt: Date } {
  const startAt = workplaceDateTime(date, start, timeZone);
  const startParts = parseTime(start);
  const endParts = parseTime(end);
  if (endParts.hour === startParts.hour && endParts.minute === startParts.minute) {
    throw new Error("End time cannot equal start time.");
  }
  let endDate = date;
  if (endParts.hour * 60 + endParts.minute <= startParts.hour * 60 + startParts.minute) {
    const [year, month, day] = date.split("-").map(Number);
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    endDate = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
  }
  const endAt = workplaceDateTime(endDate, end, timeZone);
  const duration = endAt.getTime() - startAt.getTime();
  if (duration <= 0 || duration > 24 * 60 * 60 * 1000) {
    throw new Error("A shift must be longer than zero and no longer than 24 hours.");
  }
  return { startAt, endAt };
}

/** Dates (yyyy-mm-dd) from `startIso` for `weeks` weeks, on the chosen weekdays (0=Sun..6=Sat). */
export function repeatDates(startIso: string, weeks: number, weekdays: number[]): string[] {
  if (!isValidIsoDate(startIso) || !Number.isInteger(weeks) || weeks < 0 || !weekdays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)) {
    throw new Error("Invalid repeat schedule.");
  }
  const out: string[] = [];
  const [year, month, day] = startIso.split("-").map(Number);
  const start = new Date(year, month - 1, day);
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (weekdays.includes(d.getDay())) {
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }
  }
  return out;
}

/** Dates (yyyy-mm-dd) on the selected weekdays for a calendar-month duration from `startIso`. */
export function repeatDatesForMonths(startIso: string, months: number, weekdays: number[]): string[] {
  if (!isValidIsoDate(startIso) || !Number.isInteger(months) || months < 1 || months > 12
    || !weekdays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)) {
    throw new Error("Invalid repeat schedule.");
  }
  const [year, month, day] = startIso.split("-").map(Number);
  const endMonth = month - 1 + months;
  const endYear = year + Math.floor(endMonth / 12);
  const normalizedEndMonth = endMonth % 12;
  const endDay = Math.min(day, new Date(endYear, normalizedEndMonth + 1, 0).getDate());
  const end = new Date(endYear, normalizedEndMonth, endDay);
  const current = new Date(year, month - 1, day);
  const out: string[] = [];
  while (current < end) {
    if (weekdays.includes(current.getDay())) {
      out.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`);
    }
    current.setDate(current.getDate() + 1);
  }
  return out;
}
