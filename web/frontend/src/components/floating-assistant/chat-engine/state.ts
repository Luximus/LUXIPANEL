// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LiveChat, Listener, QueuedSend, PendingAddenda } from "./types";
import { assistantConversationsApi } from "../assistant-api";

export const chats = new Map<string, LiveChat>();
/** Per-chat buffer of addenda awaiting a continuation drain (fallback path). */
export const pendingAddenda = new Map<string, PendingAddenda>();
/** FIFO queue of follow-up sends per chat key (CLIENT-side, only for brand-new
 *  chats that don't have a conversationId yet — they can't persist server-side). */
export const queues = new Map<string, QueuedSend[]>();
/** Mirror of the SERVER-side follow-up queue per chat key (conversationId
 *  chats). These survive the tab closing and drain in the background; we keep
 *  a local copy only to render the chips and to know when to follow the chain. */
export const serverQueued = new Map<string, { id: string; userText: string }[]>();
/** Keys with an `adopt()` probe in flight. `adopt` awaits the resume request
 *  before it marks the chat `streaming`, so two near-simultaneous opens of the
 *  same conversation could each pass the `streaming` guard and append their own
 *  pending assistant turn → a duplicate bubble. Claimed synchronously here. */
export const adopting = new Set<string>();
/**
 * Conversations the BACKEND reports as still running, keyed by conversationId.
 * After a WebView reload (mobile app-switch killed the renderer) the `chats`
 * map is empty, so the Dashboard + chat list would show no "en curso" state
 * even though the run is alive server-side — the old behaviour only
 * rediscovered it when the user opened that exact chat (`adopt`). This mirror,
 * refreshed by `refreshBackgroundRuns()`, lets both views repaint the live
 * state on re-entry without opening anything. The entry's provider/cli are used
 * to adopt the full live stream when the user does open it.
 */
export const backgroundActive = new Map<string, { provider: string | null; cli: boolean }>();
// Conversation ids of BACKGROUND runs (never streamed locally) that finished
// off-screen and the user hasn't opened since. Drives the Dashboard tab button's
// red dot for runs the `chats` map doesn't hold (e.g. after a WebView reload).
// Cleared when the chat is opened (`markReviewed`) or deleted (`clear`).
export const unreviewedBackground = new Set<string>();
// Conversation ids whose live run is blocked on a permission prompt the user
// hasn't answered (reported by the active-runs feed). Drives the "needs your
// approval" yellow dot in the chat list + Dashboard even for chats not streamed
// locally. Refreshed alongside `backgroundActive` in `refreshBackgroundRuns`.
export const backgroundPending = new Set<string>();
// Worker conversationIds with a still-running (or pending) delegated task on the
// connected server, per the GLOBAL active-tasks feed (`teamApi.listActive`).
// Unlike `runningWorkerIdSet` (derived from the leader boards held in `chats`,
// which is empty right after a reload), this mirror is rebuilt from the backend
// on the same poll as `backgroundActive`, so the chat list can paint the
// "en curso" spinner on a subagent row even when its leader chat was never
// opened this session (survives a page refresh). Refreshed in
// `refreshBackgroundRuns`; a task that finishes drops out of the feed and thus
// clears here on the next poll.
export const backgroundWorkerRunning = new Set<string>();
export const listeners = new Set<Listener>();
export let version = 0;
/**
 * Key of the chat the user is CURRENTLY looking at (the visible pane's open
 * conversation), or null when no chat is on screen. Set by the active ChatPane.
 * When a run settles on this exact chat while it's on screen, the user is
 * already seeing the result, so we must NOT flag it "sin revisar" (the red dot).
 */
let activeViewKey: string | null = null;

/** True when `key` is the chat on screen right now (visible tab + foreground). */
export function isActivelyViewing(key: string): boolean {
  if (activeViewKey !== key) return false;
  return typeof document === "undefined" || document.visibilityState === "visible";
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function emit() {
  version++;
  for (const l of listeners) l();
}

/** True when a chat is currently streaming locally in THIS client. */
export function isLocallyStreaming(key: string): boolean {
  return chats.get(key)?.streaming ?? false;
}

// Derived set of worker conversationIds that have a still-running delegated
// task, rebuilt lazily and memoised by `version` so the chat list can ask
// per-row (`isWorkerTaskRunning`) without re-scanning every leader's board on
// each row. Team tasks live under the LEADER chat keyed by task id, but the
// "en curso" spinner belongs on the SUBAGENT's conversation row, so we index by
// `workerConversationId`. Invalidated on every `emit()` (version bump), which is
// exactly when a `team_task_update`/`refreshTeamTasks` could have changed it.
let runningWorkerIds: Set<string> | null = null;
let runningWorkerIdsVersion = -1;
export function runningWorkerIdSet(): Set<string> {
  if (runningWorkerIds && runningWorkerIdsVersion === version) return runningWorkerIds;
  const set = new Set<string>();
  for (const chat of chats.values()) {
    if (!chat.teamTasks) continue;
    for (const task of Object.values(chat.teamTasks)) {
      // "running" is the same status the board renders as the "En curso" chip
      // (pendingPermission is still a running task waiting on approval).
      if ((task.status === "running" || task.status === "pending") && task.workerConversationId) set.add(task.workerConversationId);
    }
  }
  runningWorkerIds = set;
  runningWorkerIdsVersion = version;
  return set;
}

/** A run settled on the chat the user is watching, so the backend's freshly-set
 *  "sin revisar" flag is stale (it can't know the user is looking). Clear the
 *  persisted flag too, so neither the chat lists nor the Dashboard button show a
 *  red dot for the conversation the user is currently in. */
export function syncReviewedIfViewing(key: string, conversationId: string | null): void {
  if (conversationId && isActivelyViewing(key) && !key.startsWith("new")) {
    unreviewedBackground.delete(conversationId);
    void assistantConversationsApi.markReviewed(conversationId).catch(() => undefined);
  }
}

/** Setter for the active-view marker (owned here; the facade delegates to it). */
export function setActiveViewKey(key: string | null): void {
  activeViewKey = key;
}
/** Clear the active-view marker only if it still points at `key`. */
export function clearActiveViewKey(key: string): void {
  if (activeViewKey === key) activeViewKey = null;
}
