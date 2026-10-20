import { workplaceToday } from "@/src/lib/time";
import { useStore } from "@/src/store";
import { colors, type } from "@/src/theme";
import { EmptyState, FilterChip, Screen, Sheet, StatusBadge } from "@/src/ui";
import { badgeTone } from "@/src/widgets";
import { ClipboardList } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

export default function History() {
  const router = useRouter();
  const { attendance, userId, workplaceTimezone } = useStore();
  const today = workplaceToday(workplaceTimezone);
  const [filter, setFilter] = useState("All");
  const [open, setOpen] = useState<string | null>(null);
  const rows = attendance
    .filter((a) => a.employeeId === (userId ?? "EMP-0001") && (filter === "All" || a.status === filter))
    .sort((a, b) => (b.clockInAt ?? 0) - (a.clockInAt ?? 0));
  const current = rows.find((r) => r.id === open);

  return (
    <Screen scroll>
      <Pressable onPress={() => router.back()}>
        <Text style={[type.meta, { color: colors.primary }]}>Back</Text>
      </Pressable>
      <Text style={[type.title, { color: colors.text, marginTop: 8 }]}>Attendance history</Text>
      <Text style={[type.meta, { color: colors.textSecondary }]}>All attendance records through {today}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 12 }}>
        {["All", "On time", "Late", "Incomplete", "Corrected"].map((item) => (
          <FilterChip key={item} label={item} active={filter === item} onPress={() => setFilter(item)} />
        ))}
      </View>
      {rows.length ? (
        <View style={{ gap: 10 }}>
          {rows.map((row) => (
            <Pressable
              key={row.id}
              onPress={() => setOpen(row.id)}
              style={{
                backgroundColor: colors.card,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: row.status === "Incomplete" ? colors.warning : colors.border,
                padding: 14,
              }}
            >
              <Text style={[type.card, { color: colors.text }]}>{row.date}</Text>
              <Text style={[type.meta, { color: colors.textSecondary }]}>
                Scheduled {row.scheduledStart} – {row.scheduledEnd}
              </Text>
              <Text style={[type.meta, { color: colors.textSecondary }]}>
                Recorded {row.clockIn ?? "—"} / {row.clockOut ?? "Clock-out missing"}
              </Text>
              <View style={{ marginTop: 8 }}>
                <StatusBadge label={row.status} tone={badgeTone(row.status)} />
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <EmptyState icon={ClipboardList} title="No attendance history" body="Clock-in records for this filter will appear here." />
      )}

      <Sheet visible={!!current} onClose={() => setOpen(null)}>
        {current ? (
          <>
            <Text style={[type.section, { color: colors.text }]}>{current.date}</Text>
            <Text style={[type.body, { color: colors.text }]}>Scheduled {current.scheduledStart} – {current.scheduledEnd}</Text>
            <Text style={[type.body, { color: colors.text }]}>Clock-in {current.clockIn ?? "Not recorded"}</Text>
            <Text style={[type.body, { color: colors.text }]}>Clock-out {current.clockOut ?? "Missing"}</Text>
            <StatusBadge label={current.status} tone={badgeTone(current.status)} />
            {current.notes ? <Text style={[type.meta, { color: colors.textSecondary }]}>{current.notes}</Text> : null}
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
