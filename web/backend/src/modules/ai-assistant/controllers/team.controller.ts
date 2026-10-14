// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Team task board — REST surface for the leader→workers delegation cycle.
 *
 *   GET  /api/ai/team/tasks?conversationId=…   board of a leader chat (reconciled)
 *   GET  /api/ai/team/tasks/active             every non-terminal task (Dashboard)
 *   GET  /api/ai/team/plan?conversationId=…    latest plan of a leader chat
 *   POST /api/ai/team/tasks/:id/cancel         stop the worker run + mark canceled
 *
 * The board itself is written by the leader's `team.assign`/`team.collect`
 * tools (see team-tools.ts); these endpoints only read/cancel, so the UI can
 * rehydrate progress cards after a reload and the Dashboard can show teams at
 * work.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import type { SessionUser } from "../../../shared/types/index.js";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { AppError, ValidationError } from "../../../shared/errors/index.js";
import { ErrorCodes } from "../../../shared/errors/codes.js";
import { apiModuleMessage, localizeTeamTaskFailure } from "../../../shared/i18n/module-messages.js";
import { zodIssues } from "../../../shared/validators/index.js";
import { teamTasksService, validateWorkerProject } from "../services/team-tasks.service.js";
import { teamTasksRepository } from "../repositories/team-tasks.repository.js";
import { usageRepository } from "../repositories/usage.repository.js";
import { conversationsRepository } from "../repositories/conversations.repository.js";
import { agentsRepository } from "../repositories/agents.repository.js";
import { teamFeedbackRepository } from "../repositories/team-feedback.repository.js";
import { agentService } from "../services/agent.service.js";
import { isTerminalTaskStatus, sanitizeTaskTitle, toTaskView, toTeamTaskSnapshot } from "../models/team-task.types.js";

function requireConversationId(req: Request, locale: unknown): string {
  const raw = req.query["conversationId"];
  const id = typeof raw === "string" ? raw.trim() : "";
  if (!id || id.length > 64) throw new ValidationError(apiModuleMessage(locale, "conversationIdRequired"));
  return id;
}

function taskNotFound(locale: unknown, key: "teamTaskNotFound" | "teamTaskDiffMissing" = "teamTaskNotFound"): AppError {
  return new AppError(apiModuleMessage(locale, key), 404, ErrorCodes.NOT_FOUND);
}

export const teamController = {
  /** Tasks anchored to a leader conversation, reconciled (stale running tasks
   *  orphaned by a restart get closed from the persisted worker chat). */
  tasks: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const conversationId = requireConversationId(req, res.locals.locale);
    const tasks = await teamTasksService.listForLeaderConversation(executor, conversationId);
    res.json({ ok: true, tasks: tasks.map(toTaskView) });
  }),

  /** Every non-terminal task on this server (Dashboard "teams at work"). */
  active: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const tasks = await teamTasksService.listActive(executor);
    res.json({ ok: true, tasks: tasks.map(toTaskView) });
  }),

  /** Resolve the LEADER chat that spawned a given worker conversation, so a
   *  worker chat can offer a "back to leader" affordance regardless of how it
   *  was opened (board click, Dashboard, reload). Null when not a worker. */
  byWorker: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const workerConversationId = requireConversationId(req, res.locals.locale);
    const task = await teamTasksRepository.findByWorkerConversation(executor, workerConversationId);
    res.json({
      ok: true,
      task: task
        ? {
            leaderConversationId: task.leaderConversationId,
            leaderAgentId: task.leaderAgentId,
            workerAgentName: task.workerAgentName,
          }
        : null,
    });
  }),

  /**
   * Conversation-scoped rehydration snapshot: EVERY delegated task of a leader
   * chat (running AND terminal, reconciled) + the plan header + a completed/
   * total counter, in the assignee-first shape the frontend needs to REBUILD
   * the "Equipo trabajando" process block from the chat history after a reload
   * (the block was live-only before and vanished on refresh). One fetch by
   * `conversationId` on thread load; per-server, fail-closed via the executor.
   * `completed` counts tasks in `done` (M = total, N = done → "N de M tareas
   * completadas"); `terminal` also exposes done+failed+canceled for the UI.
   */
  conversationSnapshot: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const conversationId = String(req.params["id"] ?? "").trim();
    if (!conversationId || conversationId.length > 64) throw new ValidationError(apiModuleMessage(res.locals.locale, "conversationIdRequired"));
    const [tasks, plan] = await Promise.all([
      teamTasksService.listForLeaderConversation(executor, conversationId),
      teamTasksRepository.getPlanByConversation(executor, conversationId).catch(() => null),
    ]);
    const items = tasks.map(toTeamTaskSnapshot);
    const completed = items.filter((t) => t.state === "done").length;
    const terminal = items.filter((t) => isTerminalTaskStatus(t.state)).length;
    res.json({
      ok: true,
      conversationId,
      total: items.length,
      completed,
      terminal,
      planId: plan?.id ?? null,
      plan: plan
        ? { id: plan.id ?? null, title: plan.title, goal: plan.goal, status: plan.status, steps: plan.steps }
        : null,
      tasks: items,
    });
  }),

  /** Latest team plan of a leader conversation (null when none). */
  plan: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const conversationId = requireConversationId(req, res.locals.locale);
    const plan = await teamTasksRepository.getPlanByConversation(executor, conversationId);
    res.json({ ok: true, plan });
  }),

  /**
   * Cost/usage summary of a leader chat: tokens spent by the LEADER's own turns
   * plus every delegated worker chat, per task and total. One sidecar read.
   */
  summary: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const conversationId = requireConversationId(req, res.locals.locale);
    const tasks = await teamTasksRepository.listForLeaderConversation(executor, conversationId);
    const convIds = [conversationId, ...tasks.map((t) => t.workerConversationId)];
    const totals = await usageRepository.totalsForConversations(executor, convIds);
    const zero = { inputTokens: 0, outputTokens: 0, totalTokens: 0, count: 0, estimated: false };
    const leader = totals.get(conversationId) ?? zero;
    const taskRows = tasks.map((t) => {
      const usage = totals.get(t.workerConversationId) ?? zero;
      const started = t.startedAt ? Date.parse(t.startedAt) : NaN;
      const finished = t.finishedAt ? Date.parse(t.finishedAt) : NaN;
      const durationMs =
        Number.isFinite(started) && Number.isFinite(finished) ? Math.max(0, finished - started) : null;
      return {
        taskId: t.id,
        title: t.title,
        workerAgentName: t.workerAgentName,
        workerConversationId: t.workerConversationId,
        status: t.status,
        durationMs,
        tokens: usage,
      };
    });
    const total = convIds.reduce(
      (acc, cid) => {
        const u = totals.get(cid);
        if (!u) return acc;
        return {
          inputTokens: acc.inputTokens + u.inputTokens,
          outputTokens: acc.outputTokens + u.outputTokens,
          totalTokens: acc.totalTokens + u.totalTokens,
          count: acc.count + u.count,
          estimated: acc.estimated || u.estimated,
        };
      },
      { ...zero },
    );
    res.json({ ok: true, summary: { total, leader, tasks: taskRows } });
  }),

  /** Cancel a task: aborts the worker's run/CLI job and closes it as canceled.
   *  Workers already finished are left untouched (idempotent close). */
  cancel: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const id = String(req.params["id"] ?? "").trim();
    if (!id) throw new ValidationError(apiModuleMessage(res.locals.locale, "idRequired"));
    const task = await teamTasksService.cancelTask(executor, id);
    if (!task) throw taskNotFound(res.locals.locale);
    res.json({ ok: true, task: toTaskView(task) });
  }),

  /** Cancel EVERY non-terminal task of a leader conversation and close its
   *  active plan (single "cancel all" affordance in the board). Sequential:
   *  each cancel rewrites the tasks sidecar. Idempotent (2ª pasada cancela 0). */
  cancelAll: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const conversationId = requireConversationId(req, res.locals.locale);
    const tasks = await teamTasksService.listForLeaderConversation(executor, conversationId);
    let canceled = 0;
    for (const t of tasks) {
      if (!t.id || isTerminalTaskStatus(t.status)) continue;
      const closed = await teamTasksService.cancelTask(executor, t.id);
      if (closed && closed.status === "canceled") canceled++;
    }
    const plan = await teamTasksRepository.getPlanByConversation(executor, conversationId).catch(() => null);
    if (plan?.id && plan.status === "active") {
      await teamTasksRepository.patchPlan(executor, plan.id, { status: "failed" }).catch(() => undefined);
    }
    const after = await teamTasksService.listForLeaderConversation(executor, conversationId);
    res.json({ ok: true, canceled, tasks: after.map(toTaskView) });
  }),

  /**
   * Manual assignment from the UI ("+ Añadir tarea" en el board): mismo camino
   * y validaciones que la tool `team.assign` del líder, pero disparado por el
   * humano. La conversación debe estar ligada a un agente líder; el objetivo
   * debe ser subordinado directo; el proyecto, de la clausura del worker; el
   * tope de 12 activas lo aplica assignTask (→ 400).
   */
  assign: asyncHandler(async (req: Request, res: Response) => {
    const schema = z.object({
      conversationId: z.string().min(1).max(64),
      agentId: z.string().min(1).max(64),
      task: z.string().min(1).max(8000),
      title: z.string().max(120).optional(),
      projectId: z.string().max(64).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    const { conversationId, agentId, task, title, projectId } = parsed.data;
    const executor = getExecutor(req);
    const sessionUser = res.locals["user"] as SessionUser | undefined;

    const meta = await conversationsRepository.getMeta(executor, conversationId).catch(() => null);
    const leaderAgentId = meta?.agentId ?? null;
    if (!leaderAgentId) throw new ValidationError(apiModuleMessage(res.locals.locale, "teamLeaderRequired"));
    const worker = await agentsRepository.get(agentId).catch(() => null);
    if (!worker?.id || worker.parentAgentId !== leaderAgentId) {
      throw new ValidationError(apiModuleMessage(res.locals.locale, "teamWorkerNotChild").replace("{agentId}", () => agentId));
    }
    let validProject: string | null = null;
    try {
      validProject = await validateWorkerProject(executor, worker, projectId ?? "");
    } catch (err) {
      throw new ValidationError(localizeTeamTaskFailure(res.locals.locale, (err as Error).message));
    }
    try {
      const record = await teamTasksService.assignTask({
        executor,
        user: sessionUser,
        userId: sessionUser?.userId != null ? String(sessionUser.userId) : undefined,
        leaderConversationId: conversationId,
        leaderAgentId,
        worker,
        title: sanitizeTaskTitle(title, task),
        task,
        projectId: validProject,
        depth: 0,
        // Mismo binding que el de las team tools (agent.service.ts).
        runAgent: (msgs, opts) => agentService.run(msgs, opts),
      });
      res.json({ ok: true, task: toTaskView(record) });
    } catch (err) {
      // El tope de tareas activas y demás guardas del servicio son 400, no 500.
      throw new ValidationError(localizeTeamTaskFailure(res.locals.locale, (err as Error).message));
    }
  }),

  /** 👍/👎 del usuario sobre una tarea TERMINADA (re-votar reemplaza). */
  feedback: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const id = String(req.params["id"] ?? "").trim();
    if (!id) throw new ValidationError(apiModuleMessage(res.locals.locale, "idRequired"));
    const parsed = z
      .object({ rating: z.enum(["up", "down"]), note: z.string().max(500).optional() })
      .safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    const task = await teamTasksRepository.getTask(executor, id);
    if (!task?.id) throw taskNotFound(res.locals.locale);
    if (!isTerminalTaskStatus(task.status)) throw new ValidationError(apiModuleMessage(res.locals.locale, "teamFeedbackFinishedOnly"));
    // Procedencia de plantilla del worker (tolerante a agente borrado).
    const worker = await agentsRepository.get(task.workerAgentId).catch(() => null);
    const sessionUser = res.locals["user"] as SessionUser | undefined;
    const feedback = await teamFeedbackRepository.upsertByTask(executor, {
      taskId: task.id,
      leaderConversationId: task.leaderConversationId,
      templateId: worker?.templateId ?? null,
      templateNodeKey: worker?.templateNodeKey ?? null,
      workerAgentId: task.workerAgentId,
      rating: parsed.data.rating,
      ...(parsed.data.note ? { note: parsed.data.note } : {}),
      userId: sessionUser?.userId != null ? String(sessionUser.userId) : null,
    });
    res.json({ ok: true, feedback });
  }),

  /** Votos de las tareas de una conversación de líder (rehidratación del board). */
  feedbackList: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const conversationId = requireConversationId(req, res.locals.locale);
    const feedback = await teamFeedbackRepository.listByConversation(executor, conversationId);
    res.json({ ok: true, feedback: feedback.map((f) => ({ taskId: f.taskId, rating: f.rating, note: f.note ?? null })) });
  }),

  /** Full diff of a task's work branch (live) or its persisted preview. */
  diff: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const id = String(req.params["id"] ?? "").trim();
    if (!id) throw new ValidationError(apiModuleMessage(res.locals.locale, "idRequired"));
    const result = await teamTasksService.taskDiff(executor, id);
    if (!result) throw taskNotFound(res.locals.locale);
    const { task, diff, truncated, source } = result;
    if (diff === null) throw taskNotFound(res.locals.locale, "teamTaskDiffMissing");
    res.json({
      ok: true,
      taskId: task.id,
      branch: task.isolation?.branch ?? null,
      baseSha: task.isolation?.baseSha ?? null,
      headSha: task.isolation?.headSha ?? null,
      filesChanged: task.artifacts?.filesChanged ?? [],
      filesChangedTotal: task.artifacts?.filesChangedTotal ?? null,
      diff,
      truncated,
      source,
    });
  }),
};
