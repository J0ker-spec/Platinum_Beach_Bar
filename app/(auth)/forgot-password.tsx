import { colors, type } from "@/src/theme";
import { Button, Card, Heading, Muted, Screen, TextField } from "@/src/ui";
import { CheckCircle2 } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);

  const send = () => {
    if (!email) {
      setError("Enter the email on your workplace account.");
      setSent(false);
      return;
    }
    if (email.toLowerCase().includes("fail")) {
      setError("Reset instructions could not be sent. Try again.");
      setSent(false);
      return;
    }
    setError(undefined);
    setSent(true);
  };

  return (
    <Screen scroll>
      <Pressable onPress={() => router.back()} accessibilityLabel="Back">
        <Text style={[type.meta, { color: colors.primary, marginBottom: 16 }]}>Back</Text>
      </Pressable>
      <Heading>Reset your password</Heading>
      <Muted>We’ll send reset instructions to the email on your workplace account. Accounts are created by an administrator.</Muted>
      <View style={{ height: 20 }} />
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="name@workplace.com"
        keyboardType="email-address"
        error={error}
      />
      <View style={{ height: 16 }} />
      <Button label="Send reset instructions" onPress={send} disabled={!email} />
      {sent ? (
        <Card style={{ marginTop: 16, backgroundColor: colors.successSoft, borderColor: "#CDEADF" }}>
          <CheckCircle2 size={22} color={colors.success} />
          <Text style={[type.card, { color: colors.text, marginTop: 8 }]}>Instructions requested</Text>
          <Muted>In production, a reset email would be sent to {email}. This prototype only previews the confirmation.</Muted>
        </Card>
      ) : null}
      <Pressable onPress={() => router.replace("/(auth)/login")} style={{ marginTop: 20 }}>
        <Text style={[type.meta, { color: colors.primary, textAlign: "center" }]}>Return to login</Text>
      </Pressable>
    </Screen>
  );
}
