import { getDirect, invalidateServerCache, type DirectTarget } from "./serverApi";

export type DirectAgentEvent = {
  type: string;
  delta?: string;
  message?: string;
  name?: string;
  title?: string;
  detail?: string;
  id?: string;
  kind?: "plan-approval";
  questions?: Array<{ id: string; text: string; options?: string[]; type?: string }>;
};

/** Decodes incremental SSE frames; incomplete frames stay buffered. */
export function takeAgentEvents(buffer: string): { events: DirectAgentEvent[]; rest: string } {
  const events: DirectAgentEvent[] = [];
  const normalized = buffer.replace(/\r\n/g, "\n");
  let start = 0;
  let end: number;
  while ((end = normalized.indexOf("\n\n", start)) !== -1) {
    const frame = normalized.slice(start, end);
    start = end + 2;
    const data = frame.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
    if (!data) continue;
    try {
      const event = JSON.parse(data) as DirectAgentEvent;
      if (event && typeof event.type === "string") events.push(event);
    } catch { /* Ignore malformed server events. */ }
  }
  return { events, rest: normalized.slice(start) };
}

export type DirectAgentResult = { ok: true } | { ok: false; error: string; code?: string };

// Una conexión SSE puede permanecer abierta sin cerrar ni emitir eventos si
// el túnel móvil pierde la red. El límite mide INACTIVIDAD, no duración del run.
const AGENT_IDLE_TIMEOUT_MS = 180_000;

/** Streams the panel's interactive agent into RN without a WebView. */
export function streamDirectAgent(
  panelId: string,
  body: { model?: string; effort?: "low" | "medium" | "high" | "xhigh"; agentId?: string; projectId?: string; messages: Array<{ role: "user" | "assistant"; content: string }>; conversationId?: string; planDecision?: "approve"; provider?: string; approvalMode?: "manual" | "auto" | "plan"; attachments?: Array<{ name: string; dataBase64: string; mime: string }> },
  onEvent: (event: DirectAgentEvent) => void,
  registerAbort?: (abort: () => void) => void,
): Promise<DirectAgentResult> {
  return new Promise((resolve) => {
    let settled = false;
    let cancelled = false;
    let xhr: XMLHttpRequest | null = null;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const finish = (result: DirectAgentResult) => {
      if (settled) return;
      settled = true;
      if (idleTimer) clearTimeout(idleTimer);
      invalidateServerCache(panelId);
      resolve(result);
    };
    const armIdleTimer = (request: XMLHttpRequest) => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        finish({ ok: false, error: "La conexión con el agente dejó de responder." });
        try { request.abort(); } catch { /* la conexión ya se cerró */ }
      }, AGENT_IDLE_TIMEOUT_MS);
    };
    registerAbort?.(() => {
      cancelled = true;
      try { xhr?.abort(); } catch { /* already closed */ }
      finish({ ok: false, error: "Operación detenida" });
    });

    const start = (target: DirectTarget, retried: boolean) => {
      if (cancelled) return;
      xhr = new XMLHttpRequest();
      const request = xhr;
      let seen = 0;
      let buffer = "";
      let agentError: string | null = null;
      let done = false;
      const drain = () => {
        if (cancelled || getDirect(panelId)?.bridgeSessionId !== target.bridgeSessionId || getDirect(panelId)?.baseUrl !== target.baseUrl) { finish({ ok: false, error: "connect_required" }); request.abort(); return; }
        const responseText = request.responseText ?? "";
        buffer += responseText.slice(seen);
        seen = responseText.length;
        const parsed = takeAgentEvents(buffer);
        buffer = parsed.rest;
        for (const event of parsed.events) {
          if (event.type === "error") agentError = event.message ?? "Error del agente";
          if (event.type === "done") done = true;
          onEvent(event);
        }
      };
      request.open("POST", `${target.baseUrl}/api/ai/agent`);
      request.withCredentials = false;
      request.setRequestHeader("Content-Type", "application/json");
      request.setRequestHeader("Accept", "text/event-stream");
      request.setRequestHeader("Authorization", `Bearer ${target.jwt}`);
      request.setRequestHeader("x-client-platform", "app");
      if (target.bridgeSessionId) request.setRequestHeader("X-Bridge-Session-Id", target.bridgeSessionId);
      if (target.csrf) {
        request.setRequestHeader("X-CSRF-Token", target.csrf.value);
        request.setRequestHeader("Cookie", `${target.csrf.name}=${target.csrf.value}`);
      }
      request.onprogress = () => {
        // RN puede entregar los primeros bytes antes de exponer Content-Type.
        // El parser solo acepta frames `data:` JSON, así que podemos drenar
        // desde el primer progreso sin esperar esa cabecera.
        if (!cancelled && request.status < 400 && (request.responseText?.length ?? 0) > seen) {
          armIdleTimer(request);
          try { drain(); }
          catch {
            finish({ ok: false, error: "No se pudo procesar la respuesta del agente." });
            request.abort();
          }
        }
      };
      request.onload = () => {
        if (cancelled) return;
        if (request.status === 401 && !retried && target.relogin) {
          if (idleTimer) clearTimeout(idleTimer);
          void target.relogin().then((fresh) => fresh ? start(fresh, true) : finish({ ok: false, error: "Vuelve a conectar el servidor.", code: "DIRECT_AUTH_REQUIRED" })).catch(() => finish({ ok: false, error: "Vuelve a conectar el servidor.", code: "DIRECT_AUTH_REQUIRED" }));
          return;
        }
        if (request.status >= 400) {
          let reason = `HTTP ${request.status}`;
          try { const payload = JSON.parse(request.responseText) as { error?: string; message?: string }; reason = payload.error ?? payload.message ?? reason; } catch { /* server response may not be JSON */ }
          finish({ ok: false, error: reason, code: request.status === 401 ? "DIRECT_AUTH_REQUIRED" : [400, 413, 422].includes(request.status) ? "REJECTED" : "ERROR" });
          return;
        }
        try { drain(); }
        catch { finish({ ok: false, error: "No se pudo procesar la respuesta del agente." }); return; }
        finish(agentError ? { ok: false, error: agentError } : done ? { ok: true } : { ok: false, error: "El agente interrumpió la respuesta." });
      };
      request.onerror = () => { if (!cancelled) finish({ ok: false, error: "No se pudo conectar con el agente." }); };
      request.onabort = () => { if (!cancelled) finish({ ok: false, error: "La conexión con el agente se interrumpió." }); };
      armIdleTimer(request);
      request.send(JSON.stringify({
        ...body,
        // El store móvil usa `mime`; el contrato del panel exige `mimeType`.
        // Omitirlo hacía que cualquier envío con archivo terminara en HTTP 400.
        attachments: body.attachments?.map(({ name, dataBase64, mime }) => ({ name, dataBase64, mimeType: mime })),
        withContext: true,
      }));
    };

    const target = getDirect(panelId);
    if (!target) { finish({ ok: false, error: "Conecta el servidor antes de usar el agente.", code: "DIRECT_AUTH_REQUIRED" }); return; }
    start(target, false);
  });
}
