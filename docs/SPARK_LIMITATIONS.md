# Firebase Spark limitations and remaining risks

Verified against Firebase documentation during the audit:

| Capability | Spark status | What this project does |
|---|---|---|
| Authentication (Google) | Included | Used |
| Cloud Firestore | Included, daily quotas (20k writes / 50k reads / 20k deletes) | Used; lists paginated, listeners preferred over polling |
| Cloud Functions / Cloud Scheduler | **Blaze required** | Not used by this project; core workflows run from the app and Firestore rules |
| Managed Firestore export / scheduled backups | **Requires Blaze** | No automated or app-managed database backup is configured |
| Firestore TTL | **Unverified for Spark**: docs show no plan requirement, deletes lag up to 24 h | Not relied on; opportunistic client cleanup |
| Remote push notifications / scheduled reminders | Not configured | The app provides only Firestore-backed in-app notifications |

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
8. **Rules are the single enforcement layer.** A rules mistake is a security mistake; hence `tests/rules`. These tests only
   count when run against the emulator (JDK 21+). See SETUP.md.

## Features that need a separate server or billing upgrade

automated off-device backups; guaranteed-time notification deletion; server-side overlap validation; permanent
anonymization/deletion jobs; custom auth claims. These require services outside the current Spark-only application setup
and are not implemented.
