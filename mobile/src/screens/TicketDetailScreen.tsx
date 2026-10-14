import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Animated, FlatList, Image, KeyboardAvoidingView, Linking, Platform, Pressable, Text, TextInput, View } from "react-native";
import { styles } from "./TicketDetailScreen.styles";
import * as DocumentPicker from "expo-document-picker";
import { CalendarDays, Clock3, Lock } from "lucide-react-native";
import { ENV } from "../config/env";
import type { TicketDetailState } from "../features/app/viewModels";
import { fileExtBadge, humanFileSize, MAX_TICKET_ATTACHMENTS, useTicketUploads } from "../hooks/useTicketUploads";
import type { TicketAttachment, TicketMessage } from "../types/models";
import type { UploadFileInput } from "../api/client";
import { validateReplyDraft } from "../features/support/reply-draft";
import { UploadList } from "../components/UploadList";
import { Avatar } from "../components/ui/Avatar";
import { useAuth } from "../context/useAuth";
import { getLocaleRowDirection, getLocaleTextAlign, getMessages, isRtlLocale, type Messages } from "../i18n";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens, type ThemeTokens } from "../theme/colors";
import { localizeCommonError } from "../lib/error-localization";

// Colores semánticos de estado/prioridad (espejo de SupportScreen) para los
// chips de la cabecera del ticket.
const STATUS_COLORS: Record<string, string> = {
  open: "#f472b6",
  in_progress: "#f43f5e",
  resolved: "#10b981",
  closed: "#94a3b8",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f43f5e",
  medium: "#f59e0b",
  low: "#94a3b8",
};

function formatDate(input: string, locale?: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  return date.toLocaleString(locale || undefined);
}

function buildAttachmentUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${ENV.apiUrl}${url}`;
  return url;
}

function MessageBubble({
  message,
  isOwn,
  ownPhotoURL,
  t,
  isDark,
  language,
}: {
  message: TicketMessage;
  isOwn: boolean;
  ownPhotoURL: string | null;
  t: Messages;
  isDark: boolean;
  language?: string;
}) {
  const tokens = getThemeTokens(isDark);
  const rowDirection = getLocaleRowDirection(language);
  const textAlign = getLocaleTextAlign(language);
  const senderName = message.sender?.name || message.sender?.email || t.ticketDetail.unknownSender;
  const content = message.content?.trim() ?? "";
  const hasContent = content.length > 0;
  const attachments = message.attachments ?? [];
  const hasAttachments = attachments.length > 0;
  const hasOnlyAttachments = hasAttachments && !hasContent;
  // Only the current viewer's photoURL is available locally (Firebase). Others
  // fall back to initials since we don't fetch their photos.
  const photoURL = isOwn ? ownPhotoURL : null;

  return (
    <View
      style={[
        styles.messageRow,
        isOwn ? styles.messageRowOwn : styles.messageRowAdmin,
      ]}
    >
      <View style={styles.avatarSlot}>
        <Avatar photoURL={photoURL} displayName={senderName} size={32} />
      </View>
      <View style={[styles.message, isOwn ? styles.messageOwn : styles.messageAdmin]}>
        <View style={[styles.messageMeta, { flexDirection: rowDirection }]}>
          <Text style={{ color: tokens.textMuted, fontSize: 11, fontWeight: "600" }}>{senderName}</Text>
          {message.isAdmin ? (
            <View style={[styles.adminTag, { backgroundColor: tokens.brandDim }]}>
              <Text style={{ color: tokens.brandLight, fontSize: 9, fontWeight: "800", letterSpacing: 0.4 }}>
                {t.ticketDetail.supportTag}
              </Text>
            </View>
          ) : null}
          <Text style={{ color: tokens.textMuted, fontSize: 11 }}>· {formatDate(message.createdAt, language)}</Text>
        </View>
        <View
          style={[
            styles.bubble,
            hasOnlyAttachments ? styles.bubbleAttachmentsOnly : null,
            isOwn
              ? { backgroundColor: tokens.brandDim, borderColor: tokens.borderBrand, borderWidth: 1, borderBottomRightRadius: 4 }
              : { backgroundColor: tokens.bgSecondary, borderBottomLeftRadius: 4 },
          ]}
        >
          {hasContent ? (
            <Text style={{ color: tokens.textPrimary, fontSize: 14, lineHeight: 20, textAlign }}>
              {content}
            </Text>
          ) : null}
          {hasAttachments ? (
            <View style={[styles.attachmentsList, hasContent ? styles.attachmentsListWithContent : null]}>
              {attachments.map((att, idx) => {
                const fullUrl = buildAttachmentUrl(att.url);
                const fallbackName = att.url.split("/").pop() || t.ticketDetail.attachmentFallbackName;
                const name = att.name || fallbackName;
                const ext = fileExtBadge(name, att.type || "");
                const isImage = (att.type || "").startsWith("image/");
                return (
                  <Pressable
                    key={`${att.url}-${idx}`}
                    onPress={() => Linking.openURL(fullUrl)}
                    style={[styles.attachment, { backgroundColor: tokens.bgInput, borderColor: tokens.border, flexDirection: rowDirection }]}
                  >
                    <View style={[styles.attachmentBadge, { backgroundColor: tokens.brandDim }]}>
                      <Text style={{ color: tokens.brandLight, fontSize: 9, fontWeight: "800" }}>{ext}</Text>
                    </View>
                    <View style={styles.attachmentInfo}>
                      <Text numberOfLines={1} style={{ color: tokens.textPrimary, fontSize: 13, fontWeight: "600", textAlign }}>{name}</Text>
                      {att.size ? <Text style={{ color: tokens.textMuted, fontSize: 11, textAlign }}>{humanFileSize(att.size)}</Text> : null}
                    </View>
                    {isImage ? (
                      <Image
                        source={{ uri: fullUrl }}
                        style={{ width: 60, height: 40, borderRadius: 6 }}
                        resizeMode="cover"
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function SkeletonBlock({ width, height, tokens }: { width: number | string; height: number; tokens: ThemeTokens }) {
  return (
    <View
      style={{
        width: width as number,
        height,
        borderRadius: 6,
        backgroundColor: tokens.border,
        opacity: 0.6,
      }}
    />
  );
}

function ChatSkeleton({ tokens }: { tokens: ThemeTokens }) {
  return (
    <View style={{ padding: 12, gap: 12 }}>
      <View style={{ alignSelf: "flex-end", width: "60%" }}>
        <SkeletonBlock width="100%" height={48} tokens={tokens} />
      </View>
      <View style={{ alignSelf: "flex-start", width: "55%" }}>
        <SkeletonBlock width="100%" height={48} tokens={tokens} />
      </View>
      <View style={{ alignSelf: "flex-end", width: "50%" }}>
        <SkeletonBlock width="100%" height={48} tokens={tokens} />
      </View>
    </View>
  );
}

export function TicketDetailScreen({
  state,
  setState,
  onBack,
  sendReply,
  currentUserId,
  token,
  language,
  onBottomActionsChange,
  keyboardShift,
  maxFileBytes,
}: {
  state: TicketDetailState;
  setState: (updater: (current: TicketDetailState) => TicketDetailState) => void;
  onBack: () => void;
  sendReply: (attachments: TicketAttachment[]) => void;
  currentUserId: string | null;
  token: string | null;
  language?: string;
  /** Límite por archivo en bytes (dinámico por rol; `customer.maxUploadMb`). */
  maxFileBytes?: number;
  keyboardShift?: Animated.Value;
  onBottomActionsChange?: (actions: {
    onBack: () => void;
    onAttach: () => void;
    onSend: () => void;
    attachDisabled: boolean;
    sendDisabled: boolean;
    counterLabel: string;
  } | null) => void;
}) {
  const t = getMessages(language);
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const rtl = isRtlLocale(language);
  const direction = rtl ? "rtl" : "ltr";
  const rowDirection = getLocaleRowDirection(language);
  const textAlign = getLocaleTextAlign(language);
  const shouldUseKeyboardAvoiding = Platform.OS === "ios";
  const shouldTranslateReplyBar = Platform.OS !== "ios";
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const uploads = useTicketUploads(() => tokenRef.current, language, maxFileBytes);
  const shouldShowUploadList = uploads.entries.length > 1;
  // Campo de respuesta señalado como inválido (vacío al enviar): borde rojo + foco.
  const replyRef = useRef<TextInput>(null);
  const [replyInvalid, setReplyInvalid] = React.useState(false);

  const { userEmail, savedAccounts } = useAuth();
  const currentAccount = userEmail ? savedAccounts.find((entry) => entry.email === userEmail) : null;
  const ownPhotoURL = currentAccount?.photoURL ?? null;

  useEffect(() => {
    return () => uploads.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedMessages = useMemo(() => {
    const messages = state.ticket?.messages ?? [];
    return [...messages].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [state.ticket?.messages]);

  const onPickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets) return;
      const files: UploadFileInput[] = result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name ?? "file",
        type: asset.mimeType ?? "application/octet-stream",
        size: asset.size ?? 0,
      }));
      const { rejected } = uploads.add(files);
      if (rejected.length > 0) {
        const message = rejected.map((r) => `${r.name}: ${r.reason}`).join("\n");
        setState((current) => ({ ...current, error: message }));
      }
    } catch (error) {
      setState((current) => ({
        ...current,
        error: localizeCommonError(error, t, t.common.error),
      }));
    }
  };

  const onSendReply = () => {
    const verdict = validateReplyDraft({
      content: state.replyContent,
      readyAttachments: uploads.ready.length,
      hasPendingUploads: uploads.hasPending,
    });
    if (verdict === "uploads-pending") {
      setState((current) => ({ ...current, error: t.ticketDetail.awaitUploads }));
      return;
    }
    // El mensaje es obligatorio cuando no se adjuntó ningún archivo. Resalta y
    // enfoca el campo de respuesta (espejo de la validación del host).
    if (verdict === "empty") {
      setReplyInvalid(true);
      setState((current) => ({ ...current, error: t.errors.replyEmpty }));
      replyRef.current?.focus();
      return;
    }
    setReplyInvalid(false);
    sendReply(uploads.ready);
    uploads.clear();
  };

  // El botón "Enviar" NO vive en esta pantalla: se publica en la barra inferior
  // del host, que lo GUARDA EN SU ESTADO. Por eso el efecto de abajo no puede
  // re-publicarse en cada render (bucle de re-render) y sus deps son solo los
  // FLAGS visibles. Consecuencia: publicar `onSendReply` directo lo CONGELABA con
  // el `replyContent` de la primera publicación (vacío) → escribir una respuesta y
  // pulsar Enviar disparaba "el mensaje no puede estar vacío" y el mensaje NUNCA
  // se enviaba (`uploads.ready` sufría lo mismo). Publicamos envoltorios ESTABLES
  // que leen la última versión por ref: identidad fija, closure siempre fresco.
  const latestActionsRef = useRef({ onSendReply, onPickFiles });
  latestActionsRef.current = { onSendReply, onPickFiles };
  const emitSend = useCallback(() => { latestActionsRef.current.onSendReply(); }, []);
  const emitAttach = useCallback(() => { void latestActionsRef.current.onPickFiles(); }, []);

  useEffect(() => {
    onBottomActionsChange?.({
      onBack,
      onAttach: emitAttach,
      onSend: emitSend,
      attachDisabled: uploads.remaining === 0,
      sendDisabled: state.sending || uploads.hasPending,
      counterLabel: `${uploads.count} / ${MAX_TICKET_ATTACHMENTS}`,
    });
    return () => onBottomActionsChange?.(null);
  }, [onBottomActionsChange, emitAttach, emitSend, uploads.remaining, uploads.hasPending, uploads.count, state.sending, onBack]);

  const ticket = state.ticket;
  const statusLabel = ticket
    ? t.ticketDetail.statusLabels[ticket.status as keyof typeof t.ticketDetail.statusLabels] ?? ticket.status
    : "";
  const priorityLabel = ticket
    ? t.ticketDetail.priorityLabels[ticket.priority as keyof typeof t.ticketDetail.priorityLabels] ?? ticket.priority
    : "";
  const statusColor = ticket ? (STATUS_COLORS[ticket.status] ?? tokens.brand) : tokens.brand;
  const priorityColor = ticket ? (PRIORITY_COLORS[ticket.priority] ?? tokens.danger) : tokens.danger;

  // Response state from the user's perspective. The app is the user-facing
  // client, so "awaiting_user" means the user must reply.
  let responseStateKey: "responded" | "awaiting_user" | "awaiting_admin" | "no_response" = "no_response";
  if (ticket?.lastResponderRole === "admin") responseStateKey = "awaiting_user";
  else if (ticket?.lastResponderRole === "user") responseStateKey = "responded";
  const responseStateLabel = t.ticketTable.responseBadges[responseStateKey];

  return (
    <KeyboardAvoidingView
      enabled={shouldUseKeyboardAvoiding}
      style={[styles.root, { backgroundColor: tokens.bgPrimary, direction }]}
      behavior="padding"
    >
      <View style={[styles.topBar, { backgroundColor: tokens.bgCard, borderBottomColor: tokens.border }]}>
        {ticket ? (
          <>
            <Text style={[styles.ticketTitle, { color: tokens.textPrimary, textAlign }]} numberOfLines={2}>{ticket.title}</Text>
            <View style={[styles.infoBadges, { flexDirection: rowDirection }]}>
              <View style={[styles.chip, { backgroundColor: `${statusColor}22`, flexDirection: rowDirection }]}>
                <View style={[styles.chipDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.chipText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
              <View style={[styles.chip, { backgroundColor: `${priorityColor}22`, flexDirection: rowDirection }]}>
                <View style={[styles.chipDot, { backgroundColor: priorityColor }]} />
                <Text style={[styles.chipText, { color: priorityColor }]}>{priorityLabel}</Text>
              </View>
              <View style={[styles.responsePill, { backgroundColor: tokens.bgSecondary, borderColor: tokens.border }]}>
                <Text style={[styles.responsePillText, { color: tokens.textSecondary }]}>{responseStateLabel}</Text>
              </View>
            </View>
            <View style={[styles.metaRow, { flexDirection: rowDirection }]}>
              <CalendarDays size={13} color={tokens.textMuted} />
              <Text style={[styles.infoMeta, { color: tokens.textMuted, textAlign }]}>
                {t.ticketDetail.date}: {formatDate(ticket.createdAt, language)}
              </Text>
            </View>
            {ticket.updatedAt ? (
              <View style={[styles.metaRow, { flexDirection: rowDirection }]}>
                <Clock3 size={13} color={tokens.textMuted} />
                <Text style={[styles.infoMeta, { color: tokens.textMuted, textAlign }]}>
                  {t.ticketDetail.updatedAt}: {formatDate(ticket.updatedAt, language)}
                </Text>
              </View>
            ) : null}
            {ticket.closedAt ? (
              <View style={[styles.metaRow, { flexDirection: rowDirection }]}>
                <Lock size={13} color={tokens.textMuted} />
                <Text style={[styles.infoMeta, { color: tokens.textMuted, textAlign }]}>
                  {t.ticketDetail.closedAt}: {formatDate(ticket.closedAt, language)}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}
      </View>

      {state.loading && !ticket ? (
        <>
          <ChatSkeleton tokens={tokens} />
        </>
      ) : !ticket ? (
        <View style={styles.center}>
          <Text style={{ color: tokens.danger, textAlign }}>{state.error || t.ticketDetail.couldNotLoad}</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={sortedMessages}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                isOwn={currentUserId ? item.senderId === currentUserId : !item.isAdmin}
                ownPhotoURL={ownPhotoURL}
                t={t}
                isDark={theme === "dark"}
                language={language}
              />
            )}
            contentContainerStyle={styles.chatList}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={{ color: tokens.textMuted, textAlign }}>{t.ticketDetail.noMessages}</Text>
              </View>
            }
          />

          <Animated.View
            style={[
              styles.replyBar,
              shouldTranslateReplyBar && keyboardShift ? { transform: [{ translateY: Animated.multiply(keyboardShift, -1) }] } : null,
              {
                backgroundColor: tokens.bgCardSolid,
                borderTopColor: tokens.border,
              },
            ]}
          >
            <TextInput
              ref={replyRef}
              value={state.replyContent}
              onChangeText={(value) => {
                if (replyInvalid) setReplyInvalid(false);
                setState((current) => ({ ...current, replyContent: value }));
              }}
              placeholder={t.ticketDetail.replyPlaceholder}
              placeholderTextColor={tokens.textMuted}
              multiline
              maxLength={5000}
              editable={!state.sending}
              style={[
                styles.replyInput,
                {
                  backgroundColor: tokens.bgInput,
                  color: tokens.textPrimary,
                  borderColor: replyInvalid ? tokens.danger : tokens.border,
                  textAlign,
                },
              ]}
            />
            {shouldShowUploadList ? (
              <UploadList entries={uploads.entries} onRemove={uploads.remove} language={language} />
            ) : null}
            {state.error ? (
              <Text style={{ color: tokens.danger, fontSize: 12, textAlign }}>{state.error}</Text>
            ) : null}
          </Animated.View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}
