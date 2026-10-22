import { useStore } from "@/src/store";
import { colors, type } from "@/src/theme";
import { BackHeader, Button, Card, Dialog, EmptyState, Screen, SearchField, Segmented, StatusBadge } from "@/src/ui";
import { Megaphone, Pencil, Send, Trash2 } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

export default function Announcements() {
  const router = useRouter();
  const { announcements, publishAnnouncement, deleteAnnouncement, setSnack } = useStore();
  const [tab, setTab] = useState("Published");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const rows = announcements.filter((a) => a.status === tab && a.title.toLowerCase().includes(query.toLowerCase()));
  const current = announcements.find((a) => a.id === openId);
  const busy = deleting || !!publishingId;

  const publishDraft = async (id: string) => {
    const draft = announcements.find((a) => a.id === id);
    if (!draft || busy) return;
    setPublishingId(id);
    try {
      await publishAnnouncement(draft);
      setTab("Published");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Try again.";
      setSnack({ message: `Couldn't publish the draft: ${detail}`, tone: "warning" });
    } finally {
      setPublishingId(null);
    }
  };

  return (
    <Screen scroll>
      <BackHeader title="Announcements" onBack={() => router.back()} />
      <Button label="Create announcement" icon={Megaphone} onPress={() => router.push("/(admin)/announcement-form")} />
      <View style={{ height: 12 }} />
      <Segmented options={["Published", "Draft"]} value={tab} onChange={setTab} />
      <View style={{ height: 12 }} />
      <SearchField value={query} onChangeText={setQuery} placeholder="Search announcements" />
      <View style={{ gap: 10, marginTop: 14 }}>
        {rows.length ? (
          rows.map((a) => (
            <Card
              key={a.id}
              style={a.priority === "Important" ? { borderColor: colors.amber } : undefined}
              onPress={a.status === "Draft" ? () => router.push({ pathname: "/(admin)/announcement-form", params: { announcementId: a.id } }) : undefined}
            >
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                <StatusBadge label={a.status} tone={a.status === "Published" ? "success" : "neutral"} />
                {a.priority === "Important" ? <StatusBadge label="Important" tone="warning" /> : null}
              </View>
              <Text style={[type.card, { color: colors.text }]}>{a.title}</Text>
              <Text style={[type.meta, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={2}>{a.excerpt}</Text>
              <Text style={[type.tiny, { color: colors.muted, marginTop: 8 }]}>
                {a.publishedAt} · {a.publisher} · {a.audience}
              </Text>
              {a.status === "Draft" ? (
                <View style={{ gap: 8, marginTop: 10 }}>
                  <Button
                    label="Edit draft"
                    icon={Pencil}
                    variant="secondary"
                    onPress={() => router.push({ pathname: "/(admin)/announcement-form", params: { announcementId: a.id } })}
                  />
                  <Button
                    label="Publish draft"
                    icon={Send}
                    loading={publishingId === a.id}
                    disabled={busy}
                    onPress={() => void publishDraft(a.id)}
                  />
                  <Button
                    label="Delete draft"
                    icon={Trash2}
                    variant="ghost"
                    disabled={busy}
                    onPress={() => { setOpenId(a.id); setConfirmDelete(true); }}
                  />
                </View>
              ) : null}
            </Card>
          ))
        ) : (
          <EmptyState icon={Megaphone} title="No announcements" body={tab === "Draft" ? "Saved drafts will appear here." : "Published announcements will appear here."} />
        )}
      </View>

      <Dialog
        visible={confirmDelete && !!current}
        tone="danger"
        icon={Trash2}
        title="Delete this draft?"
        body="The draft will be permanently removed. Published announcements are not affected."
        primary={deleting ? "Deleting…" : "Delete draft"}
        secondary="Cancel"
        primaryDisabled={busy}
        secondaryDisabled={busy}
        onSecondary={() => { setConfirmDelete(false); setOpenId(null); }}
        onPrimary={async () => {
          if (!current || busy) return;
          setDeleting(true);
          try {
            await deleteAnnouncement(current.id);
            setConfirmDelete(false);
            setOpenId(null);
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
