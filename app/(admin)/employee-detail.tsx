import { fullName } from "@/src/data";
import { formatPretty, isoDate } from "@/src/dates";
import { useStore } from "@/src/store";
import { colors, type } from "@/src/theme";
import { Avatar, BackHeader, Button, Card, Dialog, Screen, Sheet, StatusBadge } from "@/src/ui";
import { badgeTone } from "@/src/widgets";
import { Lock, MoreVertical, UserX } from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

export default function EmployeeDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { employees, shifts, attendance, upsertEmployee, setEmployeeRole, userId, setSnack, getEmployee: findEmployee } = useStore();
  const person = employees.find((e) => e.id === id) ?? findEmployee(String(id));
  const [menu, setMenu] = useState(false);
  const [deactivate, setDeactivate] = useState(false);
  const [remove, setRemove] = useState(0);

  if (!person) {
    return (
      <Screen>
        <BackHeader title="Employee" onBack={() => router.back()} />
        <Text style={[type.body, { color: colors.textSecondary }]}>Loading employee…</Text>
      </Screen>
    );
  }
  const upcoming = shifts
    .filter(
      (s) =>
        s.employeeId === person.id &&
        s.status !== "Cancelled" &&
        (typeof s.endAt === "number" ? s.endAt > Date.now() : s.date >= isoDate())
    )
    .sort((a, b) => (a.startAt ?? 0) - (b.startAt ?? 0))
    .slice(0, 3);
  const records = attendance
    .filter((a) => a.employeeId === person.id)
    .sort((a, b) => (b.clockInAt ?? 0) - (a.clockInAt ?? 0) || b.date.localeCompare(a.date))
    .slice(0, 3);

  return (
    <Screen scroll>
      <BackHeader title="Employee" onBack={() => router.back()} />
      <Card>
        <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
          <Avatar initials={person.initials} color={person.accent} size={64} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[type.title, { color: colors.text }]}>{fullName(person)}</Text>
            <Text style={[type.meta, { color: colors.textSecondary }]}>{person.title}</Text>
            <StatusBadge label={person.status} tone={badgeTone(person.status)} />
          </View>
          <Pressable onPress={() => setMenu(true)} accessibilityLabel="More actions" hitSlop={10}>
            <MoreVertical size={22} color={colors.text} />
          </Pressable>
        </View>
        <View style={{ marginTop: 14, backgroundColor: colors.surface, borderRadius: 12, padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={[type.tiny, { color: colors.muted }]}>Employee ID — assigned automatically</Text>
            <Text style={[type.card, { color: colors.text }]}>{person.id}</Text>
          </View>
          <Lock size={16} color={colors.muted} />
        </View>
      </Card>

      <Card style={{ marginTop: 16 }}>
        {[
          ["Email", person.email],
          ["Phone", person.phone],
          ["Job title", person.title],
        ].map(([label, value]) => (
          <View key={label} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={[type.tiny, { color: colors.muted }]}>{label}</Text>
            <Text style={[type.body, { color: colors.text }]}>{value}</Text>
          </View>
        ))}
      </Card>

      <Text style={[type.section, { color: colors.text, marginTop: 20, marginBottom: 8 }]}>Upcoming shifts</Text>
      <Card>
        {upcoming.length ? (
          upcoming.map((s) => (
            <View key={s.id} style={{ paddingVertical: 8, flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={[type.body, { color: colors.text }]}>{formatPretty(s.date)}</Text>
              <Text style={[type.meta, { color: colors.textSecondary }]}>{s.start} – {s.end}</Text>
            </View>
          ))
        ) : (
          <Text style={[type.body, { color: colors.textSecondary }]}>No upcoming shifts.</Text>
        )}
      </Card>

      <Text style={[type.section, { color: colors.text, marginTop: 20, marginBottom: 8 }]}>Recent attendance</Text>
      <Card>
        {records.length ? (
          records.map((r) => (
            <View key={r.id} style={{ paddingVertical: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[type.body, { color: colors.text }]}>{formatPretty(r.date)}</Text>
              <StatusBadge label={r.status} tone={badgeTone(r.status)} />
            </View>
          ))
        ) : (
          <Text style={[type.body, { color: colors.textSecondary }]}>No attendance records yet.</Text>
        )}
      </Card>

      <View style={{ marginTop: 20 }}>
        <Button label="Edit employee" onPress={() => router.push({ pathname: "/(admin)/employee-form", params: { id: person.id } })} />
      </View>

      <Sheet visible={menu} onClose={() => setMenu(false)}>
        <Text style={[type.section, { color: colors.text }]}>Employment actions</Text>
        <Button
          label={person.status === "Active" ? "Deactivate employee" : "Reactivate employee"}
          variant="secondary"
          onPress={async () => {
            setMenu(false);
            if (person.status === "Active") setDeactivate(true);
            else {
              try {
                await upsertEmployee({ ...person, status: "Active" });
                setSnack({ message: "Employee reactivated", tone: "success" });
              } catch {
                setSnack({ message: "Couldn't reactivate the employee. Try again.", tone: "warning" });
              }
            }
          }}
        />
        {person.id !== userId && (
          <Button
            label={person.isAdmin ? "Change to employee" : "Make admin"}
            variant="ghost"
            onPress={async () => {
              setMenu(false);
              try {
                await setEmployeeRole(person.id, person.isAdmin ? "employee" : "admin");
              } catch {
                setSnack({ message: "Couldn't change the role. Try again.", tone: "warning" });
              }
            }}
          />
        )}
        <Button label="Delete permanently" variant="danger" onPress={() => { setMenu(false); setRemove(1); }} />
        <Button label="Close" variant="ghost" onPress={() => setMenu(false)} />
      </Sheet>

      <Dialog
        visible={deactivate}
        tone="warning"
        icon={UserX}
        title="Deactivate employee?"
        body="The account becomes inactive. Historical attendance and schedule records are retained."
        primary="Deactivate"
        secondary="Cancel"
        onSecondary={() => setDeactivate(false)}
        onPrimary={async () => {
          try {
            await upsertEmployee({ ...person, status: "Inactive" });
            setDeactivate(false);
            setSnack({ message: "Employee deactivated", tone: "success" });
          } catch {
            setSnack({ message: "Couldn't deactivate the employee. Try again.", tone: "warning" });
          }
        }}
      />
      <Dialog
        visible={remove === 1}
        tone="danger"
        icon={UserX}
        title="Delete permanently?"
        body="Deletion is a separate step from deactivation and cannot be undone. Deactivating is recommended."
        primary="Continue"
        secondary="Cancel"
        onSecondary={() => setRemove(0)}
        onPrimary={() => setRemove(2)}
      />
      <Dialog
        visible={remove === 2}
        tone="danger"
        icon={UserX}
        title="Are you absolutely sure?"
        body={`${fullName(person)} and their linked history would be removed. This is a prototype, so nothing is actually deleted.`}
        primary="Delete (preview)"
        secondary="Keep employee"
        onSecondary={() => setRemove(0)}
        onPrimary={() => {
          setRemove(0);
          setSnack({ message: "Deletion previewed — no data changed", tone: "warning" });
          router.back();
        }}
      />
    </Screen>
  );
}
