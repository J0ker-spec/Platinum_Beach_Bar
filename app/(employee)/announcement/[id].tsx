import { useStore } from "@/src/store";
import { colors, type } from "@/src/theme";
import { Screen, StatusBadge } from "@/src/ui";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

export default function AnnouncementDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { announcements } = useStore();
  const router = useRouter();
  const item = announcements.find((a) => a.id === id);

  if (!item) {
    return (
      <Screen>
        <Text>Announcement not found.</Text>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Pressable onPress={() => router.back()}>
        <Text style={[type.meta, { color: colors.primary }]}>Back</Text>
      </Pressable>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
        {item.priority === "Important" ? <StatusBadge label="Important" tone="warning" /> : <StatusBadge label="Notice" tone="neutral" />}
      </View>
      <Text style={[type.title, { color: colors.text, marginVertical: 10 }]}>{item.title}</Text>
      <Text style={[type.meta, { color: colors.muted }]}>{item.publishedAt} · {item.publisher}</Text>
      <Text style={[type.body, { color: colors.text, marginTop: 18 }]}>{item.body}</Text>
    </Screen>
  );
}
