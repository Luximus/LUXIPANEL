// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Firewall — AI agent capability.
 *
 * Read-only UFW + fail2ban status.
 */

import type { AgentCapability } from "../../shared/agent-capability/index.js";
import { requireExecutor } from "../../shared/agent-capability/index.js";
import { ufwService } from "./services/ufw.service.js";
import { fail2banService } from "./services/fail2ban.service.js";

export const firewallAgentCapability: AgentCapability = {
  moduleId: "firewall",
  version: 1,
  tools: [
    {
      name: "firewall.ufw_status",
      title: "Estado de UFW",
      description: "Returns the UFW (Uncomplicated Firewall) status: enabled flag and rule list.",
      kind: "read",
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        const executor = requireExecutor();
        const status = await ufwService.getStatusWithExecutor(executor);
        return { ok: true, output: status };
      },
    },
    {
      name: "firewall.fail2ban_status",
      title: "Estado de fail2ban (jails)",
      description: "Lists all configured fail2ban jails with their current ban counts.",
      kind: "read",
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        const executor = requireExecutor();
        const jails = await fail2banService.getAllStatusesWithExecutor(executor);
        return { ok: true, output: jails };
      },
    },
  ],
  suggestedPrompts: ["¿Cuál es el estado del firewall?", "Lista las jails de fail2ban con IPs bloqueadas"],
};
