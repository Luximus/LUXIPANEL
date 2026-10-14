// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Cron jobs controller — list, add, update, toggle, remove crontab entries.
 *
 * Panel-created jobs are written through the `lxp-cron-run` wrapper so every
 * run produces a per-execution `.log`. The wrapper is ensured (idempotently)
 * before each mutation. The jobs list is parsed LIVE (not from the collector
 * cache) so the wrapper format + paused state resolve through our TS parser.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { cronParserService } from "../services/cron-parser.service.js";
import { cronInvalidExpressionMessage, localizeCronValidationError } from "../services/cron-descriptions.js";
import { cronDaemonService } from "../services/cron-daemon.service.js";
import { cronLogService } from "../services/cron-log.service.js";
import { ValidationError, NotFoundError } from "../../../shared/errors/index.js";
import type { MutationStep, SubmitMutationInput } from "../../../shared/remote-cache/submit-mutation.js";
import { dispatchMutation } from "../../../shared/remote-cache/dispatch-mutation.js";
import { CACHE_KEYS } from "../../../shared/cache/cacheable-modules.js";
import { resolveCronOwner, listCronUsers, cronUserWrapperPath, cronUserLogsRoot, type CronOwner } from "../services/cron-owner.service.js";

/** Steps to install a full crontab body via the write-behind queue. */
function crontabWriteSteps(content: string, owner: CronOwner): MutationStep[] {
  const tmp = `/tmp/.lxp-cron-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const body = content.endsWith("\n") ? content : `${content}\n`;
  return [
    { type: "writeFile", path: tmp, content: body, mode: "0600", root: false },
    { type: "sh", argv: owner.direct ? ["crontab", tmp] : ["crontab", "-u", owner.username, tmp], sudo: !owner.direct },
    { type: "sh", argv: ["rm", "-f", tmp], sudo: false },
  ];
}

const upsertSchema = z.object({
  schedule: z.string().min(2).max(120).trim(),
  command: z.string().min(1).max(1000).trim(),
  // Reject CR/LF and "%" outright: interpolated literally into the crontab
  // line, they let an attacker inject extra jobs / MAILTO or a stdin split
  // (audit §5). buildManagedLine also strips them as defense in depth.
  comment: z.string().max(200).trim().regex(/^[^\r\n%]*$/, "El comentario no puede contener saltos de línea ni '%'").optional(),
  user: z.string().optional(),
});

const requestedUser = (value: unknown) => typeof value === "string" ? value : undefined;

async function dispatchCronMutation<T>(opts: {
  executor: ReturnType<typeof getExecutor>;
  owner: CronOwner;
  local: () => Promise<T>;
  remote: () => Promise<{ data: T; submit: SubmitMutationInput }>;
}) {
  // A direct/hosting executor already runs as the Linux owner. A remote worker
  // would run as its service account, so those requests must execute live.
  if (opts.owner.direct) return { data: await opts.local() };
  return dispatchMutation(opts);
}

export const jobsController = {
  /** GET /api/cron/users — Linux account picker for admins only. */
  users: asyncHandler(async (req: Request, res: Response) => {
    res.json({ ok: true, data: await listCronUsers(getExecutor(req)) });
  }),

  /** GET /api/cron/jobs — live parse so wrapper/paused state resolve. */
  list: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const owner = await resolveCronOwner(res.locals.user, executor, requestedUser(req.query.user));
    const jobs = await cronParserService.listWithExecutor(owner.username, executor, owner);
    res.json({ ok: true, data: jobs });
  }),

  /** POST /api/cron/jobs — add a new (wrapped, logged) cron job. */
  add: asyncHandler(async (req: Request, res: Response) => {
    const body = upsertSchema.parse(req.body);
    const validation = cronParserService.validate(body.schedule);
    if (!validation.valid) throw new ValidationError(cronInvalidExpressionMessage(validation.error, res.locals.locale));

    const executor = getExecutor(req);
    const owner = await resolveCronOwner(res.locals.user, executor, body.user);
    await cronDaemonService.ensureUserWrapper(executor, owner);
    const access = { direct: owner.direct, wrapperPath: owner.username === "root" ? undefined : cronUserWrapperPath(owner) };

    const out = await dispatchCronMutation({ executor, owner,
      local: async () => ({
        id: await cronParserService.addWithExecutor(
          body.schedule, body.command, body.comment ?? null, owner.username, executor, access,
        ),
      }),
      remote: async () => {
        const { content, jobId } = await cronParserService.planAddWithExecutor(
          body.schedule, body.command, body.comment ?? null, owner.username, executor, access,
        );
        return {
          data: { id: jobId },
          submit: {
            module: CACHE_KEYS.cron.jobs.module, collection: CACHE_KEYS.cron.jobs.collection, op: "create" as const,
            steps: crontabWriteSteps(content, owner), refresh: [["cron", "jobs"]] as Array<[string, string]>,
          },
        };
      },
    });
    res.status(201).json({ ok: true, data: out.data, ...(out.job ? { job: out.job } : {}) });
  }),

  /** PUT /api/cron/jobs/:id — edit an existing job (preserves paused state). */
  update: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const body = upsertSchema.parse(req.body);
    const validation = cronParserService.validate(body.schedule);
    if (!validation.valid) throw new ValidationError(cronInvalidExpressionMessage(validation.error, res.locals.locale));

    const executor = getExecutor(req);
    const owner = await resolveCronOwner(res.locals.user, executor, body.user);
    await cronDaemonService.ensureUserWrapper(executor, owner);
    const access = { direct: owner.direct, wrapperPath: owner.username === "root" ? undefined : cronUserWrapperPath(owner) };

    const out = await dispatchCronMutation<void>({
      executor, owner,
      local: async () => {
        const changed = await cronParserService.updateWithExecutor(
          id, body.schedule, body.command, body.comment ?? null, owner.username, executor, access,
        );
        if (!changed) throw new NotFoundError("Cron job");
      },
      remote: async () => {
        const { content, changed } = await cronParserService.planUpdateWithExecutor(
          id, body.schedule, body.command, body.comment ?? null, owner.username, executor, access,
        );
        if (!changed) throw new NotFoundError("Cron job");
        return {
          data: undefined,
          submit: {
            module: CACHE_KEYS.cron.jobs.module, collection: CACHE_KEYS.cron.jobs.collection, op: "update" as const,
            steps: crontabWriteSteps(content, owner), refresh: [["cron", "jobs"]] as Array<[string, string]>,
          },
        };
      },
    });
    res.json({ ok: true, ...(out.job ? { job: out.job } : {}) });
  }),

  /** POST /api/cron/jobs/:id/toggle — pause / resume a job. */
  toggle: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const executor = getExecutor(req);
    const owner = await resolveCronOwner(res.locals.user, executor, requestedUser(req.query.user));

    const out = await dispatchCronMutation({
      executor, owner,
      local: async () => {
        const { changed, enabled } = await cronParserService.toggleWithExecutor(id, owner.username, executor, owner);
        if (!changed) throw new NotFoundError("Cron job");
        return { enabled };
      },
      remote: async () => {
        const { content, changed, enabled } = await cronParserService.planToggleWithExecutor(id, owner.username, executor, owner);
        if (!changed) throw new NotFoundError("Cron job");
        return {
          data: { enabled },
          submit: {
            module: CACHE_KEYS.cron.jobs.module, collection: CACHE_KEYS.cron.jobs.collection, op: "update" as const,
            steps: crontabWriteSteps(content, owner), refresh: [["cron", "jobs"]] as Array<[string, string]>,
          },
        };
      },
    });
    res.json({ ok: true, data: out.data, ...(out.job ? { job: out.job } : {}) });
  }),

  /** DELETE /api/cron/jobs/:id — remove a cron entry and its logs. */
  remove: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const executor = getExecutor(req);
    const owner = await resolveCronOwner(res.locals.user, executor, requestedUser(req.query.user));

    const out = await dispatchCronMutation<void>({
      executor, owner,
      local: async () => {
        const removed = await cronParserService.removeWithExecutor(id, owner.username, executor, owner);
        if (!removed) throw new NotFoundError("Cron job");
        if (owner.username !== "root") await cronLogService.clear(id, executor, cronUserLogsRoot(owner), owner.direct ? undefined : owner.username);
        else await cronLogService.clear(id, executor);
      },
      remote: async () => {
        const { content, changed } = await cronParserService.planRemoveWithExecutor(id, owner.username, executor, owner);
        if (!changed) throw new NotFoundError("Cron job");
        return {
          data: undefined,
          submit: {
            module: CACHE_KEYS.cron.jobs.module, collection: CACHE_KEYS.cron.jobs.collection, op: "delete" as const,
            steps: crontabWriteSteps(content, owner), refresh: [["cron", "jobs"]] as Array<[string, string]>,
          },
        };
      },
    });
    res.json({ ok: true, ...(out.job ? { job: out.job } : {}) });
  }),

  /** POST /api/cron/validate — validate + describe a cron expression. */
  validate: asyncHandler(async (req: Request, res: Response) => {
    const { expression } = z.object({ expression: z.string() }).parse(req.body);
    const result = cronParserService.validate(expression);
    const description = result.valid ? cronParserService.describe(expression, res.locals.locale) : undefined;
    res.json({ ok: true, data: { ...result, error: localizeCronValidationError(result.error, res.locals.locale), description } });
  }),
};
