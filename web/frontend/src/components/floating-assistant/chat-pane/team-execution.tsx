// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { ReactNode } from "react";
import type { ChatTurn } from "../chat-engine";
import type { TeamTaskView } from "../assistant-api";
import { CompactAnswer } from "./CompactAnswer";
import { formatAssistantMessage, useAssistantI18n } from "../i18n";

// Only generated coordination messages move into execution details. Human
// messages, assistant replies and turns requiring attention keep their surface.
export function isTeamNotice(turn: ChatTurn): boolean {
  return turn.role === "user" && !!turn.auto && !turn.compacted &&
    !turn.error && !turn.permission && !turn.ask?.length && !turn.tools.length &&
    !turn.attachments?.length && !turn.interrupted && !turn.stopped &&
    !turn.translationError && !turn.status;
}

/** Attach each notice once to the following reply, or the last reply while
 * waiting for one. Without a reply yet, keep it in the execution fallback. */
export function groupTeamNotices(turns: ChatTurn[]) {
  const byTurn = new Map<number, ChatTurn[]>();
  let pending: ChatTurn[] = [];
  let lastAssistantTurnIndex = -1;
  let lastVisibleTurnIndex = -1;
  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i]!;
    if (isTeamNotice(turn)) { pending.push(turn); continue; }
    lastVisibleTurnIndex = i;
    if (turn.role === "assistant" && !turn.compacted) {
      lastAssistantTurnIndex = i;
      if (pending.length) {
        byTurn.set(i, pending);
        pending = [];
      }
    }
  }
  if (pending.length && lastAssistantTurnIndex >= 0) {
    byTurn.set(lastAssistantTurnIndex, [...(byTurn.get(lastAssistantTurnIndex) ?? []), ...pending]);
    pending = [];
  }
  return { byTurn, unanchored: pending, lastAssistantTurnIndex, lastVisibleTurnIndex };
}

export function TeamExecutionContent({ boards, notices }: { boards?: ReactNode[]; notices?: ChatTurn[] }) {
  const t = useAssistantI18n().teamBoard;
  return <>
    {boards?.map((board, index) => <div key={index} data-message-section="team" className="min-w-0 border-t border-border/60">{board}</div>)}
    {notices?.map((notice, index) => (
      <div key={index} data-team-notice className="min-w-0 border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">
        <p className="mb-1 font-medium">{t.autoTurn}</p>
        <CompactAnswer text={[notice.text, ...(notice.addenda ?? [])].filter(Boolean).join("\n")} summary={notice.addenda?.length ? undefined : notice.displaySummary} />
      </div>
    ))}
  </>;
}

/** Keep actionable states readable in the standard summary even when closed.
 * The board remains the sole place for task controls and full results. */
export function TeamExecutionAttention({ tasks }: { tasks: TeamTaskView[] }) {
  const t = useAssistantI18n().teamBoard;
  const attention = tasks.filter(task =>
    task.status === "failed" || task.verify?.state === "failed" ||
    ((task.status === "running" || task.status === "pending") && task.pendingPermission),
  );
  if (!attention.length) return null;
  return <span data-team-attention role="status" className="basis-full min-w-0 space-y-1 whitespace-normal break-words text-foreground">
    {attention.map(task => (
      <span key={task.id} className="block">
        {task.workerAgentName}: {task.pendingPermission && (task.status === "running" || task.status === "pending")
          ? t.pendingPermission
          : task.status === "failed"
            ? `${t.statusFailed}${task.error ? ` · ${task.error}` : ""}`
            : formatAssistantMessage(t.verifyFailed, { attempts: task.verify?.attempts ?? 0 })}
      </span>
    ))}
  </span>;
}
