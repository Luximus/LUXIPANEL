// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Team task board persistence — sidecars on the connected server (like
 * conversations, which the tasks reference):
 *
 *   `${LUXIPANEL_CONFIG_DIR}/assistant/team-tasks.json`
 *   `${LUXIPANEL_CONFIG_DIR}/assistant/team-plans.json`
 *
 * The board is the SOURCE OF TRUTH for delegated work: the in-memory waiters in
 * team-tasks.service are an optimization; `team.collect`, the REST endpoints and
 * the post-restart reconciliation all read from here.
 */

import { dataStore } from "../../../shared/data-store/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import {
  isTerminalTaskStatus,
  type TeamPlan,
  type TeamTask,
  type TeamTaskStatus,
} from "../models/team-task.types.js";

const log = createModuleLogger("assistant-team-tasks");
const MODULE = "assistant";

function taskStore(executor?: Executor | null) {
  return dataStore<TeamTask>(executor, MODULE, "team-tasks", { idStrategy: "uuid", timestamps: false });
}

function planStore(executor?: Executor | null) {
  return dataStore<TeamPlan>(executor, MODULE, "team-plans", { idStrategy: "uuid", timestamps: false });
}

export const teamTasksRepository = {
  // ── Tasks ────────────────────────────────────────────────────────────────

  async createTask(
    executor: Executor | null | undefined,
    item: Omit<TeamTask, "id" | "createdAt">,
  ): Promise<TeamTask> {
    return taskStore(executor).create({ ...item, createdAt: new Date().toISOString() });
  },

  async getTask(executor: Executor | null | undefined, id: string): Promise<TeamTask | null> {
    return taskStore(executor).get(id) as Promise<TeamTask | null>;
  },

  /**
   * Patch a task ATOMICALLY (transaction over the sidecar map). Transitions are
   * IDEMPOTENT on terminal states: once a task is done/failed/canceled, a
   * competing close (onComplete vs AI_CHAT_FINISHED listener vs reconciliation)
   * is dropped instead of overwriting the outcome. Returns the updated task, or
   * null when the task is missing.
   */
  async updateTask(
    executor: Executor | null | undefined,
    id: string,
    patch: Partial<Omit<TeamTask, "id" | "createdAt" | "leaderConversationId">>,
  ): Promise<TeamTask | null> {
    return taskStore(executor).transaction(async (current) => {
      const existing = current[id];
      if (!existing) return { next: current, result: null };
      if (patch.status && isTerminalTaskStatus(existing.status) && patch.status !== existing.status) {
        log.debug({ id, from: existing.status, to: patch.status }, "team-task: terminal transition dropped");
        return { next: current, result: { ...existing, id } };
      }
      const updated = { ...existing, ...patch, id };
      return { next: { ...current, [id]: updated }, result: updated };
    });
  },

  /** Tasks anchored to a leader conversation, oldest first. */
  async listForLeaderConversation(
    executor: Executor | null | undefined,
    leaderConversationId: string,
  ): Promise<TeamTask[]> {
    const all = await taskStore(executor).list();
    return all
      .filter((t) => t.leaderConversationId === leaderConversationId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  },

  /** Every task, terminal included. Used to rebuild `conversationId → agentId`
   *  for an orphaned agent chat: the task that spawned it is usually already
   *  done, so `listActive` would miss exactly the chats that need backfilling. */
  async listAll(executor: Executor | null | undefined): Promise<TeamTask[]> {
    const all = await taskStore(executor).list();
    return all.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  },

  /** Every non-terminal task (Dashboard "teams at work" feed). */
  async listActive(executor: Executor | null | undefined): Promise<TeamTask[]> {
    const all = await taskStore(executor).list();
    return all
      .filter((t) => !isTerminalTaskStatus(t.status))
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  },

  /** Find the running task bound to a worker conversation (belt-and-braces
   *  close path via AI_CHAT_FINISHED). */
  async findByWorkerConversation(
    executor: Executor | null | undefined,
    workerConversationId: string,
  ): Promise<TeamTask | null> {
    const all = await taskStore(executor).list();
    return all.find((t) => t.workerConversationId === workerConversationId) ?? null;
  },

  /** Drop every task (and plan) anchored to a leader conversation (on delete). */
  async clearForConversation(executor: Executor | null | undefined, leaderConversationId: string): Promise<number> {
    const tasks = await this.listForLeaderConversation(executor, leaderConversationId);
    for (const t of tasks) if (t.id) await taskStore(executor).delete(t.id).catch(() => undefined);
    const plans = await planStore(executor).list();
    for (const p of plans) {
      if (p.leaderConversationId === leaderConversationId && p.id) {
        await planStore(executor).delete(p.id).catch(() => undefined);
      }
    }
    return tasks.length;
  },

  // ── Plans ────────────────────────────────────────────────────────────────

  async createPlan(
    executor: Executor | null | undefined,
    item: Omit<TeamPlan, "id" | "createdAt" | "updatedAt">,
  ): Promise<TeamPlan> {
    const now = new Date().toISOString();
    return planStore(executor).create({ ...item, createdAt: now, updatedAt: now });
  },

  async getPlan(executor: Executor | null | undefined, id: string): Promise<TeamPlan | null> {
    return planStore(executor).get(id) as Promise<TeamPlan | null>;
  },

  async patchPlan(
    executor: Executor | null | undefined,
    id: string,
    patch: Partial<Omit<TeamPlan, "id" | "createdAt" | "leaderConversationId">>,
  ): Promise<TeamPlan | null> {
    const current = (await planStore(executor).get(id)) as TeamPlan | null;
    if (!current) return null;
    const updated = { ...current, ...patch, updatedAt: new Date().toISOString() };
    await planStore(executor).update(id, updated);
    return updated;
  },

  /** Most recent plan for a leader conversation (the board shows one at a time). */
  async getPlanByConversation(
    executor: Executor | null | undefined,
    leaderConversationId: string,
  ): Promise<TeamPlan | null> {
    const all = await planStore(executor).list();
    const mine = all
      .filter((p) => p.leaderConversationId === leaderConversationId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    return mine[0] ?? null;
  },
};

export type { TeamTask, TeamPlan, TeamTaskStatus };
