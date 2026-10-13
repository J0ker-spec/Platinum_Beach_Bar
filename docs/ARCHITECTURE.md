# Architecture and Firestore schema (Spark plan)

Everything below runs on the **Firebase Spark (no-cost) plan**: Authentication, Cloud Firestore, no Cloud Functions,
no scheduled jobs. Because there is no trusted server code, **`firestore.rules` is the only server-side enforcement**.
Rules can read other documents (`get`, `getAfter`, `existsAfter`) and compare server time (`request.time`), which is
how the security-critical checks below are done. What rules cannot do is listed in [SPARK_LIMITATIONS.md](SPARK_LIMITATIONS.md).

## Identity model

```
Google account ──(verified email)──► employeeAuthorizations/{email}  ──► employeeId
                 first sign-in claim ──► userLinks/{uid} = { employeeId }
employees/{EMP-0001} = { role, status, ... }     <- the ONLY source of role/status
```

* An admin pre-authorizes an email (`employeeAuthorizations`). A Google sign-in alone grants nothing.
* The first sign-in claims the authorization in one atomic batch (`userLinks` create + authorization update). Rules verify
  the email is verified, the entry is unclaimed, and the employee is active. A second Google account cannot take it over.
* Every rule resolves `uid → userLinks → employees` and checks `status == 'active'` and `role` **on every request**.
  Deactivation therefore takes effect immediately for all reads and writes, even though the Google account stays valid.
* Roles are never taken from client state or token claims (custom claims need the Admin SDK, i.e. a server).
* Cost: each request does two extra `get()` reads (cached within a request). Acceptable for < 25 employees.

## Collections

| Collection | Doc id | Core fields | Who can read | Who can write |
|---|---|---|---|---|
| `employees` | `EMP-0001`… | firstName, lastName, email, phone, title, role (`employee`/`admin`), status (`active`/`deactivated`), createdBy, createdAt, updatedAt | admin; owner (own doc, even if deactivated) | admin create/update (not own role/status); owner: `phone` only; never delete |
| `employeeAuthorizations` | lowercase email | employeeId, claimedByUid, claimedAt | admin; the matching verified email | admin create / release claim; owner claims once |
| `userLinks` | Firebase uid | employeeId, linkedAt | owner, admin | owner create once (validated); admin delete (re-bind) |
| `directory` | employee id | displayName, title, status | any active employee | admin. Minimal fields so swap pickers need no private data |
| `systemMeta/counters` | – | employeeSeq | admin | admin, +1 only. **Seeded from console** |
| `systemMeta/maintenance` | – | lastExportAt, lastExportRangeEnd, reminder state | admin | admin |
| `workplaceSettings/main` | – | businessName, timezone, clockInEarlyMinutes, clockInLateMinutes | active employees | admin |
| `qrCredentials/current` | – | token (≥32 chars), version, rotatedBy, rotatedAt | **admin only** | admin; version must increment |
| `shifts` | auto | employeeId, date, startAt, endAt (timestamps), breakMinutes, label, notes, status (`draft`/`published`/`cancelled`), createdBy, updatedBy, createdAt, updatedAt, revision, changedAfterPublish | admin; employee: own **published** only | admin |
| `attendance` | `{employeeId}_{shiftId}` | employeeId, shiftId, shiftDate, clockInAt (server), clockInReportedAt (device), clockInSource, clockInActionId, qrProof, clockOut* (same), reviewStatus (`confirmed`/`pending_review`/`rejected`), late, lastCorrectionId | admin; owner | employee: create clock-in once, set clock-out once; admin: only with a paired correction doc; **never deleted** |
| `attendance/{id}/corrections` | auto | adminId, changedAt (server), original, updated, note | admin | admin create only (append-only) |
| `shiftSwapRequests` | auto | fromEmployeeId, toEmployeeId, shiftId, reason, status, createdAt, updatedAt, decidedBy | admin; the two parties | see state machine below |
| `announcements` | auto | title, body, priority, status, audience (`all`/`selected`), audienceIds, publishedBy, publishedAt | admin; active employee if published and in audience | admin |
| `notifications` | auto | recipientId, type, title, refType, refId, createdAt, expiresAt, read, createdBy | recipient | admin create; peers only for swap notices; recipient: mark read / delete |
| `pushTokens` | employee id | token, platform, updatedAt | admin, owner | owner |
| `exportLogs` | auto | exportedAt, exportedBy, format, rangeStart, rangeEnd, recordCount, confirmedSaved | admin | admin create only |
| `auditLogs` | auto | actorId, at, action, refs | admin | admin create only |

Notes: notification docs hold IDs/references only (never copies of schedules or attendance). No photos, QR images, or
exported files are stored. `exportLogs` stores metadata only.

## Employee ID sequence (concurrency-safe)

`systemMeta/counters.employeeSeq` is read and incremented in a Firestore **transaction/batch** together with the
`employees/EMP-nnnn` create. Rules require `newCounter == oldCounter + 1` **and** `docId == 'EMP-' + pad4(newCounter)`.
Two concurrent creators both try to write the same counter value; the loser's transaction retries and fails on the
stale read, so IDs are unique, gap-free and never reused (deactivation keeps the doc; delete is denied).

## Attendance and QR

1. Admin rotates the credential: a random token is written to `qrCredentials/current` (`version + 1`). Employees cannot
   read it. The printed/displayed QR encodes `shiftline:v1:<token>`.
2. Employee scans → app writes `attendance/{employeeId}_{shiftId}` including `qrProof = token`. Rules compare
   `qrProof` with the live credential, so a replaced QR fails **immediately**.
3. Rules also verify: active employee, shift is theirs and published, `clockInAt == request.time` (server time, cannot be
   forged), no unknown fields, `late == false` (lateness is manual), and for `online` source the server time is inside
   `[start − early, start + late]` minutes from `workplaceSettings/main`.
4. Duplicates: the document id is deterministic and clock-in is a create-once; clock-out can only set empty fields once.
   The client treats "already exists with my actionId" as idempotent success.
5. Offline items (`source = offline`) are stored with `reviewStatus = pending_review`; rules do not let an employee
   self-confirm. Both `clockInReportedAt` (device time, untrusted) and `clockInAt` (server receipt) are kept.
6. Admin corrections must be committed in the same batch as an immutable `corrections/{id}` document naming the
   admin, with original and updated values. Rules enforce this pairing.

**Limitation (inherent):** a QR can be photographed or forwarded. A valid scan proves the person held the current code,
not that they are on site. Mitigations: rotate the code, admin review, the narrow window.

## Shift swap state machine

`pending_peer` → (colleague) `pending_admin` | `declined`; requester may `cancelled`; admin `pending_admin` →
`approved` | `rejected`. `approved` is only accepted if the **same atomic batch** moves the shift
(`getAfter(shift).employeeId == toEmployeeId`) and the shift still belonged to the requester beforehand
(`get(shift).employeeId == fromEmployeeId`). Two concurrent approvals for one shift cannot both commit. Employees cannot
write shifts at all.

## Notifications and 5-calendar-month retention

* `expiresAt = createdAt + 5 calendar months`, computed client-side with calendar-month arithmetic
  (`addCalendarMonths`). Rules require `150 ≤ days ≤ 153`, the range that five calendar months can span, so a client cannot
  set an arbitrary expiry.
* **Logical expiry:** the UI filters `expiresAt <= now` immediately.
* **Physical deletion:** Firestore TTL could remove documents, but TTL availability on Spark was **not verified**
  (the docs reviewed do not state a plan requirement, and TTL deletes can lag up to ~24 h). We do not depend on it. The
  app deletes expired docs opportunistically: employees delete their own on app open; admins sweep all expired docs in
  batches of ≤ 400. Until deletion happens the document still exists; the UI never claims otherwise.
* Cleanup deletes only `notifications`. Attendance, shifts, employees and corrections are untouched (and attendance deletes
  are denied by rules for everyone).

## Admin export reminders (independent of notifications)

State lives in `systemMeta/maintenance` and is computed from real attendance dates plus `exportLogs`, so it survives
notification expiry. Reminders: weekly export; the 30-day and 7-day warnings before the oldest notification expires; an
overdue banner whenever the admin opens the app. Local notifications are a best-effort extra and cannot guarantee delivery.

## Offline queue

Durable queue in AsyncStorage with a UUID per action; retries are idempotent via deterministic ids. AsyncStorage is
**not encrypted**: the queue stores only ids, action type, shift id, QR proof and timestamps, and is wiped on sign-out.
(Storing the QR proof locally is the sensitive part; it is only the current code and expires on rotation.)

## Push notifications

Isolated behind `PushDispatcher`. Remote push needs a sender with FCM credentials or the Expo push service, plus a
development build (Expo Go on Android SDK 53+ does not receive remote push). In-app notifications are the guaranteed
channel. Dispatch from an admin device to Expo's push API is the free path; it is not wired yet.
