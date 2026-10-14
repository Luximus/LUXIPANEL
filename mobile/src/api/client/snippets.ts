// ── Snippets del terminal (LUXIPANEL) ────────────────────────────────
// Conectados al MISMO origen que el módulo terminal del panel: tunelizamos
// `/api/terminal/snippets*` por el proxy SSO (igual que los chats). La sesión
// del túnel es la del usuario SSH → devuelve SUS snippets/categorías/tags.
import { luxAssistantProxy } from "./assistant";

export interface ServerSnippet {
  id: number;
  categoryId: number;
  name: string;
  command: string;
  tagIds: number[];
}
export interface ServerSnippetCategory {
  id: number;
  name: string;
}
export interface ServerSnippetTag {
  id: number;
  categoryId: number;
  name: string;
}
export interface ServerSnippetState {
  categories: ServerSnippetCategory[];
  tags: ServerSnippetTag[];
  snippets: ServerSnippet[];
}

/** Lee el estado de snippets del usuario (categorías + tags + snippets) por el
 *  túnel. `luxAssistantProxy` devuelve el body de LUXIPANEL tal cual
 *  (`{ ok, data }`), así que aquí desempaquetamos `.data`. */
export async function getServerSnippets(panelId: string, token: string): Promise<ServerSnippetState | null> {
  const body = await luxAssistantProxy<{ ok?: boolean; data?: ServerSnippetState }>(
    panelId, token, "GET", "/api/terminal/snippets",
  );
  const state = body?.data;
  if (!state) return null;
  return {
    categories: Array.isArray(state.categories) ? state.categories : [],
    tags: Array.isArray(state.tags) ? state.tags : [],
    snippets: Array.isArray(state.snippets) ? state.snippets : [],
  };
}

export interface SnippetInput {
  name: string;
  categoryId: number;
  command: string;
  tagIds: number[];
}

export function createServerSnippet(panelId: string, token: string, input: SnippetInput) {
  return luxAssistantProxy(panelId, token, "POST", "/api/terminal/snippets", input);
}
export function updateServerSnippet(panelId: string, token: string, id: number, input: SnippetInput) {
  return luxAssistantProxy(panelId, token, "PATCH", `/api/terminal/snippets/${id}`, input);
}
export function deleteServerSnippet(panelId: string, token: string, id: number) {
  return luxAssistantProxy(panelId, token, "DELETE", `/api/terminal/snippets/${id}`);
}

export function createServerSnippetCategory(panelId: string, token: string, name: string) {
  return luxAssistantProxy(panelId, token, "POST", "/api/terminal/snippets/categories", { name });
}
export function updateServerSnippetCategory(panelId: string, token: string, id: number, name: string) {
  return luxAssistantProxy(panelId, token, "PATCH", `/api/terminal/snippets/categories/${id}`, { name });
}
export function deleteServerSnippetCategory(panelId: string, token: string, id: number) {
  return luxAssistantProxy(panelId, token, "DELETE", `/api/terminal/snippets/categories/${id}`);
}

export function createServerSnippetTag(panelId: string, token: string, categoryId: number, name: string) {
  return luxAssistantProxy(panelId, token, "POST", "/api/terminal/snippets/tags", { categoryId, name });
}
export function updateServerSnippetTag(panelId: string, token: string, id: number, categoryId: number, name: string) {
  return luxAssistantProxy(panelId, token, "PATCH", `/api/terminal/snippets/tags/${id}`, { categoryId, name });
}
export function deleteServerSnippetTag(panelId: string, token: string, id: number) {
  return luxAssistantProxy(panelId, token, "DELETE", `/api/terminal/snippets/tags/${id}`);
}

// ── Historial de conversaciones del terminal (Codex/Claude) ──────────
// Server-backed en LUXIPANEL (`~/.codex/history.jsonl`, `~/.claude/history.jsonl`),
// expuesto por `/api/terminal/conversations` y tunelizado por el mismo proxy SSO.
// Requiere permiso `terminal.manage` en la sesión del túnel.

export type ConversationSource = "codex" | "claude";
export interface ServerConversation {
  source: ConversationSource;
  sessionId: string;
  title: string;
  startedAt: number;
  updatedAt: number;
  entryCount: number;
  project?: string | null;
  preview: string;
  transcript: string;
}

/** Lista combinada (codex + claude) del historial de conversaciones. */
export async function getServerConversations(
  panelId: string,
  token: string,
): Promise<{ codex: ServerConversation[]; claude: ServerConversation[] } | null> {
  const body = await luxAssistantProxy<{ ok?: boolean; data?: { codex?: ServerConversation[]; claude?: ServerConversation[] } }>(
    panelId, token, "GET", "/api/terminal/conversations",
  );
  const data = body?.data;
  if (!data) return null;
  return {
    codex: Array.isArray(data.codex) ? data.codex : [],
    claude: Array.isArray(data.claude) ? data.claude : [],
  };
}

/** Borra conversaciones del historial (por sesión) de una fuente. */
export function deleteServerConversations(
  panelId: string,
  token: string,
  source: ConversationSource,
  sessionIds: string[],
) {
  return luxAssistantProxy(panelId, token, "DELETE", "/api/terminal/conversations", { source, sessionIds });
}
