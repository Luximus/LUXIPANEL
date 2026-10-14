// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

/**
 * Store MODULE-LEVEL del chat del asistente POR PANEL (fase A4).
 *
 * Fuente de verdad única de la sesión (proveedor/conversación/agente), del
 * composer, de los indicadores del header y — lo nuevo de esta fase — de los
 * MENSAJES y del estado de ejecución del chat. Al vivir a nivel de módulo (no
 * en un componente), el estado sobrevive al desmontaje del pane/pantalla: el
 * stream que conduce `chat-controller.ts` sigue escribiendo aquí aunque el
 * usuario navegue (imprescindible con navegación real, fase B).
 *
 * Patrón module-store + `useSyncExternalStore` (decisión del plan: NO zustand).
 * Los hooks de suscripción viven en `features/assistant/hooks.ts`.
 * Aquí NO hay JSX ni transporte: solo estado y derivaciones puras.
 */

import type {
  AssistantContextWindow,
  AssistantHeader,
  AssistantSession,
  ChatAttachment,
  ChatMsg,
  ChatNotice,
  ComposerAttachment,
  ComposerConnector,
  ComposerState,
} from "./types";
import type { ActiveProviderConfig } from "./providers";
import type { LocalFileAttachment } from "./attachments";
import { registerStoreReset } from "../../lib/store-reset";

// ─── Estado del chat (mensajes + ejecución) ──────────────────────────────────

/** Estado del chat de un panel que NO cabe en sesión/composer/header: los
 *  turnos, los adjuntos completos (base64), el aviso y la meta del hilo. */
export type ChatPanelState = {
  messages: ChatMsg[];
  /** Adjuntos pendientes de enviar (con datos base64). */
  attachments: ChatAttachment[];
  notice: ChatNotice | null;
  /** Proyecto al que pertenece el chat activo (chip de cabecera). Null = suelto. */
  activeProject: { id: string; title: string } | null;
  /** Chat del líder si el hilo activo es un worker delegado. Null = no es worker. */
  leaderConv: { conversationId: string } | null;
  /** Config del proveedor activo (modo API/CLI + modelo) de `/api/ai/config`. */
  activeProviderCfg: ActiveProviderConfig | null;
  /** Bump al asentar un turno (busy → false): recarga la barra "USO CLI". */
  usageRefreshKey: number;
  /** Bump = intención de scroll al fondo (envío / apertura de hilo): el pane
   *  re-engancha el stick y hace scrollToEnd. */
  scrollSeq: number;
};

const EMPTY_SESSION: AssistantSession = { provider: "", providers: [], conversationId: null, title: null, agentName: null, agentId: null, projectId: null };
const EMPTY_COMPOSER: ComposerState = {
  input: "", attachmentNames: [], attachments: [], busy: false, blocked: false, blockedReason: null,
  started: false, mcpExpired: false, queued: [], approvalMode: "manual", connectors: [], voiceAvailable: false,
  terminalAvailable: false, imageAttachSupported: true,
};
const EMPTY_HEADER: AssistantHeader = {
  tokensTotal: 0, assistantTurns: 0, tokensEstimated: false, attachmentsCount: 0,
  streaming: false, backgroundRunning: false, streamStartedAt: null, sessionId: null,
  ctx: null, compacting: false,
};
const EMPTY_CHAT: ChatPanelState = {
  messages: [], attachments: [], notice: null, activeProject: null, leaderConv: null,
  activeProviderCfg: null, usageRefreshKey: 0, scrollSeq: 0,
};

// ─── Slice genérico por panel (estado + listeners + dedup) ───────────────────

type Slice<T> = {
  get(panelId: string): T;
  patch(panelId: string, patch: Partial<T>): void;
  subscribe(panelId: string, listener: () => void): () => void;
  /** Descarta el estado de TODOS los paneles (logout): cada panel vuelve a su
   *  `empty` y se notifica a los suscriptores que sigan montados. */
  clearAll(): void;
};

function createSlice<T extends object>(empty: T, same: (a: T, b: T) => boolean): Slice<T> {
  const states = new Map<string, T>();
  const listeners = new Map<string, Set<() => void>>();
  return {
    get: (panelId) => states.get(panelId) ?? empty,
    patch(panelId, patch) {
      const cur = states.get(panelId) ?? empty;
      const next = { ...cur, ...patch };
      if (same(cur, next)) return;
      states.set(panelId, next);
      listeners.get(panelId)?.forEach((l) => l());
    },
    subscribe(panelId, listener) {
      let s = listeners.get(panelId);
      if (!s) { s = new Set(); listeners.set(panelId, s); }
      s.add(listener);
      return () => { listeners.get(panelId)?.delete(listener); };
    },
    clearAll() {
      if (states.size === 0) return;
      states.clear();
      listeners.forEach((set) => set.forEach((l) => l()));
    },
  };
}

// ─── Igualdades (evitan emits espurios; mismas que el puente original) ───────

function sameArray(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
function sameAttachments(a: ComposerAttachment[], b: ComposerAttachment[]): boolean {
  // Identidad primero: el composer se re-parchea en CADA tecla y, con los
  // adjuntos intactos, los objetos son los mismos → cero comparación de cadenas
  // (antes `previewUri` era un data-URI con el base64 entero: hasta ~8M
  // caracteres por imagen comparados en cada pulsación).
  return a.length === b.length
    && a.every((v, i) => v === b[i] || (v.name === b[i].name && v.mime === b[i].mime && v.previewUri === b[i].previewUri));
}
function sameConnectors(a: ComposerConnector[], b: ComposerConnector[]): boolean {
  return a.length === b.length && a.every((v, i) => v.id === b[i].id && v.connected === b[i].connected && v.name === b[i].name);
}
function sameCtx(a: AssistantContextWindow | null, b: AssistantContextWindow | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.enabled === b.enabled && a.tokens === b.tokens && a.limit === b.limit && a.ratio === b.ratio && a.warn === b.warn;
}
function sameNotice(a: ChatNotice | null, b: ChatNotice | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.kind === b.kind && (a.kind !== "text" || b.kind !== "text" || a.text === b.text);
}

const sessionSlice = createSlice<AssistantSession>(EMPTY_SESSION, (a, b) =>
  a.provider === b.provider && sameArray(a.providers, b.providers) && a.conversationId === b.conversationId &&
  a.title === b.title && a.agentName === b.agentName && a.agentId === b.agentId && a.projectId === b.projectId && a.model === b.model && a.effort === b.effort,
);
const composerSlice = createSlice<ComposerState>(EMPTY_COMPOSER, (a, b) =>
  a.input === b.input && sameArray(a.attachmentNames, b.attachmentNames) && sameAttachments(a.attachments, b.attachments) &&
  a.busy === b.busy && a.blocked === b.blocked && a.blockedReason === b.blockedReason &&
  a.started === b.started && a.mcpExpired === b.mcpExpired && sameArray(a.queued, b.queued) &&
  a.approvalMode === b.approvalMode && sameConnectors(a.connectors, b.connectors) &&
  a.voiceAvailable === b.voiceAvailable && a.terminalAvailable === b.terminalAvailable &&
  a.imageAttachSupported === b.imageAttachSupported,
);
const headerSlice = createSlice<AssistantHeader>(EMPTY_HEADER, (a, b) =>
  a.tokensTotal === b.tokensTotal && a.assistantTurns === b.assistantTurns &&
  a.tokensEstimated === b.tokensEstimated && a.attachmentsCount === b.attachmentsCount &&
  a.streaming === b.streaming && a.backgroundRunning === b.backgroundRunning &&
  a.streamStartedAt === b.streamStartedAt && a.sessionId === b.sessionId &&
  sameCtx(a.ctx, b.ctx) && a.compacting === b.compacting,
);
const chatSlice = createSlice<ChatPanelState>(EMPTY_CHAT, (a, b) =>
  a.messages === b.messages && a.attachments === b.attachments && sameNotice(a.notice, b.notice) &&
  a.activeProject?.id === b.activeProject?.id && a.activeProject?.title === b.activeProject?.title &&
  a.leaderConv?.conversationId === b.leaderConv?.conversationId &&
  a.activeProviderCfg?.mode === b.activeProviderCfg?.mode && a.activeProviderCfg?.model === b.activeProviderCfg?.model &&
  a.usageRefreshKey === b.usageRefreshKey && a.scrollSeq === b.scrollSeq,
);

// Logout / cambio de cuenta: las conversaciones, adjuntos (base64), sesión y
// composer de TODOS los paneles son datos del usuario saliente → fuera. Los
// aborts de los streams que escriben aquí los dispara el reset del controller.
registerStoreReset(() => {
  // Los temporales de los adjuntos preparados son datos del usuario saliente:
  // fuera del disco ya mismo (sin ventana de gracia — nadie los va a restaurar).
  releaseFiles([...stagedFiles], 0);
  sessionSlice.clearAll();
  composerSlice.clearAll();
  headerSlice.clearAll();
  chatSlice.clearAll();
});

// ─── Ficheros temporales de los adjuntos ─────────────────────────────────────
//
// El picker copia cada archivo a la caché (hasta ~6MB) y de esa copia sale la
// miniatura del composer. Cuando el adjunto SALE del composer (enviado, quitado
// con la X, o descartado al cambiar de hilo) el temporal ya no hace falta: se
// borra. Nadie lo hacía y cada intento de adjuntar dejaba basura permanente.
//
// La ventana de gracia existe porque el controller DEVUELVE los adjuntos al
// composer cuando el gateway rechaza el envío (para reintentar sin re-adjuntar):
// si el mismo uri vuelve a entrar antes de que venza, el borrado se cancela.

const RELEASE_GRACE_MS = 60_000;
const pendingRelease = new Map<string, ReturnType<typeof setTimeout>>();
/** Temporales aún referenciados por el composer de algún panel. */
const stagedFiles = new Set<string>();

function localUriOf(a: ChatAttachment): string | undefined {
  return (a as LocalFileAttachment).localUri;
}

/** Borra un temporal. Import DIFERIDO (y cacheado): el store es puro (se testea
 *  en node) y no debe arrastrar los módulos nativos de Expo en su grafo de
 *  importación. */
let fsModule: Promise<typeof import("expo-file-system/legacy")> | null = null;
function deleteLocalFile(uri: string): void {
  fsModule ??= import("expo-file-system/legacy");
  void fsModule
    .then((FileSystem) => FileSystem.deleteAsync(uri, { idempotent: true }))
    .catch(() => { /* ya no existe / plataforma sin FS: nada que hacer */ });
}

/** El uri vuelve a estar referenciado: cancela un borrado pendiente. */
function keepFiles(uris: string[]): void {
  for (const uri of uris) {
    stagedFiles.add(uri);
    const timer = pendingRelease.get(uri);
    if (timer) { clearTimeout(timer); pendingRelease.delete(uri); }
  }
}

/** El uri ya no lo referencia nadie: bórralo (tras la ventana de gracia, o ya
 *  mismo con `graceMs = 0` — logout). */
function releaseFiles(uris: string[], graceMs: number = RELEASE_GRACE_MS): void {
  for (const uri of uris) {
    stagedFiles.delete(uri);
    if (pendingRelease.has(uri)) continue;
    if (graceMs <= 0) { deleteLocalFile(uri); continue; }
    pendingRelease.set(uri, setTimeout(() => {
      pendingRelease.delete(uri);
      deleteLocalFile(uri);
    }, graceMs));
  }
}

/** Miniatura del adjunto para el composer/lightbox. Preferimos el FICHERO local
 *  (`file://…`) al data-URI: el data-URI duplica el base64 completo (hasta ~8M
 *  caracteres por imagen, ~50MB de strings con el máximo permitido) y obliga a
 *  decodificar el bitmap a resolución completa para pintar 26×26. Los adjuntos
 *  sin fichero (portapapeles, conector Office) siguen con data-URI. */
function previewUriOf(a: ChatAttachment): string | undefined {
  if (!a.mime.startsWith("image/")) return undefined;
  const local = localUriOf(a);
  if (local) return local;
  return a.dataBase64 ? `data:${a.mime};base64,${a.dataBase64}` : undefined;
}

// ─── Derivaciones (antes eran effects del pane) ──────────────────────────────

/**
 * Recalcula lo DERIVADO de los mensajes/busy y lo publica a header/composer/
 * sesión: Σ tokens del chat, nº de adjuntos, "run en background", el flag
 * `started` (un chat con mensajes cuenta como iniciado) y el título/resumen
 * para el auto-rótulo de la pestaña (1ª frase del usuario, recortada).
 */
function recomputeDerived(panelId: string): void {
  const msgs = chatSlice.get(panelId).messages;
  const composer = composerSlice.get(panelId);
  let total = 0;
  let assistantTurns = 0;
  let estimated = false;
  for (const m of msgs) {
    if (m.role !== "assistant") continue;
    assistantTurns++;
    if (m.tokens) {
      total += m.tokens.total;
      if (m.tokens.estimated) estimated = true;
    }
  }
  const attachmentsCount = msgs.filter((m) => m.attachmentName).length;
  const backgroundRunning = !composer.busy && msgs.some((m) => m.interrupted);
  headerSlice.patch(panelId, { tokensTotal: total, assistantTurns, tokensEstimated: estimated, attachmentsCount, backgroundRunning });
  const started = composer.started || msgs.length > 0;
  if (started !== composer.started) composerSlice.patch(panelId, { started });
  const firstUser = msgs.find((m) => m.role === "user" && m.content.trim());
  const title = started && firstUser ? firstUser.content.trim().replace(/\s+/g, " ").slice(0, 48) : null;
  sessionSlice.patch(panelId, { title });
}

// ─── API pública ─────────────────────────────────────────────────────────────

export const chatStore = {
  // Slices crudos (get/patch/subscribe). El adapter y el controller los usan;
  // los mutadores de alto nivel de abajo mantienen las derivaciones coherentes.
  getSession: sessionSlice.get,
  patchSession: sessionSlice.patch,
  subscribeSession: sessionSlice.subscribe,
  getComposer: composerSlice.get,
  patchComposer: composerSlice.patch,
  subscribeComposer: composerSlice.subscribe,
  getHeader: headerSlice.get,
  patchHeader: headerSlice.patch,
  subscribeHeader: headerSlice.subscribe,
  getChat: chatSlice.get,
  patchChat: chatSlice.patch,
  subscribeChat: chatSlice.subscribe,

  /** Reemplaza los turnos (valor o updater) y recalcula los derivados
   *  (tokens/adjuntos/background/título/started). */
  setMessages(panelId: string, next: ChatMsg[] | ((prev: ChatMsg[]) => ChatMsg[])): void {
    const prev = chatSlice.get(panelId).messages;
    const msgs = typeof next === "function" ? next(prev) : next;
    if (msgs === prev) return;
    chatSlice.patch(panelId, { messages: msgs });
    recomputeDerived(panelId);
  },

  /** Fija el estado de ejecución del stream: `busy` del composer + cronómetro
   *  del header en un solo paso coherente (y re-deriva "background"). */
  setBusy(panelId: string, busy: boolean, streamStartedAt: number | null): void {
    composerSlice.patch(panelId, { busy });
    headerSlice.patch(panelId, { streaming: busy, streamStartedAt });
    recomputeDerived(panelId);
  },

  /** Reemplaza los adjuntos pendientes y publica al composer los nombres y las
   *  previsualizaciones (miniatura solo para imágenes). Los ficheros temporales
   *  de los adjuntos que SALEN de la lista se borran (con ventana de gracia). */
  setAttachments(panelId: string, next: ChatAttachment[] | ((prev: ChatAttachment[]) => ChatAttachment[])): void {
    const prev = chatSlice.get(panelId).attachments;
    const atts = typeof next === "function" ? next(prev) : next;
    if (atts === prev) return;
    const kept = atts.map(localUriOf).filter((u): u is string => !!u);
    keepFiles(kept);
    releaseFiles(prev.map(localUriOf).filter((u): u is string => !!u && !kept.includes(u)));
    chatSlice.patch(panelId, { attachments: atts });
    composerSlice.patch(panelId, {
      attachmentNames: atts.map((a) => a.name),
      attachments: atts.map((a) => ({ name: a.name, mime: a.mime, previewUri: previewUriOf(a) })),
    });
  },

  /** Marca el chat como iniciado (portada → chat) o de vuelta a portada. */
  setStarted(panelId: string, started: boolean): void {
    composerSlice.patch(panelId, { started });
    recomputeDerived(panelId);
  },

  /** Intención de scroll al fondo (el pane re-engancha el stick y baja). */
  bumpScroll(panelId: string): void {
    chatSlice.patch(panelId, { scrollSeq: chatSlice.get(panelId).scrollSeq + 1 });
  },

  /** Un turno asentó: recarga la barra "USO CLI". */
  bumpUsageKey(panelId: string): void {
    chatSlice.patch(panelId, { usageRefreshKey: chatSlice.get(panelId).usageRefreshKey + 1 });
  },
};
