import { fullName } from "@/src/data";
import { addDays, formatFull, isoDate } from "@/src/dates";
import { useStore } from "@/src/store";
import { colors, type } from "@/src/theme";
import { Avatar, BackHeader, Button, Card, Dialog, FilterChip, Screen, TextField } from "@/src/ui";
import { normalizeTime, repeatDatesForMonths } from "@/src/lib/time";
import { workplaceToday } from "@/src/lib/time";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";

const times = ["7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "1:00 PM", "3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const REPEAT = ["Does not repeat", "1 month", "2 months", "3 months", "6 months", "12 months"];
const breaks = [0, 15, 20, 30, 45, 60];

function dateLabel(value: string, today: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const [todayYear, todayMonth, todayDay] = today.split("-").map(Number);
  const todayDate = new Date(todayYear, todayMonth - 1, todayDay);
  const tomorrow = new Date(todayDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const prefix = date.toDateString() === todayDate.toDateString()
    ? "Today"
    : date.toDateString() === tomorrow.toDateString()
      ? "Tomorrow"
      : date.toLocaleDateString(undefined, { weekday: "long" });
  return `${prefix} · ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function Picker({
  label,
  options,
  value,
  onChange,
  formatOption,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  formatOption?: (option: string) => string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={[type.label, { color: colors.textSecondary }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {options.map((o) => (
          <FilterChip key={o} label={formatOption ? formatOption(o) : o} active={value === o} onPress={() => onChange(o)} />
        ))}
      </ScrollView>
    </View>
  );
}

export default function ShiftForm() {
  const router = useRouter();
  const { shiftId: shiftIdParam } = useLocalSearchParams<{ shiftId?: string }>();
  const shiftId = Array.isArray(shiftIdParam) ? shiftIdParam[0] : shiftIdParam;
  const { employees, shifts, addShifts, updateShift, setSnack, workplaceTimezone, businessName } = useStore();
  const today = workplaceToday(workplaceTimezone);
  const existing = shiftId ? shifts.find((item) => item.id === shiftId) : undefined;
  const staff = employees.filter((e) => !e.isAdmin && (e.status === "Active" || e.id === existing?.employeeId));
  const [employeeId, setEmployeeId] = useState(staff[0]?.id ?? "");
  const [date, setDate] = useState(today);
  const [start, setStart] = useState("9:00 AM");
  const [end, setEnd] = useState("5:00 PM");
  const [brk, setBrk] = useState(30);
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [leave, setLeave] = useState(false);
  const [repeat, setRepeat] = useState("Does not repeat");
  const [days, setDays] = useState<number[]>([new Date().getDay()]);
  const [startText, setStartText] = useState("");
  const [endText, setEndText] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const loadedShiftId = useRef<string | null>(null);

  useEffect(() => {
    if (existing && loadedShiftId.current !== existing.id) {
      loadedShiftId.current = existing.id;
      setEmployeeId(existing.employeeId);
      setDate(existing.date);
      setStart(existing.start);
      setEnd(existing.end);
      setBrk(existing.breakMinutes);
      setLabel(existing.label);
      setNote(existing.notes ?? "");
    }
  }, [existing]);

  useEffect(() => {
    if (!shiftId && !employeeId && staff[0]) setEmployeeId(staff[0].id);
  }, [employeeId, shiftId, staff]);

  const person = staff.find((e) => e.id === employeeId);
  const dayOptions = [...new Set([date, ...Array.from({ length: 14 }, (_, i) => isoDate(addDays(new Date(`${today}T12:00:00`), i)))])];
  const months = existing || repeat === "Does not repeat" ? 0 : parseInt(repeat, 10);
  const dates = months ? repeatDatesForMonths(date, months, days) : [date];
  const startOk = !startText || !!normalizeTime(startText);
  const endOk = !endText || !!normalizeTime(endText);
  const toggleDay = (d: number) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  const touch = () => setDirty(true);
  const close = () => (dirty ? setLeave(true) : router.back());

  if (shiftId && !existing) {
    return (
      <Screen>
        <Text style={[type.meta, { color: colors.muted }]}>Loading shift…</Text>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <BackHeader title={existing ? "Edit shift" : "Create shift"} onBack={close} />
      <View style={{ gap: 16 }}>
        <Text style={[type.section, { color: colors.text }]}>Employee</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {staff.map((e) => (
            <Card
              key={e.id}
              onPress={() => { touch(); setEmployeeId(e.id); }}
              style={{ width: 120, alignItems: "center", gap: 6, ...(e.id === employeeId ? { borderColor: colors.primary, backgroundColor: colors.paleBlue } : {}) }}
            >
              <Avatar initials={e.initials} color={e.accent} />
              <Text style={[type.meta, { color: colors.text }]} numberOfLines={1}>{fullName(e)}</Text>
              <Text style={[type.tiny, { color: colors.muted }]}>{e.title}</Text>
            </Card>
          ))}
        </ScrollView>

        <Text style={[type.section, { color: colors.text }]}>Date and time</Text>
        <Picker label="Date" options={dayOptions} value={date} onChange={(v) => { touch(); setDate(v); }} formatOption={(value) => dateLabel(value, today)} />
        <Picker label="Start time" options={times} value={start} onChange={(v) => { touch(); setStart(v); }} />
        <TextField label="Or exact start time" value={startText} onChangeText={(v) => { touch(); setStartText(v); const n = normalizeTime(v); if (n) setStart(n); }} placeholder="e.g. 8:45 AM or 14:30" error={startOk ? undefined : "Use a time like 8:45 AM"} />
        <Picker label="End time" options={times} value={end} onChange={(v) => { touch(); setEnd(v); }} />
        <TextField label="Or exact end time" value={endText} onChangeText={(v) => { touch(); setEndText(v); const n = normalizeTime(v); if (n) setEnd(n); }} placeholder="e.g. 5:15 PM or 17:15" error={endOk ? undefined : "Use a time like 5:15 PM"} />
        <Picker label="Break" options={breaks.map((b) => `${b} min`)} value={`${brk} min`} onChange={(v) => { touch(); setBrk(parseInt(v, 10)); }} />

        {!existing ? (
          <>
            <Text style={[type.section, { color: colors.text }]}>Repeat</Text>
            <Picker label="Repeat weekly for" options={REPEAT} value={repeat} onChange={(v) => { touch(); setRepeat(v); }} />
            {months > 0 && (
              <View style={{ gap: 6 }}>
                <Text style={[type.label, { color: colors.textSecondary }]}>Repeat on these days (starting {formatFull(date)})</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {DAYS.map((n, i) => <FilterChip key={n} label={n} active={days.includes(i)} onPress={() => { touch(); toggleDay(i); }} />)}
                </View>
              </View>
            )}
          </>
        ) : null}

        <Text style={[type.section, { color: colors.text }]}>Details</Text>
        <TextField label="Job title or shift label" value={label} onChangeText={(v) => { touch(); setLabel(v); }} placeholder="e.g. Opening barista" />
        <TextField label="Note" value={note} onChangeText={(v) => { touch(); setNote(v); }} placeholder="Optional" />

        <Card style={{ backgroundColor: colors.lavenderSurface }}>
          <Text style={[type.tiny, { color: colors.secondary }]}>Review</Text>
          <Text style={[type.card, { color: colors.text }]}>{person ? fullName(person) : "Select an employee"}</Text>
          <Text style={[type.meta, { color: colors.textSecondary }]}>{formatFull(date)} · {start} – {end} · {brk} min break</Text>
          {months > 0 && <Text style={[type.meta, { color: colors.textSecondary }]}>{dates.length} shifts · repeats weekly for {repeat}</Text>}
        </Card>

        <Button
          label={existing ? "Save changes" : dates.length > 1 ? `Save ${dates.length} shifts` : "Save shift"}
          loading={saving}
          disabled={!person || person.status !== "Active" || !startOk || !endOk || start === end || dates.length === 0 || saving}
          onPress={async () => {
            setSaving(true);
            try {
              const shift = {
                id: existing?.id ?? `sh-${Date.now()}`,
                employeeId,
                date,
                start,
                end,
                breakMinutes: brk,
                label: label || person?.title || "Shift",
                location: businessName,
                notes: note || undefined,
                status: existing?.status ?? "Draft" as const,
                revision: existing?.revision,
                changedAfterPublish: existing?.changedAfterPublish,
              };
              if (existing) await updateShift(shift);
              else await addShifts(dates.map((d, i) => ({ ...shift, id: `sh-${Date.now()}-${i}`, date: d, status: "Draft" as const })));
              setSnack({
                message: existing ? "Schedule updated" : dates.length > 1 ? `${dates.length} shifts saved as drafts` : "Shift saved as draft",
                tone: "success",
              });
              router.back();
            } catch (error) {
              const detail = error instanceof Error ? error.message : "Check your connection and try again.";
              setSnack({ message: `Could not save the shift: ${detail}`, tone: "warning" });
              setSaving(false);
            }
          }}
        />
        <Button label="Cancel" variant="secondary" onPress={close} />
      </View>
      <Dialog
        visible={leave}
        tone="warning"
        title="You have unsaved changes."
        body="Continue editing, or discard this shift."
        primary="Continue editing"
        secondary="Discard changes"
        onPrimary={() => setLeave(false)}
        onSecondary={() => { setLeave(false); router.back(); }}
      />
    </Screen>
  );
}
