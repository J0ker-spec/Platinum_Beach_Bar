import { fullName } from "@/src/data";
import { greeting, isoDate, todayLabel } from "@/src/dates";
import { useStore } from "@/src/store";
import { BUSINESS_NAME, colors, type } from "@/src/theme";
import { Button, Card, Screen, SectionHeader, StatusBadge } from "@/src/ui";
import { ActionTile, HeaderRow, ShiftCard, badgeTone } from "@/src/widgets";
import { ArrowLeftRight, CalendarDays, Clock3, Megaphone } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";

export default function EmployeeHome() {
  const router = useRouter();
  const { userId, shifts, announcements, notifications, clockedIn, getEmployee: findEmployee } = useStore();
  const me = findEmployee(userId ?? "EMP-0001")!;
  const today = isoDate();
  const mine = shifts.filter((s) => s.employeeId === me.id && s.status !== "Cancelled");
  const next = mine.find((s) => s.date === today) ?? mine.find((s) => s.date > today);
  const upcoming = mine.filter((s) => s.id !== next?.id && s.date >= today).slice(0, 3);
  const announcement = announcements.find((a) => a.status === "Published");
  const unread = notifications.some((n) => n.unread);

  return (
    <Screen scroll>
      <HeaderRow
        greeting={greeting()}
        name={me.firstName}
        date={todayLabel()}
        unread={unread}
        onBell={() => router.push("/(employee)/(tabs)/updates")}
      />
      {next ? (
        <Card style={next.date === today ? { backgroundColor: colors.lavenderSurface } : undefined}>
          <Text style={[type.meta, { color: colors.textSecondary }]}>
            {next.date === today ? "Today’s shift" : "Next shift"}
          </Text>
          <Text style={[type.title, { color: colors.text, marginTop: 4 }]}>
            {next.start} – {next.end}
          </Text>
          <Text style={[type.body, { color: colors.textSecondary }]}>
            {next.label} · {BUSINESS_NAME}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginVertical: 10, alignItems: "center" }}>
            <StatusBadge label={next.status} tone={badgeTone(next.status)} />
            <StatusBadge label={clockedIn ? "Clocked in" : "Clocked out"} tone={clockedIn ? "success" : "neutral"} />
          </View>
          <Button label="View shift" variant="secondary" onPress={() => router.push("/(employee)/(tabs)/schedule")} />
        </Card>
      ) : (
        <Card>
          <Text style={[type.card, { color: colors.text }]}>You’re not scheduled today</Text>
          <Text style={[type.meta, { color: colors.textSecondary, marginTop: 4 }]}>
            Enjoy the time off. Upcoming shifts still appear below.
          </Text>
        </Card>
      )}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
        <ActionTile icon={CalendarDays} label="View schedule" onPress={() => router.push("/(employee)/(tabs)/schedule")} />
        <ActionTile icon={Clock3} label="Clock in or out" onPress={() => router.push("/(employee)/scan")} />
        <ActionTile icon={ArrowLeftRight} label="Request a shift swap" onPress={() => router.push("/(employee)/swap")} />
        <ActionTile icon={Megaphone} label="View announcements" onPress={() => router.push("/(employee)/(tabs)/updates")} />
      </View>

      {next?.date === isoDate() ? (
        <Card style={{ marginTop: 16, backgroundColor: colors.warningSoft, borderColor: "#F3E0B8" }}>
          <Text style={[type.meta, { color: colors.warning }]}>Reminder</Text>
          <Text style={[type.body, { color: colors.text }]}>Your next shift starts today at {next.start}.</Text>
        </Card>
      ) : null}

      <SectionHeader title="Upcoming shifts" action="View full schedule" onAction={() => router.push("/(employee)/(tabs)/schedule")} />
      <View style={{ gap: 10 }}>
        {upcoming.map((shift) => (
          <ShiftCard key={shift.id} shift={shift} onPress={() => router.push("/(employee)/(tabs)/schedule")} />
        ))}
      </View>

      {announcement ? (
        <>
          <SectionHeader title="Latest announcement" />
          <Card onPress={() => router.push(`/(employee)/announcement/${announcement.id}`)}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={[type.card, { color: colors.text, flex: 1 }]}>{announcement.title}</Text>
              {announcement.priority === "Important" ? <StatusBadge label="Important" tone="warning" /> : null}
            </View>
            <Text style={[type.meta, { color: colors.textSecondary, marginTop: 6 }]}>{announcement.excerpt}</Text>
            <Text style={[type.tiny, { color: colors.muted, marginTop: 8 }]}>{announcement.publishedAt}</Text>
            <Text style={[type.meta, { color: colors.primary, marginTop: 8 }]}>Read announcement</Text>
          </Card>
        </>
      ) : null}
      <Text style={[type.tiny, { color: colors.muted, marginTop: 16 }]}>{fullName(me)} · {me.id}</Text>
    </Screen>
  );
}
