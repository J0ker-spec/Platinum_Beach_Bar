# First-admin provisioning (one-time, trusted)

Security rules deliberately forbid clients from creating admins or seeding the counter. The developer, acting as project
owner in the Firebase console (a trusted channel that bypasses rules), creates three documents **once**:

1. `systemMeta/counters` → `{ employeeSeq: 1 }`
2. `employees/EMP-0001` →
   `firstName`, `lastName`, `email` (lowercase Google email), `phone: ""`, `title`, `role: "admin"`, `status: "active"`,
   `createdBy: "EMP-0001"`, `createdAt` / `updatedAt` (timestamps)
3. `employeeAuthorizations/<that lowercase email>` → `{ employeeId: "EMP-0001", claimedByUid: null }`
4. (optional) `directory/EMP-0001` → `{ displayName, title, status: "active" }`
5. `workplaceSettings/main` → `clockInEarlyMinutes: 15, clockInLateMinutes: 120, businessName, timezone`.

Then sign in with that Google account: the app claims the authorization and opens the admin experience. After this, the
admin adds everyone else from the app; IDs continue as EMP-0002, EMP-0003, …

Safe testing: use a spare Google account, or the emulator (`npm run test:rules` uses synthetic users). Never put real
employee data in fixtures.

Changing the owner later: promote another employee to admin in the app, then give that person Firebase project Owner
access (see HANDOVER notes in the final report once written).

## Scripted alternative (email + password admin)

`scripts/provision-admin.cjs` does all of the above from the terminal, using the credentials of the account logged in to
the Firebase CLI (`firebase login`). It also creates the Firebase Auth user with a verified email, so the admin can log
in with email + password right away. Pass the password through the environment, never commit it:

```powershell
$env:FIREBASE_PROJECT="platnumx"; $env:ADMIN_EMAIL="admin@example.com"; $env:ADMIN_PASSWORD="<password>"
$env:ADMIN_FIRST="Admin"; $env:ADMIN_LAST="User"
node scripts/provision-admin.cjs
```

Re-running is safe: it resets the password/verification and rewrites the seed documents. Change the password after the
first login (Forgot password sends a reset email).
