import { findEmployee } from "@/src/data";
import { addDays, formatRange, isoDate, weekDates } from "@/src/dates";
import { useStore } from "@/src/store";
import { colors, type } from "@/src/theme";
import { Button, Card, Dialog, EmptyState, Screen, StatusBadge } from "@/src/ui";
import { ShiftCard, WeekStrip, badgeTone } from "@/src/widgets";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

export default function AdminSchedule() {
  const router = useRouter();
  const { shifts, scheduleStatus, publishSchedule } = useStore();
  const [anchor, setAnchor] = useState(new Date());
  const dates = weekDates(anchor);
  const [selected, setSelected] = useState(isoDate());
  const [publishOpen, setPublishOpen] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const dayShifts = shifts.filter((s) => s.date === selected);
  const coverage = dates.map((date) => ({ date, count: shifts.filter((s) => s.date === date).length }));

  const titleRange = useMemo(() => formatRange(dates[0], dates[6]), [dates]);

  return (
    <Screen scroll>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View>
          <Text style={[type.title, { color: colors.text }]}>Schedule</Text>
          <Text style={[type.meta, { color: colors.textSecondary }]}>{titleRange}</Text>
        </View>
        <StatusBadge label={scheduleStatus} tone={badgeTone(scheduleStatus)} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 12 }}>
        <Pressable onPress={() => setAnchor(addDays(anchor, -7))} accessibilityLabel="Previous week">
          <ChevronLeft color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <WeekStrip dates={dates} selected={selected} marked={shifts.map((s) => s.date)} onSelect={setSelected} />
        </View>
        <Pressable onPress={() => setAnchor(addDays(anchor, 7))} accessibilityLabel="Next week">
          <ChevronRight color={colors.text} />
        </Pressable>
      </View>
      <Button label="Create shift" onPress={() => router.push("/(admin)/shift-form")} />
      <View style={{ height: 10 }} />
      <Button label="Publish schedule" variant="secondary" onPress={() => setPublishOpen(true)} />

      <Text style={[type.section, { color: colors.text, marginTop: 18, marginBottom: 8 }]}>Weekly coverage</Text>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          {coverage.map((item) => (
            <View key={item.date} style={{ alignItems: "center", gap: 6 }}>
              <View
                style={{
                  width: 10,
                  height: 28,
                  borderRadius: 6,
                  backgroundColor: item.count ? colors.primary : colors.border,
                  opacity: item.count ? Math.min(1, 0.4 + item.count * 0.2) : 1,
                }}
              />
              <Text style={[type.tiny, { color: item.count ? colors.text : colors.warning }]}>{item.count || "!"}</Text>
            </View>
          ))}
        </View>
      </Card>

      <View style={{ marginTop: 16, gap: 10 }}>
        {dayShifts.length ? (
          dayShifts.map((shift) => (
            <ShiftCard key={shift.id} shift={shift} employee={findEmployee(shift.employeeId)} onPress={() => router.push("/(admin)/shift-form")} />
          ))
        ) : (
          <EmptyState icon={CalendarDays} title="No shifts on this date" body="Create a shift to fill coverage." action="Create shift" onAction={() => router.push("/(admin)/shift-form")} />
        )}
      </View>

      <Card style={{ marginTop: 16, backgroundColor: colors.warningSoft }}>
        <Text style={[type.card, { color: colors.text }]}>Incomplete planning</Text>
        <Text style={[type.meta, { color: colors.textSecondary }]}>Friday still has a draft shift. Review before publishing.</Text>
        <Button label="Leave editor" variant="ghost" onPress={() => setUnsaved(true)} />
      </Card>

      <Dialog
        visible={publishOpen}
        icon={CalendarDays}
        title="Publish schedule?"
        body={`The week of ${titleRange} will become visible to employees.`}
        primary="Publish schedule"
        secondary="Cancel"
        onSecondary={() => setPublishOpen(false)}
        onPrimary={() => {
          setPublishOpen(false);
          publishSchedule();
        }}
      />
      <Dialog
        visible={unsaved}
        tone="warning"
        title="You have unsaved changes."
        body="Continue editing this draft or discard the preview edits."
        primary="Continue editing"
        secondary="Discard changes"
        onPrimary={() => setUnsaved(false)}
        onSecondary={() => setUnsaved(false)}
      />
    </Screen>
  );
}
