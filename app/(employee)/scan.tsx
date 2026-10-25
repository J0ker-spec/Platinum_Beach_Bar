import { nowTime } from "@/src/dates";
import { parseQr } from "@/src/lib/qr";
import { formatWorkplaceTime, workplaceToday } from "@/src/lib/time";
import { clockInWindow, isWithinClockInWindow, pickOpenAttendance, pickShiftForClockIn } from "@/src/lib/scheduling";
import { useStore } from "@/src/store";
import { colors, type } from "@/src/theme";
import { Button, Dialog, Screen, Sheet } from "@/src/ui";
import { AlertTriangle, CheckCircle2, Clock3, WifiOff } from "lucide-react-native";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

type ScanState = "idle" | "confirm-in" | "confirm-out" | "success-in" | "success-out" | "invalid" | "revoked" | "noshift" | "outside" | "duplicate" | "orphan" | "network";

export default function Scan() {
  const router = useRouter();
  const {
    clockedIn,
    clockIn,
    clockOut,
    shifts,
    attendance,
    userId,
    workplaceTimezone,
    clockInEarlyMinutes,
    clockInLateMinutes,
  } = useStore();
  const [permission, requestPermission] = useCameraPermissions();
  const proof = useRef<string | null>(null);
  const busy = useRef(false);
  const [state, setState] = useState<ScanState>("idle");
  const [reviewedId, setReviewedId] = useState<string | undefined>(undefined);
  const time = nowTime(workplaceTimezone);
  const today = workplaceToday(workplaceTimezone);
  const openRecord = userId ? pickOpenAttendance(attendance, userId) : undefined;
  // Shifts that already have an attendance record are skipped so a second shift on the same day
  // can still be clocked into.
  const recordedShiftIds = userId ? attendance.filter((record) => record.employeeId === userId).map((record) => record.shiftId ?? "") : [];
  const nextShift = userId
    ? pickShiftForClockIn(shifts, userId, today, Date.now(), {
        earlyMinutes: clockInEarlyMinutes,
        lateMinutes: clockInLateMinutes,
        recordedShiftIds,
      })
    : undefined;
  const reviewedShift = shifts.find((shift) => shift.id === reviewedId);
  const outShift = openRecord ? shifts.find((shift) => shift.id === openRecord.shiftId) : undefined;
  const displayShift = state === "confirm-out" ? outShift : reviewedShift ?? nextShift;
  const window = nextShift && typeof nextShift.startAt === "number"
    ? clockInWindow(nextShift.startAt, clockInEarlyMinutes, clockInLateMinutes)
    : undefined;

  const onScan = (value: string) => {
    if (busy.current || state !== "idle") return;
    const token = parseQr(value);
    if (!token) return setState("invalid");
    proof.current = token;
    if (clockedIn) {
      // Clocking out does not need a shift today: an open record from an earlier shift must be
      // closable even when the employee has no shift scheduled now.
      setReviewedId(openRecord?.shiftId);
      setState("confirm-out");
      return;
    }
    if (!nextShift) return setState("noshift");
    if (
      typeof nextShift.startAt !== "number" ||
      !isWithinClockInWindow(nextShift.startAt, Date.now(), clockInEarlyMinutes, clockInLateMinutes)
    ) {
      setReviewedId(nextShift.id);
      return setState("outside");
    }
    setReviewedId(nextShift.id);
    setState("confirm-in");
  };

  const confirm = async () => {
    if (busy.current || !proof.current) return;
    busy.current = true;
    const out = state === "confirm-out";
    try {
      if (out) await clockOut(proof.current);
      else {
        if (!nextShift) throw new Error("That shift is no longer available.");
        await clockIn(nextShift.id, proof.current);
      }
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
        Point the camera at the attendance code displayed at the workplace.
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
          {displayShift ? `${displayShift.label} · ${displayShift.start} – ${displayShift.end}` : state === "confirm-out" ? "Open attendance record" : "No shift"}
        </Text>
        <Text style={[type.card, { color: colors.text }]}>Proposed time · {time}</Text>
        {state === "confirm-in" && window ? (
          <Text style={[type.meta, { color: colors.muted }]}>
            Clock-in is allowed between {formatWorkplaceTime(new Date(window.opensAt), workplaceTimezone)} and{" "}
            {formatWorkplaceTime(new Date(window.closesAt), workplaceTimezone)}.
          </Text>
        ) : (
          <Text style={[type.meta, { color: colors.muted }]}>This becomes your attendance record.</Text>
        )}
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
        body={`${time} recorded for ${displayShift?.label ?? "today’s shift"}.`}
        primary="Done"
        onPrimary={() => {
          setState("idle");
          router.back();
        }}
      />

      <Dialog
        visible={["invalid", "revoked", "noshift", "outside", "duplicate", "orphan", "network"].includes(state)}
        icon={state === "network" || state === "outside" ? WifiOff : AlertTriangle}
        tone={state === "network" || state === "outside" ? "warning" : "danger"}
        title={
          {
            invalid: "Invalid QR code",
            revoked: "This code has been replaced",
            noshift: "No eligible shift",
            outside: "Outside the clock-in window",
            duplicate: "Already clocked in",
            orphan: "Clock-out needs a clock-in",
            network: "Temporary connection issue",
          }[state as string] ?? "Something went wrong"
        }
        body={
          state === "outside" && reviewedShift && window
            ? `This shift can be clocked into from ${formatWorkplaceTime(new Date(window.opensAt), workplaceTimezone)} to ${formatWorkplaceTime(new Date(window.closesAt), workplaceTimezone)}.`
            : {
                invalid: "That is not a PlatinumX attendance code, or it could not be processed.",
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
