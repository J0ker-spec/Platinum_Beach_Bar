import { auth, db } from "@/src/firebase/client";
import { googleClientIds, isFirebaseConfigured } from "@/src/firebase/config";
import { C } from "@/src/firebase/paths";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";

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
  | "unverified" // email/password account whose email address has not been verified yet
  | "pendingApproval" // email verified, but no administrator has approved + assigned a role yet
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
  signUpWithEmail: (input: { name: string; email: string; password: string }) => Promise<boolean>;
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  sendPasswordReset: (email: string) => Promise<boolean>;
  resendVerification: () => Promise<boolean>;
  refreshVerification: () => Promise<boolean>;
  clearError: () => void;
  signOut: () => Promise<void>;
  canSignIn: boolean;
};

/** Turn Firebase Auth error codes into messages a person can act on. */
export function authErrorMessage(e: any): string {
  switch (e?.code) {
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try logging in instead.";
    case "auth/invalid-email":
      return "That email address doesn't look right.";
    case "auth/weak-password":
      return "Choose a stronger password (at least 8 characters).";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact your administrator.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes and try again.";
    case "auth/network-request-failed":
      return "Can't reach the server. Check your connection and try again.";
    default:
      return e?.message ?? "Something went wrong. Please try again.";
  }
}

const Ctx = createContext<AuthCtx | null>(null);

const hasGoogleClientId =
  Platform.OS === "ios"
    ? !!googleClientIds.ios
    : Platform.OS === "android"
      ? !!googleClientIds.android
      : !!googleClientIds.web;

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
  const [promptGoogle, setPromptGoogle] = useState<(() => Promise<void>) | null>(null);
  const unsubProfile = useRef<(() => void) | null>(null);
  // Every identity check gets a number. A slower, older check must never overwrite the result of
  // a newer one (e.g. sign-out while the authorization lookup is still running).
  const identityRun = useRef(0);

  const handleGoogleSuccess = useCallback((idToken: string) => {
    setStatus("checking");
    signInWithCredential(auth, GoogleAuthProvider.credential(idToken)).catch((e) => {
      setError(e?.message ?? "Google sign-in failed.");
      setStatus("error");
    });
  }, []);

  const handleGoogleError = useCallback((message: string) => {
    setError(message);
    setStatus("error");
  }, []);

  const handlePromptReady = useCallback((prompt: (() => Promise<void>) | null) => {
    setPromptGoogle(() => prompt);
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const unsub = onAuthStateChanged(auth, (user) => {
      unsubProfile.current?.();
      unsubProfile.current = null;
      if (!user) {
        identityRun.current += 1; // invalidate any identity check still in flight
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
    const run = identityRun.current + 1;
    identityRun.current = run;
    // A re-check (e.g. "Check again" on the pending screen) must not leave the previous
    // employee listener attached, otherwise profile updates are applied twice.
    unsubProfile.current?.();
    unsubProfile.current = null;
    const isStale = () => run !== identityRun.current;
    setStatus("checking");
    setError(null);
    try {
      if (!user.email) {
        setStatus("unauthorized");
        return;
      }
      if (!user.emailVerified) {
        await reload(user).catch(() => undefined);
      }
      if (isStale()) return;
      if (!user.emailVerified) {
        setStatus("unverified");
        return;
      }
      await user.getIdToken(true).catch(() => undefined);
      if (isStale()) return;
      const emailKey = user.email.toLowerCase();
      let link = await getDoc(doc(db, C.userLinks, user.uid));
      if (isStale()) return;

      if (!link.exists()) {
        // First sign-in: the account must be pre-authorized by an administrator.
        const authRef = doc(db, C.authorizations, emailKey);
        const authSnap = await getDoc(authRef);
        if (isStale()) return;
        if (authSnap.exists() && authSnap.data()?.claimedByUid && authSnap.data()?.claimedByUid !== user.uid) {
          setStatus("alreadyLinked");
          return;
        }
        if (authSnap.exists() && !authSnap.data()?.claimedByUid) {
          const batch = writeBatch(db);
          batch.set(doc(db, C.userLinks, user.uid), { employeeId: authSnap.data()!.employeeId, linkedAt: serverTimestamp() });
          batch.update(authRef, { claimedByUid: user.uid, claimedAt: serverTimestamp() });
          await batch.commit(); // rules re-verify everything server-side
          link = await getDoc(doc(db, C.userLinks, user.uid));
          if (isStale()) return;
          // Sign-up wrote a pending registration; now that the account is linked it must not stay in
          // the administrators' approval queue (approving it would create a duplicate employee).
          await deleteDoc(doc(db, C.registrations, user.uid)).catch(() => undefined);
        } else {
          // Email verified but no authorization yet: register for administrator approval.
          // Doc id = auth uid, so a user can only have one pending registration (create-once).
          await setDoc(
            doc(db, C.registrations, user.uid),
            {
              email: emailKey,
              name: user.displayName ?? user.email ?? "",
              status: "pending",
              createdAt: serverTimestamp(),
            },
            { merge: true }
          ).catch((e) => {
            console.warn("Could not write registration document:", e);
          });
          if (isStale()) return;
          setStatus("pendingApproval");
          return;
        }
      }

      const employeeId = link.data()?.employeeId as string;
      if (!employeeId) {
        setStatus("unauthorized");
        return;
      }
      // Live listener: deactivation or role change reaches the UI immediately.
      unsubProfile.current = onSnapshot(
        doc(db, C.employees, employeeId),
        (snap) => {
          if (isStale()) return;
          if (!snap.exists()) {
            setProfile(null);
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
          if (isStale()) return;
          setError(e.message);
          setStatus("error");
        }
      );
    } catch (e: any) {
      if (isStale()) return;
      setError(
        e?.code === "permission-denied" ? "Access was denied by the workplace service." : e?.message ?? "Could not verify your account."
      );
      setStatus("error");
    }
  }

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    if (!promptGoogle) {
      setError("Google sign-in is not configured for this platform.");
      setStatus("error");
      return;
    }
    await promptGoogle();
  }, [promptGoogle]);

  const signUpWithEmail = useCallback(async ({ name, email, password }: { name: string; email: string; password: string }) => {
    setError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
      await setDoc(
        doc(db, C.registrations, cred.user.uid),
        {
          email: email.trim().toLowerCase(),
          name: name.trim() || email.trim(),
          status: "pending",
          createdAt: serverTimestamp(),
        },
        { merge: true }
      ).catch((e) => console.warn("Failed to store pending registration at signup:", e));
      await sendEmailVerification(cred.user).catch(() => undefined); // can be re-sent from the verify screen
      return true;
    } catch (e: any) {
      setError(authErrorMessage(e));
      return false;
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      return true;
    } catch (e: any) {
      setError(authErrorMessage(e));
      return false;
    }
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return true;
    } catch (e: any) {
      // Don't reveal whether an address has an account.
      if (e?.code === "auth/user-not-found") return true;
      setError(authErrorMessage(e));
      return false;
    }
  }, []);

  const resendVerification = useCallback(async () => {
    setError(null);
    if (!auth.currentUser) return false;
    try {
      await sendEmailVerification(auth.currentUser);
      return true;
    } catch (e: any) {
      setError(authErrorMessage(e));
      return false;
    }
  }, []);

  /**
   * After the user taps the link in the email: reload the user, refresh the token (rules read
   * email_verified from it), re-check access. Returns whether the address is verified now.
   */
  const refreshVerification = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return false;
    setError(null);
    try {
      await reload(user);
      if (!user.emailVerified) return false;
      await user.getIdToken(true);
      await resolveIdentity(user);
      return true;
    } catch (e: any) {
      setError(authErrorMessage(e));
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const signOut = useCallback(async () => {
    identityRun.current += 1;
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
    () => ({
      status,
      profile,
      googleEmail,
      error,
      signInWithGoogle,
      signUpWithEmail,
      signInWithEmail,
      sendPasswordReset,
      resendVerification,
      refreshVerification,
      clearError,
      signOut,
      canSignIn: !!promptGoogle,
    }),
    [status, profile, googleEmail, error, signInWithGoogle, signUpWithEmail, signInWithEmail, sendPasswordReset, resendVerification, refreshVerification, clearError, signOut, promptGoogle]
  );
  return (
    <Ctx.Provider value={value}>
      {hasGoogleClientId ? (
        <GoogleSignInRequest
          onError={handleGoogleError}
          onPromptReady={handlePromptReady}
          onSuccess={handleGoogleSuccess}
        />
      ) : null}
      {children}
    </Ctx.Provider>
  );
}

function GoogleSignInRequest({
  onError,
  onPromptReady,
  onSuccess,
}: {
  onError: (message: string) => void;
  onPromptReady: (prompt: (() => Promise<void>) | null) => void;
  onSuccess: (idToken: string) => void;
}) {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: googleClientIds.web || undefined,
    androidClientId: googleClientIds.android || undefined,
    iosClientId: googleClientIds.ios || undefined,
  });

  useEffect(() => {
    if (response?.type === "success") {
      onSuccess(response.params.id_token);
    } else if (response?.type === "error") {
      onError(response.error?.message ?? "Google sign-in failed.");
    }
  }, [response, onError, onSuccess]);

  useEffect(() => {
    onPromptReady(request ? async () => {
      await promptAsync();
    } : null);
    return () => onPromptReady(null);
  }, [request, promptAsync, onPromptReady]);

  return null;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
