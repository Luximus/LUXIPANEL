import * as React from "react";
import { MessageCircle, Send, X, ArrowRight, ArrowLeft, LifeBuoy, Paperclip, ListChecks } from "lucide-react";
import { request, getSupportAssistantIdentity, getAssistantTasks, uploadTicketAttachment, type SupportAssistantIdentity, type TicketAttachment } from "../api/client";
import { ENV } from "../config/env";
import { getMessages } from "../i18n";
import { AssistantActionCard } from "./AssistantActionCard";
import TicketListPanel from "./TicketListPanel";
import TicketDetailPanel from "./TicketDetailPanel";
import NewTicketPanel from "./NewTicketPanel";
import TasksPanel from "./TasksPanel";
import { ticketStrings } from "./ticketHubStrings";
import "./SupportChatWidget.css";

/** Panel activo del hub del asistente (chat + gestión de tickets en el drawer). */
type HubPanel = "chat" | "tickets" | "ticket" | "new" | "tasks";

/**
 * NOTA: este módulo exporta `SupportChatPanel`, el CUERPO del chat (mensajes +
 * acciones inline + input), sin FAB ni posicionamiento fijo. Lo monta
 * `AssistantDrawer` dentro de un drawer daisyUI (derecha). Antes este archivo
 * renderizaba además un FAB flotante + panel; eso se eliminó al consolidar el
 * chrome en el navbar superior.
 */

type ChatRole = "user" | "assistant";

/**
 * Acciones inline que el bot puede emitir bajo una respuesta. Reflejo del tipo
 * del backend (`backend/src/modules/support/chat-tools/types.ts`) y del widget
 * del frontend (`frontend/src/components/support/SupportChatWidget.tsx`). Si
 * añades tipos allí, replícalos aquí. Mantenemos el discriminador `type` para
 * no romper la renderización si llega uno que aún no soportamos.
 *
 * `navigate` / `open_modal` se delegan al host vía `onAction` (no hay deep-link
 * de Astro en el cliente desktop). `confirm_mutation` lo resuelve este widget
 * contra `/portal/support/chat/confirm`.
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
  // Deep-links a los panels de ticket del propio drawer (reflejo del backend).
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
  /** Identificador local estable de este mensaje (para deduplicar acciones consumidas). */
  localId?: string;
  /** Acciones inline a renderizar bajo el mensaje del asistente. */
  actions?: ChatAction[];
  /** Adjuntos del mensaje del usuario (imágenes que el modelo verá vía visión). */
  attachments?: { url: string; type?: string; name?: string }[];
};

/**
 * Identidad del asistente de soporte ACTIVO que entrega el backend en cada
 * respuesta del chat. El equipo rota por turnos (Emma/Ethan/Liam/Lux/Olivia),
 * así que el nombre y el avatar NO se hardcodean: vienen del servidor.
 * Contrato: `backend/src/modules/support/ASSISTANT_ROSTER_CONTRACT.md`
 * (forma `{ id, name, avatarUrl }`). `avatarUrl` es una ruta relativa al sitio
 * (`/support/<Folder>/<n>.webp`) que resolvemos contra `ENV.luxipanelUrl`.
 */
type AssistantIdentity = SupportAssistantIdentity;

type ChatResponse = {
  ok: boolean;
  // `compaction.summary` (opcional): el backend resumió la conversación al cruzar
  // el umbral de tokens; el cliente colapsa su historial a ese resumen.
  data?: { reply: string; actions?: ChatAction[]; assistant?: AssistantIdentity; compaction?: { summary: string } };
  error?: string;
};

/**
 * Resuelve la `avatarUrl` del backend (relativa al sitio) a una URL absoluta.
 * El cliente desktop no comparte origen con el frontend que sirve los
 * estáticos (`public/support/…`), así que prefijamos con `ENV.luxipanelUrl`
 * (el portal público canónico que sirve esos binarios) cuando es ruta `/…`.
 */
export function resolveAvatarUrl(avatarUrl: string): string {
  if (/^https?:\/\//i.test(avatarUrl)) return avatarUrl;
  return `${ENV.luxipanelUrl}${avatarUrl.startsWith("/") ? "" : "/"}${avatarUrl}`;
}

/** Genera un id local para deduplicar acciones consumidas a lo largo del historial. */
function newLocalId(): string {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Avatar del asistente en la burbuja. Si hay identidad del backend muestra su
 * foto (resuelta a URL absoluta); ante ausencia o error de carga cae al
 * placeholder genérico (icono), priorizando siempre lo que entrega el backend.
 */
function AssistantAvatar({ assistant, altFallback }: { assistant: AssistantIdentity | null; altFallback: string }) {
  const [failed, setFailed] = React.useState(false);
  // Reinicia el estado de error si cambia el avatar (rotación de turno/semana).
  React.useEffect(() => {
    setFailed(false);
  }, [assistant?.avatarUrl]);

  const showImage = assistant?.avatarUrl && !failed;
  return (
    <div className="chat-image avatar">
      <div className="support-chat-avatar">
        {showImage ? (
          <img
            src={resolveAvatarUrl(assistant!.avatarUrl)}
            alt={assistant?.name || altFallback}
            className="support-chat-avatar__img"
            onError={() => setFailed(true)}
          />
        ) : (
          <MessageCircle size={15} aria-hidden="true" />
        )}
      </div>
    </div>
  );
}

export interface SupportChatPanelProps {
  /** JWT de portal para autenticar contra `/portal/support/chat`. */
  token: string;
  /** Locale activo; se reenvía al backend y selecciona las etiquetas i18n. */
  language: string;
  /** El host mapea `navigate` / `open_modal` a la navegación interna del cliente. */
  onAction: (action: ChatAction) => void;
  /** Cierra el drawer que contiene este panel (botón ✕ del encabezado). */
  onClose?: () => void;
}

export function SupportChatPanel({ token, language, onAction, onClose }: SupportChatPanelProps) {
  const t = getMessages(language);
  const labels = t.supportAssistant;
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  /**
   * Identidad del asistente activo entregada por el backend. Se cachea durante
   * la sesión del panel y se refresca con cada respuesta (por si la rotación de
   * turno cambia el asistente mientras el chat sigue abierto). `null` hasta la
   * primera respuesta → la UI usa el nombre/avatar de respaldo ("Soporte").
   */
  const [assistant, setAssistant] = React.useState<AssistantIdentity | null>(null);
  /** Acciones ya consumidas (click hecho) — `${localId}:${actionIdx}`. */
  const [consumed, setConsumed] = React.useState<Set<string>>(() => new Set());
  // ── Hub: panel activo (chat / tickets / detalle / nuevo) ──────────────────
  const [hubPanel, setHubPanel] = React.useState<HubPanel>("chat");
  const [activeTicketId, setActiveTicketId] = React.useState<string | null>(null);
  const [ticketsReloadKey, setTicketsReloadKey] = React.useState(0);
  // Nº de tareas en background terminadas y no leídas (badge del botón "Tareas").
  const [tasksUnread, setTasksUnread] = React.useState(0);
  const [chatAttachments, setChatAttachments] = React.useState<TicketAttachment[]>([]);
  const [chatUploading, setChatUploading] = React.useState(false);
  const chatFileRef = React.useRef<HTMLInputElement>(null);
  const tk = ticketStrings(language);
  const listRef = React.useRef<HTMLDivElement>(null);
  // Id de conversación para la compactación por tokens del backend.
  const conversationIdRef = React.useRef<string>(
    `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
  );

  const goPanel = React.useCallback((p: HubPanel, ticketId?: string) => {
    if (ticketId) setActiveTicketId(ticketId);
    setHubPanel(p);
  }, []);
  const refreshTickets = React.useCallback(() => setTicketsReloadKey((k) => k + 1), []);

  React.useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  // Al abrir el panel (este componente solo se monta con el drawer abierto)
  // pedimos la identidad del asistente activo (Opción A del contrato) para
  // pintar nombre+avatar de inmediato, sin esperar a la primera respuesta. La
  // respuesta del chat (Opción B) la confirma/actualiza después. Resiliente:
  // si falla, `assistant` queda en null y la UI usa el respaldo ("Soporte").
  React.useEffect(() => {
    let alive = true;
    void getSupportAssistantIdentity(token).then((id) => {
      if (alive && id) setAssistant(id);
    });
    return () => {
      alive = false;
    };
  }, [token]);

  // Al montar el panel (solo se monta con el drawer abierto) consulta cuántas
  // tareas en background terminaron sin leer (badge del botón "Tareas").
  React.useEffect(() => {
    let alive = true;
    void getAssistantTasks(token)
      .then((res) => { if (alive) setTasksUnread(res.unread); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [token]);

  const send = React.useCallback(async () => {
    const text = input.trim();
    const atts = chatAttachments;
    if ((!text && atts.length === 0) || loading) return;
    setError(null);
    const next: ChatMessage[] = [
      ...messages,
      { role: "user", content: text, localId: newLocalId(), attachments: atts.length ? atts : undefined },
    ];
    setMessages(next);
    setInput("");
    setChatAttachments([]);
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
          // El desktop no puede correr los tours driver.js del portal, así que
          // pide al backend que no proponga tutoriales (ni botones ni texto).
          client: "desktop",
        }),
      });
      if (res.ok && res.data?.reply) {
        // Cachea/actualiza la identidad del asistente activo del backend.
        if (res.data.assistant?.name) setAssistant(res.data.assistant);
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
      const msg = err instanceof Error ? err.message : labels.connectionError;
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, input, loading, messages, language, labels.responseError, labels.connectionError, chatAttachments]);

  // Sube imágenes del input del chat a /support/upload y las deja pendientes para
  // enviarlas con el siguiente mensaje (el modelo las "ve" vía visión).
  const onPickChatFiles = React.useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setChatUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (chatAttachments.length >= 5) break;
        const a = await uploadTicketAttachment(file, token).promise;
        setChatAttachments((prev) => [...prev, a]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.connectionErrorShort);
    } finally {
      setChatUploading(false);
      if (chatFileRef.current) chatFileRef.current.value = "";
    }
  }, [chatAttachments.length, token, labels.connectionErrorShort]);

  /**
   * Maneja el click sobre una acción del bot:
   * - `navigate` / `open_modal`: se delegan al host (`onAction`), que las
   *   traduce a la navegación interna del cliente (ir a una vista / abrir un
   *   modal). Las acciones no mapeables (p. ej. tutoriales) las ignora el host.
   * - `confirm_mutation`: se POSTea el token a `/portal/support/chat/confirm` y
   *   el resultado se inyecta como un nuevo mensaje del asistente.
   */
  const handleAction = React.useCallback(
    (action: ChatAction, key: string) => {
      setConsumed((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      // Deep-links a los panels del hub (in-drawer). Ya no se delega al host.
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
            const ok = !!res.ok;
            if (ok) refreshTickets();
            const text = ok
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
    ],
  );

  return (
    <section className="support-chat-panel" role="dialog" aria-label={labels.title}>
          <header className="support-chat-panel__head">
            {hubPanel !== "chat" ? (
              <button
                type="button"
                className="support-chat-panel__close"
                onClick={() => goPanel(hubPanel === "ticket" || hubPanel === "new" ? "tickets" : "chat")}
                aria-label={tk.back}
                title={tk.back}
              >
                <ArrowLeft size={18} aria-hidden="true" className="lp-rtl-flip" />
              </button>
            ) : null}
            <span className="support-chat-panel__title">
              {hubPanel === "chat" ? (
                <>
                  {/* Nombre del asistente ACTIVO (backend); respaldo "Soporte". */}
                  {assistant?.avatarUrl ? (
                    <img
                      src={resolveAvatarUrl(assistant.avatarUrl)}
                      alt={assistant.name || labels.assistantFallbackName}
                      className="support-chat-panel__title-avatar"
                    />
                  ) : (
                    <MessageCircle size={16} aria-hidden="true" />
                  )}
                  {assistant?.name || labels.assistantFallbackName}
                </>
              ) : (
                <span>{hubPanel === "tickets" ? tk.myTickets : hubPanel === "new" ? tk.newTicket : hubPanel === "tasks" ? tk.tasks : tk.support}</span>
              )}
            </span>
            {hubPanel === "chat" ? (
              <>
              <button
                type="button"
                className="support-chat-panel__tickets-btn"
                onClick={() => goPanel("tasks")}
                aria-label={tk.tasks}
                title={tk.tasks}
              >
                <ListChecks size={16} aria-hidden="true" />
                <span>{tk.tasks}</span>
                {tasksUnread > 0 ? (
                  <span className="badge badge-error badge-xs ms-1">{tasksUnread}</span>
                ) : null}
              </button>
              <button
                type="button"
                className="support-chat-panel__tickets-btn"
                onClick={() => goPanel("tickets")}
                aria-label={tk.myTickets}
                title={tk.myTickets}
              >
                <LifeBuoy size={16} aria-hidden="true" />
                <span>{tk.myTickets}</span>
              </button>
              </>
            ) : null}
            {onClose ? (
              <button
                type="button"
                className="support-chat-panel__close"
                onClick={onClose}
                aria-label={labels.close}
              >
                <X size={18} aria-hidden="true" />
              </button>
            ) : null}
          </header>

          {hubPanel === "chat" ? (
          <>
          <div className="support-chat-panel__body" ref={listRef}>
            {/* Burbujas con el patrón `chat` de daisyUI:
                https://daisyui.com/components/chat/ — asistente = chat-start
                (con avatar), usuario = chat-end + chat-bubble-primary. */}
            <div className="chat chat-start">
              <AssistantAvatar assistant={assistant} altFallback={labels.avatarAlt} />
              <div className="chat-bubble support-chat-bubble">{labels.welcome}</div>
            </div>
            {messages.slice(-10).map((m, i) => {
              const key = m.localId ?? `idx-${i}`;
              const isUser = m.role === "user";
              return (
                <div key={key} className={`chat ${isUser ? "chat-end" : "chat-start"}`}>
                  {!isUser && (
                    <AssistantAvatar assistant={assistant} altFallback={labels.avatarAlt} />
                  )}
                  <div className={`chat-bubble support-chat-bubble${isUser ? " chat-bubble-primary" : ""}`}>
                    {m.content ? <span>{m.content}</span> : null}
                    {m.attachments?.length ? (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {m.attachments.map((a, idx) => (
                          <a key={`${a.url}-${idx}`} href={a.url} target="_blank" rel="noopener noreferrer">
                            <img src={a.url} alt={a.name ?? ""} className="h-20 w-20 rounded object-cover" loading="lazy" />
                          </a>
                        ))}
                      </span>
                    ) : null}
                  </div>
                  {!isUser && m.actions && m.actions.length > 0 && (
                    <div
                      className="chat-footer support-chat-msg__actions"
                      role="group"
                      aria-label={labels.suggestedActions}
                    >
                      {m.actions.map((a, idx) => {
                        const actionKey = `${key}:${idx}`;
                        const isConsumed = consumed.has(actionKey);
                        if (a.type === "client_action") {
                          return (
                            <AssistantActionCard
                              key={actionKey}
                              action={a}
                              token={token}
                              language={language}
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
                        const modifier =
                          a.type === "confirm_mutation"
                            ? "support-chat-msg__action--confirm"
                            : "support-chat-msg__action--nav";
                        return (
                          <button
                            key={actionKey}
                            type="button"
                            className={`support-chat-msg__action ${modifier}`}
                            disabled={isConsumed}
                            onClick={() => handleAction(a, actionKey)}
                          >
                            <span>{a.label}</span>
                            <ArrowRight size={14} aria-hidden="true" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {loading && (
              <div className="chat chat-start" aria-label={labels.typing}>
                <AssistantAvatar assistant={assistant} altFallback={labels.avatarAlt} />
                <div className="chat-bubble support-chat-bubble support-chat-typing">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            {error && <div className="support-chat-error">{error}</div>}
          </div>

          {chatAttachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 pt-2">
              {chatAttachments.map((a, i) => (
                <span key={`${a.url}-${i}`} className="badge badge-outline gap-1 py-3">
                  <span className="max-w-32 truncate">{a.name ?? a.url.split("/").pop()}</span>
                  <button type="button" onClick={() => setChatAttachments((prev) => prev.filter((_, idx) => idx !== i))} aria-label={tk.delete}>
                    <X size={12} aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <form
            className="support-chat-panel__input"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input ref={chatFileRef} type="file" accept="image/*" multiple hidden onChange={(e) => void onPickChatFiles(e.target.files)} />
            <button
              type="button"
              className="support-chat-attach-btn"
              onClick={() => chatFileRef.current?.click()}
              disabled={chatUploading || chatAttachments.length >= 5}
              aria-label={tk.attach}
              title={tk.attach}
            >
              <Paperclip size={18} aria-hidden="true" />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={labels.placeholder}
              rows={1}
              maxLength={4000}
              aria-label={labels.placeholder}
            />
            <button type="submit" disabled={loading || (!input.trim() && chatAttachments.length === 0)} aria-label={labels.send}>
              <Send size={18} aria-hidden="true" />
            </button>
          </form>
          </>
          ) : hubPanel === "tickets" ? (
            <TicketListPanel
              token={token}
              language={language}
              reloadKey={ticketsReloadKey}
              onOpenTicket={(id) => goPanel("ticket", id)}
              onNewTicket={() => goPanel("new")}
            />
          ) : hubPanel === "ticket" && activeTicketId ? (
            <TicketDetailPanel
              token={token}
              language={language}
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
              onCreated={(id) => {
                refreshTickets();
                goPanel("ticket", id);
              }}
            />
          ) : hubPanel === "tasks" ? (
            <TasksPanel token={token} language={language} onUnreadChange={setTasksUnread} />
          ) : null}
    </section>
  );
}
