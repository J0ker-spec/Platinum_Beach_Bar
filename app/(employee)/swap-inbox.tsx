import { formatFull, formatPretty } from "@/src/dates";
import { useStore } from "@/src/store";
import { colors, type } from "@/src/theme";
import { BackHeader, Button, Card, EmptyState, Screen, Sheet, StatusBadge } from "@/src/ui";
import { badgeTone } from "@/src/widgets";
import { isSwappableShift } from "@/src/data";
import { ArrowLeftRight } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

export default function SwapInbox() {
  const router = useRouter();
  const { userId, swaps, shifts, respondToSwap, setSnack, getEmployee: findEmployee } = useStore();
  const me = findEmployee(userId ?? "");
  const [openId, setOpenId] = useState<string | null>(null);
  const [receivedShiftId, setReceivedShiftId] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  if (!me) return <Screen><Text style={[type.body, { color: colors.muted }]}>Loading…</Text></Screen>;

  const incoming = swaps.filter((s) => s.toEmployeeId === me.id && s.status === "Pending coworker");
  const current = incoming.find((s) => s.id === openId);
  const currentShift = current ? shifts.find((s) => s.id === current.shiftId) : undefined;
  const requester = current ? findEmployee(current.fromEmployeeId) : undefined;
  // The colleague's own published, upcoming shifts they can nominate to give in return (two-way).
  const returnShifts = shifts.filter(isSwappableShift);
  const offerTime = (value?: number) =>
    value ? new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "";
  const offerSummary = (request: (typeof incoming)[number], shift?: (typeof shifts)[number]) => {
    const date = shift?.date ?? request.shiftDate;
    const start = shift?.start ?? offerTime(request.shiftStartAt);
    const end = shift?.end ?? offerTime(request.shiftEndAt);
    return date ? `${formatPretty(date)} · ${start} – ${end}` : "Shift details unavailable";
  };

  const act = async (accept: boolean) => {
    if (!current || busy) return;
    setBusy(true);
    try {
      await respondToSwap(current.id, accept, accept ? receivedShiftId : undefined);
      setSnack({ message: accept ? "Swap request accepted" : "Swap request declined", tone: accept ? "success" : "info" });
      setOpenId(null);
      setReceivedShiftId(undefined);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Try again.";
      setSnack({ message: `Couldn't update the request: ${detail}`, tone: "warning" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <BackHeader title="Swap requests for you" onBack={() => router.back()} />
      <Text style={[type.meta, { color: colors.textSecondary, marginVertical: 8 }]}>
        Accept a swap to give the requester your shift, and optionally nominate one of your own shifts back (two-way swap).
      </Text>
      {incoming.length ? (
        <View style={{ gap: 10 }}>
          {incoming.map((s) => {
            const from = findEmployee(s.fromEmployeeId);
            return (
              <Card key={s.id} onPress={() => { setOpenId(s.id); setReceivedShiftId(undefined); }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={[type.card, { color: colors.text }]}>{from ? `${from.firstName} ${from.lastName}` : "Unknown"} wants to swap</Text>
                  <StatusBadge label={s.status} tone={badgeTone(s.status)} />
                </View>
                <Text style={[type.meta, { color: colors.textSecondary, marginTop: 4 }]}>
                  {offerSummary(s)} — you would take it
                </Text>
                {s.shiftLabel ? <Text style={[type.tiny, { color: colors.muted }]}>{s.shiftLabel}</Text> : null}
                {s.reason ? <Text style={[type.tiny, { color: colors.muted, marginTop: 4 }]}>“{s.reason}”</Text> : null}
              </Card>
            );
          })}
        </View>
      ) : (
        <EmptyState icon={ArrowLeftRight} title="No swap requests" body="When a coworker asks to swap, it will appear here for you to accept or decline." />
      )}
      <View style={{ height: 12 }} />
      <Button label="Request a shift swap" variant="secondary" onPress={() => router.push("/(employee)/swap")} />

      <Sheet visible={!!current} onClose={() => { if (!busy) setOpenId(null); }}>
        {current && (
          <>
            <Text style={[type.section, { color: colors.text }]}>Respond to swap request</Text>
            <StatusBadge label={current.status} tone={badgeTone(current.status)} />
            <Card style={{ backgroundColor: colors.surface }}>
              <Text style={[type.tiny, { color: colors.muted }]}>You would take</Text>
              <Text style={[type.card, { color: colors.text }]}>{requester ? `${requester.firstName} ${requester.lastName}` : "Unknown"}'s shift</Text>
              <Text style={[type.meta, { color: colors.textSecondary }]}>{offerSummary(current, currentShift)}</Text>
              {current.shiftLabel ? <Text style={[type.tiny, { color: colors.muted }]}>{current.shiftLabel}</Text> : null}
            </Card>

            <Text style={[type.label, { color: colors.textSecondary }]}>Give a shift back (optional)</Text>
            <Text style={[type.tiny, { color: colors.muted }]}>Pick one of your own shifts to exchange, or leave blank for a one-way swap.</Text>
            {returnShifts.length ? (
              <View style={{ gap: 8 }}>
                {returnShifts.map((s) => {
                  const on = s.id === receivedShiftId;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setReceivedShiftId(on ? undefined : s.id)}
                      style={{ padding: 12, borderRadius: 14, borderWidth: 1, borderColor: on ? colors.primary : colors.border, backgroundColor: colors.card }}
                    >
                      <Text style={[type.card, { color: colors.text }]}>{formatFull(s.date)} · {s.start} – {s.end}</Text>
                      <Text style={[type.tiny, { color: colors.muted }]}>{s.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={[type.tiny, { color: colors.muted }]}>You have no published, upcoming shifts to offer back right now.</Text>
            )}

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button label="Decline" variant="danger" disabled={busy} onPress={() => void act(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Accept" loading={busy} disabled={busy} onPress={() => void act(true)} />
              </View>
            </View>
            <Button label="Cancel" variant="ghost" onPress={() => { if (!busy) setOpenId(null); }} />
          </>
        )}
      </Sheet>
    </Screen>
  );
}
