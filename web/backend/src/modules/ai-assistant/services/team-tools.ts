import { resolveAgentContext, scopedAgents } from "./agent-context.service.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Team tools — the LEADER agent's delegation toolkit (`team.assign`,
 * `team.status`, `team.collect`) plus the coordinator prompt block.
 *
 * Exposed by agent.service ONLY when the run: is API-mode, belongs to a
 * persisted conversation (a task needs a leader chat to anchor to), is driven
 * by an agent with subordinates AND supervisor permission (canSpawnChats on the
 * agent or its role), and is not too deep in a delegation chain.
 *
 * Contrast with the pre-existing tools (both kept intact):
 *   - `agents.delegate` — synchronous Q&A: blocks the leader until the target
 *     answers. Right for short questions.
 *   - `chats.create`   — fire-and-forget background chat, result never returns.
 *   - `team.assign` + `team.collect` — background work WITH result collection:
 *     the leader keeps planning/assigning while workers run, then waits
 *     (bounded) and synthesizes.
 */

import { env } from "../../../config/env.js";
import type { AgentTool } from "../../../shared/agent-capability/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { SessionUser } from "../../../shared/types/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import type { AssistantAgent } from "../models/assistant-agent.types.js";
import type { AssistantRole } from "../models/assistant-role.types.js";
import { isTerminalTaskStatus, sanitizeTaskTitle, type TeamTask } from "../models/team-task.types.js";
import { teamTasksService, validateWorkerProject, type RunAgentFn } from "./team-tasks.service.js";
import { projectsRepository, sanitizeVerify } from "../repositories/projects.repository.js";
import { assistantAuditRepository } from "../repositories/assistant-audit.repository.js";
import { conversationsRepository } from "../repositories/conversations.repository.js";
import { agentsRepository } from "../repositories/agents.repository.js";
import { agentRolesRepository } from "../repositories/agent-roles.repository.js";

const log = createModuleLogger("assistant-team-tools");

/** Max background chats one leader run may spawn (mirrors chats.create). */
const MAX_ASSIGN_PER_RUN = 12;

/** team.collect wait bounds (seconds). */
const COLLECT_DEFAULT_WAIT_S = 300;
const COLLECT_MAX_WAIT_S = 1800;

/** Output budget for one team.collect result payload (chars). Per-task results
 *  are already clamped to 4000 by the board; this caps the SUM so N workers
 *  can't blow up the leader's context window in one tool result. */
const COLLECT_TOTAL_BUDGET = 16_000;

export interface TeamToolsCtx {
  projectId?: string | null;
  agent: AssistantAgent;
  allAgents: AssistantAgent[];
  roles: AssistantRole[];
  executor: Executor;
  user: SessionUser | undefined;
  userId: string | undefined;
  depth: number;
  maxDepth: number;
  /** The LEADER's persisted conversation (anchor for the task board). */
  conversationId: string;
  /** Origen del panel del run del líder — heredado por los workers para su
   *  canal MCP cross (`servers.*`). Fallback: assignTask lee el meta del líder. */
  panelOrigin?: string;
  /** The leader run's AbortSignal — a user "stop" releases team.collect. */
  signal: AbortSignal | undefined;
  runAgent: RunAgentFn;
  /**
   * Cap for team.collect's waitSeconds (default 1800). The MCP/CLI channel
   * lowers it (240 s): a tools/call blocks one HTTP request end-to-end there,
   * and proxies in the path (nginx/LP) cut long-idle requests.
   */
  maxCollectWaitS?: number;
  /**
   * Display names for the tools in the PROMPT block. API-mode runs use the
   * plain names (default); CLI leaders see the MCP wire names
   * (`mcp__luxipanel-servers__team__assign`, …) because that's how the Claude
   * CLI addresses tools served over the cross channel.
   */
  promptToolNames?: { plan: string; assign: string; status: string; collect: string; integrate: string; note: string };
  /** True when rendering the prompt for a CLI leader: omits the notes about
   *  `agents.delegate`/`chats.create` (not available over the MCP channel). */
  cliPrompt?: boolean;
}

export interface BuiltTeamTools {
  tools: AgentTool[];
  /** Stable system-prompt block: enriched subordinate roster + protocol. */
  promptBlock: string;
}

function statusEs(t: TeamTask): string {
  switch (t.status) {
    case "pending": return "pendiente";
    case "running": return t.pendingPermission ? "en curso (esperando aprobación del usuario)" : "en curso";
    case "done": return "hecha";
    case "failed": return "fallida";
    case "canceled": return "cancelada";
  }
}

function elapsedS(t: TeamTask): number {
  const start = Date.parse(t.startedAt ?? t.createdAt);
  const end = t.finishedAt ? Date.parse(t.finishedAt) : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 1000));
}

/**
 * Build the team tools + coordinator prompt block, or null when the agent has
 * no subordinates. Targets are DIRECT subordinates only (the employees this
 * leader manages), like chats.create.
 */
export async function buildTeamTools(ctx: TeamToolsCtx): Promise<BuiltTeamTools | null> {
  const { agent, allAgents, roles, executor, user, userId, depth, maxDepth, conversationId, signal, runAgent } = ctx;
  const collectCapS = Math.min(Math.max(ctx.maxCollectWaitS ?? COLLECT_MAX_WAIT_S, 0), COLLECT_MAX_WAIT_S);
  const names = ctx.promptToolNames ?? {
    plan: "team.plan",
    assign: "team.assign",
    status: "team.status",
    collect: "team.collect",
    integrate: "team.integrate",
    note: "team.note",
  };
  const scopeProjectId = ctx.projectId ?? (await conversationsRepository.getMeta(executor, conversationId))?.projectId ?? null;
  const members = await scopedAgents(executor, allAgents, scopeProjectId, user);
  const subordinates = members.filter((a) => a.id && a.parentAgentId === agent.id);
  if (subordinates.length === 0) return null;
  const byId = new Map(subordinates.map((a) => [a.id ?? "", a] as const));
  const roleById = new Map(roles.map((r) => [r.id ?? "", r] as const));
  let assigned = 0;

  // Project titles for the roster (best-effort; roster still renders without).
  let projectTitleById = new Map<string, string>();
  try {
    const projects = await projectsRepository.list(executor);
    projectTitleById = new Map(projects.filter((p) => p.id).map((p) => [String(p.id), p.title] as const));
  } catch {
    /* roster falls back to raw ids */
  }

  const assignTool: AgentTool = {
    name: "team.assign",
    title: "Asignar tarea a un subordinado (en background)",
    description:
      "Assign a self-contained task to one of YOUR direct subordinate agents. It runs in a real background chat " +
      "while you keep working; you get back a taskId immediately (NOT the result). Choose the subordinate whose " +
      "specialty/tools/projects (listed in your prompt) best match the task. Include ALL needed context in `task` " +
      "(the worker can't see this conversation). Assign independent tasks back-to-back to parallelize, then call " +
      "`team.collect` to wait for and gather the results.",
    kind: "action",
    dangerous: false,
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "Id of the subordinate agent (from the roster in your prompt)." },
        task: { type: "string", description: "Complete, self-contained instruction for the worker." },
        title: { type: "string", description: "Short card title for the progress board (≤120 chars). Optional." },
        projectId: { type: "string", description: "Optional project id belonging to that subordinate. Omit for a loose chat." },
        planId: { type: "string", description: "Optional plan id (from team.plan) this task belongs to." },
        stepIndex: { type: "number", description: "0-based step index inside that plan. Required when planId is set." },
        verifyCommands: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional verification commands overriding the project's recipe (only honored when the admin enabled " +
            "ASSISTANT_TEAM_VERIFY_ALLOW_OVERRIDE; otherwise rejected).",
        },
        maxTokens: { type: "number", description: "Optional per-task token budget override." },
      },
      required: ["agentId", "task"],
    },
    handler: async (input: unknown) => {
      const obj = (input ?? {}) as { agentId?: unknown; task?: unknown; title?: unknown; projectId?: unknown; planId?: unknown; stepIndex?: unknown; verifyCommands?: unknown; maxTokens?: unknown };
      const targetId = typeof obj.agentId === "string" ? obj.agentId.trim() : "";
      const task = typeof obj.task === "string" ? obj.task.trim() : "";
      const wantProject = typeof obj.projectId === "string" ? obj.projectId.trim() : "";
      if (scopeProjectId && wantProject && wantProject !== scopeProjectId) return { ok: false, output: "La tarea debe conservar el proyecto activo." };
      const planId = typeof obj.planId === "string" && obj.planId.trim() ? obj.planId.trim() : null;
      const stepIndex =
        typeof obj.stepIndex === "number" && Number.isInteger(obj.stepIndex) && obj.stepIndex >= 0
          ? obj.stepIndex
          : undefined;
      const worker = byId.get(targetId);
      if (!worker) return { ok: false, output: `Agente "${targetId}" no es un subordinado directo de este agente.` };
      if (!task) return { ok: false, output: "Falta la tarea (campo 'task')." };
      if (depth >= maxDepth) return { ok: false, output: "Límite de profundidad de delegación alcanzado; no se pueden asignar más tareas en esta cadena." };
      if (assigned >= MAX_ASSIGN_PER_RUN) return { ok: false, output: `Límite de ${MAX_ASSIGN_PER_RUN} tareas por ejecución alcanzado.` };
      let projectId: string | null = null;
      try {
        projectId = await validateWorkerProject(executor, worker, wantProject || scopeProjectId || "", user);
      } catch (err) {
        return { ok: false, output: (err as Error).message };
      }
      // Override de verificación: viene del MODELO líder y se ejecuta por
      // executor.exec SIN pasar por el broker de permisos → gateado por env.
      let verifyOverride: string[] | undefined;
      if (Array.isArray(obj.verifyCommands) && obj.verifyCommands.length > 0) {
        if (!env.ASSISTANT_TEAM_VERIFY_ALLOW_OVERRIDE) {
          return {
            ok: false,
            output:
              "El override de verificación está deshabilitado (ASSISTANT_TEAM_VERIFY_ALLOW_OVERRIDE). " +
              "Configura la receta en el proyecto o asigna sin verifyCommands.",
          };
        }
        const cleaned = sanitizeVerify({ commands: obj.verifyCommands });
        if (!cleaned) return { ok: false, output: "verifyCommands inválidos." };
        if (cleaned.commands.some((c) => /\bsudo\b/.test(c))) {
          return { ok: false, output: "verifyCommands no puede contener sudo." };
        }
        verifyOverride = cleaned.commands;
        void assistantAuditRepository
          .append(
            {
              ts: new Date().toISOString(),
              provider: "team",
              tool: "team.assign:verify-override",
              success: true,
              durationMs: 0,
              userId,
              outputPreview: cleaned.commands.join(" && ").slice(0, 200),
            },
            executor,
          )
          .catch(() => undefined);
      }
      // Mínimo realista: un solo turno CLI consume 60-80k tokens, así que un
      // budget menor es incumplible (se cerraría "done" ya excedido). Si el
      // líder pide menos, se eleva y se le avisa en el output del tool.
      const TASK_BUDGET_MIN = 50_000;
      const requestedTokens =
        typeof obj.maxTokens === "number" && Number.isFinite(obj.maxTokens) ? Math.round(obj.maxTokens) : undefined;
      const maxTokens =
        requestedTokens !== undefined ? Math.min(Math.max(requestedTokens, TASK_BUDGET_MIN), 10_000_000) : undefined;
      const budgetNote =
        requestedTokens !== undefined && requestedTokens < TASK_BUDGET_MIN
          ? `maxTokens elevado al mínimo realista de ${TASK_BUDGET_MIN} (un turno CLI consume 60-80k tokens).`
          : undefined;
      try {
        const record = await teamTasksService.assignTask({
          executor,
          user,
          userId,
          leaderConversationId: conversationId,
          leaderAgentId: agent.id ?? "",
          ...(ctx.panelOrigin ? { panelOrigin: ctx.panelOrigin } : {}),
          worker,
          title: sanitizeTaskTitle(obj.title, task),
          task,
          projectId,
          ...(planId ? { planId } : {}),
          ...(planId && stepIndex !== undefined ? { stepIndex } : {}),
          depth,
          runAgent,
          ...(verifyOverride ? { verifyCommands: verifyOverride } : {}),
          ...(maxTokens !== undefined ? { budgetTokens: maxTokens } : {}),
        });
        assigned++;
        return {
          ok: true,
          output: {
            taskId: record.id,
            conversationId: record.workerConversationId,
            agent: worker.name,
            status: record.status,
            hint: "La tarea corre en background. Usa team.collect para esperar y recoger los resultados.",
            ...(budgetNote ? { budgetNote } : {}),
          },
        };
      } catch (err) {
        log.warn({ err: (err as Error).message }, "team.assign failed");
        return { ok: false, output: `No se pudo asignar la tarea: ${(err as Error).message}` };
      }
    },
  };

  const planTool: AgentTool = {
    name: "team.plan",
    title: "Registrar el plan de trabajo del equipo",
    description:
      "Persist your work plan for this request so the user can see it as a live checklist. Pass a short `title`, " +
      "the `goal`, and 2-12 `steps` (each with a `title` and optionally the subordinate `agentId` you intend to " +
      "assign it to). Returns a `planId`: pass it (with `stepIndex`) to each `team.assign` so the checklist tracks " +
      "progress automatically. Create it BEFORE assigning tasks.",
    kind: "action",
    dangerous: false,
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short plan title (≤120 chars)." },
        goal: { type: "string", description: "One-paragraph goal of the plan." },
        steps: {
          type: "array",
          description: "Ordered steps (2-12).",
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Step title." },
              agentId: { type: "string", description: "Subordinate you intend to assign this step to. Optional." },
            },
            required: ["title"],
          },
        },
        notes: {
          type: "string",
          description:
            "Optional SHARED NOTES for the whole plan (contracts, decisions, conventions every worker must know). " +
            "Prepended read-only to each worker's task. Update later with team.note.",
        },
      },
      required: ["title", "goal", "steps"],
    },
    handler: async (input: unknown) => {
      const obj = (input ?? {}) as { title?: unknown; goal?: unknown; steps?: unknown; notes?: unknown };
      const title = sanitizeTaskTitle(obj.title, "Plan de equipo");
      const goal = typeof obj.goal === "string" ? obj.goal.trim().slice(0, 2000) : "";
      const rawSteps = Array.isArray(obj.steps) ? obj.steps : [];
      const steps = rawSteps
        .map((s) => {
          const so = (s ?? {}) as { title?: unknown; agentId?: unknown };
          const stepTitle = typeof so.title === "string" ? so.title.trim().slice(0, 200) : "";
          const agentId = typeof so.agentId === "string" && byId.has(so.agentId.trim()) ? so.agentId.trim() : undefined;
          return stepTitle ? { title: stepTitle, ...(agentId ? { workerAgentId: agentId } : {}) } : null;
        })
        .filter((s): s is { title: string; workerAgentId?: string } => s !== null)
        .slice(0, 12);
      if (!goal) return { ok: false, output: "Falta la meta del plan (campo 'goal')." };
      if (steps.length < 2) return { ok: false, output: "El plan necesita al menos 2 pasos con título." };
      try {
        const plan = await teamTasksService.createPlan(executor, {
          leaderConversationId: conversationId,
          leaderAgentId: agent.id ?? "",
          title,
          goal,
          steps,
          ...(typeof obj.notes === "string" && obj.notes.trim() ? { sharedNotes: obj.notes } : {}),
        });
        return {
          ok: true,
          output: {
            planId: plan.id,
            steps: plan.steps.map((s, i) => ({ stepIndex: i, title: s.title })),
            hint: "Pasa planId + stepIndex en cada team.assign para que el checklist avance solo.",
          },
        };
      } catch (err) {
        return { ok: false, output: `No se pudo registrar el plan: ${(err as Error).message}` };
      }
    },
  };

  const statusTool: AgentTool = {
    name: "team.status",
    title: "Estado de las tareas del equipo",
    description:
      "Snapshot of the tasks you assigned in THIS conversation: id, title, worker, state (pendiente/en curso/hecha/" +
      "fallida/cancelada), elapsed seconds and whether the worker is waiting for a user permission approval. " +
      "Does NOT wait — use team.collect to wait for results.",
    kind: "read",
    dangerous: false,
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      try {
        const tasks = await teamTasksService.listForLeaderConversation(executor, conversationId);
        if (tasks.length === 0) return { ok: true, output: "No has asignado tareas en esta conversación." };
        return {
          ok: true,
          output: tasks.map((t) => ({
            taskId: t.id,
            title: t.title,
            agent: t.workerAgentName,
            status: statusEs(t),
            elapsedSeconds: elapsedS(t),
            collected: Boolean(t.collected),
            ...(t.pendingPermission ? { pendingPermission: true } : {}),
            ...(t.error ? { error: t.error.slice(0, 200) } : {}),
          })),
        };
      } catch (err) {
        return { ok: false, output: `No se pudo leer el tablero: ${(err as Error).message}` };
      }
    },
  };

  const collectTool: AgentTool = {
    name: "team.collect",
    title: "Esperar y recoger resultados del equipo",
    description:
      "Wait (bounded) for your assigned tasks to finish and collect their results. Omit `taskIds` to collect every " +
      "not-yet-collected task of this conversation. `waitSeconds` defaults to 300 (max 1800); pass 0 to just grab " +
      "whatever is already finished. Returns each task's result (trimmed). If some tasks are still running when the " +
      "wait expires, you get partial results plus the pending list — in that case inform the user what is still in " +
      "progress and END your turn; you will be woken up automatically when the remaining work finishes. " +
      "NEVER paste raw worker output to the user: synthesize a consolidated answer.",
    kind: "read",
    dangerous: false,
    inputSchema: {
      type: "object",
      properties: {
        taskIds: { type: "array", items: { type: "string" }, description: "Task ids to collect. Omit = all uncollected." },
        waitSeconds: { type: "number", description: "Max seconds to wait (0–1800, default 300)." },
      },
    },
    handler: async (input: unknown) => {
      const obj = (input ?? {}) as { taskIds?: unknown; waitSeconds?: unknown };
      try {
        const all = await teamTasksService.listForLeaderConversation(executor, conversationId);
        const wantIds = Array.isArray(obj.taskIds)
          ? obj.taskIds.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          : [];
        const subset = wantIds.length
          ? all.filter((t) => t.id && wantIds.includes(t.id))
          : all.filter((t) => !t.collected);
        // Ids que NO existen en el tablero (típicamente un uuid mal transcrito
        // por el modelo). Antes caían en el mismo "No hay tareas pendientes"
        // que el caso todo-recogido y el líder concluía que la tarea ya estaba
        // entregada — se responde explícito con un snapshot del tablero para
        // que corrija el id en vez de reintentar a ciegas.
        const knownIds = new Set(all.map((t) => t.id).filter(Boolean));
        const unknownIds = wantIds.filter((id) => !knownIds.has(id));
        const boardSnapshot = () =>
          all.slice(-12).map((t) => ({
            taskId: t.id,
            title: t.title,
            agent: t.workerAgentName,
            status: statusEs(t),
            collected: Boolean(t.collected),
            ...(t.planId ? { planId: t.planId } : {}),
          }));
        if (subset.length === 0) {
          if (unknownIds.length > 0) {
            return {
              ok: false,
              output: {
                error:
                  `taskIds desconocidos en esta conversación: ${unknownIds.join(", ")}. ` +
                  "Verifica el id EXACTO en el tablero (abajo) y reintenta con él.",
                board: boardSnapshot(),
              },
            };
          }
          return { ok: true, output: "No hay tareas pendientes de recoger en esta conversación." };
        }
        const rawWait = typeof obj.waitSeconds === "number" && Number.isFinite(obj.waitSeconds) ? obj.waitSeconds : COLLECT_DEFAULT_WAIT_S;
        const waitMs = Math.min(Math.max(rawWait, 0), collectCapS) * 1000;
        const { tasks, timedOut } = await teamTasksService.waitForTasks(
          executor,
          conversationId,
          subset.map((t) => t.id ?? ""),
          waitMs,
          signal,
        );
        const finished = tasks.filter((t) => isTerminalTaskStatus(t.status));
        const pending = tasks.filter((t) => !isTerminalTaskStatus(t.status));

        // Budgeted result payload: per-task summaries are ≤4000 chars already;
        // cap the TOTAL so a big fan-out can't flood the leader's context.
        let spent = 0;
        const results = finished.map((t) => {
          const raw = (t.status === "done" ? t.resultSummary : t.error) ?? "";
          const room = Math.max(0, COLLECT_TOTAL_BUDGET - spent);
          const text = raw.length > room ? raw.slice(0, room) + "\n…[truncado — resultado completo en el chat del agente]" : raw;
          spent += text.length;
          return {
            taskId: t.id,
            title: t.title,
            agent: t.workerAgentName,
            status: statusEs(t),
            // Contexto de procedencia: un collect sin `taskIds` arrastra TODO
            // lo no-recogido, incluidas tareas de planes anteriores — estas
            // señales dejan distinguir lo viejo sin inflar el resultado.
            ...(t.planId ? { planId: t.planId } : {}),
            assignedAt: t.createdAt,
            ...(t.status === "done" ? { result: text } : { error: text || "Sin detalle." }),
            // Señales compactas para el paso de integración/qa del líder.
            ...(t.isolation?.branch && !t.isolation.integrated ? { branch: t.isolation.branch } : {}),
            ...(t.artifacts?.filesChangedTotal
              ? { files: `${t.artifacts.filesChangedTotal} archivo(s) (+${t.artifacts.insertions ?? 0}/-${t.artifacts.deletions ?? 0})` }
              : {}),
            ...(t.verify ? { verify: `${t.verify.state} (intentos: ${t.verify.attempts})` } : {}),
          };
        });
        await teamTasksService.markCollected(
          executor,
          finished.map((t) => t.id ?? "").filter(Boolean),
        );
        const output: Record<string, unknown> = { results };
        if (unknownIds.length > 0) {
          // Recogida PARCIAL: algunos ids pedidos no existen (uuid mal
          // transcrito). Avisar aunque haya resultados, o el líder asumirá
          // que la tarea del id inválido ya fue entregada.
          output["unknownTaskIds"] = unknownIds;
          output["unknownNote"] =
            "Estos taskIds no existen en tu tablero — verifica el id exacto (team.status) antes de darlos por recogidos.";
        }
        if (pending.length > 0) {
          output["pending"] = pending.map((t) => ({
            taskId: t.id,
            title: t.title,
            agent: t.workerAgentName,
            status: statusEs(t),
            elapsedSeconds: elapsedS(t),
            ...(t.pendingPermission ? { pendingPermission: true } : {}),
          }));
          output["note"] = timedOut
            ? "Tareas aún en curso. Puedes terminar tu turno informando al usuario qué sigue pendiente; serás despertado automáticamente cuando terminen."
            : "Espera liberada antes de terminar (stop del usuario). Las tareas siguen corriendo en background.";
        }
        return { ok: true, output };
      } catch (err) {
        log.warn({ err: (err as Error).message }, "team.collect failed");
        return { ok: false, output: `No se pudieron recoger los resultados: ${(err as Error).message}` };
      }
    },
  };

  const noteTool: AgentTool = {
    name: "team.note",
    title: "Actualizar las notas compartidas del plan",
    description:
      "Replace the plan's SHARED NOTES (contracts, API shapes, decisions, conventions) that every worker assigned " +
      "FROM NOW ON receives read-only with its task. Use it when a worker's result establishes something the next " +
      "workers must know (e.g. the API contract worker A defined, which worker B consumes).",
    kind: "action",
    dangerous: false,
    inputSchema: {
      type: "object",
      properties: {
        planId: { type: "string", description: "Plan id (from team.plan)." },
        notes: { type: "string", description: "Full new shared-notes text (≤4000 chars; replaces the previous)." },
      },
      required: ["planId", "notes"],
    },
    handler: async (input: unknown) => {
      const obj = (input ?? {}) as { planId?: unknown; notes?: unknown };
      const planId = typeof obj.planId === "string" ? obj.planId.trim() : "";
      const notes = typeof obj.notes === "string" ? obj.notes : "";
      if (!planId || !notes.trim()) return { ok: false, output: "Faltan planId o notes." };
      try {
        const res = await teamTasksService.setPlanNotes(executor, conversationId, planId, notes);
        return { ok: res.ok, output: res.message };
      } catch (err) {
        return { ok: false, output: `No se pudieron actualizar las notas: ${(err as Error).message}` };
      }
    },
  };

  const integrateTool: AgentTool = {
    name: "team.integrate",
    title: "Integrar la rama de una tarea al proyecto",
    description:
      "Merge a DONE task's work branch (git worktree isolation) into the project's main checkout. Call it once per " +
      "finished task WITH code changes, one at a time, AFTER collecting its result. On conflict the merge is aborted " +
      "and you get the conflicting files back — reassign a resolution task or tell the user. Tasks without a work " +
      "branch (no git project) don't need integration.",
    kind: "action",
    dangerous: false,
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "Id of the DONE task whose branch to integrate." },
        mode: {
          type: "string",
          enum: ["merge", "pr"],
          description:
            "merge (default): merge the branch locally. pr: push the branch and open a PR " +
            "(only when the admin enabled ASSISTANT_TEAM_PR_ENABLED).",
        },
      },
      required: ["taskId"],
    },
    handler: async (input: unknown) => {
      const obj = (input ?? {}) as { taskId?: unknown; mode?: unknown };
      const taskId = typeof obj.taskId === "string" ? obj.taskId.trim() : "";
      const mode = obj.mode === "pr" ? ("pr" as const) : ("merge" as const);
      if (!taskId) return { ok: false, output: "Falta el taskId." };
      try {
        // Solo tareas de ESTA conversación de líder (no integrar trabajo ajeno).
        const mine = await teamTasksService.listForLeaderConversation(executor, conversationId);
        if (!mine.some((t) => t.id === taskId)) {
          return { ok: false, output: `La tarea "${taskId}" no pertenece a esta conversación.` };
        }
        const res = await teamTasksService.integrateTask(executor, taskId, { mode });
        if (!res.ok) {
          return {
            ok: false,
            output: {
              message: res.message,
              ...(res.conflicts?.length
                ? { conflicts: res.conflicts, hint: "Reasigna una tarea de resolución de conflictos o intégralo a mano." }
                : {}),
            },
          };
        }
        return { ok: true, output: { message: res.message, ...(res.summary ?? {}) } };
      } catch (err) {
        log.warn({ err: (err as Error).message }, "team.integrate failed");
        return { ok: false, output: `No se pudo integrar: ${(err as Error).message}` };
      }
    },
  };

  // ── Enriched roster + coordinator protocol (stable → prompt-cacheable) ────
  const rosterLines = subordinates.map((a) => {
    const role = a.roleId ? roleById.get(a.roleId) : undefined;
    const tools =
      a.allowedTools === null || a.allowedTools === undefined
        ? "sin restricción"
        : a.allowedTools.slice(0, 6).join(", ") + (a.allowedTools.length > 6 ? ", …" : "");
    const projects = (a.projectIds ?? [])
      .map((pid) => projectTitleById.get(pid) ?? pid)
      .slice(0, 4)
      .join(", ");
    const dirs = (a.projectPaths ?? []).slice(0, 3).join(", ");
    const parts = [
      `- id: ${a.id} · ${a.name}${a.description?.trim() ? ` — ${a.description.trim()}` : ""}`,
      `  Rol: ${role?.name ?? "(sin rol)"} · Proveedor/modelo: ${a.providerId}/${a.model || "default"}`,
      `  Herramientas: ${tools}`,
    ];
    if (projects || dirs) parts.push(`  Proyectos: ${projects || "—"}${dirs ? ` · Directorios: ${dirs}` : ""}`);
    return parts.join("\n");
  });

  const promptBlock =
    "\n\n## Tu equipo (subordinados directos)\n" +
    "Eres el LÍDER de este equipo. Cada subordinado trabaja en chats reales en background con su propio rol, " +
    "prompt, herramientas y proveedor:\n" +
    rosterLines.join("\n") +
    "\n\n## Protocolo de coordinación de equipo (OBLIGATORIO)\n" +
    "REGLA MAESTRA — NO NEGOCIABLE: eres el LÍDER; tu papel es COORDINAR, no ejecutar. NO hagas tú el trabajo " +
    "(leer/buscar código, revisar archivos, auditar, implementar, probar) aunque tengas herramientas para hacerlo — " +
    "eso es SIEMPRE de tus especialistas. Esto aplica también cuando el pedido tiene forma de pregunta de análisis " +
    "(p. ej. «¿qué falta por traducir?», «revisa X», «dime qué está roto»): la respuesta la producen tus subordinados " +
    "y tú la consolidas. " +
    (ctx.cliPrompt
      ? "En particular, NO uses tus herramientas locales (Read, Grep, Glob, Bash, Task, WebSearch ni el grafo de " +
        "código) para investigar o resolver el pedido; como mucho, úsalas unos segundos para redactar tareas " +
        "autocontenidas. "
      : "") +
    "Responde directamente SOLO saludos, aclaraciones del pedido o preguntas sobre el estado del equipo. " +
    "Para TODO lo demás sigue este flujo:\n" +
    `1. Analiza el pedido y registra un plan breve con \`${names.plan}\` (subtareas concretas; el usuario lo ve como checklist en vivo).\n` +
    `2. Asigna cada subtarea al especialista correcto con \`${names.assign}\` pasando \`planId\` + \`stepIndex\` (elige por ` +
    "especialidad, herramientas y proyectos del roster; la `task` debe ser autocontenida, con TODO el contexto — " +
    "el subordinado no ve esta conversación).\n" +
    `3. Lanza en paralelo las tareas independientes (varios ${names.assign} seguidos) y luego espera con \`${names.collect}\`` +
    (ctx.cliPrompt ? ` (consulta el avance con \`${names.status}\` entre esperas)` : "") +
    ".\n" +
    "4. NO pegues la salida cruda de los subordinados: sintetiza un resultado consolidado, breve y accionable para el usuario.\n" +
    `5. Tras recoger una tarea HECHA con cambios de código (verás \`branch\`/\`files\` en el resultado), intégrala al ` +
    `proyecto con \`${names.integrate}\` — una por una, en orden. Si hay conflicto, reasigna una tarea de resolución.\n` +
    `6. Si \`${names.collect}\` expira con tareas en curso, informa al usuario qué sigue pendiente y TERMINA tu turno: ` +
    "serás despertado automáticamente cuando terminen.\n" +
    (ctx.cliPrompt
      ? ""
      : "7. Usa `agents.delegate` solo para consultas cortas que necesitas responder YA dentro de tu turno; " +
        "`team.assign` para trabajo real.\n") +
    `8. Cuando el resultado de un worker establezca algo que los SIGUIENTES workers deben conocer (contratos de API, ` +
    `decisiones, convenciones), regístralo con \`${names.note}\` ANTES de asignar las siguientes tareas.\n` +
    "9. Responde al usuario como una persona: cuenta qué hiciste y el resultado, no la mecánica interna de herramientas.\n" +
    "10. Si trabajas dentro de un proyecto con vault de contexto (Obsidian), registra al final una nota breve con el plan " +
    "ejecutado y su resultado (herramientas obsidian.* si están disponibles).\n" +
    "11. Los builds y restarts (`npm/pnpm run build`, `astro build`, `pm2 restart|reload`, `systemctl restart`) SÍ pueden " +
    "ejecutarse — por ti o por tus subordinados, en el servidor conectado o en los remotos (`servers.exec`) — cuando el " +
    "trabajo lo requiera, con las trampas OBLIGATORIAS: un solo build a la vez por máquina (dos simultáneos = OOM); frontends " +
    "Astro con `rm -rf dist` previo + `NODE_OPTIONS=--max-old-space-size=2560`; si cambió un `.env` bajo pm2, restart " +
    "re-evaluando el ecosystem (`--update-env` con la ruta al ecosystem.config, no un restart simple); y verificación " +
    "post-restart (proceso online + servicio responde) antes de reportar éxito. Coordina para que dos tareas no compilen " +
    "a la vez en la misma máquina. Si el usuario pidió explícitamente no compilar/reiniciar, respétalo.\n" +
    `RECUERDA: ante un pedido de trabajo/análisis, tu PRIMERA acción debe ser registrar el plan con \`${names.plan}\` ` +
    "y delegar — no investigar por tu cuenta.";

  return { tools: [planTool, assignTool, statusTool, collectTool, integrateTool, noteTool], promptBlock };
}

/**
 * MCP wire names of the team tools as the Claude CLI sees them over the
 * per-run cross channel (`mcp__<server>__<tool with dots → __>`; the bridge
 * registers the channel as "luxipanel-servers", same as permissions.approve).
 */
export const TEAM_TOOL_WIRE_NAMES = {
  plan: "mcp__luxipanel-servers__team__plan",
  assign: "mcp__luxipanel-servers__team__assign",
  status: "mcp__luxipanel-servers__team__status",
  collect: "mcp__luxipanel-servers__team__collect",
  integrate: "mcp__luxipanel-servers__team__integrate",
  note: "mcp__luxipanel-servers__team__note",
} as const;

/**
 * Resolve the team toolkit for a CONVERSATION (per-run cross MCP channel /
 * CLI leaders): loads the conversation's bound agent and, when it is a leader
 * (has direct subordinates + supervisor permission on the agent or its role),
 * builds the tools at depth 0. Returns null otherwise — the caller treats
 * that as "no team tools on this channel".
 */
export async function buildTeamToolsForConversation(args: {
  executor: Executor;
  user: SessionUser | undefined;
  userId: string | undefined;
  conversationId: string;
  runAgent: RunAgentFn;
  maxCollectWaitS?: number;
}): Promise<BuiltTeamTools | null> {
  const { executor, user, userId, conversationId, runAgent, maxCollectWaitS } = args;
  // NB: do NOT swallow a getMeta THROW here. A null (conversation not found /
  // not an agent chat) legitimately means "no team toolkit" → return null. But a
  // THROW is an executor/SSH read failure (e.g. a stale bridge right after a
  // backend restart): let it propagate so the caller can tell a transient
  // failure from a genuine non-leader and surface it instead of silently
  // dropping the leader's team.* tools.
  const meta = await conversationsRepository.getMeta(executor, conversationId);
  const agentId = meta?.agentId ?? null;
  if (!agentId) return null;
  const [context, allAgents, roles] = await Promise.all([
    resolveAgentContext(executor, agentId, meta?.projectId, user),
    agentsRepository.list().catch(() => [] as AssistantAgent[]),
    agentRolesRepository.list().catch(() => [] as AssistantRole[]),
  ]);
  const { agent, role } = context;
  if (!agent?.id) return null;
  if (!agent.canSpawnChats && !role?.canSpawnChats) return null;
  return buildTeamTools({
    agent,
    allAgents,
    roles,
    executor,
    user,
    userId,
    depth: 0,
    maxDepth: 3,
    conversationId,
    projectId: context.projectId,
    // Líder CLI (canal MCP): su meta guarda el último panelOrigin visto —
    // heredado por los workers de team.assign para su propio canal cross.
    ...(meta?.panelOrigin ? { panelOrigin: meta.panelOrigin } : {}),
    signal: undefined,
    runAgent,
    ...(maxCollectWaitS !== undefined ? { maxCollectWaitS } : {}),
  });
}
