// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { ChatTurn } from "../chat-engine";
import type { TeamTaskView } from "../assistant-api";
import type { ThoughtLineEntryStatus } from "./reactbits/ThoughtLine";

/** A successful call only confirms that call, never a delegated agent's work. */
export function apiToolStatus(tool: ChatTurn["tools"][number], turn: ChatTurn): ThoughtLineEntryStatus {
  if (tool.result?.success === false) return "failed";
  if (tool.name.endsWith(".cli")) {
    if (turn.error) return "failed";
    if (turn.stopped) return "stopped";
    if (turn.interrupted) return "unconfirmed";
    if (turn.completionPending || turn.permission || turn.ask?.length) return "waiting";
    if (turn.pending || turn.status) return "running";
  }
  if (tool.result) return "done";
  if (turn.stopped || turn.error || turn.interrupted) return "unconfirmed";
  if (turn.permission || turn.ask?.length || turn.completionPending) return "waiting";
  if (!turn.pending) return "unconfirmed";
  return "running";
}

export function apiExecutionStatus(turn: ChatTurn, tasks: TeamTaskView[] = []): ThoughtLineEntryStatus {
  if (turn.error || turn.tools.some(tool => tool.result?.success === false)
    || tasks.some(task => task.status === "failed" || task.verify?.state === "failed")) return "failed";
  if (turn.stopped) return "stopped";
  if (turn.interrupted || turn.tools.some(tool => apiToolStatus(tool, turn) === "unconfirmed")) return "unconfirmed";
  const activeTasks = tasks.filter(task => task.status === "running" || task.status === "pending");
  if (turn.permission || turn.ask?.length || activeTasks.some(task => task.pendingPermission)) return "waiting";
  if (turn.pending || turn.status || tasks.some(task => task.status === "running" || task.verify?.state === "running")) return "running";
  if (activeTasks.length) return "waiting";
  if (tasks.some(task => task.status === "canceled")) return "stopped";
  if (turn.completionPending) return "waiting";
  // Successful calls do not constitute a final answer by themselves.
  if ((turn.tools.length || turn.apiActivity) && !turn.cli && !turn.tools.some(tool => tool.name.endsWith(".cli"))
    && !turn.text.slice(turn.apiTextOffset ?? 0).trim()) return "unconfirmed";
  return "done";
}
