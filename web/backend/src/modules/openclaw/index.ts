// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { registerModuleOperations } from "../../shared/module-operations/registry.js";
import type { Express } from "express";
import { openclawRouter } from "./routes/openclaw.routes.js";
import { createModuleLogger } from "../../shared/logger/index.js";
import { agentCapabilityRegistry } from "../../shared/agent-capability/index.js";
import { openclawAgentCapability } from "./agent-capability.js";

const log = createModuleLogger("openclaw-module");

export function registerOpenClawModule(app: Express): void {
  app.use(openclawRouter);
  registerModuleOperations("openclaw", openclawRouter);
  agentCapabilityRegistry.register(openclawAgentCapability);
  log.info("OpenClaw module registered");
}
