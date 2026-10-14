// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Alerts controller — CRUD for alert rules + view alert events.
 * Server-only: rules persisted via the `alertRepository` (dataStore) at
 * `${LUXIPANEL_CONFIG_DIR}/monitor/alert-rules.json` on the connected target —
 * the SAME store the alert evaluator reads (`findEnabledRules`), so rules
 * created in the UI are actually evaluated. Events are persisted by the
 * repository in the target's monitor sidecar store. No DB.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { parsePageQuery } from "../../../shared/http/pagination.js";
import { alertEvaluatorService } from "../services/alert-evaluator.service.js";
import { getMonitorWsClientCount } from "./monitor-ws.controller.js";
import { ALERT_METRICS, ALERT_OPERATORS } from "../models/index.js";
import { alertRepository } from "../repositories/alert.repository.js";
import { NotFoundError } from "../../../shared/errors/index.js";
import { getExecutor } from "../../../shared/executor/index.js";

const createRuleSchema = z.object({
  name: z.string().min(2).max(128).trim(),
  metric: z.enum(ALERT_METRICS),
  operator: z.enum(ALERT_OPERATORS),
  threshold: z.number(),
  sustainedSamples: z.number().int().min(1).max(60).default(1),
  enabled: z.boolean().default(true),
  mutedUntil: z.string().datetime({ offset: true }).nullable().default(null),
});

const updateRuleSchema = createRuleSchema.partial();

export const alertsController = {
  /** GET /api/monitor/alerts/rules — list (from server). */
  listRules: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const rules = await alertRepository.findAllRules(executor);
    const firingIds = new Set(alertEvaluatorService.firingRuleIds(executor.target.id));
    const data = rules.map((r) => ({ ...r, firing: firingIds.has(r.id) }));
    res.json({ ok: true, data });
  }),

  /** POST /api/monitor/alerts/rules. */
  createRule: asyncHandler(async (req: Request, res: Response) => {
    const body = createRuleSchema.parse(req.body);
    const executor = getExecutor(req);
    const rule = await alertRepository.createRule(body, executor);
    res.status(201).json({ ok: true, data: rule });
  }),

  /** PUT /api/monitor/alerts/rules/:id. */
  updateRule: asyncHandler(async (req: Request, res: Response) => {
    const id = Number.parseInt(String(req.params.id), 10);
    const body = updateRuleSchema.parse(req.body);
    const executor = getExecutor(req);
    const updated = await alertRepository.updateRule(id, body, executor);
    if (!updated) throw new NotFoundError("Alert rule");
    res.json({ ok: true, data: updated });
  }),

  /** DELETE /api/monitor/alerts/rules/:id. */
  deleteRule: asyncHandler(async (req: Request, res: Response) => {
    const id = Number.parseInt(String(req.params.id), 10);
    const executor = getExecutor(req);
    const deleted = await alertRepository.deleteRule(id, executor);
    if (!deleted) throw new NotFoundError("Alert rule");
    res.json({ ok: true });
  }),

  /** GET /api/monitor/alerts/events?limit= — recent events for this server,
   *  newest first (read from the per-server sidecar the evaluator writes). */
  listEvents: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const { limit } = parsePageQuery(req.query, { defaultLimit: 100, maxLimit: 500 });
    const events = await alertRepository.findRecentEvents(limit, executor);
    res.json({ ok: true, data: events });
  }),

  /** GET /api/monitor/alerts/firing — currently firing alerts (this server). */
  listFiring: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const ids = alertEvaluatorService.firingRuleIds(executor.target.id);
    res.json({ ok: true, data: ids.map((id) => ({ ruleId: id })) });
  }),

  /** GET /api/monitor/ws/clients. */
  streamClients: asyncHandler(async (_req: Request, res: Response) => {
    res.json({ ok: true, data: { clients: getMonitorWsClientCount() } });
  }),
};
