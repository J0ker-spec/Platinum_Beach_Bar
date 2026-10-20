import { fullName } from "@/src/data";
import { formatFull, formatPretty } from "@/src/dates";
import { useStore } from "@/src/store";
import { colors, type } from "@/src/theme";
import { BackHeader, Button, Card, Dialog, EmptyState, Screen, Segmented, Sheet, StatusBadge } from "@/src/ui";
import { badgeTone } from "@/src/widgets";
import { ArrowLeftRight, CheckCircle2, XCircle } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { TextField } from "@/src/ui";

const tabs = ["Pending", "Approved", "Declined"];

export default function Swaps() {
  const router = useRouter();
  const { swaps, shifts, updateSwap, setSnack, getEmployee: findEmployee } = useStore();
  const [tab, setTab] = useState("Pending");
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"approve" | "decline" | null>(null);
  const [reason, setReason] = useState("");

  const inTab = (status: string) =>
    tab === "Pending"
      ? ["Awaiting approval", "Pending coworker", "Unavailable"].includes(status)
      : tab === "Approved"
        ? status === "Approved"
        : ["Declined", "Cancelled"].includes(status);
  const rows = swaps.filter((s) => inTab(s.status));
  const current = swaps.find((s) => s.id === openId);
  const currentShift = current ? shifts.find((s) => s.id === current.shiftId) : undefined;
  const from = current ? findEmployee(current.fromEmployeeId) : undefined;
  const to = current ? findEmployee(current.toEmployeeId) : undefined;
  const reviewable = current?.status === "Awaiting approval";

  return (
    <Screen scroll>
      <BackHeader title="Shift swap requests" onBack={() => router.back()} />
      <Segmented options={tabs} value={tab} onChange={setTab} />
      <View style={{ gap: 10, marginTop: 14 }}>
        {rows.length ? (
          rows.map((s) => {
            const a = findEmployee(s.fromEmployeeId);
            const b = findEmployee(s.toEmployeeId);
            const sh = shifts.find((x) => x.id === s.shiftId);
            return (
              <Card key={s.id} onPress={() => setOpenId(s.id)}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={[type.card, { color: colors.text }]}>{a ? fullName(a) : "Unknown"}</Text>
                  <StatusBadge label={s.status} tone={badgeTone(s.status)} />
                </View>
                <Text style={[type.meta, { color: colors.textSecondary, marginTop: 4 }]}>
                  {sh ? `${formatPretty(sh.date)} · ${sh.start} – ${sh.end}` : "Shift"} → {b ? fullName(b) : "Colleague"}
                </Text>
                <Text style={[type.tiny, { color: colors.muted, marginTop: 4 }]}>
                  Submitted {formatPretty(s.submitted)}
                  {s.status === "Unavailable" ? " · An employee is inactive" : ""}
                </Text>
              </Card>
            );
          })
        ) : (
          <EmptyState icon={ArrowLeftRight} title="No requests here" body="Nothing in this list right now." />
        )}
      </View>

      <Sheet visible={!!current && !confirm} onClose={() => setOpenId(null)}>
        {current && (
          <>
            <Text style={[type.section, { color: colors.text }]}>Swap request</Text>
            <StatusBadge label={current.status} tone={badgeTone(current.status)} />
            <Card style={{ backgroundColor: colors.surface }}>
              <Text style={[type.tiny, { color: colors.muted }]}>Current shift</Text>
              <Text style={[type.card, { color: colors.text }]}>{from ? fullName(from) : ""} · {from?.id}</Text>
              {currentShift && (
                <Text style={[type.meta, { color: colors.textSecondary }]}>
                  {formatFull(currentShift.date)} · {currentShift.start} – {currentShift.end}
                </Text>
              )}
            </Card>
            <Card style={{ backgroundColor: colors.lavenderSurface }}>
              <Text style={[type.tiny, { color: colors.secondary }]}>Proposed change</Text>
              <Text style={[type.card, { color: colors.text }]}>{to ? fullName(to) : ""} takes this shift</Text>
            </Card>
            {current.reason ? <Text style={[type.body, { color: colors.textSecondary }]}>“{current.reason}”</Text> : null}
            <Text style={[type.meta, { color: colors.muted }]}>Administrator approval is required for this change.</Text>
            {reviewable ? (
              <TextField label="Decline reason (optional)" value={reason} onChangeText={setReason} placeholder="Shown to the employee if declined" />
            ) : null}
            {reviewable ? (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Button label="Decline" variant="danger" onPress={() => setConfirm("decline")} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button label="Approve" onPress={() => setConfirm("approve")} />
                </View>
              </View>
            ) : (
              <Button label="Close" variant="secondary" onPress={() => setOpenId(null)} />
            )}
          </>
        )}
      </Sheet>

      <Dialog
        visible={confirm === "approve"}
        icon={CheckCircle2}
        title="Approve swap?"
        body={`${to ? fullName(to) : "The colleague"} will take ${from ? fullName(from) : "the employee"}’s shift.`}
        primary="Approve"
        secondary="Cancel"
        onSecondary={() => setConfirm(null)}
        onPrimary={() => {
          if (current) updateSwap(current.id, "Approved");
          setConfirm(null);
          setOpenId(null);
          setSnack({ message: "Swap approved", tone: "success" });
        }}
      />
      <Dialog
        visible={confirm === "decline"}
        tone="danger"
        icon={XCircle}
        title="Decline swap?"
        body="The employee will see this request as declined. Add an optional reason below."
        primary="Decline"
        secondary="Cancel"
        onSecondary={() => setConfirm(null)}
        onPrimary={() => {
          if (current) updateSwap(current.id, "Declined");
          setConfirm(null);
          setOpenId(null);
          setReason("");
          setSnack({ message: "Swap declined", tone: "info" });
        }}
      />
    </Screen>
  );
}
