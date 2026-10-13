import { useStore } from "@/src/store";
import { BUSINESS_NAME, WORKPLACE_ADDRESS } from "@/src/theme";
import { BackHeader, Button, Screen, TextField } from "@/src/ui";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

export default function Business() {
  const router = useRouter();
  const { setSnack } = useStore();
  const [name, setName] = useState(BUSINESS_NAME);
  const [address, setAddress] = useState(WORKPLACE_ADDRESS);

  return (
    <Screen scroll>
      <BackHeader title="Business details" subtitle="One workplace" onBack={() => router.back()} />
      <View style={{ gap: 14 }}>
        <TextField label="Business name" value={name} onChangeText={setName} />
        <TextField label="Workplace address" value={address} onChangeText={setAddress} />
        <Button
          label="Save changes"
          onPress={() => {
            setSnack({ message: "Business details saved (preview)", tone: "success" });
            router.back();
          }}
        />
        <Button label="Cancel" variant="secondary" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
