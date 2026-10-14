import { afterPrimaryReady } from "@/lib/startup-state";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { chatEngine } from "../chat-engine";
import { connectAssistantWs, getAssistantWsStatus, ASSISTANT_TEAM_TASK_EVENT, ASSISTANT_WS_STATUS_EVENT } from "@/lib/assistant-ws";
import { resumeBackgroundRuns } from "../assistant-api";
import { chats, listeners, emit, backgroundWorkerRunning } from "./state";
import { lastTurnInterrupted } from "./stream-apply";
import { resetResumeAttempts } from "./send";

// ── Live WS broadcast handler (assistant-ws.ts → `lxp:assistant:team-task-update`) ─
//
// The backend now publishes `team_task_update` on a per-session WebSocket
// (`/api/assistant/ws`) so the subagent's "En curso" chip flips off the moment
// the leader finalises the task — even with the drawer closed, the tab hidden
// or the leader chat no longer held in memory. We listen on `window` (the WS
// singleton dispatches CustomEvents, not direct callbacks) so any module can
// subscribe without coupling.
//
// Updates mutate BOTH sources the `isWorkerTaskRunning` read consults:
//  - `runningWorkerIdSet` (in-memory leader boards): updated when the LEADER
//    chat is held locally — adds or removes `workerConversationId` per the
//    task's new status, plus persists the task view under `teamTasks` so the
//    right-rail TeamTaskBoard repaints too.
//  - `backgroundWorkerRunning` (global mirror): updated even when NO local
//    chat holds the leader — without this the chip would still wait for the
//    next 10s poll to clear. The mirror survives reloads, so flipping it here
//    is enough.
//
// If we have neither (leader not held AND no entry on the active-tasks feed
// mirror yet), we optimistically refresh the active-tasks feed; the next emit
// propagates the state to subscribers. Emits are coalesced per call so a burst
// of WS frames still results in exactly one re-render.
function handleWsTeamTaskUpdate(task: { id: string; status?: string; workerConversationId?: string | null; [k: string]: unknown }): void {
  const status = String(task.status ?? "");
  const workerId = typeof task.workerConversationId === "string" && task.workerConversationId
    ? task.workerConversationId
    : null;
  const isTerminal = status === "done" || status === "failed" || status === "cancelled" || status === "canceled";
  const isRunning = status === "running" || status === "pending";

  // Find every leader chat whose board knows this task — multiple leaders can
  // theoretically hold the same task id if a user opens two panes, so we walk
  // the whole map rather than guessing by leader conversationId.
  let touchedLeader = false;
  if (task.id) {
    for (const [key, chat] of chats) {
      if (!chat.teamTasks) continue;
      const prev = chat.teamTasks[task.id];
      if (!prev) continue;
      touchedLeader = true;
      // The WS payload types `status` as `string` (defensive against future
      // backend additions) and `workerConversationId` as `string | null`,
      // while the existing board entry narrows both. Falling back to the
      // previous status keeps the existing union contract while letting the
      // new status override when the string IS a known TeamTaskStatus. The
      // cast at the end normalises the merged shape to `TeamTaskView` since
      // the WS payload mirrors the board schema semantically.
      const mergedStatus = status || prev.status;
      const merged = {
        ...prev,
        ...task,
        status: mergedStatus as typeof prev.status,
      } as typeof prev;
      chats.set(key, {
        ...chat,
        teamTasks: { ...chat.teamTasks, [task.id]: merged },
      });
    }
  }

  // Global mirror: add/remove the workerConversationId regardless of whether a
  // local leader board knew the task. This is the source that survives reloads
  // AND keeps the chat-list chip correct when the leader board is not in memory.
  if (workerId && isRunning) {
    backgroundWorkerRunning.add(workerId);
  } else if (workerId && isTerminal) {
    backgroundWorkerRunning.delete(workerId);
  }

  // If we couldn't attach this to any in-memory leader board AND the task
  // isn't tracked on the mirror yet, kick a single background refresh so the
  // next tick fills the gap. Cheap, idempotent, and bounded (single fire per
  // WS frame — the guard prevents a feedback loop if the backend keeps
  // sending the same event).
  if (!touchedLeader && !workerId) {
    void chatEngine.refreshBackgroundRuns();
  }

  if (touchedLeader || workerId) emit();
}

// Boot the WS singleton the first time the engine module loads in this tab.
// Lives at module top level (not inside `subscribe`) so the connection is
// established regardless of drawer state — the whole point is to keep chip
// state fresh when nobody has the assistant drawer open. Safe on the server
// (connectAssistantWs no-ops when `window` is undefined).
if (typeof window !== "undefined") {
  connectAssistantWs();
  window.addEventListener(ASSISTANT_TEAM_TASK_EVENT, (e) => {
    const detail = (e as CustomEvent<{ task: { id: string; status?: string; workerConversationId?: string | null } }>).detail;
    if (detail?.task) handleWsTeamTaskUpdate(detail.task);
  });
}

// ── Background-run polling ──────────────────────────────────────────────────

/** Light poll cadence for the backend active-runs feed while the drawer is
 *  open. Frequent enough that a finished/started background run repaints
 *  promptly. Each refresh reads both active runs and active team tasks. */
const BACKGROUND_POLL_MS = 5_000;
/** The WS pushes team tasks only. Ordinary runs and approval states still
 *  need reconciliation while visible, even with a healthy connection. */
const BACKGROUND_POLL_IDLE_MS = 5_000;
/** When the WS is down (disconnected / reconnecting) the safety net must be
 *  tighter so the subagent chip still flips within a few seconds of the leader
 *  finalising. */
const BACKGROUND_POLL_DEGRADED_MS = 5_000;
let backgroundPollTimer: ReturnType<typeof setInterval> | null = null;
let backgroundPollDelay = BACKGROUND_POLL_MS;

/** Kick server-side restart recovery once, then refresh the active-runs feed so
 *  any reconstructed run repaints. Cheap & idempotent on the backend. */
let recoveryTask: Promise<void> | null = null;
function kickRecovery(): Promise<void> {
  if (recoveryTask) return recoveryTask;
  const task = (async () => {
    // Recovery is requested only when restoring a conversation, not on module import.
    if ([...chats.values()].some(chat => !!chat.conversationId)) {
      try { await resumeBackgroundRuns(); } catch { /* best-effort */ }
    }
    await chatEngine.refreshBackgroundRuns();
  })().catch(() => { /* retry on the next visible safety poll */ }).finally(() => {
    if (recoveryTask === task) recoveryTask = null;
  });
  recoveryTask = task;
  return task;
}

/** Current desired poll cadence, derived from WS health + tab visibility. The
 *  visibility change + WS status events call this and reschedule the timer. */
function pickPollDelay(): number {
  if (typeof document !== "undefined" && document.visibilityState !== "visible") {
    // Background tab: nothing to repaint. The safety poll stays parked.
    return Number.MAX_SAFE_INTEGER;
  }
  const wsStatus = wsHealth();
  if (wsStatus === "open") return BACKGROUND_POLL_IDLE_MS;
  if (wsStatus === "stopped" || wsStatus === "closed") return BACKGROUND_POLL_MS;
  return BACKGROUND_POLL_DEGRADED_MS;
}

/** Reads the WS singleton's current health. The WS module is statically imported
 *  above, so this is a plain function call — no require/cycle concerns. */
function wsHealth(): ReturnType<typeof getAssistantWsStatus> {
  return getAssistantWsStatus();
}

function rescheduleBackgroundPoll(): void {
  if (!backgroundPollTimer) return;
  const next = pickPollDelay();
  if (next === backgroundPollDelay) return; // no change → leave the timer alone
  backgroundPollDelay = next;
  clearInterval(backgroundPollTimer);
  if (next === Number.MAX_SAFE_INTEGER) {
    backgroundPollTimer = null;
    return;
  }
  backgroundPollTimer = setInterval(() => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    void chatEngine.refreshBackgroundRuns();
  }, next);
  backgroundPollTimer.unref?.();
}

let cancelStartup: (() => void) | null = null;
export function startBackgroundPoll(): void {
  if (cancelStartup || backgroundPollTimer) return;
  cancelStartup = afterPrimaryReady(() => { cancelStartup = null; beginBackgroundPoll(); }, 1000);
}
function beginBackgroundPoll(): void {
  if (backgroundPollTimer) return;
  backgroundPollDelay = pickPollDelay();
  if (backgroundPollDelay === Number.MAX_SAFE_INTEGER) {
    // Background tab: do nothing until visibility returns. The visibility
    // listener below will (re)start the poll on focus.
    return;
  }
  // On drawer open: recover any background runs that survived a panel restart,
  // then refresh so re-entry repaints without waiting a full interval.
  void kickRecovery();
  backgroundPollTimer = setInterval(() => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    void chatEngine.refreshBackgroundRuns();
  }, backgroundPollDelay);
  backgroundPollTimer.unref?.();
}

export function stopBackgroundPoll(): void {
  cancelStartup?.(); cancelStartup = null;
  if (backgroundPollTimer) {
    clearInterval(backgroundPollTimer);
    backgroundPollTimer = null;
  }
  backgroundPollDelay = BACKGROUND_POLL_MS;
}

// Adaptive cadence: WS status flips (open / reconnecting / closed) should
// retune the safety poll. The listener is registered exactly once — multiple
// mounts of the assistant drawer would otherwise stack listeners.
if (typeof window !== "undefined") {
  window.addEventListener(ASSISTANT_WS_STATUS_EVENT, () => {
    if (backgroundPollTimer) rescheduleBackgroundPoll();
  });
}

// When the page returns to the foreground (e.g. the user comes back to the
// mobile app), resume every chat whose stream was interrupted while away AND
// re-sync the background-run feed so the Dashboard/chat list repaint the state
// of runs that kept going (or finished) while the WebView was frozen.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") {
      // Tab hidden → suspend the safety poll (it would just noop anyway).
      if (backgroundPollTimer) {
        clearInterval(backgroundPollTimer);
        backgroundPollTimer = null;
      }
      return;
    }
    // Returning to the foreground (mobile app-switch, or after a backend deploy)
    // → recover any background runs that survived a restart, then repaint.
    if (listeners.size > 0) {
      // Starting already performs recovery. Do not issue a second POST/GET pair
      // on the same visibility event; wait for the primary UI before refreshing.
      if (!backgroundPollTimer) startBackgroundPoll();
      else void kickRecovery();
    }
    for (const [key, chat] of chats) {
      if (!chat.streaming && chat.conversationId && lastTurnInterrupted(key)) {
        resetResumeAttempts(key); // fresh foreground → give it the full budget again
        void chatEngine.resume(key);
      }
    }
  });
}
