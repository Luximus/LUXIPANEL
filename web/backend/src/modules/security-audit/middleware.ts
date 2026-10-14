// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { Express } from "express";
import { securityAuditRouter } from "./routes/index.js";
import { createModuleLogger } from "../../shared/logger/index.js";
import { agentCapabilityRegistry } from "../../shared/agent-capability/index.js";
import { securityAuditAgentCapability } from "./agent-capability.js";

const log = createModuleLogger("security-audit-module");

export function registerSecurityAuditModule(app: Express): void {
  app.use("/api/security-audit", securityAuditRouter);
  agentCapabilityRegistry.register(securityAuditAgentCapability);
  log.info("Security Audit module registered");
}
