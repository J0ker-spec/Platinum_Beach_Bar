import { useAuth } from "@/src/auth/AuthProvider";
import { weekDates } from "@/src/dates";
import { db } from "@/src/firebase/client";
import { C } from "@/src/firebase/paths";
import { encodeQr, newQrToken } from "@/src/lib/qr";
import { formatWorkplaceTime, isValidIsoDate, isValidTimeZone, shiftInterval, workplaceDateTime, workplaceIsoDate } from "@/src/lib/time";
import { accentFor, initials, isSwappableShift } from "@/src/data";
import { BUSINESS_NAME, WORKPLACE_ADDRESS } from "@/src/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  Announcement,
  AppNotification,
  AttendanceRecord,
  Employee,
  Registration,
  Role,
  Shift,
  SwapRequest,
} from "@/src/types";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  getDocs,
  where,
  writeBatch,
  Timestamp,
  deleteField,
  type Unsubscribe,
  type Query,
} from "firebase/firestore";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type Snack = { message: string; tone?: "success" | "info" | "warning" } | null;

const cap = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s ?? "");
const pad4 = (n: number) => String(n).padStart(4, "0");
const defaultWorkplaceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
type BusinessDetails = {
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  businessEmail: string;
};
type WorkplaceSettings = BusinessDetails & { timezone: string };
const defaultBusinessDetails: BusinessDetails = {
  businessName: BUSINESS_NAME,
  businessAddress: WORKPLACE_ADDRESS,
  businessPhone: "",
  businessEmail: "",
};
let liveWorkplaceTimeZone = defaultWorkplaceTimeZone;
// Module-level cache of the latest shifts, so attendance rows can be decorated with their
// scheduled times inside Firestore listener callbacks (which run outside React's scope).
let liveShiftsCache: Shift[] = [];
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const shiftStatusLabel = (s?: string) =>
  s === "cancelled" ? "Cancelled" : s === "updated" ? "Updated" : s === "published" ? "Published" : "Draft";

const swapStatusLabel = (s?: string) =>
  s === "pending_admin"
    ? "Awaiting approval"
    : s === "pending_peer"
      ? "Pending coworker"
      : s === "approved"
        ? "Approved"
        : s === "cancelled"
          ? "Cancelled"
          : "Declined";

function toEmployee(id: string, d: any): Employee {
  const name = (d.displayName || `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim()).trim();
  const parts = name.split(/\s+/);
  const firstName = d.firstName ?? (parts[0] ?? "");
  const lastName = d.lastName ?? (parts.length > 1 ? parts.slice(1).join(" ") : "");
  return {
    id,
    firstName,
    lastName,
    email: d.email ?? "",
    phone: d.phone ?? "",
    title: d.title ?? "",
    status: d.status === "active" ? "Active" : "Inactive",
    initials: initials(name || id),
    accent: accentFor(id),
    isAdmin: d.role === "admin",
    role: d.role === "admin" || d.role === "employee" ? d.role : undefined,
  };
}

function toShift(id: string, d: any): Shift {
  const startAt = d.startAt?.toDate ? d.startAt.toDate() : new Date(d.startAt ?? 0);
  const endAt = d.endAt?.toDate ? d.endAt.toDate() : new Date(d.endAt ?? 0);
  return {
    id,
    employeeId: d.employeeId ?? "",
    date: d.date ?? workplaceIsoDate(startAt, liveWorkplaceTimeZone),
    start: formatWorkplaceTime(startAt, liveWorkplaceTimeZone),
    end: formatWorkplaceTime(endAt, liveWorkplaceTimeZone),
    breakMinutes: d.breakMinutes ?? 0,
    label: d.label ?? "",
    location: d.notes ?? "",
    notes: d.notes ?? "",
    status: d.changedAfterPublish && d.status === "published" ? "Updated" : shiftStatusLabel(d.status),
    startAt: startAt.getTime(),
    endAt: endAt.getTime(),
    revision: d.revision ?? 1,
    changedAfterPublish: !!d.changedAfterPublish,
  };
}

function toSwap(id: string, d: any): SwapRequest {
  const created = d.createdAt?.toDate ? d.createdAt.toDate() : new Date();
  return {
    id,
    fromEmployeeId: d.fromEmployeeId ?? "",
    toEmployeeId: d.toEmployeeId ?? "",
    shiftId: d.shiftId ?? "",
    shiftDate: d.shiftDate,
    shiftStartAt: d.shiftStartAt?.toMillis ? d.shiftStartAt.toMillis() : undefined,
    shiftEndAt: d.shiftEndAt?.toMillis ? d.shiftEndAt.toMillis() : undefined,
    shiftLabel: d.shiftLabel,
    receivedShiftId: d.receivedShiftId ?? undefined,
    submitted: workplaceIsoDate(created, liveWorkplaceTimeZone),
    reason: d.reason ?? "",
    decisionReason: d.decisionReason ?? "",
    status: swapStatusLabel(d.status),
  };
}

function toAttendance(id: string, d: any): AttendanceRecord {
  const shift = liveShiftsCache.find((s) => s.id === d.shiftId);
  // A null timestamp means a server timestamp still pending locally: treat as "now".
  const clockIn = d.clockInAt?.toDate ? d.clockInAt.toDate() : undefined;
  const clockOut = d.clockOutAt?.toDate ? d.clockOutAt.toDate() : undefined;
  let status: AttendanceRecord["status"] = "Scheduled";
  if (d.lastCorrectionId) status = "Corrected";
  else if (d.reviewStatus === "pending_review" || (clockIn && !clockOut && shift?.endAt && shift.endAt <= Date.now())) status = "Incomplete";
  else if (d.reviewStatus === "confirmed") status = d.late ? "Late" : "On time";
  else if (d.reviewStatus === "rejected") status = "Late";
  return {
    id,
    employeeId: d.employeeId ?? "",
    date: d.shiftDate ?? (clockIn ? workplaceIsoDate(clockIn, liveWorkplaceTimeZone) : ""),
    shiftId: d.shiftId,
    scheduledStart: shift?.start ?? "",
    scheduledEnd: shift?.end ?? "",
    clockIn: formatWorkplaceTime(clockIn, liveWorkplaceTimeZone),
    clockOut: formatWorkplaceTime(clockOut, liveWorkplaceTimeZone),
    clockInAt: clockIn?.getTime(),
    clockOutAt: clockOut?.getTime(),
    status,
    notes: d.note ?? "",
  };
}
function toAnnouncement(id: string, d: any): Announcement {
  const published = d.publishedAt?.toDate ? d.publishedAt.toDate() : new Date(d.publishedAt ?? d.createdAt?.toDate?.() ?? new Date());
  return {
    id,
    title: d.title ?? "",
    excerpt: (d.body ?? "").slice(0, 100),
    body: d.body ?? "",
    publishedAt: d.status === "draft" || !d.publishedAt ? "Draft" : new Intl.DateTimeFormat(undefined, {
      month: "short", day: "numeric", hour: "numeric", minute: "numeric", timeZone: liveWorkplaceTimeZone,
    }).format(published),
    publisher: d.publishedBy ?? "Management",
    priority: d.priority === "important" ? "Important" : "Normal",
    status: d.status === "draft" ? "Draft" : "Published",
    audience: d.audience === "selected" ? "Selected employees" : "All employees",
    audienceIds: d.audienceIds ?? [],
    pinned: !!d.pinned,
    unread: false,
  };
}

/** Helper to build a rule-compliant notification expiresAt (5 calendar months ahead, 150..153 days). */
function expiresAtDays(days: number): Timestamp {
  return Timestamp.fromMillis(Date.now() + days * 86_400_000 + 1800_000);
}

function assertNoShiftOverlap(
  shifts: Shift[],
  employeeId: string,
  startAt: number,
  endAt: number,
  excludedIds: string[] = []
): void {
  const overlap = shifts.find(
    (shift) =>
      shift.employeeId === employeeId &&
      shift.status !== "Cancelled" &&
      !excludedIds.includes(shift.id) &&
      typeof shift.startAt === "number" &&
      typeof shift.endAt === "number" &&
      startAt < shift.endAt &&
      endAt > shift.startAt
  );
  if (overlap) {
    throw new Error(`This employee already has a shift that overlaps ${overlap.date}.`);
  }
}

type Store = {
  role: Role | null;
  userId: string | null;
  employees: Employee[];
  shifts: Shift[];
  attendance: AttendanceRecord[];
  swaps: SwapRequest[];
  announcements: Announcement[];
  notifications: AppNotification[];
  notificationPreferences: { schedule: boolean; announcements: boolean; swaps: boolean };
  registrations: Registration[];
  clockedIn: boolean;
  lastClockIn?: string;
  qrLabel: string;
  /** Admin only: the live QR payload (null until a code has been created). */
  qrPayload: string | null;
  snack: Snack;
  /** Non-null when one of the Firestore listeners failed (e.g. missing index / rules). */
  listenerError: string | null;
  workplaceTimezone: string;
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  businessEmail: string;
  /** Re-subscribes all Firestore listeners after a listener error. */
  retry: () => void;
  saveWorkplaceSettings: (settings: WorkplaceSettings) => Promise<void>;
  getEmployee: (id: string) => Employee | undefined;
  signIn: (role: Role) => void;
  signOut: () => void;
  setSnack: (snack: Snack) => void;
  saveNotificationPreferences: (preferences: { schedule: boolean; announcements: boolean; swaps: boolean }) => Promise<void>;
  setClockedIn: (value: boolean, time?: string) => void;
  upsertEmployee: (employee: Employee) => Promise<void>;
  addShift: (shift: Shift) => Promise<void>;
  addShifts: (shifts: Shift[]) => Promise<void>;
  updateShift: (shift: Shift) => Promise<void>;
  deleteShift: (id: string) => Promise<"deleted" | "cancelled">;
  publishSchedule: (startDate: string, endDate: string, intendedShifts: { id: string; revision?: number }[]) => Promise<void>;
  publishAnnouncement: (item: Announcement) => Promise<void>;
  saveAnnouncementDraft: (item: Announcement) => Promise<void>;
  replaceQr: () => Promise<void>;
  markNotificationsRead: () => Promise<void>;
  correctAttendance: (id: string, clockIn: string, clockOut: string, reason: string) => Promise<void>;
  updateSwap: (id: string, status: SwapRequest["status"], declineReason?: string) => Promise<void>;
  respondToSwap: (id: string, accept: boolean, receivedShiftId?: string) => Promise<void>;
  addSwap: (request: SwapRequest) => Promise<void>;
  cancelSwap: (id: string) => Promise<void>;
  clockIn: (shiftId: string, qrProof: string) => Promise<void>;
  clockOut: (qrProof: string) => Promise<void>;
  approveRegistration: (uid: string, role: Role, title: string) => Promise<void>;
  rejectRegistration: (uid: string) => Promise<void>;
  setEmployeeRole: (id: string, role: Role) => Promise<void>;
};
const Ctx = createContext<Store | null>(null);

export function PrototypeProvider({ children }: { children: React.ReactNode }) {
  const { profile, signOut: authSignOut } = useAuth();
  const role = profile?.role ?? null;
  const myId = profile?.id ?? null;
  const isAdmin = role === "admin";

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationPreferences, setNotificationPreferences] = useState({
    schedule: true,
    announcements: true,
    swaps: true,
  });
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [clockedIn, setClocked] = useState(false);
  const [lastClockIn, setLastClockIn] = useState<string>();
  const [qrLabel, setQrLabel] = useState("Workplace attendance code");
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [snack, setSnack] = useState<Snack>(null);
  const [listenerError, setListenerError] = useState<string | null>(null);
  const [workplaceTimezone, setWorkplaceTimezone] = useState(defaultWorkplaceTimeZone);
  const [businessDetails, setBusinessDetails] = useState(defaultBusinessDetails);
  const [retryKey, setRetryKey] = useState(0);
  const retry = useCallback(() => setRetryKey((k) => k + 1), []);

  useEffect(() => {
    if (!profile?.id) {
      setNotificationPreferences({ schedule: true, announcements: true, swaps: true });
      return;
    }
    const defaults = { schedule: true, announcements: true, swaps: true };
    let active = true;
    let migrationStarted = false;
    const restoreLegacyPreferences = async () => {
      try {
        const stored = await AsyncStorage.getItem(`notification-preferences:${profile.id}`);
        if (!active || !stored) return;
        const parsed: unknown = JSON.parse(stored);
        if (!parsed || typeof parsed !== "object") throw new Error("Saved preferences are invalid.");
        const values = parsed as Record<string, unknown>;
        await setDoc(doc(db, C.employees, profile.id, "notificationPreferences", "current"), {
          schedule: typeof values.schedule === "boolean" ? values.schedule : defaults.schedule,
          announcements: typeof values.announcements === "boolean" ? values.announcements : defaults.announcements,
          swaps: typeof values.swaps === "boolean" ? values.swaps : defaults.swaps,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        console.warn("Could not migrate saved notification preferences:", error);
        if (active) setListenerError("Saved notification preferences couldn't be migrated.");
      }
    };
    setNotificationPreferences(defaults);
    const unsubscribe = onSnapshot(
      doc(db, C.employees, profile.id, "notificationPreferences", "current"),
      (snapshot) => {
        if (!snapshot.exists()) {
          setNotificationPreferences(defaults);
          if (!migrationStarted) {
            migrationStarted = true;
            void restoreLegacyPreferences();
          }
          return;
        }
        const saved = snapshot.data();
        setNotificationPreferences({
          schedule: typeof saved?.schedule === "boolean" ? saved.schedule : true,
          announcements: typeof saved?.announcements === "boolean" ? saved.announcements : true,
          swaps: typeof saved?.swaps === "boolean" ? saved.swaps : true,
        });
      },
      (error) => {
        console.warn("Notification preference listener error:", error.code, error.message);
        setListenerError("Notification preferences couldn't be loaded. Check your connection or retry.");
      }
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [profile?.id]);

  useEffect(() => {
    if (!isAdmin || !employees.length) return;
    let active = true;
    getDocs(collection(db, C.directory))
      .then(async (snapshot) => {
        if (!active) return;
        const repairs = snapshot.docs.flatMap((directoryDoc) => {
          const employee = employees.find((item) => item.id === directoryDoc.id);
          const roleValue = employee?.isAdmin ? "admin" : "employee";
          return employee && directoryDoc.get("role") !== roleValue
            ? [{ ref: directoryDoc.ref, role: roleValue }]
            : [];
        });
        for (let i = 0; i < repairs.length; i += 400) {
          const batch = writeBatch(db);
          repairs.slice(i, i + 400).forEach(({ ref, role: roleValue }) => batch.update(ref, { role: roleValue }));
          await batch.commit();
        }
      })
      .catch((error: unknown) => {
        console.warn("Could not synchronize colleague roles:", error);
        if (active) setSnack({ message: "Admin labels couldn't be refreshed. Retry your connection.", tone: "warning" });
      });
    return () => {
      active = false;
    };
  }, [isAdmin, employees]);

  // Keep the module-level shift cache current so attendance mapping can read scheduled times.
  useEffect(() => {
    liveShiftsCache = shifts;
    setAttendance((rows) =>
      rows.map((row) => {
        const shift = shifts.find((item) => item.id === row.shiftId);
        return shift
          ? { ...row, scheduledStart: shift.start, scheduledEnd: shift.end }
          : row;
      })
    );
  }, [shifts]);

  useEffect(() => {
    liveWorkplaceTimeZone = workplaceTimezone;
    setShifts((rows) =>
      rows.map((shift) => ({
        ...shift,
        start: typeof shift.startAt === "number" ? formatWorkplaceTime(new Date(shift.startAt), workplaceTimezone) : shift.start,
        end: typeof shift.endAt === "number" ? formatWorkplaceTime(new Date(shift.endAt), workplaceTimezone) : shift.end,
      }))
    );
    setAttendance((rows) =>
      rows.map((row) => ({
        ...row,
        clockIn: typeof row.clockInAt === "number" ? formatWorkplaceTime(new Date(row.clockInAt), workplaceTimezone) : "—",
        clockOut: typeof row.clockOutAt === "number" ? formatWorkplaceTime(new Date(row.clockOutAt), workplaceTimezone) : "—",
      }))
    );
  }, [workplaceTimezone]);

  // --------------------------------------------------------------- data listeners
  useEffect(() => {
    if (!profile) {
      setEmployees([]);
      setShifts([]);
      setAttendance([]);
      setSwaps([]);
      setAnnouncements([]);
      setNotifications([]);
      setRegistrations([]);
      setQrToken(null);
      setListenerError(null);
      liveWorkplaceTimeZone = defaultWorkplaceTimeZone;
      setWorkplaceTimezone(defaultWorkplaceTimeZone);
      setBusinessDetails(defaultBusinessDetails);
      return;
    }
    const unsubs: Unsubscribe[] = [];
    unsubs.push(
      onSnapshot(
        doc(db, C.settings, "main"),
        (snapshot) => {
          const saved = snapshot.data() ?? {};
          const configured = saved.timezone;
          const timeZone = typeof configured === "string" ? configured : defaultWorkplaceTimeZone;
          if (!isValidTimeZone(timeZone)) {
            setListenerError("The saved workplace time zone is invalid. An administrator must correct it.");
            return;
          }
          setBusinessDetails({
            businessName: typeof saved.businessName === "string" ? saved.businessName : defaultBusinessDetails.businessName,
            businessAddress: typeof saved.businessAddress === "string" ? saved.businessAddress : defaultBusinessDetails.businessAddress,
            businessPhone: typeof saved.businessPhone === "string" ? saved.businessPhone : defaultBusinessDetails.businessPhone,
            businessEmail: typeof saved.businessEmail === "string" ? saved.businessEmail : defaultBusinessDetails.businessEmail,
          });
          liveWorkplaceTimeZone = timeZone;
          setWorkplaceTimezone(timeZone);
        },
        (error) => {
          console.warn("Workplace settings listener error:", error.code, error.message);
          setListenerError("Workplace settings couldn't load. Check your connection or retry.");
        }
      )
    );
    // Merge one query's results into a state list by id; removed docs (e.g. an approved
    // registration) are dropped so the UI never shows stale rows.
    const sub = <T extends { id: string }>(
      q: Query,
      set: React.Dispatch<React.SetStateAction<T[]>>,
      map: (id: string, d: any) => T
    ) => {
      unsubs.push(
        onSnapshot(
          q,
          (snap) => {
            setListenerError(null);
            set((rows) => {
              const gone = new Set<string>();
              const upd = new Map<string, T>();
              snap.docChanges().forEach((c) => {
                if (c.type === "removed") gone.add(c.doc.id);
                else upd.set(c.doc.id, map(c.doc.id, c.doc.data()));
              });
              const kept = rows.filter((r) => !gone.has(r.id) && !upd.has(r.id));
              return [...kept, ...upd.values()];
            });
          },
          (e) => {
            console.warn("Firestore listener error:", e.code, e.message);
            setListenerError(
              e.code === "failed-precondition" || /index/i.test(e.message)
                ? "Some data couldn't load — a database index may be missing."
                : "Some data couldn't load. Check your connection or retry."
            );
          }
        )
      );
    };
    const mapNotification = (id: string, d: any): AppNotification => {
      const created = d.createdAt?.toDate ? d.createdAt.toDate() : new Date();
      const notificationType = d.type ?? "announcement";
      const swapRequest = notificationType === "swap_request";
      const swapUpdateBody = notificationType === "swap_update"
        ? d.title?.toLowerCase().includes("accepted")
          ? "Your coworker accepted the request. It is awaiting administrator approval."
          : d.title?.toLowerCase().includes("declined")
            ? "The swap request was declined."
            : d.title?.toLowerCase().includes("approved")
              ? "The shift swap was approved and the schedule has been updated."
              : d.title?.toLowerCase().includes("cancelled")
                ? "The requester cancelled the swap."
                : "Your shift-swap request status changed."
        : "";
      return {
        id,
        title: d.title ?? "",
        body: swapRequest
          ? "Tap to review and accept or decline this shift swap."
          : notificationType === "swap_update"
            ? swapUpdateBody
            : d.body ?? "",
        time: new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short", timeZone: liveWorkplaceTimeZone }).format(created),
        type: notificationType,
        unread: d.read !== true,
        href: swapRequest
          ? "/(employee)/swap-inbox"
          : notificationType === "swap_update"
            ? "/(employee)/(tabs)/schedule"
            : notificationType === "schedule" || notificationType === "reminder"
              ? "/(employee)/(tabs)/schedule"
              : notificationType === "announcement"
                ? "/(employee)/(tabs)/updates"
                : undefined,
        refId: d.refId,
      };
    };

    if (isAdmin) {
      unsubs.push(onSnapshot(doc(db, C.qr, "current"), (s) => setQrToken((s.data()?.token as string) ?? null), () => undefined));
      sub(query(collection(db, C.employees)), setEmployees, toEmployee);
      sub(query(collection(db, C.shifts)), setShifts, toShift);
      sub(query(collection(db, C.attendance)), setAttendance, toAttendance);
      sub(query(collection(db, C.swaps)), setSwaps, toSwap);
      sub(query(collection(db, C.announcements)), setAnnouncements, toAnnouncement);
      unsubs.push(
        onSnapshot(
          query(collection(db, C.registrations)),
          (snap) => {
            const list: Registration[] = snap.docs
              .map((dDoc) => {
                const d = dDoc.data();
                const created = d.createdAt?.toDate ? d.createdAt.toDate() : new Date();
                return {
                  id: dDoc.id,
                  email: d.email ?? "",
                  name: d.name ?? "",
                  status: d.status ?? "pending",
                  createdAt: created.toLocaleString(),
                  createdAtTs: created.getTime(),
                };
              })
              .filter((r) => !r.status || r.status.toLowerCase() === "pending");
            setRegistrations(list);
          },
          (e) => console.warn("Firestore registrations listener error:", e.code, e.message)
        )
      );
    } else if (myId) {
      sub(query(collection(db, C.directory)), setEmployees, toEmployee);
      // Employees may only read their own PUBLISHED shifts (see firestore.rules). The query must
      // constrain status too, otherwise the read rule is not provably satisfied and Firestore
      // rejects the whole query with "Missing or insufficient permissions".
      sub(query(collection(db, C.shifts), where("employeeId", "==", myId), where("status", "==", "published")), setShifts, toShift);
      sub(query(collection(db, C.attendance), where("employeeId", "==", myId)), setAttendance, toAttendance);
      // Swaps the employee is party to (two queries merged).
      sub(query(collection(db, C.swaps), where("fromEmployeeId", "==", myId)), setSwaps, toSwap);
      sub(query(collection(db, C.swaps), where("toEmployeeId", "==", myId)), setSwaps, toSwap);
      // Published announcements for this employee (public + targeted).
      sub(query(collection(db, C.announcements), where("status", "==", "published"), where("audience", "==", "all")), setAnnouncements, toAnnouncement);
      sub(query(collection(db, C.announcements), where("status", "==", "published"), where("audienceIds", "array-contains", myId)), setAnnouncements, toAnnouncement);
      sub(query(collection(db, C.notifications), where("recipientId", "==", myId)), setNotifications, mapNotification);
    }

    return () => unsubs.forEach((u) => u());
  }, [isAdmin, myId, profile, retryKey]);

  // Reset transient clock state whenever the signed-in identity changes.
  useEffect(() => {
    setClocked(false);
    setLastClockIn(undefined);
  }, [myId]);

// ---------------------------------------------------------------- write helpers
  const upsertEmployee = useCallback(
    async (employee: Employee) => {
      if (!myId) return;
      const email = employee.email.trim().toLowerCase();
      if (employees.some((e) => e.id === employee.id)) {
        // Edit existing employee (name/title/phone/status) + synced directory doc.
        const batch = writeBatch(db);
        batch.update(doc(db, C.employees, employee.id), {
          firstName: employee.firstName,
          lastName: employee.lastName,
          title: employee.title,
          phone: employee.phone,
          status: employee.status === "Active" ? "active" : "deactivated",
          updatedAt: serverTimestamp(),
        });
        batch.update(doc(db, C.directory, employee.id), {
          displayName: `${employee.firstName} ${employee.lastName}`.trim(),
          title: employee.title,
          status: employee.status === "Active" ? "active" : "deactivated",
          role: employee.isAdmin ? "admin" : "employee",
        });
        await batch.commit();
        return;
      }
      // Create: sequential id per systemMeta/counters, plus the paired directory + authorization
      // docs the rules require. Uses a transaction so two concurrent admins cannot collide.
      await runTransaction(db, async (tx) => {
        const counterRef = doc(db, C.meta, "counters");
        const counterSnap = await tx.get(counterRef);
        const seq = (counterSnap.data()?.employeeSeq as number) ?? 1;
        const id = `EMP-${pad4(seq + 1)}`;
        tx.set(doc(db, C.employees, id), {
          firstName: employee.firstName,
          lastName: employee.lastName,
          email,
          phone: employee.phone,
          title: employee.title,
          role: "employee",
          status: "active",
          createdBy: myId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        tx.set(doc(db, C.directory, id), {
          displayName: `${employee.firstName} ${employee.lastName}`.trim(),
          title: employee.title,
          status: "active",
          role: "employee",
        });
        tx.set(doc(db, C.authorizations, email), {
          employeeId: id,
          claimedByUid: null,
          createdBy: myId,
          createdAt: serverTimestamp(),
        });
        tx.update(counterRef, { employeeSeq: seq + 1 });
      });
    },
    [employees, myId]
  );

  const addShifts = useCallback(async (list: Shift[]) => {
    if (!myId) throw new Error("Sign in is required to create shifts.");
    const pending: Shift[] = [];
    for (const shift of list) {
      if (!employees.some((employee) => employee.id === shift.employeeId && employee.status === "Active")) {
        throw new Error("Choose an active employee for every shift.");
      }
      if (!Number.isInteger(shift.breakMinutes) || shift.breakMinutes < 0 || shift.breakMinutes > 240) {
        throw new Error("Breaks must be between 0 and 240 minutes.");
      }
      const { startAt, endAt } = shiftInterval(shift.date, shift.start, shift.end, workplaceTimezone);
      if (shift.breakMinutes * 60_000 >= endAt.getTime() - startAt.getTime()) {
        throw new Error("The break must be shorter than the shift.");
      }
      assertNoShiftOverlap(shifts, shift.employeeId, startAt.getTime(), endAt.getTime());
      assertNoShiftOverlap(pending, shift.employeeId, startAt.getTime(), endAt.getTime());
      pending.push({ ...shift, startAt: startAt.getTime(), endAt: endAt.getTime() });
    }
    for (let i = 0; i < list.length; i += 400) {
      const batch = writeBatch(db);
      for (const shift of list.slice(i, i + 400)) {
        const { startAt, endAt } = shiftInterval(shift.date, shift.start, shift.end, workplaceTimezone);
        batch.set(doc(collection(db, C.shifts)), {
          employeeId: shift.employeeId,
          date: shift.date,
          startAt,
          endAt,
          breakMinutes: shift.breakMinutes,
          label: shift.label,
          notes: shift.notes ?? "",
          status: "draft",
          createdBy: myId ?? "",
          updatedBy: myId ?? "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          revision: 1,
          changedAfterPublish: false,
        });
      }
      await batch.commit();
    }
  }, [employees, myId, shifts, workplaceTimezone]);
  const addShift = useCallback((shift: Shift) => addShifts([shift]), [addShifts]);

  const updateShift = useCallback(async (shift: Shift) => {
    if (!myId) throw new Error("Sign in is required to edit a shift.");
    const current = shifts.find((item) => item.id === shift.id);
    if (!current) throw new Error("The shift is no longer available.");
    if (!employees.some((employee) => employee.id === shift.employeeId && employee.status === "Active")) {
      throw new Error("Choose an active employee for the shift.");
    }
    if (!Number.isInteger(shift.breakMinutes) || shift.breakMinutes < 0 || shift.breakMinutes > 240) {
      throw new Error("Breaks must be between 0 and 240 minutes.");
    }
    const { startAt, endAt } = shiftInterval(shift.date, shift.start, shift.end, workplaceTimezone);
    if (shift.breakMinutes * 60_000 >= endAt.getTime() - startAt.getTime()) {
      throw new Error("The break must be shorter than the shift.");
    }
    assertNoShiftOverlap(shifts, shift.employeeId, startAt.getTime(), endAt.getTime(), [shift.id]);
    const relatedAttendance = await getDocs(query(collection(db, C.attendance), where("shiftId", "==", shift.id)));
    if (relatedAttendance.size) {
      throw new Error("This shift has attendance records and can't be edited without changing its history.");
    }
    const batch = writeBatch(db);
    batch.update(doc(db, C.shifts, shift.id), {
      employeeId: shift.employeeId,
      date: shift.date,
      startAt,
      endAt,
      breakMinutes: shift.breakMinutes,
      label: shift.label,
      notes: shift.notes ?? "",
      status: current.status === "Cancelled" ? "cancelled" : current.status === "Draft" ? "draft" : "published",
      updatedBy: myId,
      updatedAt: serverTimestamp(),
      revision: (current.revision ?? 1) + 1,
      changedAfterPublish: current.changedAfterPublish || current.status === "Published" || current.status === "Updated",
    });
    if (current.status === "Published" || current.status === "Updated") {
      const recipients = new Set([current.employeeId, shift.employeeId]);
      for (const recipientId of recipients) {
        batch.set(doc(collection(db, C.notifications)), {
          recipientId,
          type: "schedule",
          title: "Your schedule was updated",
          refType: "shift",
          refId: shift.id,
          read: false,
          createdBy: myId,
          createdAt: serverTimestamp(),
          expiresAt: expiresAtDays(151),
        });
      }
    }
    await batch.commit();
  }, [employees, myId, shifts, workplaceTimezone]);

  const deleteShift = useCallback(async (id: string): Promise<"deleted" | "cancelled"> => {
    if (!myId) throw new Error("Sign in is required to remove a shift.");
    const shiftRef = doc(db, C.shifts, id);
    const shiftSnap = await getDoc(shiftRef);
    if (!shiftSnap.exists()) throw new Error("This shift is no longer available.");
    const shift = toShift(shiftSnap.id, shiftSnap.data());
    const relatedAttendance = await getDocs(query(collection(db, C.attendance), where("shiftId", "==", id)));
    if (relatedAttendance.size) {
      throw new Error("This shift has attendance records and can't be removed.");
    }
    if (shift.status === "Cancelled") throw new Error("This shift is already cancelled.");
    if (shift.status === "Draft") {
      await deleteDoc(shiftRef);
      return "deleted";
    }
    const batch = writeBatch(db);
    batch.update(shiftRef, {
      status: "cancelled",
      updatedBy: myId,
      updatedAt: serverTimestamp(),
      revision: (shift.revision ?? 1) + 1,
      changedAfterPublish: true,
    });
    batch.set(doc(collection(db, C.notifications)), {
      recipientId: shift.employeeId,
      type: "schedule",
      title: "A shift was cancelled",
      refType: "shift",
      refId: id,
      read: false,
      createdBy: myId,
      createdAt: serverTimestamp(),
      expiresAt: expiresAtDays(151),
    });
    await batch.commit();
    return "cancelled";
  }, [myId]);

  const publishSchedule = useCallback(async (startDate: string, endDate: string, intendedShifts: { id: string; revision?: number }[]) => {
    if (!myId) throw new Error("Sign in is required to publish the schedule.");
    if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate)) throw new Error("Choose a valid schedule week.");
    const week = weekDates(new Date(`${startDate}T12:00:00`));
    if (week[0] !== startDate || week[6] !== endDate) throw new Error("Select a Monday-through-Sunday week.");
    const ids = [...new Set(intendedShifts.map((shift) => shift.id))];
    if (!ids.length || ids.length !== intendedShifts.length) throw new Error("Select the draft shifts shown in the preview.");
    const freshWeek = await getDocs(query(
      collection(db, C.shifts),
      where("date", ">=", startDate),
      where("date", "<=", endDate)
    ));
    const currentDrafts = new Map(
      freshWeek.docs
        .map((snapshot) => toShift(snapshot.id, snapshot.data()))
        .filter((shift) => shift.status === "Draft")
        .map((shift) => [shift.id, shift])
    );
    const drafts = intendedShifts.map((intended) => currentDrafts.get(intended.id));
    if (drafts.some((shift, index) => !shift || shift.revision !== intendedShifts[index].revision)) {
      throw new Error("One or more previewed shifts changed. Refresh the schedule and review the week again.");
    }
    const selectedDrafts = drafts.filter((shift): shift is Shift => !!shift);
    if (!selectedDrafts.length) throw new Error("There are no draft shifts in the selected week.");
    const publishSet = [...shifts.filter((shift) => !ids.includes(shift.id)), ...selectedDrafts];
    for (const shift of selectedDrafts) {
      if (typeof shift.startAt !== "number" || typeof shift.endAt !== "number") {
        throw new Error("A shift is missing valid schedule times and cannot be published.");
      }
      assertNoShiftOverlap(publishSet, shift.employeeId, shift.startAt, shift.endAt, [shift.id]);
    }
    const shiftsPerBatch = 15;
    const batchesPerWave = 10;
    for (let i = 0; i < selectedDrafts.length; i += shiftsPerBatch * batchesPerWave) {
      const commits: Promise<void>[] = [];
      for (let j = i; j < Math.min(i + shiftsPerBatch * batchesPerWave, selectedDrafts.length); j += shiftsPerBatch) {
        const batch = writeBatch(db);
        for (const shift of selectedDrafts.slice(j, j + shiftsPerBatch)) {
          batch.update(doc(db, C.shifts, shift.id), {
            status: "published",
            updatedBy: myId,
            updatedAt: serverTimestamp(),
            revision: (shift.revision ?? 1) + 1,
          });
        }
        commits.push(batch.commit());
      }
      const outcomes = await Promise.allSettled(commits);
      if (outcomes.some((outcome) => outcome.status === "rejected")) {
        throw new Error("Some shifts may have published. Refresh the schedule before retrying.");
      }
    }
    const recipients = [...new Set(selectedDrafts.map((shift) => shift.employeeId))];
    try {
      const notificationBatchSize = 450;
      for (let i = 0; i < recipients.length; i += notificationBatchSize * batchesPerWave) {
        const commits: Promise<void>[] = [];
        for (let j = i; j < Math.min(i + notificationBatchSize * batchesPerWave, recipients.length); j += notificationBatchSize) {
          const batch = writeBatch(db);
          recipients.slice(j, j + notificationBatchSize).forEach((recipientId) => {
            batch.set(doc(collection(db, C.notifications)), {
              recipientId,
              type: "schedule",
              title: "Your schedule is ready",
              refType: "schedule",
              refId: `${startDate}_${endDate}`,
              read: false,
              createdBy: myId,
              createdAt: serverTimestamp(),
              expiresAt: expiresAtDays(151),
            });
          });
          commits.push(batch.commit());
        }
        const outcomes = await Promise.allSettled(commits);
        if (outcomes.some((outcome) => outcome.status === "rejected")) {
          throw new Error("Some notifications failed to save.");
        }
      }
    } catch (error) {
      console.warn("Schedule published, but notification fan-out was incomplete:", error);
      setSnack({ message: "Schedule published, but some notifications couldn't be sent.", tone: "warning" });
      return;
    }
    setSnack({ message: `Published ${selectedDrafts.length} shifts for ${startDate}–${endDate}`, tone: "success" });
  }, [myId, shifts]);
const publishAnnouncement = useCallback(
    async (item: Announcement) => {
      if (!myId) throw new Error("Sign in is required to publish announcements.");
      const annRef = doc(collection(db, C.announcements));
      const audience: "all" | "selected" = item.audience === "Selected employees" ? "selected" : "all";
      const audienceIds = audience === "selected" ? (item.audienceIds ?? []) : [];
      const recipients = audience === "all" ? employees.filter((e) => e.status === "Active").map((e) => e.id) : audienceIds;
      const batch = writeBatch(db);
      batch.set(annRef, {
        title: item.title,
        body: item.body,
        priority: item.priority === "Important" ? "important" : "normal",
        status: "published",
        audience,
        audienceIds,
        publishedBy: myId,
        createdAt: serverTimestamp(),
        publishedAt: serverTimestamp(),
      });
      const createNotification = (recipientId: string) => ({
        recipientId,
        type: "announcement",
        title: `${item.priority === "Important" ? "Important: " : "Announcement: "}${item.title}`.slice(0, 120),
        refType: "announcement",
        refId: annRef.id,
        read: false,
        createdBy: myId,
        createdAt: serverTimestamp(),
        expiresAt: expiresAtDays(151),
      });
      // Keep commits below Firestore's 500-write limit, including the announcement itself.
      recipients.slice(0, 449).forEach((recipientId) => {
        batch.set(doc(collection(db, C.notifications)), createNotification(recipientId));
      });
      await batch.commit();
      const notificationCommits: Promise<void>[] = [];
      for (let i = 449; i < recipients.length; i += 450) {
        const notificationBatch = writeBatch(db);
        recipients.slice(i, i + 450).forEach((recipientId) => {
          notificationBatch.set(doc(collection(db, C.notifications)), createNotification(recipientId));
        });
        notificationCommits.push(notificationBatch.commit());
      }
      const notificationResults = await Promise.allSettled(notificationCommits);
      if (notificationResults.some((result) => result.status === "rejected")) {
        const failures = notificationResults.filter((result) => result.status === "rejected");
        console.warn("Announcement published, but notification delivery was incomplete:", failures);
        setSnack({ message: "Announcement published, but some notifications couldn't be sent.", tone: "warning" });
        return;
      }
      setSnack({ message: "Announcement published", tone: "success" });
    },
    [myId, employees]
  );

  const saveAnnouncementDraft = useCallback(async (item: Announcement) => {
    await addDoc(collection(db, C.announcements), {
      title: item.title,
      body: item.body,
      priority: item.priority === "Important" ? "important" : "normal",
      status: "draft",
      audience: item.audience === "Selected employees" ? "selected" : "all",
      audienceIds: item.audience === "Selected employees" ? (item.audienceIds ?? []) : [],
      publishedBy: myId ?? "",
      createdAt: serverTimestamp(),
      publishedAt: serverTimestamp(),
    });
    setSnack({ message: "Draft saved", tone: "success" });
  }, [myId]);

  const replaceQr = useCallback(async () => {
    if (!myId) return;
    const ref = doc(db, C.qr, "current");
    const snap = await getDoc(ref);
    const token = newQrToken();
    if (snap.exists()) {
      await updateDoc(ref, { token, version: ((snap.data().version as number) ?? 0) + 1, rotatedBy: myId, rotatedAt: serverTimestamp() });
    } else {
      await setDoc(ref, { token, version: 1, rotatedBy: myId, rotatedAt: serverTimestamp() });
    }
    setQrLabel("Replacement code preview");
    setSnack({ message: snap.exists() ? "QR code replaced" : "QR code created", tone: "info" });
  }, [myId]);

  const markNotificationsRead = useCallback(async () => {
    const unread = notifications.filter((n) => n.unread).map((n) => n.id);
    const batch = writeBatch(db);
    for (const id of unread) batch.update(doc(db, C.notifications, id), { read: true });
    if (unread.length) await batch.commit();
  }, [notifications]);

  const correctAttendance = useCallback(
    async (id: string, clockIn: string, clockOut: string, reason: string) => {
      if (!myId) throw new Error("Sign in is required to correct attendance.");
      if (!reason.trim()) throw new Error("A correction reason is required.");
      const attRef = doc(db, C.attendance, id);
      const snap = await getDoc(attRef);
      if (!snap.exists()) throw new Error("This attendance record is no longer available.");
      const current = snap.data();
      const shiftDate = current.shiftDate as string;
      const parseCorrectionTime = (value: string): Date | undefined => {
        const trimmed = value.trim();
        if (!trimmed || trimmed === "—") return undefined;
        return workplaceDateTime(shiftDate, trimmed, workplaceTimezone);
      };
      const correctedIn = parseCorrectionTime(clockIn);
      let correctedOut = parseCorrectionTime(clockOut);
      if (!correctedIn && correctedOut) throw new Error("Clock-in is required when a clock-out time is recorded.");
      if (correctedIn && correctedOut && correctedOut <= correctedIn) {
        const nextDay = new Date(`${shiftDate}T12:00:00Z`);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        const nextDate = `${nextDay.getUTCFullYear()}-${String(nextDay.getUTCMonth() + 1).padStart(2, "0")}-${String(nextDay.getUTCDate()).padStart(2, "0")}`;
        correctedOut = workplaceDateTime(nextDate, clockOut.trim(), workplaceTimezone);
      }
      if (correctedIn && correctedOut && correctedOut <= correctedIn) {
        throw new Error("Clock-out must be later than clock-in.");
      }
      const correctionId = `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const reviewStatus = correctedIn
        ? current.reviewStatus === "pending_review"
          ? "confirmed"
          : current.reviewStatus === "rejected"
            ? "pending_review"
            : "confirmed"
        : "pending_review";
      const updated = {
        clockInAt: correctedIn ?? null,
        clockOutAt: correctedOut ?? null,
        reviewStatus,
        late: current.late === true,
      };
      const batch = writeBatch(db);
      batch.set(doc(db, C.attendance, id, "corrections", correctionId), {
        adminId: myId,
        changedAt: serverTimestamp(),
        original: {
          clockInAt: current.clockInAt ?? null,
          clockOutAt: current.clockOutAt ?? null,
          reviewStatus: current.reviewStatus,
          late: current.late ?? false,
        },
        updated,
        note: reason.trim().slice(0, 500),
      });
      batch.update(attRef, {
        clockInAt: correctedIn ?? deleteField(),
        clockOutAt: correctedOut ?? deleteField(),
        reviewStatus,
        lastCorrectionId: correctionId,
      });
      await batch.commit();
      setSnack({ message: "Attendance correction saved", tone: "success" });
    },
    [myId, workplaceTimezone]
  );
const addSwap = useCallback(
    async (request: SwapRequest) => {
    if (!myId) throw new Error("Sign in is required to request a shift swap.");
    if (request.toEmployeeId === myId || !employees.some((employee) => employee.id === request.toEmployeeId && employee.status === "Active")) {
      throw new Error("Choose an active coworker.");
    }
    if (swaps.some((swap) => swap.shiftId === request.shiftId && ["Pending coworker", "Awaiting approval"].includes(swap.status))) {
      throw new Error("This shift already has a pending swap request.");
    }
    const shiftSnapshot = await getDoc(doc(db, C.shifts, request.shiftId));
    const offeredShift = shiftSnapshot.data();
    if (
      !offeredShift ||
      offeredShift.employeeId !== myId ||
      offeredShift.status !== "published" ||
      offeredShift.startAt.toMillis() <= Date.now()
    ) {
      throw new Error("That shift is no longer available to swap.");
    }
    const swapRef = doc(collection(db, C.swaps));
    const batch = writeBatch(db);
    batch.set(swapRef, {
        fromEmployeeId: myId,
        toEmployeeId: request.toEmployeeId,
        shiftId: request.shiftId,
        shiftDate: offeredShift.date,
        shiftStartAt: offeredShift.startAt,
        shiftEndAt: offeredShift.endAt,
        shiftLabel: offeredShift.label,
        reason: request.reason ?? "",
        status: "pending_peer",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(collection(db, C.notifications)), {
        recipientId: request.toEmployeeId,
        type: "swap_request",
        title: "New shift swap request",
        refType: "swap",
        refId: swapRef.id,
        read: false,
        createdBy: myId,
        createdAt: serverTimestamp(),
        expiresAt: expiresAtDays(151),
      });
      await batch.commit();
      setSnack({ message: "Swap request submitted", tone: "success" });
    },
    [employees, myId, swaps]
  );

  // The colleague accepts (pending_peer -> pending_admin) or declines (pending_peer -> declined).
  // When accepting, they may optionally nominate one of their OWN published shifts to give in
  // return (two-way swap) — validated by the security rules.
  const respondToSwap = useCallback(
    async (id: string, accept: boolean, receivedShiftId?: string) => {
      if (!myId) throw new Error("Sign in is required to respond to a swap request.");
      const ref = doc(db, C.swaps, id);
      const snap = await getDoc(ref);
      const d = snap.data();
      if (!d || d.status !== "pending_peer" || d.toEmployeeId !== myId) {
        throw new Error("This swap request is no longer available.");
      }
      if (accept) {
        const shiftSnapshot = await getDoc(doc(db, C.shifts, d.shiftId));
        const offeredShift = shiftSnapshot.data();
        const offeredStart = d.shiftStartAt?.toMillis?.();
        const offeredEnd = d.shiftEndAt?.toMillis?.();
        if (
          !offeredShift ||
          offeredShift.employeeId !== d.fromEmployeeId ||
          offeredShift.status !== "published" ||
          !offeredStart ||
          !offeredEnd ||
          offeredStart <= Date.now()
        ) {
          throw new Error("This shift can no longer be swapped.");
        }
        const returnShift = receivedShiftId ? shifts.find((shift) => shift.id === receivedShiftId) : undefined;
        if (receivedShiftId && (!returnShift || returnShift.employeeId !== myId || !isSwappableShift(returnShift))) {
          throw new Error("The shift offered in return is no longer available.");
        }
        assertNoShiftOverlap(shifts, myId, offeredStart, offeredEnd, receivedShiftId ? [receivedShiftId] : []);
      }
      const batch = writeBatch(db);
      batch.update(ref, {
        status: accept ? "pending_admin" : "declined",
        ...(accept && receivedShiftId ? { receivedShiftId } : {}),
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(collection(db, C.notifications)), {
        recipientId: d.fromEmployeeId,
        type: "swap_update",
        title: accept ? "Coworker accepted your swap request" : "Coworker declined your swap request",
        refType: "swap",
        refId: id,
        read: false,
        createdBy: myId,
        createdAt: serverTimestamp(),
        expiresAt: expiresAtDays(151),
      });
      await batch.commit();
    },
    [myId, shifts]
  );

  // Admin approves / rejects. Approval moves the shift to the colleague in the SAME atomic batch.
  const updateSwap = useCallback(
    async (id: string, status: SwapRequest["status"], declineReason?: string) => {
      if (!myId) throw new Error("Sign in is required to review swap requests.");
      if (status !== "Approved" && status !== "Declined") throw new Error("Choose approve or decline.");
      const ref = doc(db, C.swaps, id);
      const snap = await getDoc(ref);
      const d = snap.data();
      if (!d || d.status !== "pending_admin") throw new Error("This swap request is no longer awaiting approval.");
      if (status === "Approved") {
        const shiftRef = doc(db, C.shifts, d.shiftId);
        const shiftSnap = await getDoc(shiftRef);
        const shiftData = shiftSnap.data();
        const startsAt = shiftData?.startAt?.toMillis?.();
        const endsAt = shiftData?.endAt?.toMillis?.();
        if (!shiftData || shiftData.employeeId !== d.fromEmployeeId || shiftData.status !== "published" || !startsAt || !endsAt || startsAt <= Date.now()) {
          throw new Error("The offered shift is no longer available to approve.");
        }
        const fromShiftsSnapshot = await getDocs(query(collection(db, C.shifts), where("employeeId", "==", d.fromEmployeeId)));
        const toShiftsSnapshot = await getDocs(query(collection(db, C.shifts), where("employeeId", "==", d.toEmployeeId)));
        const fromShifts = fromShiftsSnapshot.docs.map((item) => toShift(item.id, item.data()));
        const toShifts = toShiftsSnapshot.docs.map((item) => toShift(item.id, item.data()));
        const movedShiftIds = [d.shiftId, ...(d.receivedShiftId ? [d.receivedShiftId] : [])];
        assertNoShiftOverlap(toShifts, d.toEmployeeId, startsAt, endsAt, movedShiftIds);
        const rev = (shiftSnap.data()?.revision as number) ?? 1;
        const batch = writeBatch(db);
        batch.update(ref, { status: "approved", decidedBy: myId, updatedAt: serverTimestamp() });
        batch.update(shiftRef, {
          employeeId: d.toEmployeeId,
          updatedBy: myId,
          updatedAt: serverTimestamp(),
          revision: rev + 1,
          changedAfterPublish: true,
        });
        // Two-way swap: the colleague's nominated shift moves back to the requester in the same batch.
        if (d.receivedShiftId && d.receivedShiftId !== d.shiftId) {
          const recvRef = doc(db, C.shifts, d.receivedShiftId);
          const recvSnap = await getDoc(recvRef);
          const returnData = recvSnap.data();
          const returnStart = returnData?.startAt?.toMillis?.();
          const returnEnd = returnData?.endAt?.toMillis?.();
          if (!returnData || returnData.employeeId !== d.toEmployeeId || returnData.status !== "published" || !returnStart || !returnEnd || returnStart <= Date.now()) {
            throw new Error("The coworker's return shift is no longer available to approve.");
          }
          assertNoShiftOverlap(fromShifts, d.fromEmployeeId, returnStart, returnEnd, movedShiftIds);
          const rev2 = (returnData.revision as number) ?? 1;
          batch.update(recvRef, {
            employeeId: d.fromEmployeeId,
            updatedBy: myId,
            updatedAt: serverTimestamp(),
            revision: rev2 + 1,
            changedAfterPublish: true,
          });
        }
        for (const recipientId of new Set([d.fromEmployeeId, d.toEmployeeId])) {
          batch.set(doc(collection(db, C.notifications)), {
            recipientId,
            type: "swap_update",
            title: "Swap approved",
            refType: "swap",
            refId: id,
            read: false,
            createdBy: myId,
            createdAt: serverTimestamp(),
            expiresAt: expiresAtDays(151),
          });
        }
        await batch.commit();
      } else {
        const reason = declineReason?.trim().slice(0, 500);
        const batch = writeBatch(db);
        batch.update(ref, {
          status: "declined",
          decidedBy: myId,
          updatedAt: serverTimestamp(),
          ...(reason ? { decisionReason: reason } : {}),
        });
        for (const recipientId of new Set([d.fromEmployeeId, d.toEmployeeId])) {
          batch.set(doc(collection(db, C.notifications)), {
            recipientId,
            type: "swap_update",
            title: "Swap declined",
            refType: "swap",
            refId: id,
            read: false,
            createdBy: myId,
            createdAt: serverTimestamp(),
            expiresAt: expiresAtDays(151),
          });
        }
        await batch.commit();
      }
      setSnack({ message: status === "Approved" ? "Swap approved" : "Swap declined", tone: "info" });
    },
    [myId]
  );
  const cancelSwap = useCallback(async (id: string) => {
    if (!myId) throw new Error("Sign in is required to cancel a swap request.");
    const ref = doc(db, C.swaps, id);
    const snap = await getDoc(ref);
    const request = snap.data();
    if (!request || request.fromEmployeeId !== myId || !["pending_peer", "pending_admin"].includes(request.status)) {
      throw new Error("This swap request can no longer be cancelled.");
    }
    const recipientId = request.toEmployeeId as string;
    const batch = writeBatch(db);
    batch.update(ref, { status: "cancelled", updatedAt: serverTimestamp() });
    batch.set(doc(collection(db, C.notifications)), {
      recipientId,
      type: "swap_update",
      title: "A coworker cancelled their swap request",
      refType: "swap",
      refId: id,
      read: false,
      createdBy: myId,
      createdAt: serverTimestamp(),
      expiresAt: expiresAtDays(151),
    });
    await batch.commit();
  }, [myId]);
  // ---- registrations: a verified sign-up waits here until an admin approves it ----------------
  // Approval creates the employee + directory + authorization docs atomically and removes the
  // registration; the applicant's next identity check then finds the authorization and links them.
  const approveRegistration = useCallback(
    async (uid: string, newRole: Role, title: string) => {
      if (!myId) return;
      const reg = registrations.find((r) => r.id === uid);
      if (!reg) return;
      const email = reg.email.trim().toLowerCase();
      const parts = reg.name.trim().split(/\s+/);
      const firstName = parts[0] || email.split("@")[0];
      const lastName = parts.slice(1).join(" ");
      await runTransaction(db, async (tx) => {
        const counterRef = doc(db, C.meta, "counters");
        const counterSnap = await tx.get(counterRef);
        const seq = (counterSnap.data()?.employeeSeq as number) ?? 1;
        const id = `EMP-${pad4(seq + 1)}`;
        tx.set(doc(db, C.employees, id), {
          firstName,
          lastName,
          email,
          phone: "",
          title,
          role: newRole,
          status: "active",
          createdBy: myId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        tx.set(doc(db, C.directory, id), { displayName: reg.name.trim() || email, title, status: "active", role: newRole });
        tx.set(doc(db, C.authorizations, email), { employeeId: id, claimedByUid: null, createdBy: myId, createdAt: serverTimestamp() });
        tx.update(counterRef, { employeeSeq: seq + 1 });
        tx.delete(doc(db, C.registrations, uid));
      });
      setSnack({ message: `${reg.name || reg.email} approved`, tone: "success" });
    },
    [myId, registrations]
  );

  const rejectRegistration = useCallback(async (uid: string) => {
    await deleteDoc(doc(db, C.registrations, uid));
    setSnack({ message: "Registration rejected", tone: "info" });
  }, []);

  // Promote an employee to admin (or demote). Rules forbid changing your own role.
  const setEmployeeRole = useCallback(
    async (id: string, newRole: Role) => {
      if (!myId || id === myId) return;
      const batch = writeBatch(db);
      batch.update(doc(db, C.employees, id), { role: newRole, updatedAt: serverTimestamp() });
      batch.update(doc(db, C.directory, id), { role: newRole });
      await batch.commit();
      setSnack({ message: newRole === "admin" ? "Promoted to admin" : "Changed to employee", tone: "success" });
    },
    [myId]
  );

  // ---- attendance (employee) ------------------------------------------------------------------
  const actionId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;

  const clockIn = useCallback(
    async (shiftId: string, qrProof: string) => {
      if (!myId) return;
      if (attendance.some((a) => a.id === `${myId}_${shiftId}`)) throw new Error("duplicate");
      const shift = shifts.find((s) => s.id === shiftId);
      await setDoc(doc(db, C.attendance, `${myId}_${shiftId}`), {
        employeeId: myId,
        shiftId,
        shiftDate: shift?.date ?? workplaceIsoDate(new Date(), workplaceTimezone),
        clockInAt: serverTimestamp(),
        clockInReportedAt: Timestamp.now(),
        clockInSource: "online",
        clockInActionId: actionId(),
        qrProof,
        reviewStatus: "confirmed",
        late: false,
      });
      setClocked(true);
      setLastClockIn(formatWorkplaceTime(new Date(), workplaceTimezone));
    },
    [myId, shifts, attendance, workplaceTimezone]
  );

  const clockOut = useCallback(
    async (qrProof: string) => {
      if (!myId) return;
      const open = attendance.find((a) => a.employeeId === myId && a.clockIn !== "—" && a.clockOut === "—");
      if (!open) throw new Error("orphan");
      await updateDoc(doc(db, C.attendance, open.id), {
        clockOutAt: serverTimestamp(),
        clockOutReportedAt: Timestamp.now(),
        clockOutSource: "online",
        clockOutActionId: actionId(),
        clockOutProof: qrProof,
      });
      setClocked(false);
    },
    [myId, attendance]
  );

  const getEmployee = useCallback(
    (id: string) =>
      employees.find((e) => e.id === id) ??
      (profile && profile.id === id ? toEmployee(id, { ...profile, role: profile.role }) : undefined),
    [employees, profile]
  );
  const setClockedIn = useCallback((v: boolean, time?: string) => {
    setClocked(v);
    if (time) setLastClockIn(time);
  }, []);
  const saveNotificationPreferences = useCallback(async (preferences: typeof notificationPreferences) => {
    if (!myId) throw new Error("Sign in is required to save notification preferences.");
    const previous = notificationPreferences;
    setNotificationPreferences(preferences);
    try {
      await setDoc(doc(db, C.employees, myId, "notificationPreferences", "current"), {
        ...preferences,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      setNotificationPreferences(previous);
      throw error;
    }
  }, [myId, notificationPreferences]);
  const saveWorkplaceSettings = useCallback(async (settings: WorkplaceSettings) => {
    if (!myId || role !== "admin") throw new Error("Administrator access is required to update workplace settings.");
    const next = {
      businessName: settings.businessName.trim(),
      businessAddress: settings.businessAddress.trim(),
      businessPhone: settings.businessPhone.trim(),
      businessEmail: settings.businessEmail.trim(),
      timezone: settings.timezone.trim(),
    };
    if (!next.businessName || next.businessName.length > 120) throw new Error("Enter a business name up to 120 characters.");
    if (next.businessAddress.length > 300) throw new Error("Business address must be 300 characters or fewer.");
    if (next.businessPhone.length > 32) throw new Error("Business phone must be 32 characters or fewer.");
    if (next.businessEmail.length > 254) throw new Error("Business email must be 254 characters or fewer.");
    if (next.businessEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.businessEmail)) throw new Error("Enter a valid business email address.");
    if (!isValidTimeZone(next.timezone)) throw new Error("Enter a valid IANA time zone, such as America/New_York.");
    if (next.timezone !== workplaceTimezone) {
      const [shiftSnapshot, attendanceSnapshot] = await Promise.all([
        getDocs(collection(db, C.shifts)),
        getDocs(collection(db, C.attendance)),
      ]);
      if (shiftSnapshot.size > 0 || attendanceSnapshot.size > 0) {
        throw new Error("The workplace time zone cannot be changed after shifts or attendance exist because saved times use it.");
      }
    }
    const settingsRef = doc(db, C.settings, "main");
    const snapshot = await getDoc(settingsRef);
    const saved = snapshot.data() ?? {};
    await setDoc(settingsRef, {
      ...next,
      clockInEarlyMinutes: Number.isInteger(saved.clockInEarlyMinutes) ? saved.clockInEarlyMinutes : 15,
      clockInLateMinutes: Number.isInteger(saved.clockInLateMinutes) ? saved.clockInLateMinutes : 120,
      updatedBy: myId,
      updatedAt: serverTimestamp(),
    });
    liveWorkplaceTimeZone = next.timezone;
    setWorkplaceTimezone(next.timezone);
    setBusinessDetails({
      businessName: next.businessName,
      businessAddress: next.businessAddress,
      businessPhone: next.businessPhone,
      businessEmail: next.businessEmail,
    });
  }, [myId, role, workplaceTimezone]);

  const value = useMemo<Store>(
    () => ({
      role,
      userId: myId,
      employees,
      shifts,
      attendance,
      swaps,
      announcements,
      notifications,
      notificationPreferences,
      registrations,
      clockedIn: clockedIn || (!!myId && attendance.some((a) => a.employeeId === myId && a.clockIn !== "—" && a.clockOut === "—")),
      lastClockIn,
      qrLabel,
      qrPayload: qrToken ? encodeQr(qrToken) : null,
      snack,
      listenerError,
      workplaceTimezone,
      ...businessDetails,
      retry,
      saveWorkplaceSettings,
      getEmployee,
      signIn: () => undefined, // real sign-in lives in AuthProvider
      signOut: () => void authSignOut(),
      setSnack,
      saveNotificationPreferences,
      setClockedIn,
      upsertEmployee,
      addShift,
      addShifts,
      updateShift,
      deleteShift,
      publishSchedule,
      publishAnnouncement,
      saveAnnouncementDraft,
      replaceQr,
      markNotificationsRead,
      correctAttendance,
      updateSwap,
      respondToSwap,
      addSwap,
      cancelSwap,
      clockIn,
      clockOut,
      approveRegistration,
      rejectRegistration,
      setEmployeeRole,
    }),
    [role, myId, employees, shifts, attendance, swaps, announcements, notifications, notificationPreferences, registrations, clockedIn, lastClockIn, qrLabel, qrToken, snack, listenerError, workplaceTimezone, businessDetails, retry, saveWorkplaceSettings, getEmployee, setClockedIn, saveNotificationPreferences, upsertEmployee, addShift, addShifts, updateShift, deleteShift, publishSchedule, publishAnnouncement, saveAnnouncementDraft, replaceQr, markNotificationsRead, correctAttendance, updateSwap, respondToSwap, addSwap, cancelSwap, clockIn, clockOut, approveRegistration, rejectRegistration, setEmployeeRole, authSignOut]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within PrototypeProvider");
  return ctx;
}
