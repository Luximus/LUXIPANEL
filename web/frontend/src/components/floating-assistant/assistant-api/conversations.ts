import { createLoadCoordinator, shareAssistantReads } from "./load-coordinator";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { api, unwrap, resolveTargetScope, scopeHeaders } from "@/lib/api-client";
import type { AskQuestion } from "./agent-stream";
import type { ApiActivity } from "./api-activity";

// ── Conversation history (ChatGPT-style) ──────────────────────────────────

export interface ConversationMeta {
  model?: string;
  effort?: "" | "low" | "medium" | "high" | "xhigh" | "max";
  approvalMode?: "manual" | "auto" | "plan";

  id: string;
  title: string;
  originProvider?: string;
  provider: string;
  projectId?: string | null;
  /** Custom agent this conversation is bound to (Dashboard grouping). */
  agentId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  messageCount: number;
  preview: string;
  /** Excerpt from a matching historical message; present only in search results. */
  searchMatch?: { snippet: string; role: "user" | "assistant"; messageIndex: number };
  /** Pinned display language (auto-detected). */
  lang?: string;
  /** Per-conversation translation override (undefined = follow global default). */
  translate?: boolean;
  /** Pinned to the top of the list (backend orders pinned first in list()). */
  pinned?: boolean;
  /**
   * True when the last run finished but the user hasn't opened the chat since.
   * Persisted server-side so the Dashboard's "ended but unreviewed" red dot
   * survives a panel reload (the in-memory engine flag does not).
   */
  unreviewed?: boolean;
  /**
   * ISO timestamp of the last successful MCP-session repair for this chat.
   * Set by `POST /api/ai/mcp/repair` and echoed on GET meta; the chat banner
   * hides the sticky "MCP session expired" notice when this is newer than the
   * most recent turn carrying the `MCP_SESSION_EXPIRED` marker.
   */
  mcpRepairedAt?: string;
}

export interface MessageAttachmentRef {
  id: string;
  name: string;
  mimeType: string;
  /** Original user recording; only its transcript is sent to the agent. */
  voice?: { transcript: string };
}

export interface ConversationMessage {
  /** The stream ended, but this turn still awaits background work/collection. */
  pending?: boolean;
  /** Ordered API process history; content/textTranslated hold only the answer. */
  apiActivity?: ApiActivity;
  error?: string;
  interrupted?: boolean;
  role: "user" | "assistant";
  provider?: string;
  content: string;
  ts: string;
  attachments?: MessageAttachmentRef[];
  /** Assistant turns produced in CLI mode → re-render in the terminal box. */
  cli?: boolean;
  /** Assistant CLI turns: the FULL terminal execution log for the collapsed
   *  console box. `content` is the clean answer; this is the verbose transcript.
   *  Absent for pre-split turns (then `content` still holds the whole log). */
  cliLog?: string;
  /** Assistant turns only: a pending interactive question (re-rendered as controls). */
  ask?: AskQuestion[];
  /** Con `ask`: "plan-approval" = aprobación de plan (primera opción → planDecision). */
  askKind?: "plan-approval";
  /** Assistant turns only: total tokens spent on this query (input+output, summed). */
  tokens?: { input: number; output: number; total: number; estimated?: boolean };
  /** Assistant turns only: wall-clock ms the run took (start → completion). */
  durationMs?: number;
  /**
   * Background-translation display variants. `content` is canonical English
   * when translation was active; render `textOriginal` (user) / `textTranslated`
   * (assistant) when present.
   */
  lang?: string;
  textOriginal?: string;
  textTranslated?: string;
  /** Assistant turns only: reason background translation degraded after retries
   *  (answer stored untranslated). Re-shows the collapsed notice on reload. */
  textTranslationError?: string;
  /** Synthetic message from context compaction: a summary that replaced older
   *  turns. Rendered as a divider, not a normal bubble. */
  compacted?: boolean;
  /** Compaction summary: how many original messages it folded. */
  summarizedCount?: number;
  /** User turns only: system-generated turn (team leader wake-up nudge), not
   *  typed by the user. Rendered as a muted system chip; never translated. */
  auto?: boolean;
}

/** Context-window occupancy for a conversation (drives the meter + compact button). */
export interface ConversationContext {
  enabled: boolean;
  /** Estimated tokens the conversation currently occupies. */
  tokens: number;
  /** Usable window the estimate is measured against. */
  limit: number;
  /** tokens / limit (can exceed 1 when overrun). */
  ratio: number;
  messageCount: number;
  /** Past the warn threshold → show the manual "Compactar" button. */
  warn: boolean;
  /** Past the auto-compact threshold (a send would compact first). */
  shouldAutoCompact: boolean;
}

/** Result of a compaction run. */
export interface CompactionResult {
  compacted: boolean;
  method: "ai" | "mechanical" | "noop";
  before: number;
  after: number;
  summarizedCount: number;
  tokensBefore: number;
  tokensAfter: number;
  reason?: string;
}

/** Pick the user-facing text for a stored message (translation-aware). */
export function displayText(m: ConversationMessage): string {
  return (m.role === "user" ? m.textOriginal : m.textTranslated) ?? m.content;
}

/** URL the browser can use to render/download a stored attachment. */
export function attachmentUrl(id: string): string {
  return `/api/ai/attachments/${encodeURIComponent(id)}`;
}

/** URL the browser can use to play a cached TTS clip (served from disk). */
export function audioUrl(id: string): string {
  return `/api/ai/audio/${encodeURIComponent(id)}`;
}

/**
 * Thrown when a conversation no longer exists on the server (HTTP 404 from
 * `get(id)` / `messages(id)`). Distinct from transient/network/5xx failures so
 * the UI can PURGE a dead restored tab (and stop re-restoring it on every
 * reload) instead of treating it as a recoverable error. Subclasses `Error`, so
 * existing `catch`/`.catch()` blocks keep handling it as before.
 */
export class ConversationNotFoundError extends Error {
  readonly conversationId: string;
  constructor(conversationId: string) {
    super(`Conversation not found: ${conversationId}`);
    this.name = "ConversationNotFoundError";
    this.conversationId = conversationId;
  }
}

type OpenConversation = {
  items: ConversationMessage[]; total: number; hasMore: boolean;
  conversation?: ConversationMeta | null; context?: ConversationContext;
  sessionId?: string | null; provider?: string | null; sessions?: Record<string, string | null>;
};
const openReads = createLoadCoordinator(() => JSON.stringify([resolveTargetScope(), scopeHeaders()]), 250);
const optionWrites = new Map<string, Promise<ConversationMeta>>();
const optionKey = (id: string) => JSON.stringify([resolveTargetScope(), scopeHeaders(), id]);
const openConversationPage = (id: string) => openReads.read("open", [id], async () => {
  const response = await api.get<OpenConversation>(`/api/ai/conversations/${encodeURIComponent(id)}/messages?limit=10&offset=0&include=meta,session,context`);
  if (response.status === 404) throw new ConversationNotFoundError(id);
  return unwrap(response, "Failed to load messages");
});
if (typeof window !== "undefined") {
  for (const event of ["luxipanel:target-changed", "luxipanel:logout", "luxipanel:session-ended", "luxipanel:session-started", "luxipanel:permissions-changed", "lxp:assistant:usage-updated", "lxp:assistant:conversations-updated"]) window.addEventListener(event, openReads.reset);
}

export const assistantConversationsApi = {
  async list(
    q = "",
    limit = 50,
    offset = 0,
    provider?: string,
    projectId?: string | null,
    withAgent?: boolean,
    page?: { cursor?: string; projectIds?: string[]; agentId?: string | null; agentIds?: string[]; includeSummary?: boolean; summaryScope?: "filtered"; fresh?: boolean },
  ): Promise<{ items: ConversationMeta[]; total: number; nextCursor?: string | null; hasMore?: boolean; searchStatus?: { state: string; indexed: number; total: number }; summary?: { projects: Record<string, number>; agents: Record<string, number> } }> {
    const qs =
      `q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}` +
      (provider ? `&provider=${encodeURIComponent(provider)}` : "") +
      (projectId === undefined ? "" : `&projectId=${encodeURIComponent(projectId ?? "none")}`) +
      (withAgent === undefined ? "" : `&withAgent=${withAgent ? "1" : "0"}`) +
      (page?.agentId === undefined ? "" : `&agentId=${encodeURIComponent(page.agentId ?? "none")}`) +
      (page?.agentIds ? `&agentIds=${encodeURIComponent(page.agentIds.join(","))}` : "") +
      (page?.summaryScope ? `&summaryScope=${page.summaryScope}` : "") +
      (page ? `&paged=1${page.cursor ? `&cursor=${encodeURIComponent(page.cursor)}` : ""}${page.projectIds ? `&projectIds=${encodeURIComponent(page.projectIds.join(","))}` : ""}${page.includeSummary ? "&includeSummary=1" : ""}` : "");
    const res = await api.get<{ ok: boolean; items: ConversationMeta[]; total: number; nextCursor?: string | null; hasMore?: boolean; searchStatus?: { state: string; indexed: number; total: number }; summary?: { projects: Record<string, number>; agents: Record<string, number> } }>(
      `/api/ai/conversations?${qs}`, { fresh: page?.fresh },
    );
    const data = unwrap(res, "Failed to load conversations");
    return { ...data, items: data.items, total: data.total };
  },
  async create(provider: string, firstMessage?: string, projectId?: string | null, agentId?: string | null, choices: Partial<Pick<ConversationMeta, "model" | "effort" | "approvalMode">> = {}): Promise<ConversationMeta> {
    const res = await api.post<{ ok: boolean; conversation: ConversationMeta }>(
      "/api/ai/conversations",
      { provider, firstMessage, projectId, agentId, ...choices },
    );
    return unwrap(res, "Failed to create conversation").conversation;
  },
  /** A single conversation's metadata (incl. its projectId), independent of how
   *  the list is currently scoped — lets the chat header show/open its project. */
  async get(id: string): Promise<ConversationMeta | null> {
    await optionWrites.get(optionKey(id));
    const page = await openConversationPage(id);
    if ("conversation" in page) return page.conversation ?? null;
    const res = await api.get<{ conversation: ConversationMeta }>(`/api/ai/conversations/${encodeURIComponent(id)}`);
    if (res.status === 404) throw new ConversationNotFoundError(id);
    return res.data?.conversation ?? null;
  },
  async messages(
    id: string,
    limit = 10,
    offset = 0,
  ): Promise<{ items: ConversationMessage[]; total: number; hasMore: boolean }> {
    if (limit === 10 && offset === 0) return openConversationPage(id);
    const res = await api.get<{ ok: boolean; items: ConversationMessage[]; total: number; hasMore: boolean }>(
      `/api/ai/conversations/${id}/messages?limit=${limit}&offset=${offset}`,
    );
    // 404 = conversation deleted server-side → typed error so the restore path
    // can purge the dead tab (vs. a generic, retryable "Failed to load").
    if (res.status === 404) throw new ConversationNotFoundError(id);
    const data = unwrap(res, "Failed to load messages");
    return { items: data.items, total: data.total, hasMore: data.hasMore };
  },
  /** Upstream provider session id (the chat identifier the CLI agent resumes). */
  async session(id: string, provider?: string): Promise<{ sessionId: string | null; provider: string | null }> {
    const page = await openConversationPage(id);
    if ("sessionId" in page) return { sessionId: page.sessions?.[provider ?? ""] ?? page.sessionId ?? null, provider: provider ?? page.provider ?? null };
    const res = await api.get<{ sessionId: string | null; provider: string | null }>(`/api/ai/conversations/${encodeURIComponent(id)}/session${provider ? `?provider=${encodeURIComponent(provider)}` : ""}`);
    return { sessionId: res.data?.sessionId ?? null, provider: res.data?.provider ?? null };
  },
  /** Estimated context-window occupancy + whether to offer compaction. */
  async context(id: string): Promise<ConversationContext> {
    const page = await openConversationPage(id);
    if (page.context) return page.context;
    const res = await api.get<{ context: ConversationContext }>(`/api/ai/conversations/${encodeURIComponent(id)}/context`);
    return unwrap(res, "Failed to load context").context;
  },
  /** Fold older turns into a summary so the chat stops overrunning the window. */
  async compact(id: string): Promise<{ result: CompactionResult; context: ConversationContext }> {
    const res = await api.post<{ ok: boolean; result: CompactionResult; context: ConversationContext }>(
      `/api/ai/conversations/${id}/compact`,
      {},
    );
    const data = unwrap(res, "Failed to compact");
    return { result: data.result, context: data.context };
  },
  async setOptions(id: string, patch: Partial<Pick<ConversationMeta, "provider" | "model" | "effort" | "approvalMode">>): Promise<ConversationMeta> {
    const key = optionKey(id);
    const write = (optionWrites.get(key) ?? Promise.resolve()).catch(() => undefined).then(async () => {
      if (optionKey(id) !== key) throw new Error("Conversation target changed");
      const res = await api.patch<{ conversation: ConversationMeta }>(`/api/ai/conversations/${encodeURIComponent(id)}`, patch);
      const meta = unwrap(res, "Failed to save conversation options").conversation;
      openReads.reset();
      return meta;
    });
    optionWrites.set(key, write);
    try { return await write; }
    finally { if (optionWrites.get(key) === write) optionWrites.delete(key); }
  },
  async rename(id: string, title: string): Promise<void> {
    const res = await api.patch(`/api/ai/conversations/${id}`, { title });
    if (!res.ok) throw new Error(res.error ?? "Failed to rename");
  },
  /** Pin/unpin a conversation (backend orders pinned ones first in list()). */
  async setPinned(id: string, pinned: boolean): Promise<void> {
    const res = await api.patch(`/api/ai/conversations/${id}`, { pinned });
    if (!res.ok) throw new Error(res.error ?? "Failed to pin");
  },
  async remove(id: string): Promise<void> {
    const res = await api.delete(`/api/ai/conversations/${id}`);
    if (!res.ok) throw new Error(res.error ?? "Failed to delete");
  },
  /** Clear the server-side "ended but unreviewed" flag (fire-and-forget on open). */
  async markReviewed(id: string): Promise<void> {
    await api.post(`/api/ai/conversations/${id}/reviewed`, {});
  },
};

shareAssistantReads(assistantConversationsApi, "assistantConversationsApi");
