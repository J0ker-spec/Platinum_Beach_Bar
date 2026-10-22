import { addDays, formatPretty, formatRange, weekDates } from "@/src/dates";
import { workplaceToday } from "@/src/lib/time";
import { useStore } from "@/src/store";
import { colors, type } from "@/src/theme";
import { Button, Card, Dialog, EmptyState, Screen, Sheet, StatusBadge } from "@/src/ui";
import { ShiftCard, WeekStrip, badgeTone } from "@/src/widgets";
import { draftShiftsBetween, fullName } from "@/src/data";
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

export default function AdminSchedule() {
  const router = useRouter();
  const { shifts, publishSchedule, deleteShift, setSnack, workplaceTimezone, getEmployee: findEmployee } = useStore();
  const today = workplaceToday(workplaceTimezone);
  const [anchor, setAnchor] = useState(() => new Date(`${today}T12:00:00`));
  const dates = weekDates(anchor);
  const [selected, setSelected] = useState(today);
  const [publishOpen, setPublishOpen] = useState(false);
  const [draftInboxOpen, setDraftInboxOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishingDraft, setPublishingDraft] = useState(false);
  const [openShift, setOpenShift] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingShift, setDeletingShift] = useState(false);
  const dayShifts = shifts
    .filter((s) => s.date === selected)
    .sort((a, b) => (a.startAt ?? 0) - (b.startAt ?? 0));
  const draftShifts = draftShiftsBetween(shifts, dates[0], dates[6]);
  const allDrafts = shifts
    .filter((shift) => shift.status === "Draft")
    .sort((a, b) => (a.startAt ?? 0) - (b.startAt ?? 0));
  const scheduleStatus = draftShifts.length
    ? "Draft"
    : shifts.some((shift) => dates.includes(shift.date) && (shift.status === "Published" || shift.status === "Updated"))
      ? "Published"
      : "Draft";
  const coverage = dates.map((date) => ({
    date,
    count: shifts.filter((shift) => shift.date === date && shift.status !== "Cancelled").length,
  }));
  const viewShift = shifts.find((s) => s.id === openShift);
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
        <Pressable onPress={() => moveWeek(-7)} accessibilityLabel="Previous week">
          <ChevronLeft color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <WeekStrip dates={dates} selected={selected} marked={shifts.map((s) => s.date)} onSelect={setSelected} today={today} />
        </View>
        <Pressable onPress={() => moveWeek(7)} accessibilityLabel="Next week">
          <ChevronRight color={colors.text} />
        </Pressable>
      </View>
      <Button label="Create shift" onPress={() => router.push("/(admin)/shift-form")} />
      <View style={{ height: 10 }} />
      <Button label={`Review week to publish (${draftShifts.length} drafts)`} variant="secondary" loading={publishing} disabled={publishing} onPress={() => setPublishOpen(true)} />
      <View style={{ height: 8 }} />
      <Button label={`Review all saved drafts (${allDrafts.length})`} variant="secondary" onPress={() => setDraftInboxOpen(true)} />

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
            <ShiftCard key={shift.id} shift={shift} employee={findEmployee(shift.employeeId)} onPress={() => setOpenShift(shift.id)} />
          ))
        ) : (
          <EmptyState icon={CalendarDays} title="No shifts on this date" body="Create a shift to fill coverage." action="Create shift" onAction={() => router.push("/(admin)/shift-form")} />
        )}
      </View>

      <Sheet visible={publishOpen} onClose={() => { if (!publishing) setPublishOpen(false); }}>
        <Text style={[type.section, { color: colors.text }]}>Review {titleRange}</Text>
        <Text style={[type.meta, { color: colors.textSecondary }]}>
          {draftShifts.length
            ? `Only these ${draftShifts.length} draft shifts will be published.`
            : "There are no draft shifts in this week."}
        </Text>
        <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 8 }}>
          {draftShifts.map((shift) => (
            <Card key={shift.id} style={{ padding: 12 }}>
              <Text style={[type.card, { color: colors.text }]}>
                {formatPretty(shift.date)} · {shift.start}–{shift.end}
              </Text>
              <Text style={[type.meta, { color: colors.textSecondary }]}>
                {findEmployee(shift.employeeId) ? fullName(findEmployee(shift.employeeId)!) : shift.employeeId} · {shift.label}
              </Text>
            </Card>
          ))}
        </ScrollView>
        <Button
          label="Confirm and publish these shifts"
          loading={publishing}
          disabled={publishing || !draftShifts.length}
          onPress={async () => {
            if (publishing || !draftShifts.length) return;
            setPublishing(true);
            try {
              await publishSchedule(
                dates[0],
                dates[6],
                draftShifts.map(({ id, revision }) => ({ id, revision }))
              );
              setPublishOpen(false);
            } catch (error) {
              const detail = error instanceof Error ? error.message : "Unknown error";
              setSnack({ message: `Couldn't publish the schedule: ${detail}`, tone: "warning" });
            } finally {
              setPublishing(false);
            }
          }}
        />
        <Button label="Cancel" variant="ghost" disabled={publishing} onPress={() => setPublishOpen(false)} />
      </Sheet>
      <Sheet visible={draftInboxOpen} onClose={() => setDraftInboxOpen(false)}>
        <Text style={[type.section, { color: colors.text }]}>All saved drafts</Text>
        <Text style={[type.meta, { color: colors.textSecondary }]}>
          Open a draft to edit, delete, or publish it, including drafts from past weeks.
        </Text>
        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 8 }}>
          {allDrafts.length ? allDrafts.map((shift) => {
            const employee = findEmployee(shift.employeeId);
            return (
              <Card
                key={shift.id}
                onPress={() => {
                  // Close the list first: mounting two modals in the same frame can drop the second.
                  setDraftInboxOpen(false);
                  setTimeout(() => setOpenShift(shift.id), 200);
                }}
                style={{ padding: 12 }}
              >
                <Text style={[type.card, { color: colors.text }]}>
                  {formatPretty(shift.date)} · {shift.start}–{shift.end}
                </Text>
                <Text style={[type.meta, { color: colors.textSecondary }]}>
                  {employee ? fullName(employee) : shift.employeeId} · {shift.label}
                </Text>
              </Card>
            );
          }) : (
            <Text style={[type.meta, { color: colors.muted, paddingVertical: 16 }]}>There are no saved draft shifts.</Text>
          )}
        </ScrollView>
        <Button label="Close" variant="ghost" onPress={() => setDraftInboxOpen(false)} />
      </Sheet>
      <Sheet visible={!!viewShift} onClose={() => setOpenShift(null)}>
        {viewShift ? (
          <>
            <Text style={[type.section, { color: colors.text }]}>{formatPretty(viewShift.date)}</Text>
            <Text style={[type.title, { color: colors.text }]}>{viewShift.start} – {viewShift.end}</Text>
            <Text style={[type.body, { color: colors.textSecondary }]}>{viewShift.label} · {findEmployee(viewShift.employeeId) ? fullName(findEmployee(viewShift.employeeId)) : viewShift.employeeId}</Text>
            <StatusBadge label={viewShift.status} tone={badgeTone(viewShift.status)} />
            {viewShift.status === "Draft" ? (
              <Button
                label="Publish this draft"
                loading={publishingDraft}
                disabled={publishingDraft}
                onPress={async () => {
                  setPublishingDraft(true);
                  try {
                    const week = weekDates(new Date(`${viewShift.date}T12:00:00`));
                    await publishSchedule(week[0], week[6], [{ id: viewShift.id, revision: viewShift.revision }]);
                    setOpenShift(null);
                  } catch (error) {
                    const detail = error instanceof Error ? error.message : "Try again.";
                    setSnack({ message: `Couldn't publish the draft: ${detail}`, tone: "warning" });
                  } finally {
                    setPublishingDraft(false);
                  }
                }}
              />
            ) : null}
            {viewShift.status !== "Cancelled" ? (
              <>
                <Button
                  label="Edit shift"
                  icon={Pencil}
                  variant="secondary"
                  onPress={() => {
                    setOpenShift(null);
                    router.push({ pathname: "/(admin)/shift-form", params: { shiftId: viewShift.id } });
                  }}
                />
                <Button label="Delete shift" variant="danger" onPress={() => setConfirmDelete(true)} />
              </>
            ) : null}
            <Button label="Close" variant="ghost" onPress={() => setOpenShift(null)} />
          </>
        ) : null}
      </Sheet>

      <Dialog
        visible={confirmDelete}
        tone="danger"
        icon={Trash2}
        title={viewShift?.status === "Draft" ? "Delete this draft shift?" : "Cancel this published shift?"}
        body={viewShift?.status === "Draft"
          ? "The draft will be permanently removed. Shifts with attendance records cannot be removed."
          : "The shift will be cancelled for the employee. Its history will be retained."}
        primary={viewShift?.status === "Draft" ? "Delete draft" : "Cancel shift"}
        secondary="Cancel"
        primaryLoading={deletingShift}
        secondaryDisabled={deletingShift}
        onSecondary={() => setConfirmDelete(false)}
        onPrimary={async () => {
          if (!viewShift || deletingShift) return;
          setDeletingShift(true);
          try {
            const result = await deleteShift(viewShift.id);
            setSnack({ message: result === "deleted" ? "Draft shift deleted" : "Shift cancelled", tone: "success" });
            setConfirmDelete(false);
            setOpenShift(null);
          } catch (error) {
            console.error("Could not remove shift:", error);
            const detail = error instanceof Error ? error.message : "Try again.";
            setSnack({ message: `Couldn't remove the shift: ${detail}`, tone: "warning" });
          } finally {
            setDeletingShift(false);
          }
        }}
      />
    </Screen>
  );
}
