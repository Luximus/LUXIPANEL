// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { registerModuleOperations } from "../../shared/module-operations/registry.js";
import type { Express } from "express";
import { firewallRouter } from "./routes/firewall.routes.js";
import { createModuleLogger } from "../../shared/logger/index.js";
import { agentCapabilityRegistry } from "../../shared/agent-capability/index.js";
import { firewallAgentCapability } from "./agent-capability.js";

const log = createModuleLogger("firewall-module");

export function registerFirewallModule(app: Express): void {
  app.use(firewallRouter);
  registerModuleOperations("firewall", firewallRouter);
  agentCapabilityRegistry.register(firewallAgentCapability);
  log.info("Firewall module registered");
}
