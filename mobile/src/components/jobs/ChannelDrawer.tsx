import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  FlatList,
  Image,
  Linking,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import { ArrowLeft, KeyRound, Paperclip, Send, X } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { getLocaleRowDirection, getLocaleTextAlign } from "../../i18n";
import { FormSheet } from "../ui/FormSheet";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import {
  getChannelMessages,
  getGrants,
  jobsErrorKey,
  postChannelMessage,
  revokeGrant,
  shareAccess,
  uploadChannelFile,
  type AccessGrant,
  type ChannelAttachment,
  type ChannelMessage,
  type ChannelParticipant,
  type GrantResourceType,
} from "../../api/jobs";
import { fmtBytes, fmtJobDateTime, jt, type JobsDict } from "./jobs-i18n";
import { subscribeJobsChannelPush } from "./jobs-realtime";
import { makeStyles } from "./ChannelDrawer.styles";

const SELF_ID_KEY = "lp.app.jobs.channelSelfId.v1";
const GRANT_TYPES: GrantResourceType[] = ["note", "link", "server", "ssh_key", "group"];

// Canal / bitácora del requerimiento (espejo de openChannelModal + render* +
// send/share/revoke). Realtime = push Expo + refetch (§D). Se monta como sub-vista
// full-screen de JobsScreen. El self-id se persiste en AsyncStorage (no
// sessionStorage) para alinear mis burbujas tras refetch.
export function ChannelDrawer({
  token,
  requirementId,
  dict,
  language,
  onClose,
  notify,
}: {
  token: string;
  requirementId: string;
  dict: JobsDict;
  language: string;
  onClose: () => void;
  notify: (msg: string, variant?: "success" | "error") => void;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  const textAlign = getLocaleTextAlign(language);
  const rowDir = getLocaleRowDirection(language);

  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [participants, setParticipants] = useState<ChannelParticipant[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [selfId, setSelfId] = useState<string | null>(null);

  const [composer, setComposer] = useState("");
  const [pending, setPending] = useState<ChannelAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [attaching, setAttaching] = useState(false);

  const [grantsOpen, setGrantsOpen] = useState(false);
  const [shareType, setShareType] = useState<string>("note");
  const [shareRef, setShareRef] = useState("");
  const [shareLabel, setShareLabel] = useState("");
  const [sharing, setSharing] = useState(false);

  const listRef = useRef<FlatList<ChannelMessage>>(null);

  // Carga self-id persistido (alinea mis burbujas a la derecha tras refetch).
  useEffect(() => {
    void AsyncStorage.getItem(SELF_ID_KEY).then((v) => { if (v) setSelfId(v); });
  }, []);

  const fetchAll = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError("");
    try {
      const [m, g] = await Promise.all([
        getChannelMessages(token, requirementId),
        getGrants(token, requirementId, true),
      ]);
      setMessages(m.messages);
      setParticipants(m.participants);
      setNextBefore(m.nextBefore);
      setGrants(g);
    } catch (e) {
      setError(jt(dict, jobsErrorKey(e)));
    } finally {
      setLoading(false);
    }
  }, [token, requirementId, dict]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Realtime: push Expo (señal) → refetch. Sin EventSource (RN no lo trae).
  useEffect(() => {
    const unsub = subscribeJobsChannelPush(requirementId, () => { void fetchAll({ silent: true }); });
    return unsub;
  }, [requirementId, fetchAll]);

  // Al volver del background, re-traer el canal abierto (equiv. al auto-reconnect
  // del EventSource web).
  useEffect(() => {
    const onChange = (s: AppStateStatus) => { if (s === "active") void fetchAll({ silent: true }); };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, [fetchAll]);

  const loadEarlier = useCallback(async () => {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const m = await getChannelMessages(token, requirementId, { before: nextBefore });
      setMessages((prev) => [...m.messages, ...prev]);
      setNextBefore(m.nextBefore);
      if (m.participants.length) setParticipants(m.participants);
    } catch (e) {
      setError(jt(dict, jobsErrorKey(e)));
    } finally {
      setLoadingMore(false);
    }
  }, [nextBefore, loadingMore, token, requirementId, dict]);

  const pickAttachment = useCallback(async () => {
    setError("");
    setAttaching(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      const a = result.assets[0];
      const att = await uploadChannelFile(token, requirementId, {
        uri: a.uri,
        name: a.name,
        type: a.mimeType ?? "application/octet-stream",
      });
      setPending((prev) => [...prev, att]);
    } catch (e) {
      setError(jt(dict, jobsErrorKey(e)));
    } finally {
      setAttaching(false);
    }
  }, [token, requirementId, dict]);

  const send = useCallback(async () => {
    const content = composer.trim();
    if (!content && !pending.length) return;
    setError("");
    setSending(true);
    try {
      const msg = await postChannelMessage(token, requirementId, content, pending.length ? pending : undefined);
      if (msg.senderId) {
        setSelfId(msg.senderId);
        void AsyncStorage.setItem(SELF_ID_KEY, msg.senderId);
      }
      setComposer("");
      setPending([]);
      await fetchAll({ silent: true });
    } catch (e) {
      setError(jt(dict, jobsErrorKey(e)) || jt(dict, "channel.sendError"));
    } finally {
      setSending(false);
    }
  }, [composer, pending, token, requirementId, dict, fetchAll]);

  const submitShare = useCallback(async () => {
    const ref = shareRef.trim();
    if (!ref) { setError(jt(dict, "grants.refLabel")); return; }
    setError("");
    setSharing(true);
    try {
      await shareAccess(token, requirementId, {
        resourceType: shareType as GrantResourceType,
        resourceRef: ref,
        label: shareLabel.trim() || undefined,
      });
      setShareRef(""); setShareLabel(""); setShareType("note");
      await fetchAll({ silent: true });
      notify(jt(dict, "grants.share"), "success");
    } catch (e) {
      setError(jt(dict, jobsErrorKey(e)) || jt(dict, "grants.shareError"));
    } finally {
      setSharing(false);
    }
  }, [shareRef, shareLabel, shareType, token, requirementId, dict, fetchAll, notify]);

  const doRevoke = useCallback(async (grantId: string) => {
    try {
      await revokeGrant(token, requirementId, grantId);
      await fetchAll({ silent: true });
      notify(jt(dict, "grants.revoked"), "success");
    } catch (e) {
      notify(jt(dict, jobsErrorKey(e)) || jt(dict, "grants.revokeError"), "error");
    }
  }, [token, requirementId, dict, fetchAll, notify]);

  const authorLabel = useCallback((senderId: string | null): string => {
    if (!senderId) return "—";
    const p = participants.find((x) => x.id === senderId);
    return p?.displayName || p?.email || senderId;
  }, [participants]);

  const renderMessage = useCallback(({ item }: { item: ChannelMessage }) => {
    const when = fmtJobDateTime(item.createdAt, language);
    if (item.kind === "system" || item.kind === "access_share") {
      const text = item.kind === "system" ? (item.content || jt(dict, "channel.systemRevoked")) : item.content;
      return (
        <View style={styles.event}>
          <Text style={[styles.eventText, { color: tokens.textMuted }]}>{text} · {when}</Text>
        </View>
      );
    }
    const mine = selfId !== null && item.senderId === selfId;
    return (
      <View style={[
        styles.bubble,
        {
          alignSelf: mine ? "flex-end" : "flex-start",
          backgroundColor: mine ? tokens.brandDim : tokens.bgCard,
          borderColor: mine ? tokens.borderBrand : tokens.border,
        },
      ]}>
        <View style={[styles.bubbleHead, { flexDirection: rowDir }]}>
          <Text style={[styles.bubbleAuthor, { color: tokens.brand }]} numberOfLines={1}>{authorLabel(item.senderId)}</Text>
          <Text style={[styles.bubbleTime, { color: tokens.textMuted }]}>{when}</Text>
        </View>
        {item.content ? <Text style={[styles.bubbleText, { color: tokens.textPrimary, textAlign }]}>{item.content}</Text> : null}
        {item.attachments?.map((a, i) => <Attachment key={i} att={a} tokens={tokens} styles={styles} />)}
      </View>
    );
  }, [language, dict, selfId, tokens, styles, rowDir, textAlign, authorLabel]);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { flexDirection: rowDir }]}>
        <Pressable onPress={onClose} style={styles.headerIconBtn}>
          <ArrowLeft size={16} color={tokens.textSecondary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: tokens.textPrimary }]} numberOfLines={1}>{jt(dict, "channel.title")}</Text>
        <Pressable onPress={() => setGrantsOpen(true)} style={styles.headerIconBtn}>
          <KeyRound size={16} color={tokens.textSecondary} />
        </Pressable>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={tokens.brand} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            nextBefore ? (
              <View style={styles.loadMoreWrap}>
                <Button label={jt(dict, "channel.loadMore")} variant="ghost" size="sm" loading={loadingMore} onPress={loadEarlier} />
              </View>
            ) : null
          }
          ListEmptyComponent={<Text style={[styles.empty, { color: tokens.textMuted }]}>{jt(dict, "channel.empty")}</Text>}
        />
      )}

      <View style={styles.composer}>
        {error ? <Text style={[styles.error, { color: tokens.danger, textAlign }]}>{error}</Text> : null}
        {pending.length ? (
          <View style={styles.pendingRow}>
            {pending.map((a, i) => (
              <View key={i} style={styles.pendingChip}>
                <Paperclip size={12} color={tokens.textMuted} />
                <Text style={[styles.pendingText, { color: tokens.textSecondary }]} numberOfLines={1}>{a.name || "file"}{typeof a.size === "number" ? ` · ${fmtBytes(a.size)}` : ""}</Text>
                <Pressable onPress={() => setPending((prev) => prev.filter((_, j) => j !== i))} hitSlop={6}>
                  <X size={12} color={tokens.textMuted} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        <View style={[styles.composerRow, { flexDirection: rowDir }]}>
          <Pressable onPress={pickAttachment} disabled={attaching} style={[styles.iconBtn, { borderColor: tokens.border, backgroundColor: tokens.bgCardSolid, opacity: attaching ? 0.6 : 1 }]}>
            {attaching ? <ActivityIndicator size="small" color={tokens.brand} /> : <Paperclip size={18} color={tokens.textSecondary} />}
          </Pressable>
          <TextInput
            style={[styles.input, { color: tokens.textPrimary, textAlign }]}
            value={composer}
            onChangeText={setComposer}
            placeholder={jt(dict, "channel.title")}
            placeholderTextColor={tokens.textMuted}
            multiline
          />
          <Pressable onPress={send} disabled={sending} style={[styles.iconBtn, { borderColor: tokens.brand, backgroundColor: tokens.brand, opacity: sending ? 0.6 : 1 }]}>
            {sending ? <ActivityIndicator size="small" color="#ffffff" /> : <Send size={18} color="#ffffff" />}
          </Pressable>
        </View>
      </View>

      <FormSheet
        visible={grantsOpen}
        onClose={() => setGrantsOpen(false)}
        title={jt(dict, "grants.share")}
        language={language}
      >
        <View style={styles.grantsWrap}>
          {grants.length === 0 ? (
            <Text style={[styles.empty, { color: tokens.textMuted, marginTop: 8 }]}>{jt(dict, "grants.empty")}</Text>
          ) : (
            grants.map((g) => {
              const revoked = g.status === "revoked";
              const typeLabel = jt(dict, `grants.type.${g.resourceType}`);
              return (
                <View key={g.id} style={[styles.grantRow, { flexDirection: rowDir, opacity: revoked ? 0.55 : 1 }]}>
                  <View style={styles.grantBody}>
                    <View style={styles.grantTypeChip}>
                      <Text style={[styles.grantTypeText, { color: tokens.textSecondary }]}>{typeLabel}</Text>
                    </View>
                    <Text style={[styles.grantLabel, { color: tokens.textPrimary }]} numberOfLines={1}>{g.label || g.resourceRef}</Text>
                  </View>
                  {revoked ? (
                    <Text style={[styles.grantTypeText, { color: tokens.textMuted }]}>{jt(dict, "grants.revoked")}</Text>
                  ) : (
                    <Button label={jt(dict, "grants.revoke")} variant="danger" size="sm" onPress={() => doRevoke(g.id)} />
                  )}
                </View>
              );
            })
          )}

          <View style={styles.shareForm}>
            <Text style={[styles.grantsTitle, { color: tokens.textPrimary, textAlign }]}>{jt(dict, "grants.share")}</Text>
            <Select
              value={shareType}
              onChange={setShareType}
              options={GRANT_TYPES.map((g) => ({ value: g, label: jt(dict, `grants.type.${g}`) }))}
            />
            <Input
              label={jt(dict, "grants.refLabel")}
              value={shareRef}
              onChangeText={setShareRef}
              autoCapitalize="none"
              placeholder={shareType === "link" ? "https://…" : shareType === "note" ? jt(dict, "grants.type.note") : "id (uuid)"}
            />
            <Input label={jt(dict, "grants.label")} value={shareLabel} onChangeText={setShareLabel} />
            <Text style={[styles.error, { color: tokens.textMuted, fontWeight: "600" }]}>{jt(dict, "grants.keyForbidden")}</Text>
            <Button label={jt(dict, "grants.share")} variant="primary" onPress={submitShare} loading={sharing} />
          </View>
        </View>
      </FormSheet>
    </View>
  );
}

function Attachment({
  att,
  tokens,
  styles,
}: {
  att: ChannelAttachment;
  tokens: ReturnType<typeof getThemeTokens>;
  styles: ReturnType<typeof makeStyles>;
}) {
  const isImage = (att.type || "").startsWith("image/");
  if (isImage) {
    return (
      <Pressable onPress={() => void Linking.openURL(att.url).catch(() => {})}>
        <Image source={{ uri: att.url }} style={styles.attImage} resizeMode="cover" />
      </Pressable>
    );
  }
  return (
    <Pressable style={styles.att} onPress={() => void Linking.openURL(att.url).catch(() => {})}>
      <Text style={[styles.attText, { color: tokens.brand }]} numberOfLines={1}>📎 {att.name || "file"}{typeof att.size === "number" ? ` · ${fmtBytes(att.size)}` : ""}</Text>
    </Pressable>
  );
}
