// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { registerModuleOperations } from "../../shared/module-operations/registry.js";
import type { Express } from "express";
import { monitorRouter } from "./routes/monitor.routes.js";
import { statsCollectorService } from "./services/stats-collector.service.js";
import { alertEvaluatorService } from "./services/alert-evaluator.service.js";
import { handleMonitorConnection, broadcastMonitorAlert } from "./controllers/monitor-ws.controller.js";
import { eventBus, Events } from "../../shared/events/index.js";
import { createModuleLogger } from "../../shared/logger/index.js";
import type { WsRouter } from "../../shared/websocket/ws-router.js";
import { agentCapabilityRegistry } from "../../shared/agent-capability/index.js";
import { setStatsSnapshotProvider } from "../../shared/system-stats/index.js";
import { monitorAgentCapability } from "./agent-capability.js";

const log = createModuleLogger("monitor-module");

export function registerMonitorModule(app: Express): void {
  statsCollectorService.setAlertEvaluator(alertEvaluatorService);
  agentCapabilityRegistry.register(monitorAgentCapability);
  // Expose the latest local snapshot through the shared bridge so consumers
  // (ai-assistant context) read it without a cross-module import.
  setStatsSnapshotProvider(() => statsCollectorService.getLatest());

  // Forward alert events to all connected WebSocket clients
  eventBus.on(Events.ALERT_FIRING, (data: unknown) => {
    broadcastMonitorAlert(Events.ALERT_FIRING, data);
  });
  eventBus.on(Events.ALERT_RESOLVED, (data: unknown) => {
    broadcastMonitorAlert(Events.ALERT_RESOLVED, data);
  });

  app.use(monitorRouter);
  registerModuleOperations("monitor", monitorRouter);
  log.info("Monitor module registered (WebSocket real-time + alerts enabled)");
}

/**
 * Register the monitor WebSocket route with the shared WsRouter.
 * Must be called after app.listen() returns the http.Server.
 */
export function attachMonitorWebSocket(router: WsRouter): void {
  router.register("/api/monitor/ws", (ws, req) => handleMonitorConnection(ws, req));
  log.info("Monitor WebSocket handler registered at /api/monitor/ws");
}
