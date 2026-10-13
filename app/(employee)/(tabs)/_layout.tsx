import { colors } from "@/src/theme";
import { Tabs } from "expo-router";
import { Bell, CalendarDays, Clock3, Home, UserRound } from "lucide-react-native";
import { View } from "react-native";

export default function EmployeeTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: colors.border,
          height: 64,
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Home size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Schedule",
          tabBarIcon: ({ color }) => <CalendarDays size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: "Attendance",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={{
                width: 42,
                height: 42,
                marginTop: -8,
                borderRadius: 21,
                backgroundColor: focused ? colors.primary : colors.paleBlue,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Clock3 size={20} color={focused ? "#fff" : colors.primary} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="updates"
        options={{
          title: "Updates",
          tabBarIcon: ({ color }) => <Bell size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <UserRound size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
