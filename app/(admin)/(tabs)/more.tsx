import { useAuth } from "@/src/auth/AuthProvider";
import { fullName } from "@/src/data";
import { useStore } from "@/src/store";
import { APP_NAME, BUSINESS_NAME, colors, type } from "@/src/theme";
import { Avatar, Card, Dialog, Screen, SettingRow } from "@/src/ui";
import { ArrowLeftRight, Building2, CircleHelp, Info, LogOut, Megaphone, QrCode, UserPlus, UserRound, Bell } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

export default function More() {
  const router = useRouter();
  const { userId, signOut, setSnack, getEmployee: findEmployee, registrations, swaps } = useStore();
  const { signOut: authSignOut } = useAuth();
  const soon = (m: string) => () => setSnack({ message: m, tone: "info" });
  const me = findEmployee(userId ?? "ADM-0001")!;
  const [out, setOut] = useState(false);
  const pendingSwaps = swaps.filter((s) => s.status === "Awaiting approval");

  return (
    <Screen scroll>
      <Card>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Avatar initials={me.initials} color={me.accent} size={56} />
          <View>
            <Text style={[type.card, { color: colors.text }]}>{fullName(me)}</Text>
            <Text style={[type.meta, { color: colors.textSecondary }]}>{me.title} · {BUSINESS_NAME}</Text>
            <Text style={[type.tiny, { color: colors.muted }]}>{me.id}</Text>
          </View>
        </View>
      </Card>
      <Card style={{ marginTop: 16 }}>
        <SettingRow
          icon={UserPlus}
          label="Pending employee approvals"
          value={registrations.length > 0 ? `${registrations.length} new` : undefined}
          onPress={() => router.push("/(admin)/pending-approvals")}
        />
        <SettingRow
          icon={ArrowLeftRight}
          label="Shift-swap approvals"
          value={pendingSwaps.length > 0 ? `${pendingSwaps.length} pending` : undefined}
          onPress={() => router.push("/(admin)/swaps")}
        />
        <SettingRow icon={Megaphone} label="Announcements" onPress={() => router.push("/(admin)/announcements")} />
        <SettingRow icon={QrCode} label="Workplace QR code" onPress={() => router.push("/(admin)/qr")} />
        <SettingRow icon={Building2} label="Business details" onPress={() => router.push("/(admin)/business")} />
      </Card>
      <Card style={{ marginTop: 16 }}>
        <SettingRow icon={UserRound} label="Administrator profile" onPress={soon("Profile is a preview screen")} />
        <SettingRow icon={Bell} label="Notification preferences" onPress={soon("Preferences updated (preview)")} />
        <SettingRow icon={CircleHelp} label="Help and support" onPress={soon("Help centre is not part of this prototype")} />
        <SettingRow icon={Info} label="About the app" value={APP_NAME} />
        <SettingRow icon={LogOut} label="Sign out" onPress={() => setOut(true)} />
      </Card>
      <Dialog
        visible={out}
        icon={LogOut}
        tone="danger"
        title="Sign out?"
        body="You’ll return to the login preview."
        primary="Sign out"
        secondary="Cancel"
        onSecondary={() => setOut(false)}
        onPrimary={() => {
          setOut(false);
          signOut();
          void authSignOut(); // also end the real Firebase session
          router.replace("/(auth)/login");
        }}
      />
    </Screen>
  );
}
