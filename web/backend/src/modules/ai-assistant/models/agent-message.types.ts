// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Agent↔agent asynchronous messages — the PERSISTENT handoff channel between
 * two RELATED agents (subordinate / connection / parent), without going through
 * the leader and without blocking the sender.
 *
 * Contrast with the existing channels:
 *   - `agents.delegate` — SYNCHRONOUS: blocks the sender's turn until the
 *     target answers. Right for a short question inside the current turn.
 *   - `team.assign` — leader-only, board-anchored, result collected by the
 *     leader.
 *   - `agents.send_message` (THIS) — fire-and-forget requirement handed to a
 *     related agent. It is persisted here, delivered into that agent's mailbox
 *     conversation and DRAINED even if the recipient had no live run (it gets
 *     woken up). The sender keeps working.
 *
 * Storage is per-server (like conversations and the task board):
 * `${LUXIPANEL_CONFIG_DIR}/assistant/agent-messages.json`.
 */

import type { SessionUser } from "../../../shared/types/index.js";

export type AgentMessageStatus = "pending" | "delivered" | "read" | "failed";

/** Terminal states — a message never leaves one of these (idempotent close). */
export const TERMINAL_MESSAGE_STATUSES: readonly AgentMessageStatus[] = ["read", "failed"] as const;

export function isTerminalMessageStatus(s: AgentMessageStatus): boolean {
  return (TERMINAL_MESSAGE_STATUSES as readonly string[]).includes(s);
}

/** Cap on one message's body. The text is replayed as a turn in the recipient's
 *  mailbox chat, so it must stay inside the per-message content budget. */
export const AGENT_MESSAGE_TEXT_MAX = 8000;

/** Max non-terminal (pending + delivered, not yet read) messages one sender may
 *  have queued for the SAME recipient. Beyond it the mailbox is "full" — the
 *  sender must wait instead of flooding a recipient that isn't draining. */
export const AGENT_MESSAGE_MAILBOX_CAP = 5;

/**
 * Head+tail truncation with an explicit marker (safe on short strings). The
 * MARKER COUNTS AGAINST THE CAP: the result is never longer than
 * AGENT_MESSAGE_TEXT_MAX, so the persisted `text` honours the field's contract
 * (the recipient replays it as a turn). The budget is computed against the
 * marker's worst case (its digit count can only shrink), so it never overflows.
 */
export function clampMessageText(text: string): string {
  const clean = (text ?? "").trim();
  if (clean.length <= AGENT_MESSAGE_TEXT_MAX) return clean;
  const marker = (removed: number) => `\n…[recortado ${removed} caracteres]…\n`;
  const budget = Math.max(0, AGENT_MESSAGE_TEXT_MAX - marker(clean.length).length);
  const head = Math.floor(budget * 0.75);
  const tail = budget - head;
  return `${clean.slice(0, head)}${marker(clean.length - budget)}${tail > 0 ? clean.slice(-tail) : ""}`;
}

export interface AgentMessage {
  /** Project fixed by the sender context, never by tool arguments. */
  projectId?: string | null;
  id?: string;
  /** Sender agent (the one that called `agents.send_message`). */
  fromAgentId: string;
  /** Snapshot of the sender's name at send time (agents are deletable). */
  fromAgentName: string;
  /** Recipient agent — must be RELATED to the sender (see agent-targets.ts). */
  toAgentId: string;
  /** Snapshot of the recipient's name at send time. */
  toAgentName: string;
  /** Body handed to the recipient (already clamped to AGENT_MESSAGE_TEXT_MAX). */
  text: string;
  status: AgentMessageStatus;
  /**
   * Delegation depth of the DELIVERED turn (sender depth + 1). Capped like
   * `agents.delegate`/`team.assign` so a message ping-pong can't recurse
   * without bound.
   */
  hops: number;
  /** The sender's chat (context/traceability; not required to deliver). */
  senderConversationId?: string | null;
  /** The recipient's MAILBOX chat this message was delivered into. */
  deliveryConversationId?: string | null;
  userId?: string | null;
  /**
   * Snapshot of the SENDING user (same rationale as QueuedTurn.user /
   * TeamTask.user): the delivered turn runs with the EXACT tool/CLI gating the
   * user had when the message was sent — never escalating.
   */
  user?: SessionUser | null;
  createdAt: string;
  deliveredAt?: string;
  readAt?: string;
  error?: string;
}

/** Compact view returned by the read-only REST surface. */
export interface AgentMessageView {
  id: string;
  fromAgentId: string;
  fromAgentName: string;
  toAgentId: string;
  toAgentName: string;
  text: string;
  status: AgentMessageStatus;
  hops: number;
  senderConversationId: string | null;
  deliveryConversationId: string | null;
  createdAt: string;
  deliveredAt: string | null;
  readAt: string | null;
  error: string | null;
}

export function toAgentMessageView(m: AgentMessage): AgentMessageView {
  return {
    id: m.id ?? "",
    fromAgentId: m.fromAgentId,
    fromAgentName: m.fromAgentName,
    toAgentId: m.toAgentId,
    toAgentName: m.toAgentName,
    text: m.text,
    status: m.status,
    hops: m.hops,
    senderConversationId: m.senderConversationId ?? null,
    deliveryConversationId: m.deliveryConversationId ?? null,
    createdAt: m.createdAt,
    deliveredAt: m.deliveredAt ?? null,
    readAt: m.readAt ?? null,
    error: m.error ?? null,
  };
}
