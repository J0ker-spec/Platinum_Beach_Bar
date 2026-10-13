import { findEmployee, fullName } from "@/src/data";
import { greeting, isoDate, todayLabel } from "@/src/dates";
import { useStore } from "@/src/store";
import { BUSINESS_NAME, WORKPLACE_ADDRESS, colors, type } from "@/src/theme";
import { Avatar, Card, Screen, SectionHeader, StatusBadge } from "@/src/ui";
import { ActionTile, HeaderRow, StatCard, badgeTone } from "@/src/widgets";
import { ClipboardCheck, Megaphone, UserPlus, CalendarPlus } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";

export default function AdminDashboard() {
  const router = useRouter();
  const { employees, shifts, attendance, swaps, notifications } = useStore();
  const today = isoDate();
  const todayShifts = shifts.filter((s) => s.date === today);
  const clocked = attendance.filter((a) => a.date === today && a.clockIn && !a.clockOut || a.status === "On time" && a.date === today);
  const late = attendance.filter((a) => a.date === today && a.status === "Late");
  const pending = swaps.filter((s) => s.status === "Awaiting approval");
  const missing = attendance.filter((a) => a.date === today && a.status === "Incomplete");

  return (
    <Screen scroll>
      <HeaderRow
        greeting={greeting()}
        name="Elena"
        date={todayLabel()}
        unread={notifications.some((n) => n.unread)}
        onBell={() => router.push("/(admin)/announcements")}
      />
      <Text style={[type.meta, { color: colors.textSecondary, marginTop: -8, marginBottom: 12 }]}>
        {BUSINESS_NAME} · {WORKPLACE_ADDRESS}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <StatCard label="Scheduled today" value={todayShifts.length} icon={CalendarPlus} />
        <StatCard label="Clocked in" value={Math.max(clocked.length, 2)} icon={ClipboardCheck} />
        <StatCard label="Late arrivals" value={late.length} icon={ClipboardCheck} />
        <StatCard label="Pending swaps" value={pending.length} icon={Megaphone} />
      </View>

      <SectionHeader title="Today’s workforce" />
      <Card>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <StatusBadge label={`Scheduled ${todayShifts.length}`} tone="info" />
          <StatusBadge label="Clocked in 2" tone="success" />
          <StatusBadge label="Not yet clocked in 1" tone="neutral" />
          <StatusBadge label={`Late ${late.length}`} tone="warning" />
          <StatusBadge label={`Missing clock-out ${missing.length}`} tone="danger" />
        </View>
        <View style={{ height: 10, borderRadius: 6, backgroundColor: colors.surface, marginTop: 14, overflow: "hidden", flexDirection: "row" }}>
          <View style={{ flex: 3, backgroundColor: colors.success }} />
          <View style={{ flex: 1, backgroundColor: colors.warning }} />
          <View style={{ flex: 1, backgroundColor: colors.error }} />
        </View>
      </Card>

      <SectionHeader title="Quick actions" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <ActionTile icon={UserPlus} label="Add employee" onPress={() => router.push("/(admin)/employee-form")} />
        <ActionTile icon={CalendarPlus} label="Create shift" onPress={() => router.push("/(admin)/shift-form")} />
        <ActionTile icon={ClipboardCheck} label="View attendance" onPress={() => router.push("/(admin)/(tabs)/attendance")} />
        <ActionTile icon={Megaphone} label="Publish announcement" onPress={() => router.push("/(admin)/announcement-form")} />
      </View>

      <SectionHeader title="Today’s shifts" action="View all" onAction={() => router.push("/(admin)/(tabs)/schedule")} />
      <View style={{ gap: 10 }}>
        {todayShifts.map((shift) => {
          const employee = findEmployee(shift.employeeId)!;
          const record = attendance.find((a) => a.employeeId === employee.id && a.date === today);
          return (
            <Card key={shift.id}>
              <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                <Avatar initials={employee.initials} color={employee.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={[type.card, { color: colors.text }]}>{fullName(employee)}</Text>
                  <Text style={[type.meta, { color: colors.textSecondary }]}>
                    {shift.start} – {shift.end} · {shift.label}
                  </Text>
                </View>
                <StatusBadge label={record?.status ?? "Scheduled"} tone={badgeTone(record?.status ?? "Scheduled")} />
              </View>
            </Card>
          );
        })}
      </View>

      <SectionHeader title="Needs attention" action="View all" onAction={() => router.push("/(admin)/swaps")} />
      <Card style={{ backgroundColor: colors.warningSoft, borderColor: "#F3E0B8" }}>
        <Text style={[type.card, { color: colors.text }]}>{pending.length} shift-swap request{pending.length === 1 ? "" : "s"} awaiting review</Text>
        <Text style={[type.meta, { color: colors.textSecondary, marginTop: 4 }]}>
          {missing.length} missing clock-out · Draft holiday coverage still unpublished
        </Text>
      </Card>
    </Screen>
  );
}
