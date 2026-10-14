// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Live progress events into the leader's open stream + the persistent event
 * bus (so the dedicated assistant WS channel gets task updates regardless of
 * whether the leader is still streaming).
 */

import { createModuleLogger } from "../../../../shared/logger/index.js";
import { eventBus, Events } from "../../../../shared/events/index.js";
import { agentRunRegistry } from "../agent-run-registry.js";
import { isTerminalTaskStatus, toTaskView, type TeamTask } from "../../models/team-task.types.js";
import { executionTargetId } from "../execution-scope.js";

const log = createModuleLogger("assistant-team-tasks");

/**
 * Counter for correlation IDs across all task updates of this process. The
 * frontend uses the same ID to dedupe an event it already got via SSE from
 * the one delivered via the dedicated /api/assistant/ws channel.
 */
let taskUpdateCorrelationSeq = 0;
function nextTaskCorrelationId(): string {
  taskUpdateCorrelationSeq = (taskUpdateCorrelationSeq + 1) >>> 0;
  return `ttu-${Date.now().toString(36)}-${taskUpdateCorrelationSeq.toString(36)}`;
}

export function emitTaskUpdate(task: TeamTask, phase: "assigned" | "dispatched" | "verify" | "closed", targetId = executionTargetId()): void {
  const view = toTaskView(task);
  const correlationId = nextTaskCorrelationId();
  // 1. Push to the leader's open SSE stream (if still alive). No-op when the
  //    leader's run already finished — the WS path below is the fallback.
  agentRunRegistry.inject(task.leaderConversationId, {
    type: "team_task_update",
    task: view,
  }, targetId);
  // 2. Fan out via the persistent event bus so the dedicated assistant WS
  //    channel (and any other cross-module listener) gets it REGARDLESS of
  //    whether the leader is streaming. This is what fixes the stale chip
  //    "En curso" when the leader already closed its run.
  try {
    eventBus.emit(Events.AI_TEAM_TASK_UPDATE, {
      task: view,
      targetId,
      phase,
      correlationId,
      userId: task.userId ?? null,
      leaderConversationId: task.leaderConversationId,
      workerConversationId: task.workerConversationId,
    });
  } catch (err) {
    log.warn({ err: (err as Error).message, taskId: task.id, phase }, "AI_TEAM_TASK_UPDATE emit failed");
  }
}

/** Back-compat alias — the existing close paths used this name. */
export function injectTaskUpdate(task: TeamTask, targetId?: string): void {
  emitTaskUpdate(task, isTerminalTaskStatus(task.status) ? "closed" : "verify", targetId);
}
