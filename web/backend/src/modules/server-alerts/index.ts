// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { registerModuleOperations } from "../../shared/module-operations/registry.js";
import type { Express } from "express";
import { createModuleLogger } from "../../shared/logger/index.js";
import { agentCapabilityRegistry } from "../../shared/agent-capability/index.js";
import { serverAlertsRouter } from "./routes/server-alerts.routes.js";
import { serverAlertsAgentCapability } from "./agent-capability.js";
import { serverAlertsWorker } from "./services/server-alerts.worker.js";
import { wireChatFinishedPush } from "./services/chat-finished-push.service.js";
import { wireChatMessagePush } from "./services/chat-message-push.service.js";

const log = createModuleLogger("server-alerts-module");

export function registerServerAlertsModule(app: Express): void {
  app.use(serverAlertsRouter);
  registerModuleOperations("server-alerts", serverAlertsRouter);
  agentCapabilityRegistry.register(serverAlertsAgentCapability);
  serverAlertsWorker.start();
  // Bridge "chat finished" → owner push devices (web/app/desktop) via LP.
  wireChatFinishedPush();
  // Bridge user-to-user "chat message received" → the RECIPIENT's push devices.
  wireChatMessagePush();
  log.info("Server-alerts module registered");
}

export { serverAlertsService } from "./services/server-alerts.service.js";
export { serverAlertsWorker } from "./services/server-alerts.worker.js";
export type {
  AlertPrefs,
  MetricRule,
  ScheduledNotification,
  MetricRuleMetric,
  MetricRuleOp,
} from "./models/server-alerts.model.js";
