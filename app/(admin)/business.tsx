import { useStore } from "@/src/store";
import { BackHeader, Button, Screen, TextField } from "@/src/ui";
import { isValidTimeZone } from "@/src/lib/time";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

export default function Business() {
  const router = useRouter();
  const {
    workplaceTimezone,
    businessName,
    businessAddress,
    businessPhone,
    businessEmail,
    shifts,
    attendance,
    saveWorkplaceSettings,
    setSnack,
  } = useStore();
  const [name, setName] = useState(businessName);
  const [address, setAddress] = useState(businessAddress);
  const [phone, setPhone] = useState(businessPhone);
  const [email, setEmail] = useState(businessEmail);
  const [timeZone, setTimeZone] = useState(workplaceTimezone);
  const [saving, setSaving] = useState(false);
  const timeZoneLocked = shifts.length > 0 || attendance.length > 0;
  useEffect(() => {
    setName(businessName);
    setAddress(businessAddress);
    setPhone(businessPhone);
    setEmail(businessEmail);
    setTimeZone(workplaceTimezone);
  }, [businessName, businessAddress, businessPhone, businessEmail, workplaceTimezone]);

  return (
    <Screen scroll>
      <BackHeader title="Business details" subtitle="These details appear across the workplace app" onBack={() => router.back()} />
      <View style={{ gap: 14 }}>
        <TextField
          label="Business name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Platinum Beach"
          autoCapitalize="words"
          error={!name.trim() ? "Business name is required." : name.trim().length > 120 ? "Use 120 characters or fewer." : undefined}
        />
        <TextField
          label="Business address"
          value={address}
          onChangeText={setAddress}
          placeholder="Street, city, region, postal code"
          autoCapitalize="words"
          error={address.length > 300 ? "Use 300 characters or fewer." : undefined}
        />
        <TextField
          label="Business phone"
          value={phone}
          onChangeText={setPhone}
          placeholder="Optional"
          keyboardType="phone-pad"
          error={phone.length > 32 ? "Use 32 characters or fewer." : undefined}
        />
        <TextField
          label="Business email"
          value={email}
          onChangeText={setEmail}
          placeholder="Optional"
          keyboardType="email-address"
          error={email.length > 254 ? "Use 254 characters or fewer." : undefined}
        />
        <TextField
          label="IANA time zone"
          value={timeZone}
          onChangeText={setTimeZone}
          placeholder="e.g. America/New_York"
          editable={!timeZoneLocked}
          helper="Use an IANA time zone ID, not an abbreviation, so daylight-saving changes are handled correctly. It cannot be changed after shifts or attendance exist."
          error={timeZone.trim() && !isValidTimeZone(timeZone.trim()) ? "Enter a valid IANA time zone." : undefined}
        />
        <Button
          label="Save business details"
          loading={saving}
          disabled={
            saving
            || !name.trim()
            || name.trim().length > 120
            || address.length > 300
            || phone.length > 32
            || email.length > 254
            || (email.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
            || !isValidTimeZone(timeZone.trim())
          }
          onPress={async () => {
            setSaving(true);
            try {
              await saveWorkplaceSettings({
                businessName: name,
                businessAddress: address,
                businessPhone: phone,
                businessEmail: email,
                timezone: timeZone,
              });
              setSnack({ message: "Business details saved", tone: "success" });
              router.back();
            } catch (error) {
              console.error("Could not save business details:", error);
              const detail = error instanceof Error ? error.message : "Try again.";
              setSnack({ message: `Couldn't save business details: ${detail}`, tone: "warning" });
            } finally {
              setSaving(false);
            }
          }}
        />
        <Button label="Cancel" variant="secondary" disabled={saving} onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
