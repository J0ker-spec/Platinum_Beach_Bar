import { colors } from "@/src/theme";
import { Tabs } from "expo-router";
import { CalendarDays, Clock3, LayoutDashboard, MoreHorizontal, Users } from "lucide-react-native";

export default function AdminTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarStyle: { backgroundColor: "#fff", borderTopColor: colors.border, height: 64, paddingTop: 6 },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard", tabBarIcon: ({ color }) => <LayoutDashboard size={22} color={color} /> }} />
      <Tabs.Screen name="schedule" options={{ title: "Schedule", tabBarIcon: ({ color }) => <CalendarDays size={22} color={color} /> }} />
      <Tabs.Screen name="employees" options={{ title: "Employees", tabBarIcon: ({ color }) => <Users size={22} color={color} /> }} />
      <Tabs.Screen name="attendance" options={{ title: "Attendance", tabBarIcon: ({ color }) => <Clock3 size={22} color={color} /> }} />
      <Tabs.Screen name="more" options={{ title: "More", tabBarIcon: ({ color }) => <MoreHorizontal size={22} color={color} /> }} />
    </Tabs>
  );
}
