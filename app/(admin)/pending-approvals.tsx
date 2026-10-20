import { useStore } from "@/src/store";
import { colors, type } from "@/src/theme";
import { BackHeader, Button, Card, EmptyState, Screen, StatusBadge } from "@/src/ui";
import { UserCheck, Users, UserX, Clock } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

export default function PendingApprovals() {
  const router = useRouter();
  const { registrations, approveRegistration, rejectRegistration } = useStore();
  const [busyId, setBusyId] = useState<string | null>(null);

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
      <BackHeader title="Pending approvals" onBack={() => router.back()} />
      <View style={{ gap: 6, marginVertical: 12 }}>
        <Text style={[type.meta, { color: colors.textSecondary }]}>
          {registrations.length} account{registrations.length === 1 ? "" : "s"} waiting for administrator approval. Once approved, they will receive active employee status in the workplace.
        </Text>
      </View>

      {registrations.length > 0 ? (
        <View style={{ gap: 12, marginTop: 4 }}>
          {registrations.map((r) => (
            <Card key={r.id} style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[type.card, { color: colors.text }]}>{r.name || r.email}</Text>
                  <Text style={[type.meta, { color: colors.textSecondary, marginTop: 2 }]}>{r.email}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
                    <Clock size={14} color={colors.muted} />
                    <Text style={[type.tiny, { color: colors.muted }]}>Registered: {r.createdAt}</Text>
                  </View>
                </View>
                <StatusBadge label="Pending" tone="warning" />
              </View>

              <View style={{ height: 1, backgroundColor: colors.border }} />

              <View style={{ gap: 8 }}>
                <Button
                  label="Approve as employee"
                  loading={busyId === r.id}
                  disabled={!!busyId}
                  onPress={() => void handleApprove(r.id, "employee", "Team member")}
                />
                <Button
                  label="Approve as administrator"
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
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState
          icon={Users}
          title="No pending approvals"
          body="All user sign-ups and registrations have already been reviewed. Any new sign-ups will appear here for your review."
        />
      )}
    </Screen>
  );
}
