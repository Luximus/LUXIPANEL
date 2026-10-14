import * as React from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ScopedNativeModal as Modal } from "../screens/main/native-module-context";;
import { styles } from "./SupportChatWidget.styles";
import { MessageCircle, Send, X, ArrowRight, ArrowLeft, LifeBuoy, Paperclip, ListChecks } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import {
  request,
  getSupportAssistantIdentity,
  getAssistantTasks,
  resolveAssistantAvatarUrl,
  type SupportAssistantIdentity,
  type UploadFileInput,
} from "../api/client";
import { getMessages } from "../i18n";
import { getThemeTokens } from "../theme/colors";
import { Button } from "./ui/Button";
import { IconButton } from "./ui/IconButton";
import { AssistantActionCard } from "./AssistantActionCard";
import TicketListPanel from "./TicketListPanel";
import TicketDetailPanel from "./TicketDetailPanel";
import NewTicketPanel from "./NewTicketPanel";
import TasksPanel from "./TasksPanel";
import { ticketStrings } from "./ticketHubStrings";
import { useTicketUploads } from "../hooks/useTicketUploads";

/** Panel activo del hub del asistente (chat + tickets + tareas en el modal). */
type HubPanel = "chat" | "tickets" | "ticket" | "new" | "tasks";

type ChatRole = "user" | "assistant";

/**
 * Acciones inline que el bot puede emitir bajo una respuesta. Espejo del tipo
 * del backend y del widget del frontend / desktop. `navigate` / `open_modal`
 * se delegan al host vía `onAction` (no hay deep-link de Astro en el cliente
 * móvil). `confirm_mutation` lo resuelve este widget contra el backend.
 */
export type ChatAction =
  | { type: "navigate"; label: string; href: string; tutorialId?: string }
  | {
      type: "open_modal";
      label: string;
      modal: "edit_panel" | "connect_panel" | "delete_panel" | "new_ticket";
      panelId?: string;
      prefill?: Record<string, string>;
    }
  | { type: "confirm_mutation"; label: string; mutationToken: string; summary: string }
  // Deep-links a los panels de ticket del propio modal (reflejo del backend).
  | { type: "open_ticket_list"; label: string }
  | { type: "open_new_ticket"; label: string; prefill?: { title?: string; description?: string; priority?: string } }
  | { type: "open_ticket"; label: string; ticketId: string }
  | {
      type: "client_action";
      card: "ssh_key_form" | "ssh_server_form" | "totp_setup" | "recovery_codes" | "passkey_register";
      label: string;
      context?: {
        panelId?: string;
        panelName?: string;
        suggestedUsername?: string;
        suggestedPort?: number;
        panelIds?: string[];
        availableKeys?: { id: string; linuxUsername: string | null }[];
      };
    };

type ChatMessage = {
  role: ChatRole;
  content: string;
  localId?: string;
  actions?: ChatAction[];
  /** Adjuntos del mensaje del usuario (imágenes que el modelo verá vía visión). */
  attachments?: { url: string; type?: string; name?: string }[];
};

type ChatResponse = {
  ok: boolean;
  data?: {
    reply: string;
    actions?: ChatAction[];
    /**
     * Identidad del asistente ACTIVO (roster rotativo). El backend puede
     * incluirla en la respuesta del chat; si llega, refrescamos cabecera/avatar
     * por si el turno rotó a mitad de sesión. `avatarUrl` puede venir relativa.
     */
    assistant?: { id?: string; name?: string; avatarUrl?: string };
    /** Si el backend compactó la conversación, trae el resumen para colapsar el historial. */
    compaction?: { summary: string };
  };
  error?: string;
};

function newLocalId(): string {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export interface SupportChatWidgetProps {
  /** JWT de portal para autenticar contra `/portal/support/chat`. */
  token: string;
  /** Locale activo; se reenvía al backend y selecciona las etiquetas i18n. */
  language: string;
  isDark: boolean;
  /** Separación del FAB respecto al borde inferior del área de contenido. */
  bottomOffset?: number;
  /** El host mapea `navigate` / `open_modal` a la navegación interna del cliente. */
  onAction: (action: ChatAction) => void;
  initialOpen?: boolean;
  hideLauncher?: boolean;
  onClose?: () => void;
  /**
   * Deshabilita el FAB (no lo oculta) cuando la cuenta se quedó sin datos
   * disponibles (saldo MB <= 0). El asistente no se puede abrir mientras esté
   * bloqueado. Espejo 1:1 con el desktop.
   */
  disabled?: boolean;
  /**
   * En móvil no hay hover/tooltip: al tocar el FAB deshabilitado avisamos el
   * motivo por aquí (el host abre el modal de "sin datos"). Equivalente táctil
   * del tooltip de web/desktop.
   */
  onDisabledPress?: () => void;
}

export function SupportChatWidget({
  token,
  language,
  isDark,
  bottomOffset = 18,
  onAction,
  initialOpen = false,
  hideLauncher = false,
  onClose,
  disabled = false,
  onDisabledPress,
}: SupportChatWidgetProps) {
  const t = getMessages(language);
  const labels = t.supportAssistant;
  const tokens = getThemeTokens(isDark);
  const insets = useSafeAreaInsets();
  const [open, setOpen] = React.useState(initialOpen);
  /**
   * Identidad del asistente ACTIVO que entrega el backend (roster rotativo).
   * Se carga al abrir el chat y se cachea durante la sesión (no se vuelve a
   * pedir mientras el widget viva). `null` ⇒ aún sin cargar / falló ⇒ fallback.
   */
  const [assistant, setAssistant] = React.useState<SupportAssistantIdentity | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  /** Acciones ya consumidas (click hecho) — `${localId}:${actionIdx}`. */
  const [consumed, setConsumed] = React.useState<Set<string>>(() => new Set());
  /**
   * Alto del teclado. Dentro de un `Modal` Android no hace resize de la ventana,
   * así que `KeyboardAvoidingView` no sube el input; lo elevamos manualmente
   * escuchando los eventos del teclado y empujando el campo por encima de él.
   */
  const [kbHeight, setKbHeight] = React.useState(0);
  const scrollRef = React.useRef<ScrollView>(null);
  // ── Hub: panel activo (chat / tickets / detalle / nuevo) ──────────────────
  const [hubPanel, setHubPanel] = React.useState<HubPanel>("chat");
  const [activeTicketId, setActiveTicketId] = React.useState<string | null>(null);
  const [ticketsReloadKey, setTicketsReloadKey] = React.useState(0);
  // Nº de tareas en background terminadas y no leídas (badge del botón "Tareas").
  const [tasksUnread, setTasksUnread] = React.useState(0);
  const tk = ticketStrings(language);
  const tokenRef = React.useRef(token);
  tokenRef.current = token;
  // Id de conversación para la compactación por tokens del backend.
  const conversationIdRef = React.useRef<string>(
    `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
  );
  // Adjuntos del INPUT del chat (imágenes que el modelo "verá" vía visión).
  const chatUploads = useTicketUploads(() => tokenRef.current, language);

  // Al abrir el asistente, consulta cuántas tareas en background terminaron sin
  // leer (badge del botón "Tareas"). Silencioso: si falla, el badge queda en 0.
  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    void getAssistantTasks(token)
      .then((res) => { if (alive) setTasksUnread(res.unread); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [open, token]);

  const goPanel = React.useCallback((p: HubPanel, ticketId?: string) => {
    if (ticketId) setActiveTicketId(ticketId);
    setHubPanel(p);
  }, []);
  const refreshTickets = React.useCallback(() => setTicketsReloadKey((k) => k + 1), []);

  const pickChatFiles = React.useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "image/*", multiple: true, copyToCacheDirectory: true });
      if (result.canceled) return;
      const files: UploadFileInput[] = result.assets.map((a) => ({ uri: a.uri, name: a.name, type: a.mimeType ?? "image/*", size: a.size }));
      chatUploads.add(files);
    } catch {
      /* cancelado */
    }
  }, [chatUploads]);

  React.useEffect(() => {
    if (!open) {
      setKbHeight(0);
      return;
    }
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvt, (e) => {
      // Medimos el solape del teclado desde el borde inferior REAL de la pantalla
      // con `screenY`, no solo con `height`: bajo edge-to-edge (edgeToEdgeEnabled)
      // Android reporta `height` SIN la barra de navegación, mientras el panel se
      // dibuja hasta el fondo físico (detrás de la barra). Usando height a secas el
      // input quedaba corto y tapado por el teclado ("no sube lo suficiente").
      // Tomamos el mayor de ambos para no quedarnos nunca por debajo del teclado.
      const screenH = Dimensions.get("screen").height;
      const endY = e.endCoordinates?.screenY ?? screenH;
      const height = e.endCoordinates?.height ?? 0;
      setKbHeight(Math.max(height, screenH - endY, 0));
    });
    const hideSub = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(id);
  }, [messages, loading, open, kbHeight]);

  // Carga la identidad del asistente activo de forma EAGER (al montar, no al
  // abrir): el FAB muestra su avatar redondeado antes de abrir el chat. Se
  // cachea durante la sesión (solo se pide si aún no la tenemos). Si falla,
  // `assistant` queda en null → el FAB cae al icono y la cabecera al fallback.
  React.useEffect(() => {
    if (assistant) return;
    let cancelled = false;
    void (async () => {
      const identity = await getSupportAssistantIdentity(token);
      if (!cancelled && identity) setAssistant(identity);
    })();
    return () => {
      cancelled = true;
    };
  }, [assistant, token]);

  const send = React.useCallback(async () => {
    const text = input.trim();
    const atts = chatUploads.ready;
    if ((!text && atts.length === 0) || loading || chatUploads.hasPending) return;
    setError(null);
    const next: ChatMessage[] = [
      ...messages,
      { role: "user", content: text, localId: newLocalId(), attachments: atts.length ? atts.map((a) => ({ url: a.url, type: a.type, name: a.name })) : undefined },
    ];
    setMessages(next);
    setInput("");
    chatUploads.clear();
    setLoading(true);
    try {
      const res = await request<ChatResponse>("/portal/support/chat", token, {
        method: "POST",
        body: JSON.stringify({
          messages: next.slice(-20).map((m) => ({
            role: m.role,
            content: m.content,
            ...(m.attachments?.length ? { attachments: m.attachments } : {}),
          })),
          ...(language ? { locale: language } : {}),
          // Id de conversación → habilita la compactación por tokens del backend.
          conversationId: conversationIdRef.current,
          // Declara el cliente para el gating por capacidad del backend (app no
          // soporta tours driver.js; passkey nativo se habilita en Fase 4).
          client: "app",
        }),
      });
      if (res.ok && res.data?.reply) {
        // Si la respuesta del chat trae la identidad del asistente activo,
        // refrescamos cabecera/avatar (cubre la rotación de turno a mitad de
        // sesión). El avatar puede venir relativo → lo absolutizamos.
        const a = res.data.assistant;
        if (a && typeof a.name === "string" && a.name) {
          setAssistant({
            id: typeof a.id === "string" ? a.id : "",
            name: a.name,
            avatarUrl: resolveAssistantAvatarUrl(a.avatarUrl),
          });
        }
        const replyMsg: ChatMessage = {
          role: "assistant",
          content: res.data.reply,
          actions: res.data.actions,
          localId: newLocalId(),
        };
        const summary = res.data.compaction?.summary;
        if (summary) {
          // El backend compactó: colapsamos el historial a un mensaje-resumen
          // (que viaja como contexto los siguientes turnos) + la última respuesta.
          const seed: ChatMessage = {
            role: "assistant",
            content: `${labels.compactionPrefix} ${summary}`,
            localId: newLocalId(),
          };
          setMessages([seed, replyMsg]);
        } else {
          setMessages((prev) => [...prev, replyMsg]);
        }
      } else {
        setError(res.error ?? labels.responseError);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.connectionError);
    } finally {
      setLoading(false);
    }
  }, [token, input, loading, messages, language, labels.responseError, labels.connectionError, chatUploads]);

  /**
   * `navigate` / `open_modal` se delegan al host y cierran el panel (el Modal
   * cubre la pantalla, así el usuario ve el destino). `confirm_mutation` se
   * POSTea a `/portal/support/chat/confirm` y el resultado se inyecta como un
   * mensaje del asistente, manteniendo el panel abierto.
   */
  const handleAction = React.useCallback(
    (action: ChatAction, key: string) => {
      setConsumed((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      // Deep-links a los panels del hub (in-drawer). NO cierran el modal.
      if (action.type === "open_ticket_list") { goPanel("tickets"); return; }
      if (action.type === "open_new_ticket") { goPanel("new"); return; }
      if (action.type === "open_ticket") { goPanel("ticket", action.ticketId); return; }
      if (action.type === "open_modal" && action.modal === "new_ticket") { goPanel("new"); return; }
      if (action.type === "confirm_mutation") {
        void (async () => {
          try {
            const res = await request<{ ok: boolean; data?: unknown; error?: string }>(
              "/portal/support/chat/confirm",
              token,
              { method: "POST", body: JSON.stringify({ mutationToken: action.mutationToken }) },
            );
            if (res.ok) refreshTickets();
            const text = res.ok
              ? `${labels.actionSuccess} ${action.summary}.`
              : `${labels.actionError} ${res.error ?? labels.unknownError}.`;
            setMessages((prev) => [...prev, { role: "assistant", content: text, localId: newLocalId() }]);
          } catch (err) {
            const msg = err instanceof Error ? err.message : labels.connectionErrorShort;
            setMessages((prev) => [...prev, { role: "assistant", content: `${msg}`, localId: newLocalId() }]);
          }
        })();
        return;
      }
      onAction(action);
      setOpen(false);
      onClose?.();
    },
    [
      token,
      onAction,
      goPanel,
      refreshTickets,
      labels.actionSuccess,
      labels.actionError,
      labels.unknownError,
      labels.connectionErrorShort,
      onClose,
    ],
  );

  const renderBubble = (role: ChatRole, text: string, key?: string) => {
    const isUser = role === "user";
    return (
      <View
        key={key}
        style={[
          styles.msg,
          isUser
            ? { alignSelf: "flex-end", backgroundColor: tokens.brand }
            : { alignSelf: "flex-start", backgroundColor: tokens.bgSecondary, borderColor: tokens.border, borderWidth: 1 },
        ]}
      >
        <Text style={[styles.msgText, { color: isUser ? "#ffffff" : tokens.textPrimary }]}>{text}</Text>
      </View>
    );
  };

  return (
    <>
      {/* Sin datos: el FAB se ve sólido atenuado (variant secondary, SIN
          transparencia) y, al tocarlo, avisa el motivo en vez de abrir el chat. */}
      {!hideLauncher ? (
        <Button
          variant={disabled ? "secondary" : "primary"}
          label={labels.fabLabel}
          icon={
            assistant?.avatarUrl ? (
              // Avatar redondeado del asistente ACTIVO (fallback al icono mientras carga).
              <Image source={{ uri: assistant.avatarUrl }} style={styles.fabAvatar} accessibilityLabel={assistant.name} />
            ) : (
              <MessageCircle size={22} />
            )
          }
          onPress={() => { if (disabled) { onDisabledPress?.(); return; } setOpen(true); }}
          style={[styles.fab, { borderRadius: 999, height: 52, bottom: bottomOffset }]}
        />
      ) : null}

      {/* Botón atrás (onRequestClose) no descarta para no perder lo escrito en el chat. */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={[styles.backdrop, { backgroundColor: tokens.bgOverlay }]}>
          {/* Capa de fondo SIN onPress: tocar fuera ya no cierra el chat. El cierre es por el botón X de la cabecera. */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none" />
          <KeyboardAvoidingView
            behavior={undefined}
            style={styles.kav}
            pointerEvents="box-none"
          >
            <View style={[styles.panel, { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border }]}>
              <View style={[styles.head, { borderBottomColor: tokens.border, backgroundColor: tokens.brandDim, paddingTop: insets.top + 12 }]}>
                {hubPanel !== "chat" ? (
                  <IconButton
                    variant="ghost"
                    size={32}
                    onPress={() => goPanel(hubPanel === "ticket" || hubPanel === "new" ? "tickets" : "chat")}
                    accessibilityLabel={tk.back}
                    icon={<ArrowLeft size={20} color={tokens.textPrimary} />}
                  />
                ) : null}
                <View style={[styles.headTitle, { flex: 1 }]}>
                  {hubPanel === "chat" ? (
                    <>
                      {/* Avatar del asistente ACTIVO (backend). Fallback resiliente. */}
                      {assistant?.avatarUrl ? (
                        <Image source={{ uri: assistant.avatarUrl }} style={styles.headAvatar} accessibilityLabel={assistant.name} />
                      ) : (
                        <View style={[styles.headAvatarFallback, { backgroundColor: tokens.bgSecondary }]}>
                          <MessageCircle size={16} color={tokens.textPrimary} />
                        </View>
                      )}
                      <Text style={[styles.headTitleText, { color: tokens.textPrimary }]}>
                        {assistant?.name ?? labels.fallbackName}
                      </Text>
                    </>
                  ) : (
                    <Text style={[styles.headTitleText, { color: tokens.textPrimary }]}>
                      {hubPanel === "tickets" ? tk.myTickets : hubPanel === "new" ? tk.newTicket : hubPanel === "tasks" ? tk.tasks : tk.support}
                    </Text>
                  )}
                </View>
                {hubPanel === "chat" ? (
                  <Pressable
                    onPress={() => goPanel("tasks")}
                    accessibilityLabel={tk.tasks}
                    style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 9, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.bgSecondary }}
                  >
                    <ListChecks size={15} color={tokens.textSecondary} />
                    <Text style={{ fontSize: 12, fontWeight: "600", color: tokens.textSecondary }}>{tk.tasks}</Text>
                    {tasksUnread > 0 ? (
                      <View style={{ minWidth: 16, paddingHorizontal: 4, borderRadius: 999, backgroundColor: tokens.danger, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: "#fff" }}>{tasksUnread}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                ) : null}
                {hubPanel === "chat" ? (
                  <Pressable
                    onPress={() => goPanel("tickets")}
                    accessibilityLabel={tk.myTickets}
                    style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 9, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.bgSecondary }}
                  >
                    <LifeBuoy size={15} color={tokens.textSecondary} />
                    <Text style={{ fontSize: 12, fontWeight: "600", color: tokens.textSecondary }}>{tk.myTickets}</Text>
                  </Pressable>
                ) : null}
                <IconButton
                  variant="ghost"
                  size={32}
                  onPress={() => { setOpen(false); onClose?.(); }}
                  accessibilityLabel={labels.close}
                  icon={<X size={20} />}
                />
              </View>

              {hubPanel === "chat" ? (
              <>
              <ScrollView
                ref={scrollRef}
                style={styles.body}
                contentContainerStyle={styles.bodyContent}
                keyboardShouldPersistTaps="handled"
              >
                {renderBubble("assistant", labels.welcome, "welcome")}
                {messages.slice(-12).map((m, i) => {
                  const baseKey = m.localId ?? `idx-${i}`;
                  return (
                    <View key={baseKey}>
                      {renderBubble(m.role, m.content)}
                      {m.role === "user" && m.attachments?.length ? (
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, alignSelf: "flex-end", marginTop: 2 }}>
                          {m.attachments.map((a, ai) => (
                            <Image key={`${a.url}-${ai}`} source={{ uri: a.url }} style={{ width: 72, height: 72, borderRadius: 8 }} />
                          ))}
                        </View>
                      ) : null}
                      {m.role === "assistant" && m.actions && m.actions.length > 0 ? (
                        <View style={styles.actions} accessibilityLabel={labels.suggestedActions}>
                          {m.actions.map((a, idx) => {
                            const actionKey = `${baseKey}:${idx}`;
                            const isConsumed = consumed.has(actionKey);
                            if (a.type === "client_action") {
                              return (
                                <AssistantActionCard
                                  key={actionKey}
                                  action={a}
                                  token={token}
                                  language={language}
                                  isDark={isDark}
                                  disabled={isConsumed}
                                  onResult={(msg) =>
                                    setMessages((prev) => [...prev, { role: "assistant", content: msg, localId: newLocalId() }])
                                  }
                                  onDone={() =>
                                    setConsumed((prev) => {
                                      const next = new Set(prev);
                                      next.add(actionKey);
                                      return next;
                                    })
                                  }
                                />
                              );
                            }
                            const danger = a.type === "confirm_mutation";
                            return (
                              <Button
                                key={actionKey}
                                size="sm"
                                variant={danger ? "danger" : "secondary"}
                                disabled={isConsumed}
                                label={a.label}
                                icon={<ArrowRight size={14} />}
                                onPress={() => handleAction(a, actionKey)}
                                style={styles.action}
                              />
                            );
                          })}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
                {loading ? (
                  <View accessibilityLabel={labels.typing} style={[styles.msg, styles.typing, { alignSelf: "flex-start", backgroundColor: tokens.bgSecondary, borderColor: tokens.border }]}>
                    <ActivityIndicator size="small" color={tokens.textMuted} />
                  </View>
                ) : null}
                {error ? <Text style={[styles.error, { color: tokens.danger }]}>{error}</Text> : null}
              </ScrollView>

              {chatUploads.entries.length > 0 ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 12, paddingTop: 6 }}>
                  {chatUploads.entries.map((e) => (
                    <View key={e.id} style={{ flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: tokens.border, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: tokens.bgSecondary }}>
                      <Text numberOfLines={1} style={{ fontSize: 11, maxWidth: 120, color: e.status === "error" ? tokens.danger : tokens.textSecondary }}>
                        {e.name}{e.status === "uploading" ? ` ${Math.round(e.progress)}%` : ""}
                      </Text>
                      <Pressable onPress={() => chatUploads.remove(e.id)}><X size={12} color={tokens.textMuted} /></Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={[styles.inputRow, { borderTopColor: tokens.border, paddingBottom: (kbHeight > 0 ? kbHeight : insets.bottom) + 10 }]}>
                <IconButton
                  variant="secondary"
                  size={40}
                  onPress={() => void pickChatFiles()}
                  disabled={chatUploads.remaining <= 0}
                  accessibilityLabel={tk.attach}
                  icon={<Paperclip size={18} color={tokens.textMuted} />}
                />
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder={labels.placeholder}
                  placeholderTextColor={tokens.textMuted}
                  style={[styles.input, { color: tokens.textPrimary, borderColor: tokens.border, backgroundColor: tokens.bgInput }]}
                  multiline
                  maxLength={4000}
                />
                <IconButton
                  variant="primary"
                  size={40}
                  onPress={() => void send()}
                  disabled={loading || chatUploads.hasPending || (!input.trim() && chatUploads.ready.length === 0)}
                  accessibilityLabel={labels.send}
                  icon={<Send size={18} />}
                />
              </View>
              </>
              ) : (
                <View style={{ flex: 1, minHeight: 0, paddingBottom: kbHeight }}>
                  {hubPanel === "tickets" ? (
                    <TicketListPanel
                      token={token}
                      language={language}
                      isDark={isDark}
                      reloadKey={ticketsReloadKey}
                      onOpenTicket={(id) => goPanel("ticket", id)}
                      onNewTicket={() => goPanel("new")}
                    />
                  ) : hubPanel === "ticket" && activeTicketId ? (
                    <TicketDetailPanel
                      token={token}
                      language={language}
                      isDark={isDark}
                      ticketId={activeTicketId}
                      onChanged={refreshTickets}
                      onDeleted={() => {
                        refreshTickets();
                        goPanel("tickets");
                      }}
                    />
                  ) : hubPanel === "new" ? (
                    <NewTicketPanel
                      token={token}
                      language={language}
                      isDark={isDark}
                      onCreated={(id) => {
                        refreshTickets();
                        goPanel("ticket", id);
                      }}
                    />
                  ) : hubPanel === "tasks" ? (
                    <TasksPanel token={token} language={language} isDark={isDark} onUnreadChange={setTasksUnread} />
                  ) : null}
                </View>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

export default SupportChatWidget;
