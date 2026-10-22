import { useAuth } from "@/src/auth/AuthProvider";
import { AuthShell, FormError, SwitchLink } from "@/src/auth/AuthShell";
import { colors, type } from "@/src/theme";
import { Button, TextField } from "@/src/ui";
import { useRouter } from "expo-router";
import { CheckCircle2 } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

export default function ForgotPassword() {
  const router = useRouter();
  const { sendPasswordReset, error, clearError } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    clearError();
  }, [clearError]);

  const send = async () => {
    if (!email.trim() || busy) return;
    setBusy(true);
    setSent(await sendPasswordReset(email));
    setBusy(false);
  };

  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a link to choose a new one.">
      {error && !sent ? <FormError body={error} /> : null}
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="name@workplace.com"
        keyboardType="email-address"
        autoComplete="email"
        onSubmitEditing={send}
      />
      <Button label="Send reset link" onPress={send} disabled={!email.trim()} loading={busy} />
      {sent ? (
        <View style={{ backgroundColor: colors.successSoft, borderRadius: 14, padding: 12, gap: 6 }}>
          <CheckCircle2 size={22} color={colors.success} />
          <Text style={[type.card, { color: colors.text }]}>Check your inbox</Text>
          <Text style={[type.meta, { color: colors.textSecondary }]}>
            If an account exists for {email.trim()}, a reset link is on its way.
          </Text>
        </View>
      ) : null}
      <SwitchLink prompt="Remembered it?" action="Back to log in" onPress={() => router.replace("/(auth)/login")} />
    </AuthShell>
  );
}
