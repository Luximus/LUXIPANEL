import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { loadAssistantAgents } from "./agents.controller.js";
import { loadAssistantRoles } from "./agent-roles.controller.js";
import { loadAssistantProjects } from "./projects.controller.js";
import { assistantConfigRepository } from "../repositories/assistant-config.repository.js";
import { redactAssistantConfig } from "../models/assistant-config.types.js";
import { officeConnectorsService } from "../services/office-connectors.service.js";

/** Reuses the exact scoped/redacted readers used by individual HTTP routes. */
export const assistantBootstrap = asyncHandler(async (req, res) => {
  const readers = {
    agents: async () => ({ ok: true, agents: await loadAssistantAgents(req, res) }),
    roles: async () => ({ ok: true, roles: await loadAssistantRoles(req, res) }),
    projects: async () => ({ ok: true, projects: await loadAssistantProjects(req, res) }),
    config: async () => ({ ok: true, config: redactAssistantConfig(await assistantConfigRepository.load(getExecutor(req))) }),
    connectors: async () => ({ ok: true, data: { connectors: await officeConnectorsService.list() } }),
  };
  const keys = Object.keys(readers) as Array<keyof typeof readers>;
  const results = await Promise.allSettled(keys.map(key => readers[key]()));
  const catalogs: Record<string, unknown> = {};
  const unavailable: string[] = [];
  results.forEach((result, index) => {
    const key = keys[index]!;
    if (result.status === "fulfilled") catalogs[key] = result.value;
    else unavailable.push(key);
  });
  // A failed auxiliary catalog must not discard successful catalogs. It is
  // retried through its original endpoint, retaining its ordinary error flow.
  res.json({ ok: true, catalogs, unavailable });
});
