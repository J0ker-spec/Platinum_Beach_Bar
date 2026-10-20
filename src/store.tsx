import { useAuth } from "@/src/auth/AuthProvider";
import { db } from "@/src/firebase/client";
import { C } from "@/src/firebase/paths";
import { encodeQr, newQrToken } from "@/src/lib/qr";
import { accentFor, formatTime, initials, isoDateOf } from "@/src/data";
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
  where,
  writeBatch,
  Timestamp,
  type Unsubscribe,
  type Query,
} from "firebase/firestore";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type Snack = { message: string; tone?: "success" | "info" | "warning" } | null;

const cap = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s ?? "");
const pad4 = (n: number) => String(n).padStart(4, "0");
// Module-level cache of the latest shifts, so attendance rows can be decorated with their
// scheduled times inside Firestore listener callbacks (which run outside React's scope).
let liveShiftsCache: Shift[] = [];
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Parse a shift time string like "9:00 AM" on a given isoDate (yyyy-mm-dd). */
function timeToDate(date: string, time: string): Date {
  const m = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return new Date(`${date}T09:00:00`);
  let h = parseInt(m[1], 10) % 12;
  if (m[3].toUpperCase() === "PM") h += 12;
  const d = new Date(`${date}T00:00:00`);
  d.setHours(h, parseInt(m[2], 10), 0, 0);
  return d;
}

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
  };
}

function toShift(id: string, d: any): Shift {
  const startAt = d.startAt?.toDate ? d.startAt.toDate() : new Date(d.startAt ?? 0);
  const endAt = d.endAt?.toDate ? d.endAt.toDate() : new Date(d.endAt ?? 0);
  return {
    id,
    employeeId: d.employeeId ?? "",
    date: d.date ?? isoDateOf(startAt),
    start: formatTime(startAt),
    end: formatTime(endAt),
    breakMinutes: d.breakMinutes ?? 0,
    label: d.label ?? "",
    location: d.notes ?? "",
    notes: d.notes ?? "",
    status: shiftStatusLabel(d.status),
  };
}

function toSwap(id: string, d: any): SwapRequest {
  const created = d.createdAt?.toDate ? d.createdAt.toDate() : new Date();
  return {
    id,
    fromEmployeeId: d.fromEmployeeId ?? "",
    toEmployeeId: d.toEmployeeId ?? "",
    shiftId: d.shiftId ?? "",
    submitted: isoDateOf(created),
    reason: d.reason ?? "",
    status: swapStatusLabel(d.status),
  };
}

function toAttendance(id: string, d: any): AttendanceRecord {
  const shift = liveShiftsCache.find((s) => s.id === d.shiftId);
  // A null timestamp means a server timestamp still pending locally: treat as "now".
  const clockIn = d.clockInAt?.toDate ? d.clockInAt.toDate() : d.clockInAt === null ? new Date() : undefined;
  const clockOut = d.clockOutAt?.toDate ? d.clockOutAt.toDate() : d.clockOutAt === null ? new Date() : undefined;
  let status: AttendanceRecord["status"] = "Scheduled";
  if (d.lastCorrectionId) status = "Corrected";
  else if (d.reviewStatus === "pending_review") status = "Incomplete";
  else if (d.reviewStatus === "confirmed") status = d.late ? "Late" : "On time";
  else if (d.reviewStatus === "rejected") status = "Late";
  return {
    id,
    employeeId: d.employeeId ?? "",
    date: d.shiftDate ?? isoDateOf(clockIn) ?? "",
    shiftId: d.shiftId,
    scheduledStart: shift?.start ?? "",
    scheduledEnd: shift?.end ?? "",
    clockIn: formatTime(clockIn),
    clockOut: formatTime(clockOut),
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
    publishedAt: d.status === "draft" || !d.publishedAt ? "Draft" : published.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "numeric" }),
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

type Store = {
  role: Role | null;
  userId: string | null;
  employees: Employee[];
  shifts: Shift[];
  attendance: AttendanceRecord[];
  swaps: SwapRequest[];
  announcements: Announcement[];
  notifications: AppNotification[];
  registrations: Registration[];
  clockedIn: boolean;
  lastClockIn?: string;
  scheduleStatus: "Draft" | "Published";
  qrLabel: string;
  /** Admin only: the live QR payload (null until a code has been created). */
  qrPayload: string | null;
  snack: Snack;
  getEmployee: (id: string) => Employee | undefined;
  signIn: (role: Role) => void;
  signOut: () => void;
  setSnack: (snack: Snack) => void;
  setClockedIn: (value: boolean, time?: string) => void;
  upsertEmployee: (employee: Employee) => Promise<void>;
  addShift: (shift: Shift) => Promise<void>;
  addShifts: (shifts: Shift[]) => Promise<void>;
  publishSchedule: () => Promise<void>;
  publishAnnouncement: (item: Announcement) => Promise<void>;
  saveAnnouncementDraft: (item: Announcement) => Promise<void>;
  replaceQr: () => Promise<void>;
  markNotificationsRead: () => Promise<void>;
  correctAttendance: (id: string, clockIn: string, clockOut: string, reason: string) => Promise<void>;
  updateSwap: (id: string, status: SwapRequest["status"], declineReason?: string) => Promise<void>;
  respondToSwap: (id: string, accept: boolean) => Promise<void>;
  addSwap: (request: SwapRequest) => Promise<void>;
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
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [clockedIn, setClocked] = useState(false);
  const [lastClockIn, setLastClockIn] = useState<string>();
  const [scheduleStatus, setScheduleStatus] = useState<"Draft" | "Published">("Draft");
  const [qrLabel, setQrLabel] = useState("Workplace attendance code");
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [snack, setSnack] = useState<Snack>(null);

  // Keep the module-level shift cache current so attendance mapping can read scheduled times.
  useEffect(() => {
    liveShiftsCache = shifts;
  }, [shifts]);

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
      return;
    }
    const unsubs: Unsubscribe[] = [];
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
          (snap) =>
            set((rows) => {
              const gone = new Set<string>();
              const upd = new Map<string, T>();
              snap.docChanges().forEach((c) => {
                if (c.type === "removed") gone.add(c.doc.id);
                else upd.set(c.doc.id, map(c.doc.id, c.doc.data()));
              });
              const kept = rows.filter((r) => !gone.has(r.id) && !upd.has(r.id));
              return [...kept, ...upd.values()];
            }),
          (e) => console.warn("Firestore listener error:", e.code, e.message)
        )
      );
    };
    const mapNotification = (id: string, d: any): AppNotification => {
      const created = d.createdAt?.toDate ? d.createdAt.toDate() : new Date();
      return { id, title: d.title ?? "", body: d.body ?? "", time: created.toLocaleString(), type: d.type ?? "announcement", unread: d.read !== true };
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
      sub(query(collection(db, C.shifts), where("employeeId", "==", myId)), setShifts, toShift);
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
  }, [isAdmin, myId, profile]);

  // Reset transient clock state whenever the signed-in identity changes.
  useEffect(() => {
    setClocked(false);
    setLastClockIn(undefined);
  }, [myId]);

// ---------------------------------------------------------------- write helpers
  const notify = useCallback(
    async (recipientId: string, type: string, title: string, refType: string, refId: string, body = "") => {
      await addDoc(collection(db, C.notifications), {
        recipientId,
        type,
        title: title.slice(0, 120),
        body,
        refType,
        refId,
        read: false,
        createdBy: myId ?? "",
        createdAt: serverTimestamp(),
        expiresAt: expiresAtDays(151),
      });
    },
    [myId]
  );

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

  // Creates one draft shift doc per entry (recurring schedules are expanded by the caller), in
  // batches under Firestore's 500-write limit. An end time at/before the start means "next day".
  const addShifts = useCallback(async (list: Shift[]) => {
    for (let i = 0; i < list.length; i += 400) {
      const batch = writeBatch(db);
      for (const shift of list.slice(i, i + 400)) {
        const startAt = timeToDate(shift.date, shift.start);
        const endAt = timeToDate(shift.date, shift.end);
        if (endAt <= startAt) endAt.setDate(endAt.getDate() + 1);
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
  }, [myId]);
  const addShift = useCallback((shift: Shift) => addShifts([shift]), [addShifts]);

  const publishSchedule = useCallback(async () => {
    if (!myId) return;
    const draftIds = shifts.filter((s) => s.status === "Draft");
    for (const s of draftIds) {
      try {
        const snap = await getDoc(doc(db, C.shifts, s.id));
        const rev = (snap.data()?.revision as number) ?? 1;
        await updateDoc(doc(db, C.shifts, s.id), {
          status: "published",
          updatedBy: myId,
          updatedAt: serverTimestamp(),
          revision: rev + 1,
        });
      } catch {
        /* a concurrent edit may have already bumped the revision; ignore */
      }
    }
    setScheduleStatus("Published");
    setSnack({ message: "Schedule published", tone: "success" });
  }, [myId, shifts]);
const publishAnnouncement = useCallback(
    async (item: Announcement) => {
      if (!myId) return;
      const annRef = doc(collection(db, C.announcements));
      const audience: "all" | "selected" = item.audience === "Selected employees" ? "selected" : "all";
      const audienceIds = audience === "selected" ? (item.audienceIds ?? []) : [];
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
      // Fan out one notification per recipient (the only fan-out the Spark plan allows is one write each).
      const recipients = audience === "all" ? employees.filter((e) => e.status === "Active").map((e) => e.id) : audienceIds;
      for (const rid of recipients) {
        batch.set(doc(collection(db, C.notifications)), {
          recipientId: rid,
          type: "announcement",
          title: (item.priority === "Important" ? "Important announcement" : "New announcement").slice(0, 120),
          body: item.title,
          refType: "announcement",
          refId: annRef.id,
          read: false,
          createdBy: myId,
          createdAt: serverTimestamp(),
          expiresAt: expiresAtDays(151),
        });
      }
      await batch.commit();
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
      if (!myId) return;
      const attRef = doc(db, C.attendance, id);
      const snap = await getDoc(attRef);
      const current = snap.data() ?? {};
      const correctionId = `c-${Date.now()}`;
      const batch = writeBatch(db);
      batch.set(doc(db, C.attendance, id, "corrections", correctionId), {
        adminId: myId,
        changedAt: serverTimestamp(),
        original: { clockInAt: current.clockInAt ?? null, clockOutAt: current.clockOutAt ?? null, reviewStatus: current.reviewStatus },
        updated: { clockIn: clockIn, clockOut: clockOut },
        note: reason,
      });
      batch.update(attRef, { lastCorrectionId: correctionId });
      await batch.commit();
      setSnack({ message: "Attendance correction saved", tone: "success" });
    },
    [myId]
  );
const addSwap = useCallback(
    async (request: SwapRequest) => {
      if (!myId) return;
      // Deterministic swap id so the colleague notification can reference it in the same batch.
      const swapRef = doc(collection(db, C.swaps));
      const batch = writeBatch(db);
      batch.set(swapRef, {
        fromEmployeeId: myId,
        toEmployeeId: request.toEmployeeId,
        shiftId: request.shiftId,
        reason: request.reason ?? "",
        status: "pending_peer",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(collection(db, C.notifications)), {
        recipientId: request.toEmployeeId,
        type: "swap_request",
        title: "New shift swap request",
        body: "A colleague wants to swap a shift with you.",
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
    [myId]
  );

  // The colleague accepts (pending_peer -> pending_admin) or declines (pending_peer -> declined).
  const respondToSwap = useCallback(async (id: string, accept: boolean) => {
    const ref = doc(db, C.swaps, id);
    const snap = await getDoc(ref);
    const d = snap.data();
    if (!d || d.status !== "pending_peer" || d.toEmployeeId !== myId) return;
    await updateDoc(ref, { status: accept ? "pending_admin" : "declined", updatedAt: serverTimestamp() });
  }, [myId]);

  // Admin approves / rejects. Approval moves the shift to the colleague in the SAME atomic batch.
  const updateSwap = useCallback(
    async (id: string, status: SwapRequest["status"], _declineReason?: string) => {
      if (!myId) return;
      const ref = doc(db, C.swaps, id);
      const snap = await getDoc(ref);
      const d = snap.data();
      if (!d) return;
      if (status === "Approved") {
        const shiftRef = doc(db, C.shifts, d.shiftId);
        const shiftSnap = await getDoc(shiftRef);
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
        await batch.commit();
        await notify(d.fromEmployeeId, "swap_update", "Swap approved", "swap", id).catch(() => undefined);
        await notify(d.toEmployeeId, "swap_update", "Swap approved", "swap", id).catch(() => undefined);
      } else {
        await updateDoc(ref, { status: "declined", decidedBy: myId, updatedAt: serverTimestamp() });
        await notify(d.fromEmployeeId, "swap_update", "Swap declined", "swap", id).catch(() => undefined);
      }
      setSnack({ message: status === "Approved" ? "Swap approved" : "Swap declined", tone: "info" });
    },
    [myId, notify]
  );
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
        tx.set(doc(db, C.directory, id), { displayName: reg.name.trim() || email, title, status: "active" });
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
      await updateDoc(doc(db, C.employees, id), { role: newRole, updatedAt: serverTimestamp() });
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
        shiftDate: shift?.date ?? isoDateOf(new Date()),
        clockInAt: serverTimestamp(),
        clockInReportedAt: Timestamp.now(),
        clockInSource: "online",
        clockInActionId: actionId(),
        qrProof,
        reviewStatus: "confirmed",
        late: false,
      });
      setClocked(true);
      setLastClockIn(formatTime(new Date()));
    },
    [myId, shifts, attendance]
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
      registrations,
      clockedIn: clockedIn || (!!myId && attendance.some((a) => a.employeeId === myId && a.clockIn !== "—" && a.clockOut === "—")),
      lastClockIn,
      scheduleStatus,
      qrLabel,
      qrPayload: qrToken ? encodeQr(qrToken) : null,
      snack,
      getEmployee,
      signIn: () => undefined, // real sign-in lives in AuthProvider
      signOut: () => void authSignOut(),
      setSnack,
      setClockedIn,
      upsertEmployee,
      addShift,
      addShifts,
      publishSchedule,
      publishAnnouncement,
      saveAnnouncementDraft,
      replaceQr,
      markNotificationsRead,
      correctAttendance,
      updateSwap,
      respondToSwap,
      addSwap,
      clockIn,
      clockOut,
      approveRegistration,
      rejectRegistration,
      setEmployeeRole,
    }),
    [role, myId, employees, shifts, attendance, swaps, announcements, notifications, registrations, clockedIn, lastClockIn, scheduleStatus, qrLabel, qrToken, snack, getEmployee, setClockedIn, upsertEmployee, addShift, addShifts, publishSchedule, publishAnnouncement, saveAnnouncementDraft, replaceQr, markNotificationsRead, correctAttendance, updateSwap, respondToSwap, addSwap, clockIn, clockOut, approveRegistration, rejectRegistration, setEmployeeRole, authSignOut]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within PrototypeProvider");
  return ctx;
}
