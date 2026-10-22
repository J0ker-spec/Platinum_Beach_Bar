import { addDays, formatFull, formatRange, weekDates } from "@/src/dates";
import { workplaceToday } from "@/src/lib/time";
import { useStore } from "@/src/store";
import { colors, type } from "@/src/theme";
import { Button, Dialog, EmptyState, Screen, SectionHeader, Sheet, StatusBadge } from "@/src/ui";
import { ShiftCard, WeekStrip, badgeTone } from "@/src/widgets";
import { isSwappableShift } from "@/src/data";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

export default function EmployeeSchedule() {
  const router = useRouter();
  const { userId, shifts, swaps, cancelSwap, setSnack, workplaceTimezone, getEmployee: findEmployee } = useStore();
  const today = workplaceToday(workplaceTimezone);
  const [anchor, setAnchor] = useState(() => new Date(`${today}T12:00:00`));
  const dates = weekDates(anchor);
  const [selected, setSelected] = useState(today);
  const [openId, setOpenId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const me = findEmployee(userId ?? "");
  const mine = shifts.filter((s) => s.employeeId === (me?.id ?? ""));
  const dayShifts = mine.filter((s) => s.date === selected);
  const marked = mine.map((s) => s.date);
  const selectedShift = mine.find((s) => s.id === openId);
  const mySwaps = swaps.filter((s) => s.fromEmployeeId === (me?.id ?? ""));
  const incomingSwaps = swaps.filter((s) => s.toEmployeeId === (me?.id ?? "") && s.status === "Pending coworker");
  useEffect(() => {
    setAnchor(new Date(`${today}T12:00:00`));
    setSelected(today);
  }, [today]);
  const moveWeek = (offset: number) => {
    const nextAnchor = addDays(anchor, offset);
    const nextDates = weekDates(nextAnchor);
    const selectedIndex = dates.indexOf(selected);
    setAnchor(nextAnchor);
    setSelected(selectedIndex >= 0 ? nextDates[selectedIndex] : nextDates[0]);
  };

  const titleRange = useMemo(() => formatRange(dates[0], dates[6]), [dates]);
  if (!me) return <Screen><Text style={[type.meta, { color: colors.muted }]}>Loading…</Text></Screen>;

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
        <Pressable accessibilityLabel="Previous week" onPress={() => moveWeek(-7)}>
          <ChevronLeft color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <WeekStrip dates={dates} selected={selected} marked={marked} onSelect={setSelected} today={today} />
        </View>
        <Pressable accessibilityLabel="Next week" onPress={() => moveWeek(7)}>
          <ChevronRight color={colors.text} />
        </Pressable>
      </View>

      {dayShifts.length ? (
        <View style={{ gap: 10 }}>
          {dayShifts.map((shift) => (
            <ShiftCard key={shift.id} shift={shift} highlight={shift.date === today} onPress={() => setOpenId(shift.id)} />
          ))}
        </View>
      ) : (
        <EmptyState
          icon={CalendarDays}
          title="No shift scheduled"
          body="Nothing is assigned for this date. You can still browse the rest of the week."
          action="View the full week"
          onAction={() => setSelected(mine.find((s) => dates.includes(s.date))?.date ?? today)}
        />
      )}

      <SectionHeader title="My swap requests" />
      <View style={{ gap: 10 }}>
        {mySwaps.map((swap) => {
          const shift = shifts.find((s) => s.id === swap.shiftId);
          const colleague = findEmployee(swap.toEmployeeId);
          return (
            <View key={swap.id} style={{ backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 14 }}>
              <Text style={[type.card, { color: colors.text }]}>{shift ? formatFull(shift.date) : "Shift"}</Text>
              <Text style={[type.meta, { color: colors.textSecondary }]}>
                With {colleague?.firstName} {colleague?.lastName} · Submitted {swap.submitted}
              </Text>
              <View style={{ marginTop: 8 }}>
                <StatusBadge label={swap.status} tone={badgeTone(swap.status)} />
              </View>
              {["Pending coworker", "Awaiting approval"].includes(swap.status) ? (
                <Button label="Cancel request" variant="ghost" onPress={() => setCancelId(swap.id)} />
              ) : null}
            </View>
          );
        })}
      </View>
      <View style={{ height: 12 }} />
      {incomingSwaps.length ? (
        <Button
          label={`Respond to ${incomingSwaps.length} swap request${incomingSwaps.length > 1 ? "s" : ""}`}
          variant="secondary"
          onPress={() => router.push("/(employee)/swap-inbox")}
        />
      ) : null}
      <Button label="Request a shift swap" variant="secondary" onPress={() => router.push("/(employee)/swap")} />

      <Dialog
        visible={!!cancelId}
        tone="warning"
        title="Cancel this swap request?"
        body="The other employee will be notified, and the request will no longer be approvable."
        primary="Cancel request"
        secondary="Keep request"
        onSecondary={() => setCancelId(null)}
        onPrimary={async () => {
          if (!cancelId || cancelling) return;
          setCancelling(true);
          try {
            await cancelSwap(cancelId);
            setSnack({ message: "Swap request cancelled", tone: "info" });
            setCancelId(null);
          } catch (error) {
            const detail = error instanceof Error ? error.message : "Try again.";
            setSnack({ message: `Couldn't cancel the request: ${detail}`, tone: "warning" });
          } finally {
            setCancelling(false);
          }
        }}
      />

      <Sheet visible={!!selectedShift} onClose={() => setOpenId(null)}>
        {selectedShift ? (
          <>
            <Text style={[type.section, { color: colors.text }]}>{formatFull(selectedShift.date)}</Text>
            <Text style={[type.title, { color: colors.text }]}>
              {selectedShift.start} – {selectedShift.end}
            </Text>
            <Text style={[type.body, { color: colors.textSecondary }]}>
              {selectedShift.label}
              {selectedShift.location ? ` · ${selectedShift.location}` : ""}
            </Text>
            <Text style={[type.meta, { color: colors.muted }]}>Break · {selectedShift.breakMinutes} minutes</Text>
            {selectedShift.notes ? <Text style={[type.body, { color: colors.text }]}>{selectedShift.notes}</Text> : null}
            <StatusBadge label={selectedShift.status} tone={badgeTone(selectedShift.status)} />
            {isSwappableShift(selectedShift) ? (
              <Button
                label="Request shift swap"
                onPress={() => {
                  setOpenId(null);
                  router.push({ pathname: "/(employee)/swap", params: { shiftId: selectedShift.id } });
                }}
              />
            ) : selectedShift.status === "Published" ? (
              <Text style={[type.meta, { color: colors.muted }]}>
                This shift has already started, so it can't be swapped.
              </Text>
            ) : null}
            <Button label="Close" variant="ghost" onPress={() => setOpenId(null)} />
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
