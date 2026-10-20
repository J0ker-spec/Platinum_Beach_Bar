import { fullName } from "@/src/data";
import { useStore } from "@/src/store";
import { colors, type } from "@/src/theme";
import { Avatar, BackHeader, Button, Card, Dialog, FilterChip, Screen, SearchField, Segmented, StatusBadge, TextField } from "@/src/ui";
import { Megaphone } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

export default function AnnouncementForm() {
  const router = useRouter();
  const { employees, announcements, publishAnnouncement, saveAnnouncementDraft, userId, setSnack } = useStore();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<"Normal" | "Important">("Normal");
  const [audience, setAudience] = useState("All employees");
  const [picked, setPicked] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [preview, setPreview] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  const staff = employees.filter((e) => !e.isAdmin && e.status === "Active" && fullName(e).toLowerCase().includes(query.toLowerCase()));
  const titleError = submitted && !title.trim() ? "Title is required" : undefined;
  const bodyError = submitted && !body.trim() ? "Message is required" : undefined;
  const hasAudience = audience !== "Selected employees" || picked.length > 0;
  const audienceError = submitted && !hasAudience ? "Select at least one employee" : undefined;
  const valid = !!title.trim() && !!body.trim() && hasAudience;
  const audienceLabel = audience === "All employees" ? "All employees" : `${picked.length} selected`;
  const dirty = !!title || !!body;
  const publisher = employees.find((e) => e.id === userId);

  const build = (status: "Published" | "Draft") => ({
    id: `an-${announcements.length + 1}-${Date.now()}`,
    title: title.trim(),
    excerpt: body.trim().slice(0, 100),
    body: body.trim(),
    publishedAt: status === "Draft" ? "Draft" : "Just now",
    publisher: publisher ? fullName(publisher) : "Management",
    priority,
    status,
    audience: audience as "All employees" | "Selected employees",
    audienceIds: picked,
    unread: true,
  });

  const guard = (next: () => void) => {
    setSubmitted(true);
    if (valid) next();
  };

  if (preview) {
    return (
      <Screen scroll>
        <BackHeader title="Preview" subtitle="How employees will see this" onBack={() => setPreview(false)} />
        <Card>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
            <StatusBadge label="Preview" tone="primary" />
            {priority === "Important" ? <StatusBadge label="Important" tone="warning" /> : null}
          </View>
          <Text style={[type.title, { color: colors.text }]}>{title || "Untitled"}</Text>
          <Text style={[type.meta, { color: colors.muted, marginVertical: 6 }]}>
            {publisher ? fullName(publisher) : "Management"} · {audienceLabel}
          </Text>
          <Text style={[type.body, { color: colors.text }]}>{body || "No message yet."}</Text>
        </Card>
        <View style={{ height: 12 }} />
        <Button label="Return to editor" variant="secondary" onPress={() => setPreview(false)} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <BackHeader title="Create announcement" onBack={() => (dirty ? setDiscard(true) : router.back())} />
      <View style={{ gap: 14 }}>
        <TextField label="Title *" value={title} onChangeText={setTitle} placeholder="e.g. Friday close early" error={titleError} />
        <TextField label="Message *" value={body} onChangeText={setBody} placeholder="Write the announcement" error={bodyError} />
        <View style={{ gap: 6 }}>
          <Text style={[type.label, { color: colors.textSecondary }]}>Priority</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["Normal", "Important"] as const).map((p) => (
              <FilterChip key={p} label={p} active={priority === p} onPress={() => setPriority(p)} />
            ))}
          </View>
        </View>
        <View style={{ gap: 6 }}>
          <Text style={[type.label, { color: colors.textSecondary }]}>Audience</Text>
          <Segmented options={["All employees", "Selected employees"]} value={audience} onChange={setAudience} />
        </View>
        {audience === "Selected employees" && (
          <View style={{ gap: 8 }}>
            {audienceError ? <Text style={[type.meta, { color: colors.error }]}>{audienceError}</Text> : null}
            <SearchField value={query} onChangeText={setQuery} placeholder="Search employees" />
            {staff.map((e) => {
              const on = picked.includes(e.id);
              return (
                <Pressable
                  key={e.id}
                  onPress={() => setPicked((p) => (on ? p.filter((x) => x !== e.id) : [...p, e.id]))}
                  style={{ flexDirection: "row", gap: 12, alignItems: "center", padding: 10, borderRadius: 14, borderWidth: 1, borderColor: on ? colors.primary : colors.border, backgroundColor: colors.card }}
                >
                  <Avatar initials={e.initials} color={e.accent} size={34} />
                  <Text style={[type.body, { color: colors.text, flex: 1 }]}>{fullName(e)}</Text>
                  <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.primary, backgroundColor: on ? colors.primary : "transparent" }} />
                </Pressable>
              );
            })}
          </View>
        )}

        <Button label="Preview" variant="secondary" onPress={() => guard(() => setPreview(true))} />
        <Button label="Publish" icon={Megaphone} loading={publishing} disabled={publishing} onPress={() => guard(() => setConfirm(true))} />
        <Button
          label="Save draft"
          variant="ghost"
          loading={savingDraft}
          disabled={savingDraft || publishing}
          onPress={async () => {
            setSubmitted(true);
            if (!valid || savingDraft) return;
            setSavingDraft(true);
            try {
              await saveAnnouncementDraft(build("Draft"));
              router.back();
            } catch (error) {
              const detail = error instanceof Error ? error.message : "Try again.";
              setSnack({ message: `Couldn't save the draft: ${detail}`, tone: "warning" });
            } finally {
              setSavingDraft(false);
            }
          }}
        />
      </View>

      <Dialog
        visible={confirm}
        icon={Megaphone}
        title="Publish announcement?"
        body={`${audienceLabel} will see this in their Updates, with a matching notification preview.`}
        primary="Publish"
        secondary="Cancel"
        onSecondary={() => setConfirm(false)}
        onPrimary={async () => {
          if (publishing) return;
          setConfirm(false);
          setPublishing(true);
          try {
            await publishAnnouncement(build("Published"));
            router.back();
          } catch (error) {
            const detail = error instanceof Error ? error.message : "Unknown error";
            setSnack({ message: `Couldn't publish the announcement: ${detail}`, tone: "warning" });
          } finally {
            setPublishing(false);
          }
        }}
      />
      <Dialog
        visible={discard}
        tone="warning"
        title="Discard this draft?"
        body="Your changes to this announcement will be lost."
        primary="Discard"
        secondary="Keep editing"
        onSecondary={() => setDiscard(false)}
        onPrimary={() => { setDiscard(false); router.back(); }}
      />
    </Screen>
  );

}
