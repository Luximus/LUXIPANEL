// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Terminal sessions admin controller.
 *
 * HTTP endpoints to list and forcefully close active terminal sessions.
 * Requires admin kind users only.
 */

import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { NotFoundError, ForbiddenError } from "../../../shared/errors/index.js";
import { sessionManagerService } from "../services/session-manager.service.js";
import { apiResponseMessage } from "../../../shared/i18n/responses.js";

export const sessionsController = {
  /**
   * GET /api/terminal/sessions
   * List all active terminal sessions.
   */
  list: asyncHandler(async (_req: Request, res: Response) => {
    const sessions = sessionManagerService.list();
    res.json({ ok: true, data: sessions, total: sessions.length });
  }),

  /**
   * DELETE /api/terminal/sessions/:sessionId
   * Force-close a terminal session.
   */
  close: asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params as { sessionId: string };
    const locals = res.locals as { user: { kind: string } };

    if (locals.user.kind !== "admin") {
      throw new ForbiddenError("Only admin users can close terminal sessions");
    }

    const closed = sessionManagerService.closeBySessionId(sessionId, "admin-force-close");
    if (!closed) {
      throw new NotFoundError(`No active session with ID ${sessionId}`);
    }

    res.json({ ok: true, message: apiResponseMessage(res.locals.locale, "sessionClosed") });
  }),
};
