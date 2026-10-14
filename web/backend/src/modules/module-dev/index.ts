import { registerModuleOperations } from "../../shared/module-operations/registry.js";
/**
 * module-dev — "Mis módulos": ciclo de vida de los módulos del marketplace
 * creados con el asistente IA (MODULE-DEV-AI-FLOW.md). Monta la API
 * /api/module-dev/* y registra las agent tools `module-dev.*`.
 */

import type { Express } from "express";
import { moduleDevRouter } from "./routes/module-dev.routes.js";
import { createModuleLogger } from "../../shared/logger/index.js";
import { agentCapabilityRegistry } from "../../shared/agent-capability/index.js";
import { moduleDevAgentCapability } from "./agent-capability.js";
import { logsRepairTools } from "./services/logs-tools.js";
import { startAutomaticRepairs } from "../../shared/diagnostics/automatic-repairs.js";
import { repairJobs } from "../../shared/diagnostics/repair-jobs.js";
import { validateLpApiKey } from "../../shared/lp-api-key.js";

const log = createModuleLogger("module-dev-module");

export function registerModuleDevModule(app: Express): void {
  app.use(moduleDevRouter);
  registerModuleOperations("module-dev", moduleDevRouter);
  const tools = moduleDevAgentCapability.tools.map((tool) => ({
    ...tool,
    handler: async (input: unknown) => {
      const status = await validateLpApiKey();
      if (status !== "valid") return { ok: false, output: "API KEY de LUXIPANEL requerida y validación en línea disponible para usar Mis módulos." };
      return tool.handler(input);
    },
  }));
  agentCapabilityRegistry.register({ ...moduleDevAgentCapability, tools: [...tools, ...logsRepairTools] });
  startAutomaticRepairs();
  void repairJobs.init().catch((err) => log.error({ err }, "Logs repair jobs could not initialize"));
  log.info("Module-dev module registered");
}
