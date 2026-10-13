import { useAuth } from "@/src/auth/AuthProvider";
import { Redirect, Stack } from "expo-router";

// UI guard only. The real enforcement is firestore.rules (role is read from the employee document).
export default function AdminStack() {
  const { status, profile } = useAuth();
  const demo = process.env.EXPO_PUBLIC_DEMO_MODE === "true";
  if (!demo && !(status === "ready" && profile?.role === "admin")) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
