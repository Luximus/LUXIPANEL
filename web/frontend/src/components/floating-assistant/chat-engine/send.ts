// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { chatEngine } from "../chat-engine";
import type { AgentMessage, ChatAttachment } from "../assistant-api";
import {
  streamAgent, steerAgent, enqueueAgentTurn, listAgentQueue, cancelAgentQueue,
} from "../assistant-api";
import type { ChatTurn, TurnAttachment, QueuedSend } from "./types";
import {
  chats, pendingAddenda, queues, serverQueued, emit, sleep,
  isActivelyViewing, syncReviewedIfViewing,
} from "./state";
import {
  applyEvent, handleStreamThrow, lastTurnInterrupted, lastTurnStopped, reloadHistory,
} from "./stream-apply";

// ── Addenda (steering / continuation) ───────────────────────────────────────

/**
 * Live-steering capability of a provider's run. claude/minimax (Claude Code
 * binary) ATTEMPT live injection via the backend `/agent/input` channel; the
 * backend answers 409 when steering is disabled (ASSISTANT_LIVE_STEERING off) or
 * no FIFO run is active, and `sendAddendum` then falls back to a continuation —
 * so flipping the backend flag needs no frontend redeploy. codex → "app-server"
 * lands in Phase 3; everyone else uses the continuation fallback only.
 */
type SteeringCapability = "stream-json" | "app-server" | "none";
function steeringCapability(provider: string): SteeringCapability {
  if (provider === "claude" || provider === "minimax") return "stream-json";
  return "none";
}

/** Index of the user turn the live run is answering (the last `role:"user"`),
 *  or -1 if none. Addenda are appended to THIS turn so they share its bubble. */
function activeUserTurnIndex(key: string): number {
  const turns = chats.get(key)?.turns ?? [];
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i]!.role === "user") return i;
  }
  return -1;
}

/** Append addendum text/attachments to the active user bubble (display-only:
 *  stored in `addenda`, NOT folded into `text`, so history stays clean).
 *  Returns false when there's no active user bubble to attach to. */
function appendToActiveTurn(key: string, text: string, attachments?: ChatAttachment[]): boolean {
  const chat = chats.get(key);
  if (!chat) return false;
  const idx = activeUserTurnIndex(key);
  if (idx < 0) return false;
  const turns = [...chat.turns];
  const u = turns[idx]!;
  const addenda = [...(u.addenda ?? [])];
  if (text) addenda.push(text);
  const extraAtt: TurnAttachment[] | undefined = attachments?.length
    ? attachments.map((a) => ({ name: a.name, mimeType: a.mimeType, ...(a.voice ? { voice: a.voice } : {}), url: `data:${a.mimeType};base64,${a.dataBase64}` }))
    : undefined;
  turns[idx] = {
    ...u,
    addenda,
    ...(extraAtt ? { attachments: [...(u.attachments ?? []), ...extraAtt] } : {}),
  };
  chats.set(key, { ...chat, turns });
  emit();
  return true;
}

interface AddendumItem {
  provider: string;
  isCli: boolean;
  conversationId: string | null;
  projectId?: string | null;
  agentId?: string | null;
  userText: string;
  attachments?: ChatAttachment[];
  model?: string;
  effort?: "low" | "medium" | "high" | "xhigh";
  buildMessages: (priorTurns: ChatTurn[], overrideText?: string) => AgentMessage[];
  onClear?: (key: string) => void;
  onSettled?: (key: string) => void;
}

/**
 * Handle a default send issued while a run is live: merge it into the active
 * bubble, then deliver it to the model. Live-steering providers inject it right
 * away; everyone else buffers it to drain as one continuation turn on settle.
 */
export function sendAddendum(key: string, item: AddendumItem): void {
  // No active bubble to attach to (e.g. a background run not adopted into this
  // client's turns) → a continuation would show no user text. Fall back to the
  // separate server/client queue so the message is delivered + visible (chip).
  if (!appendToActiveTurn(key, item.userText, item.attachments)) {
    if (item.conversationId) {
      void enqueueServerTurn(key, item.conversationId, {
        provider: item.provider,
        projectId: item.projectId,
        agentId: item.agentId,
        userText: item.userText,
        attachments: item.attachments,
        model: item.model,
    effort: item.effort,
      });
    } else {
      enqueueSend(key, {
        provider: item.provider,
        isCli: item.isCli,
        conversationId: item.conversationId,
        projectId: item.projectId,
        agentId: item.agentId,
        userText: item.userText,
        attachments: item.attachments,
        model: item.model,
    effort: item.effort,
        buildMessages: item.buildMessages,
        onClear: item.onClear,
        onSettled: item.onSettled,
      });
    }
    return;
  }

  const cap = steeringCapability(item.provider);
  if (cap !== "none" && item.conversationId) {
    // Live steering: inject the addendum into the running turn. If the backend
    // says there's no active run (409) or it otherwise fails, fall back to the
    // continuation buffer so the message is never lost.
    void steerAgent(item.conversationId, item.userText).catch(() => bufferAddendum(key, item));
    return;
  }
  bufferAddendum(key, item);
}

/** Accumulate an addendum to drain as a single continuation when the run settles. */
function bufferAddendum(key: string, item: AddendumItem): void {
  const cur = pendingAddenda.get(key);
  if (cur) {
    if (item.userText) cur.texts.push(item.userText);
    if (item.attachments?.length) cur.attachments.push(...item.attachments);
    // Keep the freshest context builder / callbacks.
    cur.buildMessages = item.buildMessages;
    cur.onSettled = item.onSettled;
    return;
  }
  pendingAddenda.set(key, {
    texts: item.userText ? [item.userText] : [],
    attachments: item.attachments ? [...item.attachments] : [],
    provider: item.provider,
    isCli: item.isCli,
    conversationId: item.conversationId,
    projectId: item.projectId,
    agentId: item.agentId,
    model: item.model,
    effort: item.effort,
    buildMessages: item.buildMessages,
    onClear: item.onClear,
    onSettled: item.onSettled,
  });
}

/**
 * Drain buffered addenda for `key` as ONE continuation turn (texts joined). The
 * addenda are already shown in the active bubble, so the continuation does NOT
 * render a second user bubble (`continueActiveBubble`); only a fresh assistant
 * turn streams the response. Returns true when a continuation was dispatched.
 */
function drainPendingAddenda(key: string): boolean {
  const p = pendingAddenda.get(key);
  if (!p || p.texts.length === 0) {
    pendingAddenda.delete(key);
    return false;
  }
  pendingAddenda.delete(key);
  const combined = p.texts.join("\n");
  const priorTurns = chats.get(key)?.turns ?? [];
  const messages = p.buildMessages(priorTurns, combined);
  void dispatchSend(key, {
    provider: p.provider,
    isCli: p.isCli,
    conversationId: p.conversationId,
    projectId: p.projectId,
    agentId: p.agentId,
    messages,
    userText: combined,
    attachments: p.attachments,
    model: p.model,
    effort: p.effort,
    onClear: p.onClear,
    onSettled: p.onSettled,
    continueActiveBubble: true,
  });
  return true;
}

// ── Queue dispatch ──────────────────────────────────────────────────────────

/** Append a follow-up send to a chat's queue (rendered as a chip in the UI). */
export function enqueueSend(key: string, item: QueuedSend): void {
  const q = queues.get(key) ?? [];
  q.push(item);
  queues.set(key, q);
  emit();
}

/**
 * Remove a queued follow-up by its position in the combined order from
 * `queued` (server items first, then client-side). Updates the right mirror,
 * cancels the persisted server item (non-optimistic), and emits. No-op when the
 * index is out of range.
 */
export function removeQueuedAt(key: string, index: number): void {
  const server = serverQueued.get(key) ?? [];
  if (index >= 0 && index < server.length) {
    const item = server[index];
    const rest = server.filter((_, i) => i !== index);
    if (rest.length) serverQueued.set(key, rest);
    else serverQueued.delete(key);
    emit();
    if (item && !item.id.startsWith("tmp-")) void cancelAgentQueue(item.id);
    return;
  }
  const localIndex = index - server.length;
  const q = queues.get(key);
  if (!q || localIndex < 0 || localIndex >= q.length) return;
  q.splice(localIndex, 1);
  if (q.length === 0) queues.delete(key);
  emit();
}

/**
 * Dispatch the next queued follow-up for `key`, if any. Called from the
 * `finally` of every run path once it settles WITHOUT being interrupted (an
 * interrupted run resumes first; we don't want to start the next message on
 * top of a half-finished one). The outgoing context is rebuilt here from the
 * now-current turns so the queued message carries the answer that just landed.
 */
function drainQueue(key: string): void {
  const q = queues.get(key);
  if (!q || q.length === 0) return;
  const next = q.shift()!;
  if (q.length === 0) queues.delete(key);
  emit();

  const priorTurns = chats.get(key)?.turns ?? [];
  const messages = next.buildMessages(priorTurns);
  void dispatchSend(key, {
    provider: next.provider,
    isCli: next.isCli,
    conversationId: next.conversationId,
    projectId: next.projectId,
    agentId: next.agentId,
    messages,
    userText: next.userText,
    attachments: next.attachments,
    model: next.model,
    effort: next.effort,
    planDecision: next.planDecision,
    onClear: next.onClear,
    onSettled: next.onSettled,
  });
}

// ── Server-side (background) queue ───────────────────────────────────────────

/**
 * Enqueue a follow-up on the SERVER. Shows an optimistic chip immediately, then
 * reconciles with the server's authoritative list. The server drains it in the
 * background (via the registry's onComplete) even if this tab closes.
 */
export async function enqueueServerTurn(
  key: string,
  conversationId: string,
  p: { provider: string; projectId?: string | null; agentId?: string | null; userText: string; attachments?: ChatAttachment[]; model?: string; effort?: "low" | "medium" | "high" | "xhigh"; planDecision?: "approve" },
): Promise<void> {
  const optimisticId = `tmp-${Math.random().toString(36).slice(2)}`;
  const cur = serverQueued.get(key) ?? [];
  serverQueued.set(key, [...cur, { id: optimisticId, userText: p.userText }]);
  emit();
  try {
    const { pending } = await enqueueAgentTurn(conversationId, {
      provider: p.provider,
      projectId: p.projectId ?? null,
      agentId: p.agentId ?? null,
      userText: p.userText,
      attachments: p.attachments,
      model: p.model,
    effort: p.effort,
      planDecision: p.planDecision,
    });
    if (pending.length) serverQueued.set(key, pending);
    else serverQueued.delete(key);
  } catch {
    // Roll back the optimistic chip on failure.
    const rest = (serverQueued.get(key) ?? []).filter((x) => x.id !== optimisticId);
    if (rest.length) serverQueued.set(key, rest);
    else serverQueued.delete(key);
  }
  emit();
}

/** Refresh the local mirror of the server queue. Returns the pending count. */
export async function refreshServerQueue(key: string, conversationId: string): Promise<number> {
  const pending = await listAgentQueue(conversationId);
  if (pending.length) serverQueued.set(key, pending);
  else serverQueued.delete(key);
  emit();
  return pending.length;
}

const FOLLOW_BACKOFF_MS = [300, 700, 1500, 3000, 6000];

/**
 * After a run settles cleanly, drain the client-side queue (brand-new chats)
 * AND, for conversationId chats, follow the SERVER-side chain: the backend has
 * (or is about to) auto-start the next queued turn — re-attach to it so an open
 * tab mirrors the background progress. No-op when there's nothing pending.
 */
export function onCleanSettle(key: string, conversationId: string | null, provider: string, isCli: boolean): void {
  // Addenda the user appended mid-run (default send, no live steering) drain
  // FIRST as a single continuation of the same bubble. Its own settle re-enters
  // here to then drain the separate "Encolar" queue.
  if (drainPendingAddenda(key)) return;
  drainQueue(key);
  if (!conversationId) return;
  // A drained item disappears from /queue BEFORE its new run is attached here.
  // Preserve the intent to follow across refreshServerQueue's mirror update;
  // an empty pending list can mean the next turn has already started.
  const hadQueuedTurns = (serverQueued.get(key)?.length ?? 0) > 0;
  void refreshServerQueue(key, conversationId).then((n) => {
    if (hadQueuedTurns || n > 0) void followServerChain(key, conversationId, provider, isCli);
  });
}

/**
 * Probe (with backoff) for the next background run the server started from the
 * queue, then reload history (so the just-drained user turn shows) and adopt it.
 * Adopting re-enters the settle path, so the chain keeps flowing turn-by-turn.
 * Only runs while the tab is visible — the server drains regardless; this just
 * mirrors it live.
 */
export async function followServerChain(key: string, conversationId: string, provider: string, isCli: boolean): Promise<void> {
  for (const delay of FOLLOW_BACKOFF_MS) {
    if (chats.get(key)?.streaming) return; // something already took over
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    await sleep(delay);
    if (chats.get(key)?.streaming) return;
    await reloadHistory(key, conversationId);
    const adopted = await chatEngine.adopt(key, provider, conversationId, isCli);
    if (adopted) return; // adopt's settle path continues the chain
  }
}

/**
 * Core stream dispatch: append the user turn + a pending assistant turn, open
 * the SSE stream, apply events, and settle. Shared by `send` (immediate) and
 * `drainQueue` (queued follow-ups). On a clean finish it drains the next queued
 * message so a backlog flushes one-by-one in order.
 */
export async function dispatchSend(
  key: string,
  p: {
    provider: string;
    isCli: boolean;
    conversationId: string | null;
    projectId?: string | null;
    agentId?: string | null;
    messages: AgentMessage[];
    userText: string;
    attachments?: ChatAttachment[];
    /** Per-turn model override (in-chat selector); absent → provider default. */
    model?: string;
  effort?: "low" | "medium" | "high" | "xhigh";
    /** "approve" cuando este turno responde a un ask plan-approval con su
     *  primera opción — el backend re-valida y ejecuta con gate manual. */
    planDecision?: "approve";
    /** Continuation of an addendum already merged into the active bubble: skip
     *  rendering a SECOND user turn — only stream a fresh assistant response. */
    continueActiveBubble?: boolean;
    onClear?: (key: string) => void;
    onSettled?: (key: string) => void;
  },
): Promise<void> {
  const { provider, isCli, conversationId, projectId, agentId, messages, userText, attachments, model, effort, continueActiveBubble } = p;
  const baseTurns = chats.get(key)?.turns ?? [];

  const ac = new AbortController();
  const startedAt = Date.now();
  const userAttachments: TurnAttachment[] | undefined = attachments?.length
    ? attachments.map((a) => ({
        name: a.name,
        mimeType: a.mimeType, ...(a.voice ? { voice: a.voice } : {}),
        url: `data:${a.mimeType};base64,${a.dataBase64}`,
      }))
    : undefined;
  // Addendum continuation: the user text already lives in the active bubble, so
  // append ONLY the assistant turn. Otherwise add the user turn + assistant turn.
  const turns: ChatTurn[] = continueActiveBubble
    ? [
        ...baseTurns,
        { role: "assistant", provider, text: "", tools: [], pending: true },
      ]
    : [
        ...baseTurns,
        { role: "user", text: userText, tools: [], createdAt: startedAt, ...(userAttachments ? { attachments: userAttachments } : {}) },
        { role: "assistant", provider, text: "", tools: [], pending: true },
      ];
  chats.set(key, { provider, conversationId, turns, streaming: true, abort: ac, isCli });
  emit();

  const isClear = userText.trim().startsWith("/clear");

  try {
    for await (const frame of streamAgent(messages, ac.signal, conversationId ?? undefined, provider, projectId ?? null, attachments, model, agentId ?? null, p.planDecision, effort)) {
      applyEvent(key, frame.event, { isCli, startedAt, seq: frame.seq });
    }
  } catch (err) {
    handleStreamThrow(key, err, startedAt, isCli);
  } finally {
    const chat = chats.get(key);
    // Mark the finished run as "sin revisar" so the Dashboard surfaces it as
    // a pending result (cleared when the user opens the conversation). Skip the
    // flag when the user is already looking at this chat — they saw the result.
    if (chat) chats.set(key, { ...chat, streaming: false, abort: undefined, unreviewed: !isClear && !isActivelyViewing(key) });
    // Watching this chat as it finished? The backend marked it unreviewed anyway;
    // clear that persisted flag so no red dot shows for the open conversation.
    if (!isClear) syncReviewedIfViewing(key, conversationId);
    if (isClear) {
      chats.set(key, { provider, conversationId, turns: [], streaming: false });
      p.onClear?.(key);
    }
    emit();
    p.onSettled?.(key);
    // The connection dropped (e.g. mobile WebView frozen on app-switch). The
    // run keeps going on the backend; resume/reload as soon as we're visible.
    if (lastTurnInterrupted(key)) scheduleResume(key);
    else if (!lastTurnStopped(key)) onCleanSettle(key, conversationId, provider, isCli);
  }
}

// ── Foreground resume ───────────────────────────────────────────────────────

/** Backoff schedule (ms) for resume retries; after the last one we give up
 *  and leave the interrupted banner so the user can resend manually. */
const RESUME_BACKOFF_MS = [400, 1500, 4000, 10000];
const resumeAttempts = new Map<string, number>();

/** Resume after a backoff delay (lets a still-alive socket settle first, and
 *  avoids hammering the server when the network is genuinely down). */
export function scheduleResume(key: string): void {
  if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
  const attempt = resumeAttempts.get(key) ?? 0;
  if (attempt >= RESUME_BACKOFF_MS.length) return; // gave up — manual resend
  resumeAttempts.set(key, attempt + 1);
  setTimeout(() => void chatEngine.resume(key), RESUME_BACKOFF_MS[attempt]);
}

/** Reset the retry counter once a chat is healthy again. */
export function resetResumeAttempts(key: string): void {
  resumeAttempts.delete(key);
}
