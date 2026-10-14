// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * OpenClaw — AI agent capability.
 *
 * Read-only: config snapshot + reachability ping against the configured
 * OpenClaw endpoint.
 */

import type { AgentCapability } from "../../shared/agent-capability/index.js";
import { requireExecutor } from "../../shared/agent-capability/index.js";
import { runWithExecutor } from "../../shared/executor/index.js";
import { openclawService } from "./services/openclaw.service.js";

export const openclawAgentCapability: AgentCapability = {
  moduleId: "openclaw",
  version: 1,
  tools: [
    {
      name: "openclaw.config",
      title: "Configuración de OpenClaw",
      description:
        "Returns the OpenClaw endpoint and whether an API key is configured. " +
        "The API key itself is never returned.",
      kind: "read",
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        const executor = requireExecutor();
        const cfg = await runWithExecutor(executor, () => openclawService.getConfig());
        return {
          ok: true,
          output: {
            endpoint: cfg.endpoint,
            defaultModel: cfg.defaultModel,
            hasApiKey: cfg.apiKeySet,
            apiKeyPreview: cfg.apiKeyPreview,
          },
        };
      },
    },
    {
      name: "openclaw.test_connection",
      title: "Probar conexión OpenClaw",
      description:
        "Probe the configured OpenClaw endpoint. Returns reachability, HTTP status, " +
        "and a short human-readable message.",
      kind: "read",
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        const executor = requireExecutor();
        const result = await runWithExecutor(executor, () => openclawService.testConnection());
        return { ok: result.ok, output: result };
      },
    },
  ],
  suggestedPrompts: ["¿OpenClaw está accesible?"],
};
