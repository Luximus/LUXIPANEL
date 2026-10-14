// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { registerModuleOperations } from "../../shared/module-operations/registry.js";
import type { Express } from "express";
import { dashboardRouter } from "./routes/dashboard.routes.js";
import { createModuleLogger } from "../../shared/logger/index.js";
import { agentCapabilityRegistry } from "../../shared/agent-capability/index.js";
import { dashboardAgentCapability } from "./agent-capability.js";

const log = createModuleLogger("dashboard-module");

export function registerDashboardModule(app: Express): void {
  app.use(dashboardRouter);
  registerModuleOperations("dashboard", dashboardRouter);
  agentCapabilityRegistry.register(dashboardAgentCapability);
  log.info("Dashboard module registered");
}
