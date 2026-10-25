import { useStore } from "@/src/store";
import { colors, type } from "@/src/theme";
import { BackHeader, Button, Card, Dialog, Screen, Sheet, StatusBadge } from "@/src/ui";
import { AlertTriangle, QrCode } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

function QrCodeView({ size, payload }: { size: number; payload: string | null }) {
  if (!payload) {
    return (
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Text style={[type.meta, { color: colors.textSecondary, textAlign: "center" }]}>No code yet. Tap “Replace QR code” to create one.</Text>
      </View>
    );
  }
  return <QRCode value={payload} size={size} color={colors.text} backgroundColor="#FFFFFF" ecl="M" />;
}

export default function Qr() {
  const router = useRouter();
  const { qrLabel, qrPayload, replaceQr, setSnack, businessName } = useStore();
  const [big, setBig] = useState(false);
  const [confirm, setConfirm] = useState(false);

  return (
    <Screen scroll>
      <BackHeader title="Workplace QR code" onBack={() => router.back()} />
      <Card style={{ alignItems: "center", gap: 10 }}>
        <StatusBadge label={qrPayload ? "Live code" : "Not created"} tone={qrPayload ? "success" : "neutral"} />
        <View style={{ padding: 16, backgroundColor: "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
          <QrCodeView size={220} payload={qrPayload} />
        </View>
        <Text style={[type.card, { color: colors.text }]}>{businessName}</Text>
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
          <QrCodeView size={260} payload={qrPayload} />
          <Text style={[type.card, { color: colors.text }]}>{businessName}</Text>
          <Button label="Close" variant="secondary" onPress={() => setBig(false)} />
        </View>
      </Sheet>
      <Dialog
        visible={confirm}
        tone="warning"
        icon={AlertTriangle}
        title="Replace QR code?"
        body="The current code would stop working and employees would need to scan the new one. "
        primary="Replace code"
        secondary="Cancel"
        onSecondary={() => setConfirm(false)}
        onPrimary={() => { setConfirm(false); replaceQr().catch(() => setSnack({ message: "Could not replace the code. Check your connection.", tone: "warning" })); }}
      />
    </Screen>
  );
}
