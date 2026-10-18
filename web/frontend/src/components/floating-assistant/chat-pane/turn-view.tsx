import { CompactAnswer } from "./CompactAnswer";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * One chat turn (user / assistant bubble + console + affordances), its meta
 * footer, and the modified-files list. Extracted verbatim from `ChatPane.tsx`.
 */
import { useDeferredClose } from "@/components/ui/use-deferred-close";
import { backdropMotionClass, CENTERED_CARD_ENTER, CENTERED_CARD_EXIT } from "@/components/ui/ModalShell";
import { cn } from "@/lib/utils";
import { useMemo, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useAssistantI18n, formatAssistantMessage } from "../i18n";
import {
  PROVIDER_META,
  type AssistantAgent,
  type AssistantProviderId,
  type TeamTaskView,
} from "../assistant-api";
import { type ChatTurn } from "../chat-engine";
import { extractCliProgress } from "../chat-engine/cli-lanes";
import { AgentAvatar } from "../AgentAvatar";
import { ProviderIcon } from "../ProviderIcon";
import { MessageContent } from "../MessageContent";
import { bubblePrefs } from "../bubble-prefs";
import { useBodyPointerEventsWhileOpen } from "@/lib/body-pointer-events";
import { formatDuration, formatTokens } from "@/lib/format";
import { extractModifiedFiles } from "./helpers";
import { type ModifiedFileEntry } from "./types";
import { ToolDisclosure, CliHistoryView, ExecutionDisclosure } from "./tool-disclosure";
import { isTeamNotice, TeamExecutionContent, TeamExecutionAttention } from "./team-execution";
import { ExecutionPhases } from "./execution-phases";
import { AskView, PermissionView } from "./ask-permission";
import { TranslatingShimmer, PendingDot, CopyButton } from "./message-bits";
import { SpeakButton } from "./voice-controls";
import { VoiceMessage } from "./voice-message";
import ThoughtLine, { type ThoughtLineEntryStatus } from "./reactbits/ThoughtLine";
import { apiExecutionStatus, apiToolStatus } from "./api-activity";
import StatusMark, { type StatusMarkStatus } from "./reactbits/StatusMark";

/** Collapsible list of files the agent touched. Modified/created files open in
 *  the Monaco editor modal; DELETED files are shown (struck through, trash icon)
 *  but are NOT clickable — the file no longer exists to display. */
export function ModifiedFilesView({ files, onOpen, embedded = false }: { files: ModifiedFileEntry[]; onOpen: (path: string) => void; embedded?: boolean }) {
  const messages = useAssistantI18n();
  const ct = messages.chatTab as Record<string, any>;
  const [open, setOpen] = useState(false);
  const deletedCount = files.reduce((n, f) => (f.kind === "deleted" ? n + 1 : n), 0);
  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className={cn("group text-xs", embedded ? "bg-background/20" : "mt-2 rounded-md border border-border/60 bg-background/50")}
    >
      <summary className={cn("flex min-h-11 cursor-pointer list-none items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden", embedded ? "px-3 py-2" : "px-2 py-1")}>
        <i className="ti ti-files text-muted-foreground" aria-hidden></i>
        <span>{messages.providersTab.showModifiedFiles}</span>
        <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">{files.length}</span>
        {deletedCount > 0 && (
          <span
            className="inline-flex items-center gap-0.5 rounded-full bg-red-500/10 px-1.5 text-[10px] text-red-500"
            title={formatAssistantMessage(ct.deletedFilesBadge, { n: deletedCount })}
          >
            <i className="ti ti-trash text-[10px]" aria-hidden></i>
            {deletedCount}
          </span>
        )}
        <i className="ti ti-chevron-right ml-auto text-muted-foreground transition-transform group-open:rotate-90" aria-hidden></i>
      </summary>
      <div className={cn("border-t border-border/60 py-1", embedded ? "px-2.5" : "px-1.5")}>
        {files.map((f) => {
          const name = f.path.split("/").pop() || f.path;
          const dir = f.path.slice(0, f.path.length - name.length);
          if (f.kind === "deleted") {
            // Non-interactive: the file is gone, so there is nothing to open.
            return (
              <div
                key={f.path}
                title={`${f.path} · ${ct.deletedFileBadge}`}
                className="flex w-full min-w-0 items-center gap-1.5 rounded px-1.5 py-1 text-left"
              >
                <i className="ti ti-trash shrink-0 text-red-500/80" aria-hidden></i>
                <span className="min-w-0 truncate">
                  <span className="font-medium text-muted-foreground line-through">{name}</span>
                  {dir && <span className="ml-1 font-mono text-[10px] text-muted-foreground">{dir}</span>}
                </span>
                <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-red-500">{ct.deletedFileBadge}</span>
              </div>
            );
          }
          return (
            <button
              key={f.path}
              type="button"
              onClick={() => onOpen(f.path)}
              title={formatAssistantMessage(ct.openInEditorTitle, { path: f.path })}
              className="flex min-h-11 w-full min-w-0 items-center gap-1.5 rounded px-1.5 py-1 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <i className="ti ti-file-pencil shrink-0 text-primary/80" aria-hidden></i>
              <span className="min-w-0 truncate">
                <span className="font-medium">{name}</span>
                {dir && <span className="ml-1 font-mono text-[10px] text-foreground">{dir}</span>}
              </span>
              <i className="ti ti-external-link ml-auto shrink-0 text-[11px] text-muted-foreground opacity-0 group-hover:opacity-60" aria-hidden></i>
            </button>
          );
        })}
      </div>
    </details>
  );
}

export function TurnView({ turn, provider, uiMode = "advanced", isLast, onAnswer, onPermission, onNewChat, onRetry, onEditMessage, onImageClick, attachmentImageUrls, onOpenFile, projectPath, ttsAvailable, voiceName, autoSpeak, conversationId, agent, scrollContainerRef, teamBoards, teamNotices, teamTasks, executionPhases }: { turn: ChatTurn; provider: string; uiMode?: "simple" | "advanced"; isLast?: boolean; onAnswer?: (text: string, opts?: { planDecision?: "approve" }) => Promise<void> | void; onPermission?: (requestId: string, decision: "allow" | "deny" | "always", tool?: string) => void; onNewChat?: () => void; onRetry?: () => void; onEditMessage?: (text: string) => void; onImageClick?: (url: string) => void; attachmentImageUrls?: ReadonlyMap<string, string>; onOpenFile?: (path: string) => void; projectPath?: string; ttsAvailable?: boolean; voiceName?: string; autoSpeak?: boolean; conversationId?: string; agent?: AssistantAgent | null; scrollContainerRef?: RefObject<HTMLDivElement | null>; teamBoards?: ReactNode[]; teamNotices?: ChatTurn[]; teamTasks?: TeamTaskView[]; executionPhases?: ChatTurn[] }) {
  const i18n = useAssistantI18n() as Record<string, any>;
  const ct = i18n.chatTab as Record<string, any>;
  const editLabel = i18n.projectModal?.editChild ?? ct.editResendLabel ?? "Editar";
  const editTitle = editLabel;
  const isUser = turn.role === "user";
  const recordings = isUser ? (turn.attachments ?? []).filter(a => a.voice && a.mimeType.startsWith("audio/")) : [];
  const ordinaryAttachments = (turn.attachments ?? []).filter(a => !recordings.includes(a));
  const bubbleProvider = turn.provider ?? provider;
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);
  // Lightbox exit animation (200ms ease-out, motion standard) before unmount.
  const { closing: lightboxClosing, requestClose: requestLightboxClose } = useDeferredClose(() => setLightbox(null));
  const closeLightbox = () => requestLightboxClose();
  // While the image lightbox is open above the drawer, keep the body interactive.
  useBodyPointerEventsWhileOpen(!!lightbox);
  useSyncExternalStore(bubblePrefs.subscribe, () => JSON.stringify(bubblePrefs.get(bubbleProvider)), () => "{}");
  const prefs = bubblePrefs.get(bubbleProvider);
  // Per-provider display switches (set from the provider card). Default ON.
  const showModifiedFiles = prefs.modifiedFiles !== false;
  const showTerminal = prefs.terminalLive !== false;
  // Show raw input on user bubbles. (The raw assistant/CLI "output bubble" was
  // removed — that content is already visible in the live console.)
  const showRaw = isUser && prefs.input;
  // "Terminal en vivo" OFF ⇒ run the agent "in the background": hide its live
  // CLI activity console and only surface the final result/summary on settle.
  // The CLI console already contains the tool activity. Showing every nested
  // tool again as a JSON disclosure duplicates it and overwhelms the answer.
  const hasCliConsole = turn.tools.some((tool) => tool.name.endsWith(".cli"));
  const visibleTools = turn.tools.filter((tool) => tool.name.endsWith(".cli") ? showTerminal : !hasCliConsole);
  const cliRunningHidden = !showTerminal && turn.pending && turn.tools.some((tool) => tool.name.endsWith(".cli"));
  const rawText = turn.raw ?? turn.text;
  // User turns carry the forwarded English (`raw`) only when background
  // translation converted the message before sending it to the agent.
  const userForwardedEnglish = isUser && !!turn.raw;
  // A CLI answer reloaded from history: the live `.cli` tool trace is gone, but
  // the persisted execution log (`cliHistoryLog`) lets us rebuild a collapsed
  // console so the full history stays reachable.
  const isHistoryCli = !isUser && !!turn.cli && turn.tools.length === 0;
  const historyLog = isHistoryCli ? (turn.cliHistoryLog ?? "").trim() : "";
  // Summary/answer shown BELOW the (collapsed) console. Prefer the clean bubble
  // text; if a CLI provider delivered no separate answer text, fall back to the
  // finished `.cli` tool's result output so a summary always appears once the
  // run completes (ignore `[…]` placeholders / failed runs).
  const finishedCliTool = turn.tools.find((t) => t.name.endsWith(".cli") && t.result?.success);
  const cliFallbackAnswer =
    finishedCliTool?.result?.output && !finishedCliTool.result.output.startsWith("[")
      ? finishedCliTool.result.output
      : "";
  // CLI text holds its answer (live or derived from the saved log).
  // API text retains all narration for conversation context; the observed
  // tool boundary below controls presentation without rewriting that text.
  const summaryText = turn.text || (turn.completionPending || turn.error || turn.stopped || turn.interrupted ? "" : cliFallbackAnswer);
  const hasApiActivity = !isUser && !turn.cli && !hasCliConsole
    && Boolean(turn.apiActivity?.events.length || turn.apiActivity?.truncated || (turn.completionPending && turn.text));
  const groupApiTools = !isUser && !hasCliConsole && (visibleTools.length > 0 || hasApiActivity);
  // Use only observed tool boundaries, never paragraph/word heuristics.
  // Legacy history has no boundary: retain its original text intact.
  const apiTextOffset = groupApiTools && typeof turn.apiTextOffset === "number"
    && Number.isInteger(turn.apiTextOffset) && turn.apiTextOffset >= 0 && turn.apiTextOffset <= summaryText.length
    ? turn.apiTextOffset : 0;
  const holdApiText = groupApiTools && turn.pending && !turn.stopped && !turn.error
    && !turn.interrupted && !turn.permission && !turn.ask?.length;
  const answerText = holdApiText || turn.completionPending ? "" : summaryText.slice(apiTextOffset);
  const apiProgressText = groupApiTools
    ? turn.apiActivity
      ? (holdApiText || turn.completionPending ? summaryText.slice(apiTextOffset) : "")
      : (holdApiText || turn.completionPending ? summaryText : summaryText.slice(0, apiTextOffset))
    : "";
  const apiEntries = groupApiTools
    ? visibleTools.map(tool => ({ id: tool.id, label: tool.name, status: apiToolStatus(tool, turn) }))
    : undefined;
  const executionStatus = apiExecutionStatus(turn, teamTasks);
  const apiStatus = groupApiTools ? executionStatus : undefined;
  const activityLabels: Record<ThoughtLineEntryStatus, string> = {
    done: ct.toolTrace.done, failed: ct.toolTrace.error, running: ct.toolTrace.running,
    waiting: ct.toolTrace.waiting, unconfirmed: ct.toolTrace.unconfirmed, stopped: ct.toolTrace.stopped,
  };
  // A plan approval keeps the complete plan in the saved message. When the
  // agent supplies the requested summary + details format, show a short
  // preview and let the reader expand the exact text being approved.
  const planPreview = !isUser && turn.askKind === "plan-approval" && !turn.pending
    ? /^(?:\*\*)?(?:Resumen|Summary)(?:\*\*)?:\s*(.+?)\n\s*\n((?:Plan completo|Full plan):[\s\S]+)$/i.exec(answerText.trim())
    : null;
  // An execution without a final answer keeps its process available.
  const noFinalAnswer =
    !isUser &&
    !turn.pending &&
    !turn.completionPending &&
    !answerText.trim() &&
    !turn.error &&
    !turn.stopped &&
    !turn.ask?.length &&
    !turn.permission &&
    (!!turn.cli || turn.tools.length > 0 || !!turn.apiActivity);
  // Addenda: extra lines the user appended to THIS message while the run was
  // live. Rendered inside the same bubble (so it doesn't look like a new
  // message) and folded into the text for copy / edit-and-resend.
  const userAddenda = isUser ? (turn.addenda ?? []) : [];
  const combinedUserText = isUser ? [turn.text, ...userAddenda].filter(Boolean).join("\n") : turn.text;
  // Files the agent modified this turn (parsed from the CLI console). Shown in a
  // collapsible list under the console; clicking one opens the editor modal.
  const modifiedFiles = useMemo(
    () => (!isUser && onOpenFile ? [...new Map([...(executionPhases ?? []), turn]
      .flatMap(phase => extractModifiedFiles(phase, projectPath)).map(file => [file.path, file])).values()] : []),
    // Recompute as the live console grows (terminal) and once it settles (log).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isUser, onOpenFile, projectPath, turn.cliHistoryLog, turn.raw, turn.tools, executionPhases],
  );
  // The assistant avatar shows the responding provider's brand logo.
  const meta = PROVIDER_META[bubbleProvider as AssistantProviderId];
  // Console, modified files and answer share one assistant message surface.
  // Their disclosure controls and content remain separate sections inside it.
  const showWorkingIndicator = cliRunningHidden && !summaryText;
  const turnStatus: StatusMarkStatus = executionStatus === "stopped" ? "cancelled"
    : executionStatus === "waiting" || executionStatus === "unconfirmed" ? "pending" : executionStatus;
  const turnStatusLabel = activityLabels[executionStatus];
  const cliTranscript = turn.tools.filter(tool => tool.name.endsWith(".cli"))
    .map(tool => (tool.laneOrder?.length
      ? tool.laneOrder.map(id => tool.lanes?.[id]?.output ?? "").join("\n")
      : tool.terminal ?? ""))
    .join("\n") || historyLog;
  const progressMessages = showTerminal ? extractCliProgress(cliTranscript, turn.pending ? "" : summaryText) : [];
  const thoughtSteps = turn.pending ? progressMessages.slice(0, -1) : progressMessages;
  const currentThought = turn.pending && progressMessages.length
    ? progressMessages[progressMessages.length - 1]
    : (ct.toolTrace?.running ?? "Ejecutando…");
  const hasExecutionDetails = !isUser && Boolean(teamBoards?.length || teamNotices?.length);
  const executionDetails = hasExecutionDetails ? <TeamExecutionContent boards={teamBoards} notices={teamNotices} /> : undefined;
  const executionAttention = hasExecutionDetails && teamTasks?.length ? <TeamExecutionAttention tasks={teamTasks} /> : undefined;
  const hasEarlierPhases = !isUser && !!executionPhases?.length;
  const inlineExecutionDetails = hasEarlierPhases ? undefined : executionDetails;
  const inlineExecutionAttention = hasEarlierPhases ? undefined : executionAttention;
  const hasConsole =
    !isUser &&
    (groupApiTools || visibleTools.length > 0 || showWorkingIndicator || (showTerminal && isHistoryCli && !!historyLog) || hasExecutionDetails || hasEarlierPhases);
  const hasModifiedFiles = !isUser && !!onOpenFile && showModifiedFiles && modifiedFiles.length > 0;
  const hasCliTool = turn.tools.some(tool => tool.name.endsWith(".cli"));
  const hasThought = !isUser && (turn.pending || turn.completionPending || thoughtSteps.length > 0 || (showTerminal && (groupApiTools || isHistoryCli || hasCliTool)));
  // Only render the answer bubble when it actually has content. Otherwise a live
  // run (console populated, answer not yet produced) would leave an empty box.
  const hasBubbleContent =
    isUser ||
    !!answerText ||
    !!turn.status ||
    !!(turn.ask && turn.ask.length) ||
    !!turn.permission ||
    !!turn.error ||
    !!turn.interrupted ||
    !!turn.stopped ||
    !!turn.translationError ||
    !!(turn.attachments && turn.attachments.length) ||
    (!!turn.pending && !visibleTools.length && !cliRunningHidden) ||
    noFinalAnswer;
  if (isTeamNotice(turn)) {
    return <ExecutionDisclosure><TeamExecutionContent notices={[turn]} /></ExecutionDisclosure>;
  }
  return (
    <div className={`flex min-w-0 flex-col ${isUser ? "items-end" : "items-start"}`}>
      {!isUser && (
        // Cabecera del turno del asistente: en un chat ligado a un agente IA se
        // muestra la identidad del AGENTE (su avatar + nombre); en chats sueltos
        // se conserva el logo del proveedor. La fecha/hora va a la derecha, en
        // una fila por encima de la burbuja para que esta disponga de todo el
        // ancho.
        <div className="mb-1 flex items-center gap-1.5">
          {agent ? (
            // Avatar + nombre del agente = enlace al editor de información del
            // agente IA (misma acción que el chip de la cabecera del chat), para
            // que baste un clic en cualquier turno para ver/editar el agente.
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("luxipanel:assistant-settings-open", { detail: { section: "agentes", agentId: agent.id } }))}
              title={formatAssistantMessage(ct.agentChipTitle ?? "Agente: {name} · clic para info", { name: agent.name })}
              aria-label={formatAssistantMessage(ct.agentChipAria ?? "Ver información del agente {name}", { name: agent.name })}
              className="group inline-flex min-w-0 shrink cursor-pointer items-center gap-1.5 rounded-md px-0.5 py-0.5 text-left transition-colors hover:bg-violet-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
            >
              <AgentAvatar agent={agent} size={28} className="shrink-0" />
              <span className="max-w-[10rem] truncate text-xs font-medium text-foreground group-hover:underline">{agent.name}</span>
            </button>
          ) : (
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm ${meta?.accent ?? "bg-emerald-500/10 text-emerald-500"}`}>
              {meta ? (
                <ProviderIcon id={bubbleProvider as AssistantProviderId} className="text-sm" />
              ) : (
                <i className="ti ti-sparkles" aria-hidden></i>
              )}
            </div>
          )}
          {agent && bubbleProvider !== agent.providerId && meta && (
            <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground" title={`Proveedor de este turno: ${meta.label}`}>
              <ProviderIcon id={bubbleProvider as AssistantProviderId} className="text-[11px]" />
              {meta.label}
            </span>
          )}
          <span role="img" aria-label={turnStatusLabel} className="inline-flex shrink-0" title={turnStatusLabel}>
            <span aria-hidden="true"><StatusMark status={turnStatus} size={16} strokeWidth={2} strike={false} /></span>
          </span>
          <TurnMeta turn={turn} isUser={false} header />
        </div>
      )}
      {(isUser || hasThought || hasConsole || hasModifiedFiles || hasBubbleContent) && (
      <div data-assistant-message={!isUser ? "" : undefined} className={isUser ? "contents" : "w-full max-w-[48rem] min-w-0 overflow-hidden rounded-2xl rounded-tl-sm border border-border/60 bg-muted/40 shadow-sm"}>
      {hasThought && (
        <div data-message-section="reasoning" className="border-b border-border/60 px-3 py-2 text-muted-foreground">
          <ThoughtLine
            key={groupApiTools ? "api" : "cli"}
            autoExpand={!groupApiTools}
            breathDepth={groupApiTools ? 0 : undefined}
            working={executionStatus === "running"}
            label={apiStatus ? activityLabels[apiStatus] : currentThought}
            doneLabel={activityLabels[executionStatus]}
            steps={thoughtSteps}
            entries={showTerminal ? apiEntries : undefined}
            entryStatusLabels={activityLabels}
            collapseOnSettle={!groupApiTools}
            settleDuration={200}
            showTimer={false}
            shimmer={false}
            fontSize={12}
            collapsible={(showTerminal && !!apiEntries?.length) || thoughtSteps.length > 0}
            className="lxp-agent-progress"
          />
        </div>
      )}
      {/* Tool disclosures and the CLI console are rows of this message. */}
      {hasConsole && (
        <div data-message-section="console" className={cn("w-full min-w-0 divide-y divide-border/60", (hasModifiedFiles || hasBubbleContent) && "border-b border-border/60")}>
          {(() => {
            const hasHistoryConsole = showTerminal && isHistoryCli && !!historyLog;
            // API tools share one collapsed console, like a CLI execution.
            // Keep the team board and attention controls on that outer group.
            const currentConsole = (
              <>
                {groupApiTools ? (
                  <ExecutionDisclosure source="API" activityStatus={apiStatus} attention={inlineExecutionAttention}>
                    <div className="divide-y divide-border/60 border-t border-border/60">
                      {turn.apiActivity ? turn.apiActivity.events.map((event, index) => {
                        if (event.type === "text") return (
                          <div key={`text-${index}`} data-api-progress className="px-3 py-2 text-foreground">
                            <MessageContent text={event.delta} scrollContainerRef={scrollContainerRef} />
                          </div>
                        );
                        if (event.type === "tool_use") {
                          if (turn.apiActivity!.events.findIndex(item => item.type === "tool_use" && item.id === event.id) !== index) return null;
                          const tool = visibleTools.find(item => item.id === event.id);
                          return tool ? <ToolDisclosure key={tool.id} t={tool} turn={turn} uiMode={uiMode} embedded /> : null;
                        }
                        // A limited trace can contain a result without its call.
                        // Keep that received output reachable, without inventing a call.
                        return visibleTools.some(tool => tool.id === event.id) ? null : (
                          <div key={`result-${event.id}`} data-api-result className="px-3 py-2">
                            <span>{event.success ? ct.toolTrace.done : ct.toolTrace.error}</span>
                            <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words text-[11px]">{event.output}</pre>
                          </div>
                        );
                      }) : visibleTools.map(t => <ToolDisclosure key={t.id} t={t} turn={turn} uiMode={uiMode} embedded />)}
                      {apiProgressText.trim() && (
                        <div data-api-progress className="px-3 py-2 text-foreground">
                          <MessageContent text={apiProgressText} scrollContainerRef={scrollContainerRef} streaming={!!holdApiText} />
                        </div>
                      )}
                      {turn.apiActivity?.truncated && (
                        <p data-api-truncated className="px-3 py-2 text-muted-foreground">{ct.toolTrace.historyTruncated}</p>
                      )}
                    </div>
                    {inlineExecutionDetails}
                  </ExecutionDisclosure>
                ) : visibleTools.map((t, index) => (
                  <ToolDisclosure key={t.id} t={t} turn={turn} uiMode={uiMode} embedded attention={index === 0 ? inlineExecutionAttention : undefined}>
                    {index === 0 ? inlineExecutionDetails : undefined}
                  </ToolDisclosure>
                ))}
                {/* Reloaded CLI turn: collapsed "Consola del servidor" from the log. */}
                {hasHistoryConsole && <CliHistoryView text={historyLog} embedded activityStatus={executionStatus} attention={inlineExecutionAttention}>{inlineExecutionDetails}</CliHistoryView>}
                {hasExecutionDetails && !hasEarlierPhases && !groupApiTools && !visibleTools.length && !hasHistoryConsole && (
                  <ExecutionDisclosure activityStatus={executionStatus} attention={inlineExecutionAttention}>
                    {inlineExecutionDetails}
                  </ExecutionDisclosure>
                )}
              </>
            );
            return hasEarlierPhases ? <ExecutionDisclosure activityStatus={executionStatus} attention={executionAttention}>
              <ExecutionPhases phases={executionPhases!} showTerminal={showTerminal} uiMode={uiMode} />
              {currentConsole}
              {executionDetails}
            </ExecutionDisclosure> : currentConsole;
          })()}
          {/* Background mode: live console hidden — discreet "working" hint. */}
          {showWorkingIndicator && (
            <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground">
              <i className="ti ti-loader-2 animate-spin shrink-0" aria-hidden></i>
              <span>{ct.workingBackground ?? "Trabajando en segundo plano…"}</span>
            </div>
          )}
        </div>
      )}
      {hasModifiedFiles && (
        <div data-message-section="files" className={cn(hasBubbleContent && "border-b border-border/60")}>
          <ModifiedFilesView files={modifiedFiles} onOpen={onOpenFile!} embedded />
        </div>
      )}
      {hasBubbleContent && (
      <div data-message-section={!isUser ? "answer" : undefined} className={isUser ? "max-w-[85%] min-w-0 overflow-hidden break-words rounded-2xl rounded-tr-sm bg-indigo-100 px-2.5 py-1.5 text-sm text-indigo-900 dark:bg-[#30343b] dark:text-zinc-100 dark:ring-1 dark:ring-white/10" : "min-w-0 break-words px-3.5 py-3 text-sm"}>
        {ordinaryAttachments.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {ordinaryAttachments.map((a, i) =>
              a.mimeType.startsWith("image/") ? (
                <button
                  key={i}
                  type="button"
                  disabled={a.url.startsWith("/api/") && !attachmentImageUrls?.has(a.url)}
                  onClick={() => (onImageClick ? onImageClick(a.url) : setLightbox({ url: a.url, name: a.name }))}
                  title={`${a.name} · ${ct.clickToExpand ?? "clic para ampliar"}`}
                  className="group relative block overflow-hidden rounded-lg border border-border/40 disabled:cursor-wait"
                >
                  {a.url.startsWith("/api/") && !attachmentImageUrls?.has(a.url) ? (
                    <span className="flex h-20 w-20 items-center justify-center text-muted-foreground"><i className="ti ti-photo text-xl" aria-hidden="true" /></span>
                  ) : (
                    <img src={attachmentImageUrls?.get(a.url) ?? a.url} alt={a.name} className="h-20 w-20 object-cover transition group-hover:opacity-80" loading="lazy" />
                  )}
                  <span className="absolute bottom-0.5 right-0.5 rounded bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100">
                    <i className="ti ti-arrows-maximize text-[10px]" aria-hidden></i>
                  </span>
                </button>
              ) : (
                <a
                  key={i}
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  title={a.name}
                  className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-background/40 px-2 py-1 text-xs no-underline"
                >
                  <i className="ti ti-file" aria-hidden></i>
                  <span className="max-w-[140px] truncate">{a.name}</span>
                </a>
              ),
            )}
          </div>
        )}
        {showRaw && rawText && !recordings.length && (
          <details className="mt-1.5 rounded-md bg-background/40 border border-border/60 text-xs">
            <summary className="cursor-pointer px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              {isUser ? (userForwardedEnglish ? (ct.rawForwardedEnglish ?? "texto enviado al agente (inglés)") : (ct.rawInput ?? "input crudo")) : (ct.rawOutputBackground ?? "output crudo (background)")}
            </summary>
            <pre className="border-t border-border/60 px-2 py-1 text-[11px] overflow-x-auto max-h-72 whitespace-pre-wrap">{rawText}</pre>
          </details>
        )}
        {/* Summary/answer of the turn — rendered BELOW the (collapsed) console
            so the user reads the final answer while the full process log stays
            tucked away in the collapsed container above. */}
        {recordings.length > 0
          ? <VoiceMessage recordings={recordings} forwardedText={turn.raw ?? turn.text} />
          : answerText
          ? planPreview
            ? <>
                <CompactAnswer text={planPreview[1]!} summary={turn.displaySummary} />
                <details className="group mt-2 rounded-lg border border-border/60 bg-background/40 px-2.5 py-2">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-primary [&::-webkit-details-marker]:hidden">
                    <i className="ti ti-list-details" aria-hidden />
                    <span>{ct.viewFullPlan ?? "Ver plan completo"}</span>
                    <i className="ti ti-chevron-down ml-auto text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <div className="mt-2 border-t border-border/60 pt-2">
                    <MessageContent text={planPreview[2]!} scrollContainerRef={scrollContainerRef} />
                  </div>
                </details>
              </>
            : isUser ? <MessageContent text={answerText} scrollContainerRef={scrollContainerRef} streaming={turn.pending} />
            : <CompactAnswer text={answerText} summary={turn.displaySummary} streaming={turn.pending} />
          : turn.status
            ? <TranslatingShimmer state={turn.status} />
            : turn.pending && !visibleTools.length && !cliRunningHidden
              ? <PendingDot />
              : noFinalAnswer
                ? <p className="text-xs italic text-muted-foreground">{ct.noFinalAnswer}</p>
                : null}
        {/* Addenda appended mid-run: extra lines of the SAME message, stacked
            just below the original text so it reads as one continuous message. */}
        {isUser && userAddenda.length > 0 && (
          <div className="mt-1 space-y-1">
            {userAddenda.map((a, i) => (
              <MessageContent key={i} text={a} scrollContainerRef={scrollContainerRef} streaming={turn.pending} />
            ))}
          </div>
        )}
        {!isUser && turn.ask && turn.ask.length > 0 && (
          <AskView
            questions={turn.ask}
            kind={turn.askKind}
            interactive={!!isLast && !!onAnswer && !turn.pending && !turn.stopped}
            onAnswer={(text, opts) => onAnswer?.(text, opts)}
          />
        )}
        {!isUser && turn.permission && (
          <PermissionView
            request={turn.permission}
            interactive={!!isLast && !!onPermission && !turn.stopped}
            onDecide={(decision) =>
              onPermission?.(turn.permission!.id, decision, turn.permission!.tool)
            }
          />
        )}
        {/* Quick replies — only on the last finished assistant turn. One-tap
            follow-ups; great for non-technical users who don't know what to ask. */}
        {!isUser && isLast && onAnswer && answerText && !turn.pending && !turn.stopped && !turn.error && !(turn.ask && turn.ask.length) && (
          <>
          {/* Divider between the answer text and the quick-reply buttons. */}
          <div className="mt-2 border-t border-border" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              { label: ct.quickRewrite ?? "Reescribe", icon: "ti-refresh", onClick: () => onAnswer(ct.quickRewritePrompt ?? "Reescribe la respuesta") },
              { label: ct.quickSummarize ?? "Resúmelo", icon: "ti-list", onClick: () => onAnswer(ct.quickSummarizePrompt ?? "Resume más la respuesta") },
              { label: ct.quickContinue ?? "Continúa", icon: "ti-arrow-right", onClick: () => onAnswer(ct.quickContinuePrompt ?? "Continuar") },
              ...(onRetry ? [{ label: ct.quickRetry ?? "Reintentar", icon: "ti-reload", onClick: onRetry }] : []),
              { label: ct.quickReview ?? "Revisar", icon: "ti-eye-check", onClick: () => onAnswer(ct.quickReviewPrompt ?? "Revisar últimos cambios") },
            ].map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={q.onClick}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background/60 px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <i className={`ti ${q.icon} text-[11px]`} aria-hidden></i>
                {q.label}
              </button>
            ))}
          </div>
          </>
        )}
        {turn.interrupted && !turn.error && (
          <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-600 dark:text-amber-400">
            <i className="ti ti-cloud-pause shrink-0" aria-hidden></i>
            <span>{ct.connectionInterrupted ?? "Conexión interrumpida — la tarea sigue en el servidor; reanudando al volver…"}</span>
          </div>
        )}
        {/* Background-translation failure: the answer is shown untranslated. A
            collapsed, muted notice (not a hard error) explaining why, with the
            error detail tucked inside. */}
        {!isUser && turn.translationError && (
          <details className="group mt-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
            <summary className="flex cursor-pointer select-none items-center gap-1.5">
              <i className="ti ti-language-off shrink-0" aria-hidden></i>
              <span>{ct.shownUntranslated ?? "Mostrado sin traducir — la traducción no se pudo realizar"}</span>
              <i className="ti ti-chevron-down ml-auto shrink-0 transition-transform group-open:rotate-180" aria-hidden></i>
            </summary>
            <p className="mt-1.5 break-words text-muted-foreground/90">{turn.translationError}</p>
          </details>
        )}
        {turn.stopped && !turn.error && (
          <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
            <i className="ti ti-player-stop shrink-0" aria-hidden></i>
            <span>{ct.processStopped ?? "Proceso parado."}</span>
          </div>
        )}
        {turn.error && (
          <div className="mt-2 rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-2 text-xs text-red-600 dark:text-red-400">
            <p className="flex items-center gap-1.5 font-medium">
              <i className="ti ti-alert-circle shrink-0" aria-hidden></i>
              {ct.answerFailed ?? "No se pudo completar la respuesta"}
            </p>
            <p className="mt-1 break-words text-red-600/90 dark:text-red-400/90">{turn.error}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {onRetry && (
                // Resend the user message that produced this error (C5).
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-background/40 px-2 py-1 font-medium hover:bg-background/70"
                  title={ct.resendLast ?? "Reenviar el último mensaje"}
                >
                  <i className="ti ti-refresh" aria-hidden></i>
                  {ct.retry ?? "Reintentar"}
                </button>
              )}
              {onNewChat && (
                <button
                  type="button"
                  onClick={onNewChat}
                  className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-background/40 px-2 py-1 font-medium hover:bg-background/70"
                >
                  <i className="ti ti-plus" aria-hidden></i>
                  {ct.newChat ?? "Empezar nuevo chat"}
                </button>
              )}
            </div>
          </div>
        )}
        {/* User bubble: divider between the text and the date/meta row. */}
        {isUser && (summaryText || userAddenda.length > 0) && (
          <div className="mt-1.5 border-t border-indigo-900/15 dark:border-white/15" />
        )}
        {isUser && (
          <div className="mt-1 flex items-center justify-end gap-2">
            {combinedUserText && (
              <CopyButton
                text={combinedUserText}
                className="inline-flex items-center gap-1 text-[10px] text-indigo-700/70 hover:text-indigo-900 dark:text-zinc-300/80 dark:hover:text-white"
              />
            )}
            {onEditMessage && combinedUserText && (
              <button
                type="button"
                onClick={() => onEditMessage(combinedUserText)}
                className="inline-flex items-center gap-1 text-[10px] text-indigo-700/70 hover:text-indigo-900 dark:text-zinc-300/80 dark:hover:text-white"
                title={editTitle}
              >
                <i className="ti ti-pencil text-[11px]" aria-hidden></i>
                {editLabel}
              </button>
            )}
            <TurnMeta turn={turn} isUser />
          </div>
        )}
        {!isUser && answerText && !turn.pending && !turn.error && (
          <div className="mt-1.5 flex items-center gap-1">
            <CopyButton text={answerText} />
            {ttsAvailable && answerText && (
              <SpeakButton text={answerText} voiceName={voiceName} conversationId={conversationId} autoPlay={!!autoSpeak && !!isLast} />
            )}
          </div>
        )}
      </div>
      )}
      </div>
      )}

      {lightbox && typeof document !== "undefined" && createPortal(
        <div
          className={cn("fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4", backdropMotionClass(lightboxClosing), lightboxClosing && "pointer-events-none")}
          onClick={closeLightbox}
          onPointerDown={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label={ct.close ?? "Cerrar"}
          >
            <i className="ti ti-x text-lg" aria-hidden></i>
          </button>
          <img
            src={lightbox.url}
            alt={lightbox.name}
            className={cn("max-h-full max-w-full rounded-lg object-contain shadow-2xl", lightboxClosing ? CENTERED_CARD_EXIT : CENTERED_CARD_ENTER)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body,
      )}
    </div>
  );
}

/** Footer line: response time + how long it took (assistant turns). */
export function TurnMeta({ turn, isUser, header = false }: { turn: ChatTurn; isUser: boolean; header?: boolean }) {
  const ct = useAssistantI18n().chatTab as Record<string, any>;
  if (turn.pending || !turn.createdAt) return null;
  const d = new Date(turn.createdAt);
  const time = d.toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return (
    <div className={`flex items-center gap-1.5 text-[10px] text-muted-foreground ${header ? "" : isUser ? "mt-1 justify-end text-indigo-700/70 dark:text-zinc-300/80" : "mt-1"}`}>
      <span className="tabular-nums">{time}</span>
      {!isUser && typeof turn.durationMs === "number" && (
        <>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-0.5 tabular-nums" title={ct.responseTime ?? "Tiempo en responder"}>
            <i className="ti ti-clock text-[10px]" aria-hidden></i>
            {formatDuration(turn.durationMs)}
          </span>
        </>
      )}
      {!isUser && turn.tokens && turn.tokens.total > 0 && (
        <>
          <span aria-hidden>·</span>
          <span
            className="inline-flex items-center gap-0.5 tabular-nums"
            title={formatAssistantMessage(ct.turnTokenTooltip ?? "Tokens de esta consulta — entrada {n} / salida {m}", { n: turn.tokens.input.toLocaleString(), m: turn.tokens.output.toLocaleString() }) + (turn.tokens.estimated ? " (estimado)" : "")}
          >
            <i className="ti ti-coin text-[10px]" aria-hidden></i>
            {formatTokens(turn.tokens.total)}
            {turn.tokens.estimated ? "~" : ""} tok
          </span>
        </>
      )}
    </div>
  );
}
