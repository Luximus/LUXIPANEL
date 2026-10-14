// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Server-alerts — AI agent capability.
 *
 * CRITICAL: every tool name MUST be prefixed `server-alerts.` or the registry
 * throws at boot and crash-loops the backend.
 *
 * Handlers run inside the assistant request scope: per-server reads/writes are
 * wrapped in `runWithExecutor(requireExecutor(), ...)` so the per-target
 * sidecar resolves (cloudflare/openclaw pattern). Immediate sends resolve the
 * panel host from the instance origin inside the service (no session host in
 * scope), so they work from the assistant too.
 */

import type { AgentCapability } from "../../shared/agent-capability/index.js";
import { requireExecutor } from "../../shared/agent-capability/index.js";
import { runWithExecutor } from "../../shared/executor/index.js";
import {
  metricRuleCreateSchema,
  sendImmediateSchema,
} from "./models/server-alerts.model.js";
import { serverAlertsService } from "./services/server-alerts.service.js";

export const serverAlertsAgentCapability: AgentCapability = {
  moduleId: "server-alerts",
  version: 1,
  tools: [
    {
      name: "server-alerts.send",
      title: "Enviar notificación al servidor",
      description:
        "Send a push notification right now to the panel owner's devices (web/desktop/app). Use for one-off alerts the operator should see immediately.",
      kind: "action",
      dangerous: true,
      permission: "admin",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Notification title (max 200 chars)" },
          body: { type: "string", description: "Notification body (max 2000 chars)" },
          signals: {
            type: "array",
            items: { type: "string" },
            description: "Optional signal tags so LP can classify the push",
          },
        },
        required: ["title", "body"],
      },
      handler: async (input) => {
        const parsed = sendImmediateSchema.safeParse(input);
        if (!parsed.success) return { ok: false, output: parsed.error.message };
        const result = await serverAlertsService.sendImmediate({ ...parsed.data, respectPrefs: true }, requireExecutor().target.id);
        return { ok: true, output: result };
      },
    },
    {
      name: "server-alerts.list_rules",
      title: "Listar reglas de alerta",
      description:
        "List the metric-based alert rules configured for the connected server (cpu/ram/disk/load thresholds and service-down checks), with their cooldown and last-fired time.",
      kind: "read",
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        const executor = requireExecutor();
        const rules = await runWithExecutor(executor, () => serverAlertsService.listRules(executor));
        return { ok: true, output: rules };
      },
    },
    {
      name: "server-alerts.create_rule",
      title: "Crear regla de alerta",
      description:
        "Create a metric-based alert rule for the connected server. metric: cpu|ram|disk|load|service-down. op: >=|<=|==|down. For numeric metrics provide a threshold; for service-down provide the systemd service unit name. cooldownMinutes throttles repeat firings.",
      kind: "action",
      dangerous: true,
      permission: "admin",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Human-facing rule name" },
          metric: { type: "string", enum: ["cpu", "ram", "disk", "load", "service-down"] },
          op: { type: "string", enum: [">=", "<=", "==", "down"] },
          threshold: { type: "number", description: "Threshold for cpu/ram/disk (percent) or load (avg). Omit for service-down." },
          service: { type: "string", description: "systemd unit name (required for service-down)" },
          cooldownMinutes: { type: "number", description: "Minimum minutes between firings (default 30)" },
          enabled: { type: "boolean", description: "Whether the rule is active (default true)" },
        },
        required: ["name", "metric", "op"],
      },
      handler: async (input) => {
        const parsed = metricRuleCreateSchema.safeParse(input);
        if (!parsed.success) return { ok: false, output: parsed.error.message };
        const executor = requireExecutor();
        const rule = await runWithExecutor(executor, () =>
          serverAlertsService.createRule(parsed.data, executor),
        );
        return { ok: true, output: rule };
      },
    },
  ],
  suggestedPrompts: [
    "Envíame una notificación de prueba al servidor",
    "Crea una regla que me avise cuando la CPU pase del 90%",
    "Avísame si el servicio nginx se cae",
  ],
};
