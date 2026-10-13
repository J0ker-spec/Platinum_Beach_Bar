import { AuthProvider } from "@/src/auth/AuthProvider";
import { PrototypeProvider, useStore } from "@/src/store";
import { colors } from "@/src/theme";
import { Snackbar } from "@/src/ui";
import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold, useFonts } from "@expo-google-fonts/inter";
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
  const [loaded] = useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => undefined);
  }, [loaded]);

  if (!loaded) return null;

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
