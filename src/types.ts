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
  role?: Role;
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
  /** Epoch milliseconds of the scheduled start (from Firestore). Used to decide swap eligibility. */
  startAt?: number;
  /** Epoch milliseconds of the scheduled end (from Firestore). */
  endAt?: number;
  revision?: number;
  changedAfterPublish?: boolean;
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
  clockInAt?: number;
  clockOutAt?: number;
  status: AttendanceStatus;
  notes?: string;
};

export type SwapRequest = {
  id: string;
  fromEmployeeId: string;
  toEmployeeId: string;
  shiftId: string;
  shiftDate?: string;
  shiftStartAt?: number;
  shiftEndAt?: number;
  shiftLabel?: string;
  /** The colleague's shift they nominate to give in return (two-way swap); undefined = one-way. */
  receivedShiftId?: string;
  submitted: string;
  reason?: string;
  decisionReason?: string;
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
  type: "schedule" | "swap" | "swap_request" | "swap_update" | "announcement" | "attendance" | "reminder";
  unread: boolean;
  href?: "/(employee)/swap-inbox" | "/(employee)/(tabs)/schedule" | "/(employee)/(tabs)/updates";
  refId?: string;
};

/** A verified sign-up waiting for an administrator to approve it and assign a role. */
export type Registration = {
  id: string; // Firebase auth uid of the applicant
  email: string;
  name: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string; // display-formatted
  createdAtTs?: number;
};
