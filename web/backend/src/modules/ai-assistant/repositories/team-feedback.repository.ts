// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Team task feedback — 👍/👎 del usuario sobre el resultado de cada tarea
 * delegada, anclado a la procedencia de plantilla del worker
 * (`templateId`/`templateNodeKey`) para poder agregar calidad por plantilla.
 * Sidecar per-server: `${LUXIPANEL_CONFIG_DIR}/assistant/team-feedback.json`.
 * Upsert por taskId (re-votar reemplaza); poda a las 1000 más recientes.
 */

import { dataStore } from "../../../shared/data-store/index.js";
import type { Executor } from "../../../shared/executor/index.js";

const MODULE = "assistant";
const COLLECTION = "team-feedback";
const MAX_RECORDS = 1000;

export interface TeamTaskFeedback {
  id?: string;
  taskId: string;
  leaderConversationId: string;
  /** Procedencia del worker al momento de votar (agente borrable). */
  templateId: string | null;
  templateNodeKey: string | null;
  workerAgentId: string;
  rating: "up" | "down";
  note?: string;
  userId?: string | null;
  ts: string;
}

function store(executor?: Executor | null) {
  return dataStore<TeamTaskFeedback>(executor, MODULE, COLLECTION, { idStrategy: "uuid", timestamps: false });
}

export const teamFeedbackRepository = {
  /** Re-votar la misma tarea reemplaza el registro anterior. */
  async upsertByTask(
    executor: Executor | null | undefined,
    item: Omit<TeamTaskFeedback, "id" | "ts">,
  ): Promise<TeamTaskFeedback> {
    const s = store(executor);
    const all = (await s.list()) as TeamTaskFeedback[];
    const prev = all.find((f) => f.taskId === item.taskId);
    if (prev?.id) {
      return (await s.update(prev.id, { ...item, ts: new Date().toISOString() })) as TeamTaskFeedback;
    }
    // Poda: conserva las MAX_RECORDS-1 más recientes antes de crear.
    if (all.length >= MAX_RECORDS) {
      const oldest = [...all].sort((a, b) => a.ts.localeCompare(b.ts)).slice(0, all.length - MAX_RECORDS + 1);
      for (const f of oldest) if (f.id) await s.delete(f.id).catch(() => undefined);
    }
    return s.create({ ...item, ts: new Date().toISOString() });
  },

  async listByConversation(executor: Executor | null | undefined, leaderConversationId: string): Promise<TeamTaskFeedback[]> {
    const all = (await store(executor).list()) as TeamTaskFeedback[];
    return all.filter((f) => f.leaderConversationId === leaderConversationId);
  },

  async listByTemplate(executor: Executor | null | undefined, templateId: string): Promise<TeamTaskFeedback[]> {
    const all = (await store(executor).list()) as TeamTaskFeedback[];
    return all.filter((f) => f.templateId === templateId);
  },
};
