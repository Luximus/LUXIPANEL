// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Per-conversation chat history cache (localStorage).
 *
 * Why this exists: `FloatingAssistantDrawer` is the Astro React island that
 * owns the chat surface. Astro's `transition:persist` does NOT apply to React
 * children, so the island (and the `chatEngine` singleton it instantiates on
 * first mount) is recreated on every SPA navigation — and the in-memory
 * `chats` map inside the engine goes back to empty. Without a persistence
 * layer, the chat appears blank right after a route change until the
 * `/messages` API call resolves.
 *
 * This module persists the LAST N turns of every conversation in
 * localStorage, keyed by the conversation ID (`sessionId` in the
 * `cron/daily_work_plan_luxipanel.md` §2.5 spec). On remount / page reload the
 * pane rehydrates instantly from the cache while the authoritative fetch
 * runs in the background.
 *
 * - Cap: 50 turns per session (the spec's minimum). Older turns are dropped.
 * - Silent on failure: quota exceeded / disabled storage / JSON parse errors
 *   are swallowed so a broken cache never breaks the chat (no error toast).
 * - Privacy: lives entirely in the browser, never sent to the backend.
 */
import { readStoredString, writeStoredString } from "@/lib/prefs-store";
import type { ChatTurn } from "./chat-engine";

/** Last 50 turns per conversation — the minimum the plan §2.5 mandates. */
export const CHAT_HISTORY_CACHE_LIMIT = 50;

/** localStorage prefix. One entry per conversation, keyed by its stable ID. */
const KEY_PREFIX = "lxp:assistant:chat:";

/**
 * Build the localStorage key for a given session/conversation id.
 * Returns null for invalid (empty / non-string) ids so the caller can no-op
 * without having to repeat the check.
 */
export function chatHistoryCacheKey(sessionId: string | null | undefined): string | null {
  if (typeof sessionId !== "string" || sessionId.length === 0) return null;
  return `${KEY_PREFIX}${sessionId}`;
}

/**
 * Load the cached turns for a session. Returns null when:
 *   - there's no cached entry (first visit / different device),
 *   - localStorage is unavailable (SSR / disabled / quota error),
 *   - the cached payload is malformed JSON or the wrong shape.
 *
 * The cache is treated as a HINT, not authoritative: callers should still
 * fetch the authoritative history from the backend and merge.
 */
export function loadChatHistoryCache(sessionId: string | null | undefined): ChatTurn[] | null {
  if (typeof window === "undefined") return null;
  const key = chatHistoryCacheKey(sessionId);
  if (!key) return null;
  const raw = readStoredString(key);
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  // Validate each entry is at least shaped like a ChatTurn. Anything weird is
  // dropped (defensive: don't render garbage if a future schema breaks).
  const turns: ChatTurn[] = [];
  for (const item of parsed) {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as { role?: unknown }).role === "string" &&
      ((item as { role: string }).role === "user" ||
        (item as { role: string }).role === "assistant") &&
      typeof (item as { text?: unknown }).text === "string"
    ) {
      turns.push(item as ChatTurn);
    }
  }
  return turns.length > 0 ? turns : null;
}

/**
 * Persist up to the LAST `CHAT_HISTORY_CACHE_LIMIT` turns of a conversation.
 * Swallows every error silently — quota exceeded, disabled storage, JSON
 * stringify failures — per spec (no error toast, persistence must never break
 * the chat flow).
 *
 * @param sessionId  The conversation ID. No-op when null/undefined/empty.
 * @param turns      The current turn array (any length; we slice the tail).
 */
export function saveChatHistoryCache(
  sessionId: string | null | undefined,
  turns: readonly ChatTurn[] | null | undefined,
): void {
  if (typeof window === "undefined") return;
  const key = chatHistoryCacheKey(sessionId);
  if (!key || !Array.isArray(turns) || turns.length === 0) return;
  const tail = turns.length > CHAT_HISTORY_CACHE_LIMIT
    ? turns.slice(turns.length - CHAT_HISTORY_CACHE_LIMIT)
    : turns;
  writeStoredString(key, JSON.stringify(tail));
}

/** Test/dev helper — clears every cached entry this module owns. */
export function clearAllChatHistoryCache(): void {
  if (typeof window === "undefined") return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(KEY_PREFIX)) toRemove.push(k);
    }
    for (const k of toRemove) window.localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}