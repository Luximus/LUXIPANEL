// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { AgentEvent } from "../assistant-api";
import { assistantConversationsApi } from "../assistant-api";
import type { ChatTurn, LiveChat } from "./types";
import { chats, emit, isActivelyViewing, syncReviewedIfViewing, backgroundActive, backgroundPending } from "./state";
import { applyCliDelta, settleLanes, freshMainLane, stripLaneTokens } from "./cli-lanes";
import { markAssistantTeamTaskSeen } from "@/lib/assistant-ws";
import { historyTurns } from "./history";
import { findSavedRequestIndex, hasSavedRequestOutcome } from "./history-identity";
import { appendApiActivity } from "./api-activity";
import { resolveTargetScope } from "@/lib/api-client";

// ── Event application + recovery helpers ────────────────────────────────────

/** Apply one agent event to the live assistant turn of `key`. */
export function applyEvent(
  key: string,
  ev: AgentEvent,
  ctx: { isCli: boolean; startedAt: number; seq?: number; replay?: boolean },
): void {
  const { isCli, startedAt, seq } = ctx;
  const chat = chats.get(key);
  if (!chat) return;
  // Recovery is transport metadata, including id:-1. Handle it before sequence
  // dedup, terminal handling, background cleanup, or any turn mutation.
  if (ev.type === "error" && ev.code === "AGENT_STREAM_RECONCILE_REQUIRED") {
    if (ev.recovery) chats.set(key, { ...chat, reconcileRun: {
      runId: ev.recovery.runId, done: ev.recovery.done,
    } });
    markInterrupted(key, startedAt);
    return;
  }
  if (ev.type === "stream_state") {
    if (chat.runId !== ev.runId && (chat.runId || ctx.replay)) {
      chats.set(key, { ...chat, reconcileRun: { runId: ev.runId, done: ev.done } });
      markInterrupted(key, startedAt);
    } else if (!chat.runId) {
      // Only the original POST can bind a new buffer without a REST read.
      chats.set(key, { ...chat, runId: ev.runId, lastSeq: -1 });
    }
    return;
  }
  if (chat.reconcileRun) return;
  // A terminal from a foreign buffer must not close or clear this chat.
  if (ev.runId && ev.runId !== chat.runId) return;
  if (seq !== undefined && seq >= 0 && chat.lastSeq !== undefined && seq <= chat.lastSeq) return;
  // A local terminal event is newer than the last background poll.
  if (ev.type === "done" || ev.type === "error") {
    backgroundActive.delete(chat.conversationId ?? key);
    backgroundPending.delete(chat.conversationId ?? key);
  }
  if (ev.type === "permission_resolved") backgroundPending.delete(chat.conversationId ?? key);
  // Chat-level events first — they don't need (or touch) the last turn.
  if (ev.type === "team_task_update") {
    chats.set(key, {
      ...chat,
      teamTasks: { ...(chat.teamTasks ?? {}), [ev.task.id]: ev.task },
      ...(seq !== undefined && seq >= 0 ? { lastSeq: seq } : {}),
    });
    // Mark this (taskId, status) as already applied via the SSE stream so the
    // backend's parallel WS broadcast (see assistant-ws.ts) dedups the second
    // delivery instead of re-mutating the worker set twice. Idempotent and
    // cheap (Set insert).
    markAssistantTeamTaskSeen(ev.task.id, String(ev.task.status));
    emit();
    return;
  }
  const out = [...chat.turns];
  const i = out.length - 1;
  const t = out[i];
  if (!t || t.role !== "assistant") return;
  const raw = t.raw ?? "";
  // In CLI mode the live output is the CLI's terminal: index of the last
  // `.cli` tool we should funnel text into.
  const cliIdx = isCli ? t.tools.map((tr) => tr.name.endsWith(".cli")).lastIndexOf(true) : -1;
  switch (ev.type) {
    case "status":
      // Background-translation transient state — show a shimmer, no text yet.
      out[i] = { ...t, status: ev.state };
      break;
    case "translation_error":
      // Translation degraded after retries — the answer is shown untranslated.
      // Record the reason; the bubble renders a collapsed notice. Clears the
      // transient "translating" shimmer.
      out[i] = { ...t, translationError: ev.message, status: undefined, raw: `${raw}\n[translation_error] ${ev.message}\n` };
      break;
    case "text":
      if (!isCli && ev.phase === "commentary") {
        out[i] = { ...t, apiActivity: appendApiActivity(t.apiActivity, { type: "text", phase: "commentary", delta: ev.delta }), raw: raw + ev.delta };
      } else if (ev.phase === "final_answer") {
        // The server explicitly separated the final answer (also after translation).
        // Discard only the known legacy prefix; never infer a boundary from prose.
        out[i] = { ...t, text: t.text.slice(t.apiTextOffset ?? 0) + ev.delta,
          apiTextOffset: undefined, status: undefined, raw: raw + ev.delta };
      } else if (isCli && cliIdx >= 0) {
        // Demux the delta into per-agent lanes (orchestrator + sub-agents) and
        // funnel each lane's raw ANSI into its own terminal buffer; the bubble
        // text stays empty until the run finishes. The raw transcript keeps the
        // text minus the lane control tokens.
        const tools = t.tools.map((tr, idx) =>
          idx === cliIdx ? applyCliDelta(tr, ev.delta) : tr,
        );
        out[i] = { ...t, tools, raw: raw + stripLaneTokens(ev.delta) };
      } else {
        // A `text` event (incl. the final translated block) clears any status.
        out[i] = { ...t, text: t.text + ev.delta, status: undefined, raw: raw + ev.delta };
      }
      break;
    case "tool_use":
      // Idempotent by id: a tool_use can be re-delivered when an SSE buffer is
      // replayed (resume / adopt / a POST that joined a live run). Appending
      // blindly would add a SECOND `.cli` ToolTrace to the turn → a duplicate,
      // never-fed terminal that spins forever ("solo se ejecuta el último").
      if (t.tools.some((tr) => tr.id === ev.id)) {
        out[i] = { ...t, raw: `${raw}\n[→ tool] ${ev.name} ${JSON.stringify(ev.input)} (replay, ignorado)\n` };
      } else {
        let apiActivity = t.apiActivity;
        if (!isCli && !ev.name.endsWith(".cli")) {
          const legacyProgress = t.text.slice(t.apiTextOffset ?? 0);
          if (legacyProgress) apiActivity = appendApiActivity(apiActivity, { type: "text", phase: "commentary", delta: legacyProgress });
          apiActivity = appendApiActivity(apiActivity, ev);
        }
        out[i] = {
          ...t,
          ...(apiActivity ? { apiActivity } : {}),
          // A new API call proves the preceding text belongs to the process.
          // Replays must not move this boundary into an already received answer.
          ...(!isCli && !ev.name.endsWith(".cli") ? { apiTextOffset: t.text.length } : {}),
          tools: [...t.tools, { id: ev.id, name: ev.name, input: ev.input, ...(ev.name.endsWith(".cli") ? { terminal: "", lanes: { main: freshMainLane() }, laneOrder: ["main"], activeLane: "main" } : {}) }],
          raw: `${raw}\n[→ tool] ${ev.name} ${JSON.stringify(ev.input)}\n`,
        };
      }
      break;
    case "tool_result": {
      // The protected module and browser channels inject their own tool results
      // into a CLI run. Only the result for the active `.cli` tool is the final
      // answer; other outputs belong in their tool disclosures.
      const isCliAnswer = isCli && cliIdx >= 0 && t.tools[cliIdx]?.id === ev.id;
      out[i] = {
        ...t,
        ...(!isCli ? { apiActivity: appendApiActivity(t.apiActivity, ev) } : {}),
        // CLI: the provider sends the clean final answer here → bubble text
        // (the terminal keeps the raw live activity). Ignore `[…]` placeholders.
        text: isCliAnswer && ev.success && ev.output && !ev.output.startsWith("[") ? ev.output : t.text,
        tools: t.tools.map((tr) =>
          tr.id === ev.id
            ? (ev.success ? { ...tr, result: { success: true, output: ev.output } } : settleLanes({ ...tr, result: { success: false, output: ev.output } }, "failed"))
            : tr,
        ),
        raw: `${raw}[← ${ev.success ? "ok" : "err"}] ${ev.output}\n`,
      };
      break;
    }
    case "ask":
      out[i] = {
        ...t,
        ask: ev.questions,
        ...(ev.kind ? { askKind: ev.kind } : {}),
        raw: `${raw}\n[ask] ${ev.questions.length} pregunta(s)\n`,
      };
      break;
    case "permission_request":
      out[i] = {
        ...t,
        permission: { id: ev.id, tool: ev.tool, title: ev.title, ...(ev.detail ? { detail: ev.detail } : {}) },
        raw: `${raw}\n[permiso solicitado] ${ev.tool}: ${ev.title}\n`,
      };
      break;
    case "permission_resolved":
      // Clear the prompt if it matches the one we're showing (idempotent across
      // replay / a second tab / the user's own optimistic clear).
      out[i] = {
        ...t,
        permission: t.permission?.id === ev.id ? undefined : t.permission,
        raw: `${raw}\n[permiso ${ev.decision === "allow" ? "concedido" : "denegado"}]\n`,
      };
      break;
    case "usage": {
      // Accumulate across every usage event of the turn (sub-agents + translation)
      // so the footer shows the TOTAL tokens spent on this query/execution.
      const prev = t.tokens ?? { input: 0, output: 0, total: 0 };
      const input = prev.input + ev.inputTokens;
      const output = prev.output + ev.outputTokens;
      out[i] = {
        ...t,
        tokens: { input, output, total: input + output, estimated: prev.estimated || ev.estimated },
        raw: `${raw}\n[usage] ${ev.model} · in ${ev.inputTokens} / out ${ev.outputTokens}${ev.estimated ? " (est)" : ""}\n`,
      };
      break;
    }
    case "error":
      out[i] = {
        ...t,
        error: ev.message,
        status: undefined,
        completionPending: false,
        permission: undefined,
        interrupted: false,
        pending: false,
        createdAt: Date.now(),
        durationMs: Date.now() - startedAt,
        raw: `${raw}\n[error] ${ev.message}\n`,
      };
      break;
    case "done": {
      const finishedAt = Date.now();
      const timing = { createdAt: finishedAt, durationMs: finishedAt - startedAt, permission: undefined };
      // A terminal frame closes only this stream. Pending background work is
      // an outcome, not local streaming and never a successful final answer.
      let apiActivity = t.apiActivity;
      if (ev.pending && !isCli) {
        const provisional = t.text.slice(t.apiTextOffset ?? 0);
        if (provisional) apiActivity = appendApiActivity(apiActivity, { type: "text", phase: "commentary", delta: provisional });
      }
      const confirmedCli = isCli && !ev.pending && !t.error && !!t.text.trim() && t.tools[cliIdx]?.result?.success;
      out[i] = { ...t,
        ...(confirmedCli ? { tools: t.tools.map((tool, index) => index === cliIdx ? settleLanes(tool, "done") : tool) } : {}),
        ...(apiActivity ? { apiActivity } : {}),
        ...(ev.pending ? { text: "", apiTextOffset: undefined } : {}),
        completionPending: ev.pending === true && !t.error,
        pending: false, interrupted: false, status: undefined, ...timing,
      };
      // Do not derive a final answer or complete CLI lanes from terminal prose.
      // Their tool_result is the confirmation; absent results remain unconfirmed.
      // A turn finished → its usage record is now persisted. Nudge the CLI usage
      // bars (and any other usage listeners) to refetch.
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("lxp:assistant:usage-updated"));
      }
      break;
    }
  }
  chats.set(key, { ...chat, turns: out, ...(seq !== undefined && seq >= 0 ? { lastSeq: seq } : {}) });
  emit();
}

/** Did this throw come from an intentional `abort()` (user pressed stop)? */
function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

/** A transport drop (lost socket / frozen WebView), not a real agent error. */
function isTransportError(err: unknown): boolean {
  if (!(err instanceof Error)) return true; // unknown throw → treat as transport
  const m = `${err.name} ${err.message}`.toLowerCase();
  return (
    err.name === "TypeError" ||
    m.includes("network") ||
    m.includes("failed to fetch") ||
    m.includes("load failed") ||
    m.includes("connection")
  );
}

/** Route a stream throw to the right terminal state on the live turn. */
export function handleStreamThrow(key: string, err: unknown, startedAt: number, isCli: boolean): void {
  // A connection closing after done/error cannot revoke the confirmed outcome.
  if (lastAssistantTurn(key)?.pending === false) return;
  if (isAbortError(err)) {
    finalizeTurn(key); // user stop → just settle, no error banner
  } else if (isTransportError(err)) {
    markInterrupted(key, startedAt);
  } else {
    applyEvent(key, { type: "error", message: (err as Error).message ?? "Stream error" }, { isCli, startedAt });
  }
}

/** The last turn of `key`, but only when it's an assistant turn (else null). */
function lastAssistantTurn(key: string): ChatTurn | null {
  const turns = chats.get(key)?.turns ?? [];
  const last = turns[turns.length - 1];
  return last && last.role === "assistant" ? last : null;
}

/** Replace the last turn of `key` (if it's an assistant turn) via `fn`, then
 *  persist + emit. No-op when there's no chat or the last turn isn't assistant. */
function updateLastAssistantTurn(key: string, fn: (t: ChatTurn) => ChatTurn): void {
  const chat = chats.get(key);
  if (!chat) return;
  const out = [...chat.turns];
  const i = out.length - 1;
  const t = out[i];
  if (!t || t.role !== "assistant") return;
  out[i] = fn(t);
  chats.set(key, { ...chat, turns: out });
  emit();
}

/** Settle the live assistant turn without an error (user stop). Mark it
 *  `stopped` so the bubble shows "proceso parado" and collapses the terminal. */
export function finalizeTurn(key: string): void {
  updateLastAssistantTurn(key, (t) => ({ ...t, pending: false, completionPending: false, status: undefined, stopped: true, permission: undefined }));
}

/** True when the last turn of `key` was stopped on purpose by the user. */
export function lastTurnStopped(key: string): boolean {
  return Boolean(lastAssistantTurn(key)?.stopped);
}

/** Mark the live assistant turn as recoverably interrupted (transport drop). */
function markInterrupted(key: string, startedAt: number): void {
  updateLastAssistantTurn(key, (t) => ({
    ...t,
    pending: false,
    interrupted: true,
    durationMs: Date.now() - startedAt,
  }));
}

/** EOF is only a transport boundary; a terminal event or saved answer must settle the turn. */
export function settleStreamEnd(key: string, startedAt: number): void {
  if (lastAssistantTurn(key)?.pending) markInterrupted(key, startedAt);
}

/** True when the last turn of `key` is an interrupted (resumable) assistant turn. */
export function lastTurnInterrupted(key: string): boolean {
  return Boolean(lastAssistantTurn(key)?.interrupted);
}

/** Return a copy of the chat with the last turn's `interrupted` flag cleared. */
export function clearInterruptedFlag(chat: LiveChat): LiveChat {
  const out = [...chat.turns];
  const i = out.length - 1;
  const t = out[i];
  if (t && t.role === "assistant" && t.interrupted) {
    out[i] = { ...t, interrupted: false, pending: true };
  }
  return { ...chat, turns: out };
}

/** Reload a conversation's persisted messages and reseed the chat turns. */
export async function reloadHistory(key: string, conversationId: string): Promise<boolean> {
  const scope = resolveTargetScope();
  const initial = chats.get(key);
  if (!initial || initial.conversationId !== conversationId) return false;
  try {
    const { items } = await assistantConversationsApi.messages(conversationId, Math.max(30, initial.turns.length + 10), 0);
    const chat = chats.get(key);
    if (resolveTargetScope() !== scope || !chat || chat.conversationId !== conversationId) return false;
    if (chat.streaming !== initial.streaming || chat.abort !== initial.abort || chat.turns !== initial.turns) return false;
    const provider = chat.provider;
    const turns = historyTurns(items, provider);
    const last = initial.turns.at(-1);
    if (last?.role === "assistant" && (last.pending || last.interrupted || last.completionPending)) {
      // Neither 204 nor matching prompt text proves this request was admitted.
      // Keep its trace and follow-ups blocked until its saved position is known.
      if (!hasSavedRequestOutcome(initial.turns, turns)) return false;
    }
    chats.set(key, {
      ...chat,
      provider,
      conversationId,
      turns,
      streaming: false,
      // A background run that finished off-screen is "sin revisar"; but if the
      // user is currently on this chat, don't flag it — they're seeing it.
      unreviewed: !isActivelyViewing(key),
      isCli: chat?.isCli,
    });
    // Viewing it as it reloaded? Clear the backend's stale unreviewed flag too.
    syncReviewedIfViewing(key, conversationId);
    emit();
    return true;
  } catch {
    return false; // Keep the local trace; the resume owner remains recoverable.
  }
}

/**
 * Reconcile an explicitly selected buffer using the unique saved request
 * position. Retain the previous outcome and files before replaying a successor.
 * No POST, continuation drain, or inference of success from done/204/EOF.
 */
export async function reconcileRunHistory(
  key: string, conversationId: string, run: { runId: string; done: boolean },
): Promise<"replay" | "saved" | false> {
  const initial = chats.get(key), scope = resolveTargetScope();
  if (!initial || initial.conversationId !== conversationId) return false;
  try {
    const { items } = await assistantConversationsApi.messages(conversationId, Math.max(30, initial.turns.length + 10), 0);
    const chat = chats.get(key);
    if (scope !== resolveTargetScope() || !chat || chat.conversationId !== conversationId
      || chat.abort !== initial.abort || chat.streaming !== initial.streaming || chat.turns !== initial.turns) return false;
    const turns = historyTurns(items, chat.provider);
    const requestIndex = findSavedRequestIndex(initial.turns, turns);
    if (requestIndex === null) return false;
    const outcomeIndex = requestIndex + 1;
    const outcome = turns[outcomeIndex];
    const changedRun = !!initial.runId && initial.runId !== run.runId;
    // A successor requires A's own persisted outcome; a later user's answer is
    // never evidence for A. A recreated buffer without that evidence stays local.
    if (changedRun && (outcome?.role !== "assistant" || turns.length <= outcomeIndex + 1)) return false;
    if (outcome && outcome.role !== "assistant") return false;
    const tail = turns.at(-1);
    if (!tail || (tail.role === "assistant" && turns.at(-2)?.role !== "user")) return false;
    // A stream still bound to A cannot be replayed into a later user B.
    if (tail.role === "user" && requestIndex < turns.length - 1 && initial.runId === run.runId) return false;
    const localRequest = initial.turns.at(-2)!;
    if (localRequest.addenda) turns[requestIndex] = { ...turns[requestIndex]!, addenda: localRequest.addenda };
    const localOutcome = initial.turns.at(-1);
    if (outcome && localOutcome?.role === "assistant") {
      // Persisted content/outcome is authoritative; retain known tool evidence
      // absent from REST so file disclosures survive partial history payloads.
      turns[outcomeIndex] = { ...outcome,
        // A saved CLI transcript supplies the single complete console; keeping
        // its old live tool would hide that transcript behind a partial console.
        tools: outcome.cliHistoryLog ? outcome.tools : [
          ...outcome.tools.map(saved => ({ ...saved,
            result: saved.result ?? localOutcome.tools.find(tool => tool.id === saved.id)?.result })),
          ...localOutcome.tools.filter(tool => !outcome.tools.some(saved => saved.id === tool.id)),
        ],
        apiActivity: outcome.apiActivity ?? localOutcome.apiActivity,
      };
    }
    if (tail.role === "user") turns.push({ role: "assistant", provider: chat.provider, text: "", tools: [], pending: true });
    chats.set(key, { ...chat, turns, runId: run.runId, lastSeq: -1, reconcileRun: undefined,
      unreviewed: !isActivelyViewing(key) });
    if (tail.role === "assistant" && run.done) {
      // Only the correlated persisted outcome plus a terminated selected buffer
      // can clear its stale active/permission mirrors.
      backgroundActive.delete(conversationId);
      backgroundPending.delete(conversationId);
    }
    emit();
    return tail.role === "user" ? "replay" : "saved";
  } catch {
    return false;
  }
}
