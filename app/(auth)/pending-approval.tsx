import { useAuth } from "@/src/auth/AuthProvider";
import { auth } from "@/src/firebase/client";
import { AuthShell } from "@/src/auth/AuthShell";
import { colors, type } from "@/src/theme";
import { Button } from "@/src/ui";
import { useRouter } from "expo-router";
import { Clock3 } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";

export default function PendingApproval() {
  const router = useRouter();
  const { status, googleEmail, signOut, refreshVerification, clearError } = useAuth();
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    clearError();
  }, [clearError]);

  // Once an admin approves + assigns a role, re-checking picks up the authorization and the app opens.
  useEffect(() => {
    if (status === "ready") router.replace("/");
    if (status === "signedOut" && !auth.currentUser) router.replace("/(auth)/signup");
    if (status === "unverified") router.replace("/(auth)/verify-email");
    if (["unauthorized", "alreadyLinked", "deactivated", "error"].includes(status)) router.replace("/(auth)/login");
  }, [status, router]);

  const check = useCallback(async () => {
    setBusy(true);
    await refreshVerification();
    // If approval landed, the effect above redirects away before this note is ever seen.
    setChecked(true);
    setBusy(false);
  }, [refreshVerification]);

  return (
    <AuthShell
      title="Awaiting approval"
      subtitle="Your sign-up has been received and sent to an administrator for confirmation."
    >
      <View style={{ alignItems: "center", gap: 12 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.paleBlue, alignItems: "center", justifyContent: "center" }}>
          <Clock3 size={30} color={colors.primary} />
        </View>
        <Text style={[type.body, { color: colors.textSecondary, textAlign: "center" }]}>
          {googleEmail ? (
            <>The account <Text style={[type.card, { color: colors.text }]}>{googleEmail}</Text> is waiting for an administrator to confirm it.</>
          ) : (
            "An administrator needs to confirm your account before you can sign in."
          )}
        </Text>
        <Text style={[type.meta, { color: colors.muted, textAlign: "center" }]}>
          Remember: sign-ups only give you an account here — an administrator chooses your role and,
          until they approve you, there is nothing you can access in the workplace.
        </Text>
      </View>
      {checked ? (
        <Text style={[type.meta, { color: colors.warning, textAlign: "center" }]}>
          Still waiting for an administrator. Ask them to approve your account, then check again.
        </Text>
      ) : null}
      <Button label="Check again" onPress={check} loading={busy} />
      <Button label="Use a different account" variant="secondary" onPress={signOut} />
    </AuthShell>
  );
}