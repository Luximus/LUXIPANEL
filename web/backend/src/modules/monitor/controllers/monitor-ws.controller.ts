import { verifyWsAuthorization } from "../../../shared/websocket/live-auth.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Monitor WebSocket controller.
 *
 * Streams real-time system stats to connected clients over WebSocket.
 * Path: /api/monitor/ws
 *
 * Protocol (all messages are JSON):
 *
 *   Server → Client:
 *     { type: "connected" }
 *     { type: "stats",   data: StatsSnapshot }
 *     { type: "alert",   data: { id, name } }
 *     { type: "error",   message: string }
 *     { type: "pong" }
 *
 *   Client → Server:
 *     { type: "ping" }
 *     { type: "poll" }   — request immediate snapshot
 */

import { WebSocket } from "ws";
import { apiLocaleFromRequest, apiErrorMessage } from "../../../shared/i18n/errors.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";
import type { IncomingMessage } from "http";
import { tokenService } from "../../auth/services/token.service.js";
import { canUseModule, hasActionPermission } from "../../../shared/auth/role-permissions.js";
import { moduleRegistryService } from "../../admin/services/module-registry.service.js";
import { runWithExecutor } from "../../../shared/executor/context.js";
import { isHostingSession, getTenantEnvelope } from "../../../shared/tenant/tenant-scope.js";
import { PrivilegeDropExecutor } from "../../../shared/executor/privilege-drop-executor.js";
import { statsCollectorService } from "../services/stats-collector.service.js";
import { systemStatsService } from "../services/system-stats.service.js";
import { alertEvaluatorService } from "../services/alert-evaluator.service.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { resolveMonitorExecutor } from "../services/monitor-executor.service.js";
import { resolveOverrideBridge } from "../../../shared/session/bridge-header.js";
import {
  extractOverrideBridgeId,
  extractWsToken,
  wsSend,
} from "../../../shared/websocket/upgrade-auth.js";

const log = createModuleLogger("monitor:ws");

const BROADCAST_INTERVAL_MS = 5_000;

// Cookie parsing, token extraction (cookie BEFORE `?token=`, which would leak
// into proxy access logs), bridge-override id and the safe `send` all come from
// the shared WS upgrade helpers.
const extractToken = extractWsToken;
const send = wsSend;

const _clients = new Set<WebSocket>();
const clientScopes = new WeakMap<WebSocket, string>();

export function getMonitorWsClientCount(): number {
  return _clients.size;
}

/**
 * Collect the current snapshot for `scope` and send it as a `stats` message.
 *
 * `fallbackCollect` (initial/poll paths) synthesizes a fresh local snapshot
 * when the cache is empty; the periodic broadcaster passes `false` and simply
 * skips the message when there's nothing cached yet.
 */
async function pushStats(
  ws: WebSocket,
  executor: Awaited<ReturnType<typeof resolveMonitorExecutor>>,
  scope: string,
  opts: { fallbackCollect: boolean },
): Promise<void> {
  const snap = scope === "local"
    ? (opts.fallbackCollect
        ? (statsCollectorService.getLatest(scope) ?? await systemStatsService.collect())
        : statsCollectorService.getLatest(scope))
    : await statsCollectorService.collectWithExecutorCached(executor, scope);
  if (!snap) return;
  send(ws, {
    type: "stats",
    data: { ...snap, firingAlerts: alertEvaluatorService.firingRuleIds(scope) },
  });
}

/** Broadcast an alert event to all connected monitor WS clients. */
export function broadcastMonitorAlert(event: string, data: unknown): void {
  const scope = (data as { scope?: unknown } | null)?.scope;
  if (typeof scope !== "string") return;
  const payload = JSON.stringify({ type: event, data });
  for (const ws of _clients) {
    if (clientScopes.get(ws) !== scope) continue;
    try {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    } catch { /* ignore */ }
  }
}

export async function handleMonitorConnection(
  ws: WebSocket,
  req: IncomingMessage,
): Promise<void> {
  // ── Auth ──────────────────────────────────────────────────
  const locale = apiLocaleFromRequest(req);
  const token = extractToken(req);
  if (!token) {
    send(ws, { type: "error", message: apiModuleMessage(locale, "wsAuthenticationRequired") });
    ws.close(1008, "Unauthorized");
    return;
  }

  const payload = await verifyWsAuthorization(req);
  if (!payload) {
    send(ws, { type: "error", message: apiModuleMessage(locale, "wsInvalidSession") });
    ws.close(1008, "Unauthorized");
    return;
  }

  const user = tokenService.toSessionUser(payload);
  if (payload.kind !== "admin" || !canUseModule(user, "monitor") || !hasActionPermission(user, "monitor.read")) {
    send(ws, { type: "error", message: apiErrorMessage(locale, "forbidden") });
    ws.close(1008, "Forbidden");
    return;
  }

  if (ws.readyState !== 1) return;
  _clients.add(ws);
  log.info({ userId: payload.userId, total: _clients.size }, "Monitor WS connected");

  // ── Send initial snapshot ─────────────────────────────────
  send(ws, { type: "connected" });

  // Per-tab override: the shared session cookie is rewritten on every server
  // switch, so a second tab's bridgeSessionId in the cookie may point at the
  // wrong server. If THIS tab sent its own bridge id (query param `bridge`),
  // resolve the monitor executor from that id. `resolveOverrideBridge` never
  // throws and returns null when there's no usable override → cookie behavior.
  // `resolveMonitorExecutor` already probes direct-then-managed by id, so the
  // effective id alone is enough.
  const override = await resolveOverrideBridge(extractOverrideBridgeId(req), {
    userId: payload.userId,
    bridgeSessionId: payload.bridgeSessionId,
  });
  if (isHostingSession(user) && override && override.bridgeSessionId !== payload.bridgeSessionId) {
    _clients.delete(ws);
    ws.close(1008, "Forbidden");
    return;
  }
  const effectiveBridgeId = override?.bridgeSessionId ?? payload.bridgeSessionId;
  // A per-tab override bridge is always a direct-SSH target; otherwise trust the
  // token's own `direct` flag. Fail-closed: if a direct session's SSH bridge is
  // gone, `resolveMonitorExecutor` throws rather than sampling the panel host —
  // surface an error and close instead of streaming the wrong machine's stats.
  const isDirect = Boolean(override) || Boolean(payload.direct);
  let executor: Awaited<ReturnType<typeof resolveMonitorExecutor>>;
  try {
    executor = await resolveMonitorExecutor(effectiveBridgeId, { direct: isDirect });
    if (isHostingSession(user)) {
      const tenant = getTenantEnvelope(user);
      const service = executor instanceof PrivilegeDropExecutor ? executor.trustedServiceExecutorFor(tenant.owner) : executor;
      if (!service) throw new Error("Hosting service identity mismatch");
      const dropped = new PrivilegeDropExecutor(service, user.username, tenant.homeRoot, Boolean(user.jailEnabled), tenant.owner);
      if (user.hostingPolicy?.runtime) dropped.configureHostingRuntime(user.username);
      executor = dropped;
    }
  } catch (err) {
    log.warn({ err, userId: payload.userId }, "Monitor WS executor unavailable (fail-closed)");
    send(ws, { type: "error", message: apiModuleMessage(apiLocaleFromRequest(req), "monitorRemoteUnavailable") });
    _clients.delete(ws);
    ws.close(1011, "Server executor unavailable");
    return;
  }
  const scope = executor.target.id;
  if (!await runWithExecutor(executor, () => moduleRegistryService.isEnabled("monitor"))) {
    send(ws, { type: "error", message: apiErrorMessage(locale, "forbidden") });
    _clients.delete(ws);
    ws.close(1008, "Forbidden");
    return;
  }
  clientScopes.set(ws, scope);
  await pushStats(ws, executor, scope, { fallbackCollect: true });

  // ── Periodic broadcast ────────────────────────────────────
  const timer = setInterval(async () => {
    if (ws.readyState !== WebSocket.OPEN) {
      clearInterval(timer);
      return;
    }
    try {
      await pushStats(ws, executor, scope, { fallbackCollect: false });
    } catch (err) {
      log.debug({ err, userId: payload.userId }, "Monitor WS refresh failed");
    }
  }, BROADCAST_INTERVAL_MS);

  // ── Client messages ───────────────────────────────────────
  ws.on("message", async (raw) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      case "ping":
        send(ws, { type: "pong" });
        break;
      case "poll": {
        await pushStats(ws, executor, scope, { fallbackCollect: true });
        break;
      }
    }
  });

  // ── Cleanup ───────────────────────────────────────────────
  function cleanup() {
    clearInterval(timer);
    _clients.delete(ws);
  }

  ws.on("close", () => {
    cleanup();
    log.debug({ userId: payload.userId, total: _clients.size }, "Monitor WS disconnected");
  });

  ws.on("error", (err) => {
    log.error({ err, userId: payload.userId }, "Monitor WS error");
    cleanup();
  });
}
