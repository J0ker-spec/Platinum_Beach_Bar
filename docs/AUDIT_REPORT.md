# System audit — issues found, fixes, and verification

Date: 2026-10-22. Scope: the Expo/React Native client, the Firestore data layer, security rules,
authentication, validation, state management, and the automated tests. The scheduling system and
announcement/shift draft management were the focus.

## How the work was verified

| Check | Command | Result |
|---|---|---|
| TypeScript (strict) | `npm run typecheck` | no errors |
| Unit tests | `npm run test:unit` | 55 passed (5 files) |
| Firestore rules + workflow tests | `npm run test:rules` (JDK 21) | 47 passed |
| Web bundle (module resolution) | `npx expo export --platform web` | bundle exported successfully |
| Live rules deployment | `npx firebase deploy --only firestore:rules --project platnumx` | compiled and released |

New tests added:

* `tests/unit/scheduling.test.ts` — overlap detection, repeat weekdays, clock-in window, shift
  selection (including overnight shifts), open-record selection, attendance status/lateness.
* `tests/rules/rules.test.ts` — end-to-end schedule lifecycle, shift `location`, cancelling a shift
  after deactivation, announcement draft edit/publish/delete by another admin, announcement
  validation, clock-in with unsaved workplace settings.

The rules suite was already failing at `HEAD`: it asserted that a nine-update batch exceeds
Firestore's 20 document-access limit, but nine updates use exactly 20 calls and succeed. The test now
asserts the real boundary (ten updates = 22 calls) and keeps the app's batch size of 8.

## Scheduling

| # | Issue | Fix |
|---|---|---|
| 1 | `toShift` copied `notes` into `location`, so every shift card showed the note twice and the workplace name was lost. | `location` is now its own field, persisted on create/update and allowed by the rules (≤120 chars). |
| 2 | A repeating shift defaulted its weekdays to *today's* weekday. Choosing a different start date produced shifts on the wrong days and often none on the chosen date. | Changing the start date (or enabling repeat) selects that date's weekday; the form warns when the chosen date is not among the repeat days, and refuses to save a repeat with no weekdays. |
| 3 | Single shifts could only be dated within the next 14 days. | The date picker covers 60 days (repeats still cover up to 12 months). |
| 4 | Picking a time chip did not clear the "exact time" text box, so a previously typed invalid value kept the form disabled. | Choosing a chip clears the corresponding text field. |
| 5 | Opening the editor for a shift that no longer exists showed "Loading shift…" forever. | A timeout switches to a clear "shift no longer exists" screen with a back action. |
| 6 | Reassigning a shift only checked attendance for the *new* employee, so the old assignee's attendance was not protected (the write then failed with an opaque permission error). | Both `{oldEmployee}_{shift}` and `{newEmployee}_{shift}` attendance records are checked before saving. |
| 7 | A shift assigned to a deactivated (or promoted) employee could not be opened/edited because the staff picker excluded them. | The current assignee is always included in the picker so the shift can be reassigned. |
| 8 | A published shift belonging to a deactivated employee could never be cancelled (rules required an active employee for any update), leaving unremovable shifts on the calendar. | Rules now allow the narrow `published → cancelled` transition without the active-employee requirement (still revision-checked and attendance-guarded). |
| 9 | Bulk creation wrote up to 400 shifts in one batch; with many distinct employees this exceeds the rules access-call limit. | Batches are split before the 19th distinct employee (and at 400 writes); publish remains at 8 shifts per batch. |
| 10 | A cancelled shift could re-enter the editing path. | Explicitly refused in the store, and the UI already hides Edit for cancelled shifts. |
| 11 | Same-day dates rendered as a range ("Oct 22 – Oct 22") in the publish preview, draft list, and shift sheet. | Uses `formatPretty` (e.g. "Thu, Oct 22"). |
| 12 | The admin "Present" card counted attendance rows instead of people; the day list was unsorted; the "today" highlight in the week strip used the device's UTC date instead of the workplace date. | Corrected counts, sorted days, and the workplace today is passed to `WeekStrip`. |
| 13 | Overlap checks, clock-in selection, and attendance labels were embedded in React code and untestable. | Extracted to `src/lib/scheduling.ts` with 16 unit tests; the store uses the same functions. |

Publishing keeps its existing design: drafts are re-read, revisions compared with the preview, and
only the reviewed drafts are published, then notifications fan out.

## Draft management

### Shift drafts
Editing, deleting, and publishing existing drafts already existed but had the problems above (missing
shift loading, deactivated assignee, attendance check, cancelled state). The "All saved drafts" sheet
now closes before opening the shift sheet, avoiding a two-modal-in-one-frame race that can swallow the
second sheet on some platforms.

### Announcement drafts (previously unusable)
| # | Issue | Fix |
|---|---|---|
| 1 | There was no way to open, edit, or delete a saved announcement draft; the list was read-only. | Draft cards now open the editor and offer Edit / Publish / Delete. |
| 2 | `saveAnnouncementDraft` always used `addDoc`, so every save created a duplicate document. | It now updates the existing draft when the item has an id, otherwise creates one. |
| 3 | Publishing a saved draft created a second published document and left the draft behind. | Publishing updates the same document and removes it from the Draft tab. |
| 4 | Editing a draft after a reload could create a duplicate because the form never loaded the draft. | The form accepts `announcementId`, prefills the content, and shows a loading/not-found state (also prevents creating when the draft vanished). |
| 5 | The rules only let the *original author* update an announcement. | Any administrator may edit a draft; `publishedBy` and `createdAt` stay immutable. |
| 6 | Publisher was displayed as an employee id (`EMP-0001`). | Displayed as the person's name. |
| 7 | Every save of a published announcement re-notified the whole team and reset `publishedAt`. | Notifications only on a draft's first publication; the original publication time is preserved on later corrections. |
| 8 | No content bounds; empty titles/bodies and empty "selected" audiences could be stored. | Store validation plus rules bounds (title 200, body 5000, audience list non-empty) and matching input limits. |

## Authentication, login, and signup

| # | Issue | Fix |
|---|---|---|
| 1 | Login button label contained mojibake (`Checking your accountâ€¦`). | Correct ellipsis. |
| 2 | Five auth screens used `useEffect(() => clearError, …)`, which clears the error on *unmount* instead of on entry, so stale errors leaked between screens. | Clear on mount. |
| 3 | Identity checks could race: signing out (or re-checking approval) while a check was in flight could later restore `ready`/an old profile; each re-check also leaked the previous employee listener. | Each check carries a generation number, stale results are discarded, and the previous listener is always unsubscribed. |
| 4 | Right after sign-up the auth listener can still report "signedOut", so the verify screen could bounce the new user back to sign-up. | The redirect also requires `auth.currentUser` to be absent. |
| 5 | "I've verified my email" silently did nothing when the address was still unverified. | Shows a specific message; the function now reports verification state. |
| 6 | "Check again" on the approval screen gave no feedback and did not leave for blocked states. | Shows "still waiting" and redirects for unauthorized/deactivated/error states. |
| 7 | A dead demo/preview mode (`EXPO_PUBLIC_DEMO_MODE`) bypassed the route guards but had no data source (`signIn` was a no-op), leaving empty screens. | Removed the preview screen, the login entry, the env checks, and the setup documentation for it. |
| 8 | Duplicate sign-out (store + screen) and misleading copy ("Nothing is saved to a server", "login preview"). | Single sign-out path and accurate copy. |

## Clocking in and out

| # | Issue | Fix |
|---|---|---|
| 1 | Clock-out closed an arbitrary open record (array order), e.g. a missed clock-out from days earlier. | The newest open record is selected; shared helper used by the store and the scan screen. |
| 2 | Clock-out was impossible when the employee had no shift *today* (e.g. an overnight shift already ended). | Clocking out only requires an open attendance record. |
| 3 | Clock-in always used the first published shift of the day, even when it had ended or was already recorded. | Selection prefers a shift whose clock-in window is open, skips recorded shifts, keeps a second shift on the same day usable, and handles overnight windows. |
| 4 | Being outside the clock-in window was reported as "QR code was replaced". | A dedicated message shows the allowed window for that shift. |
| 5 | A replay of an existing clock-in was reported as a replaced/revoked code. | The client detects the existing record and shows "Already clocked in". |
| 6 | The `Late` badge, filter and dashboard counters were dead: rules force `late: false` and nothing ever set it, and corrections preserved `false`. | Lateness is derived from the clock-in time against the scheduled start (1 minute grace) and written by admin corrections. |
| 7 | Clock-in failed for any workplace that had never saved business/settings, because the rules read `workplaceSettings/main` unconditionally. | Rules fall back to the documented defaults (15 min early / 120 min late); the client uses the same defaults. |
| 8 | "Last clock-in" showed "Not recorded yet" after an app restart. | Falls back to today's stored attendance record. |
| 9 | Dashboard/attendance "not in" counted employees who had already clocked out, and "Present" could exceed headcount. | Counts are based on distinct employees with a clock-in today. |
| 10 | The QR screen label still said "Replacement code preview" for the live code. | "Current attendance code". |

## Employees, dashboard, and other data bugs

* Editing an employee's email silently did nothing (rules keep the email immutable because it keys the
  sign-in authorization). The email field is now read-only when editing, with an explanation.
* The "Internal notes" field was discarded on save (no schema field). It was removed rather than
  pretending to save.
* The new-employee screen displayed a guessed ID that often did not match the server-assigned one. It
  now says the ID is assigned on save.
* Opening the employee editor before the employee list loaded produced an empty form that would create
  a duplicate employee. It now waits and reports a missing record.
* Employee detail listed the first three shifts regardless of date/status; it now lists upcoming,
  non-cancelled shifts in order and recent attendance newest-first.
* The dashboard crashed if a shift referenced an employee document that was not loaded.
* Attendance history fell back to `EMP-0001` when the session id was missing.
* Employee "Attendance" crashed with a non-null assertion before the profile loaded.
* `markNotificationsRead` could exceed Firestore's 500-write batch limit and its rejection was
  unhandled from the Updates screen. It now chunks and reports failures.
* Firestore write failures surfaced as raw `permission-denied` messages. The store now maps them to
  actionable messages.

## Remaining problems / limitations (not fixed)

1. **Cancelled shifts disappear from the employee's schedule** because employees may only read
   `status == 'published'`. They learn about cancellations through the notification. Changing this
   would need a rules change that allows reading cancelled shifts, which also exposes cancelled rows
   in queries.
2. **Overlap and duplicate-swap checks are client-side.** Firestore rules cannot query, so a modified
   admin client could create overlapping shifts (documented in `docs/SPARK_LIMITATIONS.md`).
3. **Employees cannot see the exact cancellation reason**; only the notification title is shown.
4. **A very old open attendance record can still be closed by a clock-out.** The rules put no window on
   clock-out; the client now picks the newest open record, but a stale record may need an
   administrator correction. A time limit would be a product decision.
5. **Employee deletion is a UI-only "preview"** (`employee-detail`); the rules forbid deleting
   employee documents. Deactivation is the supported path. This was left as-is, but the copy says so.
6. **The employee "Copy employee ID" action is a preview** (no clipboard integration).
7. **Demo mode was removed** rather than rebuilt; there is no offline/fake-data mode.
8. **Rules must stay deployed.** This change set was deployed to `platnumx`; other Firebase projects
   need `npx firebase deploy --only firestore --project <id>`.
9. Announcement bodies are now limited to 5,000 characters in the rules; a legacy announcement longer
   than that would need to be shortened before it can be edited.
10. The Firestore rules emit a harmless warning about an unused `docs()` helper function.
