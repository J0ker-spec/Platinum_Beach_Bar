import { nowTime } from "@/src/dates";
import { parseQr } from "@/src/lib/qr";
import { workplaceToday } from "@/src/lib/time";
import { useStore } from "@/src/store";
import { colors, type } from "@/src/theme";
import { Button, Dialog, Screen, Sheet } from "@/src/ui";
import { AlertTriangle, CheckCircle2, Clock3, WifiOff } from "lucide-react-native";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

type ScanState = "idle" | "confirm-in" | "confirm-out" | "success-in" | "success-out" | "invalid" | "revoked" | "noshift" | "duplicate" | "orphan" | "network";

export default function Scan() {
  const router = useRouter();
  const { clockedIn, clockIn, clockOut, shifts, userId, workplaceTimezone } = useStore();
  const [permission, requestPermission] = useCameraPermissions();
  const proof = useRef<string | null>(null);
  const busy = useRef(false);
  const [state, setState] = useState<ScanState>("idle");
  const time = nowTime(workplaceTimezone);
  const today = workplaceToday(workplaceTimezone);
  const todayShift = userId ? shifts.find((s) => s.employeeId === userId && s.date === today && (s.status === "Published" || s.status === "Updated")) : undefined;

  const onScan = (value: string) => {
    if (busy.current || state !== "idle") return;
    const token = parseQr(value);
    if (!token) return setState("invalid");
    if (!todayShift) return setState("noshift");
    proof.current = token;
    setState(clockedIn ? "confirm-out" : "confirm-in");
  };

  const confirm = async () => {
    if (busy.current || !proof.current) return;
    busy.current = true;
    const out = state === "confirm-out";
    try {
      if (out) await clockOut(proof.current);
      else await clockIn(todayShift!.id, proof.current);
      setState(out ? "success-out" : "success-in");
    } catch (e: any) {
      const m = e?.message;
      setState(
        m === "duplicate" ? "duplicate" : m === "orphan" ? "orphan"
        : e?.code === "permission-denied" ? "revoked"
        : e?.code === "unavailable" || e?.code === "deadline-exceeded" ? "network" : "invalid"
      );
    } finally {
      busy.current = false;
    }
  };

  return (
    <Screen scroll>
      <Pressable onPress={() => router.back()}>
        <Text style={[type.meta, { color: colors.primary }]}>Close</Text>
      </Pressable>
      <Text style={[type.title, { color: colors.text, marginTop: 8 }]}>Scan workplace QR code</Text>
      <Text style={[type.body, { color: colors.textSecondary }]}>
        Point the camera at the attendance code displayed at Platnumx.
      </Text>

      <View style={{ alignItems: "center", marginVertical: 24 }}>
        <View
          style={{
            width: 260,
            height: 260,
            backgroundColor: colors.background,
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
            {permission?.granted ? (
              <CameraView
                style={{ flex: 1, margin: 6 }}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={state === "idle" ? ({ data }) => onScan(data) : undefined}
              />
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 8 }}>
                <Button label="Allow camera" onPress={() => void requestPermission()} />
              </View>
            )}
          </View>
        </View>
        <Text style={[type.tiny, { color: colors.muted, marginTop: 12, textAlign: "center" }]}>
          No photo is stored.
        </Text>
      </View>

      <Sheet visible={state === "confirm-in" || state === "confirm-out"} onClose={() => setState("idle")}>
        <Clock3 color={colors.primary} />
        <Text style={[type.section, { color: colors.text }]}>{state === "confirm-in" ? "Confirm clock-in" : "Confirm clock-out"}</Text>
        <Text style={[type.body, { color: colors.textSecondary }]}>
          {todayShift ? `${todayShift.label} · ${todayShift.start} – ${todayShift.end}` : "No shift"}
        </Text>
        <Text style={[type.card, { color: colors.text }]}>Proposed time · {time}</Text>
        <Text style={[type.meta, { color: colors.muted }]}>This becomes your attendance record.</Text>
        <Button
          label={state === "confirm-in" ? "Confirm clock-in" : "Confirm clock-out"}
          onPress={() => void confirm()}
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
        body={
          {
            invalid: "That is not a Platnumx attendance code, or it could not be processed.",
            revoked: "The code was replaced, or you are outside the allowed clock-in window. Ask your manager for the current code.",
            noshift: "You have no published shift today.",
            duplicate: "You already have an attendance record for this shift.",
            orphan: "Clock in before clocking out.",
            network: "Check your connection and try again.",
          }[state as string] ?? ""
        }
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
