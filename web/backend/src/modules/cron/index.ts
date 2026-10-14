// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { registerModuleOperations } from "../../shared/module-operations/registry.js";
import type { Express } from "express";
import { cronRouter } from "./routes/cron.routes.js";
import { createModuleLogger } from "../../shared/logger/index.js";
import { agentCapabilityRegistry } from "../../shared/agent-capability/index.js";
import { cronAgentCapability } from "./agent-capability.js";
import { aiCronSchedulerService } from "./services/ai-cron-scheduler.service.js";

const log = createModuleLogger("cron-module");

export function registerCronModule(app: Express): void {
  app.use(cronRouter);
  registerModuleOperations("cron", cronRouter);
  agentCapabilityRegistry.register(cronAgentCapability);
  aiCronSchedulerService.start();
  log.info("Cron module registered (AI-agent scheduler started)");
}
