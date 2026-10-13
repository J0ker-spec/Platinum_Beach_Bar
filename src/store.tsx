import React, { createContext, useContext, useMemo, useState } from "react";
import {
  announcements as seedAnnouncements,
  attendance as seedAttendance,
  employees as seedEmployees,
  notifications as seedNotifications,
  shifts as seedShifts,
  swaps as seedSwaps,
} from "./data";
import type {
  Announcement,
  AppNotification,
  AttendanceRecord,
  Employee,
  Role,
  Shift,
  SwapRequest,
} from "./types";

type Snack = { message: string; tone?: "success" | "info" | "warning" } | null;

type Store = {
  role: Role | null;
  userId: string | null;
  employees: Employee[];
  shifts: Shift[];
  attendance: AttendanceRecord[];
  swaps: SwapRequest[];
  announcements: Announcement[];
  notifications: AppNotification[];
  clockedIn: boolean;
  lastClockIn?: string;
  scheduleStatus: "Draft" | "Published";
  qrLabel: string;
  snack: Snack;
  signIn: (role: Role) => void;
  signOut: () => void;
  setSnack: (snack: Snack) => void;
  setClockedIn: (value: boolean, time?: string) => void;
  updateSwap: (id: string, status: SwapRequest["status"]) => void;
  addSwap: (request: SwapRequest) => void;
  upsertEmployee: (employee: Employee) => void;
  addShift: (shift: Shift) => void;
  publishSchedule: () => void;
  publishAnnouncement: (item: Announcement) => void;
  saveAnnouncementDraft: (item: Announcement) => void;
  replaceQr: () => void;
  markNotificationsRead: () => void;
  correctAttendance: (id: string, clockIn: string, clockOut: string, reason: string) => void;
};

const Ctx = createContext<Store | null>(null);

export function PrototypeProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [employees, setEmployees] = useState(seedEmployees);
  const [shifts, setShifts] = useState(seedShifts);
  const [attendance, setAttendance] = useState(seedAttendance);
  const [swaps, setSwaps] = useState(seedSwaps);
  const [announcements, setAnnouncements] = useState(seedAnnouncements);
  const [notifications, setNotifications] = useState(seedNotifications);
  const [clockedIn, setClocked] = useState(false);
  const [lastClockIn, setLastClockIn] = useState<string>();
  const [scheduleStatus, setScheduleStatus] = useState<"Draft" | "Published">("Published");
  const [qrLabel, setQrLabel] = useState("Workplace attendance code");
  const [snack, setSnack] = useState<Snack>(null);

  const value = useMemo<Store>(
    () => ({
      role,
      userId,
      employees,
      shifts,
      attendance,
      swaps,
      announcements,
      notifications,
      clockedIn,
      lastClockIn,
      scheduleStatus,
      qrLabel,
      snack,
      signIn: (next) => {
        setRole(next);
        setUserId(next === "admin" ? "ADM-0001" : "EMP-0001");
      },
      signOut: () => {
        setRole(null);
        setUserId(null);
      },
      setSnack,
      setClockedIn: (value, time) => {
        setClocked(value);
        if (time) setLastClockIn(time);
      },
      updateSwap: (id, status) =>
        setSwaps((rows) => rows.map((row) => (row.id === id ? { ...row, status } : row))),
      addSwap: (request) => setSwaps((rows) => [request, ...rows]),
      upsertEmployee: (employee) =>
        setEmployees((rows) => {
          const index = rows.findIndex((row) => row.id === employee.id);
          if (index === -1) return [employee, ...rows];
          const next = [...rows];
          next[index] = employee;
          return next;
        }),
      addShift: (shift) => setShifts((rows) => [shift, ...rows]),
      publishSchedule: () => {
        setScheduleStatus("Published");
        setSnack({ message: "Schedule published", tone: "success" });
      },
      publishAnnouncement: (item) => {
        setAnnouncements((rows) => [item, ...rows]);
        setNotifications((rows) => [
          {
            id: `n-${Date.now()}`,
            title: item.priority === "Important" ? "Important announcement" : "New announcement",
            body: item.title,
            time: "Just now",
            type: "announcement",
            unread: true,
          },
          ...rows,
        ]);
        setSnack({ message: "Announcement published", tone: "success" });
      },
      saveAnnouncementDraft: (item) => {
        setAnnouncements((rows) => [item, ...rows]);
        setSnack({ message: "Draft saved", tone: "success" });
      },
      replaceQr: () => {
        setQrLabel("Replacement code preview");
        setSnack({ message: "QR code preview replaced", tone: "info" });
      },
      markNotificationsRead: () =>
        setNotifications((rows) => rows.map((row) => ({ ...row, unread: false }))),
      correctAttendance: (id, clockIn, clockOut, reason) => {
        setAttendance((rows) =>
          rows.map((row) =>
            row.id === id
              ? { ...row, clockIn, clockOut, status: "Corrected", notes: reason }
              : row
          )
        );
        setSnack({ message: "Attendance correction previewed", tone: "success" });
      },
    }),
    [
      role,
      userId,
      employees,
      shifts,
      attendance,
      swaps,
      announcements,
      notifications,
      clockedIn,
      lastClockIn,
      scheduleStatus,
      qrLabel,
      snack,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within PrototypeProvider");
  return ctx;
}
