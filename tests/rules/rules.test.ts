/// <reference types="node" />
// Run with: npm run test:rules   (starts the Firestore emulator; needs JDK 21+)
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch, deleteDoc } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

let env: RulesTestEnvironment;
const TOKEN = "t".repeat(40);
const ACTION = (n: number) => `action-${String(n).padStart(12, "0")}`;
const hours = (h: number) => Timestamp.fromMillis(Date.now() + h * 3600_000);

// Fixture identities: ADM (EMP-0001, admin), MAYA (EMP-0002), JORDAN (EMP-0003), SAM (EMP-0004, deactivated)
const authCtx = (uid: string, email: string) => env.authenticatedContext(uid, { email, email_verified: true });
const admin = () => authCtx("u-adm", "adm@test.example");
const maya = () => authCtx("u-maya", "maya@test.example");
const jordan = () => authCtx("u-jordan", "jordan@test.example");
const sam = () => authCtx("u-sam", "sam@test.example");
const stranger = () => authCtx("u-x", "stranger@test.example");

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-shiftline",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});
afterAll(async () => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    const emp = (id: string, first: string, role: string, status = "active") =>
      setDoc(doc(d, "employees", id), {
        firstName: first, lastName: "T", email: `${first.toLowerCase()}@test.example`, phone: "", title: "x",
        role, status, createdBy: "EMP-0001", createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
      });
    await emp("EMP-0001", "Adm", "admin");
    await emp("EMP-0002", "Maya", "employee");
    await emp("EMP-0003", "Jordan", "employee");
    await emp("EMP-0004", "Sam", "employee", "deactivated");
    for (const [uid, id] of [["u-adm", "EMP-0001"], ["u-maya", "EMP-0002"], ["u-jordan", "EMP-0003"], ["u-sam", "EMP-0004"]]) {
      await setDoc(doc(d, "userLinks", uid), { employeeId: id, linkedAt: Timestamp.now() });
    }
    await setDoc(doc(d, "systemMeta", "counters"), { employeeSeq: 4 });
    await setDoc(doc(d, "workplaceSettings", "main"), { clockInEarlyMinutes: 15, clockInLateMinutes: 120 });
    await setDoc(doc(d, "qrCredentials", "current"), { token: TOKEN, version: 1 });
    await setDoc(doc(d, "employeeAuthorizations", "newbie@test.example"), { employeeId: "EMP-0009", claimedByUid: null });
    await setDoc(doc(d, "employees", "EMP-0009"), { firstName: "New", lastName: "B", email: "newbie@test.example", role: "employee", status: "active" });
    const shift = (id: string, employeeId: string, status: string, startH: number) =>
      setDoc(doc(d, "shifts", id), {
        employeeId, date: "2030-01-01", startAt: hours(startH), endAt: hours(startH + 8), breakMinutes: 30, label: "s",
        status, createdBy: "EMP-0001", updatedBy: "EMP-0001", createdAt: Timestamp.now(), updatedAt: Timestamp.now(), revision: 1,
      });
    await shift("now-pub", "EMP-0002", "published", 0.1); // started moments ago: inside clock-in window
    await shift("draft", "EMP-0002", "draft", 24);
    await shift("future-pub", "EMP-0002", "published", 48);
    await shift("jordan-pub", "EMP-0003", "published", 0.1);
    await shift("jordan-future-pub", "EMP-0003", "published", 72);
  });
});

const clockIn = (over: Record<string, unknown> = {}) => ({
  employeeId: "EMP-0002", shiftId: "now-pub", shiftDate: "2030-01-01",
  clockInAt: serverTimestamp(), clockInReportedAt: Timestamp.now(), clockInSource: "online",
  clockInActionId: ACTION(1), qrProof: TOKEN, reviewStatus: "confirmed", late: false, ...over,
});

describe("1-4 identity & roles", () => {
  it("unauthorized Google account cannot read employee data", async () => {
    const db = stranger().firestore();
    await assertFails(getDoc(doc(db, "employees", "EMP-0002")));
    await assertFails(getDoc(doc(db, "shifts", "now-pub")));
  });
  it("unauthenticated user can read nothing", async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "employees", "EMP-0002")));
  });
  it("employee cannot promote themselves or change status", async () => {
    const db = maya().firestore();
    await assertFails(updateDoc(doc(db, "employees", "EMP-0002"), { role: "admin", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, "employees", "EMP-0002"), { status: "active", title: "boss", updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db, "employees", "EMP-0002"), { phone: "123", updatedAt: serverTimestamp() }));
  });
  it("deactivated employee loses access to everything but their own status doc", async () => {
    const db = sam().firestore();
    await assertSucceeds(getDoc(doc(db, "employees", "EMP-0004")));
    await assertFails(getDoc(doc(db, "workplaceSettings", "main")));
    await assertFails(getDoc(doc(db, "directory", "EMP-0002")));
  });
  it("employee cannot read another employee's private record", async () => {
    await assertFails(getDoc(doc(maya().firestore(), "employees", "EMP-0003")));
    await assertSucceeds(getDoc(doc(admin().firestore(), "employees", "EMP-0003")));
  });
  it("authorized employee can claim their authorization exactly once", async () => {
    const db = authCtx("u-new", "newbie@test.example").firestore();
    const claim = () => {
      const b = writeBatch(db);
      b.set(doc(db, "userLinks", "u-new"), { employeeId: "EMP-0009", linkedAt: serverTimestamp() });
      b.update(doc(db, "employeeAuthorizations", "newbie@test.example"), { claimedByUid: "u-new", claimedAt: serverTimestamp() });
      return b.commit();
    };
    await assertSucceeds(claim());
    // a different Google account cannot hijack the same employee record
    const other = authCtx("u-evil", "newbie@test.example").firestore();
    const b = writeBatch(other);
    b.set(doc(other, "userLinks", "u-evil"), { employeeId: "EMP-0009", linkedAt: serverTimestamp() });
    b.update(doc(other, "employeeAuthorizations", "newbie@test.example"), { claimedByUid: "u-evil", claimedAt: serverTimestamp() });
    await assertFails(b.commit());
  });
  it("cannot claim someone else's employee id", async () => {
    const db = stranger().firestore();
    await assertFails(setDoc(doc(db, "userLinks", "u-x"), { employeeId: "EMP-0001", linkedAt: serverTimestamp() }));
  });
});

describe("5-6 employee creation & unique IDs", () => {
  const create = (db: any, seq: number, id = `EMP-${String(seq).padStart(4, "0")}`, email = `n${seq}@test.example`) => {
    const b = writeBatch(db);
    b.update(doc(db, "systemMeta", "counters"), { employeeSeq: seq });
    b.set(doc(db, "employees", id), {
      firstName: "N", lastName: "E", email, phone: "", title: "x", status: "active", role: "employee",
      createdBy: "EMP-0001", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    b.set(doc(db, "directory", id), { displayName: "N E", title: "x", status: "active", role: "employee" });
    b.set(doc(db, "employeeAuthorizations", email), {
      employeeId: id, claimedByUid: null, claimedAt: null, createdBy: "EMP-0001", createdAt: serverTimestamp(),
    });
    return b.commit();
  };
  it("admin creates the next sequential employee", async () => {
    await assertSucceeds(create(admin().firestore(), 5));
  });
  it("rejects skipped numbers and reused ids", async () => {
    const db = admin().firestore();
    await assertFails(create(db, 7)); // counter must go +1
    await assertFails(create(db, 5, "EMP-0002")); // id must match the new counter value
    await assertSucceeds(create(db, 5));
    await assertFails(create(db, 5)); // replay: counter no longer 4 -> not +1
  });
  it("employees cannot create employees", async () => {
    await assertFails(create(maya().firestore(), 5));
  });
  it("employees cannot read the counter or QR credential", async () => {
    await assertFails(getDoc(doc(maya().firestore(), "systemMeta", "counters")));
    await assertFails(getDoc(doc(maya().firestore(), "qrCredentials", "current")));
  });
});

describe("7 shifts", () => {
  it("employees see only their own published shifts", async () => {
    const db = maya().firestore();
    await assertSucceeds(getDoc(doc(db, "shifts", "now-pub")));
    await assertFails(getDoc(doc(db, "shifts", "draft")));
    await assertFails(getDoc(doc(db, "shifts", "jordan-pub")));
  });
  it("admin can edit and publish a shift while advancing its revision", async () => {
    const db = admin().firestore();
    await assertSucceeds(updateDoc(doc(db, "shifts", "draft"), {
      label: "Updated shift", status: "published", updatedBy: "EMP-0001",
      updatedAt: serverTimestamp(), revision: 2,
    }));
    const saved = await getDoc(doc(db, "shifts", "draft"));
    expect(saved.data()?.label).toBe("Updated shift");
    expect(saved.data()?.status).toBe("published");
    expect(saved.data()?.revision).toBe(2);
  });
  it("published shifts cannot be deleted; attendance protects the scheduled shift times", async () => {
    const db = admin().firestore();
    await assertFails(deleteDoc(doc(db, "shifts", "now-pub")));
    await assertSucceeds(deleteDoc(doc(db, "shifts", "draft")));
    await assertSucceeds(setDoc(doc(maya().firestore(), "attendance", "EMP-0002_now-pub"), clockIn()));
    await assertFails(updateDoc(doc(db, "shifts", "now-pub"), {
      startAt: hours(2), updatedBy: "EMP-0001", updatedAt: serverTimestamp(), revision: 2,
    }));
  });
  it("publishes large schedules in batches that stay within the rules access limit", async () => {
    const shifts = Array.from({ length: 22 }, (_, index) => ({
      id: `rules-batch-${index}`,
      employeeId: `EMP-BATCH-${index}`,
    }));
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      for (const { id, employeeId } of shifts) {
        await setDoc(doc(db, "employees", employeeId), {
          firstName: employeeId, lastName: "Test", email: `${employeeId}@test.example`,
          phone: "", title: "x", role: "employee", status: "active",
        });
        await setDoc(doc(db, "shifts", id), {
          employeeId, date: "2030-01-01", startAt: hours(48), endAt: hours(56),
          breakMinutes: 30, label: "s", status: "draft", createdBy: "EMP-0001",
          updatedBy: "EMP-0001", createdAt: Timestamp.now(), updatedAt: Timestamp.now(), revision: 1,
        });
      }
    });

    const db = admin().firestore();
    const tooLarge = writeBatch(db);
    for (const { id } of shifts) {
      tooLarge.update(doc(db, "shifts", id), {
        status: "published", updatedBy: "EMP-0001", updatedAt: serverTimestamp(), revision: 2,
      });
    }
    await assertFails(tooLarge.commit());

    for (let i = 0; i < shifts.length; i += 15) {
      const safeBatch = writeBatch(db);
      for (const { id } of shifts.slice(i, i + 15)) {
        safeBatch.update(doc(db, "shifts", id), {
          status: "published", updatedBy: "EMP-0001", updatedAt: serverTimestamp(), revision: 2,
        });
      }
      await assertSucceeds(safeBatch.commit());
    }
    const notificationBatch = writeBatch(db);
    for (const { employeeId } of shifts) {
      notificationBatch.set(doc(db, "notifications", `published-${employeeId}`), {
        recipientId: employeeId,
        type: "schedule",
        title: "Your schedule is ready",
        refType: "schedule",
        refId: "2030-01-01_2030-01-07",
        read: false,
        createdBy: "EMP-0001",
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + 151 * 86400_000),
      });
    }
    await assertSucceeds(notificationBatch.commit());
  });
  it("employees cannot write shifts", async () => {
    await assertFails(updateDoc(doc(maya().firestore(), "shifts", "now-pub"), { label: "x" }));
  });
});

describe("8-9 QR + attendance", () => {
  it("accepts a valid online clock-in", async () => {
    await assertSucceeds(setDoc(doc(maya().firestore(), "attendance", "EMP-0002_now-pub"), clockIn()));
  });
  it("rejects a stale/replaced QR immediately", async () => {
    await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), "qrCredentials", "current"), { token: "n".repeat(40), version: 2 }));
    await assertFails(setDoc(doc(maya().firestore(), "attendance", "EMP-0002_now-pub"), clockIn()));
  });
  it("rejects forged server time, wrong employee, unpublished shift, outside window", async () => {
    const db = maya().firestore();
    await assertFails(setDoc(doc(db, "attendance", "EMP-0002_now-pub"), clockIn({ clockInAt: Timestamp.fromMillis(0) })));
    await assertFails(setDoc(doc(db, "attendance", "EMP-0003_jordan-pub"), clockIn({ employeeId: "EMP-0003", shiftId: "jordan-pub" })));
    await assertFails(setDoc(doc(db, "attendance", "EMP-0002_draft"), clockIn({ shiftId: "draft" })));
    await assertFails(setDoc(doc(db, "attendance", "EMP-0002_future-pub"), clockIn({ shiftId: "future-pub" })));
  });
  it("blocks self-confirming offline items and injected fields", async () => {
    const db = maya().firestore();
    await assertFails(setDoc(doc(db, "attendance", "EMP-0002_now-pub"), clockIn({ clockInSource: "offline", reviewStatus: "confirmed" })));
    await assertFails(setDoc(doc(db, "attendance", "EMP-0002_now-pub"), clockIn({ late: true })));
    await assertFails(setDoc(doc(db, "attendance", "EMP-0002_now-pub"), { ...clockIn(), extra: 1 }));
    await assertSucceeds(setDoc(doc(db, "attendance", "EMP-0002_now-pub"), clockIn({ clockInSource: "offline", reviewStatus: "pending_review" })));
  });
  it("duplicate clock-in is not counted twice (create-once document id)", async () => {
    const db = maya().firestore();
    await assertSucceeds(setDoc(doc(db, "attendance", "EMP-0002_now-pub"), clockIn()));
    await assertFails(setDoc(doc(db, "attendance", "EMP-0002_now-pub"), clockIn({ clockInActionId: ACTION(2) })));
  });
  it("clock-out requires a clock-in, valid QR, and can only happen once", async () => {
    const db = maya().firestore();
    const out = (n = 2) => ({
      clockOutAt: serverTimestamp(), clockOutReportedAt: Timestamp.now(), clockOutSource: "online",
      clockOutActionId: ACTION(n), clockOutProof: TOKEN, reviewStatus: "confirmed",
    });
    await assertFails(updateDoc(doc(db, "attendance", "EMP-0002_now-pub"), out())); // nothing to update
    await assertSucceeds(setDoc(doc(db, "attendance", "EMP-0002_now-pub"), clockIn()));
    await assertFails(updateDoc(doc(db, "attendance", "EMP-0002_now-pub"), { ...out(), clockOutProof: "bad" }));
    await assertSucceeds(updateDoc(doc(db, "attendance", "EMP-0002_now-pub"), out()));
    await assertFails(updateDoc(doc(db, "attendance", "EMP-0002_now-pub"), out(3))); // second clock-out
  });
  it("employees can never edit lateness/times or delete attendance", async () => {
    const db = maya().firestore();
    await assertSucceeds(setDoc(doc(db, "attendance", "EMP-0002_now-pub"), clockIn()));
    await assertFails(updateDoc(doc(db, "attendance", "EMP-0002_now-pub"), { late: false, clockInAt: Timestamp.fromMillis(1) }));
    await assertFails(deleteDoc(doc(db, "attendance", "EMP-0002_now-pub")));
  });
  it("employee cannot read another employee's attendance", async () => {
    await assertSucceeds(setDoc(doc(maya().firestore(), "attendance", "EMP-0002_now-pub"), clockIn()));
    await assertFails(getDoc(doc(jordan().firestore(), "attendance", "EMP-0002_now-pub")));
    await assertSucceeds(getDoc(doc(admin().firestore(), "attendance", "EMP-0002_now-pub")));
  });
});

describe("10 corrections keep an audit trail", () => {
  it("admin edit requires a paired immutable correction entry", async () => {
    await assertSucceeds(setDoc(doc(maya().firestore(), "attendance", "EMP-0002_now-pub"), clockIn()));
    const db = admin().firestore();
    await assertFails(updateDoc(doc(db, "attendance", "EMP-0002_now-pub"), { late: true, lastCorrectionId: "c1" }));
    const b = writeBatch(db);
    b.set(doc(db, "attendance", "EMP-0002_now-pub", "corrections", "c1"), {
      adminId: "EMP-0001", changedAt: serverTimestamp(), original: { late: false }, updated: { late: true },
    });
    b.update(doc(db, "attendance", "EMP-0002_now-pub"), { late: true, lastCorrectionId: "c1" });
    await assertSucceeds(b.commit());
    await assertFails(updateDoc(doc(db, "attendance", "EMP-0002_now-pub", "corrections", "c1"), { adminId: "x" }));
    await assertFails(deleteDoc(doc(db, "attendance", "EMP-0002_now-pub", "corrections", "c1")));
  });
  it("correction entry must name the acting admin", async () => {
    await assertSucceeds(setDoc(doc(maya().firestore(), "attendance", "EMP-0002_now-pub"), clockIn()));
    const db = admin().firestore();
    const b = writeBatch(db);
    b.set(doc(db, "attendance", "EMP-0002_now-pub", "corrections", "c1"), {
      adminId: "EMP-0003", changedAt: serverTimestamp(), original: {}, updated: {},
    });
    b.update(doc(db, "attendance", "EMP-0002_now-pub"), { late: true, lastCorrectionId: "c1" });
    await assertFails(b.commit());
  });
});

describe("13 shift swaps", () => {
  const validSwapDoc = async () => {
    let swap: Record<string, unknown> | undefined;
    await env.withSecurityRulesDisabled(async (context) => {
      const shift = (await getDoc(doc(context.firestore(), "shifts", "future-pub"))).data()!;
      swap = {
        fromEmployeeId: "EMP-0002",
        toEmployeeId: "EMP-0003",
        shiftId: "future-pub",
        shiftDate: shift.date,
        shiftStartAt: shift.startAt,
        shiftEndAt: shift.endAt,
        shiftLabel: shift.label,
        reason: "x",
        status: "pending_peer",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
    });
    return swap!;
  };
  it("requester creates; only the colleague may accept; admin must approve with the shift move", async () => {
    const m = maya().firestore();
    const requestRef = doc(m, "shiftSwapRequests", "s1");
    const requestBatch = writeBatch(m);
    requestBatch.set(requestRef, await validSwapDoc());
    requestBatch.set(doc(m, "notifications", "swap-request"), {
      recipientId: "EMP-0003", type: "swap_request", title: "New shift swap request",
      refType: "swap", refId: requestRef.id,
      read: false, createdBy: "EMP-0002", createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + 151 * 86400_000),
    });
    await assertSucceeds(requestBatch.commit());
    await assertSucceeds(getDoc(doc(jordan().firestore(), "shiftSwapRequests", "s1")));
    await assertFails(getDoc(doc(jordan().firestore(), "shifts", "future-pub")));
    // requester cannot self-approve
    await assertFails(updateDoc(requestRef, { status: "pending_admin", updatedAt: serverTimestamp() }));
    const colleagueDb = jordan().firestore();
    const responseBatch = writeBatch(colleagueDb);
    responseBatch.update(doc(colleagueDb, "shiftSwapRequests", "s1"), { status: "pending_admin", updatedAt: serverTimestamp() });
    responseBatch.set(doc(colleagueDb, "notifications", "swap-accepted"), {
      recipientId: "EMP-0002", type: "swap_update", title: "Coworker accepted your swap request",
      refType: "swap", refId: requestRef.id,
      read: false, createdBy: "EMP-0003", createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + 151 * 86400_000),
    });
    await assertSucceeds(responseBatch.commit());
    // approval without moving the shift fails
    await assertFails(updateDoc(doc(admin().firestore(), "shiftSwapRequests", "s1"), { status: "approved", decidedBy: "EMP-0001", updatedAt: serverTimestamp() }));
    const a = admin().firestore();
    const b = writeBatch(a);
    b.update(doc(a, "shiftSwapRequests", "s1"), { status: "approved", decidedBy: "EMP-0001", updatedAt: serverTimestamp() });
    b.update(doc(a, "shifts", "future-pub"), { employeeId: "EMP-0003", updatedBy: "EMP-0001", updatedAt: serverTimestamp(), revision: 2, changedAfterPublish: true });
    await assertSucceeds(b.commit());
  });
  it("cannot swap a shift you do not own, or skip the colleague step", async () => {
    const valid = await validSwapDoc();
    await assertFails(setDoc(doc(jordan().firestore(), "shiftSwapRequests", "s2"), { ...valid, fromEmployeeId: "EMP-0003", toEmployeeId: "EMP-0002" }));
    await assertFails(setDoc(doc(maya().firestore(), "shiftSwapRequests", "s3"), { ...valid, status: "pending_admin" }));
    await assertFails(setDoc(doc(maya().firestore(), "shiftSwapRequests", "s4"), { ...valid, shiftLabel: "forged" }));
  });
  it("approves a two-way swap by moving both shifts atomically", async () => {
    const m = maya().firestore();
    await setDoc(doc(m, "shiftSwapRequests", "two-way"), await validSwapDoc());
    await updateDoc(doc(jordan().firestore(), "shiftSwapRequests", "two-way"), {
      status: "pending_admin", receivedShiftId: "jordan-future-pub", updatedAt: serverTimestamp(),
    });

    const db = admin().firestore();
    const batch = writeBatch(db);
    batch.update(doc(db, "shiftSwapRequests", "two-way"), {
      status: "approved", decidedBy: "EMP-0001", updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, "shifts", "future-pub"), {
      employeeId: "EMP-0003", updatedBy: "EMP-0001", updatedAt: serverTimestamp(), revision: 2,
      changedAfterPublish: true,
    });
    batch.update(doc(db, "shifts", "jordan-future-pub"), {
      employeeId: "EMP-0002", updatedBy: "EMP-0001", updatedAt: serverTimestamp(), revision: 2,
      changedAfterPublish: true,
    });
    await assertSucceeds(batch.commit());
  });
});

describe("14 announcements", () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      const d = c.firestore();
      const base = { title: "t", body: "b", priority: "normal", status: "published", publishedBy: "EMP-0001", createdAt: Timestamp.now(), publishedAt: Timestamp.now() };
      await setDoc(doc(d, "announcements", "all"), { ...base, audience: "all", audienceIds: [] });
      await setDoc(doc(d, "announcements", "maya-only"), { ...base, audience: "selected", audienceIds: ["EMP-0002"] });
      await setDoc(doc(d, "announcements", "draft"), { ...base, status: "draft", audience: "all", audienceIds: [] });
    });
  });
  it("visible only to the intended audience", async () => {
    await assertSucceeds(getDoc(doc(maya().firestore(), "announcements", "maya-only")));
    await assertFails(getDoc(doc(jordan().firestore(), "announcements", "maya-only")));
    await assertSucceeds(getDoc(doc(jordan().firestore(), "announcements", "all")));
    await assertFails(getDoc(doc(jordan().firestore(), "announcements", "draft")));
  });
  it("publishes an announcement with its employee notification in one batch", async () => {
    const db = admin().firestore();
    const announcementRef = doc(db, "announcements", "published-with-notification");
    const batch = writeBatch(db);
    batch.set(announcementRef, {
      title: "Schedule update", body: "The schedule is ready.", priority: "normal", status: "published",
      audience: "all", audienceIds: [], publishedBy: "EMP-0001",
      createdAt: serverTimestamp(), publishedAt: serverTimestamp(),
    });
    batch.set(doc(db, "notifications", "announcement-notification"), {
      recipientId: "EMP-0002", type: "announcement", title: "New announcement",
      refType: "announcement", refId: announcementRef.id, read: false, createdBy: "EMP-0001",
      createdAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 151 * 86400_000),
    });
    await assertSucceeds(batch.commit());
  });
});

describe("15-16 notifications", () => {
  const note = (over: Record<string, unknown> = {}) => ({
    recipientId: "EMP-0002", type: "announcement", title: "Hi", refType: "announcement", refId: "all",
    createdAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 151 * 86400_000), read: false, createdBy: "EMP-0001", ...over,
  });
  it("admin creates with ~5-month expiry; wrong expiry rejected", async () => {
    const db = admin().firestore();
    await assertSucceeds(setDoc(doc(db, "notifications", "n1"), note()));
    await assertFails(setDoc(doc(db, "notifications", "with-body"), note({ body: "Not allowed by the notification schema" })));
    await assertFails(setDoc(doc(db, "notifications", "n2"), note({ expiresAt: Timestamp.fromMillis(Date.now() + 400 * 86400_000) })));
    await assertFails(setDoc(doc(db, "notifications", "n3"), note({ expiresAt: Timestamp.fromMillis(Date.now() + 10 * 86400_000) })));
  });
  it("employees cannot forge notifications to others", async () => {
    await assertFails(setDoc(doc(maya().firestore(), "notifications", "n4"), note({ recipientId: "EMP-0003", createdBy: "EMP-0002" })));
  });
  it("owner can read/mark read/delete only their own", async () => {
    await assertSucceeds(setDoc(doc(admin().firestore(), "notifications", "n1"), note()));
    await assertSucceeds(updateDoc(doc(maya().firestore(), "notifications", "n1"), { read: true }));
    await assertFails(updateDoc(doc(maya().firestore(), "notifications", "n1"), { title: "tamper" }));
    await assertFails(getDoc(doc(jordan().firestore(), "notifications", "n1")));
    await assertSucceeds(deleteDoc(doc(maya().firestore(), "notifications", "n1")));
  });
  it("notification deletion never touches attendance (rules forbid attendance deletes for everyone)", async () => {
    await assertSucceeds(setDoc(doc(maya().firestore(), "attendance", "EMP-0002_now-pub"), clockIn()));
    await assertFails(deleteDoc(doc(admin().firestore(), "attendance", "EMP-0002_now-pub")));
    expect(true).toBe(true);
  });
});

describe("17 notification preferences", () => {
  it("notification preferences are private, typed, and owner-writable", async () => {
    const own = doc(maya().firestore(), "employees", "EMP-0002", "notificationPreferences", "current");
    await assertSucceeds(setDoc(own, {
      schedule: true, announcements: true, swaps: false, updatedAt: serverTimestamp(),
    }));
    await assertSucceeds(getDoc(own));
    await assertFails(getDoc(doc(jordan().firestore(), "employees", "EMP-0002", "notificationPreferences", "current")));
    await assertFails(setDoc(doc(jordan().firestore(), "employees", "EMP-0002", "notificationPreferences", "current"), {
      schedule: true, announcements: true, swaps: true, updatedAt: serverTimestamp(),
    }));
    await assertFails(setDoc(own, {
      schedule: "yes", announcements: true, swaps: true, updatedAt: serverTimestamp(),
    }));
  });
});

describe("18 workplace business details", () => {
  it("admins can save bounded business details and employees cannot change them", async () => {
    const settingsRef = doc(admin().firestore(), "workplaceSettings", "main");
    await assertSucceeds(setDoc(settingsRef, {
      businessName: "Harbor Cafe",
      businessAddress: "14 Harbour Street",
      businessPhone: "+1 555 0100",
      businessEmail: "hello@example.com",
      timezone: "America/New_York",
      clockInEarlyMinutes: 15,
      clockInLateMinutes: 120,
      updatedBy: "EMP-0001",
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(settingsRef, {
      businessAddress: "x".repeat(301),
      updatedBy: "EMP-0001",
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(maya().firestore(), "workplaceSettings", "main"), {
      businessName: "Not authorized",
      updatedBy: "EMP-0002",
      updatedAt: serverTimestamp(),
    }));
  });
});

describe("20 logs are append-only and admin-only", () => {
  it("exportLogs & auditLogs", async () => {
    const db = admin().firestore();
    await assertSucceeds(setDoc(doc(db, "exportLogs", "e1"), { exportedAt: serverTimestamp(), exportedBy: "EMP-0001", format: "csv", rangeStart: "2030-01-01", rangeEnd: "2030-01-31", recordCount: 3, confirmedSaved: true }));
    await assertFails(deleteDoc(doc(db, "exportLogs", "e1")));
    await assertFails(getDoc(doc(maya().firestore(), "exportLogs", "e1")));
    await assertFails(setDoc(doc(maya().firestore(), "auditLogs", "a1"), { actorId: "EMP-0002", at: serverTimestamp() }));
  });
});
