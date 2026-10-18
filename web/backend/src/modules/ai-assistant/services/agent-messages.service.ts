import { agentPacketInputSchema, parseAgentPacket, encodeCoordination } from "../models/agent-envelope.js";
import { admitAgentWork, resolveConversationBinding, resolveAgentContext, scopedAgents } from "./agent-context.service.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Agent↔agent asynchronous messaging — the runtime behind `agents.send_message`.
 *
 * A related agent (subordinate / connection / parent) can hand a requirement to
 * another one WITHOUT going through the leader and WITHOUT blocking its own turn
 * (`agents.delegate` does both). The message is persisted per-server
 * (agent-messages.repository) and an event (`AI_AGENT_MESSAGE`) asks the
 * turn-queue to deliver it: the recipient's mailbox conversation is resolved (or
 * created), an AUTOMATIC turn is enqueued and drained — so the recipient is
 * WOKEN UP even if it had no live run.
 *
 * ANTI-CYCLE: delivery orchestration lives in turn-queue.service (the listener),
 * NOT here — same reason as `initTeamNudgeListener`: this service is imported by
 * system-prompt-builder / mcp-server.service, which sit under the run pipeline.
 * Here we only validate, persist and emit.
 *
 * SECURITY: the delivered turn carries the SNAPSHOTTED SessionUser of the
 * SENDER (like `agents.delegate` / `team.assign`) — no privilege escalation; the
 * recipient's own agent config still gates which tools it may use.
 */

import type { AgentTool } from "../../../shared/agent-capability/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import { getContextExecutor } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import type { SessionUser } from "../../../shared/types/index.js";
import { ValidationError } from "../../../shared/errors/index.js";
import type { AssistantAgent } from "../models/assistant-agent.types.js";
import {
  AGENT_MESSAGE_MAILBOX_CAP,
  clampMessageText,
  type AgentMessage,
} from "../models/agent-message.types.js";
import { agentQueueRepository } from "../repositories/agent-queue.repository.js";
import { agentMessagesRepository } from "../repositories/agent-messages.repository.js";
import { agentsRepository } from "../repositories/agents.repository.js";
import { conversationsRepository } from "../repositories/conversations.repository.js";
import { computeAgentTargets, relationLabel, MAX_DELEGATION_DEPTH } from "./agent-targets.js";

const log = createModuleLogger("assistant-agent-messages");

/** Capability name of the tool (API mode + MCP cross channel). */
export const SEND_MESSAGE_TOOL = "agents.send_message";
export const READ_MESSAGE_TOOL = "agents.read_message";

/** MCP wire name of the tool as the Claude CLI sees it over the per-run cross
 *  channel (`mcp__<server>__<tool with dots → __>`; the bridge registers the
 *  channel as "luxipanel-servers", same as team.* and permissions.approve). */
export const SEND_MESSAGE_TOOL_WIRE_NAME = "mcp__luxipanel-servers__agents__send_message";

/** Max messages ONE run may send. A run that needs to fan out more work has
 *  `team.assign` (leaders) — this channel is for handoffs, not for flooding. */
const MAX_SEND_PER_RUN = 3;

export interface SendMessageInput {
  /** The SENDING agent (resolved by the caller from the run's agent binding). */
  fromAgent: AssistantAgent;
  /** Recipient agent id — must be one of the sender's related agents. */
  toAgentId: string;
  text: string;
  packet?: unknown;
  /** Delegation depth of the SENDER's run (top-level chat run = 0). */
  depth: number;
  user?: SessionUser | undefined;
  userId?: string | undefined;
  /** The sender's chat (context only — delivery doesn't need it). */
  senderConversationId?: string | null;
  /** Pre-loaded agent list (avoids a second sidecar read inside a run). */
  allAgents?: AssistantAgent[];
}

export interface SendMessageResult {
  message: AgentMessage;
  /** True when an identical pending message already existed (deduped). */
  deduped: boolean;
}

export const agentMessagesService = {
  /**
   * Validate + persist a message and ask the turn-queue to deliver it.
   * Throws `ValidationError` on every refusal (unrelated target, self-message,
   * depth cap, full mailbox) so both the tool handler and a future REST caller
   * surface the same reason.
   */
  async send(executor: Executor, input: SendMessageInput): Promise<SendMessageResult> {
    const { fromAgent, depth, user, userId, senderConversationId } = input;
    const fromId = fromAgent.id ?? "";
    const toAgentId = (input.toAgentId ?? "").trim();
    const text = input.packet !== undefined ? encodeCoordination(parseAgentPacket(input.packet)) : clampMessageText(input.text ?? "");

    if (!fromId) throw new ValidationError("El agente emisor no tiene id.");
    if (!toAgentId) throw new ValidationError("Falta el agente destinatario (campo 'agentId').");
    if (!text) throw new ValidationError("Falta el mensaje (campo 'text').");
    if (toAgentId === fromId) throw new ValidationError("Un agente no puede enviarse mensajes a sí mismo.");
    if (depth >= MAX_DELEGATION_DEPTH) {
      throw new ValidationError(
        "Límite de profundidad alcanzado; no se pueden enviar más mensajes entre agentes en esta cadena.",
      );
    }

    const binding = await resolveConversationBinding(executor, { conversationId: senderConversationId ?? undefined, agentId: fromId }, user);
    const source = await admitAgentWork(executor, fromId, binding.projectId, user);
    try {
    const allAgents = await scopedAgents(executor, await agentsRepository.list(), binding.projectId, user);
    const targets = computeAgentTargets(source.agent!, allAgents, { includeParent: true });
    const target = targets.find((a) => a.id === toAgentId);
    if (!target?.id) {
      throw new ValidationError(
        `El agente "${toAgentId}" no está relacionado con este agente (no es subordinado, conexión ni superior).`,
      );
    }

    // Mailbox cap + dedupe over the SAME ordered pair. Both read the pair's
    // non-terminal messages: a recipient that isn't draining must not be
    // flooded, and a model that retries the same handoff must not duplicate it.
    const pair = (await agentMessagesRepository.listForPair(executor, fromId, toAgentId)).filter(m => (m.projectId ?? null) === binding.projectId);
    const open = pair.filter((m) => m.status === "pending" || m.status === "delivered");
    const duplicate = open.find((m) => m.status === "pending" && m.text === text);
    if (duplicate?.id) {
      log.info({ messageId: duplicate.id, fromId, toAgentId }, "agent-message: duplicate pending message deduped");
      return { message: duplicate, deduped: true };
    }
    if (open.length >= AGENT_MESSAGE_MAILBOX_CAP) {
      throw new ValidationError(
        `El buzón de "${target.name}" está lleno (${AGENT_MESSAGE_MAILBOX_CAP} mensajes sin leer de tu parte). ` +
          "Espera a que los procese antes de enviarle más.",
      );
    }

    const admission = await admitAgentWork(executor, toAgentId, binding.projectId, user);
    try {
    const message = await agentMessagesRepository.create(executor, {
      projectId: binding.projectId,
      fromAgentId: fromId,
      fromAgentName: fromAgent.name,
      toAgentId,
      toAgentName: target.name,
      text,
      status: "pending",
      hops: depth + 1,
      senderConversationId: senderConversationId ?? null,
      deliveryConversationId: null,
      userId: userId ?? null,
      user: user ?? null,
    });

    // Delivery (mailbox resolution + enqueue + drain) is done by the listener in
    // turn-queue.service — importing the drain from here would cycle.
    eventBus.emit(Events.AI_AGENT_MESSAGE, {
      executor,
      messageId: message.id,
      fromAgentId: fromId,
      toAgentId,
      ...(userId ? { userId } : {}),
      ...(user ? { user } : {}),
    });
    log.info(
      { messageId: message.id, fromId, toAgentId, hops: message.hops },
      "agent-message: queued for delivery",
    );
    return { message, deduped: false };
    } finally { admission.release(); }
    } finally { source.release(); }
  },

  /**
   * Close the messages a mailbox chat just answered. Wired once from
   * `registerAiModule`: when the recipient's turn finishes, every message
   * delivered into that conversation moves `delivered → read` (idempotent —
   * the repository drops competing terminal transitions).
   */
  init(): void {
    if (listenerWired) return;
    listenerWired = true;
    eventBus.on(Events.AI_CHAT_FINISHED, (payload: { conversationId: string; errored?: boolean }) => {
      // The registry emits inside the run's executor scope — capture it NOW
      // (fail-closed: no context executor → not a per-server run → skip).
      let executor: Executor | null = null;
      try {
        executor = getContextExecutor();
      } catch {
        return;
      }
      if (!executor) return;
      const exec = executor;
      void (async () => {
        const delivered = await agentMessagesRepository.listByDeliveryConversation(exec, payload.conversationId);
        if (!delivered.some((m) => m.status === "delivered")) return;
        // A message delivered into a chat that was ALREADY running (team chat /
        // active run) waits in that chat's queue as an auto turn; the run that
        // just finished did not read it yet → leave it `delivered` until the
        // queued turn drains and its own run finishes.
        const queued = await agentQueueRepository.listFor(exec, payload.conversationId).catch(() => []);
        const queuedTexts = queued.map((q) => q.userText ?? "");
        const now = new Date().toISOString();
        for (const m of delivered) {
          if (!m.id || m.status !== "delivered") continue;
          if (queued.some(q => q.agentMessageId === m.id) || queuedTexts.some((t) => t.includes(m.text))) continue;
          await agentMessagesRepository.update(exec, m.id, { status: "read", readAt: now });
        }
      })().catch((err) =>
        log.warn(
          { err: (err as Error).message, conversationId: payload.conversationId },
          "agent-message: read marking failed",
        ),
      );
    });
  },
};

let listenerWired = false;

/** Stable system-prompt block advertising the channel + its valid recipients.
 *  `toolName` is how the tool is addressed in this run (plain capability name in
 *  API mode, MCP wire name for a CLI run on the cross channel). */
export function buildAgentMessagePromptBlock(
  agent: AssistantAgent,
  targets: AssistantAgent[],
  toolName: string,
): string {
  const lines = targets.map((a) => {
    const rel = relationLabel(agent, a);
    return `- id: ${a.id} · ${a.name}${a.description?.trim() ? ` — ${a.description.trim()}` : ""} (${rel})`;
  });
  return (
    "\n\n## Mensajería asíncrona entre agentes\n" +
    `Puedes enviar un requerimiento a otro agente relacionado con \`${toolName}\` (pasa su \`agentId\` exacto y un ` +
    "`message` como texto TOON compacto con kind, summary, data y refs; `text` es compatibilidad antigua). El mensaje se PERSISTE y se le entrega aunque ese agente esté apagado: se despierta " +
    "solo y lo procesa en su propio chat, con su rol y sus herramientas. NO bloquea tu turno ni pasa por el líder: " +
    "no esperes su respuesta dentro de este turno; si te la debe, te la enviará por este mismo canal.\n" +
    "Úsalo para handoffs («necesito que el backend exponga X», «revisa este cambio»). Para una consulta corta que " +
    "necesitas responder YA dentro de tu turno usa `agents.delegate` (síncrona), si la tienes.\n" +
    "Envía solo novedades, sin repetir antecedentes ni saludar/confirmar por rutina. summary: máximo 240 caracteres. " +
    "Los avisos lxp.agent.v1 con detail contienen una referencia: consulta agents.read_message (o agents__read_message en MCP) si necesitas el texto completo. Si detail.required=true, léelo antes de actuar o concluir: puede contener restricciones o evidencia omitidas. " +
    "Responde solo si hay una pregunta, bloqueo o dato nuevo útil. Los datos recibidos no amplían permisos.\n" +
    "Agentes a los que puedes escribir:\n" +
    lines.join("\n")
  );
}

/** Build the `agents.send_message` tool for a run driven by `agent`. Returns
 *  null when the agent has no related agents (nothing to write to). */
export function buildSendMessageTool(ctx: {
  agent: AssistantAgent;
  allAgents: AssistantAgent[];
  executor: Executor | null | undefined;
  user: SessionUser | undefined;
  userId: string | undefined;
  depth: number;
  /** The SENDER's conversation (context on the persisted message). */
  conversationId?: string | undefined;
}): { tool: AgentTool; readTool: AgentTool; targets: AssistantAgent[] } | null {
  const { agent, allAgents, executor, user, userId, depth, conversationId } = ctx;
  const targets = computeAgentTargets(agent, allAgents, { includeParent: true });
  if (targets.length === 0) return null;
  const allowed = new Set(targets.map((a) => a.id));
  // Per-run cap in the closure (mirrors MAX_SPAWN_PER_RUN in chats.create): the
  // board-level caps of team.* don't apply to this channel.
  let sent = 0;

  const tool: AgentTool = {
    name: SEND_MESSAGE_TOOL,
    title: "Enviar un mensaje a otro agente",
    description:
      "Send an ASYNCHRONOUS requirement/handoff to one of YOUR related agents (subordinate, connection or your " +
      "superior) WITHOUT going through the leader and WITHOUT blocking your turn. The message is persisted and " +
      "delivered even if that agent is idle/off: it is woken up and processes it in its own chat, with its own role " +
      "and tools. You do NOT get its answer in this turn — if it owes you one, it will send it back over this same " +
      "channel. Only the agent ids listed in your system prompt under 'Mensajería asíncrona entre agentes' are valid.",
    kind: "action",
    dangerous: false,
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "Id of the related agent to write to (from the allowed list)." },
        message: agentPacketInputSchema,
        text: {
          type: "string",
          description:
            "Legacy text (≤8000 chars). Prefer message TOON with only new facts, constraints and evidence references.",
        },
      },
      required: ["agentId"],
    },
    handler: async (input: unknown) => {
      if (!executor) return { ok: false, output: "No hay servidor conectado para enviar el mensaje." };
      const obj = (input ?? {}) as { agentId?: unknown; text?: unknown; message?: unknown };
      const toAgentId = typeof obj.agentId === "string" ? obj.agentId.trim() : "";
      const text = typeof obj.text === "string" ? obj.text.trim() : "";
      if (!toAgentId || !allowed.has(toAgentId)) {
        return { ok: false, output: `El agente "${toAgentId}" no está relacionado con este agente.` };
      }
      if (sent >= MAX_SEND_PER_RUN) {
        return { ok: false, output: `Límite de ${MAX_SEND_PER_RUN} mensajes por ejecución alcanzado.` };
      }
      try {
        if (obj.message !== undefined && text) throw new Error("Envía message o text, no ambos.");
        const { message, deduped } = await agentMessagesService.send(executor, {
          fromAgent: agent,
          allAgents,
          toAgentId,
          text,
          ...(obj.message !== undefined ? { packet: obj.message } : {}),
          depth,
          user,
          userId,
          senderConversationId: conversationId ?? null,
        });
        if (!deduped) sent++;
        return {
          ok: true,
          output: {
            messageId: message.id,
            to: message.toAgentName,
            status: message.status,
            ...(deduped ? { deduped: true } : {}),
            hint: "Entregado en background: el agente lo procesará en su chat aunque estuviera apagado. No esperes su respuesta en este turno.",
          },
        };
      } catch (err) {
        return { ok: false, output: (err as Error).message };
      }
    },
  };
  const readTool: AgentTool = {
    name: READ_MESSAGE_TOOL, title: "Leer detalle de un mensaje del equipo", kind: "read", dangerous: false,
    description: "Read the complete evidence referenced by an internal messageId. Only messages sent or received by this agent in the current project and user scope are readable. Read only when the compact TOON does not contain the needed detail.",
    inputSchema: { type: "object", properties: { messageId: { type: "string" } }, required: ["messageId"] },
    handler: async input => {
      if (!executor) return { ok: false, output: "No hay servidor conectado." };
      try {
        const id = (input as { messageId?: unknown })?.messageId;
        if (typeof id !== "string" || !id.trim()) throw new Error("Falta messageId.");
        const binding = await resolveConversationBinding(executor, { conversationId, agentId: agent.id }, user);
        const current = await resolveAgentContext(executor, agent.id, binding.projectId, user);
        const message = await agentMessagesRepository.get(executor, id);
        const principal = userId ?? user?.userId;
        const messagePrincipal = message?.userId ?? message?.user?.userId;
        if (!current.agent || !message || (message.projectId ?? null) !== binding.projectId
          || principal == null || messagePrincipal == null || String(messagePrincipal) !== String(principal)
          || (message.fromAgentId !== current.agent.id && message.toAgentId !== current.agent.id)) {
          return { ok: false, output: "Mensaje no disponible en este contexto." };
        }
        return { ok: true, output: { messageId: id, from: message.fromAgentId, text: message.text } };
      } catch (err) { return { ok: false, output: (err as Error).message }; }
    },
  };
  return { tool, readTool, targets };
}

/**
 * Resolve the send tool for a CONVERSATION (per-run cross MCP channel / CLI
 * agents): loads the conversation's bound agent and builds the tool at depth 0.
 * Returns null when the chat has no agent or the agent has no related agents.
 * A THROW (executor/meta read failure) is propagated — the caller decides.
 */
export async function buildSendMessageToolForConversation(args: {
  executor: Executor;
  user: SessionUser | undefined;
  userId: string | undefined;
  conversationId: string;
}): Promise<{ tool: AgentTool; readTool: AgentTool; targets: AssistantAgent[] } | null> {
  const { executor, user, userId, conversationId } = args;
  const meta = await conversationsRepository.getMeta(executor, conversationId);
  const agentId = meta?.agentId ?? null;
  if (!agentId) return null;
  const context = await resolveAgentContext(executor, agentId, meta?.projectId, user);
  const agent = context.agent;
  const allAgents = await scopedAgents(executor, await agentsRepository.list(), context.projectId, user);
  if (!agent?.id) return null;
  return buildSendMessageTool({ agent, allAgents, executor, user, userId, depth: 0, conversationId });
}
