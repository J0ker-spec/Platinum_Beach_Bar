import { fullName } from "@/src/data";
import { addDays, formatFull, isoDate } from "@/src/dates";
import { useStore } from "@/src/store";
import { BUSINESS_NAME, colors, type } from "@/src/theme";
import { Avatar, BackHeader, Button, Card, Dialog, FilterChip, Screen, TextField } from "@/src/ui";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

const times = ["7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "1:00 PM", "3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM"];
const breaks = [0, 15, 20, 30, 45, 60];

function Picker({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={[type.label, { color: colors.textSecondary }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {options.map((o) => (
          <FilterChip key={o} label={o} active={value === o} onPress={() => onChange(o)} />
        ))}
      </ScrollView>
    </View>
  );
}

export default function ShiftForm() {
  const router = useRouter();
  const { employees, addShift, setSnack } = useStore();
  const staff = employees.filter((e) => !e.isAdmin && e.status === "Active");
  const [employeeId, setEmployeeId] = useState(staff[0]?.id ?? "");
  const [date, setDate] = useState(isoDate());
  const [start, setStart] = useState("9:00 AM");
  const [end, setEnd] = useState("5:00 PM");
  const [brk, setBrk] = useState(30);
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [leave, setLeave] = useState(false);
  const [dirty, setDirty] = useState(false);

  const person = staff.find((e) => e.id === employeeId);
  const dayOptions = Array.from({ length: 7 }, (_, i) => isoDate(addDays(new Date(), i)));
  const touch = () => setDirty(true);
  const close = () => (dirty ? setLeave(true) : router.back());

  return (
    <Screen scroll>
      <BackHeader title="Create shift" onBack={close} />
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
        <Picker label="Date" options={dayOptions} value={date} onChange={(v) => { touch(); setDate(v); }} />
        <Picker label="Start time" options={times} value={start} onChange={(v) => { touch(); setStart(v); }} />
        <Picker label="End time" options={times} value={end} onChange={(v) => { touch(); setEnd(v); }} />
        <Picker label="Break" options={breaks.map((b) => `${b} min`)} value={`${brk} min`} onChange={(v) => { touch(); setBrk(parseInt(v, 10)); }} />

        <Text style={[type.section, { color: colors.text }]}>Details</Text>
        <TextField label="Job title or shift label" value={label} onChangeText={(v) => { touch(); setLabel(v); }} placeholder="e.g. Opening barista" />
        <TextField label="Note" value={note} onChangeText={(v) => { touch(); setNote(v); }} placeholder="Optional" />

        <Card style={{ backgroundColor: colors.lavenderSurface }}>
          <Text style={[type.tiny, { color: colors.secondary }]}>Review</Text>
          <Text style={[type.card, { color: colors.text }]}>{person ? fullName(person) : "Select an employee"}</Text>
          <Text style={[type.meta, { color: colors.textSecondary }]}>{formatFull(date)} · {start} – {end} · {brk} min break</Text>
        </Card>

        <Button
          label="Save shift"
          disabled={!person}
          onPress={() => {
            addShift({
              id: `sh-${Date.now()}`,
              employeeId,
              date,
              start,
              end,
              breakMinutes: brk,
              label: label || person?.title || "Shift",
              location: BUSINESS_NAME,
              notes: note || undefined,
              status: "Draft",
            });
            setSnack({ message: "Shift saved as draft", tone: "success" });
            router.back();
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
