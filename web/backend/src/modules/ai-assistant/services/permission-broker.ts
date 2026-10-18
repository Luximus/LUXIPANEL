// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Permission broker — the human-in-the-loop bridge between the Claude CLI's
 * `permissions.approve` MCP call (running on the target) and the user watching
 * the chat in the panel.
 *
 * Flow for one "ask":
 *   1. The MCP handler calls `request()`. We mint a requestId and `inject()` a
 *      `permission_request` event into the live run (agent-run-registry) so the
 *      OPEN SSE stream renders approve/deny buttons in the assistant bubble.
 *   2. The promise BLOCKS — and so does the MCP HTTP call the CLI is waiting on,
 *      which is exactly how `--permission-prompt-tool` pauses the agent.
 *   3. The user clicks → `POST /api/ai/agent/permission` → `resolve()` settles
 *      the promise. The MCP handler returns allow/deny to the CLI, which then
 *      proceeds or backs off — same turn, no session resume needed.
 *
 * Fail-safe everywhere: no live run to ask through → deny; no answer within the
 * timeout → deny; run stopped → `cancelConversation()` denies every pending.
 * We never block forever and never silently allow.
 *
 * NOTE: this module imports the registry (to inject), but the registry does NOT
 * import this module — that keeps the dependency acyclic. Stop-time cancellation
 * is driven from the controller (which already holds both), not the registry.
 */

import { randomUUID } from "node:crypto";
import { agentRunRegistry } from "./agent-run-registry.js";
import type { PermissionDecision } from "../models/permission.types.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import { getContextUserId } from "../../../shared/executor/context.js";
import { executionKey, executionTargetId } from "./execution-scope.js";

const log = createModuleLogger("ai-permission-broker");

/** How long to wait for the user before defaulting to deny. Must stay under the
 *  panel vhost's `proxy_read_timeout` for the MCP location (the CLI's approve
 *  HTTP call sends no bytes while we wait, so a too-long block would 504). */
const DEFAULT_TIMEOUT_MS = 4 * 60_000;

interface Pending {
  resolve: (decision: PermissionDecision) => void;
  timer: ReturnType<typeof setTimeout>;
  request: { id: string; tool: string; title: string; detail?: string; userId: number | null };
}

/** (server, conversationId) → (requestId → pending). */
const byConversation = new Map<string, Map<string, Pending>>();

/** Settle one pending request: clear its timer, notify clients, resolve. */
function finalize(conversationId: string, requestId: string, decision: PermissionDecision, targetId: string): void {
  const key = executionKey(conversationId, targetId);
  const m = byConversation.get(key);
  const pending = m?.get(requestId);
  if (!m || !pending) return;
  clearTimeout(pending.timer);
  m.delete(requestId);
  if (m.size === 0) byConversation.delete(key);
  // Tell every attached client the prompt is settled so the buttons clear (and
  // a reconnecting client that replays the buffer doesn't re-show a stale one).
  // No-op if the run already GC'd.
  agentRunRegistry.inject(conversationId, { type: "permission_resolved", id: requestId, decision }, targetId);
  // Let the team task board clear the amber "waiting for approval" state on the
  // leader's card when this conversation is a delegated worker. Fire-and-forget.
  try {
    eventBus.emit(Events.AI_PERMISSION_RESOLVED, { conversationId, requestId, decision, targetId });
  } catch (err) {
    log.warn({ err: (err as Error).message }, "AI_PERMISSION_RESOLVED emit failed");
  }
  pending.resolve(decision);
}

export const permissionBroker = {
  /**
   * Ask the user to approve a tool. Resolves to the decision (or "deny" on
   * timeout / when there's no live run to surface the prompt through).
   */
  async request(args: {
    conversationId: string;
    tool: string;
    title: string;
    detail?: string;
    timeoutMs?: number;
    /** Proveedor del run (claude/codex/…). Si falta se deduce del registry:
     *  el target de la campana lo necesita para reabrir el chat correcto. */
    provider?: string;
  }): Promise<PermissionDecision> {
    const targetId = executionTargetId();
    const key = executionKey(args.conversationId, targetId);
    const requestId = randomUUID();
    const injected = agentRunRegistry.inject(args.conversationId, {
      type: "permission_request",
      id: requestId,
      tool: args.tool,
      title: args.title,
      ...(args.detail ? { detail: args.detail } : {}),
    });
    if (!injected) {
      // No live run buffer (ephemeral chat, or the run already settled) → there
      // is no UI to approve through. Fail safe: deny.
      log.warn(
        { conversationId: args.conversationId, tool: args.tool },
        "no live run to surface permission prompt — denying",
      );
      return "deny";
    }
    // Register BEFORE notifying: a supervisor can answer during event delivery.
    let settle!: (decision: PermissionDecision) => void;
    const result = new Promise<PermissionDecision>(resolve => { settle = resolve; });
    const timer = setTimeout(() => {
      log.warn({ conversationId: args.conversationId, requestId, tool: args.tool }, "permission request timed out — denying");
      finalize(args.conversationId, requestId, "deny", targetId);
    }, args.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    timer.unref?.();
    let pending = byConversation.get(key);
    if (!pending) { pending = new Map(); byConversation.set(key, pending); }
    pending.set(requestId, { resolve: settle, timer, request: {
      id: requestId, tool: args.tool, title: args.title, userId: getContextUserId(),
      ...(args.detail ? { detail: args.detail } : {}),
    } });
    // Surface a "needs your approval" notification in the bell (and a Dashboard/
    // chat-list yellow dot via the active-runs feed). Fire-and-forget: a listener
    // failure must never block the actual approval prompt.
    try {
      // El proveedor viaja al target de la campana (abre el chat en el
      // proveedor correcto). `?.()` porque la resolución NO debe poder
      // impedir la notificación si el registry cambia de forma.
      const provider =
        args.provider ??
        agentRunRegistry.activeRuns?.().find((r) => r.key === args.conversationId && r.targetId === targetId)?.provider;
      eventBus.emit(Events.AI_PERMISSION_REQUESTED, {
        conversationId: args.conversationId,
        targetId,
        ...(getContextUserId() !== null ? { userId: getContextUserId() } : {}),
        requestId,
        tool: args.tool,
        title: args.title,
        ...(args.detail ? { detail: args.detail } : {}),
        ...(provider ? { provider } : {}),
      });
    } catch (err) {
      log.warn({ err: (err as Error).message }, "AI_PERMISSION_REQUESTED emit failed");
    }
    return result;
  },

  /** Metadata only; callers must authorize the worker/leader relationship. */
  pendingRequests(conversationId: string, targetId = executionTargetId()) {
    return [...(byConversation.get(executionKey(conversationId, targetId))?.values() ?? [])]
      .map(p => ({ ...p.request }));
  },

  /** Apply the user's decision. Returns false when no such request is pending. */
  resolve(conversationId: string, requestId: string, decision: PermissionDecision): boolean {
    const targetId = executionTargetId();
    const m = byConversation.get(executionKey(conversationId, targetId));
    if (!m || !m.has(requestId)) return false;
    finalize(conversationId, requestId, decision, targetId);
    return true;
  },

  /** Deny + clear every pending request for a conversation (run stopped/gone). */
  cancelConversation(conversationId: string, targetId = executionTargetId()): void {
    const m = byConversation.get(executionKey(conversationId, targetId));
    if (!m) return;
    for (const requestId of [...m.keys()]) finalize(conversationId, requestId, "deny", targetId);
  },

  /** Pending request count for a conversation (diagnostics / tests). */
  pendingCount(conversationId: string): number {
    return byConversation.get(executionKey(conversationId))?.size ?? 0;
  },
};
