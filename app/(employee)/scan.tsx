import { isoDate, nowTime } from "@/src/dates";
import { useStore } from "@/src/store";
import { colors, type } from "@/src/theme";
import { Button, Dialog, Screen, Sheet } from "@/src/ui";
import { AlertTriangle, CheckCircle2, Clock3, WifiOff } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

type ScanState = "idle" | "confirm-in" | "confirm-out" | "success-in" | "success-out" | "invalid" | "revoked" | "noshift" | "duplicate" | "orphan" | "network";

export default function Scan() {
  const router = useRouter();
  const { clockedIn, setClockedIn, shifts, userId } = useStore();
  const [state, setState] = useState<ScanState>("idle");
  const time = nowTime();
  const todayShift = shifts.find((s) => s.employeeId === (userId ?? "EMP-0001") && s.date === isoDate());

  const simulate = () => {
    if (!todayShift) return setState("noshift");
    setState(clockedIn ? "confirm-out" : "confirm-in");
  };

  return (
    <Screen scroll>
      <Pressable onPress={() => router.back()}>
        <Text style={[type.meta, { color: colors.primary }]}>Close</Text>
      </Pressable>
      <Text style={[type.title, { color: colors.text, marginTop: 8 }]}>Scan workplace QR code</Text>
      <Text style={[type.body, { color: colors.textSecondary }]}>
        Point this frame at the attendance code displayed at Northline Café. Camera access is not used in this prototype.
      </Text>

      <View style={{ alignItems: "center", marginVertical: 24 }}>
        <View
          style={{
            width: 260,
            height: 260,
            backgroundColor: "#111827",
            borderRadius: 24,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View style={{ width: 180, height: 180, position: "relative" }}>
            {["tl", "tr", "bl", "br"].map((corner) => (
              <View
                key={corner}
                style={{
                  position: "absolute",
                  width: 28,
                  height: 28,
                  borderColor: colors.primary,
                  top: corner.startsWith("t") ? 0 : undefined,
                  bottom: corner.startsWith("b") ? 0 : undefined,
                  left: corner.endsWith("l") ? 0 : undefined,
                  right: corner.endsWith("r") ? 0 : undefined,
                  borderTopWidth: corner.startsWith("t") ? 4 : 0,
                  borderBottomWidth: corner.startsWith("b") ? 4 : 0,
                  borderLeftWidth: corner.endsWith("l") ? 4 : 0,
                  borderRightWidth: corner.endsWith("r") ? 4 : 0,
                }}
              />
            ))}
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 72, height: 72, backgroundColor: "#fff", borderRadius: 8 }} />
            </View>
          </View>
        </View>
        <Text style={[type.tiny, { color: colors.muted, marginTop: 12, textAlign: "center" }]}>
          The scan stays on this device in the preview. No photo is stored.
        </Text>
      </View>

      <Button label="Simulate successful scan" onPress={simulate} />
      <View style={{ height: 8 }} />
      <Text style={[type.tiny, { color: colors.muted, marginBottom: 8 }]}>Preview other states</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {[
          ["Invalid QR", "invalid"],
          ["Revoked code", "revoked"],
          ["No shift", "noshift"],
          ["Duplicate", "duplicate"],
          ["Missing clock-in", "orphan"],
          ["Network", "network"],
        ].map(([label, key]) => (
          <Button key={key} label={label} variant="secondary" onPress={() => setState(key as ScanState)} />
        ))}
      </View>

      <Sheet visible={state === "confirm-in" || state === "confirm-out"} onClose={() => setState("idle")}>
        <Clock3 color={colors.primary} />
        <Text style={[type.section, { color: colors.text }]}>{state === "confirm-in" ? "Confirm clock-in" : "Confirm clock-out"}</Text>
        <Text style={[type.body, { color: colors.textSecondary }]}>
          {todayShift ? `${todayShift.label} · ${todayShift.start} – ${todayShift.end}` : "No shift"}
        </Text>
        <Text style={[type.card, { color: colors.text }]}>Proposed time · {time}</Text>
        <Text style={[type.meta, { color: colors.muted }]}>This becomes the workplace attendance record in production.</Text>
        <Button
          label={state === "confirm-in" ? "Confirm clock-in" : "Confirm clock-out"}
          onPress={() => {
            setClockedIn(state === "confirm-in", time);
            setState(state === "confirm-in" ? "success-in" : "success-out");
          }}
        />
        <Button label="Cancel" variant="ghost" onPress={() => setState("idle")} />
      </Sheet>

      <Dialog
        visible={state === "success-in" || state === "success-out"}
        icon={CheckCircle2}
        tone="success"
        title={state === "success-in" ? "Clock-in successful" : "Clock-out successful"}
        body={`${time} recorded for ${todayShift?.label ?? "today’s shift"}.`}
        primary="Done"
        onPrimary={() => {
          setState("idle");
          router.back();
        }}
      />

      <Dialog
        visible={["invalid", "revoked", "noshift", "duplicate", "orphan", "network"].includes(state)}
        icon={state === "network" ? WifiOff : AlertTriangle}
        tone={state === "network" ? "warning" : "danger"}
        title={
          {
            invalid: "Invalid QR code",
            revoked: "This code has been replaced",
            noshift: "No eligible shift",
            duplicate: "Already clocked in",
            orphan: "Clock-out needs a clock-in",
            network: "Temporary connection issue",
          }[state as string] ?? "Something went wrong"
        }
        body="This is a demonstration state. Try another preview or return to attendance."
        primary="Try again"
        secondary="Back"
        onPrimary={() => setState("idle")}
        onSecondary={() => {
          setState("idle");
          router.back();
        }}
      />
    </Screen>
  );
}
