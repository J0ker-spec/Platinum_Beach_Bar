import { todayLabel } from "@/src/dates";
import { workplaceToday } from "@/src/lib/time";
import { useStore } from "@/src/store";
import { colors, type } from "@/src/theme";
import { Button, Card, Screen, StatusBadge } from "@/src/ui";
import { badgeTone } from "@/src/widgets";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";

export default function AttendanceHome() {
  const router = useRouter();
  const { userId, shifts, clockedIn, lastClockIn, attendance, workplaceTimezone, getEmployee: findEmployee } = useStore();
  const me = findEmployee(userId ?? "EMP-0001")!;
  const today = workplaceToday(workplaceTimezone);
  const todayShift = shifts.filter((s) => s.employeeId === me.id && s.date === today).sort((a, b) => (a.startAt ?? 0) - (b.startAt ?? 0))[0];
  const mine = attendance.filter((a) => a.employeeId === me.id).sort((a, b) => (b.clockInAt ?? 0) - (a.clockInAt ?? 0));

  return (
    <Screen scroll>
      <Text style={[type.title, { color: colors.text }]}>Attendance</Text>
      <Text style={[type.meta, { color: colors.textSecondary }]}>{todayLabel(workplaceTimezone)}</Text>
      <View style={{ marginTop: 8 }}>
        <StatusBadge label={clockedIn ? "Currently clocked in" : "Currently clocked out"} tone={clockedIn ? "success" : "neutral"} />
      </View>
      <Card style={{ marginTop: 16 }}>
        <Text style={[type.meta, { color: colors.textSecondary }]}>Today’s scheduled shift</Text>
        {todayShift ? (
          <>
            <Text style={[type.title, { color: colors.text, marginTop: 4 }]}>
              {todayShift.start} – {todayShift.end}
            </Text>
            <Text style={[type.body, { color: colors.textSecondary }]}>{todayShift.label}</Text>
            <Text style={[type.meta, { color: colors.muted, marginTop: 8 }]}>
              Last clock-in: {lastClockIn ?? "Not recorded yet"}
            </Text>
          </>
        ) : (
          <Text style={[type.body, { color: colors.text, marginTop: 6 }]}>No eligible shift today.</Text>
        )}
      </Card>
      <View style={{ height: 16 }} />
      <Button label="Scan workplace QR code" onPress={() => router.push("/(employee)/scan")} />
      <View style={{ height: 10 }} />
      <Button label="View attendance history" variant="secondary" onPress={() => router.push("/(employee)/history")} />
      <View style={{ marginTop: 20, gap: 10 }}>
        {mine.slice(0, 2).map((row) => (
          <Card key={row.id}>
            <Text style={[type.card, { color: colors.text }]}>{row.date}</Text>
            <Text style={[type.meta, { color: colors.textSecondary }]}>
              In {row.clockIn ?? "—"} · Out {row.clockOut ?? "—"}
            </Text>
            <View style={{ marginTop: 8 }}>
              <StatusBadge label={row.status} tone={badgeTone(row.status)} />
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
