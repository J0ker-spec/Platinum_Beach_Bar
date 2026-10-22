import { colors, radii, shadow, spacing, type } from "@/src/theme";
import { ChevronLeft, LucideIcon } from "lucide-react-native";
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function Screen({
  children,
  padded = true,
  scroll,
}: {
  children: React.ReactNode;
  padded?: boolean;
  scroll?: boolean;
}) {
  const body = (
    <View style={[styles.screenInner, padded && { paddingHorizontal: spacing.lg }]}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

export function AppLogo({ size = 64 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: colors.paleBlue,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          width: size * 0.46,
          height: size * 0.5,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: colors.primary,
          alignItems: "center",
          justifyContent: "flex-end",
          paddingBottom: 6,
        }}
      >
        <View style={{ width: 10, height: 6, borderBottomWidth: 2, borderRightWidth: 2, borderColor: colors.success, transform: [{ rotate: "45deg" }] }} />
      </View>
    </View>
  );
}

export function Heading({ children, size = "title" }: { children: React.ReactNode; size?: "hero" | "title" | "section" }) {
  return <Text style={[styles.text, type[size], { color: colors.text }]}>{children}</Text>;
}

export function Muted({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <Text style={[styles.text, type.body, { color: colors.textSecondary, textAlign: center ? "center" : "left" }]}>
      {children}
    </Text>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  icon: Icon,
}: {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
  icon?: LucideIcon;
}) {
  const palette = {
    primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
    secondary: { bg: colors.paleBlue, fg: colors.primaryDark, border: colors.paleBlue },
    ghost: { bg: "transparent", fg: colors.primary, border: "transparent" },
    danger: { bg: colors.errorSoft, fg: colors.error, border: colors.errorSoft },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: disabled ? 0.45 : pressed ? 0.86 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {Icon ? <Icon size={18} color={palette.fg} /> : null}
          <Text style={[type.card, { color: palette.fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon: Icon,
  label,
  onPress,
  badge,
}: {
  icon: LucideIcon;
  label: string;
  onPress?: () => void;
  badge?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.iconBtn}>
      <Icon size={20} color={colors.text} />
      {badge ? <View style={styles.badgeDot} /> : null}
    </Pressable>
  );
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  secure,
  error,
  helper,
  editable = true,
  right,
  keyboardType,
  autoCapitalize = "none",
  autoComplete,
  onSubmitEditing,
}: {
  label: string;
  value: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  secure?: boolean;
  error?: string;
  helper?: string;
  editable?: boolean;
  right?: React.ReactNode;
  keyboardType?: "email-address" | "phone-pad" | "default";
  autoCapitalize?: "none" | "words" | "sentences";
  autoComplete?: React.ComponentProps<typeof TextInput>["autoComplete"];
  onSubmitEditing?: () => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={[type.label, { color: colors.textSecondary }]}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          error ? { borderColor: colors.error } : null,
          !editable ? { backgroundColor: colors.surface } : null,
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          secureTextEntry={secure}
          editable={editable}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={false}
          onSubmitEditing={onSubmitEditing}
          style={[styles.input, { color: editable ? colors.text : colors.textSecondary }]}
        />
        {right}
      </View>
      {error ? <Text style={[type.meta, { color: colors.error }]}>{error}</Text> : null}
      {helper && !error ? <Text style={[type.meta, { color: colors.muted }]}>{helper}</Text> : null}
    </View>
  );
}

export function StatusBadge({
  label,
  tone = "info",
}: {
  label: string;
  tone?: "info" | "success" | "warning" | "danger" | "neutral" | "primary";
}) {
  const map = {
    info: { bg: colors.paleBlue, fg: colors.info },
    success: { bg: colors.successSoft, fg: colors.success },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    danger: { bg: colors.errorSoft, fg: colors.error },
    neutral: { bg: colors.surface, fg: colors.textSecondary },
    primary: { bg: colors.lavender, fg: colors.secondary },
  }[tone];
  return (
    <View style={[styles.chip, { backgroundColor: map.bg }]}>
      <Text style={[type.tiny, { color: map.fg }]}>{label}</Text>
    </View>
  );
}

export function Avatar({ initials, color, size = 40 }: { initials: string; color?: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color ?? colors.primary,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: size * 0.34 }}>{initials}</Text>
    </View>
  );
}

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: ViewStyle; onPress?: () => void }) {
  const inner = <View style={[styles.card, style]}>{children}</View>;
  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {inner}
    </Pressable>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon size={28} color={colors.primary} />
      </View>
      <Heading size="section">{title}</Heading>
      <Muted center>{body}</Muted>
      {action ? <Button label={action} onPress={onAction} /> : null}
    </View>
  );
}

export function Skeleton({ height = 88 }: { height?: number }) {
  return <View style={[styles.skeleton, { height }]} />;
}

export function FilterChip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={[
        styles.filter,
        active ? { backgroundColor: colors.primary, borderColor: colors.primary } : null,
      ]}
    >
      <Text style={[type.meta, { color: active ? colors.onPrimary : colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

export function Segmented({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => (
        <Pressable
          key={option}
          onPress={() => onChange(option)}
          style={[styles.segment, value === option && { backgroundColor: colors.card }]}
        >
          <Text style={[type.meta, { color: value === option ? colors.primary : colors.textSecondary, fontWeight: "700" }]}>
            {option}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function SettingRow({
  icon: Icon,
  label,
  value,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.setting} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.settingIcon}>
        <Icon size={18} color={colors.primary} />
      </View>
      <Text style={[type.body, { flex: 1, color: colors.text }]}>{label}</Text>
      {value ? <Text style={[type.meta, { color: colors.muted }]}>{value}</Text> : null}
      <Text style={{ color: colors.muted, fontSize: 18 }}>›</Text>
    </Pressable>
  );
}

export function Dialog({
  visible,
  title,
  body,
  icon: Icon,
  primary,
  secondary,
  onPrimary,
  onSecondary,
  tone = "default",
  primaryLoading = false,
  primaryDisabled = false,
  secondaryDisabled = false,
}: {
  visible: boolean;
  title: string;
  body: string;
  icon?: LucideIcon;
  primary: string;
  secondary?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
  tone?: "default" | "success" | "warning" | "danger";
  primaryLoading?: boolean;
  primaryDisabled?: boolean;
  secondaryDisabled?: boolean;
}) {
  const iconColor =
    tone === "success" ? colors.success : tone === "warning" ? colors.warning : tone === "danger" ? colors.error : colors.primary;
  const iconBg =
    tone === "success" ? colors.successSoft : tone === "warning" ? colors.warningSoft : tone === "danger" ? colors.errorSoft : colors.paleBlue;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onSecondary}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {Icon ? (
            <View style={[styles.dialogIcon, { backgroundColor: iconBg }]}>
              <Icon size={26} color={iconColor} />
            </View>
          ) : null}
          <Heading size="section">{title}</Heading>
          <Muted>{body}</Muted>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
            {secondary ? (
              <View style={{ flex: 1 }}>
                <Button label={secondary} variant="secondary" onPress={onSecondary} disabled={secondaryDisabled} />
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <Button
                label={primary}
                onPress={onPrimary}
                variant={tone === "danger" ? "danger" : "primary"}
                loading={primaryLoading}
                disabled={primaryDisabled}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function Sheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        {children}
      </View>
    </Modal>
  );
}

export function Snackbar({ message, visible }: { message?: string | null; visible?: boolean }) {
  if (!visible || !message) return null;
  return (
    <View style={styles.snack}>
      <Text style={[type.meta, { color: colors.onPrimary }]}>{message}</Text>
    </View>
  );
}

export function SearchField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.search}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={[styles.input, { paddingHorizontal: 4 }]}
      />
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[type.section, { color: colors.text }]}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} accessibilityRole="button">
          <Text style={[type.meta, { color: colors.primary }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function BackHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack: () => void }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={10} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 }}>
        <ChevronLeft size={20} color={colors.primary} />
        <Text style={[type.meta, { color: colors.primary }]}>Back</Text>
      </Pressable>
      <Text style={[type.title, { color: colors.text }]}>{title}</Text>
      {subtitle ? <Text style={[type.meta, { color: colors.textSecondary, marginTop: 2 }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function useTimeout(ms: number, enabled: boolean) {
  const done = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    const id = setTimeout(() => {
      done.current = true;
    }, ms);
    return () => clearTimeout(id);
  }, [enabled, ms]);
  return done;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  screenInner: { flex: 1, width: "100%", maxWidth: 720, alignSelf: "center", paddingTop: spacing.sm },
  text: { fontFamily: "System" },
  button: {
    minHeight: 48,
    borderRadius: radii.input,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
  },
  inputWrap: {
    minHeight: 48,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  input: { flex: 1, minHeight: 48, fontSize: 15, color: colors.text },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.chip, alignSelf: "flex-start" },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.card,
  },
  empty: { alignItems: "center", gap: 8, paddingVertical: 36, paddingHorizontal: 24 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.paleBlue,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  skeleton: { backgroundColor: colors.surface, borderRadius: radii.card, marginBottom: 12 },
  filter: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.card,
  },
  segmented: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  segment: { flex: 1, minHeight: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  setting: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingVertical: 8,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.paleBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  dialog: {
    width: "100%",
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 20,
    gap: 10,
  },
  dialogIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  sheetBackdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    padding: 20,
    paddingBottom: 36,
    gap: 12,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 4,
  },
  snack: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 96,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  search: {
    minHeight: 48,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    marginTop: 8,
  },
});
