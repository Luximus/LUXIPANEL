// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Scheduled AI-agent jobs — run an AI Assistant agent on a cron schedule.
 *
 * Sidecar (per target): `${LUXIPANEL_CONFIG_DIR}/cron/ai-agents.json`.
 *
 * Provider/model mirror the AI Assistant config; `projectId` reuses the
 * Assistant's projects (cwd + instructions). The tools the agent may call are
 * NOT defined here — they come from the Assistant's per-target module-access
 * gating (`assistantModulesService.allowedTools`), so granting/revoking the
 * agent's powers over a module is done from the Assistant's Modules tab.
 */

import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { AiAgentJob } from "../models/index.js";

export type { AiAgentJob };

const MODULE = "cron";
const COLLECTION = "ai-agents";

const store = makeKvStore<AiAgentJob>({ module: MODULE, collection: COLLECTION, idStrategy: "uuid" });

export const aiAgentJobRepository = {
  async list(executor?: Executor | null): Promise<Array<AiAgentJob & { id: string }>> {
    const all = await store(executor).list();
    return [...all].sort((a, b) => (a.name || "").localeCompare(b.name || "")) as Array<AiAgentJob & { id: string }>;
  },

  async listEnabled(executor?: Executor | null): Promise<Array<AiAgentJob & { id: string }>> {
    return (await this.list(executor)).filter((j) => j.enabled);
  },

  async get(id: string, executor?: Executor | null): Promise<(AiAgentJob & { id: string }) | null> {
    // kv-store `get` returns the raw record WITHOUT injecting the map key as
    // `id` (unlike `list`). Re-attach it: runJob and the chain/run-now paths
    // depend on `job.id` for status updates, logs and the running-set.
    const rec = await store(executor).get(id);
    return rec ? { ...(rec as AiAgentJob), id } : null;
  },

  async create(data: AiAgentJob, executor?: Executor | null): Promise<AiAgentJob & { id: string }> {
    return store(executor).create(data);
  },

  async update(id: string, patch: Partial<AiAgentJob>, executor?: Executor | null): Promise<(AiAgentJob & { id: string }) | null> {
    return store(executor).update(id, patch) as Promise<(AiAgentJob & { id: string }) | null>;
  },

  async delete(id: string, executor?: Executor | null): Promise<boolean> {
    return store(executor).delete(id);
  },
};
