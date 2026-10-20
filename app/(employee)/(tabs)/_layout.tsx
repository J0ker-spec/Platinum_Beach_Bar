import { useStore } from "@/src/store";
import { colors, type } from "@/src/theme";
import { Tabs } from "expo-router";
import { Bell, CalendarDays, Clock3, Home, UserRound } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

export default function EmployeeTabs() {
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
        tabBarStyle: {
          backgroundColor: colors.card,
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
              <Clock3 size={20} color={focused ? colors.onPrimary : colors.primary} />
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
    </View>
  );
}
