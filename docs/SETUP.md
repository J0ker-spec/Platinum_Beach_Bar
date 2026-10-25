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
`npm start`. The app has no demo/fake-data mode: every screen reads the signed-in workplace from Firestore.

## 5. Tests
Rules tests need the Firestore emulator and **JDK 21+** (`java -version`).
`npm run test:rules` (wraps `firebase emulators:exec`). Tests use synthetic users only.

## 6. Deploy the web app to Vercel
1. Import this GitHub repository in Vercel and use the repository root as the project root. `vercel.json`
   configures the web export command (`npm run build:web`) and its `dist` output directory.
2. In Vercel project settings, add the six `EXPO_PUBLIC_FIREBASE_*` values from `.env.example` for
   **Production**, **Preview**, and **Development** as needed. These public Firebase web configuration
   values are compiled into the browser app; never add a service-account key or administrator password.
3. Redeploy after adding or changing environment variables. To build locally, run `npm run build:web`;
   Expo writes the static web export to `dist/`.
4. After Vercel assigns the site a domain, add that hostname to Firebase Console → Authentication →
   Settings → Authorized domains. Repeat this for any custom domain you attach in Vercel.
5. Keep Firestore rules deployed with `npx firebase deploy --only firestore:rules --project <id>`.
   Hosting the web bundle on Vercel does not deploy Firebase rules or change the Firebase project.
6. PlatinumX is installable as a PWA. On Android/desktop Chrome, use the browser's **Install app** or
   **Add to Home screen** action. On iPhone/iPad, open the site in Safari, tap **Share**, then **Add to Home Screen**.
   The PWA requires an internet connection; it does not cache workplace data for offline use.
