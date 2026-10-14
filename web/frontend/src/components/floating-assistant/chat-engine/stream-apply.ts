// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { AgentEvent } from "../assistant-api";
import { assistantConversationsApi } from "../assistant-api";
import type { ChatTurn, LiveChat } from "./types";
import { chats, emit, isActivelyViewing, syncReviewedIfViewing, backgroundActive, backgroundPending } from "./state";
import { applyCliDelta, settleLanes, freshMainLane, deriveCliSummary, stripLaneTokens } from "./cli-lanes";
import { markAssistantTeamTaskSeen } from "@/lib/assistant-ws";
import { historyTurn } from "./history";

// ── Event application + recovery helpers ────────────────────────────────────

/** Apply one agent event to the live assistant turn of `key`. */
export function applyEvent(
  key: string,
  ev: AgentEvent,
  ctx: { isCli: boolean; startedAt: number; seq?: number },
): void {
  const { isCli, startedAt, seq } = ctx;
  const chat = chats.get(key);
  if (!chat) return;
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
      if (isCli && cliIdx >= 0) {
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
        out[i] = {
          ...t,
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
        // CLI: the provider sends the clean final answer here → bubble text
        // (the terminal keeps the raw live activity). Ignore `[…]` placeholders.
        text: isCliAnswer && ev.output && !ev.output.startsWith("[") ? ev.output : t.text,
        tools: t.tools.map((tr) =>
          tr.id === ev.id
            ? settleLanes({ ...tr, result: { success: ev.success, output: ev.output } }, ev.success ? "done" : "failed")
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
      // CLI mode: derive the bubble's clean final text from the terminal
      // output (drop the synthetic `$ …` header line, strip ANSI).
      // Settle every lane (running → done) so no sub-agent tab keeps spinning.
      const settledTools = isCli
        ? t.tools.map((tr, idx) => (idx === cliIdx ? settleLanes(tr, "done") : tr))
        : t.tools;
      if (isCli && cliIdx >= 0 && !t.text) {
        const term = settledTools[cliIdx]?.terminal ?? "";
        // Same rule as reload (`historyTurn`): the bubble gets the LAST narrative
        // block only — never the whole cleaned terminal (a run that died mid-tool
        // would otherwise dump the raw console as the "answer").
        const clean = deriveCliSummary(undefined, term);
        out[i] = { ...t, tools: settledTools, text: clean, pending: false, interrupted: false, status: undefined, ...timing };
      } else {
        out[i] = { ...t, tools: settledTools, pending: false, interrupted: false, status: undefined, ...timing };
      }
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
  updateLastAssistantTurn(key, (t) => ({ ...t, pending: false, stopped: true, permission: undefined }));
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
export async function reloadHistory(key: string, conversationId: string): Promise<void> {
  try {
    const { items } = await assistantConversationsApi.messages(conversationId, 30, 0);
    const chat = chats.get(key);
    const provider = chat?.provider ?? "claude";
    chats.set(key, {
      provider,
      conversationId,
      // `map(historyTurn)` NO: `Array.map` invoca `fn(valor, índice, array)`, así
      // que el segundo parámetro de `historyTurn` (`fallbackProvider`) recibía el
      // ÍNDICE. Los mensajes del historial sin `provider` propio acababan con
      // `provider: 1`, `provider: 2`… un número en vez de un proveedor.
      turns: items.map((m) => historyTurn(m, provider)),
      streaming: false,
      // A background run that finished off-screen is "sin revisar"; but if the
      // user is currently on this chat, don't flag it — they're seeing it.
      unreviewed: !isActivelyViewing(key),
      isCli: chat?.isCli,
    });
    // Viewing it as it reloaded? Clear the backend's stale unreviewed flag too.
    syncReviewedIfViewing(key, conversationId);
    emit();
  } catch {
    /* keep the interrupted turn so the user can retry manually */
  }
}
