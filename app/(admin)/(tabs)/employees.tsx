import { fullName } from "@/src/data";
import { useStore } from "@/src/store";
import { colors, type } from "@/src/theme";
import { Avatar, Button, EmptyState, FilterChip, Screen, SearchField, Skeleton, StatusBadge } from "@/src/ui";
import { badgeTone } from "@/src/widgets";
import { Users } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

export default function Employees() {
  const router = useRouter();
  const { employees } = useStore();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Active");
  const [loading] = useState(false);
  const staff = employees.filter((e) => !e.isAdmin);
  const rows = staff.filter((e) => {
    const hay = `${fullName(e)} ${e.id} ${e.title}`.toLowerCase();
    const match = hay.includes(query.toLowerCase());
    const status = filter === "All" || e.status === filter;
    return match && status;
  });

  return (
    <Screen scroll>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <Text style={[type.title, { color: colors.text }]}>Employees</Text>
          <Text style={[type.meta, { color: colors.textSecondary }]}>{staff.length} people · one workplace</Text>
        </View>
      </View>
      <View style={{ marginVertical: 12 }}>
        <Button label="Add employee" onPress={() => router.push("/(admin)/employee-form")} />
      </View>
      <SearchField value={query} onChangeText={setQuery} placeholder="Search by name, ID, or role" />
      <View style={{ flexDirection: "row", gap: 8, marginVertical: 12 }}>
        {["All", "Active", "Inactive"].map((item) => (
          <FilterChip key={item} label={item} active={filter === item} onPress={() => setFilter(item)} />
        ))}
      </View>
      {loading ? (
        <>
          <Skeleton />
          <Skeleton />
        </>
      ) : rows.length ? (
        <View style={{ gap: 10 }}>
          {rows.map((person) => (
            <Pressable
              key={person.id}
              onPress={() => router.push({ pathname: "/(admin)/employee-detail", params: { id: person.id } })}
              style={{ backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 14, flexDirection: "row", gap: 12, alignItems: "center" }}
            >
              <Avatar initials={person.initials} color={person.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[type.card, { color: colors.text }]}>{fullName(person)}</Text>
                <Text style={[type.meta, { color: colors.textSecondary }]}>{person.title} · {person.id}</Text>
              </View>
              <StatusBadge label={person.status} tone={badgeTone(person.status)} />
            </Pressable>
          ))}
        </View>
      ) : (
        <EmptyState
          icon={Users}
          title={query ? "No search results" : "No employees found"}
          body={query ? "Try a different name or ID." : "Add your first team member to start scheduling."}
        />
      )}
    </Screen>
  );
}
