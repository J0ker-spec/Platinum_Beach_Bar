import { colors, type } from "@/src/theme";
import { Screen } from "@/src/ui";
import { useStore } from "@/src/store";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";

export default function NotificationSettings() {
  const router = useRouter();
  const { setSnack } = useStore();
  const [prefs, setPrefs] = useState({
    reminders: true,
    schedule: true,
    announcements: true,
    swaps: false,
  });

  const toggle = (key: keyof typeof prefs) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
    setSnack({ message: "Preferences updated", tone: "success" });
  };

  return (
    <Screen>
      <Pressable onPress={() => router.back()}>
        <Text style={[type.meta, { color: colors.primary }]}>Back</Text>
      </Pressable>
      <Text style={[type.title, { color: colors.text, marginVertical: 12 }]}>Notification preferences</Text>
      {(
        [
          ["reminders", "Shift reminders"],
          ["schedule", "Schedule updates"],
          ["announcements", "Announcement alerts"],
          ["swaps", "Shift-swap updates"],
        ] as const
      ).map(([key, label]) => (
        <View key={key} style={{ flexDirection: "row", alignItems: "center", minHeight: 52, justifyContent: "space-between" }}>
          <Text style={[type.body, { color: colors.text }]}>{label}</Text>
          <Switch value={prefs[key]} onValueChange={() => toggle(key)} trackColor={{ true: colors.primary }} />
        </View>
      ))}
    </Screen>
  );
}
