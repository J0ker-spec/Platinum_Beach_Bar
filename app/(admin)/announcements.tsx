import { useStore } from "@/src/store";
import { colors, type } from "@/src/theme";
import { BackHeader, Button, Card, EmptyState, Screen, SearchField, Segmented, StatusBadge } from "@/src/ui";
import { Megaphone } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

export default function Announcements() {
  const router = useRouter();
  const { announcements } = useStore();
  const [tab, setTab] = useState("Published");
  const [query, setQuery] = useState("");
  const rows = announcements.filter(
    (a) => a.status === tab && a.title.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <Screen scroll>
      <BackHeader title="Announcements" onBack={() => router.back()} />
      <Button label="Create announcement" icon={Megaphone} onPress={() => router.push("/(admin)/announcement-form")} />
      <View style={{ height: 12 }} />
      <Segmented options={["Published", "Draft"]} value={tab} onChange={setTab} />
      <View style={{ height: 12 }} />
      <SearchField value={query} onChangeText={setQuery} placeholder="Search announcements" />
      <View style={{ gap: 10, marginTop: 14 }}>
        {rows.length ? (
          rows.map((a) => (
            <Card key={a.id} style={a.priority === "Important" ? { borderColor: colors.amber } : undefined}>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                <StatusBadge label={a.status} tone={a.status === "Published" ? "success" : "neutral"} />
                {a.priority === "Important" ? <StatusBadge label="Important" tone="warning" /> : null}
              </View>
              <Text style={[type.card, { color: colors.text }]}>{a.title}</Text>
              <Text style={[type.meta, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={2}>{a.excerpt}</Text>
              <Text style={[type.tiny, { color: colors.muted, marginTop: 8 }]}>
                {a.publishedAt} · {a.publisher} · {a.audience}
              </Text>
            </Card>
          ))
        ) : (
          <EmptyState icon={Megaphone} title="No announcements" body={tab === "Draft" ? "Saved drafts will appear here." : "Published announcements will appear here."} />
        )}
      </View>
    </Screen>
  );
}
