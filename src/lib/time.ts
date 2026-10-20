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

/** Dates (yyyy-mm-dd) from `startIso` for `weeks` weeks, on the chosen weekdays (0=Sun..6=Sat). */
export function repeatDates(startIso: string, weeks: number, weekdays: number[]): string[] {
  const out: string[] = [];
  const start = new Date(`${startIso}T00:00:00`);
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (weekdays.includes(d.getDay())) {
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }
  }
  return out;
}
