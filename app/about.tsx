import { BackHeader, Card, Screen } from "@/src/ui";
import { colors, type } from "@/src/theme";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";

const features = [
  "Managers create and share staff schedules.",
  "Employees check their upcoming shifts and attendance.",
  "Teams stay updated with announcements and shift-swap requests.",
];

export default function About() {
  const router = useRouter();

  return (
    <Screen scroll>
      <BackHeader title="About Platnumx" onBack={() => router.back()} />
      <Card style={{ gap: 12 }}>
        <Text style={[type.body, { color: colors.textSecondary }]}>
          Platnumx helps teams organize work schedules and stay up to date.
        </Text>
        <Text style={[type.section, { color: colors.text }]}>How it works</Text>
        <View style={{ gap: 10 }}>
          {features.map((feature) => (
            <View key={feature} style={{ flexDirection: "row", gap: 10 }}>
              <Text style={[type.body, { color: colors.primary }]}>•</Text>
              <Text style={[type.body, { color: colors.textSecondary, flex: 1 }]}>{feature}</Text>
            </View>
          ))}
        </View>
      </Card>
    </Screen>
  );
}
