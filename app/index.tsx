 import { useAuth } from "@/src/auth/AuthProvider";
import { APP_NAME, colors, type } from "@/src/theme";
import { AppLogo } from "@/src/ui";
import { Redirect } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";

export default function Splash() {
  const { status, profile } = useAuth();

  if (status === "ready" && profile) {
    return <Redirect href={profile.role === "admin" ? "/(admin)/(tabs)/dashboard" : "/(employee)/(tabs)/home"} />;
  }
  if (status === "unverified") return <Redirect href="/(auth)/verify-email" />;
  // Signed-out visitors land on sign up first; people already in the system can switch to log in.
  // Authenticated-but-blocked states (unauthorized, deactivated, error) show their message on the login screen.
  if (status === "signedOut") return <Redirect href="/(auth)/signup" />;
  if (status !== "loading" && status !== "checking") return <Redirect href="/(auth)/login" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 16 }}>
      <AppLogo size={88} />
      <Text style={[type.title, { color: colors.text }]}>{APP_NAME}</Text>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
