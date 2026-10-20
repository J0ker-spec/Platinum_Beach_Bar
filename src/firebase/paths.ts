// Collection names in one place so rules, indexes and code stay aligned.
export const C = {
  employees: "employees",
  authorizations: "employeeAuthorizations",
  registrations: "registrations",
  userLinks: "userLinks",
  directory: "directory",
  shifts: "shifts",
  attendance: "attendance",
  swaps: "shiftSwapRequests",
  announcements: "announcements",
  notifications: "notifications",
  settings: "workplaceSettings",
  qr: "qrCredentials",
  audit: "auditLogs",
  exportLogs: "exportLogs",
  meta: "systemMeta",
} as const;
