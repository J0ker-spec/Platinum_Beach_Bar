import { useAuth } from "@/src/auth/AuthProvider";
import { fullName } from "@/src/data";
import { useStore } from "@/src/store";
import { APP_NAME, colors, type } from "@/src/theme";
import { Avatar, Card, Dialog, Screen, SettingRow, StatusBadge } from "@/src/ui";
import { CircleHelp, Copy, Info, LogOut, Bell } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

export default function Profile() {
  const router = useRouter();
  const { userId, signOut, setSnack, getEmployee: findEmployee } = useStore();
  const { signOut: authSignOut } = useAuth();
  const me = findEmployee(userId ?? "EMP-0001")!;
  const [signOutOpen, setSignOutOpen] = useState(false);

  return (
    <Screen scroll>
      <Card>
        <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
          <Avatar initials={me.initials} color={me.accent} size={64} />
          <View style={{ flex: 1 }}>
            <Text style={[type.title, { color: colors.text }]}>{fullName(me)}</Text>
            <Text style={[type.meta, { color: colors.textSecondary }]}>{me.title}</Text>
            <View style={{ marginTop: 6 }}>
              <StatusBadge label={me.status} tone="success" />
            </View>
          </View>
        </View>
        <View style={{ marginTop: 14, backgroundColor: colors.surface, borderRadius: 12, padding: 12, flexDirection: "row", justifyContent: "space-between" }}>
          <View>
            <Text style={[type.tiny, { color: colors.muted }]}>Employee ID — assigned automatically</Text>
            <Text style={[type.card, { color: colors.text }]}>{me.id}</Text>
          </View>
          <Pressable accessibilityLabel="Copy employee ID" onPress={() => setSnack({ message: "Employee ID copied (preview)", tone: "info" })}>
            <Copy size={18} color={colors.primary} />
          </Pressable>
        </View>
      </Card>

      <Card style={{ marginTop: 16 }}>
        {[
          ["Full name", fullName(me)],
          ["Email", me.email],
          ["Phone", me.phone],
          ["Job title", me.title],
          ["Employment status", me.status],
        ].map(([label, value]) => (
          <View key={label} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={[type.tiny, { color: colors.muted }]}>{label}</Text>
            <Text style={[type.body, { color: colors.text }]}>{value}</Text>
          </View>
        ))}
      </Card>

      <Card style={{ marginTop: 16 }}>
        <SettingRow icon={Bell} label="Notification preferences" onPress={() => router.push("/(employee)/notification-settings")} />
        <SettingRow icon={Info} label="About the app" value={APP_NAME} onPress={() => router.push("/about")} />
        <SettingRow icon={LogOut} label="Sign out" onPress={() => setSignOutOpen(true)} />
      </Card>

      <Dialog
        visible={signOutOpen}
        title="Sign out?"
        body="You’ll return to the login preview. Nothing is saved to a server."
        primary="Sign out"
        secondary="Cancel"
        tone="danger"
        icon={LogOut}
        onSecondary={() => setSignOutOpen(false)}
        onPrimary={() => {
          setSignOutOpen(false);
          signOut();
          void authSignOut(); // also end the real Firebase session
          router.replace("/(auth)/login");
        }}
      />
    </Screen>
  );
}
