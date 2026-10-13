/** Retention and export-reminder logic. Pure functions so they are unit-testable and independent of Firestore. */

export const NOTIFICATION_RETENTION_MONTHS = 5;
const DAY = 86_400_000;

/** Calendar-month arithmetic: Jan 31 + 1 month = Feb 28/29 (clamped), never "30 days". Uses UTC fields. */
export function addCalendarMonths(from: Date, months: number): Date {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth() + months;
  const targetYear = y + Math.floor(m / 12);
  const targetMonth = ((m % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(from.getUTCDate(), lastDay);
  return new Date(
    Date.UTC(targetYear, targetMonth, day, from.getUTCHours(), from.getUTCMinutes(), from.getUTCSeconds(), from.getUTCMilliseconds())
  );
}

export const notificationExpiry = (createdAt: Date) => addCalendarMonths(createdAt, NOTIFICATION_RETENTION_MONTHS);

/** Logical expiry: hide immediately, regardless of whether the document has been physically deleted. */
export const isExpired = (expiresAt: Date, now = new Date()) => expiresAt.getTime() <= now.getTime();

export type ReminderLevel = "none" | "weekly" | "warn30" | "warn7" | "overdue";
export type Reminder = { level: ReminderLevel; message: string; daysUntilExpiry: number | null; daysSinceExport: number | null };

/**
 * Decide which export reminder to show. Inputs are persistent facts (last export time, oldest notification expiry),
 * not another notification, so the reminder still works after notifications expire.
 * - lastExportAt: when the admin last confirmed saving an export (null = never)
 * - oldestNotificationExpiry: earliest expiresAt among existing notifications (null = none)
 */
export function exportReminder(
  lastExportAt: Date | null,
  oldestNotificationExpiry: Date | null,
  now = new Date()
): Reminder {
  const daysSinceExport = lastExportAt ? Math.floor((now.getTime() - lastExportAt.getTime()) / DAY) : null;
  const daysUntilExpiry = oldestNotificationExpiry ? Math.ceil((oldestNotificationExpiry.getTime() - now.getTime()) / DAY) : null;
  const exportStale = daysSinceExport === null || daysSinceExport >= 7;

  if (exportStale && daysUntilExpiry !== null && daysUntilExpiry <= 0) {
    return { level: "overdue", daysUntilExpiry, daysSinceExport, message: "Notification retention has passed and attendance has not been exported recently. Export and save a copy now." };
  }
  if (exportStale && daysUntilExpiry !== null && daysUntilExpiry <= 7) {
    return { level: "warn7", daysUntilExpiry, daysSinceExport, message: `Notifications start expiring in ${daysUntilExpiry} day(s). Export attendance now.` };
  }
  if (exportStale && daysUntilExpiry !== null && daysUntilExpiry <= 30) {
    return { level: "warn30", daysUntilExpiry, daysSinceExport, message: `Notifications start expiring in ${daysUntilExpiry} days. Plan an attendance export.` };
  }
  if (exportStale) {
    const since = daysSinceExport === null ? "never been exported" : `not been exported for ${daysSinceExport} days`;
    return { level: "weekly", daysUntilExpiry, daysSinceExport, message: `Attendance has ${since}. Weekly export recommended.` };
  }
  return { level: "none", daysUntilExpiry, daysSinceExport, message: "" };
}
