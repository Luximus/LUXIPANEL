// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Dashboard — AI agent capability.
 *
 * Exposes the server overview (CPU/RAM/disk stats, key service statuses, top
 * processes) as a read tool + a compact dataPanel cached briefly to avoid
 * re-running on every agent turn. This is the reason the `dashboard` backend
 * module survives the removal of the old /panel landing page.
 */

import type { AgentCapability } from "../../shared/agent-capability/index.js";
import { requireExecutor } from "../../shared/agent-capability/index.js";
import { dashboardOverviewService } from "./services/dashboard-overview.service.js";

export const dashboardAgentCapability: AgentCapability = {
  moduleId: "dashboard",
  version: 1,
  tools: [
    {
      name: "dashboard.overview",
      title: "Resumen del servidor",
      description:
        "Return the server overview: CPU / RAM / load, " +
        "disk usage of mounts, status of key services (nginx, postfix, dovecot, ssh, etc.), " +
        "and the top processes by CPU.",
      kind: "read",
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        const executor = requireExecutor();
        const overview = await dashboardOverviewService.collect(executor);
        return { ok: true, output: overview };
      },
    },
  ],
  dataPanels: [
    {
      name: "dashboard.snapshot",
      title: "Overview compacto",
      description:
        "Compact pre-prompt summary of the connected target: load, RAM%, root disk%, " +
        "and how many key services are running.",
      ttlSeconds: 30,
      collect: async () => {
        const executor = requireExecutor();
        const o = await dashboardOverviewService.collect(executor);
        const stats = o.stats.data;
        const disk = o.disk.data;
        const services = o.services.data ?? [];
        return {
          load1m: stats?.cpu.loadAvg1m,
          cpuUsagePercent: stats?.cpu.usagePercent,
          memUsagePercent: stats?.memory.usagePercent,
          diskUsagePercent: disk?.usagePercent,
          diskMountpoint: disk?.mountpoint,
          servicesActive: services.filter((s) => s.active).length,
          servicesTotal: services.length,
        };
      },
    },
  ],
  suggestedPrompts: ["Dame un resumen del estado del servidor"],
};
