// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Shared types + storage constants for the per-target conversation history.
 * The message/meta shapes are public (imported by the chat pipeline, controllers
 * and other repos); the sidecar layout constants + `StoreScope` are internal to
 * the conversations repository split.
 */

import type { AskQuestion } from "../../models/ask.types.js";
import type { ConversationSearchMatch } from "./message-search.js";

export interface MessageAttachmentRef {
  id: string;
  name: string;
  mimeType: string;
  /** Original user recording; only its transcript is sent to the agent. */
  voice?: { transcript: string };
}

export interface ConversationMessage {
  error?: string;
  interrupted?: boolean;
  role: "user" | "assistant";
  /** Provider that handled this turn. Keeps per-bubble branding stable. */
  provider?: string;
  /**
   * Canonical text used to build the agent context. When the background
   * translation layer is active this is ENGLISH for BOTH roles, so history
   * replay stays token-cheap and `buildMessagesFromHistory` needs no extra
   * logic. The user-facing variant lives in `textOriginal`/`textTranslated`.
   */
  content: string;
  ts: string; // ISO
  /**
   * Translation layer (only set when translation was active for this turn):
   *   - `lang`           the user's display language for this turn (e.g. "es")
   *   - `textOriginal`   user turns: the user's own-language text (rendered)
   *   - `textTranslated` assistant turns: own-language answer (rendered)
   * Rendering reads `textOriginal ?? content` (user) / `textTranslated ?? content`
   * (assistant); absence means no translation → render `content` directly.
   */
  lang?: string;
  textOriginal?: string;
  textTranslated?: string;
  /**
   * Assistant turns only: set when background translation degraded after
   * retries — the human reason the answer was stored untranslated. Lets the
   * reloaded bubble re-show the collapsed "shown untranslated" notice.
   */
  textTranslationError?: string;
  /** Files the user attached to this turn (served via /api/ai/attachments/:id). */
  attachments?: MessageAttachmentRef[];
  /**
   * Assistant turns only: true when the answer was produced in CLI mode. Lets
   * the chat history re-render it inside the terminal-styled, scrollable box
   * (instead of ballooning plain text) just like the live bubble did.
   */
  cli?: boolean;
  /**
   * Assistant CLI turns only: the FULL terminal execution log (every step,
   * tool call and sub-agent lane). `content` holds just the clean final answer
   * (cheap context replay + the chat bubble); this holds the verbose log so the
   * collapsed "Consola del servidor" box can be rebuilt on reload. Absent for
   * pre-split turns, where `content` still carries the whole log.
   */
  cliLog?: string;
  /**
   * Assistant turns only: an interactive question the CLI agent posed. When the
   * turn is the last in the thread, the chat re-renders the selectable controls
   * so the user can still answer after a reload.
   */
  ask?: AskQuestion[];
  /**
   * Assistant turns only, with `ask`: "plan-approval" marks the pending ask as
   * a plan-approval request. Answering with its FIRST option sends the
   * structured `planDecision: "approve"` flag so the next turn runs with the
   * manual gate (the persisted approval mode stays "plan").
   */
  askKind?: "plan-approval";
  /**
   * Assistant turns only: total token usage spent on this query/execution,
   * summed across every `usage` event the run emitted (agent + sub-agents +
   * background translation). Mirrors the per-turn total the live bubble showed
   * so the footer still displays it after a reload. The authoritative
   * time-series ledger remains `usage.repository`; this is a display copy.
   */
  tokens?: { input: number; output: number; total: number; estimated?: boolean };
  /** Assistant turns only: wall-clock ms the run took (start → completion).
   *  Lets the dashboard show how long a finished query took after a reload. */
  durationMs?: number;
  /**
   * Synthetic message produced by context compaction: a concise summary that
   * REPLACES the older turns it folded. Carries `summarizedCount` so the chat
   * can render a "📋 N mensajes anteriores resumidos" divider instead of a
   * normal bubble. The summary text lives in `content` (fed to the agent as
   * context on the next turn).
   */
  compacted?: boolean;
  /** Compaction summary: how many original messages this note folded. */
  summarizedCount?: number;
  /**
   * User turns only: system-generated turn (e.g. the team leader wake-up
   * nudge), not typed by the user. Rendered as a system chip instead of a user
   * bubble; never translated.
   */
  auto?: boolean;
}

export interface ConversationMeta {
  /** Durable composer choices owned by this conversation. Empty = automatic. */
  model?: string;
  effort?: "" | "low" | "medium" | "high" | "xhigh" | "max";
  approvalMode?: "manual" | "auto" | "plan";

  id?: string;
  title: string;
  /** Provider that created the conversation; stable for list badges/grouping. */
  originProvider?: string;
  provider: string;
  /** Optional project this conversation belongs to. */
  projectId?: string | null;
  /** Optional custom agent this conversation is bound to (Dashboard grouping). */
  agentId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  messageCount: number;
  /** First ~120 chars of the latest message — for the list preview. */
  preview: string;
  /** Search response only: excerpt from an older matching turn (never stored). */
  searchMatch?: ConversationSearchMatch;
  /**
   * Background-translation state for this conversation:
   *   - `lang`      pinned display language (auto-detected on first turn)
   *   - `translate` per-conversation override; `undefined` = follow the global
   *                 default in `AssistantConfig.translation.enabled`.
   */
  lang?: string;
  translate?: boolean;
  /**
   * True when this conversation's last run FINISHED but the user hasn't opened
   * it since. Set when the assistant turn is persisted on run completion,
   * cleared when the conversation is opened (`markReviewed`). Persisted so the
   * Dashboard can surface "ended but not reviewed" chats with a red dot even
   * after a panel reload (the in-memory engine flag doesn't survive that).
   */
  unreviewed?: boolean;
  /**
   * User-pinned conversation. Pinned chats sort to the top of the list (ahead of
   * the normal updatedAt-desc ordering) so important threads stay reachable.
   * Toggled via PATCH /api/ai/conversations/:id.
   */
  pinned?: boolean;
  /**
   * ISO timestamp of the last successful MCP repair (`POST /api/ai/mcp/repair`)
   * on this conversation. The chat's "Sesión MCP expirada" banner is derived by
   * scanning the persisted transcript for the `MCP_SESSION_EXPIRED` marker, so
   * it stays sticky even after the session is healthy again. The frontend hides
   * the banner when this timestamp is newer than the newest marker-bearing turn
   * — the durable, reload-surviving "resolved" signal.
   */
  mcpRepairedAt?: string;
  /**
   * Último `panelOrigin` (esquema+host del panel) visto en un run vivo de esta
   * conversación. Los turnos DRENADOS de la cola (nudge de equipo, mensajes
   * entre agentes, follow-ups) no tienen Request de la que derivarlo, y sin él
   * el CLI arranca SIN el canal cross-MCP (tools `team__*`/`agents.*` ausentes:
   * "No such tool available"). El drain lo lee de aquí y acuña tokens frescos.
   */
  panelOrigin?: string;
}

export interface ConversationDoc {
  id?: string;
  messages: ConversationMessage[];
}

/** Embedded identity header persisted alongside a conversation's messages. */
export interface EmbeddedConversationMeta {
  /** Durable composer choices owned by this conversation. Empty = automatic. */
  model?: string;
  effort?: "" | "low" | "medium" | "high" | "xhigh" | "max";
  approvalMode?: "manual" | "auto" | "plan";

  agentId?: string | null;
  provider?: string;
  originProvider?: string;
  projectId?: string | null;
  title?: string;
  createdAt?: string;
}

export const MODULE = "assistant";
export const META_COLLECTION = "conversations";
export type StoreScope = "shared" | "user";

export const MSG_DOC_ID = "messages";
// Reserved doc id living INSIDE each `conv…-<id>.json` sidecar next to the
// `messages` doc: an embedded copy of the conversation's identity (agentId,
// provider, project, title, createdAt). The index (`conversations-u<uid>.json`)
// is the display source of truth, but it is separately corruptible/truncatable;
// when it loses an entry, reconstruction reads THIS header so the recovered
// chat keeps its agent binding (Dashboard "Agentes" tab) instead of being
// re-minted as a loose chat with `agentId: null`. It is a normal sidecar doc,
// so every message reader (`get(MSG_DOC_ID)`) already ignores it — messages
// live in the `messages` doc's array, never as top-level docs.
export const META_DOC_ID = "__meta";
