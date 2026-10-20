
import { formatFull } from "@/src/dates";
import { workplaceToday } from "@/src/lib/time";
import { useStore } from "@/src/store";
import { colors, type } from "@/src/theme";
import { Avatar, Button, Card, Dialog, EmptyState, FilterChip, Screen, SearchField, StatusBadge, TextField } from "@/src/ui";
import { badgeTone } from "@/src/widgets";
import { isSwappableShift } from "@/src/data";
import { ArrowLeftRight, CheckCircle2 } from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

const steps = ["Shift", "Colleague", "Review"];

export default function SwapFlow() {
  const router = useRouter();
  const { shiftId } = useLocalSearchParams<{ shiftId?: string }>();
  const { userId, shifts, employees, addSwap, setSnack, workplaceTimezone, getEmployee: findEmployee } = useStore();
  const today = workplaceToday(workplaceTimezone);
  const [step, setStep] = useState(0);
  const [selectedShiftId, setSelectedShiftId] = useState<string | undefined>(shiftId);
  const [colleague, setColleague] = useState<string | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [shiftQuery, setShiftQuery] = useState("");
  const [onlySwappable, setOnlySwappable] = useState(true);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const me = findEmployee(userId ?? "");
  if (!me) return <Screen><Text style={[type.meta, { color: colors.muted }]}>Loading…</Text></Screen>;

  // Rules only accept published shifts whose start time is still in the future, so we only let
  // employees offer those. Past/draft/cancelled shifts are shown for clarity but marked as such.
  const allMine = shifts.filter((s) => s.employeeId === me.id);
  const swappable = allMine.filter(isSwappableShift);
  const list = (onlySwappable ? swappable : allMine).filter((s) => {
    const q = shiftQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      s.label.toLowerCase().includes(q) ||
      s.location.toLowerCase().includes(q) ||
      formatFull(s.date).toLowerCase().includes(q) ||
      `${s.start} ${s.end}`.toLowerCase().includes(q)
    );
  });

  // Fall back to the first swappable shift when the passed-in selection is not eligible
  // (e.g. the shift already started before the employee opened the flow).
  const selected = shifts.find((s) => s.id === selectedShiftId && isSwappableShift(s));
  const shift = selected ?? swappable[0];
  const selectedSwappable = !!shift;
  const peers = employees.filter(
    (e) =>
      e.id !== me.id &&
      e.status === "Active" &&
      `${e.firstName} ${e.lastName} ${e.title}`.toLowerCase().includes(query.trim().toLowerCase())
  );
  const toId = peers.find((person) => person.id === colleague)?.id ?? peers[0]?.id ?? "";

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
          <Text style={[type.meta, { color: colors.textSecondary }]}>
            Pick the shift you want to give away. Only published shifts that haven't started yet can be swapped.
          </Text>
          <SearchField value={shiftQuery} onChangeText={setShiftQuery} placeholder="Search shifts (date, label, location)" />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <FilterChip label="Available to swap" active={onlySwappable} onPress={() => setOnlySwappable(true)} />
            <FilterChip label="All my shifts" active={!onlySwappable} onPress={() => setOnlySwappable(false)} />
          </View>
          {list.length ? (
            list.map((item) => {
              const swappableItem = isSwappableShift(item);
              const on = item.id === shift?.id;
              return (
                <Card
                  key={item.id}
                  onPress={swappableItem ? () => setSelectedShiftId(item.id) : undefined}
                  style={on ? { borderColor: colors.primary } : undefined}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                    <Text style={[type.tiny, { color: swappableItem ? colors.primary : colors.muted }]}>
                      {swappableItem ? "Shift being offered" : "Not swappable"}
                    </Text>
                    <StatusBadge label={item.status} tone={badgeTone(item.status)} />
                  </View>
                  <Text style={[type.card, { color: colors.text }]}>{formatFull(item.date)}</Text>
                  <Text style={[type.meta, { color: colors.textSecondary }]}>
                    {item.start} – {item.end} · {item.label}
                  </Text>
                  {item.location ? <Text style={[type.tiny, { color: colors.muted, marginTop: 2 }]}>{item.location}</Text> : null}
                  {!swappableItem ? (
                    <Text style={[type.tiny, { color: colors.error, marginTop: 4 }]}>
                      {item.status !== "Published"
                        ? "Only published shifts can be swapped."
                        : "This shift has already started, so it can't be swapped."}
                    </Text>
                  ) : null}
                </Card>
              );
            })
          ) : (
            <EmptyState
              icon={ArrowLeftRight}
              title={swappable.length ? "No matching shifts" : "No shifts to swap"}
              body={
                swappable.length
                  ? "Try a different search, or show all your shifts."
                  : "You don't have any published, upcoming shifts to offer right now."
              }
            />
          )}
          <Button label="Continue" onPress={() => setStep(1)} disabled={!selectedSwappable} />
          {!selectedSwappable && swappable.length > 0 ? (
            <Text style={[type.tiny, { color: colors.muted, textAlign: "center" }]}>Select an available shift to continue.</Text>
          ) : null}
        </View>
      )}

      {step === 1 && (
        <View style={{ gap: 10 }}>
          <SearchField value={query} onChangeText={setQuery} placeholder="Search eligible coworkers" />
          {peers.map((person) => (
            <Card key={person.id} onPress={() => setColleague(person.id)} style={toId === person.id ? { borderColor: colors.primary } : undefined}>
              <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                <Avatar initials={person.initials} color={person.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={[type.card, { color: colors.text }]}>{person.firstName} {person.lastName}</Text>
                  <Text style={[type.meta, { color: colors.textSecondary }]}>
                    {person.title}{person.isAdmin ? " · Admin" : ""} · {person.id}
                  </Text>
                </View>
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: colors.primary,
                    backgroundColor: toId === person.id ? colors.primary : "transparent",
                  }}
                />
              </View>
            </Card>
          ))}
          <Button label="Continue" onPress={() => setStep(2)} disabled={!toId} />
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
              {findEmployee(toId)?.firstName} {findEmployee(toId)?.lastName} · {toId}
            </Text>
          </Card>
          <TextField label="Reason (optional)" value={reason} onChangeText={setReason} placeholder="Why are you requesting this swap?" />
          <Text style={[type.meta, { color: colors.textSecondary }]}>
            Your coworker will be asked first, then administrator approval is required before the schedule changes.
          </Text>
          <Button
            label="Submit request"
            loading={submitting}
            onPress={async () => {
              if (!shift) return;
              setSubmitting(true);
              try {
                await addSwap({
                  id: `sw-${Date.now()}`,
                  fromEmployeeId: me.id,
                  toEmployeeId: toId,
                  shiftId: shift.id,
                  submitted: today,
                  reason,
                  status: "Awaiting approval",
                });
                setDone(true);
                setSnack({ message: "Swap request submitted", tone: "success" });
              } catch (error) {
                const detail = error instanceof Error ? error.message : "Try again.";
                setSnack({
                  message: `Couldn't submit the swap: ${detail}`,
                  tone: "warning",
                });
              } finally {
                setSubmitting(false);
              }
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
