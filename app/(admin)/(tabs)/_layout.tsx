import { useStore } from "@/src/store";
import { colors, type } from "@/src/theme";
import { Tabs } from "expo-router";
import { CalendarDays, Clock3, LayoutDashboard, MoreHorizontal, Users } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

export default function AdminTabs() {
  const { listenerError, retry } = useStore();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {listenerError ? (
        <View
          style={{
            backgroundColor: colors.warningSoft,
            paddingHorizontal: 16,
            paddingVertical: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Text style={[type.tiny, { color: colors.warning, flex: 1 }]}>{listenerError}</Text>
          <Pressable onPress={retry}>
            <Text style={[type.tiny, { color: colors.primary, fontWeight: "700" }]}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.muted,
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
          tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, height: 64, paddingTop: 6 },
        }}
      >
        <Tabs.Screen name="dashboard" options={{ title: "Dashboard", tabBarIcon: ({ color }) => <LayoutDashboard size={22} color={color} /> }} />
        <Tabs.Screen name="schedule" options={{ title: "Schedule", tabBarIcon: ({ color }) => <CalendarDays size={22} color={color} /> }} />
        <Tabs.Screen name="employees" options={{ title: "Employees", tabBarIcon: ({ color }) => <Users size={22} color={color} /> }} />
        <Tabs.Screen name="attendance" options={{ title: "Attendance", tabBarIcon: ({ color }) => <Clock3 size={22} color={color} /> }} />
        <Tabs.Screen name="more" options={{ title: "More", tabBarIcon: ({ color }) => <MoreHorizontal size={22} color={color} /> }} />
      </Tabs>
    </View>
  );
}
