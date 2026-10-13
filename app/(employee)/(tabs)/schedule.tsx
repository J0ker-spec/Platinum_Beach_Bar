import { findEmployee } from "@/src/data";
import { addDays, formatFull, formatRange, isoDate, weekDates } from "@/src/dates";
import { useStore } from "@/src/store";
import { colors, type } from "@/src/theme";
import { Button, EmptyState, Screen, SectionHeader, Sheet, StatusBadge } from "@/src/ui";
import { ShiftCard, WeekStrip, badgeTone } from "@/src/widgets";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

export default function EmployeeSchedule() {
  const router = useRouter();
  const { userId, shifts, swaps } = useStore();
  const me = findEmployee(userId ?? "EMP-0001")!;
  const [anchor, setAnchor] = useState(new Date());
  const dates = weekDates(anchor);
  const [selected, setSelected] = useState(isoDate());
  const [openId, setOpenId] = useState<string | null>(null);
  const mine = shifts.filter((s) => s.employeeId === me.id);
  const dayShifts = mine.filter((s) => s.date === selected);
  const marked = mine.map((s) => s.date);
  const selectedShift = mine.find((s) => s.id === openId);
  const mySwaps = swaps.filter((s) => s.fromEmployeeId === me.id);

  const titleRange = useMemo(() => formatRange(dates[0], dates[6]), [dates]);

  return (
    <Screen scroll>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <Text style={[type.title, { color: colors.text }]}>My Schedule</Text>
          <Text style={[type.meta, { color: colors.textSecondary }]}>{titleRange}</Text>
        </View>
        <CalendarDays size={22} color={colors.primary} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 12 }}>
        <Pressable accessibilityLabel="Previous week" onPress={() => setAnchor(addDays(anchor, -7))}>
          <ChevronLeft color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <WeekStrip dates={dates} selected={selected} marked={marked} onSelect={setSelected} />
        </View>
        <Pressable accessibilityLabel="Next week" onPress={() => setAnchor(addDays(anchor, 7))}>
          <ChevronRight color={colors.text} />
        </Pressable>
      </View>

      {dayShifts.length ? (
        <View style={{ gap: 10 }}>
          {dayShifts.map((shift) => (
            <ShiftCard key={shift.id} shift={shift} highlight={shift.date === isoDate()} onPress={() => setOpenId(shift.id)} />
          ))}
        </View>
      ) : (
        <EmptyState
          icon={CalendarDays}
          title="No shift scheduled"
          body="Nothing is assigned for this date. You can still browse the rest of the week."
          action="View the full week"
          onAction={() => setSelected(dates[0])}
        />
      )}

      <SectionHeader title="My swap requests" />
      <View style={{ gap: 10 }}>
        {mySwaps.map((swap) => {
          const shift = shifts.find((s) => s.id === swap.shiftId);
          const colleague = findEmployee(swap.toEmployeeId);
          return (
            <View key={swap.id} style={{ backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 14 }}>
              <Text style={[type.card, { color: colors.text }]}>{shift ? formatFull(shift.date) : "Shift"}</Text>
              <Text style={[type.meta, { color: colors.textSecondary }]}>
                With {colleague?.firstName} {colleague?.lastName} · Submitted {swap.submitted}
              </Text>
              <View style={{ marginTop: 8 }}>
                <StatusBadge label={swap.status} tone={badgeTone(swap.status)} />
              </View>
            </View>
          );
        })}
      </View>
      <View style={{ height: 12 }} />
      <Button label="Request a shift swap" variant="secondary" onPress={() => router.push("/(employee)/swap")} />

      <Sheet visible={!!selectedShift} onClose={() => setOpenId(null)}>
        {selectedShift ? (
          <>
            <Text style={[type.section, { color: colors.text }]}>{formatFull(selectedShift.date)}</Text>
            <Text style={[type.title, { color: colors.text }]}>
              {selectedShift.start} – {selectedShift.end}
            </Text>
            <Text style={[type.body, { color: colors.textSecondary }]}>
              {selectedShift.label} · {selectedShift.location}
            </Text>
            <Text style={[type.meta, { color: colors.muted }]}>Break · {selectedShift.breakMinutes} minutes</Text>
            {selectedShift.notes ? <Text style={[type.body, { color: colors.text }]}>{selectedShift.notes}</Text> : null}
            <StatusBadge label={selectedShift.status} tone={badgeTone(selectedShift.status)} />
            {selectedShift.status !== "Cancelled" ? (
              <Button
                label="Request shift swap"
                onPress={() => {
                  setOpenId(null);
                  router.push({ pathname: "/(employee)/swap", params: { shiftId: selectedShift.id } });
                }}
              />
            ) : null}
            <Button label="Close" variant="ghost" onPress={() => setOpenId(null)} />
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
