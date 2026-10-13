export type Role = "employee" | "admin";

export type EmploymentStatus = "Active" | "Inactive";

export type ShiftStatus = "Published" | "Draft" | "Updated" | "Cancelled";

export type AttendanceStatus = "On time" | "Late" | "Incomplete" | "Corrected" | "Scheduled";

export type SwapStatus =
  | "Pending coworker"
  | "Awaiting approval"
  | "Approved"
  | "Declined"
  | "Cancelled"
  | "Unavailable";

export type AnnouncementPriority = "Normal" | "Important";
export type AnnouncementStatus = "Published" | "Draft";

export type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  status: EmploymentStatus;
  initials: string;
  accent: string;
  isAdmin?: boolean;
};

export type Shift = {
  id: string;
  employeeId: string;
  date: string;
  start: string;
  end: string;
  breakMinutes: number;
  label: string;
  location: string;
  notes?: string;
  status: ShiftStatus;
};

export type AttendanceRecord = {
  id: string;
  employeeId: string;
  date: string;
  shiftId?: string;
  scheduledStart: string;
  scheduledEnd: string;
  clockIn?: string;
  clockOut?: string;
  status: AttendanceStatus;
  notes?: string;
};

export type SwapRequest = {
  id: string;
  fromEmployeeId: string;
  toEmployeeId: string;
  shiftId: string;
  submitted: string;
  reason?: string;
  status: SwapStatus;
};

export type Announcement = {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  publishedAt: string;
  publisher: string;
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  audience: "All employees" | "Selected employees";
  audienceIds?: string[];
  pinned?: boolean;
  unread?: boolean;
};

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  time: string;
  type: "schedule" | "swap" | "announcement" | "attendance" | "reminder";
  unread: boolean;
  href?: string;
};
