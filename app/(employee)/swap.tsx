
import { formatFull, isoDate } from "@/src/dates";
import { useStore } from "@/src/store";
import { colors, type } from "@/src/theme";
import { Avatar, Button, Card, Dialog, Screen, SearchField, TextField } from "@/src/ui";
import { CheckCircle2 } from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

const steps = ["Shift", "Colleague", "Review"];

export default function SwapFlow() {
  const router = useRouter();
  const { shiftId } = useLocalSearchParams<{ shiftId?: string }>();
  const { userId, shifts, employees, addSwap, setSnack, getEmployee: findEmployee } = useStore();
  const me = findEmployee(userId ?? "EMP-0001")!;
  const mine = shifts.filter((s) => s.employeeId === me.id && s.status !== "Cancelled");
  const [step, setStep] = useState(0);
  const [selectedShift, setSelectedShift] = useState(shiftId ?? mine[1]?.id ?? mine[0]?.id);
  const [colleague, setColleague] = useState("EMP-0002");
  const [query, setQuery] = useState("");
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const shift = shifts.find((s) => s.id === selectedShift);
  const peers = employees.filter(
    (e) => e.id !== me.id && e.status === "Active" && !e.isAdmin && e.lastName.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <Screen scroll>
      <Pressable onPress={() => router.back()}>
        <Text style={[type.meta, { color: colors.primary }]}>Close</Text>
      </Pressable>
      <Text style={[type.title, { color: colors.text, marginTop: 8 }]}>Request shift swap</Text>
      <View style={{ flexDirection: "row", gap: 8, marginVertical: 16 }}>
        {steps.map((label, index) => (
          <View key={label} style={{ flex: 1, alignItems: "center" }}>
            <View
              style={{
                height: 6,
                width: "100%",
                borderRadius: 3,
                backgroundColor: index <= step ? colors.primary : colors.border,
              }}
            />
            <Text style={[type.tiny, { color: index === step ? colors.primary : colors.muted, marginTop: 6 }]}>{label}</Text>
          </View>
        ))}
      </View>

      {step === 0 && (
        <View style={{ gap: 10 }}>
          {mine.map((item) => (
            <Card key={item.id} onPress={() => setSelectedShift(item.id)} style={item.id === selectedShift ? { borderColor: colors.primary } : undefined}>
              <Text style={[type.tiny, { color: colors.primary }]}>Shift being offered</Text>
              <Text style={[type.card, { color: colors.text }]}>{formatFull(item.date)}</Text>
              <Text style={[type.meta, { color: colors.textSecondary }]}>
                {item.start} – {item.end} · {item.label}
              </Text>
            </Card>
          ))}
          <Button label="Continue" onPress={() => setStep(1)} />
        </View>
      )}

      {step === 1 && (
        <View style={{ gap: 10 }}>
          <SearchField value={query} onChangeText={setQuery} placeholder="Search eligible coworkers" />
          {peers.map((person) => (
            <Card key={person.id} onPress={() => setColleague(person.id)} style={colleague === person.id ? { borderColor: colors.primary } : undefined}>
              <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                <Avatar initials={person.initials} color={person.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={[type.card, { color: colors.text }]}>{person.firstName} {person.lastName}</Text>
                  <Text style={[type.meta, { color: colors.textSecondary }]}>{person.title} · {person.id}</Text>
                </View>
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: colors.primary,
                    backgroundColor: colleague === person.id ? colors.primary : "transparent",
                  }}
                />
              </View>
            </Card>
          ))}
          <Button label="Continue" onPress={() => setStep(2)} />
          <Button label="Back" variant="ghost" onPress={() => setStep(0)} />
        </View>
      )}

      {step === 2 && shift && (
        <View style={{ gap: 12 }}>
          <Card>
            <Text style={[type.meta, { color: colors.muted }]}>Your shift</Text>
            <Text style={[type.card, { color: colors.text }]}>{formatFull(shift.date)} · {shift.start} – {shift.end}</Text>
          </Card>
          <Card>
            <Text style={[type.meta, { color: colors.muted }]}>Colleague</Text>
            <Text style={[type.card, { color: colors.text }]}>
              {findEmployee(colleague)?.firstName} {findEmployee(colleague)?.lastName} · {colleague}
            </Text>
          </Card>
          <TextField label="Reason (optional)" value={reason} onChangeText={setReason} placeholder="Why are you requesting this swap?" />
          <Text style={[type.meta, { color: colors.textSecondary }]}>
            Administrator approval is required before the schedule changes.
          </Text>
          <Button
            label="Submit request"
            onPress={() => {
              addSwap({
                id: `sw-${Date.now()}`,
                fromEmployeeId: me.id,
                toEmployeeId: colleague,
                shiftId: shift.id,
                submitted: isoDate(),
                reason,
                status: "Awaiting approval",
              });
              setDone(true);
              setSnack({ message: "Swap request submitted", tone: "success" });
            }}
          />
          <Button label="Cancel" variant="secondary" onPress={() => router.back()} />
        </View>
      )}

      <Dialog
        visible={done}
        icon={CheckCircle2}
        tone="success"
        title="Request submitted"
        body="Your swap request is pending review. You’ll see status updates in Schedule and Updates."
        primary="Done"
        onPrimary={() => {
          setDone(false);
          router.back();
        }}
      />
    </Screen>
  );
}
