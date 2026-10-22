import { Employee, Shift } from "@/src/types";
import { colors, radii, spacing, type } from "@/src/theme";
import { formatShortDay } from "@/src/dates";
import { fullName, isoDateOf } from "@/src/data";
import { Avatar, Card, StatusBadge } from "@/src/ui";
import { Bell, ChevronRight, Clock } from "lucide-react-native";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

export function badgeTone(status: string) {
  if (["Published", "On time", "Approved", "Active"].includes(status)) return "success" as const;
  if (["Updated", "Corrected", "Awaiting approval", "Pending coworker"].includes(status)) return "warning" as const;
  if (["Cancelled", "Declined", "Late", "Incomplete", "Inactive", "Unavailable"].includes(status)) return "danger" as const;
  if (["Draft"].includes(status)) return "neutral" as const;
  if (["Important"].includes(status)) return "warning" as const;
  return "info" as const;
}

export function HeaderRow({
  greeting,
  name,
  date,
  onBell,
  unread,
}: {
  greeting: string;
  name: string;
  date: string;
  onBell?: () => void;
  unread?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <View style={{ flex: 1 }}>
        <Text style={[type.meta, { color: colors.textSecondary }]}>{date}</Text>
        <Text style={[type.title, { color: colors.text }]}>
          {greeting}, {name}
        </Text>
      </View>
      <Pressable onPress={onBell} accessibilityLabel="Notifications">
        <View>
          <Bell size={22} color={colors.text} />
          {unread ? (
            <View
              style={{
                position: "absolute",
                top: -2,
                right: -2,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.error,
              }}
            />
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

export function ShiftCard({
  shift,
  employee,
  onPress,
  highlight,
}: {
  shift: Shift;
  employee?: Employee;
  onPress?: () => void;
  highlight?: boolean;
}) {
  return (
    <Card
      onPress={onPress}
      style={
        highlight
          ? { backgroundColor: colors.lavenderSurface, borderColor: colors.border }
          : undefined
      }
    >
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <View
          style={{
            width: 4,
            alignSelf: "stretch",
            borderRadius: 4,
            backgroundColor: highlight ? colors.primary : colors.paleBlue,
          }}
        />
        <View style={{ flex: 1, gap: 4 }}>
          {employee ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Avatar initials={employee.initials} color={employee.accent} size={32} />
              <Text style={[type.card, { color: colors.text }]}>{fullName(employee)}</Text>
            </View>
          ) : null}
          <Text style={[type.card, { color: colors.text }]}>
            {shift.start} – {shift.end}
          </Text>
          <Text style={[type.meta, { color: colors.textSecondary }]}>
            {shift.location ? `${shift.label} · ${shift.location}` : shift.label}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginTop: 4 }}>
            <Clock size={14} color={colors.muted} />
            <StatusBadge label={shift.status} tone={badgeTone(shift.status)} />
          </View>
        </View>
        <ChevronRight size={18} color={colors.muted} />
      </View>
    </Card>
  );
}

export function WeekStrip({
  dates,
  selected,
  marked,
  onSelect,
  today,
}: {
  dates: string[];
  selected: string;
  marked: string[];
  onSelect: (date: string) => void;
  /** Workplace-local today (yyyy-mm-dd). Falls back to the device date. */
  today?: string;
}) {
  const todayIso = today ?? isoDateOf(new Date());
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {dates.map((date) => {
        const active = date === selected;
        const isToday = date === todayIso;
        return (
          <Pressable
            key={date}
            onPress={() => onSelect(date)}
            accessibilityLabel={`${formatShortDay(date)} ${date.slice(8)}`}
            style={{
              width: 52,
              paddingVertical: 10,
              borderRadius: 16,
              alignItems: "center",
              backgroundColor: active ? colors.primary : isToday ? colors.paleBlue : colors.card,
              borderWidth: 1,
              borderColor: active ? colors.primary : colors.border,
            }}
          >
            <Text style={[type.tiny, { color: active ? colors.onPrimary : colors.muted }]}>{formatShortDay(date)}</Text>
            <Text style={[type.card, { color: active ? colors.onPrimary : colors.text, marginTop: 4 }]}>{Number(date.slice(8))}</Text>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                marginTop: 6,
                backgroundColor: marked.includes(date) ? (active ? colors.onPrimary : colors.primary) : "transparent",
              }}
            />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function ActionTile({
  icon: Icon,
  label,
  onPress,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        minWidth: "47%",
        backgroundColor: colors.card,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        gap: 10,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: colors.paleBlue,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={18} color={colors.primary} />
      </View>
      <Text style={[type.meta, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ size?: number; color?: string }>;
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: "47%",
        backgroundColor: colors.card,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        minHeight: 92,
      }}
    >
      <Icon size={16} color={colors.primary} />
      <Text style={[type.title, { color: colors.text, marginTop: 8 }]}>{value}</Text>
      <Text style={[type.meta, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}
