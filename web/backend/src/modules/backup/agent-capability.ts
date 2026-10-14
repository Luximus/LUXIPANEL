// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Backup — AI agent capability.
 *
 * Read-only: list configured backup jobs from the target's sidecar.
 */

import type { AgentCapability } from "../../shared/agent-capability/index.js";
import { requireExecutor } from "../../shared/agent-capability/index.js";
import { dataStore } from "../../shared/data-store/index.js";
import { CACHE_KEYS } from "../../shared/cache/cacheable-modules.js";

interface BackupJobDoc {
  id?: string | number;
  name?: string;
  schedule?: string;
  target?: string;
  enabled?: boolean;
  lastRunAt?: string;
  lastStatus?: string;
}

export const backupAgentCapability: AgentCapability = {
  moduleId: "backup", catalogModuleId: "backups",
  version: 1,
  tools: [
    {
      name: "backup.list_jobs",
      title: "Listar backups configurados",
      description:
        "List backup jobs on this target: name, cron schedule, destination kind, " +
        "enabled flag, last run timestamp and result.",
      kind: "read",
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        const executor = requireExecutor();
        const store = dataStore<BackupJobDoc>(executor, CACHE_KEYS.backup.jobs.module, CACHE_KEYS.backup.jobs.collection);
        const jobs = await store.list();
        return { ok: true, output: jobs };
      },
    },
  ],
  suggestedPrompts: ["¿Qué backups tengo y cuándo corrió el último?"],
};
