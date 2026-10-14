// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Run-scoped delegation tool builders injected into an agent's tool set by the
 * system-prompt assembler: `agents.delegate` (synchronous sub-run) and the
 * deprecated `chats.create` (fire-and-forget worker chat). Both close over the
 * `RunAgent` lambda so they can run other agents without a cycle back into
 * agent.service.
 */

import type { Executor } from "../../../../shared/executor/index.js";
import type { SessionUser } from "../../../../shared/types/index.js";
import type { AssistantAgent } from "../../models/assistant-agent.types.js";
import type { AgentTool } from "../../../../shared/agent-capability/index.js";
import { MAX_DELEGATION_DEPTH } from "../agent-targets.js";
import { spawnWorker, validateWorkerProject } from "../team-tasks.service.js";
import { capText } from "./blocks.js";
import type { RunAgent } from "./types.js";

/** Hard wall-clock limit for a synchronous `agents.delegate` sub-run — it blocks
 *  the superior's turn, so a hung delegate must not hang the chain forever.
 *  Mirrors the team.collect default wait. */
const DELEGATE_TIMEOUT_MS = 300_000;

/** Cap on the delegate's answer relayed back as the tool result (same budget as
 *  the team nudge per-task inline results); the full text is not persisted
 *  anywhere else, so keep head+tail instead of head-only. */
const DELEGATE_OUTPUT_MAX_CHARS = 12_000;

/**
 * Build the `agents.delegate` tool for a run driven by `agent`: lets the agent
 * hand a task to one of its SUBORDINATES (agents whose parent is this agent) or
 * a CONNECTED peer, run that agent to completion in the same request scope, and
 * get its answer back as the tool result. Reuses `agentService.run` (so the
 * delegate keeps its own role/prompt/tools/provider) with a bumped depth.
 * Returns null when there are no valid targets.
 */
export function buildDelegateTool(ctx: {
  agent: AssistantAgent;
  allAgents: AssistantAgent[];
  executor: Executor | null | undefined;
  user: SessionUser | undefined;
  userId: string | undefined;
  depth: number;
  signal: AbortSignal | undefined;
  runAgent: RunAgent;
}): { tool: AgentTool; targets: AssistantAgent[] } | null {
  const { agent, allAgents, executor, user, userId, depth, signal, runAgent } = ctx;
  const byId = new Map(allAgents.map((a) => [a.id ?? "", a] as const));
  const targetIds = new Set<string>();
  // Subordinates: agents that report to this one.
  for (const a of allAgents) if (a.id && a.parentAgentId === agent.id) targetIds.add(a.id);
  // Connections: bidirectional peers (this agent's list + anyone listing it).
  for (const id of agent.connections ?? []) targetIds.add(id);
  for (const a of allAgents) if (a.id && (a.connections ?? []).includes(agent.id ?? "")) targetIds.add(a.id);
  targetIds.delete(agent.id ?? "");
  const targets = [...targetIds].map((id) => byId.get(id)).filter((a): a is AssistantAgent => !!a);
  if (targets.length === 0) return null;
  const allowed = new Set(targets.map((a) => a.id));

  const tool: AgentTool = {
    name: "agents.delegate",
    title: "Delegar a otro agente",
    description:
      "Delegate a self-contained task to one of YOUR subordinate or connected agents and get its full answer back. " +
      "Use it to coordinate work: each target agent runs with its own role, system prompt, tools and provider, then returns its result as text. " +
      "Only the agent ids listed in your system prompt under 'Agentes a los que puedes delegar' are valid. The delegate cannot ask the user interactively.",
    kind: "action",
    dangerous: false,
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "Id of the subordinate/connected agent to delegate to (from the allowed list)." },
        task: { type: "string", description: "Clear, self-contained instruction/question for that agent. Include all context it needs." },
      },
      required: ["agentId", "task"],
    },
    handler: async (input: unknown) => {
      const obj = (input ?? {}) as { agentId?: unknown; task?: unknown };
      const targetId = typeof obj.agentId === "string" ? obj.agentId.trim() : "";
      const task = typeof obj.task === "string" ? obj.task.trim() : "";
      if (!targetId || !allowed.has(targetId)) {
        return { ok: false, output: `Agente "${targetId}" no es un subordinado ni una conexión válida de este agente.` };
      }
      if (!task) return { ok: false, output: "Falta la tarea a delegar (campo 'task')." };
      if (depth >= MAX_DELEGATION_DEPTH) {
        return { ok: false, output: "Límite de profundidad de delegación alcanzado; no se puede delegar más en esta cadena." };
      }
      const target = byId.get(targetId);
      try {
        // The sub-run blocks the superior's turn: bound it by the leader's own
        // abort AND a hard timeout so a hung delegate can't hang the chain.
        const subSignal = AbortSignal.any([
          ...(signal ? [signal] : []),
          AbortSignal.timeout(DELEGATE_TIMEOUT_MS),
        ]);
        let text = "";
        for await (const ev of runAgent([{ role: "user", content: task }], {
          executor,
          user,
          ...(userId ? { userId } : {}),
          agentId: targetId,
          withContext: false,
          delegationDepth: depth + 1,
          signal: subSignal,
        })) {
          if (ev.type === "text") text += ev.delta;
          else if (ev.type === "error") return { ok: false, output: `El agente "${target?.name ?? targetId}" falló: ${ev.message}` };
        }
        const answer = capText(text.trim(), DELEGATE_OUTPUT_MAX_CHARS);
        return { ok: true, output: answer || `El agente "${target?.name ?? targetId}" no devolvió respuesta.` };
      } catch (err) {
        return { ok: false, output: `Error al delegar en "${target?.name ?? targetId}": ${(err as Error).message}` };
      }
    },
  };
  return { tool, targets };
}

/**
 * Build the `chats.create` tool for a SUPERVISOR run: lets the agent open real,
 * persisted chats in the Chat tab for its SUBORDINATES and put them to work
 * autonomously. Each spawned chat is bound to the subordinate (its role/tools/
 * projects do the actual work) and runs in the background via the run registry —
 * so it persists, survives restarts, and shows up as that agent's activity log
 * ("bitácora"). Returns null when the agent has no subordinates.
 */
export function buildSpawnChatsTool(ctx: {
  agent: AssistantAgent;
  allAgents: AssistantAgent[];
  executor: Executor | null | undefined;
  user: SessionUser | undefined;
  userId: string | undefined;
  depth: number;
  runAgent: RunAgent;
  /** Origen del panel del run del líder — heredado por el worker (canal MCP). */
  panelOrigin?: string;
}): { tool: AgentTool; targets: AssistantAgent[] } | null {
  const { agent, allAgents, executor, user, userId, depth, runAgent, panelOrigin } = ctx;
  const byId = new Map(allAgents.map((a) => [a.id ?? "", a] as const));
  // Workers = this agent's direct subordinates (the employees it manages).
  const targets = allAgents.filter((a) => a.id && a.parentAgentId === agent.id);
  if (targets.length === 0) return null;
  const allowed = new Set(targets.map((a) => a.id));
  const MAX_SPAWN_PER_RUN = 12;
  let spawned = 0;

  const tool: AgentTool = {
    name: "chats.create",
    title: "Crear chat para un subordinado",
    description:
      "Open a real, persisted chat in the Chat tab and put one of YOUR subordinate agents to work on a task autonomously. " +
      "Use this to act as a supervisor: assign work to an employee agent — the chat runs on its own (finding files, reading code, etc. with that agent's role/tools) and stays visible as that agent's activity log. " +
      "Pass the subordinate's exact `id` (from the list in your prompt), a self-contained `task`, and optionally a `projectId` belonging to that agent (omit for a loose chat). Returns the new conversation id; it does NOT wait for the result.",
    kind: "action",
    dangerous: false,
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "Id of the subordinate agent that will work in the chat (from the allowed list)." },
        task: { type: "string", description: "Self-contained instruction the subordinate must carry out in the new chat." },
        projectId: { type: "string", description: "Optional project/subproject id (must belong to that subordinate). Omit → loose chat." },
      },
      required: ["agentId", "task"],
    },
    handler: async (input: unknown) => {
      if (!executor) return { ok: false, output: "No hay servidor conectado para crear el chat." };
      const obj = (input ?? {}) as { agentId?: unknown; task?: unknown; projectId?: unknown };
      const targetId = typeof obj.agentId === "string" ? obj.agentId.trim() : "";
      const task = typeof obj.task === "string" ? obj.task.trim() : "";
      const wantProject = typeof obj.projectId === "string" ? obj.projectId.trim() : "";
      if (!targetId || !allowed.has(targetId)) return { ok: false, output: `Agente "${targetId}" no es un subordinado de este agente.` };
      if (!task) return { ok: false, output: "Falta la tarea (campo 'task')." };
      if (depth >= MAX_DELEGATION_DEPTH) return { ok: false, output: "Límite de profundidad alcanzado; no se pueden crear más chats en esta cadena." };
      if (spawned >= MAX_SPAWN_PER_RUN) return { ok: false, output: `Límite de ${MAX_SPAWN_PER_RUN} chats por ejecución alcanzado.` };
      const worker = byId.get(targetId)!;
      // Validate the requested project against the worker's project closure
      // (attached parents + all descendants). No project / no match → loose.
      let projectId: string | null = null;
      try {
        projectId = await validateWorkerProject(executor, worker, wantProject);
      } catch (err) {
        return { ok: false, output: (err as Error).message };
      }
      try {
        const { conversationId: convId } = await spawnWorker({
          executor,
          user,
          userId,
          worker,
          task,
          projectId,
          depth,
          runAgent,
          ...(panelOrigin ? { panelOrigin } : {}),
        });
        spawned++;
        return { ok: true, output: { conversationId: convId, agent: worker.name, projectId: projectId ?? null, started: true } };
      } catch (err) {
        return { ok: false, output: `No se pudo crear el chat: ${(err as Error).message}` };
      }
    },
  };
  return { tool, targets };
}
