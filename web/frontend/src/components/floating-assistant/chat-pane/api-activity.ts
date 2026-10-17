// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { ChatTurn } from "../chat-engine";
import type { TeamTaskView } from "../assistant-api";
import type { ThoughtLineEntryStatus } from "./reactbits/ThoughtLine";

/** A successful call only confirms that call, never a delegated agent's work. */
export function apiToolStatus(tool: ChatTurn["tools"][number], turn: ChatTurn): ThoughtLineEntryStatus {
  if (tool.result) return tool.result.success ? "done" : "failed";
  if (turn.stopped || turn.error || turn.interrupted || !turn.pending) return "unconfirmed";
  if (turn.permission || turn.ask?.length) return "waiting";
  return "running";
}

export function apiExecutionStatus(turn: ChatTurn, tasks: TeamTaskView[] = []): ThoughtLineEntryStatus {
  if (turn.error || turn.tools.some(tool => tool.result?.success === false)
    || tasks.some(task => task.status === "failed" || task.verify?.state === "failed")) return "failed";
  if (turn.stopped) return "stopped";
  if (turn.interrupted || turn.tools.some(tool => apiToolStatus(tool, turn) === "unconfirmed")) return "unconfirmed";
  const activeTasks = tasks.filter(task => task.status === "running" || task.status === "pending");
  if (turn.permission || turn.ask?.length || activeTasks.some(task => task.pendingPermission)) return "waiting";
  if (turn.pending || activeTasks.length) return "running";
  return "done";
}
