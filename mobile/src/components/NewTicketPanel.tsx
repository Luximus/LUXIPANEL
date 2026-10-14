import * as React from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Paperclip, X, Send } from "lucide-react-native";
import { createTicket, type UploadFileInput } from "../api/client";
import { getThemeTokens } from "../theme/colors";
import { useTicketUploads, MAX_TICKET_ATTACHMENTS, humanFileSize } from "../hooks/useTicketUploads";
import { Button } from "./ui/Button";
import { IconButton } from "./ui/IconButton";
import { ticketStrings } from "./ticketHubStrings";

type Priority = "critical" | "high" | "medium" | "low";
const PRIORITIES: Priority[] = ["low", "medium", "high", "critical"];

/** Panel "Nuevo ticket" del hub (app RN): asunto + prioridad + descripción + adjuntos. */
export default function NewTicketPanel({
  token,
  language,
  isDark,
  maxFileBytes,
  onCreated,
}: {
  token: string;
  language: string;
  isDark: boolean;
  maxFileBytes?: number;
  onCreated: (ticketId: string) => void;
}) {
  const t = ticketStrings(language);
  const tokens = getThemeTokens(isDark);
  const tokenRef = React.useRef(token);
  tokenRef.current = token;
  const uploads = useTicketUploads(() => tokenRef.current, language, maxFileBytes);

  const [title, setTitle] = React.useState("");
  const [priority, setPriority] = React.useState<Priority>("medium");
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  const pick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
      if (result.canceled) return;
      const files: UploadFileInput[] = result.assets.map((a) => ({
        uri: a.uri,
        name: a.name,
        type: a.mimeType ?? "application/octet-stream",
        size: a.size,
      }));
      uploads.add(files);
    } catch {
      /* cancelado / sin permiso */
    }
  };

  const submit = async () => {
    if (title.trim().length < 5) {
      setError(t.titleRequired);
      return;
    }
    if (uploads.hasPending) return;
    setSaving(true);
    setError("");
    try {
      const { ticket } = await createTicket(
        {
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          attachments: uploads.ready.length ? uploads.ready : undefined,
        },
        token,
      );
      onCreated(ticket.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t.createError;
      setError(/403|paid|pago/i.test(msg) ? t.needPaidData : msg);
    } finally {
      setSaving(false);
    }
  };

  const prioLabel = (p: Priority) =>
    p === "low" ? t.prioLow : p === "medium" ? t.prioMedium : p === "high" ? t.prioHigh : t.prioCritical;

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <ScrollView contentContainerStyle={{ padding: 12, gap: 12 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.textSecondary }}>{t.title}</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t.titlePlaceholder}
            placeholderTextColor={tokens.textMuted}
            maxLength={200}
            style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 10, padding: 10, color: tokens.textPrimary, backgroundColor: tokens.bgInput }}
          />
        </View>

        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.textSecondary }}>{t.priority}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {PRIORITIES.map((p) => {
              const active = priority === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => setPriority(p)}
                  style={{ paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: active ? tokens.borderBrand : tokens.border, backgroundColor: active ? tokens.brandDim : tokens.bgSecondary }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: active ? tokens.brandLight : tokens.textSecondary }}>{prioLabel(p)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.textSecondary }}>{t.description}</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={t.descriptionPlaceholder}
            placeholderTextColor={tokens.textMuted}
            maxLength={5000}
            multiline
            style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 10, padding: 10, minHeight: 90, textAlignVertical: "top", color: tokens.textPrimary, backgroundColor: tokens.bgInput }}
          />
        </View>

        {uploads.entries.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {uploads.entries.map((e) => (
              <View key={e.id} style={{ flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: tokens.border, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: tokens.bgSecondary }}>
                <Text numberOfLines={1} style={{ fontSize: 11, maxWidth: 130, color: e.status === "error" ? tokens.danger : tokens.textSecondary }}>
                  {e.name}{e.status === "uploading" ? ` ${Math.round(e.progress)}%` : e.status === "done" ? ` · ${humanFileSize(e.size)}` : ""}
                </Text>
                <Pressable onPress={() => uploads.remove(e.id)} accessibilityLabel={t.delete}><X size={12} color={tokens.textMuted} /></Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {error ? <Text style={{ fontSize: 13, color: tokens.danger }}>{error}</Text> : null}
      </ScrollView>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: tokens.border }}>
        <IconButton
          variant="secondary"
          size={42}
          onPress={() => void pick()}
          disabled={uploads.remaining <= 0}
          accessibilityLabel={t.attach}
          icon={<Paperclip size={18} color={tokens.textMuted} />}
        />
        <View style={{ flex: 1 }}>
          <Button variant="primary" label={saving ? t.creating : t.create} icon={<Send size={15} />} onPress={() => void submit()} disabled={saving || uploads.hasPending} />
        </View>
      </View>
    </View>
  );
}
