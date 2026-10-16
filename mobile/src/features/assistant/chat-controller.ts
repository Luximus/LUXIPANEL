// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

/**
 * Controller MODULE-LEVEL del chat del asistente (fase A4, la crítica).
 *
 * Todas las operaciones del chat (enviar/parar/abrir hilo/cola FIFO/adjuntos/
 * conectores/voz/compactar/recovery de runs) viven aquí como funciones de
 * módulo invocables SIN el chat montado. El stream SSE escribe en
 * `chat-store.ts`, así que sobrevive al desmontaje del pane/pantalla: navegar
 * en mitad de un run ya no pierde la respuesta (requisito de la fase B).
 *
 * El pane (y en A5 la ChatScreen) solo ORQUESTA: configura el token, dispara
 * los refresh* desde sus effects y renderiza lo que el store publica. El puente
 * Los consumidores (ChatScreen, ChatComposer, drawers) lo invocan directo (A5).
 */

import { voiceInputLocked, onVoiceInputUnlocked } from "./input-lock";
import { stopRealtimeVoice } from "./realtime-voice";
import {
  getServerAssistantProviders,
  luxAssistantProxy,
  luxAssistantProxyOk,
  streamServerAssistant,
  type AssistantEvent,
} from "../../api/client";
import { loadChatSession, saveChatSession } from "../../lib/chat-session-store";
import { registerStoreReset } from "../../lib/store-reset";
import { applyAssistantEvent, eventSignalsMcpExpired } from "./stream-reducer";
import { startMcpRecovery } from "./mcp-recovery";
import { chatStore } from "./chat-store";
import { mapStoredMessages, type StoredMessagesResponse } from "./conversations";
import { mergeAttachments, MAX_TOTAL_ATTACHMENT_BASE64 } from "./attachment-limits";
import { buildOutgoingHistory } from "./outgoing-history";
import { composerImageSupported, resolvePreferredProvider, type ActiveProviderConfig } from "./providers";
import { deleteLocalFile, guessMime, pickDocuments, readClipboardImage, type LocalFileAttachment } from "./attachments";
import type { AssistantContextWindow, ChatAttachment, ChatMsg, ComposerConnector, ConnectorBrowseItem, Project } from "./types";

// ─── Runtime por panel (no reactivo: cerrojos, abort, secuencias) ────────────

type UiHandlers = {
  /** Abre el terminal nativo (chip "Terminal" del composer); lo registra el pane. */
  terminal?: () => void;
};

type ChatOptions = {
  provider?: string; model?: string; effort?: "" | "low" | "medium" | "high" | "xhigh";
  approvalMode?: "manual" | "auto" | "plan";
};
type PanelRuntime = {
  stopMcpRecovery?: () => void;
  loadingOptions?: boolean;
  optionsError?: boolean;
  optionWrites?: Promise<boolean>;
  optionWritesByConversation?: Map<string, Promise<boolean>>;
  token: string;
  /** Cerrojo síncrono anti doble-envío: `busy` (store) se propaga async y dos
   *  envíos seguidos colarían dos consultas antes del re-render. */
  sending: boolean;
  abort: (() => void) | null;
  /** "Editar" en curso: el próximo envío descarta el par parado (usuario +
   *  asistente) antes de despachar (paridad web `editPendingTrim`). */
  editPendingTrim: boolean;
  providersLoaded: boolean;
  diskRestoreAttempted: boolean;
  /** Último token con el que se cargaron los conectores (recarga si cambia). */
  connectorsToken: string | null;
  /** Secuencias anti-stale de los sondeos (solo aplica la última). */
  runMetaSeq: number;
  convMetaSeq: number;
  openSeq: number;
  cfgSeq: number;
  /** Generación del stream activo: abrir otro hilo / chat nuevo la bumpea y el
   *  asentado del stream viejo deja de tocar mensajes/notice del hilo NUEVO. */
  streamSeq: number;
  /** Conversaciones con un sondeo de recuperación EN CURSO: reabrir el hilo (o
   *  compactar) lanzaba un segundo bucle sobre la misma y ambos se pisaban. */
  recovering: Set<string>;
  ui: UiHandlers;
};

const runtimes = new Map<string, PanelRuntime>();

// Logout / cambio de cuenta: aborta TODOS los streams en curso (el XHR se
// cierra y `send` asienta sin redespachar: la cola vive en chat-store, que se
// vacía en su propio reset) y descarta los runtimes (token del usuario saliente,
// cerrojos, gates de providers/disco). El chat-store registra su reset aparte.
registerStoreReset(() => {
  for (const r of runtimes.values()) {
    r.stopMcpRecovery?.();
    r.abort?.();
    r.abort = null;
  }
  runtimes.clear();
});

function rt(panelId: string): PanelRuntime {
  let r = runtimes.get(panelId);
  if (!r) {
    r = {
      token: "", sending: false, abort: null, editPendingTrim: false,
      providersLoaded: false, diskRestoreAttempted: false, connectorsToken: null,
      runMetaSeq: 0, convMetaSeq: 0, openSeq: 0, cfgSeq: 0, streamSeq: 0, recovering: new Set(),
      ui: {},
    };
    runtimes.set(panelId, r);
  }
  return r;
}

/** Persiste A DISCO el hilo activo (conversación + proveedor) para reabrirlo
 *  tras un cierre total del SO. En background normal basta el store en memoria. */
function persist(panelId: string): void {
  const r = rt(panelId);
  if (!r.token) return;
  const { conversationId, provider } = chatStore.getSession(panelId);
  void saveChatSession(panelId, { conversationId, provider });
}

// ─── Configuración / ciclo de vida ───────────────────────────────────────────

function configure(panelId: string, opts: { token: string }): void {
  const r = rt(panelId);
  if (r.token && r.token !== opts.token) void stopRealtimeVoice();
  r.token = opts.token;
  // Conectores Office: una carga por panel/token (antes: effect del pane).
  if (opts.token && r.connectorsToken !== opts.token) {
    r.connectorsToken = opts.token;
    void loadConnectors(panelId);
  }
}

/** El pane registra sus aperturas de UI (terminal). Devuelve el cleanup. */
function registerUiHandlers(panelId: string, handlers: UiHandlers): () => void {
  const r = rt(panelId);
  r.ui = handlers;
  return () => { if (r.ui === handlers) r.ui = {}; };
}

function openTerminal(panelId: string): void {
  rt(panelId).ui.terminal?.();
}

/**
 * Restauración tras CIERRE TOTAL del SO: si el panel no tiene chat en memoria
 * pero sí un hilo persistido a disco, lo reabre automáticamente — el usuario lo
 * encuentra tal cual lo dejó. Un solo intento por proceso (el store en memoria
 * cubre los cambios de pestaña / background normal).
 */
function ensureDiskRestore(panelId: string): void {
  const r = rt(panelId);
  if (r.diskRestoreAttempted || !r.token) return;
  r.diskRestoreAttempted = true;
  const hasState = chatStore.getChat(panelId).messages.length > 0 ||
    chatStore.getComposer(panelId).started ||
    chatStore.getSession(panelId).conversationId !== null;
  if (hasState) return;
  void loadChatSession(panelId).then((sess) => {
    if (!sess?.conversationId) return;
    if (chatStore.getChat(panelId).messages.length > 0) return; // llegó algo mientras leíamos
    if (sess.provider) chatStore.patchSession(panelId, { provider: sess.provider });
    chatStore.setStarted(panelId, true);
    openConversation(panelId, sess.conversationId);
  });
}

// ─── Proveedores ─────────────────────────────────────────────────────────────

/** Carga los proveedores usables (una vez por panel) y fija el preferido. */
function loadProviders(panelId: string): void {
  const r = rt(panelId);
  if (r.providersLoaded || !r.token) return;
  r.providersLoaded = true;
  void (async () => {
    const res = await getServerAssistantProviders(panelId, r.token).catch(() => null);
    // Fallo transitorio (red / túnel caído): revierte el cerrojo o el panel se
    // queda SIN proveedores para siempre (selector vacío y fallback duro a
    // "claude"); así el próximo montaje del chat lo reintenta.
    if (!res) { r.providersLoaded = false; return; }
    chatStore.patchSession(panelId, { providers: res.providers });
    let defaultChatProvider: string | undefined;
    try {
      const cfg = await luxAssistantProxy<{ config?: { defaultChatProvider?: string } }>(
        panelId, r.token, "GET", "/api/ai/config",
      );
      defaultChatProvider = cfg?.config?.defaultChatProvider || undefined;
    } catch { /* sin default de chat → cae a activeProvider */ }
    if (chatStore.getSession(panelId).conversationId) return;
    setProvider(panelId, resolvePreferredProvider({
      current: chatStore.getSession(panelId).provider,
      defaultChatProvider,
      activeProvider: res.activeProvider,
      providers: res.providers,
    }));
  })();
}

/** Cambia el proveedor del chat abierto y guarda solo sus opciones. */
function setProvider(panelId: string, provider: string): void {
  if (chatStore.getSession(panelId).provider === provider) return;
  void setOptions(panelId, { provider, model: "", effort: "" });
  void refreshProviderConfig(panelId);
}

/** Persist only explicit composer edits, bound to the captured conversation. */
async function setOptions(panelId: string, patch: ChatOptions): Promise<boolean> {
  const r = rt(panelId), session = chatStore.getSession(panelId);
  if (r.loadingOptions) return false;
  const id = session.conversationId, token = r.token;
  const { approvalMode, effort, ...rest } = patch;
  chatStore.patchSession(panelId, { ...rest, ...(effort !== undefined ? { effort: effort || undefined } : {}) });
  if (approvalMode) chatStore.patchComposer(panelId, { approvalMode });
  persist(panelId);
  if (!id) return true;
  const writes = r.optionWritesByConversation ??= new Map();
  const write = (writes.get(id) ?? Promise.resolve(true)).then(async () => {
    if (runtimes.get(panelId) !== r || r.token !== token) return false;
    const res = await luxAssistantProxy<{ conversation?: { id?: string } }>(panelId, token, "PATCH", `/api/ai/conversations/${encodeURIComponent(id)}`, patch).catch(() => null);
    const ok = Boolean(res?.conversation);
    if (runtimes.get(panelId) === r && chatStore.getSession(panelId).conversationId === id) {
      r.optionsError = !ok;
      if (!ok) chatStore.patchChat(panelId, { notice: { kind: "error" } });
    }
    return ok;
  });
  r.optionWrites = write;
  writes.set(id, write);
  void write.then(() => { if (writes.get(id) === write) writes.delete(id); });
  return write;
}

/** Fija el hilo activo y lo persiste a disco. */
function setConversationId(panelId: string, conversationId: string | null): void {
  if (chatStore.getSession(panelId).conversationId !== conversationId) {
    rt(panelId).stopMcpRecovery?.();
    chatStore.patchComposer(panelId, { mcpExpired: false });
  }
  chatStore.patchSession(panelId, { conversationId });
  persist(panelId);
}

/** Config del proveedor activo (modo API/CLI + modelo): alimenta el chip de la
 *  cabecera, la barra "USO CLI" y el soporte de imágenes del composer. */
async function refreshProviderConfig(panelId: string): Promise<void> {
  const r = rt(panelId);
  const seq = ++r.cfgSeq;
  const { provider } = chatStore.getSession(panelId);
  const started = chatStore.getComposer(panelId).started;
  const apply = (cfg: ActiveProviderConfig | null): void => {
    if (seq !== r.cfgSeq) return;
    chatStore.patchChat(panelId, { activeProviderCfg: cfg });
    chatStore.patchComposer(panelId, { imageAttachSupported: composerImageSupported(provider, cfg) });
  };
  if (!r.token || !provider || !started) { apply(null); return; }
  const body = await luxAssistantProxy<{ config?: { providers?: Record<string, { mode: "api" | "cli"; api?: { model?: string }; cli?: { model?: string } }> } }>(
    panelId, r.token, "GET", "/api/ai/config",
  );
  const ps = body?.config?.providers?.[provider];
  if (!ps) { apply(null); return; }
  apply({ mode: ps.mode, model: ps.mode === "cli" ? (ps.cli?.model ?? "") : (ps.api?.model ?? "") });
}

// ─── Conversaciones ──────────────────────────────────────────────────────────

function fetchStoredMessages(panelId: string, convId: string): Promise<StoredMessagesResponse> {
  return luxAssistantProxy<Exclude<StoredMessagesResponse, null>>(
    panelId, rt(panelId).token, "GET",
    `/api/ai/conversations/${encodeURIComponent(convId)}/messages?limit=50&offset=0`,
  );
}

/**
 * Abre un hilo existente: pinta el skeleton, carga los mensajes persistidos y,
 * si el hilo tiene un run VIVO sin transmitirse aquí (iniciado en web/desktop o
 * tras un drop de red), muestra el turno "ejecutándose en el servidor" y sondea
 * hasta traer la respuesta (attach al run desacoplado; el stream en vivo
 * línea-a-línea requeriría `agent/stream` en el allowlist del proxy — backend).
 */
function openConversation(panelId: string, id: string): void {
  if (chatStore.getSession(panelId).conversationId !== id) void stopRealtimeVoice();
  const r = rt(panelId);
  if (!r.token) return;
  const prevConv = chatStore.getSession(panelId).conversationId;
  // El hilo que ya se está transmitiendo AQUÍ: no lo re-abras por encima de su
  // propio stream (borraría el turno en vivo con el skeleton).
  if (prevConv === id && chatStore.getComposer(panelId).busy) return;
  const openSeq = ++r.openSeq;
  r.loadingOptions = true;
  r.optionsError = false;
  r.optionWrites = undefined;
  // Cambio REAL de hilo: los borradores del saliente (adjuntos preparados, cola
  // FIFO, "editar" pendiente) no deben viajar al entrante, y el stream local en
  // curso se DESLIGA (el run desacoplado sigue en el servidor; su asentado ya no
  // toca los mensajes/notice del hilo nuevo gracias a `streamSeq`).
  if (prevConv !== id) {
    discardThreadDrafts(panelId);
    r.streamSeq++;
    r.abort?.();
    r.abort = null;
    r.sending = false;
    chatStore.setBusy(panelId, false, null);
  }
  // Abrir un hilo existente desliga el agente "recién elegido" (su banner solo
  // aplica a un chat nuevo ligado a ese agente) y el proyecto pendiente.
  chatStore.patchSession(panelId, { agentId: null, agentName: null, projectId: null, model: "", effort: undefined });
  chatStore.patchComposer(panelId, { approvalMode: "manual" });
  setConversationId(panelId, id);
  // Un error del hilo anterior pertenece a ese hilo. Sin limpiar el aviso,
  // aparecía "Error" al abrir cualquier otra conversación incluso si cargaba.
  chatStore.patchChat(panelId, { notice: null, activeProject: null });
  chatStore.setStarted(panelId, true);
  chatStore.setMessages(panelId, [{ role: "assistant", content: "", pending: true, tools: [] }]);
  chatStore.bumpScroll(panelId);
  void (async () => {
    const pendingOptions = r.optionWritesByConversation?.get(id);
    if (pendingOptions) await pendingOptions;
    if (openSeq !== r.openSeq || runtimes.get(panelId) !== r) return;
    const [stored, metaRes] = await Promise.all([
      fetchStoredMessages(panelId, id),
      luxAssistantProxy<{ conversation?: ChatOptions & { projectId?: string | null; agentId?: string | null } }>(panelId, r.token, "GET", `/api/ai/conversations/${encodeURIComponent(id)}`).catch(() => null),
    ]);
    // El usuario cambió de hilo mientras cargábamos → no clobbees el nuevo.
    if (openSeq !== r.openSeq || chatStore.getSession(panelId).conversationId !== id) return;
    // Fallo del proxy/red al leer los mensajes: aviso visible en vez de dejar
    // el skeleton eterno o un chat vacío mudo (parecía que el hilo se borró).
    const meta = metaRes?.conversation;
    if (!stored || !meta) {
      r.optionsError = true;
      r.loadingOptions = false;
      chatStore.setMessages(panelId, []);
      chatStore.patchChat(panelId, { notice: { kind: "error" } });
      return;
    }
    chatStore.patchSession(panelId, {
      provider: meta.provider ?? "", model: meta.model ?? "", effort: meta.effort || undefined,
      projectId: meta.projectId ?? null, agentId: meta.agentId ?? null,
    });
    chatStore.patchComposer(panelId, { approvalMode: meta.approvalMode ?? "manual" });
    r.loadingOptions = false;
    persist(panelId);
    void refreshProviderConfig(panelId);
    const mapped = mapStoredMessages(stored);
    chatStore.setMessages(panelId, mapped);
    chatStore.bumpScroll(panelId);
    const last = mapped[mapped.length - 1];
    if (last && last.role === "assistant" && last.content) return;
    const act = await luxAssistantProxy<{ runs?: Array<{ id?: string }> }>(
      panelId, r.token, "GET", "/api/ai/agent/active",
    );
    const runs = Array.isArray(act?.runs) ? act.runs : [];
    if (!runs.some((x) => x?.id === id)) return;
    if (openSeq !== r.openSeq || chatStore.getSession(panelId).conversationId !== id) return;
    chatStore.setMessages(panelId, [...mapped, { role: "assistant", content: "", interrupted: true, tools: [], createdAt: Date.now() }]);
    void recoverInterruptedTurn(panelId, id);
  })();
}

/** Pull-to-refresh del chat: re-lee los mensajes del hilo activo SIN resetear
 *  el agente ni pintar el skeleton (a diferencia de `openConversation`). */
async function reloadMessages(panelId: string): Promise<void> {
  const r = rt(panelId);
  const id = chatStore.getSession(panelId).conversationId;
  if (!r.token || !id || chatStore.getComposer(panelId).busy) return;
  const mapped = mapStoredMessages(await fetchStoredMessages(panelId, id));
  if (chatStore.getSession(panelId).conversationId !== id) return;
  if (mapped.length > 0) chatStore.setMessages(panelId, mapped);
}

/**
 * Recupera un turno cuyo STREAM se cayó (drop de red/idle en móvil) pero cuyo
 * run es DESACOPLADO y sigue vivo/persistiendo en el servidor: sondea el hilo
 * (3s × 20) hasta que la respuesta quede persistida y entonces la pinta, SIN
 * borrar el turno interrumpido mientras tanto. Paridad web (`streamAgentResume`).
 *
 * Un solo sondeo POR CONVERSACIÓN (`recovering`): reabrir el hilo o compactar
 * mientras el bucle vivía lanzaba un segundo sondeo sobre la misma conversación
 * y ambos se pisaban el transcript.
 */
async function recoverInterruptedTurn(panelId: string, convId: string): Promise<void> {
  const r = rt(panelId);
  if (!r.token || !convId || r.recovering.has(convId)) return;
  r.recovering.add(convId);
  try {
    for (let attempt = 0; attempt < 20; attempt++) {
      await new Promise((res) => setTimeout(res, 3000));
      // El usuario ya empezó otro envío / cambió de hilo → deja de sondear.
      if (r.sending || chatStore.getSession(panelId).conversationId !== convId) return;
      const mapped = mapStoredMessages(await fetchStoredMessages(panelId, convId));
      // Solo reemplaza cuando la RESPUESTA del asistente ya está persistida (último
      // turno = asistente con contenido). Si no, sigue esperando con el turno
      // "interrumpido" a la vista en lugar de dejar solo el mensaje del usuario.
      const last = mapped[mapped.length - 1];
      if (last && last.role === "assistant" && last.content) {
        chatStore.setMessages(panelId, mapped);
        chatStore.bumpScroll(panelId);
        return;
      }
    }
    // Agotado el sondeo (~60s): el turno NO puede quedarse `interrupted` para
    // siempre (el header anunciaría "ejecutándose en el servidor" eternamente y
    // el chat nunca cerraría el turno). Estado TERMINAL + aviso de error para
    // que el usuario reintente o recargue el hilo.
    if (chatStore.getSession(panelId).conversationId !== convId) return;
    chatStore.setMessages(panelId, (prev) => prev.map((m) =>
      (m.interrupted ? { ...m, interrupted: undefined, stopped: true } : m)));
    chatStore.patchChat(panelId, { notice: { kind: "error" } });
  } finally {
    r.recovering.delete(convId);
  }
}

/** Descarta los borradores ligados al hilo saliente: adjuntos preparados, cola
 *  FIFO y el "editar" pendiente. Sin esto viajaban al hilo entrante (un adjunto
 *  preparado en A se enviaba con el siguiente mensaje de B). */
function discardThreadDrafts(panelId: string): void {
  const r = rt(panelId);
  r.editPendingTrim = false;
  if (chatStore.getComposer(panelId).queued.length > 0) chatStore.patchComposer(panelId, { queued: [] });
  if (chatStore.getChat(panelId).attachments.length > 0) chatStore.setAttachments(panelId, []);
}

/** Descarta el hilo activo y arranca un chat nuevo (aborta el stream local).
 *  `projectId` liga el chat nuevo a una carpeta de proyecto ("+" del drawer). */
function newConversation(panelId: string, opts?: { projectId?: string }): void {
  void stopRealtimeVoice();
  const r = rt(panelId);
  r.openSeq++;
  r.loadingOptions = false;
  r.optionsError = false;
  r.optionWrites = undefined;
  discardThreadDrafts(panelId);
  r.streamSeq++;
  r.abort?.();
  r.abort = null;
  r.sending = false;
  chatStore.setBusy(panelId, false, null);
  chatStore.patchSession(panelId, { projectId: opts?.projectId ?? null, agentId: null, agentName: null, model: "", effort: undefined });
  chatStore.patchComposer(panelId, { approvalMode: "manual" });
  setConversationId(panelId, null);
  chatStore.setMessages(panelId, []);
  chatStore.patchChat(panelId, { notice: null, activeProject: null });
}

/** Vuelve a la PORTADA: limpia el chat y marca el panel como no-iniciado (lo usa
 *  la búsqueda del navbar para sacar al usuario de una conversación activa). */
function coverConversation(panelId: string): void {
  newConversation(panelId);
  chatStore.setStarted(panelId, false);
}

/** El usuario pulsó "Empezar conversación" en la portada. */
function startChat(panelId: string): void {
  chatStore.setStarted(panelId, true);
}

// ─── Envío / stream ──────────────────────────────────────────────────────────

/**
 * Despacha un turno. Sin `opts` toma el borrador del composer y consume los
 * adjuntos preparados. Con `opts.text` el texto viene DADO (respuesta rápida,
 * voz transcrita, reintento) y el borrador del composer NO se toca — antes se
 * sembraba en el input y machacaba lo que el usuario tuviera escrito.
 * `opts.keepAttachments` deja intactos los adjuntos preparados (envíos rápidos:
 * no deben arrastrar un adjunto que el usuario preparó para OTRO mensaje).
 */
async function send(panelId: string, opts?: { text?: string; keepAttachments?: boolean; planDecision?: "approve"; voiceInput?: boolean }): Promise<void> {
  if (voiceInputLocked(panelId) && !opts?.voiceInput && !opts?.planDecision) return;
  const r = rt(panelId);
  if (!r.token) return;
  if (r.loadingOptions || r.optionsError) return;
  const conversationAtSend = chatStore.getSession(panelId).conversationId;
  if (r.optionWrites) {
    if (!await r.optionWrites || runtimes.get(panelId) !== r || chatStore.getSession(panelId).conversationId !== conversationAtSend) return;
  }
  const composer = chatStore.getComposer(panelId);
  // Panel bloqueado (SSH caído / sin credenciales): ni despachar ni encolar.
  if (composer.blocked) return;
  const override = typeof opts?.text === "string";
  const text = (override ? opts.text! : composer.input).trim();
  // Run en curso: encola el mensaje (FIFO) en vez de descartarlo (paridad con
  // la web). Los chips numerados del navbar permiten editarlo/quitarlo; se
  // despacha solo (texto) al terminar el run actual.
  if (composer.busy || r.sending) {
    if (text) {
      chatStore.patchComposer(panelId, {
        queued: [...composer.queued, text],
        // El texto dado no salió del composer: no vacíes el borrador ajeno.
        ...(override ? {} : { input: "" }),
      });
    }
    return;
  }
  const keepAtts = opts?.keepAttachments === true;
  const atts = keepAtts ? [] : chatStore.getChat(panelId).attachments;
  if (!text && atts.length === 0) return;
  r.sending = true;
  const seq = ++r.streamSeq;
  chatStore.patchComposer(panelId, { mcpExpired: false, ...(override ? {} : { input: "" }) });
  chatStore.patchChat(panelId, { notice: null });
  if (!keepAtts) chatStore.setAttachments(panelId, []);
  const attLabel = atts.map((a) => a.name).join(", ");
  // Envío desde "Editar": descarta el turno de asistente parado y el mensaje de
  // usuario que lo originó, para que el mensaje editado los reemplace (paridad
  // web `chatEngine.popTurns(key, 2)`).
  const trim = r.editPendingTrim;
  r.editPendingTrim = false;
  const base = (() => {
    const cur = chatStore.getChat(panelId).messages;
    if (!trim) return cur;
    const b = [...cur];
    if (b.length && b[b.length - 1]?.role === "assistant") b.pop();
    if (b.length && b[b.length - 1]?.role === "user") b.pop();
    return b;
  })();
  // Historial ACOTADO (ventana + recorte + sin turnos vacíos): el hilo entero
  // reventaba los límites del gateway LP en conversaciones largas (400
  // "Parámetros inválidos") y el mensaje nunca llegaba al agente.
  const history = buildOutgoingHistory(
    base.filter((m) => !m.pending).map(({ role, content }) => ({ role, content })),
    text || attLabel,
  );
  const startedAt = Date.now();
  const sendingProvider = chatStore.getSession(panelId).provider || "claude";
  chatStore.setMessages(panelId, [
    ...base.filter((m) => !m.pending),
    {
      role: "user", content: text, provider: sendingProvider,
      attachmentName: attLabel || undefined,
      attachments: atts.map((a) => ({ name: a.name, mimeType: a.mime, url: `data:${a.mime};base64,${a.dataBase64}` })),
      createdAt: startedAt,
    },
    { role: "assistant", content: "", provider: sendingProvider, pending: true, tools: [], createdAt: startedAt },
  ]);
  chatStore.setBusy(panelId, true, startedAt);
  chatStore.bumpScroll(panelId);
  // Chat NUEVO: crea la conversación etiquetada con el proveedor activo ANTES
  // de stremear (igual que la web). Sin `conversationId` el backend de
  // LUXIPANEL usa el path legacy efímero (no persiste); con él entra al path
  // "decoupled" que guarda el hilo y lo deja visible en la lista filtrada por
  // proveedor. Best-effort: si falla la creación, se streamea igual (efímero).
  const session = chatStore.getSession(panelId);
  let convId = session.conversationId;
  if (!convId) {
    // VENTANA CIEGA de la creación: durante este await no hay stream registrado,
    // así que `stopStream` / cambiar de hilo abortaban un `r.abort` nulo (no-op)
    // y al volver el POST se fijaba la conversación del turno viejo sobre el hilo
    // NUEVO. Un abort provisional cierra la ventana.
    let cancelled = false;
    const provisional = (): void => { cancelled = true; };
    r.abort = provisional;
    const created = await luxAssistantProxy<{ conversation?: { id?: string } }>(
      panelId, r.token, "POST", "/api/ai/conversations",
      // firstMessage solo siembra el título; recortado (upstream lo capa a 8192).
      {
        provider: session.provider || "claude",
        model: session.model ?? "", effort: session.effort ?? "",
        approvalMode: chatStore.getComposer(panelId).approvalMode,
        firstMessage: (text || attLabel).slice(0, 2000) || undefined,
        agentId: session.agentId ?? undefined,
        // Chat nacido del "+" de una carpeta de proyecto: nace ya ligado a ella.
        projectId: session.projectId ?? undefined,
      },
    );
    if (r.abort === provisional) r.abort = null;
    const staleNow = seq !== r.streamSeq;
    if (staleNow || cancelled) {
      if (!staleNow) {
        r.sending = false;
        chatStore.setBusy(panelId, false, null);
      }
      // Parado en la ventana (mismo hilo): asienta el turno para que no se quede
      // pendiente eternamente. Si el hilo CAMBIÓ, los mensajes ya son de otra
      // conversación → no los toques (ni la sesión: apuntaría a la que se creó).
      if (!staleNow) {
        chatStore.setMessages(panelId, (prev) => prev.map((m) => (m.pending
          ? { ...m, pending: false, stopped: true, durationMs: Date.now() - startedAt, createdAt: m.createdAt ?? startedAt }
          : m)));
      }
      return;
    }
    const newId = created?.conversation?.id;
    if (newId) {
      convId = newId;
      setConversationId(panelId, newId);
      // Refuerzo del ligado a proyecto: si el POST upstream descartara el campo,
      // el PATCH (mismo contrato que rename/pin) lo fija igual. Best-effort.
      if (session.projectId) {
        void luxAssistantProxy(panelId, r.token, "PATCH",
          `/api/ai/conversations/${encodeURIComponent(newId)}`, { projectId: session.projectId });
      }
    }
  }
  let mcpRaw = "";
  let mcpRecoveryStarted = false;
  r.stopMcpRecovery?.();
  const result = await streamServerAssistant(panelId, history, r.token, (ev: AssistantEvent) => {
    // El hilo activo ya no es este (el usuario abrió otro / chat nuevo): los
    // deltas del run viejo NO deben caer en el transcript del hilo nuevo.
    if (seq !== r.streamSeq) return;
    // Marca la alerta de sesión MCP expirada si el agente la emite (en texto,
    // salida de tool o error) — mismo marcador que la web.
    if (ev.type === "text") mcpRaw = (mcpRaw + (ev.delta ?? "")).slice(-65536);
    const mcpEvent = ev.type === "text" ? { ...ev, delta: mcpRaw } : ev;
    if (!mcpRecoveryStarted && eventSignalsMcpExpired(mcpEvent)) {
      mcpRecoveryStarted = true;
      const recoveryToken = r.token;
      r.stopMcpRecovery = startMcpRecovery({
        key: JSON.stringify([panelId, recoveryToken, convId, seq]),
        current: () => runtimes.get(panelId) === r && r.token === recoveryToken && seq === r.streamSeq,
        repair: async () => {
          const data = await luxAssistantProxy<{ ok: boolean; mcpRepairedAt?: string }>(panelId, recoveryToken, "POST", "/api/ai/mcp/repair",
            { conversationId: convId, provider: session.provider || undefined });
          return { ok: data?.ok === true, stamp: data?.mcpRepairedAt };
        },
        recovered: () => chatStore.patchComposer(panelId, { mcpExpired: false }),
        failed: () => chatStore.patchComposer(panelId, { mcpExpired: true }),
      });
    }
    chatStore.setMessages(panelId, (prev) => applyAssistantEvent(prev, ev).msgs);
    // Sin bumpScroll aquí: en CADA delta re-enganchaba el autoscroll al fondo e
    // impedía leer hacia arriba mientras la IA respondía. El pane ya sigue el
    // crecimiento del chat si el usuario está pegado abajo.
  }, {
    provider: session.provider || undefined,
    model: session.model || undefined,
    effort: session.effort,
    agentId: session.agentId || undefined,
    projectId: session.projectId || undefined,
    attachments: atts.length ? atts : undefined,
    conversationId: convId ?? undefined,
    approvalMode: chatStore.getComposer(panelId).approvalMode,
    planDecision: opts?.planDecision,
    register: (abort) => { r.abort = abort; },
  }).catch(() => ({ ok: false as const, code: "ERROR" as const }));
  if (seq === r.streamSeq) {
    r.abort = null;
    r.sending = false;
    chatStore.setBusy(panelId, false, null);
    chatStore.bumpUsageKey(panelId);
  }
  // El usuario abrió OTRO hilo / chat nuevo durante el stream: el hilo actual ya
  // no es este. No toques sus mensajes ni su notice (el run desacoplado sigue en
  // el servidor y se recupera al reabrir aquel hilo); solo drena la cola de abajo.
  const stale = seq !== r.streamSeq;
  if (!stale) {
    const durationMs = Date.now() - startedAt;
    chatStore.setMessages(panelId, (prev) => prev.map((m) => {
      if (!m.pending) return m;
      const tools = m.tools?.map((tool) => tool.done ? tool : { ...tool, done: true, success: false });
      const noAnswer = result.ok && !m.content.trim() && !m.ask?.length && !m.permission && !m.error && !m.stopped;
      return {
        ...m, pending: false, durationMs, createdAt: m.createdAt ?? startedAt,
        tools, ...(noAnswer ? { error: "NO_FINAL_RESPONSE" } : {}),
      };
    }));
    if (!result.ok) {
      // Un run con `conversationId` es DESACOPLADO: sigue vivo y persistiendo en
      // el servidor aunque el STREAM se caiga. Paridad web: si el run arrancó, NO
      // lo borres; márcalo "interrumpido — sigue en el servidor" y sondea el hilo
      // para traer la respuesta persistida cuando termine. Solo la caída de
      // transporte ("ERROR") entra ahí; los códigos de no-disponible sí limpian.
      const startedRun = !!convId;
      const lastEmpty = (m: ChatMsg, i: number, arr: ChatMsg[]): boolean =>
        i === arr.length - 1 && m.role === "assistant" && !m.content && !(m.tools?.length);
      const explicitAgentError = !!chatStore.getChat(panelId).messages.at(-1)?.error;
      if (explicitAgentError) {
        // El SSE trajo un error del propio agente: el turno ya es terminal y
        // contiene el diagnóstico. No sondear ni borrar su mensaje de usuario.
      } else if (result.code === "ERROR" && startedRun) {
        chatStore.setMessages(panelId, (prev) => prev.map((m, i, arr) => (lastEmpty(m, i, arr) ? { ...m, interrupted: true } : m)));
        void recoverInterruptedTurn(panelId, convId!);
      } else {
        // REJECTED = el gateway rechazó el envío ANTES de arrancar el run (body
        // demasiado grande / parámetros): error visible, sin sondeo de respuesta.
        chatStore.patchChat(panelId, { notice: result.code === "REJECTED" && result.error
          ? { kind: "text", text: result.error }
          : { kind: result.code === "ERROR" || result.code === "REJECTED" ? "error" : "unavailable" } });
        // El turno NO llegó al agente: quítalo del transcript (dejarlo pintado
        // fingía un envío) y devuelve texto y adjuntos al composer para
        // reintentar sin re-escribir/re-adjuntar. Si hay cola FIFO esperando, el
        // drenaje de abajo necesita el composer: no lo pises.
        chatStore.setMessages(panelId, (prev) => prev.filter((m, i, arr) =>
          !lastEmpty(m, i, arr) && !(m.role === "user" && m.createdAt === startedAt)));
        if (chatStore.getComposer(panelId).queued.length === 0) {
          if (atts.length) chatStore.setAttachments(panelId, (prev) => (prev.length ? prev : atts));
          if (!opts?.voiceInput && text && !chatStore.getComposer(panelId).input.trim()) chatStore.patchComposer(panelId, { input: text });
        }
      }
    }
    chatStore.bumpScroll(panelId);
  }
  // Mantén el mensaje en cola hasta despacharlo: durante este relevo el usuario
  // aún puede pararlo, quitarlo o cambiar de hilo/cuenta. No uses el input como
  // transporte: contiene un borrador independiente, igual que los adjuntos.
  if (!stale && chatStore.getComposer(panelId).queued.length > 0) {
    setTimeout(() => {
      if (runtimes.get(panelId) !== r || seq !== r.streamSeq ||
          chatStore.getSession(panelId).conversationId !== convId) return;
      resumeQueued(panelId);
    }, 0);
  }
}

/** Reanuda solo mensajes aceptados previamente, conservando el borrador. */
function resumeQueued(panelId: string): void {
  const r = runtimes.get(panelId);
  const current = chatStore.getComposer(panelId);
  if (!r?.token || r.sending || current.busy || current.blocked || voiceInputLocked(panelId) || !current.queued.length) return;
  const [next, ...remaining] = current.queued;
  chatStore.patchComposer(panelId, { queued: remaining });
  void send(panelId, { text: next, keepAttachments: true });
}

// También funciona con la pantalla desmontada o la aplicación en segundo plano.
onVoiceInputUnlocked(resumeQueued);

/** Respuesta rápida (quick reply / ask / reintento): envía la opción elegida SIN
 *  tocar el borrador del composer ni consumir sus adjuntos preparados.
 *  Devuelve `false` si el envío NO se despachó (run vivo, envío en curso, panel
 *  bloqueado, sin token): quien llama revierte su estado de "enviando" en vez de
 *  quedarse colgado con un spinner permanente (AskView). */
function sendQuick(panelId: string, text: string, opts?: { planDecision?: "approve" }): boolean {
  const r = rt(panelId);
  const c = chatStore.getComposer(panelId);
  if (c.busy || c.blocked || r.sending || !r.token || !text.trim() || (voiceInputLocked(panelId) && !opts?.planDecision)) return false;
  if (opts?.planDecision === "approve") void setOptions(panelId, { approvalMode: "auto" });
  void send(panelId, { text, keepAttachments: true, planDecision: opts?.planDecision });
  return true;
}

/** Envía un texto arbitrario como turno (voz transcrita / archivo de conector):
 *  el texto va explícito (no pisa el borrador) pero SÍ consume los adjuntos
 *  preparados (el archivo del conector viaja con él). */
function sendText(panelId: string, text: string): void {
  const trimmed = text.trim();
  if (!trimmed || !rt(panelId).token) return;
  void send(panelId, { text: trimmed });
}

function stopStream(panelId: string): void {
  const r = rt(panelId);
  // 0) Descarta la cola FIFO pendiente ANTES de abortar: parar es parar TODO.
  //    Sin esto, al resolver el turno abortado el drenaje de `send` despachaba
  //    los mensajes encolados como si nada (turnos fantasma post-stop).
  if (chatStore.getComposer(panelId).queued.length > 0) {
    chatStore.patchComposer(panelId, { queued: [] });
  }
  // 1) Aborta el stream local (cierra el XHR y resuelve el turno en la UI).
  r.abort?.();
  chatStore.setMessages(panelId, (prev) => prev.map((m) => (m.pending ? { ...m, stopped: true } : m)));
  // 2) Detiene el run DESACOPLADO en el servidor. Abortar solo el XHR NO para
  //    la ejecución (el run es resumible, buffered server-side); la web lo
  //    detiene de verdad con POST /api/ai/agent/stop. Best-effort.
  const { conversationId } = chatStore.getSession(panelId);
  if (conversationId && r.token) {
    void luxAssistantProxy(panelId, r.token, "POST", "/api/ai/agent/stop", { conversationId });
  }
}

/** Editar el último mensaje de usuario (paridad web `editMessage`): detiene el
 *  run, siembra el texto en el composer y marca que el próximo envío descarte
 *  el par parado. Si el usuario descarta sin enviar, la UI queda intacta. */
function editMessage(panelId: string, text: string): void {
  stopStream(panelId);
  rt(panelId).editPendingTrim = true;
  chatStore.patchComposer(panelId, { input: text });
}

/** Reintentar tras un error: PODA el último par (mensaje de usuario + lo que
 *  vino detrás) y lo reenvía (paridad con el botón Reintentar de la web). Antes
 *  solo borraba los turnos de asistente con error y dejaba el de usuario: `send`
 *  lo volvía a añadir → burbuja duplicada y dos mensajes idénticos seguidos en
 *  el historial saliente (y barría los errores de TODO el hilo, no el último). */
function retryLast(panelId: string): void {
  const r = rt(panelId);
  const c = chatStore.getComposer(panelId);
  if (c.busy || c.blocked || r.sending || !r.token) return;
  const msgs = chatStore.getChat(panelId).messages;
  // Solo turnos con TEXTO: un turno solo-adjunto no es reintentable (el adjunto
  // ya se consumió) y reenviar `attachmentName` mandaba el NOMBRE del archivo
  // como prompt literal al agente.
  let idx = -1;
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m.role === "user" && m.content) { idx = i; break; }
  }
  if (idx < 0) return;
  const text = msgs[idx].content;
  chatStore.setMessages(panelId, msgs.slice(0, idx));
  if (!sendQuick(panelId, text)) chatStore.setMessages(panelId, msgs); // no se despachó → deshaz la poda
}

/**
 * Decisión del gate de permisos: la limpia de forma optimista y la postea por el
 * gateway. La respuesta se COMPRUEBA (`luxAssistantProxyOk`): con
 * `luxAssistantProxy` el fallo era indistinguible del éxito sin body, así que
 * aprobar/denegar podía ser un no-op silencioso que dejaba el run esperando una
 * decisión que nunca llegó. Si la decisión no viaja, el gate vuelve a pintarse
 * (reintentable) y el chat avisa del error.
 */
function decidePermission(panelId: string, requestId: string, decision: "allow" | "deny" | "always", tool?: string): void {
  const r = rt(panelId);
  const { conversationId } = chatStore.getSession(panelId);
  const msgs = chatStore.getChat(panelId).messages;
  const idx = msgs.findIndex((m) => m.permission?.id === requestId);
  const gate = idx >= 0 ? msgs[idx].permission ?? null : null;
  const restore = (): void => {
    if (!gate) return;
    chatStore.setMessages(panelId, (prev) => prev.map((m, i) => (i === idx && !m.permission ? { ...m, permission: gate } : m)));
    chatStore.patchChat(panelId, { notice: { kind: "error" } });
  };
  // Sin hilo/token la decisión NO puede viajar: no limpies el gate (quedaría el
  // run colgado y sin botones con los que volver a decidir).
  if (!conversationId || !r.token) {
    chatStore.patchChat(panelId, { notice: { kind: "error" } });
    return;
  }
  chatStore.setMessages(panelId, (prev) => prev.map((m) => (m.permission?.id === requestId ? { ...m, permission: null } : m)));
  void (async () => {
    const ok = await luxAssistantProxyOk(panelId, r.token, "POST", "/api/ai/agent/permission", {
      conversationId, requestId, decision, ...(tool ? { tool } : {}),
    });
    if (!ok) restore();
  })();
}

// ─── Cola de mensajes (chips del navbar) ─────────────────────────────────────

/** Encola EXPLÍCITAMENTE el texto actual del composer (botón "Encolar"): a
 *  diferencia de `send`, encola aunque no haya run vivo (turno de seguimiento). */
function queueCurrent(panelId: string): void {
  if (voiceInputLocked(panelId)) return;
  const c = chatStore.getComposer(panelId);
  const text = c.input.trim();
  if (!text) return;
  chatStore.patchComposer(panelId, { queued: [...c.queued, text], input: "" });
}

/** Devuelve a la caja de texto un mensaje aún en cola (lo saca de la cola). */
function editQueued(panelId: string, index: number): void {
  const c = chatStore.getComposer(panelId);
  const msg = c.queued[index];
  if (msg === undefined) return;
  chatStore.patchComposer(panelId, {
    input: c.input ? `${c.input} ${msg}`.trim() : msg,
    queued: c.queued.filter((_, i) => i !== index),
  });
}

/** Quita de la cola el mensaje en `index` sin enviarlo. */
function removeQueued(panelId: string, index: number): void {
  const c = chatStore.getComposer(panelId);
  chatStore.patchComposer(panelId, { queued: c.queued.filter((_, i) => i !== index) });
}

// ─── Adjuntos ────────────────────────────────────────────────────────────────

/** Aplica los límites del gateway al añadir adjuntos y avisa del descarte en el
 *  notice del chat (antes el exceso viajaba y el gateway lo rechazaba sin que
 *  el usuario viera nada). Devuelve cuántos entraron de verdad. */
function addAttachments(panelId: string, incoming: LocalFileAttachment[]): number {
  const prev = chatStore.getChat(panelId).attachments;
  const { next, rejected } = mergeAttachments(prev, incoming);
  if (next.length !== prev.length) chatStore.setAttachments(panelId, next);
  if (rejected) {
    chatStore.patchChat(panelId, { notice: { kind: rejected === "size" ? "attachTooLarge" : "attachTooMany" } });
  }
  // Los que el merge rechaza (cupo de 4 / presupuesto total) nunca entran al
  // store, así que su copia en caché no la borra el ciclo de vida de
  // `setAttachments`: hay que soltarla aquí o queda basura permanente.
  for (const a of incoming) {
    if (a.localUri && !next.includes(a)) void deleteLocalFile(a.localUri);
  }
  return next.length - prev.length;
}

async function pickFile(panelId: string): Promise<void> {
  const { attachments, oversize, failed } = await pickDocuments();
  if (attachments.length) addAttachments(panelId, attachments);
  // Descartes del propio picker (tamaño detectado antes de leer / archivo
  // ilegible): mismo aviso visible que el merge — antes se perdían en silencio.
  if (oversize) chatStore.patchChat(panelId, { notice: { kind: "attachTooLarge" } });
  else if (failed) chatStore.patchChat(panelId, { notice: { kind: "error" } });
}

async function pasteImage(panelId: string): Promise<void> {
  const att = await readClipboardImage(chatStore.getChat(panelId).attachments.length);
  if (att) addAttachments(panelId, [att]);
}

function clearAttachment(panelId: string, index: number): void {
  chatStore.setAttachments(panelId, (prev) => prev.filter((_, i) => i !== index));
}

// ─── Voz ─────────────────────────────────────────────────────────────────────

/** Transcribe un clip de voz por el túnel (STT del servidor) y devuelve el texto. */
async function transcribeVoice(panelId: string, base64: string, mime: string): Promise<string> {
  const r = rt(panelId);
  if (!r.token) return "";
  // Clip desmesurado (≈15MB+ de audio): el body del proxy lo rechazaría (30mb
  // menos el sobre JSON) — mejor cortar aquí y que el botón muestre voiceError.
  if (base64.length > MAX_TOTAL_ATTACHMENT_BASE64) return "";
  const res = await luxAssistantProxy<{ ok?: boolean; text?: string }>(
    panelId, r.token, "POST", "/api/ai/voice/transcribe", { audioBase64: base64, mimeType: mime },
  );
  return res?.text ?? "";
}

// ─── Conectores Office (Drive/OneDrive…) ─────────────────────────────────────

type RawConnector = {
  id: string; name: string; icon?: string; connected?: boolean;
  credentialFields?: Array<{ key: string; label: string; type: "text" | "password" | "textarea"; placeholder?: string }>;
  setup?: { steps?: string[] };
};

function mapConnector(c: RawConnector): ComposerConnector {
  return {
    id: c.id, name: c.name, icon: c.icon ?? "", connected: !!c.connected,
    fields: (c.credentialFields ?? []).map((f) => ({ key: f.key, label: f.label, type: f.type, placeholder: f.placeholder })),
    setupSteps: c.setup?.steps,
  };
}

async function loadConnectors(panelId: string): Promise<void> {
  const r = rt(panelId);
  if (!r.token) return;
  try {
    const res = await luxAssistantProxy<{ connectors?: RawConnector[] }>(panelId, r.token, "GET", "/api/ai/connectors");
    chatStore.patchComposer(panelId, { connectors: (res?.connectors ?? []).map(mapConnector) });
  } catch { /* módulo gateado / sin conectores: se ignora */ }
}

async function browseConnector(panelId: string, id: string, query: string): Promise<ConnectorBrowseItem[]> {
  const r = rt(panelId);
  if (!r.token) return [];
  const res = await luxAssistantProxy<{ files?: ConnectorBrowseItem[] }>(
    panelId, r.token, "GET", `/api/ai/connectors/${encodeURIComponent(id)}/files?query=${encodeURIComponent(query)}`,
  );
  return res?.files ?? [];
}

async function fetchConnectorFile(panelId: string, id: string, fileId: string, name: string): Promise<boolean> {
  const r = rt(panelId);
  if (!r.token) return false;
  const res = await luxAssistantProxy<{ file?: { name?: string; mimeType?: string; dataBase64?: string } }>(
    panelId, r.token, "POST", `/api/ai/connectors/${encodeURIComponent(id)}/files/fetch`, { fileId, name },
  );
  const f = res?.file;
  if (!f?.dataBase64) return false;
  return addAttachments(panelId, [
    { name: f.name ?? name, dataBase64: f.dataBase64 ?? "", mime: f.mimeType ?? guessMime(f.name ?? name) },
  ]) > 0;
}

async function connectConnector(panelId: string, id: string, secrets: Record<string, string>): Promise<boolean> {
  const r = rt(panelId);
  if (!r.token) return false;
  const res = await luxAssistantProxy<{ connector?: RawConnector }>(
    panelId, r.token, "POST", `/api/ai/connectors/${encodeURIComponent(id)}/connect`, { secrets },
  );
  await loadConnectors(panelId);
  return !!res?.connector?.connected;
}

async function disconnectConnector(panelId: string, id: string): Promise<boolean> {
  const r = rt(panelId);
  if (!r.token) return false;
  await luxAssistantProxy(panelId, r.token, "POST", `/api/ai/connectors/${encodeURIComponent(id)}/disconnect`, {});
  await loadConnectors(panelId);
  return true;
}

// ─── Meta del chat (header) ──────────────────────────────────────────────────

/** Sondea el ID de sesión del proveedor (solo CLI) y la ventana de contexto del
 *  chat activo. Se (re)consulta al cambiar de conversación y cuando un run
 *  asienta (`busy` → false). Barato en el servidor (chars/4). */
function refreshRunMeta(panelId: string): void {
  const r = rt(panelId);
  const seq = ++r.runMetaSeq;
  const { conversationId, provider } = chatStore.getSession(panelId);
  if (!conversationId || !r.token) {
    chatStore.patchHeader(panelId, { sessionId: null, ctx: null });
    return;
  }
  if (chatStore.getComposer(panelId).busy) return; // el run está mutando el transcript; esperar a que asiente
  const cid = encodeURIComponent(conversationId);
  void luxAssistantProxy<{ sessionId?: string | null }>(
    panelId, r.token, "GET", `/api/ai/conversations/${cid}/session${provider ? `?provider=${encodeURIComponent(provider)}` : ""}`,
  ).then((res) => { if (seq === r.runMetaSeq) chatStore.patchHeader(panelId, { sessionId: res?.sessionId ?? null }); });
  void luxAssistantProxy<{ context?: AssistantContextWindow }>(
    panelId, r.token, "GET", `/api/ai/conversations/${cid}/context`,
  ).then((res) => { if (seq === r.runMetaSeq) chatStore.patchHeader(panelId, { ctx: res?.context ?? null }); });
}

/** Meta del hilo activo: el proyecto al que pertenece (chip de cabecera) y, si
 *  es un worker delegado, el chat del líder ("Volver al chat del líder").
 *  Best-effort: si falla, cae a suelto/sin-líder. */
function refreshConversationMeta(panelId: string): void {
  const r = rt(panelId);
  const seq = ++r.convMetaSeq;
  const { conversationId } = chatStore.getSession(panelId);
  if (!conversationId || !r.token) {
    chatStore.patchChat(panelId, { activeProject: null, leaderConv: null });
    return;
  }
  const cid = encodeURIComponent(conversationId);
  void luxAssistantProxy<{ conversation?: { projectId?: string | null } }>(
    panelId, r.token, "GET", `/api/ai/conversations/${cid}`,
  ).then(async (res) => {
    const pid = res?.conversation?.projectId ?? null;
    if (seq !== r.convMetaSeq || chatStore.getSession(panelId).conversationId !== conversationId) return;
    chatStore.patchSession(panelId, { projectId: pid });
    if (!pid) { chatStore.patchChat(panelId, { activeProject: null }); return; }
    const projRes = await luxAssistantProxy<{ projects?: Project[]; items?: Project[] } | Project[]>(
      panelId, r.token, "GET", "/api/ai/projects",
    ).catch(() => null);
    if (seq !== r.convMetaSeq || chatStore.getSession(panelId).conversationId !== conversationId) return;
    const list = Array.isArray(projRes) ? projRes : (projRes?.projects ?? projRes?.items ?? []);
    const p = list.find((x) => x.id === pid) ?? null;
    chatStore.patchChat(panelId, { activeProject: { id: pid, title: p ? (p.name ?? p.title ?? pid.slice(0, 8)) : pid.slice(0, 8) } });
  }).catch(() => { if (seq === r.convMetaSeq) chatStore.patchChat(panelId, { activeProject: null }); });
  void luxAssistantProxy<{ task?: { leaderConversationId: string } | null }>(
    panelId, r.token, "GET", `/api/ai/team/tasks/by-worker?conversationId=${cid}`,
  ).then((res) => {
    const task = res?.task ?? null;
    if (seq !== r.convMetaSeq) return;
    chatStore.patchChat(panelId, {
      leaderConv: task && task.leaderConversationId !== conversationId ? { conversationId: task.leaderConversationId } : null,
    });
  }).catch(() => { if (seq === r.convMetaSeq) chatStore.patchChat(panelId, { leaderConv: null }); });
}

/** Compactación manual (botón "Compactar"): pliega los turnos antiguos en un
 *  resumen en el servidor y re-siembra el hilo reescrito. */
async function compactNow(panelId: string): Promise<void> {
  const r = rt(panelId);
  const { conversationId } = chatStore.getSession(panelId);
  if (!conversationId || !r.token || chatStore.getHeader(panelId).compacting) return;
  chatStore.patchHeader(panelId, { compacting: true });
  try {
    const res = await luxAssistantProxy<{ context?: AssistantContextWindow }>(
      panelId, r.token, "POST", `/api/ai/conversations/${encodeURIComponent(conversationId)}/compact`, {},
    );
    if (res?.context) chatStore.patchHeader(panelId, { ctx: res.context });
    // Re-siembra desde la historia reescrita (resumen + cola conservada).
    openConversation(panelId, conversationId);
  } finally {
    chatStore.patchHeader(panelId, { compacting: false });
  }
}

/** Aviso arbitrario del pane (p. ej. error del servidor al aprobar huella). */
function setNotice(panelId: string, text: string | null): void {
  chatStore.patchChat(panelId, { notice: text === null ? null : { kind: "text", text } });
}

// ─── API pública ─────────────────────────────────────────────────────────────

export const chatController = {
  configure,
  registerUiHandlers,
  openTerminal,
  ensureDiskRestore,
  loadProviders,
  setProvider,
  setOptions,
  setConversationId,
  refreshProviderConfig,
  openConversation,
  reloadMessages,
  recoverInterruptedTurn,
  newConversation,
  coverConversation,
  startChat,
  send,
  sendQuick,
  sendText,
  sendVoice: (panelId: string, text: string) => send(panelId, { text, voiceInput: true, keepAttachments: true }),
  realtimeCapabilities: (panelId: string) => luxAssistantProxy<any>(panelId, rt(panelId).token, "GET", "/api/ai/realtime/capabilities"),
  realtimeConversation: (panelId: string, conversationId: string) => luxAssistantProxy<any>(panelId, rt(panelId).token, "GET", "/api/ai/realtime/conversations/" + conversationId),
  closeRealtimeSession: (panelId: string, id: string) => luxAssistantProxy<{ok: boolean}>(panelId, rt(panelId).token, "DELETE", "/api/ai/realtime/sessions/" + id),
  realtimeTasks: (panelId: string, id: string) => luxAssistantProxy<any>(panelId, rt(panelId).token, "GET", "/api/ai/conversations/" + id + "/team-tasks"),
  realtimePermission: (panelId: string, conversationId: string, requestId: string, decision: "allow" | "deny" | "always") =>
    luxAssistantProxy<{ok: boolean}>(panelId, rt(panelId).token, "POST", "/api/ai/agent/permission", {conversationId, requestId, decision}),
  realtimeAnswer: (panelId: string, sessionId: string, taskId: string, askedAt: string, choice: number) =>
    luxAssistantProxy<{ok: boolean}>(panelId, rt(panelId).token, "POST", "/api/ai/realtime/sessions/" + sessionId + "/answer", {taskId, askedAt, choice}),
  cancelRealtimeTask: (panelId: string, taskId: string) =>
    luxAssistantProxy<{ok: boolean}>(panelId, rt(panelId).token, "POST", "/api/ai/team/tasks/" + taskId + "/cancel", {}),
  prepareRealtimeContext,
  stopStream,
  editMessage,
  retryLast,
  decidePermission,
  queueCurrent,
  editQueued,
  removeQueued,
  pickFile,
  addAttachments,
  pasteImage,
  clearAttachment,
  transcribeVoice,
  loadConnectors,
  browseConnector,
  fetchConnectorFile,
  connectConnector,
  disconnectConnector,
  refreshRunMeta,
  refreshConversationMeta,
  compactNow,
  setNotice,
};

async function prepareRealtimeContext(panelId: string, accept?: (id: string) => boolean) {
  const r = rt(panelId);
  if (!r.token) throw new Error("Inicia sesión en el panel.");
  const session = chatStore.getSession(panelId), openSeq = r.openSeq;
  let id = session.conversationId;
  if (!id) {
    const response = await luxAssistantProxy<{ conversation?: { id: string } }>(panelId, r.token, "POST", "/api/ai/conversations", {
      provider: session.provider || "claude", firstMessage: "Conversación por voz",
      projectId: session.projectId, agentId: session.agentId, approvalMode: chatStore.getComposer(panelId).approvalMode,
    });
    id = response?.conversation?.id ?? null;
    if (!id) throw new Error("No se pudo crear la conversación.");
    if (r.openSeq !== openSeq || chatStore.getSession(panelId).conversationId !== session.conversationId || (accept && !accept(id)))
      throw new Error("La conversación cambió antes de iniciar la voz.");
    chatStore.patchSession(panelId, { conversationId: id });
    persist(panelId);
  }
  return { panelId, token: r.token, conversationId: id };
}
