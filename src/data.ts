// UI helpers shared by screens. There is NO seed/demo data here anymore: the app now reads
// everything from Firestore via src/store.tsx. These helpers only format values for display.

export type Nameable = { firstName?: string; lastName?: string; displayName?: string };

export function fullName(employee: Nameable | null | undefined): string {
  if (!employee) return "Unknown";
  if (employee.displayName) return employee.displayName;
  return `${employee.firstName ?? ""} ${employee.lastName ?? ""}`.trim() || "Unknown";
}

/** Standard initials for avatars, e.g. "Maya Chen" -> "MC". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}

const ACCENTS = ["#4F63E9", "#8061D9", "#3778D6", "#159A70", "#D99016", "#DC4C58", "#3647BD"];
/** Deterministic avatar accent from a stable id (e.g. an employee id). */
export function accentFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ACCENTS[Math.abs(h) % ACCENTS.length];
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Format a Date as "9:00 AM" in local device time (display only). */
export function formatTime(d: Date | null | undefined): string {
  if (!d) return "—";
  let hours = d.getHours();
  const minutes = pad(d.getMinutes());
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

/** ISO date (yyyy-mm-dd) in local time. */
export function isoDateOf(d: Date | null | undefined): string {
  if (!d) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
