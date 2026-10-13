import { useAuth } from "@/src/auth/AuthProvider";
import { Redirect, Stack } from "expo-router";

export default function AuthLayout() {
  const { status, profile } = useAuth();

  // Once authorized, leave the auth screens for the right experience.
  if (status === "ready" && profile) {
    return <Redirect href={profile.role === "admin" ? "/(admin)/(tabs)/dashboard" : "/(employee)/(tabs)/home"} />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
