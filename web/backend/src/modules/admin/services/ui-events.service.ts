import { canReadResource } from "../../../shared/remote-cache/live-resources.js";
import { subscribeData } from "../../../shared/remote-cache/live-events.js";
import { tolqiaBridge } from "../../chat/services/tolqia-bridge.service.js";
import type { IncomingMessage } from "node:http";
import type { Request } from "express";
import type { WebSocket } from "ws";
import type { Executor } from "../../../shared/executor/index.js";
import type { SessionUser } from "../../../shared/types/index.js";
import { getExecutorAsync } from "../../../shared/executor/factory.js";
import { runWithExecutor } from "../../../shared/executor/context.js";
import { verifyWsAuthorization } from "../../../shared/websocket/live-auth.js";
import { extractOverrideBridgeId, wsSend } from "../../../shared/websocket/upgrade-auth.js";
import { tokenService } from "../../auth/services/token.service.js";
import { resolveOverrideBridge } from "../../../shared/session/bridge-header.js";
import { isHostingSession } from "../../../shared/tenant/tenant-scope.js";
import { canUseModule, hasActionPermission, hasViewPermission } from "../../../shared/auth/role-permissions.js";
import { chatService, chatBus, chatPresence, CHAT_EVENTS } from "../../chat/services/chat.service.js";
import { notificationsService, notificationsBus, NOTIFICATION_EVENTS } from "../../notifications/services/notifications.service.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import { moduleRegistryService } from "./module-registry.service.js";

/** Concurrent tabs share only in-flight counts, never cached authorization. */
const pending = new Map<string, Promise<{ chat: number; notifications: number | null }>>();
export function uiStatus(user: SessionUser, executor: Executor) {
  const notifications = hasViewPermission(user, "panel.notifications");
  const key = JSON.stringify([executor.target.id, user.userId, user.username, notifications, user.owner]);
  let task = pending.get(key);
  if (!task) {
    task = Promise.all([chatService.unreadCount(executor, user.username),
      notifications ? notificationsService.unreadCount(user.userId, executor) : null,
    ]).then(([chat, notifications]) => ({chat, notifications})).finally(() => { if (pending.get(key) === task) pending.delete(key); });
    pending.set(key, task);
  }
  return task;
}

/** One authenticated push channel; ordinary reads/mutations keep their HTTP contracts. */
export async function handleUiConnection(ws: WebSocket, req: IncomingMessage) {
  const payload = await verifyWsAuthorization(req);
  if (!payload) { ws.close(4001, "Unauthorized"); return; }
  const user = tokenService.toSessionUser(payload);
  const requested = extractOverrideBridgeId(req);
  const override = await resolveOverrideBridge(requested, payload);
  if ((requested && requested !== payload.bridgeSessionId && !override) ||
      (isHostingSession(user) && requested && requested !== payload.bridgeSessionId)) {
    ws.close(1008, "Forbidden"); return;
  }
  const bridge = override ?? payload;
  // Reuse the HTTP factory including local/remote tenant privilege dropping.
  const request = {originalUrl: "/api/ui/events", res: {locals: {user,
    bridgedSession: {bridgeSessionId: bridge.bridgeSessionId ?? "", targetId: bridge.targetId ?? "local", direct: !!override || !!payload.direct},
  }}} as unknown as Request;
  const executor = await getExecutorAsync(request);
  const scoped = <T>(fn: () => T) => runWithExecutor(executor, fn, user.userId, user);
  const assistant = canUseModule(user, "assistant") && hasActionPermission(user, "assistant.read")
    && await scoped(() => moduleRegistryService.isEnabled("assistant"));
  if (ws.readyState !== 1) return;
  const targetId = executor.target.id;
  const notifications = hasViewPermission(user, "panel.notifications");
  let closed = false, busy = false, dirty = false;
  let releaseData: (() => void) | undefined, subscriptionEpoch = 0;
  const dataSubscribe = async (msg: any) => {
    const epoch = ++subscriptionEpoch;
    releaseData?.(); releaseData = undefined;
    if (!Array.isArray(msg.resources) || msg.resources.length > 8 || msg.resources.some((key: unknown) => typeof key !== "string")) return;
    const keys: string[] = [...new Set<string>(msg.resources)];
    const authorized = await scoped(() => Promise.all(keys.map(key => canReadResource(user, key))));
    if (closed || epoch !== subscriptionEpoch) return;
    if (authorized.some(allowed => !allowed)) { wsSend(ws, {type:"data:resync", resources:[], reason:"forbidden"}); return; }
    if (!keys.length) return;
    const release = await scoped(() => subscribeData(executor, keys, msg.cursor, frame => {
      if (!closed && epoch === subscriptionEpoch) wsSend(ws, frame);
    }));
    if (closed || epoch !== subscriptionEpoch) release(); else releaseData = release;
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const refresh = async () => {
    if (closed) return;
    if (busy) { dirty = true; return; }
    busy = true;
    try { const counters = await scoped(() => uiStatus(user, executor)); if (!closed) wsSend(ws, {type: "ui:status", targetId, ...counters}); }
    catch { if (!closed) wsSend(ws, {type:"ui:status-error"}); }
    finally { busy = false; if (dirty && !closed) { dirty = false; schedule(); } }
  };
  const schedule = () => { if (!timer && !closed) timer = setTimeout(() => {timer = undefined; void refresh();}, 100); };
  const chatScoped = (row: any) => row?.targetId === targetId && Array.isArray(row.participants) && row.participants.includes(user.username);
  const onChat = (row: any) => { if (chatScoped(row)) { schedule(); if (row.message) wsSend(ws, {type:"ui:chat-message",data:row}); } };
  const onCall = (row: any) => { if (chatScoped(row)) wsSend(ws, {type:`chat:call:${row.event === "ring" ? "ring" : row.event === "end" ? "end" : "state"}`, data:row}); };
  const onNotification = (row: any) => {
    if (notifications && (row?.targetId ?? row?.metadata?.targetId) === targetId && (row.userId === null || row.userId === user.userId)) {
      schedule(); wsSend(ws, {type:"ui:notifications-changed"});
    }
  };
  const onModules = (row: any) => {
    if (!closed && (row?.targetId === null || row?.targetId === targetId)) wsSend(ws, { type: "ui:modules-changed", targetId, revision: row.revision });
  };
  const onTask = (row: any) => {
    if (assistant && row?.targetId === targetId && String(row.userId) === String(user.userId))
      wsSend(ws, {type:"assistant.team_task_update",task:row.task,phase:row.phase,correlationId:row.correlationId,leaderConversationId:row.leaderConversationId,workerConversationId:row.workerConversationId});
  };
  chatPresence.add(targetId, user.username);
  chatBus.on(CHAT_EVENTS.MESSAGE, onChat); chatBus.on(CHAT_EVENTS.READ, onChat); chatBus.on(CHAT_EVENTS.CALL, onCall);
  for (const event of Object.values(NOTIFICATION_EVENTS)) notificationsBus.on(event, onNotification);
  eventBus.on(Events.AI_TEAM_TASK_UPDATE, onTask);
  eventBus.on(Events.MODULES_CHANGED, onModules);
  const cleanup = () => {
    if (closed) return; closed = true; clearTimeout(timer);
    subscriptionEpoch++; releaseData?.();
    chatPresence.remove(targetId, user.username);
    chatBus.off(CHAT_EVENTS.MESSAGE, onChat); chatBus.off(CHAT_EVENTS.READ, onChat); chatBus.off(CHAT_EVENTS.CALL, onCall);
    for (const event of Object.values(NOTIFICATION_EVENTS)) notificationsBus.off(event, onNotification);
    eventBus.off(Events.AI_TEAM_TASK_UPDATE, onTask);
    eventBus.off(Events.MODULES_CHANGED, onModules);
  };
  ws.on("close", cleanup); ws.on("error", cleanup);
  let lastRefresh = Date.now(), lastSubscribe = 0;
  ws.on("message", raw => {
    if (String(raw).length > 2048) return;
    try { const msg = JSON.parse(String(raw));
      if (msg.type === "data:subscribe" && Date.now() - lastSubscribe > 100) {
        lastSubscribe = Date.now(); void dataSubscribe(msg).catch(() => { if (!closed) wsSend(ws, {type:"data:resync", resources:[], reason:"unavailable"}); });
      }
      if (msg.type === "ui:ping") wsSend(ws, {type:"ui:pong"});
      if (msg.type === "ui:refresh" && Date.now() - lastRefresh > 5000) { lastRefresh = Date.now(); schedule(); }
    } catch { /* malformed frames cannot trigger reads */ }
  });
  void refresh();
  void scoped(async () => {
    for (const id of tolqiaBridge.activeConversationIds(targetId, user.username).slice(0, 8)) {
      if (closed) return;
      const call = await tolqiaBridge.getActiveCall(executor, user.username, id).catch(() => null);
      if (call && !closed) wsSend(ws, {type:"chat:call:state",data:{targetId,participants:[user.username],event:"state",call}});
    }
  }).catch(() => undefined);
}
