import { auth, db } from "@/src/firebase/client";
import { googleClientIds, isFirebaseConfigured } from "@/src/firebase/config";
import { C } from "@/src/firebase/paths";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signOut as fbSignOut, type User } from "firebase/auth";
import { doc, getDoc, onSnapshot, serverTimestamp, writeBatch } from "firebase/firestore";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

WebBrowser.maybeCompleteAuthSession();

export type Profile = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  role: "employee" | "admin";
  status: "active" | "deactivated";
};

// Every state maps to a distinct, user-visible message; none of them grants data access by itself.
export type AuthStatus =
  | "unconfigured" // Firebase env vars missing
  | "loading"
  | "signedOut"
  | "checking" // verifying authorization / linking account
  | "ready"
  | "unauthorized" // Google account has no employee authorization
  | "alreadyLinked" // authorization claimed by a different Google account
  | "deactivated"
  | "error";

type AuthCtx = {
  status: AuthStatus;
  profile: Profile | null;
  googleEmail: string | null;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  canSignIn: boolean;
};

const Ctx = createContext<AuthCtx | null>(null);

/** Run on sign-out so private cached data (e.g. the offline queue) does not survive account switches. */
const signOutHooks = new Set<() => void | Promise<void>>();
export function onSignOutCleanup(fn: () => void | Promise<void>) {
  signOutHooks.add(fn);
  return () => {
    signOutHooks.delete(fn);
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(isFirebaseConfigured ? "loading" : "unconfigured");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unsubProfile = useRef<(() => void) | null>(null);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: googleClientIds.web || undefined,
    androidClientId: googleClientIds.android || undefined,
    iosClientId: googleClientIds.ios || undefined,
  });

  // Exchange the Google ID token for a Firebase session.
  useEffect(() => {
    if (response?.type === "success") {
      const idToken = response.params.id_token;
      setStatus("checking");
      signInWithCredential(auth, GoogleAuthProvider.credential(idToken)).catch((e) => {
        setError(e?.message ?? "Google sign-in failed.");
        setStatus("error");
      });
    } else if (response?.type === "error") {
      setError(response.error?.message ?? "Google sign-in failed.");
      setStatus("error");
    }
  }, [response]);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const unsub = onAuthStateChanged(auth, (user) => {
      unsubProfile.current?.();
      unsubProfile.current = null;
      if (!user) {
        setProfile(null);
        setGoogleEmail(null);
        setStatus("signedOut");
        return;
      }
      setGoogleEmail(user.email);
      void resolveIdentity(user);
    });
    return () => {
      unsub();
      unsubProfile.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resolveIdentity(user: User) {
    setStatus("checking");
    setError(null);
    try {
      if (!user.emailVerified || !user.email) {
        setStatus("unauthorized");
        return;
      }
      const emailKey = user.email.toLowerCase();
      let link = await getDoc(doc(db, C.userLinks, user.uid));

      if (!link.exists()) {
        // First sign-in: the account must be pre-authorized by an administrator.
        const authRef = doc(db, C.authorizations, emailKey);
        const authSnap = await getDoc(authRef);
        if (!authSnap.exists()) {
          setStatus("unauthorized");
          return;
        }
        const a = authSnap.data();
        if (a.claimedByUid && a.claimedByUid !== user.uid) {
          setStatus("alreadyLinked");
          return;
        }
        if (!a.claimedByUid) {
          const batch = writeBatch(db);
          batch.set(doc(db, C.userLinks, user.uid), { employeeId: a.employeeId, linkedAt: serverTimestamp() });
          batch.update(authRef, { claimedByUid: user.uid, claimedAt: serverTimestamp() });
          await batch.commit(); // rules re-verify everything server-side
        }
        link = await getDoc(doc(db, C.userLinks, user.uid));
      }

      const employeeId = link.data()?.employeeId as string;
      // Live listener: deactivation or role change reaches the UI immediately.
      unsubProfile.current = onSnapshot(
        doc(db, C.employees, employeeId),
        (snap) => {
          if (!snap.exists()) {
            setStatus("unauthorized");
            return;
          }
          const d = snap.data();
          const p: Profile = {
            id: snap.id,
            firstName: d.firstName,
            lastName: d.lastName,
            email: d.email,
            phone: d.phone ?? "",
            title: d.title ?? "",
            role: d.role,
            status: d.status,
          };
          setProfile(p);
          setStatus(p.status === "active" ? "ready" : "deactivated");
        },
        (e) => {
          setError(e.message);
          setStatus("error");
        }
      );
    } catch (e: any) {
      setError(
        e?.code === "permission-denied" ? "Access was denied by the workplace service." : e?.message ?? "Could not verify your account."
      );
      setStatus("error");
    }
  }

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    await promptAsync();
  }, [promptAsync]);

  const signOut = useCallback(async () => {
    unsubProfile.current?.();
    unsubProfile.current = null;
    for (const fn of signOutHooks) {
      try {
        await fn();
      } catch {
        /* best-effort cleanup */
      }
    }
    await fbSignOut(auth);
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({ status, profile, googleEmail, error, signInWithGoogle, signOut, canSignIn: !!request }),
    [status, profile, googleEmail, error, signInWithGoogle, signOut, request]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
