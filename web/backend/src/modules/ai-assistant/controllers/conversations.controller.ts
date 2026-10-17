// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AI Assistant — conversation history (ChatGPT-style).
 *
 *   GET    /api/ai/conversations?q=&agentId=&limit=&offset=  list (filterable)
 *   POST   /api/ai/conversations                       create
 *   GET    /api/ai/conversations/:id/messages?limit=&offset=
 *   PATCH  /api/ai/conversations/:id                   rename and/or pin
 *   DELETE /api/ai/conversations/:id                   delete
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor, getContextUserId } from "../../../shared/executor/index.js";
import { AppError, ValidationError } from "../../../shared/errors/index.js";
import { ErrorCodes } from "../../../shared/errors/codes.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";
import { zodIssues } from "../../../shared/validators/index.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import { conversationsRepository } from "../repositories/conversations.repository.js";
import { agentRunRegistry } from "../services/agent-run-registry.js";
import { permissionBroker } from "../services/permission-broker.js";
import { cliJobTracker } from "../services/cli-job-tracker.service.js";
import { cliJobsRepository } from "../repositories/cli-jobs.repository.js";
import { agentQueueRepository } from "../repositories/agent-queue.repository.js";
import { attachmentsRepository } from "../repositories/attachments.repository.js";
import { audioRepository } from "../repositories/audio.repository.js";
import { cliSessionsRepository } from "../repositories/cli-sessions.repository.js";
import { assessContext } from "../services/context-window.service.js";
import { compactConversation } from "../services/compaction.service.js";
import { ConflictError } from "../../../shared/errors/index.js";
import { isAssistantProviderId, DEFAULT_PROVIDER_ID } from "../models/assistant-config.types.js";

const choiceSchema = {
  model: z.string().max(200).optional(),
  effort: z.enum(["", "low", "medium", "high", "xhigh", "max"]).optional(),
  approvalMode: z.enum(["manual", "auto", "plan"]).optional(),
};
const createSchema = z.object({
  ...choiceSchema,
  provider: z.string().max(32).default(DEFAULT_PROVIDER_ID),
  firstMessage: z.string().max(8192).optional(),
  projectId: z.string().max(64).nullable().optional(),
  /** Custom agent this conversation is bound to (display grouping + run config). */
  agentId: z.string().max(64).nullable().optional(),
});

// PATCH body: rename (title) and/or pin toggle (pinned). At least one field must
// be present; both are optional so a caller can pin without renaming.
const renameSchema = z
  .object({
    title: z.string().min(1).max(120).optional(),
    pinned: z.boolean().optional(),
    provider: z.string().max(32).refine(isAssistantProviderId).optional(),
    ...choiceSchema,
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), {
    message: "Provide title and/or pinned",
  });

// Orphan self-heal is EXPENSIVE: it reads every CLI session's message doc over
// the per-server executor (SSH/SFTP through the LP gateway), ~1+ round trip per
// session. Running it on every initial list load — and the dashboard fires the
// list more than once — bursts dozens of agent calls and, on a busy managed
// session against localhost, trips LP's per-action rate limit (429 "Too many
// agent requests"), which then makes the very sidecar reads fail and the list
// come back EMPTY ("No conversations yet"). It's a best-effort backfill, not a
// per-load necessity, so gate it behind a short in-memory cooldown per context
// user. The window resets on restart (fine — first load after a restart heals).
const RECONCILE_COOLDOWN_MS = 5 * 60 * 1000;
const lastReconcileAt = new Map<string, number>();

export const conversationsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const q = typeof req.query["q"] === "string" ? req.query["q"].slice(0, 160) : undefined;
    const provider = typeof req.query["provider"] === "string" ? req.query["provider"] : undefined;
    // projectId: "none" → loose chats only; "<id>" → that project; absent → all.
    const projRaw = typeof req.query["projectId"] === "string" ? req.query["projectId"] : undefined;
    const projectId = projRaw === undefined ? undefined : projRaw === "none" ? null : projRaw;
    // withAgent: "1" → only agent-bound chats; "0" → only non-agent chats;
    // absent → all. Powers the conversation-list tabs (agents vs loose/projects).
    const waRaw = typeof req.query["withAgent"] === "string" ? req.query["withAgent"] : undefined;
    const withAgent = waRaw === undefined ? undefined : waRaw === "1" || waRaw === "true";
    // agentId: "none" → loose chats only (no agent bound); "<id>" → that agent's
    // chats; absent → all. Powers the nested per-agent pagination in the dashboard.
    const agentRaw = typeof req.query["agentId"] === "string" ? req.query["agentId"] : undefined;
    const agentId = agentRaw === undefined ? undefined : agentRaw === "none" ? null : agentRaw;
    const limit = Number(req.query["limit"] ?? 50);
    const offset = Number(req.query["offset"] ?? 0);
    const cursor = typeof req.query["cursor"] === "string" ? req.query["cursor"] : undefined;
    const paged = req.query["paged"] === "1";
    const projectIds = typeof req.query["projectIds"] === "string" ? req.query["projectIds"].split(",").filter(Boolean).slice(0, 1000) : undefined;
    const agentIds = typeof req.query["agentIds"] === "string" ? req.query["agentIds"].split(",").filter(Boolean).slice(0, 1000) : undefined;
    const includeSummary = req.query["includeSummary"] === "1";
    const includeActivity = req.query["includeActivity"] === "1";
    const summaryScope = req.query["summaryScope"] === "filtered" ? "filtered" : undefined;
    const result = await conversationsRepository.list(executor, { q, provider, projectId, projectIds, agentId, agentIds, withAgent, limit, offset, cursor, paged, includeSummary, includeActivity, summaryScope });
    if (result.activity) {
      const running = new Set(agentRunRegistry.activeRuns().filter(run => run.targetId === executor.target.id).map(run => run.key));
      result.activity = result.activity.map(row => ({ ...row, running: running.has(String(row.id)),
        pendingPermission: running.has(String(row.id)) && permissionBroker.pendingCount(String(row.id)) > 0 }));
      res.setHeader("Cache-Control", "no-store");
    }
    res.json({ ok: true, ...result });

    // On the initial, unfiltered load, self-heal any "orphan" chats (a CLI/
    // terminal session exists but its chat metadata went missing) so NONE are
    // omitted from the list. This runs AFTER the response: it reads the CLI
    // session map and, for each id the index doesn't know, that chat's whole
    // transcript over the per-server executor (SSH/SFTP through the LP gateway).
    // Awaiting it here put that I/O in the critical path of the user's very
    // first list and was the biggest single contributor to the p95 (seconds).
    // It's a best-effort backfill, not a per-load necessity, so the heal simply
    // lands on the next load. Still throttled per user (RECONCILE_COOLDOWN_MS)
    // so it can't burst the executor — a burst trips LP's per-action rate limit
    // (429), which then makes the sidecar reads themselves fail.
    const reconcileKey = JSON.stringify([executor?.target?.id ?? "local", getContextUserId() ?? "shared"]);
    const reconcileDue =
      Date.now() - (lastReconcileAt.get(reconcileKey) ?? 0) >= RECONCILE_COOLDOWN_MS;
    if (offset === 0 && !cursor && !q && !provider && projectId === undefined && !projectIds && agentId === undefined && !agentIds && withAgent === undefined && reconcileDue) {
      lastReconcileAt.set(reconcileKey, Date.now());
      void (async () => {
        try {
          const sessions = await cliSessionsRepository.listAll(executor);
          if (sessions.length === 0) return;
          const hint = (id: string): string | undefined => {
            const s = sessions.find((r) => r.id === id);
            if (!s) return undefined;
            if (s.codex || s.providers?.codex) return "codex";
            return "claude";
          };
          await conversationsRepository.reconcileOrphans(
            executor,
            sessions.map((s) => s.id),
            hint,
          );
        } catch {
          /* ignore — the response already went out; heal on a later load */
        }
      })();
    }
  }),

  /** GET /conversations/:id — a single conversation's metadata (incl. its
   *  projectId), so the chat header can show/open the project it belongs to
   *  regardless of how the list is currently scoped. */
  get: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const executor = getExecutor(req);
    // Reconcile orphans (message doc but no meta doc) so a chat that shows in the
    // sidebar and has messages never 404s here — otherwise the client purges it
    // as "dead" and the chat won't open (reverts to a new chat). Only a truly
    // empty/gone conversation (no meta AND no messages) still 404s.
    const meta = await conversationsRepository.getMetaOrReconcile(executor, id);
    if (!meta) throw new AppError(apiModuleMessage(res.locals.locale, "assistantConversationNotFound"), 404, ErrorCodes.NOT_FOUND);
    res.json({ ok: true, conversation: meta });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const parsed = createSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    }
    const executor = getExecutor(req);
    const meta = await conversationsRepository.create(
      executor,
      parsed.data.provider,
      parsed.data.firstMessage,
      parsed.data.projectId ?? null,
      parsed.data.agentId ?? null,
      { model: parsed.data.model ?? "", effort: parsed.data.effort ?? "", approvalMode: parsed.data.approvalMode ?? "manual" },
    );
    // Obsidian mints a context container for LOOSE chats (no project). It
    // listens for this event and decides — keeps the dependency one-way.
    eventBus.emit(Events.AI_CONVERSATION_CREATED, {
      executor,
      userId: getContextUserId() ?? undefined,
      conversation: meta,
    });
    res.json({ ok: true, conversation: meta });
  }),

  messages: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const executor = getExecutor(req);
    const limit = Number(req.query["limit"] ?? 10);
    const offset = Number(req.query["offset"] ?? 0);
    const include = new Set(String(req.query["include"] ?? "").split(","));
    const [result, meta, record] = await Promise.all([
      conversationsRepository.messages(executor, id, { limit, offset, includeContext: include.has("context") }),
      include.has("meta") ? conversationsRepository.getMetaOrReconcile(executor, id).catch(() => null) : Promise.resolve(null),
      include.has("session") ? cliSessionsRepository.get(executor, id).catch(() => null) : Promise.resolve(null),
    ]);
    const sessions = Object.fromEntries(Object.entries(record?.providers ?? {}).map(([provider, state]) => [provider, state?.claude ?? state?.codex ?? null]));
    const legacySession = record?.claude ?? record?.codex ?? null;
    res.json({ ok: true, ...result,
      ...(include.has("meta") ? { conversation: meta } : {}),
      ...(include.has("session") ? { sessions, sessionId: sessions[meta?.provider ?? ""] ?? legacySession, provider: meta?.provider ?? null } : {}),
    });
  }),

  /**
   * GET /conversations/:id/session — the upstream provider session id (the chat
   * identifier the CLI agent resumes), shown in the chat top bar. Only CLI
   * providers that support resume persist one (claude → UUID, codex → session
   * id); for everything else this is `null`.
   */
  session: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const executor = getExecutor(req);
    const requestedProvider = typeof req.query["provider"] === "string" ? req.query["provider"] : undefined;
    const [meta, record] = await Promise.all([
      conversationsRepository.getMeta(executor, id).catch(() => null),
      cliSessionsRepository.get(executor, id).catch(() => null),
    ]);
    const provider = requestedProvider || meta?.provider || null;
    const scoped =
      provider && isAssistantProviderId(provider)
        ? await cliSessionsRepository.getProvider(executor, id, provider).catch(() => null)
        : null;
    const sessionId = scoped?.claude ?? scoped?.codex ?? record?.claude ?? record?.codex ?? null;
    res.json({ ok: true, sessionId, provider: provider ?? null });
  }),

  rename: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const parsed = renameSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    }
    const executor = getExecutor(req);
    const meta = await conversationsRepository.patchMeta(executor, id, {
      ...parsed.data,
    });
    res.json({ ok: true, conversation: meta });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const executor = getExecutor(req);
    // Tear down any background lifecycle tied to this conversation BEFORE
    // deleting it, so nothing keeps running or gets recovered after the fact:
    // abort the in-memory run, kill the CLI process tree on the target, drop the
    // restart-recovery descriptor, and clear any queued follow-ups.
    agentRunRegistry.stop(id);
    cliJobTracker.killForConversation(id);
    await cliJobsRepository.delete(executor, id).catch(() => undefined);
    await cliSessionsRepository.clear(executor, id).catch(() => undefined);
    await agentQueueRepository.clearFor(executor, id).catch(() => undefined);
    // Drop the chat's attachments + cached reply audio (files + index rows) so
    // nothing is orphaned.
    if (executor) {
      await attachmentsRepository.deleteByConvId(executor, id).catch(() => undefined);
      await audioRepository.deleteByConvId(executor, id).catch(() => undefined);
    }
    const ok = await conversationsRepository.delete(executor, id);
    res.json({ ok });
  }),

  /** POST /conversations/:id/reviewed — clear the "ended but unreviewed" flag. */
  markReviewed: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const executor = getExecutor(req);
    const meta = await conversationsRepository.markReviewed(executor, id);
    res.json({ ok: true, conversation: meta });
  }),

  /**
   * GET /conversations/:id/context — estimated context-window occupancy for this
   * conversation, plus whether the UI should offer to compact (`warn`). Cheap:
   * reads the stored messages and measures chars/4. Drives the chat's context
   * meter + the "Compactar" button.
   */
  context: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const executor = getExecutor(req);
    const messages = await conversationsRepository.allMessages(executor, id).catch(() => []);
    res.json({ ok: true, context: assessContext(messages) });
  }),

  /**
   * POST /conversations/:id/compact — fold this conversation's older turns into a
   * summary so it stops overrunning the model context window. Refuses while a run
   * is live (compaction rewrites the transcript the run is appending to). Returns
   * the compaction result + the fresh context assessment so the UI can update.
   */
  compact: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    if (agentRunRegistry.isActive(id)) {
      throw new ConflictError(apiModuleMessage(res.locals.locale, "assistantCompactBusy"));
    }
    const executor = getExecutor(req);
    const result = await compactConversation(executor, id);
    const messages = await conversationsRepository.allMessages(executor, id).catch(() => []);
    res.json({ ok: true, result, context: assessContext(messages) });
  }),
};
