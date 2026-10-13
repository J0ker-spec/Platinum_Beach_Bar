import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
// getReactNativePersistence is exported from the React Native build of firebase/auth.
// @ts-ignore - not present in the default (web) type declarations
import { getReactNativePersistence, initializeAuth, getAuth } from "firebase/auth";
import { initializeFirestore, getFirestore } from "firebase/firestore";
import { firebaseConfig } from "./config";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

function makeAuth() {
  try {
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    return getAuth(app); // already initialised (fast refresh)
  }
}

function makeDb() {
  try {
    // Long-polling auto-detect avoids WebChannel problems on some React Native networks.
    return initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  } catch {
    return getFirestore(app);
  }
}

export const auth = makeAuth();
export const db = makeDb();
