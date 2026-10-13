import { useStore } from "@/src/store";
import { BUSINESS_NAME, colors, type } from "@/src/theme";
import { BackHeader, Button, Card, Dialog, Screen, Sheet, StatusBadge } from "@/src/ui";
import { AlertTriangle, QrCode } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

function QrPlaceholder({ size, seed }: { size: number; seed: number }) {
  const n = 11;
  const cell = size / n;
  const on = (r: number, c: number) => {
    const corner = (r < 3 && c < 3) || (r < 3 && c >= n - 3) || (r >= n - 3 && c < 3);
    return corner || ((r * 7 + c * 13 + seed) % 3 === 0);
  };
  return (
    <View style={{ width: size, height: size, flexDirection: "row", flexWrap: "wrap" }}>
      {Array.from({ length: n * n }, (_, i) => (
        <View key={i} style={{ width: cell, height: cell, backgroundColor: on(Math.floor(i / n), i % n) ? colors.text : "transparent" }} />
      ))}
    </View>
  );
}

export default function Qr() {
  const router = useRouter();
  const { qrLabel, replaceQr } = useStore();
  const [big, setBig] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const replaced = qrLabel === "Replacement code preview";

  return (
    <Screen scroll>
      <BackHeader title="Workplace QR code" onBack={() => router.back()} />
      <Card style={{ alignItems: "center", gap: 10 }}>
        <StatusBadge label={replaced ? "Replacement code preview" : "Illustrative only"} tone={replaced ? "success" : "neutral"} />
        <View style={{ padding: 16, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
          <QrPlaceholder size={220} seed={replaced ? 5 : 2} />
        </View>
        <Text style={[type.card, { color: colors.text }]}>{BUSINESS_NAME}</Text>
        <Text style={[type.meta, { color: colors.textSecondary }]}>{qrLabel}</Text>
        <Text style={[type.body, { color: colors.textSecondary, textAlign: "center" }]}>
          Employees scan this code at the workplace to clock in and out.
        </Text>
      </Card>
      <View style={{ gap: 10, marginTop: 16 }}>
        <Button label="Enlarge for display" icon={QrCode} variant="secondary" onPress={() => setBig(true)} />
        <Button label="Replace QR code" variant="danger" onPress={() => setConfirm(true)} />
      </View>
      <Card style={{ marginTop: 16, backgroundColor: colors.warningSoft, borderColor: colors.warningSoft }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <AlertTriangle size={18} color={colors.warning} />
          <Text style={[type.meta, { color: colors.text, flex: 1 }]}>
            A shared or photographed code could be misused. Replace it if you think it has leaked.
          </Text>
        </View>
      </Card>

      <Sheet visible={big} onClose={() => setBig(false)}>
        <View style={{ alignItems: "center", gap: 12 }}>
          <QrPlaceholder size={260} seed={replaced ? 5 : 2} />
          <Text style={[type.card, { color: colors.text }]}>{BUSINESS_NAME}</Text>
          <Button label="Close" variant="secondary" onPress={() => setBig(false)} />
        </View>
      </Sheet>
      <Dialog
        visible={confirm}
        tone="warning"
        icon={AlertTriangle}
        title="Replace QR code?"
        body="The current code would stop working and employees would need to scan the new one. Preview only — nothing is revoked."
        primary="Replace code"
        secondary="Cancel"
        onSecondary={() => setConfirm(false)}
        onPrimary={() => { setConfirm(false); replaceQr(); }}
      />
    </Screen>
  );
}
