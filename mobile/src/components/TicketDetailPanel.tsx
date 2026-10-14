import { useConfirmation } from "./ui/useConfirmation";
import * as React from "react";
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Paperclip, X, Send, Trash2, CheckCircle2 } from "lucide-react-native";
import {
  getTicket,
  sendTicketMessage,
  updateTicketStatus,
  deleteTicket,
  type UploadFileInput,
} from "../api/client";
import type { TicketDetail } from "../types/models";
import { getThemeTokens } from "../theme/colors";
import { useTicketUploads, humanFileSize } from "../hooks/useTicketUploads";
import { Button } from "./ui/Button";
import { IconButton } from "./ui/IconButton";
import { ticketStrings, tkStatusLabel, tkPriorityLabel, tkFormatDate, isImageAtt } from "./ticketHubStrings";

type Tokens = ReturnType<typeof getThemeTokens>;
function statusColor(tokens: Tokens, s: string): string {
  return s === "open" ? tokens.brandLight : s === "in_progress" ? tokens.warning : s === "resolved" ? tokens.success : tokens.textMuted;
}

/** Panel de DETALLE de ticket (app RN): timeline + hilo + responder con adjuntos
 *  + cerrar / eliminar. Espejo del web/desktop. */
export default function TicketDetailPanel({
  token,
  language,
  isDark,
  ticketId,
  maxFileBytes,
  onChanged,
  onDeleted,
}: {
  token: string;
  language: string;
  isDark: boolean;
  ticketId: string;
  maxFileBytes?: number;
  onChanged?: () => void;
  onDeleted?: () => void;
}) {
  const { askConfirmation, confirmation } = useConfirmation(language);
  const t = ticketStrings(language);
  const tokens = getThemeTokens(isDark);
  const tokenRef = React.useRef(token);
  tokenRef.current = token;
  const uploads = useTicketUploads(() => tokenRef.current, language, maxFileBytes);

  const [ticket, setTicket] = React.useState<TicketDetail | null>(null);
  const [error, setError] = React.useState("");
  const [reply, setReply] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [acting, setActing] = React.useState(false);
  const scrollRef = React.useRef<ScrollView>(null);

  const load = React.useCallback(async () => {
    setError("");
    try {
      const { ticket: data } = await getTicket(ticketId, token);
      setTicket(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.loadError);
    }
  }, [ticketId, token, t.loadError]);

  React.useEffect(() => {
    void load();
  }, [load]);
  React.useEffect(() => {
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(id);
  }, [ticket]);

  const closed = ticket?.status === "closed";

  const pick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
      if (result.canceled) return;
      const files: UploadFileInput[] = result.assets.map((a) => ({ uri: a.uri, name: a.name, type: a.mimeType ?? "application/octet-stream", size: a.size }));
      uploads.add(files);
    } catch {
      /* cancelado */
    }
  };

  const submitReply = async () => {
    if ((!reply.trim() && uploads.ready.length === 0) || uploads.hasPending) return;
    setSending(true);
    setError("");
    try {
      await sendTicketMessage(ticketId, { content: reply.trim() || " ", attachments: uploads.ready.length ? uploads.ready : undefined }, token);
      setReply("");
      uploads.clear();
      await load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.loadError);
    } finally {
      setSending(false);
    }
  };

  const runAction = async (fn: () => Promise<void>) => {
    setActing(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(/STEP_UP|2FA/i.test(msg) ? t.twoFaRequired : msg || t.loadError);
    } finally {
      setActing(false);
    }
  };
  const doClose = () => void runAction(async () => { await updateTicketStatus(ticketId, "closed", token); await load(); onChanged?.(); });
  const doDelete = () => {
    askConfirmation(t.delete, t.deleteConfirm, [
      { text: t.cancel, style: "cancel" },
      { text: t.delete, style: "destructive", onPress: () => runAction(async () => { await deleteTicket(ticketId, token); onDeleted?.(); }) },
    ]);
  };

  if (!ticket) {
    return <>
      {confirmation}
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        {error ? <Text style={{ color: tokens.textMuted, fontSize: 13 }}>{error}</Text> : <ActivityIndicator color={tokens.brand} />}
      </View>
    </>;
  }

  const sc = statusColor(tokens, ticket.status);

  return <>
      {confirmation}
    <View style={{ flex: 1, minHeight: 0 }}>
      <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: tokens.border, gap: 6 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: sc }}>{tkStatusLabel(t, ticket.status).toUpperCase()}</Text>
          <Text style={{ fontSize: 11, fontWeight: "600", color: tokens.textMuted }}>· {tkPriorityLabel(t, ticket.priority)}</Text>
        </View>
        <Text style={{ fontSize: 14, fontWeight: "800", color: tokens.textPrimary }}>{ticket.title}</Text>
        {ticket.statusHistory?.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {ticket.statusHistory.map((h) => (
              <Text key={h.id} style={{ fontSize: 10, color: tokens.textMuted, backgroundColor: tokens.bgSecondary, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                {tkStatusLabel(t, h.toStatus)} · {tkFormatDate(h.changedAt, language)}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 12, gap: 8 }} keyboardShouldPersistTaps="handled">
        {!ticket.messages?.length ? (
          <Text style={{ color: tokens.textMuted, textAlign: "center", marginTop: 16, fontSize: 13 }}>{t.noMessages}</Text>
        ) : (
          ticket.messages.map((m) => (
            <View
              key={m.id}
              style={{ maxWidth: "92%", alignSelf: m.isAdmin ? "flex-start" : "flex-end", borderRadius: 10, borderWidth: 1, borderColor: tokens.border, padding: 8, backgroundColor: m.isAdmin ? tokens.bgSecondary : tokens.brandDim }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
                <Text style={{ fontSize: 10, fontWeight: "700", color: tokens.textMuted }}>{m.isAdmin ? t.support : t.you}</Text>
                <Text style={{ fontSize: 10, color: tokens.textMuted }}>{tkFormatDate(m.createdAt, language)}</Text>
              </View>
              {m.content.trim() ? <Text style={{ fontSize: 13, color: tokens.textPrimary }}>{m.content}</Text> : null}
              {m.attachments?.length ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  {m.attachments.map((a, i) =>
                    isImageAtt(a) ? (
                      <Pressable key={i} onPress={() => void Linking.openURL(a.url)}>
                        <Image source={{ uri: a.url }} style={{ width: 84, height: 84, borderRadius: 8 }} />
                      </Pressable>
                    ) : (
                      <Pressable key={i} onPress={() => void Linking.openURL(a.url)} style={{ flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: tokens.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                        <Text numberOfLines={1} style={{ fontSize: 11, maxWidth: 130, color: tokens.brandLight }}>{a.name ?? a.url.split("/").pop()}</Text>
                      </Pressable>
                    ),
                  )}
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      {error ? <Text style={{ paddingHorizontal: 12, fontSize: 13, color: tokens.danger }}>{error}</Text> : null}

      {closed ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: tokens.border }}>
          <Text style={{ flex: 1, fontSize: 13, color: tokens.textMuted }}>{t.closedNotice}</Text>
          <Button variant="danger" size="sm" label={t.delete} icon={<Trash2 size={14} />} onPress={doDelete} disabled={acting} />
        </View>
      ) : (
        <>
          {uploads.entries.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 10, paddingTop: 6 }}>
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
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, padding: 8, borderTopWidth: 1, borderTopColor: tokens.border }}>
            <IconButton variant="secondary" size={40} onPress={() => void pick()} disabled={uploads.remaining <= 0} accessibilityLabel={t.attach} icon={<Paperclip size={18} color={tokens.textMuted} />} />
            <TextInput
              value={reply}
              onChangeText={setReply}
              placeholder={t.replyPlaceholder}
              placeholderTextColor={tokens.textMuted}
              multiline
              maxLength={5000}
              style={{ flex: 1, borderWidth: 1, borderColor: tokens.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, maxHeight: 100, color: tokens.textPrimary, backgroundColor: tokens.bgInput }}
            />
            <IconButton variant="primary" size={40} onPress={() => void submitReply()} disabled={sending || uploads.hasPending || (!reply.trim() && uploads.ready.length === 0)} accessibilityLabel={t.send} icon={<Send size={18} />} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 8, borderTopWidth: 1, borderTopColor: tokens.border }}>
            <View style={{ flex: 1 }}>
              <Button variant="secondary" size="sm" label={t.closeTicket} icon={<CheckCircle2 size={14} />} onPress={doClose} disabled={acting} />
            </View>
            <Button variant="danger" size="sm" label={t.delete} icon={<Trash2 size={14} />} onPress={doDelete} disabled={acting} />
          </View>
        </>
      )}
    </View>
  </>;
}
