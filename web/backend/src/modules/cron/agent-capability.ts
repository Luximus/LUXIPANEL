// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Cron — AI agent capability.
 *
 * Exposes the cron module to the AI Assistant. The READ tool dumps the
 * crontab; the ACTION tools let the agent create/edit/pause/remove jobs.
 *
 * All of these are gated by the Assistant's per-target module-access sidecar
 * (`assistant/modules.json`) via `assistantModulesService` — so granting or
 * revoking the agent's power over cron is done from the Assistant's Modules
 * tab (toggle the `cron` module or any individual `cron.*` tool, and set
 * `requireConfirm`). The `cron.*` action tools default to `dangerous: true`,
 * so they start with confirmation required.
 */

import { randomUUID } from "node:crypto";
import type { AgentCapability } from "../../shared/agent-capability/index.js";
import { requireExecutor } from "../../shared/agent-capability/index.js";
import { cronParserService } from "./services/cron-parser.service.js";
import { cronDaemonService } from "./services/cron-daemon.service.js";
import { resolveCronOwner, cronUserWrapperPath } from "./services/cron-owner.service.js";
import { getContextUser, getContextUserId } from "../../shared/executor/context.js";
import { localExecutor } from "../../shared/executor/index.js";
import { ForbiddenError } from "../../shared/errors/index.js";
import { cronLogService } from "./services/cron-log.service.js";
import { aiAgentJobRepository, type AiAgentJob } from "./repositories/ai-agent-job.repository.js";
import { agentPresetsRepository, presetScope } from "./repositories/agent-presets.repository.js";
import { aiCronSchedulerService } from "./services/ai-cron-scheduler.service.js";
import { PROVIDER_IDS, type AssistantProviderId } from "../ai-assistant/models/assistant-config.types.js";

async function classicOwner(requested?: unknown) {
  const executor = requireExecutor();
  const user = getContextUser();
  if (user?.username === "cron-agent") throw new ForbiddenError("Un agente programado no puede administrar crontabs de Linux.");
  const owner = await resolveCronOwner(user ?? undefined, executor, requested);
  return { executor, owner, access: { direct: owner.direct, wrapperPath: owner.username === "root" ? undefined : cronUserWrapperPath(owner) } };
}

/** Slim, agent-facing view of a scheduled AI-agent job (no secrets). */
function publicAiJob(j: Awaited<ReturnType<typeof aiAgentJobRepository.list>>[number]) {
  return {
    id: j.id,
    name: j.name,
    enabled: j.enabled,
    schedule: j.schedule,
    providerId: j.providerId,
    model: j.model || "default",
    projectId: j.projectId ?? null,
    projectPaths: j.projectPaths?.length ? j.projectPaths : (j.projectPath ? [j.projectPath] : []),
    agentMode: j.agentMode === "multi" ? "multi" : "single",
    category: j.category ?? "",
    tags: j.tags ?? [],
    nextJobId: j.nextJobId ?? null,
    ruleIds: j.ruleIds ?? [],
    prompt: j.prompt,
    rules: j.rules ?? "",
    lastRunAt: j.lastRunAt ?? null,
    lastStatus: j.lastStatus ?? null,
    lastError: j.lastError ?? null,
    lastLogFile: j.lastLogFile ?? null,
    running: aiCronSchedulerService.isRunning(j.id),
  };
}

function aiJobAllowed(job: { ownerUserId?: number | null; ownerScope?: string } | null): boolean {
  const user = getContextUser();
  if (!job || !user) return false;
  if (user.kind === "admin" && user.username !== "cron-agent") return true;
  if (user.username === "cron-agent") return job.ownerUserId != null && job.ownerUserId === getContextUserId() && !job.ownerScope?.startsWith("hosting:");
  const scope = presetScope(user);
  if (job.ownerScope) return job.ownerScope === scope;
  return user.kind !== "hosting" && job.ownerUserId != null && job.ownerUserId === getContextUserId();
}

/** Validate + normalize the editable fields of an AI-agent job from tool input. */
function aiJobPatchFromInput(input: Record<string, unknown>): { patch: Partial<AiAgentJob>; error?: string } {
  const patch: Partial<AiAgentJob> = {};
  const i = input as Record<string, any>;
  if (i.name !== undefined) patch.name = String(i.name).slice(0, 120);
  if (i.prompt !== undefined) patch.prompt = String(i.prompt).slice(0, 8000);
  if (i.rules !== undefined) patch.rules = String(i.rules).slice(0, 8000);
  if (i.schedule !== undefined) {
    const schedule = String(i.schedule).trim();
    if (schedule) {
      const v = cronParserService.validate(schedule);
      if (!v.valid) return { patch, error: `Expresión cron inválida: ${v.error}` };
    }
    patch.schedule = schedule; // "" = sin programación (solo manual/encadenado)
  }
  if (i.providerId !== undefined) {
    if (!(PROVIDER_IDS as readonly string[]).includes(String(i.providerId))) {
      return { patch, error: `providerId inválido. Usa uno de: ${PROVIDER_IDS.join(", ")}` };
    }
    patch.providerId = i.providerId as AssistantProviderId;
  }
  if (i.model !== undefined) patch.model = String(i.model).slice(0, 80);
  if (i.projectPaths !== undefined) {
    const paths = (Array.isArray(i.projectPaths) ? i.projectPaths : [])
      .map((p: unknown) => String(p).trim())
      .filter((p: string) => p.startsWith("/"));
    patch.projectPaths = paths;
    patch.projectPath = paths[0] ?? null;
  }
  if (i.agentMode !== undefined) {
    if (i.agentMode !== "single" && i.agentMode !== "multi") return { patch, error: "agentMode debe ser 'single' o 'multi'." };
    patch.agentMode = i.agentMode;
  }
  if (i.category !== undefined) patch.category = String(i.category).slice(0, 60);
  if (i.tags !== undefined) patch.tags = (Array.isArray(i.tags) ? i.tags : []).map((t: unknown) => String(t).slice(0, 40)).filter(Boolean);
  if (i.nextJobId !== undefined) patch.nextJobId = i.nextJobId ? String(i.nextJobId) : null;
  if (i.ruleIds !== undefined) patch.ruleIds = (Array.isArray(i.ruleIds) ? i.ruleIds : []).map((r: unknown) => String(r)).filter(Boolean);
  if (i.enabled !== undefined) patch.enabled = Boolean(i.enabled);
  return { patch };
}

export const cronAgentCapability: AgentCapability = {
  moduleId: "cron",
  version: 1,
  tools: [
    {
      name: "cron.list",
      title: "Listar tareas cron",
      description:
        "List the panel-managed and external cron jobs on the target. Returns id, schedule, " +
        "command, comment and whether each job is enabled (paused jobs are disabled).",
      kind: "read",
      permission: "cron",
      inputSchema: { type: "object", properties: { user: { type: "string", description: "Usuario Linux (solo administradores)." } } },
      handler: async (input) => {
        const { executor, owner, access } = await classicOwner((input as any)?.user);
        const jobs = await cronParserService.listWithExecutor(owner.username, executor, access);
        return { ok: true, output: jobs };
      },
    },
    {
      name: "cron.add",
      title: "Crear tarea cron",
      description:
        "Create a new cron job. Provide a 5-field cron `schedule` (or @alias), the `command` " +
        "to run (absolute path recommended) and an optional `comment`. The job is wrapped so " +
        "every run produces a per-execution log. Returns the new job id.",
      kind: "action",
      dangerous: true,
      permission: "cron",
      inputSchema: {
        type: "object",
        properties: {
          schedule: { type: "string", description: "Cron expression, e.g. '0 3 * * *' or '@daily'." },
          command: { type: "string", description: "Command to execute." },
          comment: { type: "string", description: "Optional human label." },
          user: { type: "string", description: "Usuario Linux (solo administradores)." },
        },
        required: ["schedule", "command"],
      },
      handler: async (input) => {
        const { schedule, command, comment } = (input ?? {}) as { schedule?: string; command?: string; comment?: string };
        if (!schedule || !command) return { ok: false, output: "schedule y command son obligatorios." };
        const v = cronParserService.validate(schedule);
        if (!v.valid) return { ok: false, output: `Expresión cron inválida: ${v.error}` };
        const { executor, owner, access } = await classicOwner((input as any)?.user);
        await cronDaemonService.ensureUserWrapper(executor, owner);
        const id = await cronParserService.addWithExecutor(schedule, command, comment ?? null, owner.username, executor, access);
        return { ok: true, output: { id, schedule, command } };
      },
    },
    {
      name: "cron.update",
      title: "Editar tarea cron",
      description: "Edit an existing cron job by `id`. Provide the new `schedule`, `command` and optional `comment`.",
      kind: "action",
      dangerous: true,
      permission: "cron",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          schedule: { type: "string" },
          command: { type: "string" },
          comment: { type: "string" },
          user: { type: "string", description: "Usuario Linux (solo administradores)." },
        },
        required: ["id", "schedule", "command"],
      },
      handler: async (input) => {
        const { id, schedule, command, comment } = (input ?? {}) as { id?: string; schedule?: string; command?: string; comment?: string };
        if (!id || !schedule || !command) return { ok: false, output: "id, schedule y command son obligatorios." };
        const v = cronParserService.validate(schedule);
        if (!v.valid) return { ok: false, output: `Expresión cron inválida: ${v.error}` };
        const { executor, owner, access } = await classicOwner((input as any)?.user);
        await cronDaemonService.ensureUserWrapper(executor, owner);
        const ok = await cronParserService.updateWithExecutor(id, schedule, command, comment ?? null, owner.username, executor, access);
        return ok ? { ok: true, output: { id } } : { ok: false, output: "No se encontró la tarea." };
      },
    },
    {
      name: "cron.toggle",
      title: "Pausar/activar tarea cron",
      description: "Pause or resume a cron job by `id`. Returns the resulting enabled state.",
      kind: "action",
      dangerous: true,
      permission: "cron",
      inputSchema: { type: "object", properties: { id: { type: "string" }, user: { type: "string", description: "Usuario Linux (solo administradores)." } }, required: ["id"] },
      handler: async (input) => {
        const { id } = (input ?? {}) as { id?: string };
        if (!id) return { ok: false, output: "id es obligatorio." };
        const { executor, owner, access } = await classicOwner((input as any)?.user);
        const { changed, enabled } = await cronParserService.toggleWithExecutor(id, owner.username, executor, access);
        return changed ? { ok: true, output: { id, enabled } } : { ok: false, output: "No se encontró la tarea." };
      },
    },
    {
      name: "cron.remove",
      title: "Eliminar tarea cron",
      description: "Delete a cron job by `id`.",
      kind: "action",
      dangerous: true,
      permission: "cron",
      inputSchema: { type: "object", properties: { id: { type: "string" }, user: { type: "string", description: "Usuario Linux (solo administradores)." } }, required: ["id"] },
      handler: async (input) => {
        const { id } = (input ?? {}) as { id?: string };
        if (!id) return { ok: false, output: "id es obligatorio." };
        const { executor, owner, access } = await classicOwner((input as any)?.user);
        const ok = await cronParserService.removeWithExecutor(id, owner.username, executor, access);
        return ok ? { ok: true, output: { id, removed: true } } : { ok: false, output: "No se encontró la tarea." };
      },
    },
    // -------------------------------------------------------------------------
    // Scheduled AI-agent jobs (oversight) — lets a SUPERVISOR agent inspect and
    // remediate OTHER scheduled AI-agent jobs (the `ai-agents.json` sidecar),
    // not the OS crontab. Read tools first, then the action tools.
    // -------------------------------------------------------------------------
    {
      name: "cron.ai_list",
      title: "Listar agentes IA programados",
      description:
        "List the scheduled AI-agent jobs configured on this panel. Returns each job's id, name, " +
        "schedule, enabled flag, provider/model and last-run bookkeeping (lastRunAt, lastStatus " +
        "['ok'|'error'|'running'|null], lastError, lastLogFile) plus whether it is running right now. " +
        "Use this to supervise the work of other scheduled AI agents.",
      kind: "read",
      permission: "cron",
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        const jobs = await aiAgentJobRepository.list(localExecutor);
        return { ok: true, output: jobs.filter(aiJobAllowed).map(publicAiJob) };
      },
    },
    {
      name: "cron.ai_logs",
      title: "Listar ejecuciones de un agente IA",
      description:
        "List recent execution logs of a scheduled AI-agent job by `jobId` (most recent first). " +
        "Each record has file, startedAt, finishedAt, exitCode (0 = ok), durationMs and running. " +
        "Use the file name with `cron.ai_read_log` to read the full output.",
      kind: "read",
      permission: "cron",
      inputSchema: {
        type: "object",
        properties: {
          jobId: { type: "string", description: "Id of the AI-agent job (from cron.ai_list)." },
          limit: { type: "number", description: "Max records (default 20, max 200)." },
        },
        required: ["jobId"],
      },
      handler: async (input) => {
        const { jobId, limit } = (input ?? {}) as { jobId?: string; limit?: number };
        if (!jobId) return { ok: false, output: "jobId es obligatorio." };
        if (!aiJobAllowed(await aiAgentJobRepository.get(jobId, localExecutor))) return { ok: false, output: "No se encontró el agente IA programado." };
        const logs = await cronLogService.list(jobId, localExecutor, Math.min(Math.max(1, limit ?? 20), 200));
        return { ok: true, output: logs };
      },
    },
    {
      name: "cron.ai_read_log",
      title: "Leer la ejecución de un agente IA",
      description:
        "Read the full text of one execution log of a scheduled AI-agent job. Provide `jobId` and the " +
        "`file` name returned by cron.ai_logs (e.g. '20260607T120000Z.log'). The log contains the " +
        "agent's output, the tools it called and any error — read it to evaluate the supervised agent's work.",
      kind: "read",
      permission: "cron",
      inputSchema: {
        type: "object",
        properties: {
          jobId: { type: "string" },
          file: { type: "string", description: "Log file name from cron.ai_logs." },
        },
        required: ["jobId", "file"],
      },
      handler: async (input) => {
        const { jobId, file } = (input ?? {}) as { jobId?: string; file?: string };
        if (!jobId || !file) return { ok: false, output: "jobId y file son obligatorios." };
        if (!aiJobAllowed(await aiAgentJobRepository.get(jobId, localExecutor))) return { ok: false, output: "No se encontró el agente IA programado." };
        try {
          const content = await cronLogService.read(jobId, file, localExecutor);
          return { ok: true, output: { jobId, file, content } };
        } catch (err) {
          return { ok: false, output: err instanceof Error ? err.message : String(err) };
        }
      },
    },
    {
      name: "cron.ai_run",
      title: "Ejecutar un agente IA programado ahora",
      description:
        "Trigger a scheduled AI-agent job to run now (async, fire-and-forget) by `id`. Useful for a " +
        "supervisor to re-run a job that last failed. Returns started=false with reason 'already-running' " +
        "if it is in progress. Inspect the result afterwards with cron.ai_logs / cron.ai_read_log.",
      kind: "action",
      dangerous: true,
      permission: "cron",
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      handler: async (input) => {
        const { id } = (input ?? {}) as { id?: string };
        if (!id) return { ok: false, output: "id es obligatorio." };
        const job = await aiAgentJobRepository.get(id, localExecutor);
        if (!aiJobAllowed(job)) return { ok: false, output: "No se encontró el agente IA programado." };
        if (aiCronSchedulerService.isRunning(id)) {
          return { ok: true, output: { id, started: false, reason: "already-running" } };
        }
        void aiCronSchedulerService.runJob(job!, localExecutor);
        return { ok: true, output: { id, started: true } };
      },
    },
    {
      name: "cron.ai_toggle",
      title: "Pausar/activar un agente IA programado",
      description: "Enable or disable a scheduled AI-agent job by `id`. Returns the resulting enabled state.",
      kind: "action",
      dangerous: true,
      permission: "cron",
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      handler: async (input) => {
        const { id } = (input ?? {}) as { id?: string };
        if (!id) return { ok: false, output: "id es obligatorio." };
        const job = await aiAgentJobRepository.get(id, localExecutor);
        if (!aiJobAllowed(job)) return { ok: false, output: "No se encontró el agente IA programado." };
        const updated = await aiAgentJobRepository.update(id, { enabled: !job!.enabled }, localExecutor);
        return { ok: true, output: { id, enabled: updated?.enabled ?? !job!.enabled } };
      },
    },
    {
      name: "cron.ai_add",
      title: "Crear agente IA programado",
      description:
        "Create a scheduled AI-agent job. Required: `name` and `prompt` (the task). Optional: `schedule` " +
        "(5-field cron or @alias; EMPTY/omitted = no schedule, runs only manually or chained), `providerId` " +
        "(claude|codex|gemini|deepseek|minimax, default claude), `model`, `projectPaths` (absolute git project " +
        "paths — more than one runs the task once PER project), `agentMode` ('single'|'multi' subagents), " +
        "`category`, `tags` (string[]), `rules` (ad-hoc text), `ruleIds` (rule-preset ids from cron.presets_get), " +
        "`nextJobId` (chain another job when this finishes) and `enabled`.",
      kind: "action",
      dangerous: true,
      permission: "cron",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          prompt: { type: "string", description: "Task handed to the agent on each run." },
          schedule: { type: "string", description: "Cron expr or @alias; empty = unscheduled." },
          providerId: { type: "string" },
          model: { type: "string" },
          projectPaths: { type: "array", items: { type: "string" } },
          agentMode: { type: "string", enum: ["single", "multi"] },
          category: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          rules: { type: "string" },
          ruleIds: { type: "array", items: { type: "string" } },
          nextJobId: { type: "string" },
          enabled: { type: "boolean" },
        },
        required: ["name", "prompt"],
      },
      handler: async (input) => {
        const i = (input ?? {}) as Record<string, unknown>;
        if (!i.name || !i.prompt) return { ok: false, output: "name y prompt son obligatorios." };
        const { patch, error } = aiJobPatchFromInput(i);
        if (error) return { ok: false, output: error };
        const executor = localExecutor;
        const actor = getContextUser();
        if (!actor || actor.username === "cron-agent") return { ok: false, output: "Esta operación requiere una sesión de usuario interactiva." };
        if (patch.nextJobId) {
          const next = await aiAgentJobRepository.get(patch.nextJobId, executor);
          if (!aiJobAllowed(next)) return { ok: false, output: "El agente encadenado (nextJobId) no existe." };
        }
        const created = await aiAgentJobRepository.create(
          {
            name: patch.name!,
            prompt: patch.prompt!,
            enabled: patch.enabled ?? true,
            schedule: patch.schedule ?? "",
            providerId: patch.providerId ?? "claude",
            model: patch.model ?? "",
            projectId: null,
            projectPath: patch.projectPath ?? null,
            projectPaths: patch.projectPaths ?? [],
            agentMode: patch.agentMode ?? "single",
            category: patch.category ?? "",
            tags: patch.tags ?? [],
            rules: patch.rules ?? "",
            ruleIds: patch.ruleIds ?? [],
            nextJobId: patch.nextJobId ?? null,
            ownerUserId: getContextUserId() ?? null,
            ownerScope: presetScope(actor),
            lastStatus: null,
            lastRunAt: null,
          },
          executor,
        );
        return { ok: true, output: publicAiJob(created as Parameters<typeof publicAiJob>[0]) };
      },
    },
    {
      name: "cron.ai_update",
      title: "Editar agente IA programado",
      description:
        "Edit a scheduled AI-agent job by `id`. Send ONLY the fields to change (same fields as cron.ai_add). " +
        "An empty `schedule` leaves the job unscheduled (manual/chained only).",
      kind: "action",
      dangerous: true,
      permission: "cron",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          prompt: { type: "string" },
          schedule: { type: "string" },
          providerId: { type: "string" },
          model: { type: "string" },
          projectPaths: { type: "array", items: { type: "string" } },
          agentMode: { type: "string", enum: ["single", "multi"] },
          category: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          rules: { type: "string" },
          ruleIds: { type: "array", items: { type: "string" } },
          nextJobId: { type: "string" },
          enabled: { type: "boolean" },
        },
        required: ["id"],
      },
      handler: async (input) => {
        const i = (input ?? {}) as Record<string, unknown>;
        const id = i.id ? String(i.id) : "";
        if (!id) return { ok: false, output: "id es obligatorio." };
        const { patch, error } = aiJobPatchFromInput(i);
        if (error) return { ok: false, output: error };
        if (patch.nextJobId === id) return { ok: false, output: "Un agente no puede encadenarse a sí mismo." };
        if (!Object.keys(patch).length) return { ok: false, output: "No se envió ningún campo a cambiar." };
        const executor = localExecutor;
        if (!aiJobAllowed(await aiAgentJobRepository.get(id, executor))) return { ok: false, output: "No se encontró el agente IA programado." };
        if (patch.nextJobId) {
          const next = await aiAgentJobRepository.get(patch.nextJobId, executor);
          if (!aiJobAllowed(next)) return { ok: false, output: "El agente encadenado (nextJobId) no existe." };
        }
        const updated = await aiAgentJobRepository.update(id, patch, executor);
        if (!updated) return { ok: false, output: "No se encontró el agente IA programado." };
        return { ok: true, output: publicAiJob(updated as Parameters<typeof publicAiJob>[0]) };
      },
    },
    {
      name: "cron.ai_remove",
      title: "Eliminar agente IA programado",
      description: "Delete a scheduled AI-agent job by `id`, including its execution logs.",
      kind: "action",
      dangerous: true,
      permission: "cron",
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      handler: async (input) => {
        const { id } = (input ?? {}) as { id?: string };
        if (!id) return { ok: false, output: "id es obligatorio." };
        const executor = localExecutor;
        if (!aiJobAllowed(await aiAgentJobRepository.get(id, executor))) return { ok: false, output: "No se encontró el agente IA programado." };
        const ok = await aiAgentJobRepository.delete(id, executor);
        if (!ok) return { ok: false, output: "No se encontró el agente IA programado." };
        await cronLogService.clear(id, executor).catch(() => undefined);
        return { ok: true, output: { id, removed: true } };
      },
    },
    // -------------------------------------------------------------------------
    // Module configuration (presets): categories, tags-per-category and
    // reusable rule snippets offered as selectors in the agent dialog.
    // -------------------------------------------------------------------------
    {
      name: "cron.presets_get",
      title: "Leer configuración de agentes (presets)",
      description:
        "Read the cron module's agent presets: `categories` (string[]), `tags` ([{name, category}] — each tag " +
        "belongs to a category) and `rules` ([{id, title, text}] reusable rule snippets referenced by jobs via ruleIds).",
      kind: "read",
      permission: "cron",
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        const actor = getContextUser();
        if (!actor || actor.username === "cron-agent") return { ok: false, output: "Esta operación requiere una sesión de usuario interactiva." };
        const data = await agentPresetsRepository.get(localExecutor, presetScope(actor));
        return { ok: true, output: data };
      },
    },
    {
      name: "cron.presets_set",
      title: "Guardar configuración de agentes (presets)",
      description:
        "REPLACE the cron module's agent presets document. Always call cron.presets_get first and send back the " +
        "COMPLETE edited document: `categories` (string[]), `tags` ([{name, category}] — category is required and " +
        "must exist in categories) and `rules` ([{id?, title, text}] — keep existing ids to preserve job references; " +
        "omit id only for NEW rules).",
      kind: "action",
      dangerous: true,
      permission: "cron",
      inputSchema: {
        type: "object",
        properties: {
          categories: { type: "array", items: { type: "string" } },
          tags: {
            type: "array",
            items: { type: "object", properties: { name: { type: "string" }, category: { type: "string" } }, required: ["name", "category"] },
          },
          rules: {
            type: "array",
            items: {
              type: "object",
              properties: { id: { type: "string" }, title: { type: "string" }, text: { type: "string" } },
              required: ["title", "text"],
            },
          },
        },
      },
      handler: async (input) => {
        const i = (input ?? {}) as Record<string, any>;
        const categories = [...new Set(((Array.isArray(i.categories) ? i.categories : []) as unknown[]).map((c) => String(c).trim().slice(0, 60)).filter(Boolean))];
        const seen = new Set<string>();
        const tags = ((Array.isArray(i.tags) ? i.tags : []) as Array<{ name?: unknown; category?: unknown }>)
          .map((t) => ({ name: String(t?.name ?? "").trim().slice(0, 40), category: String(t?.category ?? "").trim().slice(0, 60) }))
          .filter((t) => t.name && t.category)
          .filter((t) => {
            const key = `${t.category} ${t.name}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        const rules = ((Array.isArray(i.rules) ? i.rules : []) as Array<{ id?: unknown; title?: unknown; text?: unknown }>)
          .map((r) => ({ id: r?.id ? String(r.id) : randomUUID(), title: String(r?.title ?? "").trim().slice(0, 80), text: String(r?.text ?? "").trim().slice(0, 4000) }))
          .filter((r) => r.title && r.text);
        const actor = getContextUser();
        if (!actor || actor.username === "cron-agent") return { ok: false, output: "Esta operación requiere una sesión de usuario interactiva." };
        const data = await agentPresetsRepository.save({ categories, tags, rules }, localExecutor, presetScope(actor));
        return { ok: true, output: data };
      },
    },
  ],
  suggestedPrompts: [
    "¿Qué tareas cron tengo programadas?",
    "Crea una tarea cron que ejecute /opt/scripts/backup.sh cada día a las 3am",
    "Revisa los agentes IA programados y dime si alguno falló en su última ejecución",
    "Crea un agente IA sin programación que refactorice /var/www/MIAPP y encadénalo al agente de revisión diaria",
    "Añade la categoría 'Mantenimiento' con los tags 'logs' y 'backups' a la configuración del módulo",
  ],
};
