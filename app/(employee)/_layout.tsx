import { useAuth } from "@/src/auth/AuthProvider";
import { Redirect, Stack } from "expo-router";

// UI guard only. The real enforcement is firestore.rules.
export default function EmployeeStack() {
  const { status, profile } = useAuth();
  if (status !== "ready" || !profile) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
