// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { ConversationMessage } from "../../repositories/conversations.repository.js";
import { isInterruptionPlaceholder, TASK_INTERRUPTED_ERROR } from "./interruption.js";

/** The latest turn, including its structured outcome, is authoritative.
 * An older answer must never complete a newer unanswered user request. */
export function persistedWorkerOutcome(items: ConversationMessage[]) {
  const last = items.at(-1);
  if (!last || last.role !== "assistant") return undefined;
  if (last.interrupted) return { status: "canceled" as const, error: TASK_INTERRUPTED_ERROR };
  if (last.error || isInterruptionPlaceholder(last.content)) {
    return { status: "failed" as const, error: last.error || TASK_INTERRUPTED_ERROR, resultSummary: last.content };
  }
  if (last.ask?.length || last.pending) return null;
  if (last.content.trim()) return { status: "done" as const, resultSummary: last.content };
  return undefined;
}
