import { useStore } from "@/src/store";
import { colors, type } from "@/src/theme";
import { Card, EmptyState, Screen, Segmented, StatusBadge } from "@/src/ui";
import { Bell, Megaphone } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

export default function Updates() {
  const router = useRouter();
  const { announcements, notifications, markNotificationsRead } = useStore();
  const [tab, setTab] = useState("Announcements");
  const published = announcements.filter((a) => a.status === "Published");
  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <Screen scroll>
      <Text style={[type.title, { color: colors.text }]}>Updates</Text>
      <Text style={[type.meta, { color: colors.textSecondary }]}>Announcements and work reminders</Text>
      {unreadCount ? (
        <Text style={[type.tiny, { color: colors.primary, marginTop: 6 }]}>{unreadCount} unread</Text>
      ) : null}
      <View style={{ marginVertical: 14 }}>
        <Segmented options={["Announcements", "Notifications"]} value={tab} onChange={setTab} />
      </View>
      {tab === "Announcements" ? (
        published.length ? (
          <View style={{ gap: 10 }}>
            {published.map((item) => (
              <Card key={item.id} onPress={() => router.push(`/(employee)/announcement/${item.id}`)}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                  <Text style={[type.card, { color: colors.text, flex: 1 }]}>{item.title}</Text>
                  {item.pinned ? <StatusBadge label="Pinned" tone="primary" /> : null}
                </View>
                <Text style={[type.meta, { color: colors.textSecondary, marginTop: 6 }]}>{item.excerpt}</Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8, alignItems: "center" }}>
                  {item.priority === "Important" ? <StatusBadge label="Important" tone="warning" /> : <StatusBadge label="Notice" tone="neutral" />}
                  {item.unread ? <StatusBadge label="Unread" tone="info" /> : null}
                </View>
                <Text style={[type.tiny, { color: colors.muted, marginTop: 8 }]}>{item.publishedAt}</Text>
              </Card>
            ))}
          </View>
        ) : (
          <EmptyState icon={Megaphone} title="No announcements yet" body="Official workplace notices will appear here." />
        )
      ) : notifications.length ? (
        <View>
          <Pressable onPress={markNotificationsRead}>
            <Text style={[type.meta, { color: colors.primary, marginBottom: 10 }]}>Mark all as read</Text>
          </Pressable>
          {notifications.map((item) => (
            <View
              key={item.id}
              style={{
                flexDirection: "row",
                gap: 12,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: item.unread ? colors.paleBlue : colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Bell size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[type.card, { color: colors.text }]}>{item.title}</Text>
                <Text style={[type.meta, { color: colors.textSecondary }]}>{item.body}</Text>
                <Text style={[type.tiny, { color: colors.muted, marginTop: 4 }]}>{item.time}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <EmptyState icon={Bell} title="No new notifications" body="Schedule changes and reminders will show up here." />
      )}
    </Screen>
  );
}
