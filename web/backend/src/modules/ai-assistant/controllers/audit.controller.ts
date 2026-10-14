// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AI Assistant — audit + provider health endpoints.
 *
 *   GET /api/ai/audit   — last N tool_use events on this target
 *   GET /api/ai/health  — provider.ping() for the active provider
 */

import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { assistantAuditRepository } from "../repositories/assistant-audit.repository.js";
import { agentService } from "../services/agent.service.js";

export const auditController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const limit = Math.max(1, Math.min(500, Number(req.query["limit"] ?? 100)));
    const entries = await assistantAuditRepository.list(executor, limit);
    res.json({ ok: true, entries });
  }),

  health: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const ping = await agentService.ping(executor);
    res.json({ ok: true, ping });
  }),
};
