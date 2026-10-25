import { AuthProvider } from "@/src/auth/AuthProvider";
import { PrototypeProvider, useStore } from "@/src/store";
import { colors } from "@/src/theme";
import { Snackbar } from "@/src/ui";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Gate() {
  const { snack, setSnack } = useStore();
  useEffect(() => {
    if (!snack) return;
    const id = setTimeout(() => setSnack(null), 2400);
    return () => clearTimeout(id);
  }, [snack, setSnack]);
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
      <Snackbar message={snack?.message} visible={!!snack} />
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <PrototypeProvider>
            <Gate />
          </PrototypeProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
