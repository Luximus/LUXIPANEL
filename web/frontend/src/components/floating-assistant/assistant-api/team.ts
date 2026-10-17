// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { api, unwrap } from "@/lib/api-client";

// ── Team task board (leader → subordinate delegation) ──────────────────────

export type TeamTaskStatus = "pending" | "running" | "done" | "failed" | "canceled";

/** Verification pass state ("definition of done" commands run on task close). */
export interface TeamTaskVerify {
  state: "running" | "passed" | "failed" | "skipped";
  attempts: number;
}

/** Worktree/lease isolation metadata for a delegated task. */
export interface TeamTaskIsolation {
  mode: "worktree" | "lease" | "none";
  branch?: string;
  integrated?: boolean;
}

/** Aggregated artifacts of a finished task (diff stats + token spend). */
export interface TeamTaskArtifacts {
  filesChangedTotal?: number;
  insertions?: number;
  deletions?: number;
  tokens?: { inputTokens: number; outputTokens: number; totalTokens: number; estimated: boolean; overBudget?: boolean };
}

/** Compact view of a delegated background task (progress card). */
export interface TeamTaskView {
  id: string;
  title: string;
  status: TeamTaskStatus;
  workerAgentId: string;
  workerAgentName: string;
  workerConversationId: string;
  planId?: string | null;
  pendingPermission?: boolean;
  error?: string;
  createdAt: string;
  finishedAt?: string;
  /** Verify pass ("definition of done") state, when the platform ran one. */
  verify?: TeamTaskVerify;
  /** Worktree/lease isolation info (branch + integration state). */
  isolation?: TeamTaskIsolation;
  /** Diff stats + token spend of the finished task. */
  artifacts?: TeamTaskArtifacts;
}

/** Result of GET /team/tasks/:id/diff (null on 404 = no diff available). */
export interface TeamTaskDiff {
  taskId: string;
  branch?: string;
  baseSha?: string;
  headSha?: string;
  filesChanged: Array<{ path: string; status: string; insertions: number; deletions: number }>;
  filesChangedTotal: number;
  diff: string;
  truncated: boolean;
  source: "live" | "preview";
}

export type TeamTaskRating = "up" | "down";

export interface TeamTaskFeedback {
  taskId: string;
  rating: TeamTaskRating;
  note?: string;
}

export interface TeamPlanStep {
  title: string;
  workerAgentId?: string;
  status: "pending" | "assigned" | "done" | "failed";
}

export interface TeamPlan {
  id: string;
  leaderConversationId: string;
  title: string;
  goal: string;
  steps: TeamPlanStep[];
  status: "active" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
}

/**
 * Persisted rehydration snapshot of ONE delegated task, as returned by
 * `GET /api/ai/conversations/:id/team-tasks` (assignee-first field names —
 * mirrors the backend's `TeamTaskSnapshot`). Optional task details use the
 * same compact, server-sanitized projection as `team_task_update`; older
 * snapshots may omit them. Rebuilds the "Equipo trabajando" board after a
 * reload without requiring an in-memory stream.
 */
export interface TeamTaskSnapshot {
  taskId: string;
  leaderConversationId: string;
  title: string;
  /** Subagent the task was delegated to — drives the avatar. */
  assigneeAgentId: string;
  assigneeName: string;
  state: TeamTaskStatus;
  /** The worker's background chat ("Abrir chat"). */
  childConversationId: string;
  planId: string | null;
  stepIndex: number | null;
  pendingPermission: boolean;
  error: string | null;
  /** Optional for old tasks/snapshots; the same allowlisted detail as SSE. */
  artifacts?: TeamTaskView["artifacts"];
  verify?: TeamTaskView["verify"];
  isolation?: TeamTaskView["isolation"];
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

/** One fetch's worth of rehydration data for a leader conversation: every
 *  delegated task (running + terminal, reconciled) plus the plan header and
 *  a completed/total counter for "N de M tareas completadas". */
export interface ConversationTeamTasksSnapshot {
  conversationId: string;
  total: number;
  completed: number;
  terminal: number;
  planId: string | null;
  plan: TeamPlan | null;
  tasks: TeamTaskSnapshot[];
}

/** Adapt a rehydration snapshot row into the shape the live board renders
 *  (`TeamTaskBoard` only knows `TeamTaskView`). */
export function snapshotToTaskView(s: TeamTaskSnapshot): TeamTaskView {
  return {
    id: s.taskId,
    title: s.title,
    status: s.state,
    workerAgentId: s.assigneeAgentId,
    workerAgentName: s.assigneeName,
    workerConversationId: s.childConversationId,
    planId: s.planId,
    ...(s.pendingPermission ? { pendingPermission: true } : {}),
    ...(s.error ? { error: s.error } : {}),
    ...(s.artifacts ? { artifacts: s.artifacts } : {}),
    ...(s.verify ? { verify: s.verify } : {}),
    ...(s.isolation ? { isolation: s.isolation } : {}),
    createdAt: s.createdAt,
    ...(s.finishedAt ? { finishedAt: s.finishedAt } : {}),
  };
}

export const teamApi = {
  /** Tasks anchored to a leader conversation (reconciled server-side). */
  async listTasks(conversationId: string): Promise<TeamTaskView[]> {
    const res = await api.get<{ ok: boolean; tasks: TeamTaskView[] }>(
      `/api/ai/team/tasks?conversationId=${encodeURIComponent(conversationId)}`,
    );
    return res.data?.tasks ?? [];
  },

  /** Persisted rehydration snapshot of a leader conversation's delegated tasks
   *  (`GET /api/ai/conversations/:id/team-tasks`). Unlike `listTasks` this reads
   *  the conversation sidecar, so the "Equipo trabajando" board survives a
   *  reload once the in-memory run buffer is gone. Null on error (fail-open). */
  async getConversationSnapshot(conversationId: string): Promise<ConversationTeamTasksSnapshot | null> {
    const res = await api.get<ConversationTeamTasksSnapshot>(
      `/api/ai/conversations/${encodeURIComponent(conversationId)}/team-tasks`,
    );
    if (!res.ok || !res.data) return null;
    return res.data;
  },

  /** Every non-terminal task on the connected server (Dashboard widget). */
  async listActive(): Promise<TeamTaskView[]> {
    const res = await api.get<{ ok: boolean; tasks: TeamTaskView[] }>("/api/ai/team/tasks/active");
    if (!res.ok || !Array.isArray(res.data?.tasks)) throw new Error("Invalid active tasks snapshot");
    return res.data.tasks;
  },

  /** Resolve the leader chat that spawned a worker conversation (null if the
   *  conversation isn't a delegated worker chat). Lets a worker chat offer a
   *  "back to leader" affordance regardless of how it was opened. */
  async byWorker(
    workerConversationId: string,
  ): Promise<{ leaderConversationId: string; leaderAgentId: string; workerAgentName: string } | null> {
    const res = await api.get<{
      ok: boolean;
      task: { leaderConversationId: string; leaderAgentId: string; workerAgentName: string } | null;
    }>(`/api/ai/team/tasks/by-worker?conversationId=${encodeURIComponent(workerConversationId)}`);
    return res.data?.task ?? null;
  },

  /** Latest team plan of a leader conversation (null when none). */
  async getPlan(conversationId: string): Promise<TeamPlan | null> {
    const res = await api.get<{ ok: boolean; plan: TeamPlan | null }>(
      `/api/ai/team/plan?conversationId=${encodeURIComponent(conversationId)}`,
    );
    return res.data?.plan ?? null;
  },

  /** Cancel a delegated task (stops the worker's run). */
  async cancelTask(taskId: string): Promise<TeamTaskView | null> {
    const res = await api.post<{ ok: boolean; task?: TeamTaskView }>(
      `/api/ai/team/tasks/${encodeURIComponent(taskId)}/cancel`,
      {},
    );
    return res.data?.task ?? null;
  },

  /** Token usage of a leader chat: leader turns + every worker chat + total. */
  async getSummary(conversationId: string): Promise<TeamSummary | null> {
    const res = await api.get<{ ok: boolean; summary?: TeamSummary }>(
      `/api/ai/team/summary?conversationId=${encodeURIComponent(conversationId)}`,
    );
    return res.data?.summary ?? null;
  },

  /** Diff of a task's worktree branch. Returns null when the backend has no
   *  diff for it (404: no worktree or no changes). */
  async getTaskDiff(taskId: string): Promise<TeamTaskDiff | null> {
    const res = await api.get<{ ok: boolean } & TeamTaskDiff>(
      `/api/ai/team/tasks/${encodeURIComponent(taskId)}/diff`,
    );
    if (!res.ok || !res.data) return null;
    return res.data;
  },

  /** Cancel every non-terminal task of a leader conversation (also closes the
   *  active plan as failed). Returns the updated tasks. */
  async cancelAllTasks(conversationId: string): Promise<{ canceled: number; tasks: TeamTaskView[] }> {
    const res = await api.post<{ ok: boolean; canceled: number; tasks: TeamTaskView[] }>(
      `/api/ai/team/tasks/cancel-all?conversationId=${encodeURIComponent(conversationId)}`,
      {},
    );
    const data = unwrap(res, "Failed to cancel tasks");
    return { canceled: data.canceled ?? 0, tasks: data.tasks ?? [] };
  },

  /** Manually assign a background task to a subordinate of the leader chat.
   *  Validation errors (invalid subordinate, project outside the closure,
   *  12-task cap) surface as a thrown Error with the backend's message. */
  async assignTask(body: {
    conversationId: string;
    agentId: string;
    task: string;
    title?: string;
    projectId?: string;
  }): Promise<TeamTaskView> {
    const res = await api.post<{ ok: boolean; task: TeamTaskView }>("/api/ai/team/tasks", body);
    if (!res.ok || !res.data?.task) throw new Error(res.error ?? "Failed to assign task");
    return res.data.task;
  },

  /** Rate a finished task (400 if the task isn't terminal yet). */
  async sendTaskFeedback(taskId: string, rating: TeamTaskRating, note?: string): Promise<TeamTaskFeedback> {
    const res = await api.post<{ ok: boolean; feedback: TeamTaskFeedback }>(
      `/api/ai/team/tasks/${encodeURIComponent(taskId)}/feedback`,
      { rating, ...(note ? { note } : {}) },
    );
    if (!res.ok || !res.data?.feedback) throw new Error(res.error ?? "Failed to send feedback");
    return res.data.feedback;
  },

  /** Feedback already recorded for a leader conversation's tasks. */
  async listFeedback(conversationId: string): Promise<TeamTaskFeedback[]> {
    const res = await api.get<{ ok: boolean; feedback: TeamTaskFeedback[] }>(
      `/api/ai/team/feedback?conversationId=${encodeURIComponent(conversationId)}`,
    );
    if (!res.ok || !res.data) return [];
    return res.data.feedback ?? [];
  },
};

export interface TeamUsageTotals {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  count: number;
  estimated: boolean;
}

export interface TeamSummary {
  total: TeamUsageTotals;
  leader: TeamUsageTotals;
  tasks: Array<{
    taskId?: string;
    title: string;
    workerAgentName: string;
    workerConversationId: string;
    status: TeamTaskStatus;
    durationMs: number | null;
    tokens: TeamUsageTotals;
  }>;
}
