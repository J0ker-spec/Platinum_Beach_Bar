# Setup guide

## 1. Firebase project
1. console.firebase.google.com → Add project. The app uses Firebase Authentication and Cloud Firestore, which are available on Spark within their quotas. No Cloud Functions, Cloud Scheduler, or remote push services are part of this setup.
2. Build → Firestore Database → Create (production mode, choose a region near the business).
3. Build → Authentication → Sign-in method → enable **Google**.
4. Project settings → Your apps → add a **Web app**; copy the config into `.env` (see `.env.example`).
5. Deploy rules and indexes: `npx firebase login`, then `npx firebase deploy --only firestore --project <id>`.
   Edit `.firebaserc` to your project id first.

Before creating shifts, sign in as an administrator and set the workplace IANA time zone under **Workplace time zone**
(for example, `America/New_York`). Shift times and date-based screens use this setting, including daylight-saving
changes. To protect existing schedules and attendance timestamps, the app locks the setting once records exist.

## 2. Google sign-in (needs a development build, not Expo Go)
Google blocks OAuth redirects to `exp://` for native clients, and the app uses `expo-auth-session`'s Google provider
with real client IDs, so **Expo Go cannot complete sign-in**. Use a development build:
1. Google Cloud console (same project) → APIs & Services → Credentials. Create OAuth client IDs:
   Web (copy to `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`), Android (package `com.vidal.platinumx` plus the SHA-1 of your
   signing key), iOS if needed.
2. Add the Android/iOS IDs to `.env`.
3. `npx expo install expo-dev-client`, then `npx eas build --profile development --platform android`
   (EAS free tier) or `npx expo run:android` with Android Studio. Install the APK and run `npx expo start --dev-client`.
Until configured the login screen shows "Backend not configured" — it never fakes a sign-in.

## 3. First administrator → see [FIRST_ADMIN.md](FIRST_ADMIN.md)

## 4. Run
`npm start` (demo data only when `EXPO_PUBLIC_DEMO_MODE=true`).

## 5. Tests
Rules tests need the Firestore emulator and **JDK 21+** (`java -version`).
`npm run test:rules` (wraps `firebase emulators:exec`). Tests use synthetic users only.
