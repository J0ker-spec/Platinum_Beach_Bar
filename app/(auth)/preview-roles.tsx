import { useStore } from "@/src/store";
import { colors, type } from "@/src/theme";
import { Card, Heading, Muted, Screen } from "@/src/ui";
import { Shield, User } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

export default function PreviewRoles() {
  const router = useRouter();
  const { signIn } = useStore();

  const choose = (role: "employee" | "admin") => {
    signIn(role);
    router.replace(role === "admin" ? "/(admin)/(tabs)/dashboard" : "/(employee)/(tabs)/home");
  };

  return (
    <Screen>
      <Pressable onPress={() => router.back()}>
        <Text style={[type.meta, { color: colors.primary, marginBottom: 16 }]}>Back to login</Text>
      </Pressable>
      <Heading>Prototype preview</Heading>
      <Muted>This selector is for demonstration only. Production sign-in would open the matching workplace role automatically.</Muted>
      <View style={{ height: 20, gap: 12 }}>
        <Card onPress={() => choose("employee")}>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.paleBlue, alignItems: "center", justifyContent: "center" }}>
              <User size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.card, { color: colors.text }]}>Preview employee experience</Text>
              <Text style={[type.meta, { color: colors.textSecondary }]}>Schedule, attendance, swaps, and updates for Maya Chen.</Text>
            </View>
          </View>
        </Card>
        <View style={{ height: 12 }} />
        <Card onPress={() => choose("admin")}>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.lavender, alignItems: "center", justifyContent: "center" }}>
              <Shield size={22} color={colors.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.card, { color: colors.text }]}>Preview administrator experience</Text>
              <Text style={[type.meta, { color: colors.textSecondary }]}>Staff, schedule publishing, attendance, and workplace settings.</Text>
            </View>
          </View>
        </Card>
      </View>
    </Screen>
  );
}
