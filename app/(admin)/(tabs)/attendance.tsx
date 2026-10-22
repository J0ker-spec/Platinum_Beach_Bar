import { fullName } from "@/src/data";
import { useStore } from "@/src/store";
import { workplaceToday } from "@/src/lib/time";
import { colors, type } from "@/src/theme";
import { Avatar, Button, EmptyState, FilterChip, Screen, SearchField, Sheet, StatusBadge, TextField } from "@/src/ui";
import { StatCard, badgeTone } from "@/src/widgets";
import { ClipboardList } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

export default function AdminAttendance() {
  const { attendance, shifts, correctAttendance, setSnack, workplaceTimezone, getEmployee: findEmployee } = useStore();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [open, setOpen] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [correcting, setCorrecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const today = workplaceToday(workplaceTimezone);
  const todayShifts = shifts.filter((shift) => shift.date === today && (shift.status === "Published" || shift.status === "Updated"));
  const presentToday = attendance.filter((record) => record.date === today && record.clockIn && record.clockIn !== "—");
  const presentIds = new Set(presentToday.map((record) => record.employeeId));
  const scheduledIds = new Set(todayShifts.map((shift) => shift.employeeId));
  // "Not in" counts employees with no clock-in today at all — someone who already clocked out is
  // not missing.
  const notClockedIn = [...scheduledIds].filter((id) => !presentIds.has(id)).length;
  const rows = attendance.filter((row) => {
    const employee = findEmployee(row.employeeId);
    const matches = `${fullName(employee)} ${row.employeeId}`.toLowerCase().includes(query.toLowerCase());
    return matches && (filter === "All" || row.status === filter);
  });
  const current = attendance.find((a) => a.id === open);
  const currentEmployee = current ? findEmployee(current.employeeId) : undefined;

  return (
    <Screen scroll>
      <Text style={[type.title, { color: colors.text }]}>Attendance</Text>
      <Text style={[type.meta, { color: colors.textSecondary }]}>All records · today is {today}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginVertical: 12 }}>
        <StatCard label="Present" value={presentIds.size} icon={ClipboardList} />
        <StatCard label="Late" value={attendance.filter((a) => a.date === today && a.status === "Late").length} icon={ClipboardList} />
        <StatCard label="Not in" value={notClockedIn} icon={ClipboardList} />
        <StatCard label="Missing out" value={attendance.filter((a) => a.date === today && a.status === "Incomplete").length} icon={ClipboardList} />
      </View>
      <SearchField value={query} onChangeText={setQuery} placeholder="Search by employee" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 12 }}>
        {["All", "On time", "Late", "Incomplete", "Corrected"].map((item) => (
          <FilterChip key={item} label={item} active={filter === item} onPress={() => setFilter(item)} />
        ))}
      </View>
      {rows.length ? (
        <View style={{ gap: 10 }}>
          {rows.map((row) => {
            const employee = findEmployee(row.employeeId);
            return (
              <Pressable
                key={row.id}
                onPress={() => {
                  setOpen(row.id);
                  setClockIn(row.clockIn ?? "");
                  setClockOut(row.clockOut ?? "");
                  setReason("");
                  setCorrecting(false);
                }}
                style={{ backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 14 }}
              >
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Avatar initials={employee?.initials ?? "?"} color={employee?.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={[type.card, { color: colors.text }]}>{employee ? fullName(employee) : row.employeeId}</Text>
                    <Text style={[type.tiny, { color: colors.muted }]}>{row.employeeId}</Text>
                    <Text style={[type.meta, { color: colors.textSecondary }]}>
                      {row.scheduledStart}–{row.scheduledEnd} · In {row.clockIn || "—"} · Out {row.clockOut || "missing"}
                    </Text>
                  </View>
                  <StatusBadge label={row.status === "Incomplete" ? "Clock-out missing" : row.status} tone={badgeTone(row.status)} />
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <EmptyState icon={ClipboardList} title="No attendance records" body="No employees match this date or filter." />
      )}

      <Sheet visible={!!current} onClose={() => setOpen(null)}>
        {current ? (
          <>
            <Text style={[type.section, { color: colors.text }]}>{currentEmployee ? fullName(currentEmployee) : current.employeeId}</Text>
            <Text style={[type.meta, { color: colors.muted }]}>{current.employeeId} · {current.date}</Text>
            <Text style={[type.body, { color: colors.text }]}>Scheduled {current.scheduledStart} – {current.scheduledEnd}</Text>
            <Text style={[type.body, { color: colors.text }]}>Recorded in {current.clockIn ?? "—"} / out {current.clockOut ?? "—"}</Text>
            <StatusBadge label={current.status} tone={badgeTone(current.status)} />
            {correcting ? (
              <>
                <TextField label="Clock-in" value={clockIn} onChangeText={setClockIn} />
                <TextField label="Clock-out" value={clockOut} onChangeText={setClockOut} />
                <TextField label="Reason (required)" value={reason} onChangeText={setReason} helper="Corrections should be recorded for accountability." />
                <Button
                  label="Save correction"
                  loading={saving}
                  disabled={!reason.trim() || saving}
                  onPress={async () => {
                    if (saving) return;
                    setSaving(true);
                    try {
                      await correctAttendance(current.id, clockIn, clockOut, reason);
                      setOpen(null);
                    } catch (error) {
                      const detail = error instanceof Error ? error.message : "Try again.";
                      setSnack({ message: `Couldn't save the correction: ${detail}`, tone: "warning" });
                    } finally {
                      setSaving(false);
                    }
                  }}
                />
              </>
            ) : (
              <Button label="Correct attendance" variant="secondary" onPress={() => setCorrecting(true)} />
            )}
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
