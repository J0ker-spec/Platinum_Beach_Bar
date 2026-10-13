import { useAuth, type AuthStatus } from "@/src/auth/AuthProvider";
import { APP_NAME, BUSINESS_NAME, colors, spacing, type } from "@/src/theme";
import { AppLogo, Button, Heading, Muted, Screen } from "@/src/ui";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

const DEMO = process.env.EXPO_PUBLIC_DEMO_MODE === "true";

// Clear, specific messages for every non-success state (no silent failures).
const MESSAGES: Partial<Record<AuthStatus, { title: string; body: string }>> = {
  unconfigured: {
    title: "Backend not configured",
    body: "Firebase settings are missing. Copy .env.example to .env and fill in the project values, then restart the app.",
  },
  unauthorized: {
    title: "No employee record for this Google account",
    body: "Your Google account is not authorized. Ask your administrator to add your Google email address, then try again.",
  },
  alreadyLinked: {
    title: "Employee record linked to another account",
    body: "This employee record is already connected to a different Google account. Ask your administrator to reset the link.",
  },
  deactivated: {
    title: "Account deactivated",
    body: "Your access to this workplace has ended. Contact your administrator if you think this is a mistake.",
  },
  error: { title: "Sign-in problem", body: "" },
};

export default function Login() {
  const router = useRouter();
  const { status, error, googleEmail, signInWithGoogle, signOut, canSignIn } = useAuth();
  const msg = MESSAGES[status];
  const busy = status === "loading" || status === "checking";
  const blocked = status === "unauthorized" || status === "alreadyLinked" || status === "deactivated";

  return (
    <Screen scroll>
      <View style={{ alignItems: "center", marginTop: 12, marginBottom: 28, gap: 8 }}>
        <AppLogo />
        <Text style={[type.card, { color: colors.primary }]}>{APP_NAME}</Text>
      </View>
      <Heading>Welcome back</Heading>
      <Muted>Sign in with your Google account to view your work schedule and attendance.</Muted>
      <View style={{ height: spacing.xl }} />
      <View style={{ gap: 14 }}>
        {msg ? (
          <View style={{ backgroundColor: colors.errorSoft, borderRadius: 14, padding: 12, gap: 4 }}>
            <Text style={[type.card, { color: colors.error }]}>{msg.title}</Text>
            <Text style={[type.meta, { color: colors.error }]}>{status === "error" ? error ?? "Please try again." : msg.body}</Text>
            {blocked && googleEmail ? (
              <Text style={[type.tiny, { color: colors.error }]}>Signed in as {googleEmail}</Text>
            ) : null}
          </View>
        ) : null}
        {blocked ? (
          <Button label="Use a different Google account" onPress={signOut} variant="secondary" />
        ) : (
          <Button
            label={busy ? "Checking your account…" : "Continue with Google"}
            onPress={signInWithGoogle}
            disabled={status === "unconfigured" || !canSignIn}
            loading={busy}
          />
        )}
        <Text style={[type.tiny, { color: colors.muted, textAlign: "center" }]}>
          Only employees authorized by your administrator can sign in.
        </Text>
      </View>
      {DEMO ? (
        <View style={{ marginTop: 28, alignItems: "center", gap: 12 }}>
          <Pressable
            onPress={() => router.push("/(auth)/preview-roles")}
            style={{ width: "100%", borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.lavenderSurface, padding: 14 }}
          >
            <Text style={[type.meta, { color: colors.secondary }]}>Demo mode (fake data, no backend)</Text>
            <Text style={[type.card, { color: colors.text }]}>Preview employee or administrator experience</Text>
          </Pressable>
        </View>
      ) : null}
      <Text style={[type.tiny, { color: colors.muted, textAlign: "center", marginTop: 20 }]}>{BUSINESS_NAME}</Text>
    </Screen>
  );
}
