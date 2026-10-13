import { useAuth } from "@/src/auth/AuthProvider";
import { Redirect, Stack } from "expo-router";

// UI guard only. The real enforcement is firestore.rules.
export default function EmployeeStack() {
  const { status, profile } = useAuth();
  const demo = process.env.EXPO_PUBLIC_DEMO_MODE === "true";
  if (!demo && status !== "ready") return <Redirect href="/" />;
  if (!demo && !profile) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
