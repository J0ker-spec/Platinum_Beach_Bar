import { useAuth, type AuthStatus } from "@/src/auth/AuthProvider";
import { AuthShell, FormError, OrDivider, PasswordField, SwitchLink } from "@/src/auth/AuthShell";
import { BUSINESS_NAME, colors, type } from "@/src/theme";
import { Button, TextField } from "@/src/ui";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

// Clear, specific messages for every non-success state (no silent failures).
const MESSAGES: Partial<Record<AuthStatus, { title: string; body: string }>> = {
  unconfigured: {
    title: "Backend not configured",
    body: "Firebase settings are missing. Copy .env.example to .env and fill in the project values, then restart the app.",
  },
  unauthorized: {
    title: "No employee record for this account",
    body: "Your account hasn't been authorized yet. Ask your administrator to add your email address, then log in again.",
  },
  alreadyLinked: {
    title: "Employee record linked to another account",
    body: "This employee record is already connected to a different account. Ask your administrator to reset the link.",
  },
  pendingApproval: {
    title: "Awaiting administrator approval",
    body: "Your sign-up was received. Once an administrator confirms your account and assigns your role you'll be able to sign in.",
  },
  deactivated: {
    title: "Account deactivated",
    body: "Your access to this workplace has ended. Contact your administrator if you think this is a mistake.",
  },
  error: { title: "Sign-in problem", body: "" },
};

export default function Login() {
  const router = useRouter();
  const { status, error, googleEmail, signInWithEmail, signInWithGoogle, signOut, canSignIn, clearError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    clearError();
  }, [clearError]);

  // Handle auth routing on login
  useEffect(() => {
    if (status === "ready") router.replace("/");
    if (status === "unverified") router.replace("/(auth)/verify-email");
    if (status === "pendingApproval") router.replace("/(auth)/pending-approval");
  }, [status, router]);

  const msg = MESSAGES[status];
  const checking = status === "loading" || status === "checking";
  const blocked = status === "unauthorized" || status === "alreadyLinked" || status === "deactivated";

  const submit = async () => {
    setTouched(true);
    if (!email.trim() || !password || busy) return;
    setBusy(true);
    await signInWithEmail(email, password);
    setBusy(false);
  };

  return (
    <AuthShell title="Welcome back" subtitle="Log in to view your work schedule and attendance.">
      {msg ? (
        <FormError title={msg.title} body={status === "error" ? error ?? "Please try again." : msg.body} />
      ) : error ? (
        <FormError body={error} />
      ) : null}
      {blocked ? (
        <>
          {googleEmail ? <Text style={[type.meta, { color: colors.textSecondary }]}>Signed in as {googleEmail}</Text> : null}
          <Button label="Use a different account" onPress={signOut} variant="secondary" />
        </>
      ) : (
        <>
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="name@workplace.com"
            keyboardType="email-address"
            autoComplete="email"
            error={touched && !email.trim() ? "Enter your email." : undefined}
          />
          <View style={{ gap: 8 }}>
            <PasswordField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              autoComplete="current-password"
              error={touched && !password ? "Enter your password." : undefined}
              onSubmitEditing={submit}
            />
            <Pressable onPress={() => router.push("/(auth)/forgot-password")} accessibilityRole="link" hitSlop={8} style={{ alignSelf: "flex-end" }}>
              <Text style={[type.meta, { color: colors.primary }]}>Forgot password?</Text>
            </Pressable>
          </View>
          <Button
            label={checking ? "Checking your account…" : "Log in"}
            onPress={submit}
            disabled={status === "unconfigured"}
            loading={busy || checking}
          />
          {canSignIn ? (
            <>
              <OrDivider />
              <Button label="Continue with Google" variant="secondary" onPress={signInWithGoogle} disabled={checking} />
            </>
          ) : null}
          <SwitchLink prompt="New here?" action="Create an account" onPress={() => router.replace("/(auth)/signup")} />
        </>
      )}
      <Text style={[type.tiny, { color: colors.muted, textAlign: "center" }]}>{BUSINESS_NAME}</Text>
    </AuthShell>
  );
}
