# Architecture and Firestore schema

Authentication, core Firestore workflows, and in-app notifications are designed to use the Firebase Spark plan.
The app does not use Cloud Functions, Cloud Scheduler, or remote push notifications. Firestore rules are the
access-control layer for client reads and writes.

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
| `directory` | employee id | displayName, title, role, status | any active employee | admin. Minimal fields so swap pickers need no private data |
| `systemMeta/counters` | – | employeeSeq | admin | admin, +1 only. **Seeded from console** |
| `systemMeta/maintenance` | – | lastExportAt, lastExportRangeEnd, reminder state | admin | admin |
| `workplaceSettings/main` | – | businessName, businessAddress, businessPhone, businessEmail, timezone, clockInEarlyMinutes, clockInLateMinutes | active employees | admin |
| `qrCredentials/current` | – | token (≥32 chars), version, rotatedBy, rotatedAt | **admin only** | admin; version must increment |
| `shifts` | auto | employeeId, date, startAt, endAt (timestamps), breakMinutes, label, location, notes, status (`draft`/`published`/`cancelled`), createdBy, updatedBy, createdAt, updatedAt, revision, changedAfterPublish | admin; employee: own **published** only | admin |
| `attendance` | `{employeeId}_{shiftId}` | employeeId, shiftId, shiftDate, clockInAt (server), clockInReportedAt (device), clockInSource, clockInActionId, qrProof, clockOut* (same), reviewStatus (`confirmed`/`pending_review`/`rejected`), late, lastCorrectionId | admin; owner | employee: create clock-in once, set clock-out once; admin: only with a paired correction doc; **never deleted** |
| `attendance/{id}/corrections` | auto | adminId, changedAt (server), original, updated, note | admin | admin create only (append-only) |
| `shiftSwapRequests` | auto | fromEmployeeId, toEmployeeId, shiftId, validated shift summary, reason, status, createdAt, updatedAt, decidedBy | admin; the two parties | see state machine below |
| `announcements` | auto | title, body, priority, status, audience (`all`/`selected`), audienceIds, publishedBy, publishedAt | admin; active employee if published and in audience | admin |
| `notifications` | auto | recipientId, type, title, refType, refId, createdAt, expiresAt, read, createdBy | recipient | admin create; peers only for swap notices; recipient: mark read / delete |
| `employees/{employeeId}/notificationPreferences/current` | fixed | schedule, announcements, swaps, updatedAt | admin, owner | owner |
| `exportLogs` | auto | exportedAt, exportedBy, format, rangeStart, rangeEnd, recordCount, confirmedSaved | admin | admin create only |
| `auditLogs` | auto | actorId, at, action, refs | admin | admin create only |

Notes: notification docs hold IDs/references only (never copies of schedules or attendance). No photos, QR images, or
exported files are stored. `exportLogs` stores metadata only.

The administrator configures an IANA workplace time zone before creating shifts. Shift wall times are converted to
Firestore timestamps in that zone, and displayed schedule and attendance times use the same zone. The app prevents
changing the zone after shift or attendance records exist so existing timestamps are not silently reinterpreted.
Weekly repeats are expanded into individual draft shifts for a selected finite period (1, 2, 3, 6, or 12 calendar
months); they are not ongoing recurrence rules. Admins can review, edit, delete, and publish saved drafts from the
schedule's all-drafts list, including drafts from earlier weeks.

### Scheduling invariants

* Drafts are created with `revision: 1`; every edit, publish, cancel, or reassignment increments `revision`.
  Publishing re-reads the selected drafts and refuses the commit when a revision changed after the preview
  (optimistic concurrency), so an administrator never publishes a stale version.
* Client-side overlap checks (`src/lib/scheduling.ts`) reject two non-cancelled shifts for one employee whose
  `[startAt, endAt)` intervals intersect. Rules cannot query, so this remains an application-level guard.
* Bulk publish writes at most **8 shifts per batch**. Rules charge each update for the acting identity plus the
  assigned employee and the attendance-existence check; Firestore allows 20 document access calls per batched
  write. Repeated shift creation applies the same accounting and starts a new batch before the nineteenth
  distinct employee.
* A published shift can be cancelled even after the assigned employee was deactivated, so deactivation never
  leaves an unremovable shift on the calendar. Drafts can always be deleted while they have no attendance.
* `location` is stored with the shift (a snapshot of the workplace name at creation); `notes` is separate.
* Announcement drafts are ordinary `announcements` documents with `status: 'draft'`. Any administrator may edit,
  publish, or delete a saved draft; the original `publishedBy`/`createdAt` are immutable, and notifications are
  sent only when a draft is first published (not on later corrections).

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
   forged), no unknown fields, `late == false`, and for `online` source the server time is inside
   `[start − early, start + late]` minutes from `workplaceSettings/main`. When those settings were never saved the rules
   fall back to the documented defaults (15 minutes early, 120 minutes late), so a new workplace is not locked out.
4. Lateness is derived: the stored `late` flag is only written by administrator corrections, and the UI also compares
   the clock-in with the scheduled start (one minute of grace). The employee can never mark themselves late.
5. Duplicates: the document id is deterministic and clock-in is a create-once; clock-out can only set empty fields once.
   The client treats an existing record as "already clocked in".
6. Offline items (`source = offline`) are stored with `reviewStatus = pending_review`; rules do not let an employee
   self-confirm. Both `clockInReportedAt` (device time, untrusted) and `clockInAt` (server receipt) are kept.
7. Admin corrections must be committed in the same batch as an immutable `corrections/{id}` document naming the
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
* Notifications are in-app Firestore documents for schedule, announcement, and shift-swap updates. User preferences filter
  these updates in the notification feed; they do not control device push delivery.
* No scheduled shift reminders, remote push delivery, or automated export reminders are configured. Expired notification
  documents are not automatically removed by a server service.

## Offline queue

Durable queue in AsyncStorage with a UUID per action; retries are idempotent via deterministic ids. AsyncStorage is
**not encrypted**: the queue stores only ids, action type, shift id, QR proof and timestamps, and is wiped on sign-out.
(Storing the QR proof locally is the sensitive part; it is only the current code and expires on rotation.)
