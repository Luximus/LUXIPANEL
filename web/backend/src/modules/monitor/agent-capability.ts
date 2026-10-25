// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Monitor — AI agent capability.
 *
 * Exposes the live system snapshot (CPU/RAM/load) of the connected target
 * as both a `dataPanel` (for the system prompt) and a `tool` (for explicit
 * agent queries), plus a read-only "top processes by CPU" helper.
 */

import type { AgentCapability } from "../../shared/agent-capability/index.js";
import { requireExecutor } from "../../shared/agent-capability/index.js";
import { systemStatsService } from "./services/system-stats.service.js";
import { resourceWatchdogService } from "./services/resource-watchdog.service.js";
import { watchdogRepository } from "./repositories/watchdog.repository.js";
import { watchdogConfigSchema } from "./models/watchdog.model.js";
import { assistantAdmissionRepository } from "./repositories/assistant-admission.repository.js";
import { assistantAdmissionSchema } from "./models/assistant-admission.model.js";

function topN(input: unknown): number {
  const raw = (input as { n?: unknown })?.n;
  const n = typeof raw === "number" && Number.isFinite(raw) ? Math.floor(raw) : 10;
  return Math.max(1, Math.min(50, n));
}

export const monitorAgentCapability: AgentCapability = {
  moduleId: "monitor",
  version: 1,
  tools: [
    {
      name: "monitor.assistant_admission_status",
      title: "Límite de RAM para nuevos agentes IA",
      description: "Read the connected server's RAM percentage limit for starting new AI agents.",
      kind: "read",
      inputSchema: { type: "object", properties: {} },
      handler: async () => ({ ok: true, output: await assistantAdmissionRepository.load(requireExecutor()) }),
    },
    {
      name: "monitor.assistant_admission_configure",
      title: "Configurar límite de RAM para agentes IA",
      description: "Set the connected server's RAM admission limit for new AI agents (50–90%, default 85%).",
      kind: "action",
      permission: "admin",
      inputSchema: {
        type: "object",
        properties: { memPercent: { type: "number", description: "RAM usage limit, 50–90%" } },
        required: ["memPercent"],
      },
      handler: async (input) => {
        const config = assistantAdmissionSchema.parse(input);
        await assistantAdmissionRepository.save(requireExecutor(), config);
        return { ok: true, output: config };
      },
    },
    {
      name: "monitor.cpu_top",
      title: "Procesos con mayor CPU",
      description:
        "List the top-N processes by CPU usage on the connected server (default 10). " +
        "Returns one line per process as: pid pcpu pmem command.",
      kind: "read",
      inputSchema: {
        type: "object",
        properties: {
          n: { type: "number", description: "Number of processes (1-50, default 10)" },
        },
      },
      handler: async (input) => {
        const executor = requireExecutor();
        const limit = topN(input);
        const result = await executor.exec(
          `ps -eo pid,pcpu,pmem,comm --sort=-pcpu | head -n ${limit + 1}`,
          { timeoutMs: 10_000 },
        );
        return {
          ok: result.exitCode === 0,
          output: result.stdout.trim() || result.stderr.trim() || "(no output)",
        };
      },
    },
    {
      name: "monitor.watchdog_status",
      title: "Estado del reinicio automático",
      description:
        "Read the auto-reboot watchdog of the connected server: configured CPU/RAM " +
        "maximums, whether the on-box unit is installed and running, and the last " +
        "time it rebooted the server (with the reason).",
      kind: "read",
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        const executor = requireExecutor();
        const config = await watchdogRepository.load(executor);
        const status = await resourceWatchdogService.status(executor);
        return { ok: true, output: { config, status } };
      },
    },
    {
      name: "monitor.watchdog_configure",
      title: "Configurar reinicio automático",
      description:
        "Configure the auto-reboot watchdog of the connected server. Set enabled plus " +
        "cpuPercent and/or memPercent (50-100, null disables that threshold) and " +
        "optionally sustainedSeconds (30-3600). When usage stays at/above a maximum " +
        "for the sustained window the server REBOOTS automatically. Setting " +
        "enabled=false stops the watchdog.",
      kind: "action",
      dangerous: true,
      permission: "admin",
      inputSchema: {
        type: "object",
        properties: {
          enabled: { type: "boolean", description: "Turn the watchdog on/off" },
          cpuPercent: {
            type: ["number", "null"],
            description: "Max CPU % (50-100); null = don't watch CPU",
          },
          memPercent: {
            type: ["number", "null"],
            description: "Max RAM % (50-100); null = don't watch RAM",
          },
          sustainedSeconds: {
            type: "number",
            description: "Seconds the pressure must persist before rebooting (30-3600)",
          },
        },
        required: ["enabled"],
      },
      handler: async (input) => {
        const executor = requireExecutor();
        const current = await watchdogRepository.load(executor);
        const obj = (input ?? {}) as Record<string, unknown>;
        const merged = {
          ...current,
          ...(typeof obj.enabled === "boolean" ? { enabled: obj.enabled } : {}),
          ...("cpuPercent" in obj ? { cpuPercent: obj.cpuPercent } : {}),
          ...("memPercent" in obj ? { memPercent: obj.memPercent } : {}),
          ...("sustainedSeconds" in obj ? { sustainedSeconds: obj.sustainedSeconds } : {}),
        };
        const parsed = watchdogConfigSchema.safeParse(merged);
        if (!parsed.success) {
          return { ok: false, output: parsed.error.issues.map((i) => i.message).join("; ") };
        }
        await watchdogRepository.save(executor, parsed.data);
        if (parsed.data.enabled) {
          await resourceWatchdogService.install(executor, parsed.data);
        } else {
          await resourceWatchdogService.disable(executor);
        }
        const status = await resourceWatchdogService.status(executor);
        return { ok: true, output: { config: parsed.data, status } };
      },
    },
  ],
  dataPanels: [
    {
      name: "monitor.snapshot",
      title: "Snapshot del sistema",
      description:
        "Current resource summary for the connected target: CPU usage %, load average, " +
        "memory used / total, root filesystem usage.",
      ttlSeconds: 5,
      collect: async () => {
        const executor = requireExecutor();
        const snap = await systemStatsService.collectWithExecutor(executor);
        return snap as unknown as Record<string, unknown>;
      },
    },
  ],
  suggestedPrompts: [
    "¿Cómo está la carga del servidor ahora?",
    "Muéstrame los procesos que más CPU consumen",
  ],
};
