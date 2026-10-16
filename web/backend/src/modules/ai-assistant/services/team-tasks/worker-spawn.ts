// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Worker spawning — the pieces shared by `chats.create` (fire-and-forget) and
 * `team.assign`: create the worker's persisted chat and start its run in the
 * agent-run-registry (usage recorder + worker quota + fresh MCP tokens). Does
 * NOT own the TeamTask lifecycle (that lives in ./lifecycle + the service).
 */

import type { Executor } from "../../../../shared/executor/index.js";
import type { SessionUser } from "../../../../shared/types/index.js";
import { createModuleLogger } from "../../../../shared/logger/index.js";
import { agentRunRegistry } from "../agent-run-registry.js";
import { mintCrossMcpToken, mintGraphMcpToken } from "../mcp-run-tokens.js";
import { persistAssistantMessage } from "../assistant-message-persistence.js";
import { makeUsageRecorder } from "../usage-recorder.js";
import { projectClosure } from "../project-closure.js";
import { assistantConfigRepository } from "../../repositories/assistant-config.repository.js";
import { cliJobsRepository } from "../../repositories/cli-jobs.repository.js";
import { conversationsRepository } from "../../repositories/conversations.repository.js";
import { projectsRepository } from "../../repositories/projects.repository.js";
import type { AssistantAgent } from "../../models/assistant-agent.types.js";
import type { AssistantProviderId } from "../../models/assistant-config.types.js";
import type { AgentEvent, AgentMessage } from "../providers/provider.types.js";
import { workerRunStarted, workerRunEnded } from "./worker-quota.js";

const log = createModuleLogger("assistant-team-tasks");

/**
 * Options this service passes when it runs a worker agent — a structural
 * subset of agent.service's `AgentRunOptions` (kept separate to avoid a module
 * cycle: agent.service → team-tools → THIS → agent.service).
 */
export interface WorkerRunOptions {
  executor: Executor;
  user?: SessionUser;
  userId?: string;
  providerId: AssistantProviderId;
  projectId?: string;
  agentId?: string;
  conversationId: string;
  withContext: boolean;
  delegationDepth: number;
  /** cwd forzado (worktree de la tarea) — gana sobre project.path. */
  forcedCwd?: string;
  signal?: AbortSignal;
}

/**
 * Runner injected by agent.service when it builds the team tools. It is a
 * lambda over `agentService.run` bound at tool-build time.
 */
export type RunAgentFn = (messages: AgentMessage[], options: WorkerRunOptions) => AsyncGenerator<AgentEvent>;

/**
 * Validate a requested projectId against the worker's project closure
 * (attached parents + all descendants). Returns the validated id, null when no
 * project was requested, or throws with a user-facing message on mismatch.
 */
export async function validateWorkerProject(
  executor: Executor,
  worker: AssistantAgent,
  wantProject: string,
): Promise<string | null> {
  if (!wantProject) return null;
  let all: Awaited<ReturnType<typeof projectsRepository.list>>;
  try {
    all = await projectsRepository.list(executor);
  } catch {
    throw new Error("No se pudieron resolver los proyectos del agente.");
  }
  const closure = projectClosure(all, worker.projectIds ?? []);
  if (!closure.has(wantProject)) {
    throw new Error(`El proyecto "${wantProject}" no pertenece al agente "${worker.name}".`);
  }
  return wantProject;
}

export interface SpawnWorkerInput {
  executor: Executor;
  user?: SessionUser | undefined;
  userId?: string | undefined;
  worker: AssistantAgent;
  task: string;
  /** Already validated against the worker's closure (validateWorkerProject). */
  projectId: string | null;
  /** Leader's delegation depth; the worker runs at depth + 1. */
  depth: number;
  runAgent: RunAgentFn;
  /** Origen del panel del líder — habilita el canal MCP cross del worker. */
  panelOrigin?: string;
  /** Called with the new conversation id AFTER the chat exists but BEFORE the
   *  run starts (team.assign creates its TeamTask here, so the close paths
   *  always find it). May return overrides for the run (worktree forcedCwd).
   *  A throw here aborts the spawn. */
  beforeStart?: (
    conversationId: string,
  ) => Promise<{ forcedCwd?: string } | void> | { forcedCwd?: string } | void;
  /** Extra completion hook (team.assign closes its task here). Runs AFTER the
   *  worker's answer was persisted to its conversation. */
  onDone?: (result: { assistantText: string; errored: boolean }) => Promise<void> | void;
}

/** Create the worker's persisted chat (optionally appending the user turn —
 *  deferred tasks let drainConversationQueue persist it when dispatching). */
export async function createWorkerConversation(
  executor: Executor,
  worker: AssistantAgent,
  task: string,
  projectId: string | null,
  opts: { appendUserMessage: boolean },
): Promise<string> {
  const provider = worker.providerId;
  const config = await assistantConfigRepository.load(executor);
  // Delegation has no composer to send the configured reasoning choice.
  // Persist it with the chat so immediate runs, queued tasks and retries use
  // the same selection even if the default changes before dispatch.
  const meta = await conversationsRepository.create(executor, provider, task, projectId, worker.id, {
    ...(config.defaultChatEffort ? { effort: config.defaultChatEffort } : {}),
  });
  const convId = String(meta.id);
  if (opts.appendUserMessage) {
    await conversationsRepository
      .appendMessages(executor, convId, [{ role: "user", provider, content: task, ts: new Date().toISOString() }])
      .catch(() => undefined);
  }
  return convId;
}

/** Start the worker run in the registry (usage recorder + worker quota). */
export function startWorkerRun(args: {
  executor: Executor;
  user?: SessionUser | undefined;
  userId?: string | undefined;
  worker: AssistantAgent;
  task: string;
  projectId: string | null;
  conversationId: string;
  depth: number;
  runAgent: RunAgentFn;
  forcedCwd?: string;
  /** Origen del panel heredado del LÍDER (su run vivo o su meta). Sin él el
   *  worker CLI arranca SIN canal MCP cross → sin `servers.*` ni
   *  `permissions.approve` ("no están disponibles para los subordinados"). */
  panelOrigin?: string;
  onDone?: (result: { assistantText: string; errored: boolean }) => Promise<void> | void;
}): void {
  const { executor, user, userId, worker, task, projectId, conversationId: convId, depth, runAgent, forcedCwd, panelOrigin, onDone } = args;
  const provider = worker.providerId;
  // Tokens MCP FRESCOS acuñados con el convId del WORKER (no se reutilizan los
  // del líder: el conversationId del token enruta `permissions.approve` y el
  // fallback de executor stale al run correcto). Mismo patrón que el drain de
  // turn-queue. Fail-open: sin user/bridge no hay token y el run corre como
  // antes (sin canal).
  const crossMcpToken = mintCrossMcpToken(user, convId);
  const graphMcpToken = mintGraphMcpToken(user, convId);
  // Persistir el origen en el meta del worker: los turnos DIFERIDOS/retry de
  // esta conversación (drain de turn-queue) lo leen de ahí para re-montar el
  // canal tras reinicios.
  if (panelOrigin) {
    void conversationsRepository.patchRuntime(executor, convId, { panelOrigin }).catch(() => undefined);
  }
  // Los runs de worker registran su uso (presupuestos + resumen de costes).
  // `cliHolder` queda referenciado: onComplete lo consulta para borrar el
  // descriptor cli-job de los runs CLI (paridad con turn-queue).
  const cliHolder = { value: false };
  const tokensHolder = { input: 0, output: 0, estimated: false };
  const recordUsage = makeUsageRecorder({
    executor,
    provider,
    conversationId: convId,
    projectId: projectId ?? null,
    userId: userId ?? null,
    cliHolder,
    tokensHolder,
  });
  workerRunStarted(userId, convId);
  agentRunRegistry.start({
    key: convId,
    provider,
    projectId,
    executor,
    // Worker de equipo: conserva el user (scoping/MCP) pero no consume el cap
    // HTTP por usuario — su cupo es ASSISTANT_MAX_WORKER_RUNS.
    isWorker: true,
    ...(user ? { user } : {}),
    makeGen: () =>
      runAgent([{ role: "user", content: task }], {
        executor,
        ...(user ? { user } : {}),
        ...(userId ? { userId } : {}),
        providerId: provider,
        projectId: projectId ?? undefined,
        agentId: worker.id,
        conversationId: convId,
        withContext: true,
        delegationDepth: depth + 1,
        ...(forcedCwd ? { forcedCwd } : {}),
        ...(panelOrigin ? { panelOrigin } : {}),
        ...(crossMcpToken ? { crossMcpToken } : {}),
        ...(graphMcpToken ? { graphMcpToken } : {}),
        signal: undefined,
      }),
    onEvent: recordUsage,
    onComplete: async (assistantText: string, errored: boolean, ask, translation, durationMs, cliLog, askKind, outcome) => {
      workerRunEnded(userId, convId);
      // Un run CLI dejó un descriptor cli-job persistido (cli-bridge lo crea
      // para todo run con conversationId). Sin este delete el descriptor queda
      // huérfano (el tracker borra sus artefactos al completar) y el barrido
      // post-reinicio lo interpreta como run interrumpido → nota falsa
      // "⚠️ La ejecución se interrumpió…" en el chat del worker y tarea done
      // reclasificada como failed. Paridad con turn-queue.service.
      if (cliHolder.value) {
        await cliJobsRepository.delete(executor, convId).catch(() => undefined);
      }
      const content = (assistantText ?? "").trim();
      const total = tokensHolder.input + tokensHolder.output;
      const tokens = total > 0 ? {
        input: tokensHolder.input, output: tokensHolder.output, total,
        ...(tokensHolder.estimated ? { estimated: true } : {}),
      } : undefined;
      await persistAssistantMessage(executor, convId, content, provider, cliHolder.value,
        ask, translation, tokens, durationMs, cliLog, askKind, outcome);
      try {
        await onDone?.({ assistantText: content || outcome?.error || "", errored });
      } catch (err) {
        log.warn({ err: (err as Error).message }, "team spawnWorker onDone hook failed");
      }
    },
  });
}

/**
 * Create a real, persisted background chat for a worker agent and start its
 * run in the registry. Returns the new conversation id immediately (does NOT
 * wait for the run). Used by both `chats.create` (fire-and-forget) and — via
 * `assignTask`'s own composition of the same pieces — `team.assign`.
 */
export async function spawnWorker(input: SpawnWorkerInput): Promise<{ conversationId: string }> {
  const { executor, user, userId, worker, task, projectId, depth, runAgent, panelOrigin, beforeStart, onDone } = input;
  const convId = await createWorkerConversation(executor, worker, task, projectId, { appendUserMessage: true });
  const pre = await beforeStart?.(convId);
  startWorkerRun({
    executor,
    user,
    userId,
    worker,
    task,
    projectId,
    conversationId: convId,
    depth,
    runAgent,
    ...(panelOrigin ? { panelOrigin } : {}),
    ...(pre && pre.forcedCwd ? { forcedCwd: pre.forcedCwd } : {}),
    ...(onDone ? { onDone } : {}),
  });
  return { conversationId: convId };
}
