/**
 * Transporte DIRECTO del asistente IA nativo (servidor STANDALONE, modo directo).
 *
 * Espeja `client/assistant.ts` — que enruta por el TÚNEL managed
 * (`luxAssistantProxy` / `POST /portal/ssh/assistant`) — pero habla DIRECTO al
 * box por `serverApi`/DirectTarget:
 *
 *   - JSON (conversaciones · proyectos · config · mensajes · borrado) →
 *     `callServerApi(serverId, "", …)`. Cuando el `serverId` está registrado como
 *     DirectTarget, despacha por el proceso main de Electron (sin CORS ni timeout
 *     de stream; en `dev:web` cae al `fetch` del navegador). Las rutas `/api/ai/*`
 *     del box NO exigen CSRF (solo `requireAuth` Bearer), así que el JWT basta.
 *     El box responde el payload al NIVEL RAÍZ del JSON (`{ ok, conversations }`,
 *     `{ ok, config }`, `{ ok, conversation }`, `{ ok, messages }`), no anidado
 *     bajo `data`; por eso devolvemos `res.data` tal cual (= cuerpo del box) y el
 *     consumidor lee `.conversations` / `.config` / … igual que hacía con el
 *     `envelope.data` del proxy managed.
 *
 *   - STREAM del run (SSE) → `fetch` + `ReadableStream` contra `POST /api/ai/agent`
 *     del box (Bearer JWT). NO puede ir por el bridge de Electron: ese bridge
 *     buffea la respuesta con un timeout de 20s y no expone el cuerpo
 *     incrementalmente. En un empaquetado Electron el `fetch` del renderer es
 *     cross-origin y depende de que el box permita el origen (CORS); por eso el
 *     run se arranca SIEMPRE con `conversationId` (run DESACOPLADO que persiste en
 *     el box) y el módulo recupera la respuesta por sondeo si el stream no fluye.
 */
import { callServerApi, getDirect } from "./serverApi";
import type { AssistantEvent } from "./client";

export type DirectHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Llamada JSON directa a `/api/ai/*`. Devuelve el CUERPO del box (`{ ok, … }`) o
 * `null` si la petición falla. No lanza (paridad con `luxAssistantProxy`).
 */
export async function directAi<T = unknown>(
  serverId: string,
  method: DirectHttpMethod,
  path: string,
  body?: unknown,
): Promise<T | null> {
  const res = await callServerApi<T>(serverId, "", method, path, body);
  return res.ok ? ((res.data as T | undefined) ?? null) : null;
}

/** Igual que `directAi` pero informa ÉXITO/FALLO (para mutaciones optimistas). */
export async function directAiOk(
  serverId: string,
  method: DirectHttpMethod,
  path: string,
  body?: unknown,
): Promise<boolean> {
  const res = await callServerApi(serverId, "", method, path, body);
  return res.ok;
}

export type DirectAttachment = { name: string; mimeType: string; dataBase64: string };

export type DirectStreamOpts = {
  provider?: string;
  attachments?: DirectAttachment[];
  conversationId?: string;
  /** Agente seleccionado en la sidebar: el run conversa como ese agente (paridad web). */
  agentId?: string | null;
  /** Proyecto activo del chat nuevo (viaja en cada turno como en el túnel LP). */
  projectId?: string | null;
};

/** `UNAVAILABLE` = auth/target ausente (no reintentar como red); `ERROR` = caída
 *  de transporte con el run posiblemente vivo (recuperable por sondeo). */
export type DirectStreamCode = "UNAVAILABLE" | "ERROR";
export type DirectStreamResult =
  | { ok: true; events: number }
  | { ok: false; code: DirectStreamCode; events: number };

function agentBody(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  opts?: DirectStreamOpts,
): Record<string, unknown> {
  return {
    messages,
    withContext: true,
    ...(opts?.provider ? { provider: opts.provider } : {}),
    ...(opts?.attachments?.length ? { attachments: opts.attachments } : {}),
    ...(opts?.conversationId ? { conversationId: opts.conversationId } : {}),
    ...(opts?.agentId ? { agentId: opts.agentId } : {}),
    ...(opts?.projectId ? { projectId: opts.projectId } : {}),
  };
}

/**
 * Streamea un run del asistente DIRECTO contra el box (`POST /api/ai/agent`, SSE).
 * Réplica del `streamServerAssistant` managed pero apuntando al DirectTarget.
 * Invoca `onEvent` por cada evento del passthrough SSE del box. `events` en el
 * resultado permite al llamador decidir si el stream llegó a conectar (0 eventos
 * + `ERROR` ⇒ el `fetch` cross-origin no alcanzó al box → arrancar por bridge).
 */
export async function streamDirectAssistant(
  serverId: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  onEvent: (event: AssistantEvent) => void,
  signal?: AbortSignal,
  opts?: DirectStreamOpts,
): Promise<DirectStreamResult> {
  const direct = getDirect(serverId);
  if (!direct) return { ok: false, code: "UNAVAILABLE", events: 0 };
  let events = 0;
  try {
    const res = await fetch(`${direct.baseUrl}/api/ai/agent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${direct.jwt}`,
        Accept: "text/event-stream",
        "x-client-platform": "desktop",
      },
      body: JSON.stringify(agentBody(messages, opts)),
      signal,
    });
    const ctype = res.headers.get("content-type") ?? "";
    // JSON en vez de SSE = el box rechazó/negó el run (401/403 auth, error de
    // validación). No hay stream que leer.
    if (!res.ok || !res.body || ctype.includes("application/json")) {
      const code: DirectStreamCode = res.status === 401 || res.status === 403 ? "UNAVAILABLE" : "ERROR";
      return { ok: false, code, events };
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
        try {
          onEvent(JSON.parse(json) as AssistantEvent);
          events += 1;
        } catch {
          /* evento malformado: ignóralo, no tumbes el stream */
        }
      }
    }
    return { ok: true, events };
  } catch (error) {
    if ((error as { name?: string } | null)?.name === "AbortError") return { ok: true, events };
    return { ok: false, code: "ERROR", events };
  }
}

/**
 * Arranque BEST-EFFORT del run por el bridge de Electron (sin CORS) cuando el
 * `fetch` de streaming no pudo siquiera alcanzar al box (empaquetado Electron con
 * CORS restrictivo). El run lleva `conversationId` ⇒ es DESACOPLADO: sigue vivo y
 * persistiendo en el box aunque el bridge corte a los 20s. No se espera: la
 * respuesta se recupera por sondeo de `/conversations/:id/messages`.
 */
export function startDirectRunViaBridge(
  serverId: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  opts: DirectStreamOpts & { conversationId: string },
): void {
  void callServerApi(serverId, "", "POST", "/api/ai/agent", agentBody(messages, opts)).catch(() => undefined);
}

/** Detiene el run desacoplado en el box (paridad con el botón "Detener" web). */
export function stopDirectRun(serverId: string, conversationId: string): void {
  void callServerApi(serverId, "", "POST", "/api/ai/agent/stop", { conversationId }).catch(() => undefined);
}
