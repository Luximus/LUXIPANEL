// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Admin — AI agent capability.
 *
 * Generic, server-wide tools available to the assistant: run a shell command
 * on the connected target, and restart a systemd service. Both `action` and
 * marked `dangerous=true` — the modules-access sidecar starts them with
 * `requireConfirm=true` by default.
 *
 * NOTE: These supersede the legacy `bash` tool from `agent-tools.service.ts`
 * which mistakenly ran on the panel host. Handlers here always run on the
 * target via the request's executor.
 */

import type { AgentCapability } from "../../shared/agent-capability/index.js";
import { requireExecutor } from "../../shared/agent-capability/index.js";
import { isBuildOrDeployCommand, withAssistantBuildLease } from "../../shared/assistant-build-lease.js";

const BASH_MAX_OUTPUT = 8000;

function clamp(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + `\n…(truncated, ${s.length - max} more chars)`;
}

export const adminAgentCapability: AgentCapability = {
  moduleId: "admin",
  version: 1,
  tools: [
    {
      name: "admin.bash",
      title: "Ejecutar comando bash",
      description:
        "Execute a shell command on the CONNECTED TARGET (not the panel host). " +
        "Returns stdout, stderr and exit code. Times out after 30 seconds. " +
        "Use for read-only diagnostics OR controlled mutations (the user has " +
        "already accepted the risk by enabling this tool).",
      kind: "action",
      dangerous: true,
      permission: "admin",
      inputSchema: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command to run" },
        },
        required: ["command"],
      },
      handler: async (input) => {
        const cmd = String((input as { command?: unknown })?.command ?? "").trim();
        if (!cmd) return { ok: false, output: "Empty command" };
        const executor = requireExecutor();
        const exclusive = isBuildOrDeployCommand(cmd);
        const result = await executor.exec(exclusive ? withAssistantBuildLease(cmd) : cmd, { timeoutMs: exclusive ? 600_000 : 30_000 });
        const out = [
          `$ ${cmd}`,
          result.stdout ? clamp(result.stdout, BASH_MAX_OUTPUT) : "",
          result.stderr ? `[stderr]\n${clamp(result.stderr, BASH_MAX_OUTPUT)}` : "",
          `[exit ${result.exitCode} in ${result.durationMs}ms]`,
        ]
          .filter(Boolean)
          .join("\n");
        return { ok: result.exitCode === 0, output: out };
      },
    },
    {
      name: "admin.restart_service",
      title: "Reiniciar servicio systemd",
      description:
        "Restart a systemd unit on the target via `sudo systemctl restart <unit>`. " +
        "Use sparingly — restarts cause downtime for that service.",
      kind: "action",
      dangerous: true,
      permission: "admin",
      inputSchema: {
        type: "object",
        properties: {
          unit: { type: "string", description: "systemd unit name, e.g. nginx, postfix" },
        },
        required: ["unit"],
      },
      handler: async (input) => {
        const unit = String((input as { unit?: unknown })?.unit ?? "").trim();
        if (!/^[a-zA-Z0-9._@-]+$/.test(unit)) {
          return { ok: false, output: `Invalid unit name: ${unit}` };
        }
        const executor = requireExecutor();
        const result = await executor.exec(`sudo -n systemctl restart ${unit}`, { timeoutMs: 30_000 });
        return {
          ok: result.exitCode === 0,
          output:
            result.exitCode === 0
              ? `Servicio "${unit}" reiniciado.`
              : result.stderr.trim() || `systemctl restart ${unit} salió con ${result.exitCode}`,
        };
      },
    },
  ],
  dataPanels: [
    {
      name: "admin.health",
      title: "Salud del servidor",
      description:
        "Quick reachability / load probe of the connected target — useful as " +
        "system-prompt context before answering operational questions.",
      ttlSeconds: 15,
      collect: async () => {
        const executor = requireExecutor();
        const result = await executor.exec(
          "uptime; echo '---'; df -h / 2>/dev/null | tail -n 1; echo '---'; free -h 2>/dev/null | head -n 2",
          { timeoutMs: 8_000 },
        );
        return {
          target: executor.target.name,
          output: result.stdout || result.stderr || "",
        };
      },
    },
  ],
  suggestedPrompts: [
    "¿Está el servidor saludable?",
    "Reinicia nginx",
  ],
};
