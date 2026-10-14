// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Server-alerts controller — REST surface for the /panel/server-alerts view.
 *
 * Responses are always `{ ok, data }`; failures go through typed errors to the
 * central error handler. The panel host for LP service calls is taken from the
 * session (`res.locals.user.targetHost`) — the secure, non-spoofable mechanism
 * used by module-dev — and the service falls back to the persisted panel origin
 * when the session lacks a host.
 */

import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { AppError, ForbiddenError, ValidationError } from "../../../shared/errors/index.js";
import { ErrorCodes } from "../../../shared/errors/codes.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";
import { z } from "zod";
import {
  idParamSchema,
  metricRuleCreateSchema,
  metricRuleUpdateSchema,
  prefsPatchSchema,
  scheduledCreateSchema,
  scheduledUpdateSchema,
  sendImmediateSchema,
} from "../models/server-alerts.model.js";
import { serverAlertsService } from "../services/server-alerts.service.js";
import { notificationDeliveryService } from "../services/notification-delivery.service.js";

/**
 * Host público CONFIABLE del panel para LP: sale de la sesión validada
 * (`targetHost`), igual que `usage`/`module-dev`. Los headers crudos del request
 * pueden traer puertos, hosts internos o valores controlados por cliente; para
 * notificaciones eso acaba en `PANEL_HOST_UNRESOLVED` o, peor, abriría una BOLA.
 * Sin host de sesión, el service cae al `getPanelOrigin()` persistido.
 */
function callerId(res: Response): number {
  const id = res.locals.user?.userId;
  if (typeof id !== "number") throw new ForbiddenError(apiModuleMessage(res.locals.locale, "alertUserUnknown"));
  return id;
}
function requireAdmin(res: Response): void {
  if (res.locals.user?.kind !== "admin") throw new ForbiddenError(apiModuleMessage(res.locals.locale, "alertAdminRequired"));
}
const ownPrefsSchema = z.object({ enabled: z.boolean().optional(), manual: z.boolean().optional(), scheduled: z.boolean().optional(), rules: z.boolean().optional(), web: z.boolean().optional(), mobile: z.boolean().optional() }).strict();
const webSubscriptionSchema = z.object({ endpoint: z.string().url().max(2048), expirationTime: z.number().nullable().optional(), keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }) });
const mobileTokenSchema = z.object({ token: z.string().regex(/^(Expo|Exponent)PushToken\[[^\]]{8,}\]$/).max(256), panelId: z.string().min(1).max(128).optional() });

export const serverAlertsController = {
  // ── Preferences ──────────────────────────────────────────────────────────

  /** GET /api/server-alerts/prefs */
  getPrefs: asyncHandler(async (req: Request, res: Response) => {
    const data = await serverAlertsService.getPrefs(callerId(res), getExecutor(req).target.id);
    res.json({ ok: true, data });
  }),

  /** PUT /api/server-alerts/prefs */
  setPrefs: asyncHandler(async (req: Request, res: Response) => {
    const patch = prefsPatchSchema.parse(req.body ?? {});
    const data = await serverAlertsService.setPrefs(patch, callerId(res), getExecutor(req).target.id);
    res.json({ ok: true, data });
  }),

  ownPreferences: asyncHandler(async (req: Request, res: Response) => {
    res.json({ ok: true, data: await notificationDeliveryService.getPreferences(callerId(res), getExecutor(req).target.id) });
  }),
  updateOwnPreferences: asyncHandler(async (req: Request, res: Response) => {
    const patch = ownPrefsSchema.parse(req.body ?? {});
    res.json({ ok: true, data: await notificationDeliveryService.setPreferences(callerId(res), getExecutor(req).target.id, patch) });
  }),
  channels: asyncHandler(async (_req: Request, res: Response) => {
    const userId = callerId(res);
    const [publicKey, devices] = await Promise.all([notificationDeliveryService.getVapidPublicKey(), notificationDeliveryService.deviceStatus(userId)]);
    res.json({ ok: true, data: { publicKey, devices } });
  }),
  registerWeb: asyncHandler(async (req: Request, res: Response) => {
    const input = webSubscriptionSchema.parse(req.body ?? {});
    await notificationDeliveryService.registerWeb(callerId(res), input);
    res.json({ ok: true });
  }),
  registerMobile: asyncHandler(async (req: Request, res: Response) => {
    const { token, panelId } = mobileTokenSchema.parse(req.body ?? {});
    await notificationDeliveryService.registerMobile(callerId(res), token, panelId);
    res.json({ ok: true });
  }),
  removeDevice: asyncHandler(async (req: Request, res: Response) => {
    const channel = z.enum(["web", "mobile"]).parse(req.params.channel);
    const value = z.string().min(1).max(2048).parse(req.body?.value);
    const deleted = await notificationDeliveryService.removeDevice(callerId(res), channel, value);
    res.json({ ok: true, data: { deleted } });
  }),
  history: asyncHandler(async (req: Request, res: Response) => {
    const page = z.coerce.number().int().min(1).max(10000).parse(req.query.page ?? 1);
    const scope = req.query.scope === "all" && res.locals.user?.kind === "admin" ? null : callerId(res);
    res.json({ ok: true, data: await notificationDeliveryService.history(getExecutor(req).target.id, scope, page) });
  }),
  test: asyncHandler(async (req: Request, res: Response) => {
    const title = apiModuleMessage(res.locals.locale, "alertTestTitle");
    const body = apiModuleMessage(res.locals.locale, "alertTestBody");
    const data = await serverAlertsService.sendImmediate({ title, body, data: { kind: "test" }, targetUserId: callerId(res), respectPrefs: false }, getExecutor(req).target.id);
    res.json({ ok: true, data });
  }),

  // ── Immediate send ───────────────────────────────────────────────────────

  /** POST /api/server-alerts/send */
  send: asyncHandler(async (req: Request, res: Response) => {
    requireAdmin(res);
    const input = sendImmediateSchema.parse(req.body ?? {});
    const data = await serverAlertsService.sendImmediate(input, getExecutor(req).target.id);
    if (!data.panel) throw new ValidationError(apiModuleMessage(res.locals.locale, "alertNoRecipients"));
    res.json({ ok: true, data });
  }),

  // ── Scheduled notifications ──────────────────────────────────────────────

  /** GET /api/server-alerts/scheduled */
  listScheduled: asyncHandler(async (req: Request, res: Response) => {
    const data = await serverAlertsService.listScheduled(getExecutor(req));
    res.json({ ok: true, data });
  }),

  /** POST /api/server-alerts/scheduled */
  createScheduled: asyncHandler(async (req: Request, res: Response) => {
    requireAdmin(res);
    const input = scheduledCreateSchema.parse(req.body ?? {});
    const data = await serverAlertsService.createScheduled(input, getExecutor(req));
    res.json({ ok: true, data });
  }),

  /** PUT /api/server-alerts/scheduled/:id */
  updateScheduled: asyncHandler(async (req: Request, res: Response) => {
    requireAdmin(res);
    const { id } = idParamSchema.parse(req.params);
    const patch = scheduledUpdateSchema.parse(req.body ?? {});
    const data = await serverAlertsService.updateScheduled(id, patch, getExecutor(req));
    if (!data) throw new AppError(apiModuleMessage(res.locals.locale, "alertScheduledNotFound"), 404, ErrorCodes.NOT_FOUND);
    res.json({ ok: true, data });
  }),

  /** DELETE /api/server-alerts/scheduled/:id */
  deleteScheduled: asyncHandler(async (req: Request, res: Response) => {
    requireAdmin(res);
    const { id } = idParamSchema.parse(req.params);
    const deleted = await serverAlertsService.deleteScheduled(id, getExecutor(req));
    res.json({ ok: true, data: { deleted } });
  }),

  // ── Metric rules ─────────────────────────────────────────────────────────

  /** GET /api/server-alerts/rules */
  listRules: asyncHandler(async (req: Request, res: Response) => {
    const data = await serverAlertsService.listRules(getExecutor(req));
    res.json({ ok: true, data });
  }),

  /** POST /api/server-alerts/rules */
  createRule: asyncHandler(async (req: Request, res: Response) => {
    requireAdmin(res);
    const input = metricRuleCreateSchema.parse(req.body ?? {});
    const data = await serverAlertsService.createRule(input, getExecutor(req));
    res.json({ ok: true, data });
  }),

  /** PUT /api/server-alerts/rules/:id */
  updateRule: asyncHandler(async (req: Request, res: Response) => {
    requireAdmin(res);
    const { id } = idParamSchema.parse(req.params);
    const patch = metricRuleUpdateSchema.parse(req.body ?? {});
    const data = await serverAlertsService.updateRule(id, patch, getExecutor(req));
    if (!data) throw new AppError("Regla no encontrada", 404, ErrorCodes.NOT_FOUND);
    res.json({ ok: true, data });
  }),

  /** DELETE /api/server-alerts/rules/:id */
  deleteRule: asyncHandler(async (req: Request, res: Response) => {
    requireAdmin(res);
    const { id } = idParamSchema.parse(req.params);
    const deleted = await serverAlertsService.deleteRule(id, getExecutor(req));
    res.json({ ok: true, data: { deleted } });
  }),
};
