import { createConversationOpenReader } from "../../lib/conversation-open";
import { registerStoreReset } from "../../lib/store-reset";
import { createReadCache, listReadTtl } from "../../lib/list-read-cache";
import { callServerApi, unwrap, getDirectSessionRevision, subscribeDirectSessions, withFreshGateway } from "../serverApi";
import { ensureDirectPanelSession } from "../terminalSession";
const reads = createReadCache();
const opens = createConversationOpenReader();
export function invalidateAssistantReads() { reads.clear(); opens.clear(); }
subscribeDirectSessions(invalidateAssistantReads);
registerStoreReset(invalidateAssistantReads);
const unsupported = new Map<string, number>();
export async function luxAssistantProxy<T = unknown>(panelId: string, token: string, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T | null> {
  if (method !== "GET") {
    invalidateAssistantReads();
    try { return await uncachedAssistantProxy<T>(panelId, token, method, path, body); }
    finally { invalidateAssistantReads(); }
  }
  const scope = JSON.stringify([panelId, token, getDirectSessionRevision(panelId)]);
  const read = async <R,>(route: string) => {
    try { return (await reads.read(scope + route, async () => {
      const data = await uncachedAssistantProxy<R>(panelId, token, "GET", route);
      return { ok: data !== null, data };
    }, listReadTtl(route) ?? 0)).data; } catch { return null; }
  };
  const key = ({ "/api/ai/agents": "agents", "/api/ai/agent-roles": "roles", "/api/ai/projects": "projects", "/api/ai/config": "config", "/api/ai/connectors": "connectors" } as Record<string, string>)[path];
  if (key && (unsupported.get(scope) ?? 0) <= Date.now()) {
    const boot = await read<{ catalogs?: Record<string, unknown> }>("/api/ai/bootstrap");
    if (boot?.catalogs?.[key]) return boot.catalogs[key] as T;
    if (!boot) unsupported.set(scope, Date.now() + 30_000);
  }
  return opens.read(scope, path, route => read<T>(route));
}
import { streamDirectAgent } from "../directAgent";
import { type ReadOptions, readCache, TTL } from "./request";

/** Lecturas y mutaciones a /api/ai/* de LUXIPANEL directo (conversaciones,
 *  proyectos y configuración de proveedores — el backend acepta también PUT). */
async function uncachedAssistantProxy<T = unknown>(
  panelId: string,
  token: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T | null> {
  try {
    if (await ensureDirectPanelSession(panelId, token)) {
      const result = await withFreshGateway(() => callServerApi<T>(panelId, token, method, path, body));
      return result.ok ? result.data as T : null;
    }
    return null;

  } catch (e) {
    if (__DEV__) console.warn(`[luxAssistantProxy] ${method} ${path} → excepción`, e);
    return null;
  }
}

/** Variante de `luxAssistantProxy` que responde ÉXITO/FALLO en vez de datos.
 *  Para mutaciones optimistas (rename/pin/delete del drawer): `luxAssistantProxy`
 *  nunca lanza y devuelve `null` tanto en fallo como en éxito sin body, así que
 *  un `.catch()` sobre ella jamás revierte nada. Aquí el éxito es "el upstream
 *  respondió < 400", tenga o no body. */
export async function luxAssistantProxyOk(
  panelId: string,
  token: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<boolean> {
  invalidateAssistantReads();
  try {
    if (await ensureDirectPanelSession(panelId, token)) return (await callServerApi(panelId, token, method, path, body)).ok;
    return false;
  } catch (e) {
    if (__DEV__) console.warn(`[luxAssistantProxyOk] ${method} ${path} → excepción`, e);
    return false;
  } finally { invalidateAssistantReads(); }
}

/** Proveedores IA habilitados en el módulo del servidor (para el selector). */
export async function getServerAssistantProviders(
  panelId: string,
  token: string,
): Promise<{ providers: string[]; activeProvider?: string } | null> {
  try {
    const response = await luxAssistantProxy<{ config?: { providers?: Record<string, { active?: boolean }>; defaultChatProvider?: string; activeProvider?: string }; data?: { config?: { providers?: Record<string, { active?: boolean }>; defaultChatProvider?: string; activeProvider?: string } } }>(panelId, token, "GET", "/api/ai/config");
    const config = response?.config ?? response?.data?.config;
    if (!config) return null;
    return { providers: Object.entries(config.providers ?? {}).filter(([, value]) => value.active).map(([id]) => id), activeProvider: config.defaultChatProvider ?? config.activeProvider };
  } catch {
    return null;
  }
}

/** Módulos permitidos del usuario SSH de la conexión en background (assistant/
 *  terminal). Gatea los botones "Empezar conversación" / "Nueva terminal".
 *  `available` lista los módulos de LUXIPANEL habilitados en el servidor Y
 *  permitidos al usuario SSH (la misma lógica del sidebar del panel) para el
 *  modal "Más herramientas". */
export interface ServerModulePermissions {
  assistant: boolean;
  terminal: boolean;
  available: { id: string; name?: string }[];
  error?: string;
}

/** Lee los módulos permitidos del usuario SSH del servidor (desde la sesión directa del panel). Los errores se muestran y permiten reintentar; no se interpretan como un catálogo vacío. */
export async function getServerModulePermissions(
  panelId: string,
  token: string,
  opts?: ReadOptions,
): Promise<ServerModulePermissions> {
  try {
    // Cuesta un round-trip por el TÚNEL SSH (cientos de ms) y lo pide CADA
    // montaje de la portada del carousel / del chat de cada panel. TTL 5 min +
    // single-flight: los permisos del usuario SSH no cambian dentro de la sesión.
    // El fetcher LANZA ante fallo → el fallback no-restrictivo no se cachea.
    return await readCache.fetch(`modulePerms|${panelId}|${token}|${getDirectSessionRevision(panelId)}`, async () => {
      if (!await ensureDirectPanelSession(panelId, token)) throw new Error("No se pudo conectar con las credenciales guardadas.");
      const result = await callServerApi(panelId, token, "GET", "/api/me/modules");
      const body = unwrap<{ modules?: { assistant?: boolean; terminal?: boolean }; available?: { id: string; name?: string }[] }>(result);
      if (!body || !Array.isArray(body.available)) throw new Error(result.error ?? "No se pudieron cargar los módulos del servidor.");
      return { assistant: body.modules?.assistant === true, terminal: body.modules?.terminal === true, available: body.available };

    }, { ttlMs: TTL.modulePerms, force: opts?.force });
  } catch (cause) {
    return { assistant: false, terminal: false, available: [], error: cause instanceof Error ? cause.message : "No se pudieron cargar los módulos." };
  }
}

/** Pregunta interactiva del protocolo "ask" (CLI agente). Espejo de
 *  `AskQuestion` del backend de LUXIPANEL. */
export type AssistantAskQuestion = {
  id: string;
  text: string;
  type: "single" | "multi" | "text";
  options?: string[];
};

/** Evento del stream del asistente (passthrough del SSE de LUXIPANEL). */
export type AssistantEvent =
  | { type: "text"; delta?: string }
  | { type: "tool_use"; id?: string; name?: string; input?: unknown }
  | { type: "tool_result"; id?: string; success?: boolean; output?: string }
  | { type: "status"; state?: string }
  | { type: "usage"; [k: string]: unknown }
  // El agente CLI se detuvo a preguntar (única / múltiple / texto). El chat
  // renderiza controles seleccionables y reanuda con la respuesta.
  | { type: "ask"; id?: string; questions?: AssistantAskQuestion[]; kind?: "plan-approval" }
  // Gate de permisos mid-run (Claude CLI): el agente pide permiso para una
  // herramienta mutante. El chat pinta botones Aprobar/Aprobar siempre/Rechazar
  // y la decisión vuelve por `POST /api/ai/agent/permission`.
  | { type: "permission_request"; id?: string; tool?: string; title?: string; detail?: string }
  // El `permission_request` se resolvió (clic / timeout): limpia los botones.
  | { type: "permission_resolved"; id?: string; decision?: "allow" | "deny" }
  // La traducción en segundo plano falló tras reintentos: la respuesta llega sin
  // traducir y esto trae el motivo (aviso colapsable, no error duro).
  | { type: "translation_error"; message?: string }
  | { type: "error"; message?: string }
  | { type: "done" };

/** `REJECTED` = el gateway rechazó el POST antes de arrancar el run (p. ej.
 *  413 body demasiado grande, 400 de validación): NO hay run que recuperar,
 *  a diferencia de `ERROR` (caída de transporte con el run ya vivo). */
export type AssistantUnavailable = "NO_CREDENTIALS" | "FINGERPRINT_PENDING" | "ASSISTANT_UNAVAILABLE" | "REJECTED" | "ERROR";
export type AssistantStreamResult = { ok: true } | { ok: false; code: AssistantUnavailable; error?: string };


/**
 * Asistente IA del servidor en streaming (POST /api/ai/agent directo). RN no
 * expone ReadableStream fiable, así que usamos XMLHttpRequest + onprogress para
 * parsear el SSE incrementalmente. `register` expone un abort al llamador.
 */
export function streamServerAssistant(
  panelId: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  token: string,
  onEvent: (event: AssistantEvent) => void,
  opts?: { model?: string; effort?: "low" | "medium" | "high" | "xhigh"; agentId?: string; projectId?: string; provider?: string; attachments?: Array<{ name: string; dataBase64: string; mime: string }>; conversationId?: string; approvalMode?: "manual" | "auto" | "plan"; planDecision?: "approve"; register?: (abort: () => void) => void },
): Promise<AssistantStreamResult> {
  let cancelled = false;
  let abort: (() => void) | undefined;
  opts?.register?.(() => { cancelled = true; abort?.(); });
  return (async () => {
    if (!await ensureDirectPanelSession(panelId, token, () => !cancelled)) return { ok: false, code: "NO_CREDENTIALS" } as AssistantStreamResult;
    if (cancelled) return { ok: true } as AssistantStreamResult;
    const result = await streamDirectAgent(panelId, { messages, ...(opts?.model ? {model:opts.model} : {}), ...(opts?.effort ? {effort:opts.effort} : {}), ...(opts?.agentId ? {agentId:opts.agentId} : {}), ...(opts?.projectId ? {projectId:opts.projectId} : {}), ...(opts?.conversationId ? { conversationId: opts.conversationId } : {}), ...(opts?.provider ? { provider: opts.provider } : {}), ...(opts?.attachments ? { attachments: opts.attachments } : {}), ...(opts?.approvalMode ? { approvalMode: opts.approvalMode } : {}), ...(opts?.planDecision ? { planDecision: opts.planDecision } : {}) }, event => onEvent(event as AssistantEvent), fn => { abort = fn; if (cancelled) fn(); });
    return cancelled || result.ok ? { ok: true } as AssistantStreamResult : {
      ok: false,
      code: result.code === "DIRECT_AUTH_REQUIRED" ? "NO_CREDENTIALS" : result.code === "REJECTED" ? "REJECTED" : "ERROR",
      error: result.error,
    } as AssistantStreamResult;
  })();
}
