import { auth } from "@/src/firebase/client";
import { useAuth } from "@/src/auth/AuthProvider";
import { AuthShell, FormError } from "@/src/auth/AuthShell";
import { colors, type } from "@/src/theme";
import { Button } from "@/src/ui";
import { useRouter } from "expo-router";
import { MailCheck } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

export default function VerifyEmail() {
  const router = useRouter();
  const { status, error, googleEmail, resendVerification, refreshVerification, signOut, clearError } = useAuth();
  const [busy, setBusy] = useState<"check" | "resend" | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => clearError, [clearError]);

  // Signed out (or never signed in) -> back to sign up.
  useEffect(() => {
    if (status === "signedOut") router.replace("/(auth)/signup");
    // Verified, but not (yet) authorized / deactivated / failed: the login screen explains why.
    if (["unauthorized", "alreadyLinked", "deactivated", "error"].includes(status)) router.replace("/(auth)/login");
    if (status === "pendingApproval") router.replace("/(auth)/pending-approval");
  }, [status, router]);

  const check = async () => {
    setBusy("check");
    await refreshVerification();
    setBusy(null);
  };
  const resend = async () => {
    setBusy("resend");
    setSent(await resendVerification());
    setBusy(null);
  };

  return (
    <AuthShell title="Check your email" subtitle="One quick step before you can log in.">
      <View style={{ alignItems: "center", gap: 10 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.paleBlue, alignItems: "center", justifyContent: "center" }}>
          <MailCheck size={30} color={colors.primary} />
        </View>
        <Text style={[type.body, { color: colors.textSecondary, textAlign: "center" }]}>
          We sent a verification link to{"\n"}
          <Text style={[type.card, { color: colors.text }]}>{auth.currentUser?.email ?? googleEmail ?? "your email"}</Text>
          {"\n"}Open it, then come back and tap the button below.
        </Text>
      </View>
      {error ? <FormError body={error} /> : null}
      {sent ? <Text style={[type.meta, { color: colors.success, textAlign: "center" }]}>Verification email sent again.</Text> : null}
      <Button label="I've verified my email" onPress={check} loading={busy === "check"} />
      <Button label="Resend email" variant="secondary" onPress={resend} loading={busy === "resend"} />
      <Button label="Use a different account" variant="ghost" onPress={signOut} />
    </AuthShell>
  );
}
