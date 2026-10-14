// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { registerModuleOperations } from "../../shared/module-operations/registry.js";
/**
 * Users module — self-registering modular monolith module.
 */

import type { Express } from "express";
import { usersRouter } from "./routes/users.routes.js";
import { handleUiSyncConnection } from "./controllers/ui-sync.controller.js";
import { createModuleLogger } from "../../shared/logger/index.js";
import type { WsRouter } from "../../shared/websocket/ws-router.js";
import { agentCapabilityRegistry } from "../../shared/agent-capability/index.js";
import { usersAgentCapability } from "./agent-capability.js";

const log = createModuleLogger("users-module");

export function registerUsersModule(app: Express): void {
  app.use(usersRouter);
  registerModuleOperations("users", usersRouter);
  agentCapabilityRegistry.register(usersAgentCapability);
  log.info("Users module registered");
}

export function attachUiSyncWebSocket(router: WsRouter): void {
  router.register("/api/preferences/ws", (ws, req) => handleUiSyncConnection(ws, req));
  log.info("UI sync WebSocket handler registered at /api/preferences/ws");
}
