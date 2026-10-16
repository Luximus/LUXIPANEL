// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Turn queue service — the connection-independent half of the agent pipeline.
 *
 * Owns the server-side follow-up queue drain (`drainConversationQueue`), the
 * decoupled run starter (`startConversationRun`) and the team-leader wake-up
 * listener (`initTeamNudgeListener`), plus the persist/translation/usage
 * helpers they share. Extracted from agent.controller.ts: everything here runs
 * WITHOUT a `req`/`res` (background drains, registry `onComplete` chains,
 * event-bus nudges), so it must never import express. The controller keeps the
 * SSE/transport layer and calls into this service.
 */

import { workerRunStarted, workerRunEnded } from "./team-tasks/worker-quota.js";
import { liveVoiceSession } from "./realtime-state.js";
import { agentService } from "./agent.service.js";
import { agentRunRegistry } from "./agent-run-registry.js";
import type { Executor } from "../../../shared/executor/index.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import { conversationsRepository } from "../repositories/conversations.repository.js";
import { agentsRepository } from "../repositories/agents.repository.js";
import type { MessageAttachmentRef } from "../repositories/conversations.repository.js";
import { attachmentsRepository } from "../repositories/attachments.repository.js";
import { agentQueueRepository } from "../repositories/agent-queue.repository.js";
import { agentMessagesRepository } from "../repositories/agent-messages.repository.js";
import type { QueuedAttachment } from "../repositories/agent-queue.repository.js";
import { cliJobsRepository } from "../repositories/cli-jobs.repository.js";
import { teamTasksRepository } from "../repositories/team-tasks.repository.js";
import { teamTasksService } from "./team-tasks.service.js";
import { cliJobTracker } from "./cli-job-tracker.service.js";
import { isTerminalTaskStatus } from "../models/team-task.types.js";
import type { AgentMessage } from "../models/agent-message.types.js";
import { PROVIDER_IDS, type ApprovalMode, type AssistantProviderId } from "../models/assistant-config.types.js";
import type { AskQuestion } from "../models/ask.types.js";
import { stripAskBlock } from "./ask-protocol.js";
import { mintCrossMcpToken, mintGraphMcpToken } from "./mcp-run-tokens.js";
import type { SessionUser } from "../../../shared/types/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";

const log = createModuleLogger("ai-turn-queue");

// Strip ANSI escapes so persisted CLI-mode answers read cleanly on reload.
// eslint-disable-next-line no-control-regex
const ANSI_RE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, "g");

// Per-message content cap. Generous on purpose: a finished CLI turn persists
// its full (clean) command output as the assistant `content`, and that whole
// message is replayed as context on the NEXT send. The old 8 KB cap rejected
// any conversation that had carried a long CLI answer (→ 400 "Invalid request
// body", forcing the user to start a new chat). The frontend mirrors this cap
// (`MAX_MSG_CONTENT` in ChatPane.tsx) and clamps before sending.
import { MAX_MSG_CONTENT, persistAssistantMessage } from "./assistant-message-persistence.js";
export { MAX_MSG_CONTENT, persistAssistantMessage } from "./assistant-message-persistence.js";

/**
 * Persist the user's message (and any attachments) into the conversation
 * IMMEDIATELY when the run starts — not at completion. A long CLI task that
 * the user leaves running can outlive the client connection (mobile WebView
 * frozen on app-switch, then reloaded). If we waited for `onComplete`, the
 * reloaded client would open the conversation to a blank thread because
 * nothing was persisted yet. Saving the user turn up-front guarantees the
 * thread always shows what was asked; the answer is appended later by
 * `persistAssistantMessage`.
 */
export async function persistUserMessage(
  executor: Executor | null,
  conversationId: string,
  content: string,
  provider: string | undefined,
  attachments: QueuedAttachment[] | undefined,
  translation?: { textOriginal: string; lang: string },
): Promise<void> {
  const now = new Date().toISOString();

  // Store attachments on the target so the bubble can render them later.
  let attachmentRefs: MessageAttachmentRef[] = [];
  if (attachments?.length && executor) {
    // storeMany registers the whole batch in ONE atomic index write — a
    // parallel per-file store() races on the shared index map and only the
    // last record survives (the other images then 404 in the bubble).
    attachmentRefs = await attachmentsRepository
      .storeMany(executor, conversationId, attachments)
      .catch((err) => {
        log.warn({ err: (err as Error).message }, "agent: failed to persist attachments");
        // Never turn a voice message into text-only history after a failed save.
        if (attachments.some(a => a.voice)) throw err;
        return [];
      });
  }

  await conversationsRepository
    .appendMessages(executor, conversationId, [
      {
        // `content` is the canonical text sent to the agent — ENGLISH when the
        // background translation layer is active; `textOriginal` keeps the
        // user's own-language text for rendering.
        role: "user",
        ...(provider ? { provider } : {}),
        content,
        ts: now,
        ...(attachmentRefs.length ? { attachments: attachmentRefs } : {}),
        ...(translation ? { textOriginal: translation.textOriginal, lang: translation.lang } : {}),
      },
    ]);
}

/** How many trailing conversation messages to replay as context on a drain. */
const MAX_HISTORY_MESSAGES = 40;

export type AgentTurnMessage = { role: "user" | "assistant"; content: string };

/**
 * Build the outgoing context for a backgrounded (server-drained) turn from the
 * persisted conversation. Mirrors the frontend windowing/clamping so the run
 * stays within provider limits. The just-persisted user turn is the tail.
 */
export async function buildMessagesFromHistory(
  executor: Executor | null,
  conversationId: string,
): Promise<AgentTurnMessage[]> {
  const { items } = await conversationsRepository.messages(executor, conversationId, {
    limit: MAX_HISTORY_MESSAGES,
  });
  return items.map((m) => ({ role: m.role, content: (m.content ?? "").slice(0, MAX_MSG_CONTENT) }));
}

// Extraído a usage-recorder.ts (los workers de equipo lo necesitan sin
// importar este pipeline). Import local + re-export para los llamadores
// existentes (agent.controller y este mismo archivo).
import { makeUsageRecorder } from "./usage-recorder.js";
export { makeUsageRecorder };

/**
 * Start a decoupled run for a conversation via the registry. On completion it
 * persists the assistant answer AND drains the next queued follow-up — this is
 * what keeps the chain going in the background after the client is gone.
 * Reused by POST /agent (live) and by the queue drainer (background).
 */
export function startConversationRun(args: {
  executor: Executor;
  conversationId: string;
  messages: AgentTurnMessage[];
  provider?: AssistantProviderId;
  /** Per-turn model override (in-chat picker). Not persisted by the agent. */
  model?: string;
  effort?: "low" | "medium" | "high" | "xhigh";
  projectId?: string | null;
  /** Custom agent bound to this conversation (system prompt + tools + provider/model). */
  agentId?: string | null;
  withContext: boolean;
  attachments?: QueuedAttachment[];
  user?: SessionUser;
  userId?: string;
  /** cwd forzado (worktree de tarea de equipo) — gana sobre project.path. */
  forcedCwd?: string | null;
  /** Turno inicial de un worker de equipo diferido: el run se registra con
   *  `isWorker` para no consumir el cap HTTP por usuario. */
  isWorker?: boolean;
  /** Cross-server MCP inputs (captured from the request that started the run). */
  panelOrigin?: string;
  crossMcpToken?: string;
  /** Code-graph MCP token (same capture point). Without threading it here, a
   *  QUEUED turn would run with no graph channel at all. */
  graphMcpToken?: string;
  /** Profundidad de delegación heredada: acota la cadena de mensajes/delegación
   *  entre agentes (ver MAX_DELEGATION_DEPTH). */
  delegationDepth?: number;
  /** Modo de aprobación SOLO para este turno (gana sobre config.approval.mode).
   *  Caller: la aprobación de plan (`planDecision:"approve"`) resume con
   *  "auto" para que el turno aprobado ejecute sin otro gate por acción. */
  approvalModeOverride?: ApprovalMode;
  /** Background translation hooks — present only for translated API-mode runs. */
  translate?: {
    lang: string;
    translateText: (englishText: string) => Promise<string>;
    translateTextDetailed?: (englishText: string) => Promise<{ text: string; ok: boolean; error?: string }>;
    translateAsk?: (questions: AskQuestion[]) => Promise<AskQuestion[]>;
  };
}): void {
  const cliHolder = { value: false };
  const tokensHolder = { input: 0, output: 0, estimated: false };
  const recordUsage = makeUsageRecorder({
    executor: args.executor,
    provider: args.provider,
    conversationId: args.conversationId,
    projectId: args.projectId ?? null,
    userId: args.userId ?? null,
    cliHolder,
    tokensHolder,
  });

  void conversationsRepository.patchRuntime(args.executor, args.conversationId, {
    provider: args.provider,
    projectId: args.projectId ?? null,
    agentId: args.agentId ?? null,
    // Persistir el último panelOrigin visto: los turnos DRENADOS (sin Request)
    // lo leen de aquí para no perder el canal cross-MCP (tools team__*).
    ...(args.panelOrigin ? { panelOrigin: args.panelOrigin } : {}),
  }).catch(() => undefined);

  if (args.isWorker) workerRunStarted(args.userId, args.conversationId);
  agentRunRegistry.start({
    key: args.conversationId,
    provider: args.provider,
    projectId: args.projectId ?? null,
    executor: args.executor,
    user: args.user,
    ...(args.isWorker ? { isWorker: true } : {}),
    makeGen: async function* () {
      yield* agentService.run(args.messages, {
        withContext: args.withContext,
        userId: args.userId,
        user: args.user,
        providerId: args.provider,
        model: args.model,
        effort: args.effort,
        projectId: args.projectId ?? undefined,
        agentId: args.agentId ?? undefined,
        conversationId: args.conversationId,
        attachments: args.attachments,
        ...(args.forcedCwd ? { forcedCwd: args.forcedCwd } : {}),
        ...(args.panelOrigin ? { panelOrigin: args.panelOrigin } : {}),
        ...(args.crossMcpToken ? { crossMcpToken: args.crossMcpToken } : {}),
        ...(args.graphMcpToken ? { graphMcpToken: args.graphMcpToken } : {}),
        ...(typeof args.delegationDepth === "number" ? { delegationDepth: args.delegationDepth } : {}),
        ...(args.approvalModeOverride ? { approvalModeOverride: args.approvalModeOverride } : {}),
        // Translation active → the agent must work/answer in English (its
        // output is translated back to the user's language downstream).
        outputEnglish: Boolean(args.translate),
        signal: undefined, // the registry owns the AbortController
      });
    },
    translate: args.translate,
    onEvent: recordUsage,
    onComplete: async (assistantText, errored, ask, translation, durationMs, cliLog, askKind, outcome) => {
      if (args.isWorker) workerRunEnded(args.userId, args.conversationId);
      const tokens =
        tokensHolder.input + tokensHolder.output > 0
          ? {
              input: tokensHolder.input,
              output: tokensHolder.output,
              total: tokensHolder.input + tokensHolder.output,
              ...(tokensHolder.estimated ? { estimated: true } : {}),
            }
          : undefined;
      await persistAssistantMessage(args.executor, args.conversationId, assistantText, args.provider, cliHolder.value, ask, translation, tokens, durationMs, cliLog, askKind, outcome);
      // B2 — auto-captura opt-in: avisa al módulo Obsidian que un turno OK
      // terminó (él decide si el proyecto la tiene habilitada). Captura al vault
      // del proyecto del chat (args.projectId) O, en chats ligados a un agente con
      // `autoCapture`, al vault de su primer proyecto adjunto. Best-effort,
      // fail-open: nunca rompe la persistencia ni el drain.
      let captureProjectId: string | null = args.projectId ?? null;
      if (!captureProjectId && args.agentId) {
        try {
          const ag = await agentsRepository.get(args.agentId);
          if (ag?.autoCapture && ag.projectIds?.length) captureProjectId = ag.projectIds[0] ?? null;
        } catch { /* fail-open: sin captura */ }
      }
      if (!errored && captureProjectId && assistantText.trim()) {
        try {
          // Capture the CLEAN, user-language answer: prefer the translated
          // variant (assistantText is English when translation is active), and
          // strip the ANSI + ask-sentinel block so the vault note reads well.
          const captureText = (translation?.text ?? stripAskBlock(assistantText.replace(ANSI_RE, ""))).slice(0, 4000);
          eventBus.emit(Events.AI_CONVERSATION_COMPLETED, {
            executor: args.executor,
            conversationId: args.conversationId,
            projectId: captureProjectId,
            assistantText: captureText,
            ts: new Date().toISOString(),
          });
        } catch (err) {
          log.warn({ err: (err as Error).message }, "agent: AI_CONVERSATION_COMPLETED emit failed");
        }
      }
      // CLI run finished + persisted in-process → drop its recovery descriptor
      // so a later restart-recovery doesn't re-attach and double-persist.
      if (cliHolder.value) {
        await cliJobsRepository.delete(args.executor, args.conversationId).catch(() => undefined);
      }
      // Chain: kick off the next queued follow-up (if any). Runs inside the
      // executor scope, so it survives the client being gone entirely.
      await drainConversationQueue(args.executor, args.conversationId);
    },
  });
}

/**
 * If no run is active for the conversation, pop the oldest queued follow-up,
 * persist its user message (ordered AFTER the assistant turn that just landed)
 * and start its run. No-op when a run is already active (its own onComplete
 * will drain) or the queue is empty.
 */
export async function drainConversationQueue(executor: Executor, conversationId: string): Promise<void> {
  if (liveVoiceSession(conversationId, executor.target.id) || agentRunRegistry.isActive(conversationId, executor.target.id)) return;
  let next;
  try {
    next = await agentQueueRepository.takeNext(executor, conversationId);
  } catch (err) {
    log.warn({ err: (err as Error).message }, "agent: queue takeNext failed");
    return;
  }
  if (!next) return;

  // Persist queued turns exactly as entered; the agent receives the same text.
  if (next.auto) {
    await conversationsRepository
      .appendMessages(executor, conversationId, [
        { role: "user", provider: next.provider, content: next.userText, ts: new Date().toISOString(), auto: true },
      ])
      .catch((err) => log.warn({ err: (err as Error).message }, "agent: auto-turn persist failed"));
  } else {
    await persistUserMessage(executor, conversationId, next.userText, next.provider, next.attachments);
  }

  const messages = await buildMessagesFromHistory(executor, conversationId);
  if (messages.length === 0) return;

  // Canal MCP en turnos drenados: un run en background no tiene Request de la
  // que derivar `panelOrigin` ni tokens; sin ellos el CLI arranca SIN el canal
  // cross-MCP y las tools `team__*`/`agents.*` desaparecen ("No such tool
  // available") justo en el turno que debe delegar. El origen se lee del meta
  // de la conversación (persistido en cada run vivo) y los tokens se acuñan
  // FRESCOS del SessionUser guardado en el QueuedTurn. Fail-open: sin user o
  // sin origen, el turno corre como antes (sin canal).
  const queuedUser = next.user ?? undefined;
  const panelOrigin = await conversationsRepository
    .getMeta(executor, conversationId)
    .then((m) => m?.panelOrigin)
    .catch(() => undefined);
  const crossMcpToken = mintCrossMcpToken(queuedUser, conversationId);
  const graphMcpToken = mintGraphMcpToken(queuedUser, conversationId);

  // Aprobación de plan encolada: misma validación server-side que el camino
  // vivo (agent.controller) — el último turno assistant debe traer el ask
  // `askKind:"plan-approval"`. Fail-closed: sin validación, el turno drena en
  // modo plan normal.
  let approvalModeOverride: "auto" | undefined;
  if (next.planDecision === "approve") {
    try {
      const all = await conversationsRepository.allMessages(executor, conversationId);
      const lastAssistant = [...all].reverse().find((m) => m.role === "assistant");
      if (lastAssistant?.askKind === "plan-approval" && lastAssistant.ask?.length) {
        approvalModeOverride = "auto";
      }
    } catch { /* fail-closed */ }
  }

  startConversationRun({
    executor,
    conversationId,
    messages,
    provider: next.provider,
    model: next.model,
    effort: next.effort,
    projectId: next.projectId ?? null,
    agentId: next.agentId ?? null,
    withContext: next.withContext,
    attachments: next.attachments,
    user: next.user ?? undefined,
    userId: next.userId ?? undefined,
    forcedCwd: next.forcedCwd ?? null,
    ...(next.isWorker ? { isWorker: true } : {}),
    ...(typeof next.delegationDepth === "number" ? { delegationDepth: next.delegationDepth } : {}),
    ...(approvalModeOverride ? { approvalModeOverride } : {}),
    ...(panelOrigin ? { panelOrigin } : {}),
    ...(crossMcpToken ? { crossMcpToken } : {}),
    ...(graphMcpToken ? { graphMcpToken } : {}),
  });
}

// ── Team leader wake-up (nudge) ─────────────────────────────────────────────

let teamNudgeListenerWired = false;

/**
 * Wire the AI_TEAM_LEADER_NUDGE listener (once, from registerAiModule): when
 * every task a leader delegated (team.assign) finishes while the leader has no
 * live run and no team.collect waiting, team-tasks.service emits this event;
 * here we enqueue an AUTOMATIC follow-up turn (`auto: true`) on the leader's
 * conversation and drain it — the leader wakes up, collects the results
 * (team.collect waitSeconds 0), synthesizes and delivers the final answer in
 * its own chat. Lives in this service alongside the drain pipeline
 * (translation/persist/run) — services must not import controllers. The queued
 * turn carries the SNAPSHOTTED user of the original assignment, so the wake-up
 * keeps the exact tool/CLI gating (no escalation).
 */
export function initTeamNudgeListener(): void {
  if (teamNudgeListenerWired) return;
  teamNudgeListenerWired = true;
  eventBus.on(
    Events.AI_TEAM_LEADER_NUDGE,
    (payload: {
      executor: Executor;
      leaderConversationId: string;
      leaderAgentId: string;
      userId?: string;
      user?: SessionUser;
      taskIds: string[];
    }) => {
      void (async () => {
        const { executor, leaderConversationId } = payload;
        const meta = await conversationsRepository.getMeta(executor, leaderConversationId);
        if (!meta) return;
        const provider = (PROVIDER_IDS as readonly string[]).includes(meta.provider)
          ? (meta.provider as (typeof PROVIDER_IDS)[number])
          : undefined;
        // Inline the results in the nudge itself (budgeted) instead of telling
        // the leader to team.collect: saves the tool round-trip and works even
        // si el canal MCP faltara. (El drain ahora SÍ re-acuña el canal cross —
        // panelOrigin del meta + tokens frescos del user encolado — así que el
        // líder puede además delegar follow-ups con team.* en este turno.)
        // The tasks are marked collected so the watcher can't re-nudge them.
        const wanted = new Set(payload.taskIds);
        const tasks = (await teamTasksRepository.listForLeaderConversation(executor, leaderConversationId)).filter(
          (t) => t.id && wanted.has(t.id),
        );
        const PER_TASK = 3_000;
        const TOTAL = 12_000;
        let spent = 0;
        const lines = tasks.map((t, i) => {
          const raw = ((t.status === "done" ? t.resultSummary : t.error) ?? "").trim() || "(sin detalle)";
          const room = Math.max(0, Math.min(PER_TASK, TOTAL - spent));
          const text = raw.length > room ? raw.slice(0, room) + "…[recortado — detalle completo en el chat del agente]" : raw;
          spent += text.length;
          const outcome = t.status === "done" ? "OK" : t.status === "canceled" ? "CANCELADA" : "FALLÓ";
          return `${i + 1}. «${t.title}» (${t.workerAgentName}) — ${outcome}:\n${text}`;
        });
        const userText =
          "[EQUIPO] Tus subordinados terminaron las tareas delegadas. Resultados:\n\n" +
          lines.join("\n\n") +
          "\n\nSintetiza y entrega al usuario la respuesta final consolidada (breve y accionable; NO pegues la salida cruda).";
        await agentQueueRepository.enqueue(executor, {
          conversationId: leaderConversationId,
          ...(provider ? { provider } : {}),
          projectId: meta.projectId ?? null,
          agentId: meta.agentId ?? payload.leaderAgentId ?? null,
          withContext: true,
          userText,
          userId: payload.userId ?? null,
          user: payload.user ?? null,
          auto: true,
        });
        await teamTasksService.markCollected(
          executor,
          tasks.map((t) => t.id ?? "").filter(Boolean),
        );
        await drainConversationQueue(executor, leaderConversationId);
      })().catch((err) => log.warn({ err: (err as Error).message }, "agent: team leader nudge failed"));
    },
  );
}

// ── Entrega de mensajes asíncronos agente↔agente ────────────────────────────

let agentMessageListenerWired = false;

/** Título del buzón de un par emisor→destinatario (solo al crearlo). */
function mailboxTitle(fromName: string, text: string): string {
  const summary = text.replace(/\s+/g, " ").trim().slice(0, 80);
  return `Handoff de ${fromName}: ${summary}`;
}

export type AgentMessageDeliveryTarget = {
  conversationId: string;
  projectId: string | null;
  /** Provider of the target chat (its meta) — null when unknown/new. */
  provider: string | null;
  kind: "team-leader" | "team-worker" | "active-run" | "mailbox" | "new-mailbox";
};

/**
 * Where an agent→agent message must land. Order matters — a message must
 * NEVER open a new chat while the pair has a team relation or the recipient is
 * running (2026-08-25: a worker's `agents.send_message` to its leader spawned a
 * fresh "Handoff" chat + CLI session while the leader was mid team.collect):
 *   1. worker → leader: the LEADER's team chat (task.leaderConversationId),
 *      even if the task already finished (that chat is the team's context);
 *   2. leader → worker: the worker's task chat (most recent open task, else
 *      the most recent one);
 *   3. recipient has a live run: that conversation;
 *   4. the pair's existing mailbox (most recent delivery whose chat survives);
 *   null → the caller creates a mailbox.
 */
export async function resolveAgentMessageDelivery(
  executor: Executor,
  message: AgentMessage,
): Promise<AgentMessageDeliveryTarget | null> {
  const metaOf = (id: string) => conversationsRepository.getMeta(executor, id).catch(() => null);
  const senderConv = message.senderConversationId ?? null;
  if (senderConv) {
    // 1. Worker → leader.
    const task = await teamTasksRepository.findByWorkerConversation(executor, senderConv).catch(() => null);
    if (task?.leaderAgentId === message.toAgentId && task.leaderConversationId) {
      const meta = await metaOf(task.leaderConversationId);
      if (meta) {
        return { conversationId: task.leaderConversationId, projectId: meta.projectId ?? null, provider: meta.provider ?? null, kind: "team-leader" };
      }
    }
    // 2. Leader → worker.
    const tasks = (await teamTasksRepository.listForLeaderConversation(executor, senderConv).catch(() => [])).filter(
      (t) => t.workerAgentId === message.toAgentId && !!t.workerConversationId,
    );
    if (tasks.length) {
      const open = tasks.filter((t) => !isTerminalTaskStatus(t.status));
      const pick = [...(open.length ? open : tasks)].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))[0]!;
      const meta = await metaOf(pick.workerConversationId);
      if (meta) {
        return { conversationId: pick.workerConversationId, projectId: meta.projectId ?? null, provider: meta.provider ?? null, kind: "team-worker" };
      }
    }
  }
  // 3. Recipient with a live run.
  for (const run of agentRunRegistry.activeRuns()) {
    if (run.targetId !== executor.target.id) continue;
    const meta = await metaOf(run.key);
    if (meta?.agentId && meta.agentId === message.toAgentId) {
      return { conversationId: run.key, projectId: meta.projectId ?? null, provider: meta.provider ?? null, kind: "active-run" };
    }
  }
  // 4. Existing mailbox of this ordered pair.
  const pair = await agentMessagesRepository.listForPair(executor, message.fromAgentId, message.toAgentId);
  for (const prior of [...pair].reverse()) {
    if (!prior.deliveryConversationId) continue;
    const meta = await metaOf(prior.deliveryConversationId);
    if (meta) {
      return { conversationId: prior.deliveryConversationId, projectId: meta.projectId ?? null, provider: meta.provider ?? null, kind: "mailbox" };
    }
  }
  return null;
}

/**
 * Wire the AI_AGENT_MESSAGE listener (once, from registerAiModule): an agent
 * sent a persistent requirement to a RELATED agent (`agents.send_message`).
 * Here we DELIVER it: (1) resolve/create the recipient's MAILBOX for this
 * ordered pair, (2) enqueue an AUTOMATIC turn carrying the SENDER's user
 * snapshot (no privilege escalation) with delegationDepth = message.hops, so
 * the chain stays bounded, (3) mark `delivered` BEFORE the drain (the drain's
 * AI_CHAT_FINISHED listener may close it as `read`; terminal states are
 * idempotent), (4) drain → wakes a powered-down recipient. Lives here (not in
 * agent-messages.service) for the same anti-cycle reason as the team nudge:
 * that service can't import drainConversationQueue.
 */
export function initAgentMessageListener(): void {
  if (agentMessageListenerWired) return;
  agentMessageListenerWired = true;
  eventBus.on(
    Events.AI_AGENT_MESSAGE,
    (payload: {
      executor: Executor;
      messageId: string;
      fromAgentId: string;
      toAgentId: string;
      userId?: string | null;
      user?: SessionUser | null;
    }) => {
      const { executor, messageId } = payload;
      if (!executor || !messageId) return;
      void (async () => {
        const message = await agentMessagesRepository.get(executor, messageId);
        // Already delivered/read (retry or duplicate emit) → nothing to do.
        if (!message?.id || message.status !== "pending") return;

        const recipient = await agentsRepository.get(message.toAgentId).catch(() => null);
        if (!recipient?.id) {
          await agentMessagesRepository.update(executor, message.id, {
            status: "failed",
            error: `El agente destinatario "${message.toAgentId}" ya no existe.`,
          });
          return;
        }

        // 1. Destino: chat de equipo / run activo del destinatario / buzón del
        //    par. Solo se CREA un buzón cuando nada de lo anterior aplica —
        //    nunca un chat nuevo mientras hay relación de equipo o run en curso.
        const resolved = await resolveAgentMessageDelivery(executor, message);
        let target: AgentMessageDeliveryTarget;
        if (resolved) {
          target = resolved;
        } else {
          const created = await conversationsRepository.create(
            executor,
            recipient.providerId,
            mailboxTitle(message.fromAgentName, message.text),
            null,
            recipient.id,
          );
          target = { conversationId: String(created.id), projectId: null, provider: null, kind: "new-mailbox" };
        }
        const isTeamChat = target.kind === "team-leader" || target.kind === "team-worker";

        // 2. Texto del turno para el destinatario (snapshot de usuario del EMISOR).
        const userText =
          `[MENSAJE DE ${message.fromAgentName} (agente ${message.fromAgentId})]\n` +
          `${message.text}\n\n` +
          (isTeamChat
            ? `Este mensaje llega a tu chat de equipo; contesta aquí o con ` +
              `\`agents.send_message\` hacia ${message.fromAgentName} (agentId ${message.fromAgentId}).`
            : `Atiende este requerimiento en este chat. Si necesitas responderle, usa ` +
              `\`agents.send_message\` hacia ${message.fromAgentName} (agentId ` +
              `${message.fromAgentId}) — no asumas que puede ver este chat.`);
        const provider = (PROVIDER_IDS as readonly string[]).includes(target.provider ?? "")
          ? (target.provider as AssistantProviderId)
          : recipient.providerId;

        // 3. Run en curso en el destino → steering en vivo (FIFO de la CLI):
        //    el agente lo lee en el mismo turno; NO se encola (evita duplicar).
        //    Se persiste como mensaje `auto` para que quede en el historial.
        if (agentRunRegistry.isActive(target.conversationId)) {
          const steered = await cliJobTracker
            .steerConversation(target.conversationId, userText)
            .catch(() => false);
          if (steered) {
            await conversationsRepository
              .appendMessages(executor, target.conversationId, [
                { role: "user", provider, content: userText, ts: new Date().toISOString(), auto: true },
              ])
              .catch(() => undefined);
            await agentMessagesRepository.update(executor, message.id, {
              status: "delivered",
              deliveredAt: new Date().toISOString(),
              deliveryConversationId: target.conversationId,
            });
            log.info(
              { messageId: message.id, toAgentId: message.toAgentId, conversationId: target.conversationId, kind: target.kind },
              "agent-message: steered into live run",
            );
            return;
          }
        }

        // 4. Sin steering posible → turno automático en el destino. Si hay run
        //    activo, `drainConversationQueue` no hace nada y el onComplete del
        //    run drena la cola al terminar (agent.controller).
        await agentQueueRepository.enqueue(executor, {
          conversationId: target.conversationId,
          provider,
          projectId: target.projectId,
          agentId: recipient.id,
          withContext: true,
          userText,
          userId: message.userId ?? payload.userId ?? null,
          user: message.user ?? payload.user ?? null,
          auto: true,
          delegationDepth: message.hops,
        });

        // 5. Mark delivered BEFORE the drain (the drain can close it as `read`).
        await agentMessagesRepository.update(executor, message.id, {
          status: "delivered",
          deliveredAt: new Date().toISOString(),
          deliveryConversationId: target.conversationId,
        });

        // 6. Drain → wakes the recipient when it has no live run.
        await drainConversationQueue(executor, target.conversationId);
        log.info(
          { messageId: message.id, toAgentId: message.toAgentId, conversationId: target.conversationId, kind: target.kind },
          "agent-message: delivered",
        );
      })().catch(async (err) => {
        log.warn({ err: (err as Error).message, messageId }, "agent-message: delivery failed");
        await agentMessagesRepository
          .update(executor, messageId, { status: "failed", error: (err as Error).message })
          .catch(() => undefined);
      });
    },
  );
}

// ── Despacho diferido de tareas de equipo ───────────────────────────────────

let teamDispatchListenerWired = false;

/**
 * Wire the AI_TEAM_TASK_DISPATCH listener (once, from registerAiModule): a
 * deferred team task (lease/cupo) became eligible — its initial turn is
 * already persisted in agent-queue, so just drain the worker conversation.
 * Vive aquí por la misma razón que el nudge: team-tasks no puede importar
 * drainConversationQueue sin ciclo.
 */
export function initTeamDispatchListener(): void {
  if (teamDispatchListenerWired) return;
  teamDispatchListenerWired = true;
  eventBus.on(
    Events.AI_TEAM_TASK_DISPATCH,
    (payload: { executor: Executor; taskId: string; workerConversationId: string }) => {
      void drainConversationQueue(payload.executor, payload.workerConversationId).catch((err) =>
        log.warn({ err: (err as Error).message, taskId: payload.taskId }, "agent: team task dispatch drain failed"),
      );
    },
  );
}

// ── Reintento de verificación de tareas de equipo ───────────────────────────

let teamVerifyRetryListenerWired = false;

/**
 * Wire the AI_TEAM_TASK_VERIFY_RETRY listener (once, from registerAiModule):
 * the verify gate failed with retries left — enqueue an AUTOMATIC correction
 * turn on the WORKER's conversation (with the failure log + the task's
 * worktree cwd + the SNAPSHOTTED user, never escalating gating) and drain it.
 * Cuando ese turno termina, AI_CHAT_FINISHED vuelve a cerrar la tarea a través
 * del gate → converge (pasa / reintenta / agota → failed).
 */
export function initTeamVerifyRetryListener(): void {
  if (teamVerifyRetryListenerWired) return;
  teamVerifyRetryListenerWired = true;
  eventBus.on(
    Events.AI_TEAM_TASK_VERIFY_RETRY,
    (payload: {
      executor: Executor;
      taskId: string;
      workerConversationId: string;
      workerAgentId: string;
      projectId?: string | null;
      forcedCwd?: string | null;
      userId?: string | null;
      user?: SessionUser | null;
      failedCommand?: string;
      exitCode?: number;
      logTail: string;
      attempt: number;
      maxAttempts: number;
    }) => {
      const { executor, workerConversationId } = payload;
      void (async () => {
        const cwdNote = payload.forcedCwd ? `EN ${payload.forcedCwd}` : "en el directorio del proyecto";
        const userText =
          `[VERIFICACIÓN AUTOMÁTICA] Tu trabajo no pasó la verificación (intento ${payload.attempt} de ${payload.maxAttempts}).\n` +
          `Comando fallido: ${payload.failedCommand || "?"}${payload.exitCode !== undefined ? ` (exit ${payload.exitCode})` : ""}\n` +
          "--- salida (final) ---\n" +
          payload.logTail +
          "\n--- fin ---\n" +
          `Corrige el problema ${cwdNote} y deja el proyecto pasando esos comandos. No repitas trabajo ya hecho; ` +
          "haz commit de tus correcciones al terminar.";
        await agentQueueRepository.enqueue(executor, {
          conversationId: workerConversationId,
          userText,
          agentId: payload.workerAgentId || null,
          projectId: payload.projectId ?? null,
          withContext: true,
          userId: payload.userId ?? null,
          user: payload.user ?? null,
          auto: true,
          forcedCwd: payload.forcedCwd ?? null,
        });
        await drainConversationQueue(executor, workerConversationId);
      })().catch((err) =>
        log.warn({ err: (err as Error).message, taskId: payload.taskId }, "agent: team verify retry failed"),
      );
    },
  );
}
