// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { ChatTurn } from "../chat-engine";
import { CompactAnswer } from "./CompactAnswer";
import { useAssistantI18n } from "../i18n";
import { apiExecutionStatus } from "./api-activity";
import { ToolDisclosure } from "./tool-disclosure";

/** Earlier phases belong to the same execution history, never another bubble
 * or another set of actionable approvals. The latest phase owns live controls. */
export function ExecutionPhases({ phases, showTerminal, uiMode }: {
  phases: ChatTurn[]; showTerminal: boolean; uiMode: "simple" | "advanced";
}) {
  const { chatTab: ct } = useAssistantI18n();
  const labels = { done: ct.toolTrace.done, failed: ct.toolTrace.error, running: ct.toolTrace.running,
    waiting: ct.toolTrace.waiting, unconfirmed: ct.toolTrace.unconfirmed, stopped: ct.toolTrace.stopped };
  return <ol aria-label={ct.toolTrace.viewHistory} className="divide-y divide-border/60">
    {phases.map((phase, index) => {
      const cliTools = phase.tools.filter(tool => tool.name.endsWith(".cli"));
      const isCli = !!phase.cli || cliTools.length > 0;
      const log = phase.cliHistoryLog || cliTools.map(tool => tool.laneOrder?.length
        ? tool.laneOrder.map(id => tool.lanes?.[id]?.output ?? "").join("\n") : tool.terminal ?? "").join("\n");
      const status = apiExecutionStatus(phase);
      const text = phase.text || (!phase.completionPending && !phase.pending && !phase.error && !phase.stopped && !phase.interrupted
        ? cliTools.find(tool => tool.result?.success && !tool.result.output.startsWith("["))?.result?.output ?? "" : "");
      return <li key={index} data-execution-phase className="min-w-0 space-y-2 px-3 py-2">
        <p className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{index + 1} · {labels[status]}</span>
          {Number.isFinite(phase.createdAt) && <time dateTime={new Date(phase.createdAt!).toISOString()}>{new Date(phase.createdAt!).toLocaleString()}</time>}
        </p>
        {isCli ? showTerminal && log && <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-[11px]">{log}</pre> : <>
          {phase.apiActivity?.events.map((event, eventIndex) => {
            if (event.type === "text") return <CompactAnswer key={eventIndex} text={event.delta} />;
            if (event.type === "tool_use") {
              if (phase.apiActivity!.events.findIndex(item => item.type === "tool_use" && item.id === event.id) !== eventIndex) return null;
              const tool = phase.tools.find(item => item.id === event.id);
              return tool ? <ToolDisclosure key={eventIndex} t={tool} turn={phase} uiMode={uiMode} embedded /> : null;
            }
            return phase.tools.some(tool => tool.id === event.id) ? null : <pre key={eventIndex} className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-[11px]">{event.output}</pre>;
          }) ?? phase.tools.map((tool, toolIndex) => <ToolDisclosure key={toolIndex} t={tool} turn={phase} uiMode={uiMode} embedded />)}
          {phase.apiActivity?.truncated && <p className="text-xs text-muted-foreground">{ct.toolTrace.historyTruncated}</p>}
        </>}
        {text && <CompactAnswer text={text} summary={phase.displaySummary} />}
        {isCli && showTerminal && cliTools.filter(tool => tool.result?.success === false).map((tool, toolIndex) =>
          <p key={toolIndex} className="break-words text-destructive">{tool.result!.output}</p>)}
        {phase.error && <p className="break-words text-destructive">{phase.error}</p>}
        {phase.interrupted && <p>{labels.unconfirmed}</p>}
        {phase.stopped && <p>{labels.stopped}</p>}
        {phase.translationError && <p>{phase.translationError}</p>}
        {phase.ask?.map(question => <p key={question.id}>{[question.text, ...(question.options ?? [])].join(" · ")}</p>)}
        {phase.permission && <p>{phase.permission.title}</p>}
        {phase.attachments?.map((attachment, attachmentIndex) => <a key={attachmentIndex} href={attachment.url} target="_blank" rel="noreferrer" className="block break-words underline">{attachment.name}</a>)}
      </li>;
    })}
  </ol>;
}
