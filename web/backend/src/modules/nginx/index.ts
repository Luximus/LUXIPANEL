// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { registerModuleOperations } from "../../shared/module-operations/registry.js";
import type { Express } from "express";
import { nginxRouter } from "./routes/nginx.routes.js";
import { createModuleLogger } from "../../shared/logger/index.js";
import { agentCapabilityRegistry } from "../../shared/agent-capability/index.js";
import { nginxAgentCapability } from "./agent-capability.js";

const log = createModuleLogger("nginx-module");

export function registerNginxModule(app: Express): void {
  app.use(nginxRouter);
  registerModuleOperations("dns", nginxRouter);
  agentCapabilityRegistry.register(nginxAgentCapability);
  log.info("NGINX module registered");
}
