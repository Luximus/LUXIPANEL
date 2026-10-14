// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Scheduled AI-agent jobs controller — CRUD + toggle + run-now + logs.
 * Provider/model mirror the AI Assistant; the agent's tool permissions come
 * from the Assistant's module-access gating (not configured here).
 *
 * INSTANCE STATE — pinned to `localExecutor` ON PURPOSE. Do NOT "fix" this to
 * a per-server context executor. AI-agent job orchestration (definitions,
 * schedules, approvals, run logs) is state of THIS panel installation, read at
 * boot and on the panel-host timer with no server connected — exactly like the
 * MCP registry and module catalog. It is NOT per-connected-server data; routing
 * it through `getContextExecutor()` would break the scheduler (no executor in
 * scope on the tick) and scatter one panel's orchestration across every target.
 * The agent's TOOLS still act on the connected target via its own executor.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { emailSchema } from "../../../shared/validators/index.js";
import { localExecutor, type Executor } from "../../../shared/executor/index.js";
import { getContextUserId, getContextUser } from "../../../shared/executor/context.js";
import { AppError, ValidationError } from "../../../shared/errors/index.js";
import { ErrorCodes } from "../../../shared/errors/codes.js";
import { randomUUID } from "node:crypto";
import { cronParserService } from "../services/cron-parser.service.js";
import { aiAgentJobRepository } from "../repositories/ai-agent-job.repository.js";
import { agentPresetsRepository, presetScope } from "../repositories/agent-presets.repository.js";
import { aiCronSchedulerService } from "../services/ai-cron-scheduler.service.js";
import { panelUserRepository } from "../../auth/repositories/panel-user.repository.js";
import { cronLogService } from "../services/cron-log.service.js";
import { PROVIDER_IDS, type AssistantProviderId } from "../../ai-assistant/models/assistant-config.types.js";
import { aiJobsMessage } from "./ai-jobs-i18n.js";
import { cronInvalidExpressionMessage } from "../services/cron-descriptions.js";
import { isHostingSession } from "../../../shared/tenant/tenant-scope.js";

const providerEnum = z.enum(PROVIDER_IDS as unknown as [string, ...string[]]);

/**
 * Notification/approval emails for AI-cron jobs are delivered to the RECOVERY
 * EMAIL of the Linux user who owns (created) the job — the same address the
 * scheduler resolves at send time. If a job opts into mail (requireApproval or a
 * notify marker) but that user has no recovery email registered, refuse the
 * create/update and ask them to set it on their user first.
 */
async function assertRecoveryEmailForMail(
  wantsEmail: boolean,
  ownerUserId: number | null,
  executor: Executor,
  locale: unknown,
): Promise<void> {
  if (!wantsEmail) return;
  const owner = ownerUserId != null ? await panelUserRepository.findById(ownerUserId, executor) : undefined;
  if (!owner?.email?.trim()) {
    throw new ValidationError(aiJobsMessage(locale, "recoveryEmailRequired"));
  }
}

/**
 * IDOR guard (audit §5): AI-cron jobs carry the creator's `ownerUserId`, but
 * the CRUD/logs/run handlers resolved purely by `id`, so any user with the
 * `cron` module could read prompts+logs, edit, run or delete another user's
 * jobs. Admin sessions bypass (they manage the whole instance); everyone else
 * is confined to jobs they own. A mismatch surfaces as 404 so job existence
 * isn't leaked.
 */
function isAdminCtx(): boolean {
  return getContextUser()?.kind === "admin";
}
function ownsJob(job: { ownerUserId?: number | null; ownerScope?: string }): boolean {
  if (isAdminCtx()) return true;
  const scope = presetScope(getContextUser() ?? undefined);
  if (job.ownerScope) return Boolean(scope && job.ownerScope === scope);
  // Legacy jobs had only the panel user id; hosting ids can overlap those.
  if (isHostingSession(getContextUser())) return false;
  const uid = getContextUserId();
  return uid != null && job.ownerUserId === uid;
}
function jobNotFound(locale: unknown): AppError {
  return new AppError(aiJobsMessage(locale, "jobNotFound"), 404, ErrorCodes.NOT_FOUND);
}
function assertOwnsJob(job: { ownerUserId?: number | null; ownerScope?: string }, locale: unknown): void {
  if (!ownsJob(job)) throw jobNotFound(locale);
}

/** Throw a ValidationError if a non-empty schedule isn't a valid cron expr. */
function assertValidSchedule(schedule: string | undefined, locale: unknown): void {
  if (!schedule) return;
  const v = cronParserService.validate(schedule);
  if (!v.valid) throw new ValidationError(cronInvalidExpressionMessage(v.error, locale));
}

/**
 * Assigned project roots (B-40): up to 20 absolute paths. Declared once and
 * reused by `upsertSchema` and `bulkSchema.patch` so the cap/message can never
 * drift between "create/update" and "bulk patch".
 */
const projectPathsSchema = z
  .array(z.string().max(500).trim().refine((v) => v.startsWith("/"), { message: "ruta absoluta requerida" }))
  .max(20);

/** Merge the project-paths array with the legacy single-path field, dropping empties. */
function normalizeProjectPaths(projectPaths: string[] | undefined, projectPath: string | null | undefined): string[] {
  return (projectPaths ?? (projectPath ? [projectPath] : [])).filter(Boolean);
}

const upsertSchema = z.object({
  name: z.string().min(1).max(120).trim(),
  /** Empty = no schedule: the job only runs via "run now" or chained (nextJobId). */
  schedule: z.string().max(120).trim().optional().default(""),
  providerId: providerEnum,
  model: z.string().max(80).trim().optional().default(""),
  /** Optional saved custom agent (AI Assistant `/agents`) to run. */
  agentId: z.string().max(64).nullable().optional(),
  projectId: z.string().max(64).nullable().optional(),
  projectPath: z
    .string()
    .max(500)
    .trim()
    .nullable()
    .optional()
    .refine((v) => v == null || v === "" || v.startsWith("/"), {
      message: "projectPath debe ser una ruta absoluta",
    }),
  projectPaths: projectPathsSchema.optional(),
  nextJobId: z.string().max(64).nullable().optional(),
  agentMode: z.enum(["single", "multi"]).optional().default("single"),
  category: z.string().max(60).trim().optional().default(""),
  tags: z.array(z.string().max(40).trim()).max(20).optional().default([]),
  prompt: z.string().min(1).max(8000),
  rules: z.string().max(8000).optional(),
  ruleIds: z.array(z.string().min(1).max(64)).max(50).optional().default([]),
  notifyEmails: z.array(emailSchema).max(10).optional().default([]),
  /** Opt-in: report goes to the OWNER's recovery email (resolved at send time). */
  notifyOwner: z.boolean().optional().default(false),
  requireApproval: z.boolean().optional().default(false),
  /** Background execution is manual unless the owner explicitly opts in. */
  approvalModeOverride: z.enum(["manual", "auto", "plan"]).optional(),
  enabled: z.boolean().optional().default(true),
});

const presetsSchema = z.object({
  categories: z.array(z.string().min(1).max(60).trim()).max(50).default([]),
  tags: z
    .array(
      z.object({
        name: z.string().min(1).max(40).trim(),
        category: z.string().min(1).max(60).trim(),
      }),
    )
    .max(100)
    .default([]),
  rules: z
    .array(
      z.object({
        id: z.string().max(64).optional(),
        title: z.string().min(1).max(80).trim(),
        text: z.string().min(1).max(4000),
      }),
    )
    .max(50)
    .default([]),
});

const bulkSchema = z.object({
  ids: z.array(z.string().min(1).max(64)).min(1).max(200),
  patch: z
    .object({
      category: z.string().max(60).trim().optional(),
      tags: z.array(z.string().min(1).max(40).trim()).max(20).optional(),
      agentMode: z.enum(["single", "multi"]).optional(),
      enabled: z.boolean().optional(),
      /** REPLACES the assigned projects ([] = remove all). */
      projectPaths: projectPathsSchema.optional(),
      providerId: providerEnum.optional(),
      /** "" = provider default model. */
      model: z.string().max(80).trim().optional(),
    })
    .refine((p) => Object.keys(p).length > 0, { message: "patch vacío" }),
});

// Scheduled AI-agent jobs are INSTANCE state, not per-server: the scheduler
// (`_tick`) reads/runs them with `localExecutor` (panel host). The CRUD below
// MUST persist to the same host store — using `getExecutor(req)` wrote jobs to
// the connected tenant's sidecar, which the host-side tick never saw (only
// "run now" worked). Pin every persistence/log/run op to `localExecutor` so the
// reader and writer agree.
export const aiJobsController = {
  /** GET /api/cron/agent-presets — reusable categories/tags/rules. */
  getPresets: asyncHandler(async (_req: Request, res: Response) => {
    const executor = localExecutor;
    const scope = presetScope(res.locals.user);
    let data = await agentPresetsRepository.get(executor, scope);
    if (res.locals.user.kind === "admin" && !data.categories.length && !data.tags.length && !data.rules.length) {
      const legacy = await agentPresetsRepository.get(executor);
      if (legacy.categories.length || legacy.tags.length || legacy.rules.length) data = await agentPresetsRepository.save(legacy, executor, scope);
    }
    res.json({ ok: true, data });
  }),

  /** PUT /api/cron/agent-presets — replace the presets document. */
  savePresets: asyncHandler(async (req: Request, res: Response) => {
    const body = presetsSchema.parse(req.body);
    const dedup = (xs: string[]) => [...new Set(xs.filter(Boolean))];
    const seenTags = new Set<string>();
    const tags = body.tags.filter((t) => {
      const key = `${t.category}\u0000${t.name}`;
      if (seenTags.has(key)) return false;
      seenTags.add(key);
      return true;
    });
    const executor = localExecutor;
    const data = await agentPresetsRepository.save(
      {
        categories: dedup(body.categories),
        tags,
        rules: body.rules.map((r) => ({ id: r.id || randomUUID(), title: r.title, text: r.text })),
      },
      executor,
      presetScope(res.locals.user),
    );
    res.json({ ok: true, data });
  }),

  /** POST /api/cron/ai-jobs/bulk — apply a partial patch to many jobs at once. */
  bulk: asyncHandler(async (req: Request, res: Response) => {
    const { ids, patch } = bulkSchema.parse(req.body);
    const executor = localExecutor;
    const applied: Record<string, unknown> = { ...patch };
    if (patch.providerId) applied.providerId = patch.providerId as AssistantProviderId;
    // Keep the legacy single-path mirror in sync with the array.
    if (patch.projectPaths) applied.projectPath = patch.projectPaths[0] ?? null;
    let updated = 0;
    for (const id of ids) {
      // Ownership guard (audit §5): only patch jobs the caller owns (admin: all).
      const existing = await aiAgentJobRepository.get(id, executor).catch(() => null);
      if (!existing || !ownsJob(existing)) continue;
      const r = await aiAgentJobRepository.update(id, applied, executor).catch(() => null);
      if (r) updated += 1;
    }
    res.json({ ok: true, data: { updated } });
  }),

  /** GET /api/cron/ai-jobs — list scheduled agent jobs. */
  list: asyncHandler(async (_req: Request, res: Response) => {
    const executor = localExecutor;
    const jobs = await aiAgentJobRepository.list(executor);
    const visible = jobs.filter((j) => ownsJob(j));
    const data = visible.map((j) => ({ ...j, running: aiCronSchedulerService.isRunning(j.id) }));
    res.json({ ok: true, data });
  }),

  /** POST /api/cron/ai-jobs — create a scheduled agent job. */
  create: asyncHandler(async (req: Request, res: Response) => {
    const body = upsertSchema.parse(req.body);
    assertValidSchedule(body.schedule, res.locals.locale);
    const executor = localExecutor;
    if (body.nextJobId) {
      const next = await aiAgentJobRepository.get(body.nextJobId, executor);
      if (!next || !ownsJob(next)) throw new ValidationError(aiJobsMessage(res.locals.locale, "chainedAgentMissing"));
    }
    await assertRecoveryEmailForMail(
      body.requireApproval || body.notifyOwner || body.notifyEmails.length > 0,
      getContextUserId() ?? null,
      executor,
      res.locals.locale,
    );
    const projectPaths = normalizeProjectPaths(body.projectPaths, body.projectPath);
    const created = await aiAgentJobRepository.create(
      {
        name: body.name,
        enabled: body.enabled,
        schedule: body.schedule,
        providerId: body.providerId as AssistantProviderId,
        model: body.model,
        agentId: body.agentId ?? null,
        projectId: body.projectId ?? null,
        projectPath: projectPaths[0] ?? null,
        projectPaths,
        nextJobId: body.nextJobId ?? null,
        agentMode: body.agentMode,
        category: body.category,
        tags: body.tags.filter(Boolean),
        prompt: body.prompt,
        rules: body.rules ?? "",
        ruleIds: body.ruleIds,
        notifyEmails: body.notifyEmails,
        notifyOwner: body.notifyOwner,
        requireApproval: body.requireApproval,
        approvalModeOverride: body.approvalModeOverride ?? "manual",
        ownerUserId: getContextUserId() ?? null,
        ownerScope: presetScope(res.locals.user),
        lastStatus: null,
        lastRunAt: null,
      },
      executor,
    );
    res.status(201).json({ ok: true, data: created });
  }),

  /** PUT /api/cron/ai-jobs/:id — edit a scheduled agent job. */
  update: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const body = upsertSchema.parse(req.body);
    assertValidSchedule(body.schedule, res.locals.locale);
    if (body.nextJobId === id) throw new ValidationError(aiJobsMessage(res.locals.locale, "selfChain"));
    const executor = localExecutor;
    if (body.nextJobId) {
      const next = await aiAgentJobRepository.get(body.nextJobId, executor);
      if (!next || !ownsJob(next)) throw new ValidationError(aiJobsMessage(res.locals.locale, "chainedAgentMissing"));
    }
    const existing = await aiAgentJobRepository.get(id, executor);
    if (!existing) throw jobNotFound(res.locals.locale);
    assertOwnsJob(existing, res.locals.locale);
    await assertRecoveryEmailForMail(
      body.requireApproval || body.notifyOwner || body.notifyEmails.length > 0,
      existing?.ownerUserId ?? getContextUserId() ?? null,
      executor,
      res.locals.locale,
    );
    const projectPaths = normalizeProjectPaths(body.projectPaths, body.projectPath);
    const updated = await aiAgentJobRepository.update(
      id,
      {
        name: body.name,
        enabled: body.enabled,
        schedule: body.schedule,
        providerId: body.providerId as AssistantProviderId,
        model: body.model,
        agentId: body.agentId ?? null,
        projectId: body.projectId ?? null,
        projectPath: projectPaths[0] ?? null,
        projectPaths,
        nextJobId: body.nextJobId ?? null,
        agentMode: body.agentMode,
        category: body.category,
        tags: body.tags.filter(Boolean),
        prompt: body.prompt,
        rules: body.rules ?? "",
        ruleIds: body.ruleIds,
        notifyEmails: body.notifyEmails,
        notifyOwner: body.notifyOwner,
        requireApproval: body.requireApproval,
        ...(body.approvalModeOverride ? { approvalModeOverride: body.approvalModeOverride } : {}),
      },
      executor,
    );
    if (!updated) throw jobNotFound(res.locals.locale);
    res.json({ ok: true, data: updated });
  }),

  /** POST /api/cron/ai-jobs/:id/toggle — enable/disable. */
  toggle: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const executor = localExecutor;
    const job = await aiAgentJobRepository.get(id, executor);
    if (!job) throw jobNotFound(res.locals.locale);
    assertOwnsJob(job, res.locals.locale);
    const updated = await aiAgentJobRepository.update(id, { enabled: !job.enabled }, executor);
    res.json({ ok: true, data: { enabled: updated?.enabled } });
  }),

  /** DELETE /api/cron/ai-jobs/:id — remove a job and its logs. */
  remove: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const executor = localExecutor;
    const existing = await aiAgentJobRepository.get(id, executor);
    if (!existing) throw jobNotFound(res.locals.locale);
    assertOwnsJob(existing, res.locals.locale);
    const ok = await aiAgentJobRepository.delete(id, executor);
    if (!ok) throw jobNotFound(res.locals.locale);
    await cronLogService.clear(id, executor).catch(() => undefined);
    res.json({ ok: true });
  }),

  /** POST /api/cron/ai-jobs/:id/run — execute the agent now (async). */
  run: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const executor = localExecutor;
    const job = await aiAgentJobRepository.get(id, executor);
    if (!job) throw jobNotFound(res.locals.locale);
    assertOwnsJob(job, res.locals.locale);
    if (aiCronSchedulerService.isRunning(id)) {
      res.json({ ok: true, data: { started: false, reason: "already-running" } });
      return;
    }
    // Fire and forget — the UI polls logs/status. The agent runs with
    // localExecutor (the panel host), not the connected target. `.catch` so an
    // unexpected throw can't become an unhandledRejection.
    void aiCronSchedulerService.runJob(job, executor).catch(() => undefined);
    res.json({ ok: true, data: { started: true } });
  }),

  /** GET /api/cron/ai-jobs/:id/logs — list execution logs of an agent job. */
  logs: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const executor = localExecutor;
    const job = await aiAgentJobRepository.get(id, executor);
    if (!job) throw jobNotFound(res.locals.locale);
    assertOwnsJob(job, res.locals.locale);
    const data = await cronLogService.list(id, executor, 50);
    res.json({ ok: true, data });
  }),

  /** GET /api/cron/ai-jobs/:id/logs/:file — read one execution log. */
  readLog: asyncHandler(async (req: Request, res: Response) => {
    const { id, file } = z
      .object({ id: z.string(), file: z.string() })
      .parse({ id: req.params.id, file: req.params.file });
    const executor = localExecutor;
    const job = await aiAgentJobRepository.get(id, executor);
    if (!job) throw jobNotFound(res.locals.locale);
    assertOwnsJob(job, res.locals.locale);
    const content = await cronLogService.read(id, file, executor);
    res.json({ ok: true, data: { file, content } });
  }),
};
