// SPDX-License-Identifier: AGPL-3.0-only
import type { IncomingMessage } from "node:http";
import type WebSocket from "ws";
import { verifyWsAuthorization } from "../../../shared/websocket/live-auth.js";
import { extractOverrideBridgeId } from "../../../shared/websocket/upgrade-auth.js";
import { tokenService } from "../../auth/services/token.service.js";
import { canUseModule, hasActionPermission } from "../../../shared/auth/role-permissions.js";
import { moduleRegistryService } from "../../admin/services/module-registry.service.js";
import { runWithExecutor, localExecutor, getDirectExecutorByBridgeSessionId } from "../../../shared/executor/index.js";
import { resolveOverrideBridge } from "../../../shared/session/bridge-header.js";
import { isHostingSession } from "../../../shared/tenant/tenant-scope.js";
import { realtimeService } from "../services/realtime.service.js";
export async function handleRealtimeAudio(ws: WebSocket, req: IncomingMessage): Promise<void> {
  const payload = await verifyWsAuthorization(req);
  if (!payload) { ws.close(1008,"Sesión no autorizada"); return; }
  const user = tokenService.toSessionUser(payload);
  if (!canUseModule(user,"assistant") || !hasActionPermission(user,"assistant.read")) { ws.close(1008,"Sin permiso"); return; }
  const overrideId = extractOverrideBridgeId(req);
  const override = await resolveOverrideBridge(overrideId,payload);
  if ((overrideId && overrideId !== payload.bridgeSessionId && !override)
    || (isHostingSession(user) && override && override.bridgeSessionId !== payload.bridgeSessionId)) {
    ws.close(1008,"Servidor no autorizado"); return;
  }
  const executor = override || payload.direct
    ? await getDirectExecutorByBridgeSessionId(override?.bridgeSessionId ?? payload.bridgeSessionId ?? "")
    : localExecutor;
  if (!executor || !await runWithExecutor(executor, () => moduleRegistryService.isEnabled("assistant"))) {
    ws.close(1008,"Módulo no disponible"); return;
  }
  if (ws.readyState !== 1) return;
  try {
    const id = new URL(req.url ?? "/","http://localhost").searchParams.get("session") ?? "";
    realtimeService.attachPcm(id,executor,user,ws);
  } catch { ws.close(1008,"Sesión de voz no autorizada"); }
}
