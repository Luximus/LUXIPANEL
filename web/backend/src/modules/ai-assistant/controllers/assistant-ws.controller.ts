import { verifyWsAuthorization } from "../../../shared/websocket/live-auth.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Assistant WebSocket controller — /api/assistant/ws
 *
 * Persistente canal de progreso del asistente para el cliente: publica cambios
 * de tareas delegadas (AI_TEAM_TASK_UPDATE) a TODAS las sesiones abiertas del
 * usuario autenticado en el mismo servidor, incluso si el run del líder terminó.
 * Es el camino de "failsafe" para los team_task_update que el SSE del líder
 * ya no entrega (run cerrado, drawer no suscrito, pestaña oculta).
 *
 * Protocol (JSON messages):
 *
 *   Server → Client (on connect):
 *     { type: "assistant:hello", ts }
 *
 *   Client → Server (heartbeat, opcional):
 *     { type: "assistant:ping" }
 *     Server → Client: { type: "assistant:pong", ts }
 *
 *   Server → Client (broadcast to all the user's sockets):
 *     { type: "assistant.team_task_update", task, phase, correlationId,
 *       leaderConversationId, workerConversationId, ts }
 *
 * El frontend dedupe por `correlationId` (si también le llegó por SSE del
 * líder, lo descarta). Solo lo reciben sockets del mismo servidor y usuario.
 *
 * The `type` string VALUES are the SSOT `AssistantWsTypes` in
 * `shared/assistant-ws-types.ts`. CROSS-REFERENCE: the frontend twin lives in
 * `frontend/src/lib/assistant-ws.ts` — keep both in sync (separate build
 * systems, can't share the const).
 */

import { WebSocket } from "ws";
import type { IncomingMessage } from "http";
import { apiLocaleFromRequest, apiErrorMessage } from "../../../shared/i18n/errors.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";
import { tokenService } from "../../auth/services/token.service.js";
import { AssistantWsTypes } from "../../../shared/assistant-ws-types.js";
import { extractWsToken, extractOverrideBridgeId, wsConnKey, wsSend } from "../../../shared/websocket/upgrade-auth.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import type { TeamTaskView } from "../models/team-task.types.js";
import { canUseModule, hasActionPermission } from "../../../shared/auth/role-permissions.js";
import { moduleRegistryService } from "../../admin/services/module-registry.service.js";
import { runWithExecutor, localExecutor, getDirectExecutorByBridgeSessionId } from "../../../shared/executor/index.js";
import { resolveOverrideBridge } from "../../../shared/session/bridge-header.js";
import { isHostingSession } from "../../../shared/tenant/tenant-scope.js";

const log = createModuleLogger("assistant:ws");

type TaskUpdatePhase = "assigned" | "dispatched" | "verify" | "closed";

interface TaskUpdatePayload {
  targetId: string;
  task: TeamTaskView;
  phase: TaskUpdatePhase;
  correlationId: string;
  userId: string | null;
  leaderConversationId: string;
  workerConversationId: string;
}

/**
 * `<targetId>:<userId>` → sockets del usuario. Misma clave compuesta que
 * ui-sync: el userId numérico solo es único dentro de un servidor, y un
 * broadcast cross-target filtraría UI state entre cajas distintas.
 */
const connections = new Map<string, Set<WebSocket>>();

// B-02: `connKey`/`parseCookies`/`extractToken`/`send` were copy-pasted across
// four WS endpoints. They now come from `shared/websocket/upgrade-auth.ts`,
// which resolves the token COOKIE-FIRST — this copy used to read `?token=`
// first, putting a JWT in every proxy access log.
const connKey = wsConnKey;
const extractToken = extractWsToken;
const send = wsSend;

function broadcastAll(key: string, payload: Record<string, unknown>): void {
  const sockets = connections.get(key);
  if (!sockets) return;
  for (const ws of sockets) send(ws, payload);
}

/** Whether a task update belongs to both this server and this user. */
function belongsToUserKey(payload: TaskUpdatePayload, key: string): boolean {
  // The event carries the task owner's numeric id as a string. Events without
  // an owner or an originating server never reach authenticated sockets.
  if (!payload.userId) return false;
  return typeof payload.targetId === "string" && key === connKey(Number(payload.userId), payload.targetId);
}

function makeOnUpdate(userKey: string) {
  return (payload: unknown): void => {
    const p = payload as TaskUpdatePayload | undefined;
    if (!p || typeof p !== "object") return;
    if (!belongsToUserKey(p, userKey)) return;
    broadcastAll(userKey, {
      type: AssistantWsTypes.TEAM_TASK_UPDATE,
      task: p.task,
      phase: p.phase,
      correlationId: p.correlationId,
      leaderConversationId: p.leaderConversationId,
      workerConversationId: p.workerConversationId,
      ts: new Date().toISOString(),
    });
  };
}

export async function handleAssistantConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
  const locale = apiLocaleFromRequest(req);
  const token = extractToken(req);
  if (!token) {
    send(ws, { type: "error", message: apiModuleMessage(locale, "wsUnauthorized") });
    ws.close(4001, "Unauthorized");
    return;
  }

  const payload = await verifyWsAuthorization(req);
  if (!payload) {
    send(ws, { type: "error", message: apiModuleMessage(locale, "wsInvalidToken") });
    ws.close(4001, "Invalid token");
    return;
  }

  const user = tokenService.toSessionUser(payload);
  if (payload.kind === "mfa_pending" || !canUseModule(user, "assistant") || !hasActionPermission(user, "assistant.read")) {
    send(ws, { type: "error", message: apiErrorMessage(locale, "forbidden") });
    ws.close(1008, "Forbidden");
    return;
  }

  if (ws.readyState !== 1) return;
  const userId = (payload as { userId?: unknown }).userId;
  if (typeof userId !== "number" || !Number.isFinite(userId)) {
    send(ws, { type: "error", message: apiModuleMessage(locale, "wsInvalidTokenPayload") });
    ws.close(4001, "Invalid token");
    return;
  }
  const overrideId = extractOverrideBridgeId(req);
  const override = await resolveOverrideBridge(overrideId, payload);
  if ((overrideId && overrideId !== payload.bridgeSessionId && !override)
    || (isHostingSession(user) && override && override.bridgeSessionId !== payload.bridgeSessionId)) {
    ws.close(1008, "Forbidden");
    return;
  }
  const executor = override || payload.direct
    ? await getDirectExecutorByBridgeSessionId(override?.bridgeSessionId ?? payload.bridgeSessionId ?? "")
    : localExecutor;
  if (!executor || !await runWithExecutor(executor, () => moduleRegistryService.isEnabled("assistant"))) {
    send(ws, { type: "error", message: apiErrorMessage(locale, "forbidden") });
    ws.close(1008, "Forbidden");
    return;
  }
  const key = connKey(userId, executor.target.id);
  const set = connections.get(key) ?? new Set<WebSocket>();
  set.add(ws);
  connections.set(key, set);
  log.info({ userId, key, open: set.size }, "assistant WS client connected");

  send(ws, { type: AssistantWsTypes.HELLO, ts: new Date().toISOString() });

  // Subscribe to the global task-update bus. One listener per user key — when
  // the first socket connects we install it, when the last disconnects we
  // remove it (cheaper than one listener per socket).
  let listener = listenerByKey.get(key);
  if (!listener) {
    listener = makeOnUpdate(key);
    listenerByKey.set(key, listener);
    eventBus.on(Events.AI_TEAM_TASK_UPDATE, listener);
  }
  activeSocketsByKey.set(ws, { key, listener });

  ws.on("message", (raw) => {
    let msg: Record<string, unknown> | undefined;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (msg?.type === AssistantWsTypes.PING) {
      send(ws, { type: AssistantWsTypes.PONG, ts: new Date().toISOString() });
    }
  });

  const cleanup = () => {
    const set = connections.get(key);
    if (set) {
      set.delete(ws);
      if (set.size === 0) connections.delete(key);
    }
    const meta = activeSocketsByKey.get(ws);
    if (meta && connections.get(key) == null) {
      eventBus.off(Events.AI_TEAM_TASK_UPDATE, meta.listener);
      listenerByKey.delete(key);
    }
    activeSocketsByKey.delete(ws);
    log.info({ userId, open: set?.size ?? 0 }, "assistant WS client disconnected");
  };

  ws.on("close", cleanup);
  ws.on("error", (err) => {
    log.error({ err, userId }, "assistant WS error");
    cleanup();
  });
}

// ---- module-level listener bookkeeping ----

interface SocketMeta {
  key: string;
  listener: (payload: unknown) => void;
}

const listenerByKey = new Map<string, (payload: unknown) => void>();
const activeSocketsByKey = new WeakMap<WebSocket, SocketMeta>();
