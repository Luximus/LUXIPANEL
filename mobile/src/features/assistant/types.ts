// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

/**
 * Tipos de DOMINIO del asistente IA (chat por servidor). Extraídos del monolito
 * `components/ServerAssistantPane.tsx` y del puente `components/assistant-bridge.ts`
 * (fase A2 de la re-arquitectura): aquí solo viven tipos puros, sin ningún
 * import de React/React Native ni de transporte en runtime. Los sitios
 * originales re-exportan estos nombres para compatibilidad, así los consumidores
 * actuales compilan sin cambios.
 */

// Eventos del stream SSE del asistente (viven en la capa de transporte; se
// re-exportan aquí como parte del dominio del chat — import type = borrado en
// compilación, no arrastra `api/client` al runtime).
export type { AssistantEvent, AssistantAskQuestion } from "../../api/client";
import type { AssistantAskQuestion } from "../../api/client";

// El agente IA custom completo y su rol siguen definidos en el espejo de la API
// (`components/assistant-settings/types.ts`, junto al resto de tipos `/api/ai/*`);
// se re-exportan aquí como parte del dominio del asistente.
export type { AssistantAgent, AgentRole } from "../../components/assistant-settings/types";

// ─── Mensajes del chat (turnos) ──────────────────────────────────────────────

/** Bloque de herramienta (tool_use/tool_result) dentro de un turno del asistente. */
export type ToolBlock = { id: string; name: string; output: string; success?: boolean; done?: boolean; input?: unknown };

/** Tokens acumulados de un turno (evento `usage` del stream). */
export type TurnTokens = { input: number; output: number; total: number; estimated?: boolean };

/** Permiso pendiente mid-run (gate del Claude CLI). */
export type PermissionReq = { id: string; tool: string; title: string; detail?: string };

/** Un mensaje del chat (turno de usuario o del asistente). */
export type ChatMsg = {
  displaySummary?: string;
  role: "user" | "assistant";
  content: string;
  /** Identidad real del proveedor de este turno, aunque el chat cambie de proveedor. */
  provider?: string;
  /** Entrada traducida que recibió el agente, distinta del texto del usuario. */
  raw?: string;
  /** Mensaje generado por el sistema para despertar a un agente de equipo. */
  auto?: boolean;
  /** Historial CLI persistido: la respuesta limpia se conserva en content. */
  cli?: boolean;
  cliHistoryLog?: string;
  attachments?: { name: string; mimeType: string; url: string }[];
  pending?: boolean;
  stopped?: boolean;
  attachmentName?: string;
  tools?: ToolBlock[];
  createdAt?: number;
  durationMs?: number;
  tokens?: TurnTokens;
  /** Preguntas interactivas del agente (ask). */
  ask?: AssistantAskQuestion[];
  /** Aprobación estructurada del plan: solo la primera opción autoriza ejecutarlo. */
  askKind?: "plan-approval";
  /** Permiso pendiente (botones Aprobar/Aprobar siempre/Rechazar). */
  permission?: PermissionReq | null;
  /** Estado transitorio de traducción en segundo plano. */
  status?: "working" | "translating";
  /** La traducción falló: respuesta sin traducir + motivo (aviso colapsable). */
  translationError?: string;
  /** Error duro del turno (caja roja con Reintentar / Nuevo chat). */
  error?: string;
  /** Conexión interrumpida: la tarea sigue en el servidor. */
  interrupted?: boolean;
  /** Divisor de compactación: nº de mensajes previos resumidos en este turno. */
  summarizedCount?: number;
};

/** Adjunto COMPLETO del composer (con sus datos en base64). Vive en el
 *  `chat-store` (fase A4); al navbar solo se exponen nombre/mime/preview vía
 *  `ComposerAttachment`. */
export type ChatAttachment = { name: string; dataBase64: string; mime: string };

/** Aviso del chat (caja roja bajo los turnos / en el bloqueo). Los códigos los
 *  traduce el pane con su `t` local; `text` llega ya legible (p. ej. el error
 *  del servidor al aprobar la huella). */
export type ChatNotice =
  | { kind: "error" }
  | { kind: "unavailable" }
  // Adjunto descartado al prepararlo: demasiado grande / demasiados archivos
  // (límites del gateway LP — ver `attachment-limits.ts`).
  | { kind: "attachTooLarge" }
  | { kind: "attachTooMany" }
  | { kind: "text"; text: string };

// ─── Conversaciones / proyectos / agentes del drawer ─────────────────────────

/** Metadatos de una conversación de la lista del drawer. */
export type Conversation = {
  id: string; title?: string; preview?: string; projectId?: string | null;
  /** Agente IA ligado al hilo (null = chat suelto). Lo devuelve
   *  `/api/ai/conversations` (ConversationMeta.agentId); ancla el árbol de
   *  "Agentes IA" (líder → subordinados) del drawer. */
  agentId?: string | null;
  updatedAt?: string; createdAt?: string;
  /** Proveedor del hilo (icono de la fila, paridad con web). */
  provider?: string; originProvider?: string;
  /** Fijado arriba (pin ámbar). El backend ordena fijados primero. */
  pinned?: boolean;
  /** El último run terminó pero el usuario no ha abierto el chat (punto rojo). */
  unreviewed?: boolean;
  /** El agente pausó pidiendo aprobar una tool (punto amarillo pulsante). */
  needsApproval?: boolean;
};

/** Proyecto del drawer. `parentId` define la jerarquía (proyectos anidados, como
 *  en web). El árbol se arma en cliente desde la lista plana de `/api/ai/projects`. */
export type Project = { id: string; name?: string; title?: string; parentId?: string | null };

/** Agente IA custom (sección "Agentes" del drawer, paridad con web). Clic =
 *  inicia un chat nuevo ligado al agente. Vista REDUCIDA de `AssistantAgent`. */
export type Agent = { id: string; name?: string; providerId?: string; description?: string; icon?: string; avatar?: string };

// ─── Sesión / composer / header (antes en assistant-bridge.ts) ───────────────

/** Sesión del asistente por panel (fuente de verdad del puente pub/sub). */
export type AssistantSession = {
  provider: string;
  providers: string[];
  conversationId: string | null;
  /** Título/resumen de la conversación activa (1ª frase del usuario, recortada).
   *  Lo publica el pane; lo consume el auto-rótulo de la pestaña ("<panel> - <título>"). */
  title: string | null;
  /** Nombre del agente IA personalizado activo (si la conversación corre bajo un
   *  agente custom). Alimenta el banner violeta del pane (paridad con el badge de
   *  agente de la web). `null` = sin agente custom. Lo fija el drawer/Fase 4. */
  agentName: string | null;
  /** Id del agente IA custom al que ligar el chat NUEVO (se incluye al crear la
   *  conversación en el backend, igual que la web). `null` = ninguno. */
  agentId: string | null;
  /** Proyecto al que ligar el chat NUEVO (botón "+" de una carpeta de proyecto
   *  del drawer): se incluye al crear la conversación. `null` = chat suelto. */
  projectId: string | null;
  model?: string;
  effort?: "low" | "medium" | "high" | "xhigh";
};

/** Modo de aprobación del agente (paridad con la web): manual pregunta cada
 *  acción, auto ejecuta sin preguntar, plan propone un plan y espera visto bueno. */
export type ApprovalMode = "manual" | "auto" | "plan";

/** Adjunto enriquecido para el navbar: además del nombre lleva el mime y, para
 *  imágenes, un `previewUri` (data URI) para miniaturas + lightbox. Los datos
 *  base64 completos siguen en el pane; aquí solo lo necesario para previsualizar. */
export type ComposerAttachment = { name: string; mime: string; previewUri?: string };

/** Campo de credencial de un conector Office (espejo de `ConnectorCredentialField`). */
export type ConnectorField = { key: string; label: string; type: "text" | "password" | "textarea"; placeholder?: string };

/** Conector Office (Drive/OneDrive…) para los botones del composer. */
export type ComposerConnector = {
  id: string; name: string; icon: string; connected: boolean;
  /** Campos a rellenar al conectar (form del gestor). */
  fields?: ConnectorField[];
  /** Pasos de configuración (guía) — opcional. */
  setupSteps?: string[];
};

/** Estado del composer (textarea + adjuntos + cola) publicado por el puente. */
export type ComposerState = {
  input: string;
  /** Nombres de los archivos adjuntos (1 por fila en el navbar); orden = orden de
   *  adjuntado. Los datos base64 viven en el pane; aquí solo se expone el nombre. */
  attachmentNames: string[];
  /** Adjuntos enriquecidos (mime + miniatura) para previsualización/lightbox. */
  attachments: ComposerAttachment[];
  busy: boolean;
  blocked: boolean;
  blockedReason: string | null;
  /** El chat ya arrancó (hay mensajes o el usuario pulsó "Empezar conversación").
   *  Mientras es `false` el pane muestra la portada (logo + 2 botones) y el navbar
   *  inferior (composer) NO se monta. */
  started: boolean;
  /** El token MCP del servidor conectado expiró: el composer muestra un banner
   *  ámbar con cómo recuperarse (paridad con la web). */
  mcpExpired: boolean;
  /** Mensajes encolados mientras un run está en curso (se despachan FIFO al
   *  terminar). Chips numerados editables/removibles en el navbar. */
  queued: string[];
  /** Modo de aprobación seleccionado para el agente. */
  approvalMode: ApprovalMode;
  /** Conectores Office configurados (para los botones del composer). */
  connectors: ComposerConnector[];
  /** La grabación de voz está disponible (grabador nativo + STT del servidor). */
  voiceAvailable: boolean;
  realtimeEnabled?: boolean;
  /** La terminal del servidor está disponible (permiso `terminal` + opener). El
   *  composer muestra el chip "Terminal" encima del pill (paridad con la web). */
  terminalAvailable: boolean;
  /** El proveedor/modelo activo acepta adjuntos de imagen (visión). Alterna el
   *  placeholder del input: "Escribe o pega una imagen…" vs "Escribe tu mensaje…"
   *  (paridad con `support.enabled` de `attachmentSupport` en la web). */
  imageAttachSupported: boolean;
};

/** Fila de archivo devuelta por `browseConnector` (espejo de `ConnectorFile`). */
export type ConnectorBrowseItem = { id: string; name: string; mimeType: string; isFolder: boolean; size?: number };

/** Ocupación estimada de la ventana de contexto del chat activo (espejo de
 *  `ConversationContext` de la web). Alimenta el medidor "ctx NN%" + el botón
 *  Compactar del navbar superior. */
export type AssistantContextWindow = {
  enabled: boolean;
  /** Tokens estimados que ocupa la conversación. */
  tokens: number;
  /** Ventana usable contra la que se mide el estimado. */
  limit: number;
  /** tokens / limit (puede exceder 1 si se desborda). */
  ratio: number;
  /** Pasó el umbral de aviso → ofrecer Compactar. */
  warn: boolean;
};

/** Indicadores del header del chat (navbar SUPERIOR). Los publica el pane (dueño
 *  de los mensajes y del stream) y los consume `MainScreen` para pintarlos en la
 *  barra superior cuando el panel visible tiene un chat iniciado. Paridad con el
 *  cluster de estado del header de `ChatPane.tsx`. */
export type AssistantHeader = {
  /** Σ tokens acumulados de TODOS los turnos del asistente de este chat. */
  tokensTotal: number;
  /** Nº de turnos del asistente (denominador del Σ). */
  assistantTurns: number;
  /** Algún turno trae tokens estimados (recuento por caracteres del CLI) → "~". */
  tokensEstimated: boolean;
  /** Nº de adjuntos de la conversación (icono clip + contador). */
  attachmentsCount: number;
  /** Este cliente está transmitiendo la respuesta ahora (cronómetro emerald). */
  streaming: boolean;
  /** El run sigue en el servidor aunque este cliente no lo transmita ("en background"). */
  backgroundRunning: boolean;
  /** Marca temporal (ms) en que arrancó el stream actual; alimenta el cronómetro.
   *  `null` cuando no hay stream en curso. */
  streamStartedAt: number | null;
  /** ID de sesión del proveedor (solo proveedores CLI); copiable. `null` = ninguno. */
  sessionId: string | null;
  /** Ventana de contexto estimada (medidor + Compactar). `null` = sin datos. */
  ctx: AssistantContextWindow | null;
  /** Compactación en curso (deshabilita el botón Compactar y muestra spinner). */
  compacting: boolean;
};
