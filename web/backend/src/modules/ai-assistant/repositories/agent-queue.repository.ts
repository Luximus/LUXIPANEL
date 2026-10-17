// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Per-target server-side follow-up queue for the assistant chat.
 *
 * Sidecar: `${LUXIPANEL_CONFIG_DIR}/assistant/agent-queue.json`.
 *
 * WHY: a run is already decoupled from the connection (agent-run-registry) and
 * persists its answer on completion, so a single task survives the tab/app
 * closing. But follow-up messages the user fires while a run is in flight used
 * to live ONLY in the browser — close the tab and they were lost. This queue
 * persists them on the connected server so the chain keeps draining in the
 * background (driven from the registry's `onComplete`) regardless of whether a
 * client is still attached.
 *
 * One queue, FIFO per conversation. The stored `user` (SessionUser) preserves
 * the SAME tool/CLI gating the agent applies, so a backgrounded turn can't
 * gain privileges the user didn't have when they queued it.
 */

import { dataStore } from "../../../shared/data-store/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { SessionUser } from "../../../shared/types/index.js";
import type { AssistantProviderId } from "../models/assistant-config.types.js";
import { createModuleLogger } from "../../../shared/logger/index.js";

const log = createModuleLogger("assistant-agent-queue");
const MODULE = "assistant";
const COLLECTION = "agent-queue";

export interface QueuedAttachment {
  name: string;
  mimeType: string;
  /** Original user recording; only its transcript is sent to the agent. */
  voice?: { transcript: string };
  dataBase64: string;
}

export interface QueuedTurn {
  id?: string;
  conversationId: string;
  provider?: AssistantProviderId;
  /** Per-turn model override (in-chat picker) preserved for the background drain. */
  model?: string;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  projectId?: string | null;
  /** Custom agent bound to the conversation, preserved for the background drain. */
  agentId?: string | null;
  withContext: boolean;
  userText: string;
  attachments?: QueuedAttachment[];
  userId?: string | null;
  /** Preserved so the backgrounded run keeps the user's exact tool/CLI gating. */
  user?: SessionUser | null;
  /**
   * System-generated turn (e.g. the team leader wake-up nudge), not typed by
   * the user: rendered as a system chip in the UI and NEVER passed through the
   * background translation layer (it's an internal instruction).
   */
  auto?: boolean;
  /** Durable identity of an automatic team-result delivery (dedupe on recovery). */
  teamTaskIds?: string[];
  /**
   * cwd forzado del run drenado (worktree de una tarea de equipo): gana sobre
   * project.path manteniendo el contexto del proyecto. Los turnos de
   * retry/diferidos de una tarea aislada deben correr en SU worktree.
   */
  forcedCwd?: string | null;
  /**
   * Profundidad de delegación heredada por el turno drenado. La cadena de
   * `agents.send_message` (A→B→A) se acota con ella: el run entregado la
   * propaga para respetar MAX_DELEGATION_DEPTH. Solo presente en turnos que
   * entrega el listener de mensajes entre agentes.
   */
  delegationDepth?: number;
  /**
   * "approve" cuando el turno encolado responde afirmativamente a un ask
   * `askKind:"plan-approval"`. El drain lo re-valida contra el último turno
   * assistant persistido y, si cuadra, corre con `approvalModeOverride:"manual"`.
   */
  planDecision?: "approve";
  /**
   * Turno inicial de un WORKER de equipo diferido (cupo/lease). El drain lo
   * propaga al registry para que el run no cuente en el cap HTTP por usuario
   * (los workers tienen su propio cupo ASSISTANT_MAX_WORKER_RUNS). Los turnos
   * viejos sin el campo se tratan como turnos de usuario (compatible).
   */
  isWorker?: boolean;
  ts: string;
}

function store(executor?: Executor | null) {
  return dataStore<QueuedTurn>(executor, MODULE, COLLECTION, { idStrategy: "uuid", timestamps: false });
}

export const agentQueueRepository = {
  async listPending(executor: Executor | null | undefined): Promise<QueuedTurn[]> {
    return store(executor).list();
  },

  /** Append a follow-up turn. Returns the created record (with id). */
  async enqueue(executor: Executor | null | undefined, item: Omit<QueuedTurn, "id" | "ts">): Promise<QueuedTurn> {
    return store(executor).create({ ...item, ts: new Date().toISOString() });
  },

  /** Fetch one queued turn by id (full content incl. attachments) — for editing. */
  async get(executor: Executor | null | undefined, id: string): Promise<QueuedTurn | null> {
    return store(executor).get(id) as Promise<QueuedTurn | null>;
  },

  /** Distinct conversationIds that have at least one pending turn. Used after a
   *  panel restart to re-drain chains that were left queued (the in-memory
   *  drainer died with the old process). */
  async listConversationsWithPending(executor: Executor | null | undefined): Promise<string[]> {
    const all = await store(executor).list();
    return [...new Set(all.map((q) => q.conversationId))];
  },

  /** Pending turns for a conversation, oldest first. */
  async listFor(executor: Executor | null | undefined, conversationId: string): Promise<QueuedTurn[]> {
    const all = await store(executor).list();
    return all
      .filter((q) => q.conversationId === conversationId)
      .sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
  },

  /** Remove and return the oldest pending turn for a conversation (or null). */
  async takeNext(executor: Executor | null | undefined, conversationId: string, expectedId?: string): Promise<QueuedTurn | null> {
    const pending = await this.listFor(executor, conversationId);
    const next = pending[0];
    if (!next?.id || (expectedId !== undefined && next.id !== expectedId)) return null;
    return await store(executor).delete(next.id) ? next : null;
  },

  /** Cancel a queued turn by id. */
  async remove(executor: Executor | null | undefined, id: string): Promise<boolean> {
    try {
      return await store(executor).delete(id);
    } catch (err) {
      log.warn({ err: (err as Error).message }, "agent-queue: remove failed");
      return false;
    }
  },

  /** Drop every pending turn for a conversation (e.g. on delete). */
  async clearFor(executor: Executor | null | undefined, conversationId: string): Promise<number> {
    const pending = await this.listFor(executor, conversationId);
    for (const q of pending) if (q.id) await store(executor).delete(q.id).catch(() => undefined);
    return pending.length;
  },
};
