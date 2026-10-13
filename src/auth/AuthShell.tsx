import { APP_NAME, colors, radii, shadow, spacing, type } from "@/src/theme";
import { AppLogo, TextField } from "@/src/ui";
import { Eye, EyeOff } from "lucide-react-native";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Shared frame for the sign up / log in / verify / reset screens: brand header + floating form card. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            backgroundColor: colors.primary,
            paddingTop: insets.top + spacing.xl,
            paddingBottom: 72,
            paddingHorizontal: spacing.xl,
            borderBottomLeftRadius: 36,
            borderBottomRightRadius: 36,
            gap: spacing.sm,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <AppLogo size={44} />
            <Text style={[type.section, { color: colors.onPrimary }]}>{APP_NAME}</Text>
          </View>
          <View style={{ height: spacing.md }} />
          <Text style={[type.hero, { color: colors.onPrimary }]}>{title}</Text>
          <Text style={[type.body, { color: "rgba(255,255,255,0.82)" }]}>{subtitle}</Text>
        </View>
        <View
          style={[
            {
              marginTop: -44,
              marginHorizontal: spacing.lg,
              backgroundColor: colors.card,
              borderRadius: radii.sheet,
              padding: spacing.xl,
              gap: 16,
              borderWidth: 1,
              borderColor: colors.border,
            },
            shadow.float,
          ]}
        >
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function PasswordField(props: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  error?: string;
  helper?: string;
  autoComplete?: "password" | "new-password" | "current-password";
  onSubmitEditing?: () => void;
}) {
  const [shown, setShown] = useState(false);
  return (
    <TextField
      {...props}
      secure={!shown}
      right={
        <Pressable
          onPress={() => setShown((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={shown ? "Hide password" : "Show password"}
          hitSlop={10}
          style={{ paddingHorizontal: 12 }}
        >
          {shown ? <EyeOff size={18} color={colors.muted} /> : <Eye size={18} color={colors.muted} />}
        </Pressable>
      }
    />
  );
}

export function FormError({ title, body }: { title?: string; body: string }) {
  return (
    <View style={{ backgroundColor: colors.errorSoft, borderRadius: 14, padding: 12, gap: 4 }} accessibilityRole="alert">
      {title ? <Text style={[type.card, { color: colors.error }]}>{title}</Text> : null}
      <Text style={[type.meta, { color: colors.error }]}>{body}</Text>
    </View>
  );
}

export function SwitchLink({ prompt, action, onPress }: { prompt: string; action: string; onPress: () => void }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: spacing.xs }}>
      <Text style={[type.meta, { color: colors.textSecondary }]}>{prompt}</Text>
      <Pressable onPress={onPress} accessibilityRole="link" hitSlop={8}>
        <Text style={[type.meta, { color: colors.primary, fontWeight: "700" }]}>{action}</Text>
      </Pressable>
    </View>
  );
}

export function OrDivider() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      <Text style={[type.tiny, { color: colors.muted }]}>OR</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
    </View>
  );
}
