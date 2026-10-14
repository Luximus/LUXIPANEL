// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { AskQuestion, TeamTaskView, AgentMessage, ChatAttachment } from "../assistant-api";

/**
 * One terminal "lane" inside a CLI tool. A multi-agent run (opus 4.8) produces
 * an orchestrator plus N sub-agents; each gets its own lane → its own tab.
 * `id` is `"main"` for the orchestrator, else the spawning Agent/Task tool_use
 * id (matches `parent_tool_use_id` of the sub-agent's stream-json events).
 */
export interface CliLane {
  id: string;
  /** Tab label: "Orquestador" for main, else the sub-agent's description. */
  title: string;
  /** Claude sub-agent type (e.g. "general-purpose") — shown as a hint. */
  subagentType?: string;
  status?: "running" | "done" | "failed";
  /** Live raw terminal output (ANSI) for this lane. */
  output: string;
}

export interface ToolTrace {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: { success: boolean; output: string };
  /**
   * CLI mode only: live raw terminal output (ANSI) of the ORCHESTRATOR lane,
   * accumulated from the streamed text deltas. Kept as a flat mirror of the
   * `main` lane for the history/`done` fallback paths. Rendered into an xterm
   * mini-terminal in the bubble.
   */
  terminal?: string;
  /**
   * CLI mode only: per-agent terminal lanes (orchestrator + sub-agents),
   * demultiplexed from the in-band lane tokens the backend embeds in the text
   * deltas. Rendered as terminal tabs. Absent for non-multi-agent legacy paths.
   */
  lanes?: Record<string, CliLane>;
  /** Display order of {@link lanes} — `"main"` first, sub-agents as registered. */
  laneOrder?: string[];
  /** Lane that un-tokenized text currently routes to (persisted across deltas). */
  activeLane?: string;
}

export interface TurnAttachment {
  name: string;
  mimeType: string;
  /** Renderable src — a data: URL (just sent) or /api/ai/attachments/:id (history). */
  url: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  provider?: string;
  text: string;
  tools: ToolTrace[];
  /**
   * User turns only: extra lines the user appended to THIS message while the run
   * was still in flight ("añadiduras"/steering). Display-only — rendered as
   * extra lines inside the SAME bubble (so it doesn't look like a new message)
   * and folded into the text for copy/edit. NOT part of `text`, so it never
   * pollutes the history `buildAgentMessages` sends (the addendum reaches the
   * model via live steering, or as a continuation turn drained on settle).
   */
  addenda?: string[];
  attachments?: TurnAttachment[];
  /** Raw background transcript: every event (tool calls, results, usage,
   *  text) the provider streamed — shown in the "output crudo" collapsible. */
  raw?: string;
  pending?: boolean;
  error?: string;
  /**
   * True when the stream was cut by a transport drop (not a real agent error)
   * — e.g. the mobile WebView was frozen on an app-switch. The run keeps going
   * on the backend; the engine resumes/reloads when the page returns to the
   * foreground, so this is a recoverable, softer state than `error`.
   */
  interrupted?: boolean;
  /**
   * Assistant turns only: an interactive question the CLI agent posed. When this
   * is the LAST turn, the bubble renders selectable controls (buttons / checkboxes
   * / text input); the user's answer is sent as the next turn and resumes the
   * session. Set live from the `ask` event and on reload from history.
   */
  ask?: AskQuestion[];
  /**
   * Con `ask`: "plan-approval" marca la pregunta como aprobación de plan. La
   * PRIMERA opción envía `planDecision:"approve"` (flag estructurado, nunca
   * matching de texto) para que el siguiente turno ejecute con gate manual.
   */
  askKind?: "plan-approval";
  /**
   * Assistant turns only: a LIVE permission prompt — the Claude CLI wants to run
   * a mutating tool and is blocked awaiting the user. The bubble renders
   * approve/deny buttons; the decision is POSTed mid-run and the turn continues.
   * Set from a `permission_request` event, cleared on `permission_resolved` (or
   * when the user clicks). Transient: never persisted to history.
   */
  permission?: { id: string; tool: string; title: string; detail?: string };
  /** Epoch ms: when the user sent (user turn) or when the response finished
   *  (assistant turn). For history turns it's the stored message timestamp. */
  createdAt?: number;
  /** Assistant turns only: ms elapsed from the user's send to completion. */
  durationMs?: number;
  /**
   * History turns only: true when this assistant answer was a CLI-mode run.
   * Live CLI turns carry a `.cli` ToolTrace (with its xterm terminal); once
   * reloaded from the server that trace is gone, so this flag tells the bubble
   * to keep rendering the answer in the compact terminal-styled box.
   */
  cli?: boolean;
  /**
   * History turns only: the persisted full CLI execution log (ANSI-stripped,
   * the run's raw `content`). On reload the live xterm trace is gone, so this
   * feeds a collapsed "Consola del servidor" box; the clean answer (the
   * translated summary, when present) is shown below it.
   */
  cliHistoryLog?: string;
  /**
   * True when the user pressed "detener": the run was aborted on purpose (local
   * fetch + backend run). The bubble shows a "proceso parado" notice and
   * collapses/hides the live CLI mini-terminal instead of leaving it "running".
   */
  stopped?: boolean;
  /**
   * Background translation: transient state while live English deltas are
   * suppressed. "working" = the (hidden) English answer is being produced,
   * "translating" = final pass to the user's language. Cleared when the
   * translated `text` arrives or the run settles. Drives a shimmer in the bubble.
   */
  status?: "working" | "translating";
  /**
   * Assistant turns only: set when background translation degraded after
   * retries — the answer is shown UNtranslated (English) and this holds the
   * reason. Drives a collapsed, muted notice under the bubble. Not an `error`:
   * the run itself succeeded.
   */
  translationError?: string;
  /**
   * Assistant turns only: token usage spent on THIS query/execution, summed
   * across every `usage` event the run emitted (agent + any sub-agents +
   * background translation). `estimated` is true when at least one component
   * was a character-count estimate (codex/gemini CLI) rather than a real count.
   * Shown in the bubble footer; persisted on the message so it survives reload.
   */
  tokens?: { input: number; output: number; total: number; estimated?: boolean };
  /**
   * Synthetic turn produced by context compaction: a summary that REPLACED the
   * older turns it folded. Rendered as a "📋 N mensajes resumidos" divider with
   * the summary text, not a normal user/assistant bubble.
   */
  compacted?: boolean;
  /** Compaction divider: how many original messages were folded into it. */
  summarizedCount?: number;
  /**
   * User turns only: system-generated turn (e.g. the team leader wake-up
   * nudge), not typed by the user. Rendered as a muted system chip instead of
   * a normal user bubble.
   */
  auto?: boolean;
}

export interface LiveChat {
  provider: string;
  conversationId: string | null;
  turns: ChatTurn[];
  streaming: boolean;
  /**
   * True when a background run finished but the user hasn't looked at the
   * result yet. Set on stream completion, cleared by `markReviewed` (e.g. when
   * the conversation is opened). Powers the Dashboard's "sin revisar" inbox.
   */
  unreviewed?: boolean;
  abort?: AbortController;
  /** Highest SSE `seq` applied locally — used to resume without replaying. */
  lastSeq?: number;
  /** CLI mode routes streamed text into the tool's mini-terminal; remembered
   *  so a resume after a disconnect re-applies events the same way. */
  isCli?: boolean;
  /**
   * Team delegation board (LEADER chats only): tasks this conversation's agent
   * assigned to its subordinates, keyed by taskId. CHAT-level (not per-turn):
   * cards survive turns and re-renders. Updated live from `team_task_update`
   * events and rehydrated from `teamApi.listTasks` when the chat is (re)opened
   * — the sidecar board is the source of truth after the run buffer GCs.
   */
  teamTasks?: Record<string, TeamTaskView>;
}

export type Listener = () => void;

/**
 * A follow-up message the user sent while a run was still streaming in the same
 * chat. Instead of dropping it (old behaviour) or aborting the live run, we
 * queue it here and dispatch it automatically when the current run settles.
 * `buildMessages` is captured from the caller so the outgoing context is
 * rebuilt from the UP-TO-DATE turns at dispatch time (i.e. including the answer
 * that just finished), not from a stale snapshot taken when it was queued.
 */
export interface QueuedSend {
  provider: string;
  isCli: boolean;
  conversationId: string | null;
  projectId?: string | null;
  agentId?: string | null;
  userText: string;
  attachments?: ChatAttachment[];
  /** Per-turn model override (in-chat selector); absent → provider default. */
  model?: string;
  effort?: "low" | "medium" | "high" | "xhigh";
  /** Keep the structured plan decision if a prior run is still settling. */
  planDecision?: "approve";
  buildMessages: (priorTurns: ChatTurn[], overrideText?: string) => AgentMessage[];
  onClear?: (key: string) => void;
  onSettled?: (key: string) => void;
}

/**
 * Buffered "añadiduras" for a chat: extra messages the user sent (default Enter /
 * send button) while a run was in flight. They were already merged into the
 * active user bubble for display; this holds what must still reach the model.
 * For providers WITHOUT live steering they drain as a single continuation turn
 * when the current run settles (texts joined). Providers WITH live steering
 * inject each immediately and never buffer here.
 */
export interface PendingAddenda {
  texts: string[];
  attachments: ChatAttachment[];
  provider: string;
  isCli: boolean;
  conversationId: string | null;
  projectId?: string | null;
  agentId?: string | null;
  model?: string;
  effort?: "low" | "medium" | "high" | "xhigh";
  buildMessages: (priorTurns: ChatTurn[], overrideText?: string) => AgentMessage[];
  onClear?: (key: string) => void;
  onSettled?: (key: string) => void;
}
