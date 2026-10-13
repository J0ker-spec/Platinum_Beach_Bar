# Firebase Spark limitations and remaining risks

Verified against Firebase documentation during the audit:

| Capability | Spark status | What this project does |
|---|---|---|
| Authentication (Google) | Included | Used |
| Cloud Firestore | Included, daily quotas (20k writes / 50k reads / 20k deletes) | Used; lists paginated, listeners preferred over polling |
| Cloud Functions (incl. scheduled) | **Not deployable on Spark** (existing functions stop after a downgrade) | Not used |
| Managed Firestore export / scheduled backups | **Requires Blaze** | Replaced by a manual, admin-confirmed CSV/Excel export workflow with weekly reminders. This is *not* an automated database backup. |
| Firestore TTL | **Unverified for Spark**: docs show no plan requirement, deletes lag up to 24 h | Not relied on; opportunistic client cleanup |
| FCM / Expo push | Free to receive; sending needs a sender | Interface only; see ARCHITECTURE.md |

## What Security Rules cannot guarantee (identified risks)

1. **Overlapping shifts / double booking.** Rules cannot query. Overlap checks are client-side (admin app). A modified admin client
   could create overlaps. Impact: scheduling mistake only, by an already-trusted admin.
2. **Duplicate swap requests** for the same shift are checked client-side only.
3. **Notification fan-out.** Admin clients write one notification per recipient; a crash mid-way can leave some recipients
   without one. Announcements themselves remain visible to the audience.
4. **Offline items bypass the clock-in window** (device time is untrusted) and are therefore forced into `pending_review`.
   An employee online can label an action "offline" to skip the window; it still needs admin approval.
5. **QR is shareable.** See ARCHITECTURE.md. Not proof of presence.
6. **Extra `get()` reads per request** count against the 50k/day read quota. Fine for < 25 employees; monitor if the workforce grows.
7. **Trusted admins.** An admin can do anything an admin UI offers; the audit trail protects attendance values, not other data.
8. **Reminders and local notifications** cannot fire when the app is unused, offline, or notifications are disabled.
   Overdue banners appear on next open.
9. **Rules are the single enforcement layer.** A rules mistake is a security mistake; hence `tests/rules`. These tests only
   count when run against the emulator (JDK 21+). See SETUP.md.

## Features that need a separate server or billing upgrade

Automated weekly off-device backups; guaranteed-time notification deletion; server-sent push on schedule; server-side
overlap validation; permanent anonymization/deletion jobs; custom auth claims. Each is isolated so adding Cloud Functions
(Blaze) later does not require rewriting the app.
