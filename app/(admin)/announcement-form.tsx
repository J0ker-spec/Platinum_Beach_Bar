import { fullName } from "@/src/data";
import { useStore } from "@/src/store";
import { colors, type } from "@/src/theme";
import { Avatar, BackHeader, Button, Card, Dialog, FilterChip, Screen, SearchField, Segmented, StatusBadge, TextField } from "@/src/ui";
import { Megaphone, Trash2 } from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

export default function AnnouncementForm() {
  const router = useRouter();
  const { announcementId: announcementIdParam } = useLocalSearchParams<{ announcementId?: string }>();
  const announcementId = Array.isArray(announcementIdParam) ? announcementIdParam[0] : announcementIdParam;
  const { employees, announcements, publishAnnouncement, saveAnnouncementDraft, deleteAnnouncement, userId, setSnack } = useStore();
  const existing = announcementId ? announcements.find((item) => item.id === announcementId) : undefined;
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [missing, setMissing] = useState(false);
  const loadedDraftId = useRef<string | null>(null);

  // Load an existing draft once, so "Edit draft" updates the same document instead of cloning it.
  useEffect(() => {
    if (existing && loadedDraftId.current !== existing.id) {
      loadedDraftId.current = existing.id;
      setTitle(existing.title);
      setBody(existing.body);
      setPriority(existing.priority);
      setAudience(existing.audience);
      setPicked(existing.audienceIds ?? []);
      setDirty(false);
    }
  }, [existing]);

  // A draft deleted on another device must not leave the editor stuck on "Loading…".
  useEffect(() => {
    if (!announcementId || existing) {
      setMissing(false);
      return;
    }
    const id = setTimeout(() => setMissing(true), 5000);
    return () => clearTimeout(id);
  }, [announcementId, existing]);

  const staff = employees.filter((e) => !e.isAdmin && e.status === "Active" && fullName(e).toLowerCase().includes(query.toLowerCase()));
  const titleError = submitted && !title.trim() ? "Title is required" : undefined;
  const bodyError = submitted && !body.trim() ? "Message is required" : undefined;
  const hasAudience = audience !== "Selected employees" || picked.length > 0;
  const audienceError = submitted && !hasAudience ? "Select at least one employee" : undefined;
  const valid = !!title.trim() && !!body.trim() && hasAudience;
  const audienceLabel = audience === "All employees" ? "All employees" : `${picked.length} selected`;
  const publisher = employees.find((e) => e.id === userId);
  const busy = publishing || savingDraft || deleting;

  const touch = () => setDirty(true);
  const close = () => (dirty ? setDiscard(true) : router.back());

  const build = (status: "Published" | "Draft") => ({
    id: existing?.id ?? "",
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

  if (announcementId && !existing) {
    return (
      <Screen>
        <BackHeader title={missing ? "Draft not available" : "Edit draft"} onBack={() => router.back()} />
        <Text style={[type.body, { color: colors.textSecondary }]}>
          {missing
            ? "This draft no longer exists. It may have been published or deleted on another device."
            : "Loading draft…"}
        </Text>
        {missing ? <Button label="Back to announcements" variant="secondary" onPress={() => router.back()} /> : null}
      </Screen>
    );
  }

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
      <BackHeader title={existing ? "Edit draft" : "Create announcement"} onBack={close} />
      <View style={{ gap: 14 }}>
        <TextField label="Title *" value={title} onChangeText={(v) => { touch(); setTitle(v); }} placeholder="e.g. Friday close early" error={titleError} maxLength={200} />
        <TextField label="Message *" value={body} onChangeText={(v) => { touch(); setBody(v); }} placeholder="Write the announcement" error={bodyError} maxLength={5000} />
        <View style={{ gap: 6 }}>
          <Text style={[type.label, { color: colors.textSecondary }]}>Priority</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["Normal", "Important"] as const).map((p) => (
              <FilterChip key={p} label={p} active={priority === p} onPress={() => { touch(); setPriority(p); }} />
            ))}
          </View>
        </View>
        <View style={{ gap: 6 }}>
          <Text style={[type.label, { color: colors.textSecondary }]}>Audience</Text>
          <Segmented options={["All employees", "Selected employees"]} value={audience} onChange={(value) => { touch(); setAudience(value); }} />
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
                  onPress={() => { touch(); setPicked((p) => (on ? p.filter((x) => x !== e.id) : [...p, e.id])); }}
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
        <Button label="Publish" icon={Megaphone} loading={publishing} disabled={busy} onPress={() => guard(() => setConfirm(true))} />
        <Button
          label={existing ? "Save changes" : "Save draft"}
          variant="ghost"
          loading={savingDraft}
          disabled={busy}
          onPress={async () => {
            setSubmitted(true);
            if (!valid || busy) return;
            setSavingDraft(true);
            try {
              await saveAnnouncementDraft(build("Draft"));
              setDirty(false);
              router.back();
            } catch (error) {
              const detail = error instanceof Error ? error.message : "Try again.";
              setSnack({ message: `Couldn't save the draft: ${detail}`, tone: "warning" });
            } finally {
              setSavingDraft(false);
            }
          }}
        />
        {existing ? (
          <Button label="Delete draft" icon={Trash2} variant="danger" disabled={busy} onPress={() => setConfirmDelete(true)} />
        ) : null}
        <Button label="Cancel" variant="secondary" disabled={busy} onPress={close} />
      </View>

      <Dialog
        visible={confirm}
        icon={Megaphone}
        title={existing ? "Publish this draft?" : "Publish announcement?"}
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
            setDirty(false);
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
        title="Discard your changes?"
        body={existing ? "Your edits to this draft will be lost. The saved draft stays as it was." : "Your changes to this announcement will be lost."}
        primary="Discard"
        secondary="Keep editing"
        onSecondary={() => setDiscard(false)}
        onPrimary={() => { setDiscard(false); router.back(); }}
      />
      <Dialog
        visible={confirmDelete}
        tone="danger"
        icon={Trash2}
        title="Delete this draft?"
        body="The draft will be permanently removed. This cannot be undone."
        primary={deleting ? "Deleting…" : "Delete draft"}
        secondary="Cancel"
        primaryDisabled={deleting}
        secondaryDisabled={deleting}
        onSecondary={() => setConfirmDelete(false)}
        onPrimary={async () => {
          if (!existing || deleting) return;
          setDeleting(true);
          try {
            await deleteAnnouncement(existing.id);
            setDirty(false);
            setConfirmDelete(false);
            router.back();
          } catch (error) {
            const detail = error instanceof Error ? error.message : "Try again.";
            setSnack({ message: `Couldn't delete the draft: ${detail}`, tone: "warning" });
          } finally {
            setDeleting(false);
          }
        }}
      />
    </Screen>
  );
}
