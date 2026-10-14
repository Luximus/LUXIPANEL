import { createReadCache, listReadTtl } from "../../lib/list-read-cache";
import { createConversationOpenReader } from "../../lib/conversation-open";
import { getDirect, subscribeDirectSessions } from "../serverApi";
const reads = createReadCache(), opens = createConversationOpenReader();
export function invalidateAssistantReads() { reads.clear(); opens.clear(); }
let subscribed = false;
const unsupported = new Map<string, number>();
export async function luxAssistantProxy<T = unknown>(panelId: string, token: string, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T | null> {
  if (!subscribed) { subscribeDirectSessions(invalidateAssistantReads); subscribed = true; }
  if (method !== "GET") { invalidateAssistantReads(); try { return await uncachedAssistantProxy<T>(panelId, token, method, path, body); } finally { invalidateAssistantReads(); } }
  const scope = JSON.stringify([panelId, token, getDirect(panelId)?.jwt]);
  const read = async <R,>(route: string): Promise<R | null> => {
    try { return (await reads.read(scope + route, async () => { const data = await uncachedAssistantProxy<R>(panelId, token, "GET", route); return { ok: data !== null, data }; }, listReadTtl(route) ?? 0)).data; } catch { return null; }
  };
  const catalog = ({ "/api/ai/agents": "agents", "/api/ai/agent-roles": "roles", "/api/ai/projects": "projects", "/api/ai/config": "config", "/api/ai/connectors": "connectors" } as Record<string,string>)[path];
  if (catalog && (unsupported.get(scope) ?? 0) <= Date.now()) {
    const bootstrap = await read<{ catalogs?: Record<string, unknown> }>("/api/ai/bootstrap");
    if (bootstrap?.catalogs?.[catalog]) return bootstrap.catalogs[catalog] as T;
    if (!bootstrap) unsupported.set(scope, Date.now() + 30_000);
  }
  return opens.read(scope, path, read);
}
import { ENV } from "../../config/env";
import { requestRaw } from "./request";

/** Proxy genérico a /api/ai/* de LUXIPANEL por el túnel (conversaciones/proyectos).
 *  Devuelve el `data` del panel (el cuerpo de LUXIPANEL) o null si falla. */
async function uncachedAssistantProxy<T = unknown>(
  panelId: string,
  token: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T | null> {
  try {
    const result = await requestRaw(`/portal/ssh/assistant/proxy`, token, {
      method: "POST",
      body: JSON.stringify({ panelId, method, path, ...(body !== undefined ? { body } : {}) }),
    });
    const envelope = result.data as ({ ok?: boolean; status?: number; data?: T } & Record<string, unknown>) | null;
    if (!result.ok || !envelope || envelope.ok === false) return null;
    return (envelope.data !== undefined ? envelope.data : envelope) as T;
  } catch {
    return null;
  }
}

export type RedactedAssistantProvider = {
  id: string;
  mode?: string;
  model?: string;
  installed?: boolean;
  loggedIn?: boolean;
  apiKeyHint?: string;
  hasApiKey?: boolean;
};

/** Catálogo redactado de proveedores: nunca incluye `apiKey`. */
export async function getServerAssistantProviderDetails(
  panelId: string,
  token: string,
): Promise<{ providers: RedactedAssistantProvider[]; defaultProvider: string | null; defaultModel: string | null } | null> {
  try {
    const result = await requestRaw(`/portal/ssh/assistant/providers`, token, {
      method: "POST",
      body: JSON.stringify({ panelId }),
    });
    const root = result.data as {
      ok?: boolean;
      data?: { providers?: RedactedAssistantProvider[]; defaultProvider?: string | null; defaultModel?: string | null };
      providers?: RedactedAssistantProvider[];
      defaultProvider?: string | null;
      defaultModel?: string | null;
    } | null;
    const body = root?.data ?? root;
    if (!result.ok || !body) return null;
    return {
      providers: Array.isArray(body.providers) ? body.providers : [],
      defaultProvider: typeof body.defaultProvider === "string" ? body.defaultProvider : null,
      defaultModel: typeof body.defaultModel === "string" ? body.defaultModel : null,
    };
  } catch {
    return null;
  }
}

/** Proveedores IA habilitados en el módulo del servidor (para el selector). */
export async function getServerAssistantProviders(
  panelId: string,
  token: string,
): Promise<{ providers: string[]; activeProvider?: string } | null> {
  const details = await getServerAssistantProviderDetails(panelId, token);
  if (!details) return null;
  const enabled = details.providers
    .filter((provider) => provider.loggedIn || provider.hasApiKey)
    .map((provider) => provider.id);
  return { providers: enabled, activeProvider: details.defaultProvider ?? undefined };
}

/** Evento del stream del asistente del servidor (passthrough del SSE de LUXIPANEL). */
export type AssistantEvent =
  | { type: "text"; delta?: string }
  | { type: "tool_use"; id?: string; name?: string; input?: unknown }
  | { type: "tool_result"; id?: string; success?: boolean; output?: string }
  | { type: "status"; state?: string }
  | { type: "usage"; model?: string; inputTokens?: number; outputTokens?: number; estimated?: boolean }
  // Tarjetas interactivas (mismo contrato que el chat de soporte). El agente del
  // servidor hoy no las emite, pero el passthrough las conserva por paridad.
  | { type: "client_action"; action?: unknown }
  | { type: "error"; message?: string }
  | { type: "done" };

export type AssistantUnavailable = "NO_CREDENTIALS" | "FINGERPRINT_PENDING" | "ASSISTANT_UNAVAILABLE" | "ERROR";
export type AssistantStreamResult = { ok: true } | { ok: false; code: AssistantUnavailable };

const ASSISTANT_UNAVAILABLE_CODES: AssistantUnavailable[] = ["NO_CREDENTIALS", "FINGERPRINT_PENDING", "ASSISTANT_UNAVAILABLE"];

/**
 * Asistente IA del servidor (POST /portal/ssh/assistant). Si el panel no tiene
 * servidor/huella o el asistente no está, el backend responde JSON `{ok:false,code}`;
 * si todo bien, responde SSE en streaming y vamos invocando `onEvent` por evento.
 * Usa fetch+ReadableStream (no electronApi) para poder leer el stream.
 */
export async function streamServerAssistant(
  panelId: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  token: string,
  onEvent: (event: AssistantEvent) => void,
  signal?: AbortSignal,
  opts?: { provider?: string; attachment?: { name: string; dataBase64: string }; conversationId?: string },
): Promise<AssistantStreamResult> {
  try {
    const res = await fetch(`${ENV.apiUrl}/portal/ssh/assistant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        panelId,
        messages,
        withContext: true,
        ...(opts?.provider ? { provider: opts.provider } : {}),
        ...(opts?.attachment ? { attachments: [opts.attachment] } : {}),
        ...(opts?.conversationId ? { conversationId: opts.conversationId } : {}),
      }),
      signal,
    });
    const ctype = res.headers.get("content-type") ?? "";
    if (ctype.includes("application/json") || !res.body) {
      const body = (await res.json().catch(() => null)) as { code?: string } | null;
      const code = (ASSISTANT_UNAVAILABLE_CODES as string[]).includes(body?.code ?? "")
        ? (body!.code as AssistantUnavailable)
        : "ERROR";
      return { ok: false, code };
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const rawEvent = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const dataLine = rawEvent.split("\n").find((l) => l.startsWith("data:"));
        if (!dataLine) continue;
        const json = dataLine.slice(5).trim();
        if (!json) continue;
        try { onEvent(JSON.parse(json) as AssistantEvent); } catch { /* ignore malformed event */ }
      }
    }
    return { ok: true };
  } catch (error) {
    if ((error as { name?: string } | null)?.name === "AbortError") return { ok: true };
    return { ok: false, code: "ERROR" };
  }
}
