// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * BitNinja — AI agent capability.
 *
 * Read-only status check on the target. Installation / service control are
 * heavy actions gated on the module UI; the assistant only inspects state.
 */

import type { AgentCapability } from "../../shared/agent-capability/index.js";
import { requireExecutor } from "../../shared/agent-capability/index.js";

export const bitninjaAgentCapability: AgentCapability = {
  moduleId: "bitninja",
  version: 1,
  tools: [
    {
      // MUST stay `bitninja.<suffix>` — the registry throws on a mismatched
      // prefix and the backend would crash-loop on boot.
      name: "bitninja.status",
      title: "Estado de BitNinja",
      description:
        "Returns whether the BitNinja security agent is installed and running, " +
        "its version, and the state of its protection components.",
      kind: "read",
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        const executor = requireExecutor();
        const result = await executor.exec(
          "command -v bitninjacli >/dev/null 2>&1 || { echo 'BitNinja no instalado'; exit 0; }; " +
            "bitninjacli --version 2>/dev/null | head -n1; echo '--- licencia ---'; bitninjacli --licenseinfo 2>&1; " +
            "echo '--- módulos ---'; bitninjacli --status-all 2>&1 || true",
          { timeoutMs: 10_000 },
        );
        return { ok: true, output: result.stdout || result.stderr || "(sin salida)" };
      },
    },
  ],
  suggestedPrompts: ["¿Está BitNinja protegiendo el servidor?"],
};
