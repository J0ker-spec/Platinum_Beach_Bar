import { useAuth } from "@/src/auth/AuthProvider";
import { Redirect, Stack } from "expo-router";

// UI guard only. The real enforcement is firestore.rules (role is read from the employee document).
export default function AdminStack() {
  const { status, profile } = useAuth();
  if (!(status === "ready" && profile?.role === "admin")) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
