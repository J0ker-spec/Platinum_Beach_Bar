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
  const { employees, registrations, approveRegistration, rejectRegistration } = useStore();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Active");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading] = useState(false);
  const staff = employees;
  const rows = staff.filter((e) => {
    const hay = `${fullName(e)} ${e.id} ${e.title}`.toLowerCase();
    const match = hay.includes(query.toLowerCase());
    const status = filter === "All" || e.status === filter;
    return match && status;
  });

  const handleApprove = async (id: string, role: "employee" | "admin", title: string) => {
    setBusyId(id);
    try {
      await approveRegistration(id, role, title);
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id: string) => {
    setBusyId(id);
    try {
      await rejectRegistration(id);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Screen scroll>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <Text style={[type.title, { color: colors.text }]}>Employees</Text>
          <Text style={[type.meta, { color: colors.textSecondary }]}>{staff.length} people · one workplace</Text>
        </View>
      </View>
      {(filter === "Pending" || registrations.length > 0) && (
        <View style={{ gap: 10, marginVertical: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={[type.section, { color: colors.text }]}>Pending approval ({registrations.length})</Text>
            {registrations.length > 0 && <StatusBadge label={`${registrations.length} New`} tone="warning" />}
          </View>
          {registrations.length > 0 ? (
            registrations.map((r) => (
              <View key={r.id} style={{ backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 }}>
                <View>
                  <Text style={[type.card, { color: colors.text }]}>{r.name || r.email}</Text>
                  <Text style={[type.meta, { color: colors.textSecondary }]}>{r.email} · {r.createdAt}</Text>
                </View>
                <View style={{ gap: 8 }}>
                  <Button
                    label="Approve as employee"
                    loading={busyId === r.id}
                    disabled={!!busyId}
                    onPress={() => void handleApprove(r.id, "employee", "Team member")}
                  />
                  <Button
                    label="Approve as admin"
                    variant="ghost"
                    disabled={!!busyId}
                    onPress={() => void handleApprove(r.id, "admin", "Administrator")}
                  />
                  <Button
                    label="Reject registration"
                    variant="danger"
                    disabled={!!busyId}
                    onPress={() => void handleReject(r.id)}
                  />
                </View>
              </View>
            ))
          ) : filter === "Pending" ? (
            <EmptyState
              icon={Users}
              title="No pending approvals"
              body="All user sign-ups and registrations have already been reviewed."
            />
          ) : null}
        </View>
      )}
      <View style={{ marginVertical: 12 }}>
        <Button label="Add employee" onPress={() => router.push("/(admin)/employee-form")} />
      </View>
      <SearchField value={query} onChangeText={setQuery} placeholder="Search by name, ID, or role" />
      <View style={{ flexDirection: "row", gap: 8, marginVertical: 12 }}>
        {["All", "Active", "Pending", "Inactive"].map((item) => (
          <FilterChip key={item} label={item} active={filter === item} onPress={() => setFilter(item)} />
        ))}
      </View>
      {filter !== "Pending" && (
        loading ? (
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
                  <Text style={[type.meta, { color: colors.textSecondary }]}>{person.isAdmin ? "Admin · " : ""}{person.title} · {person.id}</Text>
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
        )
      )}
    </Screen>
  );
}
