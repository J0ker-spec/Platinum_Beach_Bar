import { colors, type } from "@/src/theme";
import { Screen } from "@/src/ui";
import { useStore } from "@/src/store";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";

export default function NotificationSettings() {
  const router = useRouter();
  const { notificationPreferences: prefs, saveNotificationPreferences, setSnack } = useStore();
  const [saving, setSaving] = useState(false);
  const toggle = async (key: keyof typeof prefs) => {
    if (saving) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setSaving(true);
    try {
      await saveNotificationPreferences(next);
      setSnack({ message: "Notification preferences saved", tone: "success" });
    } catch (error) {
      console.error("Could not save notification preferences:", error);
      setSnack({ message: "Couldn't save notification preferences. Try again.", tone: "warning" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll>
      <Pressable onPress={() => router.back()}>
        <Text style={[type.meta, { color: colors.primary }]}>Back</Text>
      </Pressable>
      <Text style={[type.title, { color: colors.text, marginVertical: 12 }]}>Notification preferences</Text>
      <Text style={[type.meta, { color: colors.textSecondary, marginBottom: 12 }]}>
        Choose which updates appear in your in-app notification feed. Push alerts and scheduled shift reminders are not available.
      </Text>
      {(
        [
          ["schedule", "Schedule updates"],
          ["announcements", "Announcement alerts"],
          ["swaps", "Shift-swap updates"],
        ] as const
      ).map(([key, label]) => (
        <View key={key} style={{ flexDirection: "row", alignItems: "center", minHeight: 52, justifyContent: "space-between" }}>
          <Text style={[type.body, { color: colors.text }]}>{label}</Text>
          <Switch disabled={saving} value={prefs[key]} onValueChange={() => void toggle(key)} trackColor={{ true: colors.primary }} />
        </View>
      ))}
    </Screen>
  );
}
