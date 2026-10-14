// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Notifications controller — HTTP surface for the bell dropdown.
 *
 * The SSE endpoint (`stream`) keeps a long-lived response open and pipes
 * NotificationCreated/Read/Cleared events from the in-process bus to the
 * client. We send a heartbeat comment every 25 s so reverse proxies don't
 * close the connection on idle.
 */

import type { Request, Response } from "express";
import { getExecutor } from "../../../shared/executor/index.js";
import { z } from "zod";
import { asyncHandler } from "../../../shared/types/index.js";
import { apiErrorMessage } from "../../../shared/i18n/errors.js";
import {
  notificationsService,
  notificationsBus,
  NOTIFICATION_EVENTS,
} from "../services/notifications.service.js";
import { ValidationError, ForbiddenError } from "../../../shared/errors/index.js";
import { notificationTargetSchema } from "../models/notification-target.js";
import { openSse } from "../../../shared/http/sse.js";
import { NO_CACHE_HEADER, SSE_CONTENT_TYPE } from "../../../shared/constants.js";

const listQuerySchema = z.object({
  unreadOnly: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  source: z.enum(["system", "module", "ai", "security", "user", "all"]).optional(),
  module: z.string().trim().min(1).max(64).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  scope: z.enum(["own", "all"]).optional(),
});

const createSchema = z.object({
  source: z.enum(["system", "module", "ai", "security", "user"]),
  module: z.string().trim().max(64).optional(),
  severity: z.enum(["info", "success", "warning", "error"]).optional(),
  title: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(2000),
  // Only relative in-panel links are allowed — an attacker-controlled absolute
  // URL (or `javascript:`) in a bell row could phish/redirect the operator.
  link: z
    .string()
    .trim()
    .max(500)
    // `/panel` (home del asistente) es destino legítimo: los deep-links de IA
    // son `/panel?c=<conv>`. Se admite `/panel`, `/panel/...`, `/panel?...`.
    .refine((v) => /^\/panel(\/|$|\?)/.test(v), "link debe ser una ruta relativa /panel...")
    .optional(),
  // Aterrizaje exacto (tab/drawer/evento). Saneado fail-closed en el modelo.
  target: notificationTargetSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

function currentUserId(res: Response): number {
  const id = (res.locals.user as { userId?: number } | undefined)?.userId;
  if (typeof id !== "number") throw new ForbiddenError("Sesión sin identidad de usuario");
  return id;
}

function isAdmin(res: Response): boolean {
  return (res.locals.user as { kind?: string } | undefined)?.kind === "admin";
}

// ── SSE fan-out ────────────────────────────────────────────────────────────
// One connected client per open EventSource. We register exactly THREE bus
// listeners for the whole process (a multiplexer) and dispatch to the client
// Set, instead of 3 listeners per connection — the latter tripped
// MaxListenersExceededWarning past ~66 tabs and walked every listener per event.
interface SseClient {
  userId: number | null;
  targetId: string;
  send: (event: string, data: unknown) => void;
}
const sseClients = new Set<SseClient>();

/** True when a row/delta owned by `ownerId` should reach a client scoped to
 *  `clientUserId`. Global rows (ownerId null/undefined) reach everyone. */
function sseVisible(ownerId: number | null | undefined, clientUserId: number | null): boolean {
  if (ownerId === null || ownerId === undefined) return true;
  if (clientUserId === null) return false;
  return ownerId === clientUserId;
}

let sseWired = false;
function ensureSseMultiplexer(): void {
  if (sseWired) return;
  sseWired = true;
  notificationsBus.on(NOTIFICATION_EVENTS.CREATED, (row: unknown) => {
    const r = row as { userId?: number | null; metadata?: { targetId?: string } } | null;
    if (!r) return;
    for (const c of sseClients) {
      if (r.metadata?.targetId === c.targetId && sseVisible(r.userId, c.userId)) c.send("notification:created", row);
    }
  });
  notificationsBus.on(NOTIFICATION_EVENTS.READ, (data: unknown) => {
    const d = (data ?? {}) as { id?: string; read?: boolean; all?: boolean; userId?: number | null; targetId?: string };
    const payload = d.all ? { all: true } : { id: d.id, read: d.read ?? true };
    for (const c of sseClients) {
      if (d.targetId === c.targetId && sseVisible(d.userId, c.userId)) c.send("notification:read", payload);
    }
  });
  notificationsBus.on(NOTIFICATION_EVENTS.CLEARED, (data: unknown) => {
    const d = (data ?? {}) as { id?: string; all?: boolean; userId?: number | null; targetId?: string };
    const payload = d.all ? { all: true } : { id: d.id };
    for (const c of sseClients) {
      if (d.targetId === c.targetId && sseVisible(d.userId, c.userId)) c.send("notification:cleared", payload);
    }
  });
}

export const notificationsController = {
  /** GET /api/notifications */
  list: asyncHandler(async (req: Request, res: Response) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError(parsed.error.message);
    const userId = currentUserId(res);
    // `scope=all` is for admins debugging the box — non-admins always see
    // their own + global rows only. We don't have a kind check on every
    // session.middleware path, so we approximate by checking the cached
    // session user shape.
    const scope = isAdmin(res) ? parsed.data.scope ?? "own" : "own";
    const filters = {
      unreadOnly: parsed.data.unreadOnly,
      source: parsed.data.source,
      module: parsed.data.module,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      userId: scope === "all" ? undefined : userId,
    };
    const result = await notificationsService.list(filters, getExecutor(req));
    res.json({ ok: true, ...result });
  }),

  /** GET /api/notifications/unread-count */
  unreadCount: asyncHandler(async (req: Request, res: Response) => {
    const userId = currentUserId(res);
    const count = await notificationsService.unreadCount(userId, getExecutor(req));
    res.json({ ok: true, count });
  }),

  /** POST /api/notifications — admin/internal create. */
  create: asyncHandler(async (req: Request, res: Response) => {
    // Gate to admins: a non-admin session must not be able to seed a bell row
    // (with an attacker-chosen title/link) into another operator's dropdown.
    if (!isAdmin(res)) throw new ForbiddenError("Solo un administrador puede crear notificaciones");
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.message);
    // Force ownership to the caller — never accept an arbitrary target userId.
    const created = await notificationsService.create({
      ...parsed.data,
      userId: currentUserId(res),
    }, getExecutor(req));
    res.status(201).json({ ok: true, data: created });
  }),

  /** PATCH /api/notifications/:id/read */
  markRead: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id ?? "").trim();
    if (!id) throw new ValidationError("id requerido");
    const updated = await notificationsService.markRead(id, currentUserId(res), isAdmin(res), getExecutor(req));
    if (!updated) {
      res.status(404).json({ ok: false, error: apiErrorMessage(res.locals.locale, "notFound") });
      return;
    }
    res.json({ ok: true, data: updated });
  }),

  /** POST /api/notifications/read-all */
  markAllRead: asyncHandler(async (req: Request, res: Response) => {
    const userId = currentUserId(res);
    const changed = await notificationsService.markAllRead(userId, getExecutor(req));
    res.json({ ok: true, changed });
  }),

  /** DELETE /api/notifications/:id */
  remove: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id ?? "").trim();
    if (!id) throw new ValidationError("id requerido");
    const ok = await notificationsService.delete(id, currentUserId(res), isAdmin(res), getExecutor(req));
    res.json({ ok });
  }),

  /** DELETE /api/notifications — clear all for the caller. */
  clearAll: asyncHandler(async (req: Request, res: Response) => {
    const userId = currentUserId(res);
    const removed = await notificationsService.clearAll(userId, getExecutor(req));
    res.json({ ok: true, removed });
  }),

  /**
   * GET /api/notifications/stream — Server-Sent Events feed.
   *
   * Uses the in-process notificationsBus to push CREATED/READ/CLEARED
   * events to the connected client. Clients pass `lastEventId` via the
   * standard SSE header so a reconnect can replay missed events; we keep
   * the implementation simple and only deliver future events (the dropdown
   * refetches on reconnect anyway).
   */
  stream: (req: Request, res: Response) => {
    res.status(200);
    // Headers + greeting + 15 s heartbeat + closed-socket-safe writer all come
    // from the shared SSE bootstrap (B-24).
    const sse = openSse(res, {
      contentType: SSE_CONTENT_TYPE,
      cacheControl: NO_CACHE_HEADER,
      greeting: () => `connected ${new Date().toISOString()}`,
      heartbeatComment: () => `heartbeat ${Date.now()}`,
    });

    ensureSseMultiplexer();
    const userId = currentUserId(res);

    const sendEvent = (event: string, data: unknown) => sse.send(data, { event });

    const client: SseClient = { userId, targetId: getExecutor(req).target.id, send: sendEvent };
    sseClients.add(client);

    const cleanup = () => {
      sse.close();
      sseClients.delete(client);
    };

    req.on("close", cleanup);
    req.on("aborted", cleanup);
    res.on("close", cleanup);
  },
};
