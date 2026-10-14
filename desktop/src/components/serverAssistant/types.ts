import type { ChatAction } from "../SupportChatWidget";

export type Conversation = {
  id: string;
  title?: string;
  preview?: string;
  projectId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  /** Chat fijado (el backend ordena fijados primero; el árbol lo re-aplica). */
  pinned?: boolean;
  /** Agente al que está ligado el chat (tab "Agentes IA" del sidebar). */
  agentId?: string | null;
  /** El último run terminó pero no se ha abierto (punto rojo "sin revisar"). */
  unreviewed?: boolean;
};

// El API del módulo (`/api/ai/projects`) devuelve `title`/`icon`/`parentId`
// (no `name`); aceptamos ambos por compatibilidad.
export type Project = { id: string; title?: string; name?: string; icon?: string; parentId?: string | null };

export type ToolBlock = { id: string; name: string; output: string; success?: boolean; done?: boolean };
export type TokenUsage = { input: number; output: number; total: number; estimated?: boolean };

export type ChatMsg = {
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
  attachmentName?: string;
  tools?: ToolBlock[];
  /** Epoch ms del turno (usuario: al enviar; asistente: al terminar). */
  at?: number;
  /** Asistente: lo que tardó la respuesta (wall-clock). */
  durationMs?: number;
  /** Asistente: tokens acumulados de los eventos `usage` del run. */
  tokens?: TokenUsage;
  /** Asistente: respuesta CLI cargada de historial (sin trace en vivo). */
  cli?: boolean;
  /** Tarjetas interactivas (client_action) — mismo contrato que soporte. */
  actions?: ChatAction[];
};

export type AssistantStrings = {
  title: string;
  placeholder: string;
  send: string;
  stop: string;
  thinking: string;
  empty: string;
  /** Frases de ejemplo que rotan con efecto typewriter en el estado vacío. */
  examples: string[];
  unavailable: string;
  error: string;
  attach: string;
  collapse: string;
  expand: string;
  provider: string;
  providersView: string;
  backToChat: string;
  you: string;
  history: string;
  newChat: string;
  searchConversations: string;
  deleteConversation: string;
  allProjects: string;
  projectsTitle: string;
  looseChats: string;
  subProjects: string;
  noConversations: string;
  responding: string;
  jumpLatest: string;
  copy: string;
  copied: string;
  durationTitle: string;
  tokensTitle: string;
  unavailCreds: string;
  unavailFingerprint: string;
  unavailUnreachable: string;
  unavailGeneric: string;
  noData: string;
  approveFp: string;
  approving: string;
  refresh: string;
  refreshing: string;
  justNow: string;
};
