import { fullName } from "@/src/data";
import { greeting, todayLabel } from "@/src/dates";
import { workplaceToday } from "@/src/lib/time";
import { useStore } from "@/src/store";
import { colors, type } from "@/src/theme";
import { Card, Screen, SectionHeader, StatusBadge } from "@/src/ui";
import { ActionTile, HeaderRow, StatCard, badgeTone } from "@/src/widgets";
import { ClipboardCheck, Megaphone, UserPlus, CalendarPlus } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";

export default function AdminDashboard() {
  const router = useRouter();
  const { userId, shifts, attendance, swaps, notifications, registrations, workplaceTimezone, businessName, businessAddress, getEmployee: findEmployee } = useStore();
  const today = workplaceToday(workplaceTimezone);
  const todayShifts = shifts.filter((s) => s.date === today && (s.status === "Published" || s.status === "Updated"));
  const present = attendance.filter((a) => a.date === today && a.clockIn && a.clockIn !== "—");
  const clocked = present.filter((a) => !a.clockOut || a.clockOut === "—");
  const clockedIds = new Set(clocked.map((record) => record.employeeId));
  const presentIds = new Set(present.map((record) => record.employeeId));
  const scheduledIds = new Set(todayShifts.map((shift) => shift.employeeId));
  // Employees who have no clock-in at all today; clocking out does not put someone back to "missing".
  const notClockedIn = [...scheduledIds].filter((id) => !presentIds.has(id)).length;
  const late = attendance.filter((a) => a.date === today && a.status === "Late");
  const pending = swaps.filter((s) => s.status === "Awaiting approval");
  const missing = attendance.filter((a) => a.date === today && a.status === "Incomplete");

  return (
    <Screen scroll>
      <HeaderRow
        greeting={greeting(workplaceTimezone)}
        name={findEmployee(userId ?? "")?.firstName ?? "Admin"}
        date={todayLabel(workplaceTimezone)}
        unread={notifications.some((n) => n.unread)}
        onBell={() => router.push("/(admin)/announcements")}
      />
      <Text style={[type.meta, { color: colors.textSecondary, marginTop: -8, marginBottom: 12 }]}>
        {businessName}{businessAddress ? ` · ${businessAddress}` : ""}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <StatCard label="Scheduled today" value={todayShifts.length} icon={CalendarPlus} />
        <StatCard label="Clocked in" value={clockedIds.size} icon={ClipboardCheck} />
        <StatCard label="Pending staff" value={registrations.length} icon={UserPlus} />
        <StatCard label="Pending swaps" value={pending.length} icon={Megaphone} />
      </View>

      <SectionHeader title="Today’s workforce" />
      <Card>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <StatusBadge label={`Scheduled ${todayShifts.length}`} tone="info" />
          <StatusBadge label={`Clocked in ${clockedIds.size}`} tone="success" />
          <StatusBadge label={`Not yet clocked in ${notClockedIn}`} tone="neutral" />
          <StatusBadge label={`Late ${late.length}`} tone="warning" />
          <StatusBadge label={`Missing clock-out ${missing.length}`} tone="danger" />
        </View>
        <View style={{ height: 10, borderRadius: 6, backgroundColor: colors.surface, marginTop: 14, overflow: "hidden", flexDirection: "row" }}>
          {clockedIds.size > 0 ? <View style={{ flex: clockedIds.size, backgroundColor: colors.success }} /> : null}
          {late.length > 0 ? <View style={{ flex: late.length, backgroundColor: colors.warning }} /> : null}
          {notClockedIn > 0 ? <View style={{ flex: notClockedIn, backgroundColor: colors.border }} /> : null}
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
          const employee = findEmployee(shift.employeeId);
          const record = attendance.find((a) => a.employeeId === shift.employeeId && a.date === today);
          return (
            <Card key={shift.id}>
              <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>

                <View style={{ flex: 1 }}>
                  <Text style={[type.card, { color: colors.text }]}>{employee ? fullName(employee) : shift.employeeId}</Text>
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

      <SectionHeader
        title="Needs attention"
        action="View all"
        onAction={() => router.push(registrations.length > 0 ? "/(admin)/pending-approvals" : "/(admin)/swaps")}
      />
      {registrations.length > 0 && (
        <Card
          style={{ backgroundColor: colors.warningSoft, borderColor: colors.warning, marginBottom: 10 }}
          onPress={() => router.push("/(admin)/pending-approvals")}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={[type.card, { color: colors.text }]}>
                {registrations.length} account registration{registrations.length === 1 ? "" : "s"} awaiting approval
              </Text>
              <Text style={[type.meta, { color: colors.textSecondary, marginTop: 4 }]}>
                Tap to review and approve new staff access
              </Text>
            </View>
            <StatusBadge label="Review" tone="warning" />
          </View>
        </Card>
      )}
      <Card
        style={{ backgroundColor: pending.length > 0 ? colors.warningSoft : colors.surface, borderColor: pending.length > 0 ? colors.warning : colors.border }}
        onPress={() => router.push("/(admin)/swaps")}
      >
        <Text style={[type.card, { color: colors.text }]}>
          {pending.length} shift-swap request{pending.length === 1 ? "" : "s"} awaiting review
        </Text>
        <Text style={[type.meta, { color: colors.textSecondary, marginTop: 4 }]}>
          {missing.length} missing clock-out record{missing.length === 1 ? "" : "s"} today
        </Text>
      </Card>
    </Screen>
  );
}
