// Public Firebase web config. These values identify the project; they are NOT secrets.
// Access control lives in firestore.rules. Never add service-account or admin credentials here.
const env = process.env;

export const firebaseConfig = {
  apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "",
};

export const googleClientIds = {
  web: env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
  android: env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "",
  ios: env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "",
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
