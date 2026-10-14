// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { Request, Response } from "express";
import { z } from "zod";
import { ValidationError } from "../../../shared/errors/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { asyncHandler } from "../../../shared/types/index.js";
import { conversationHistoryService } from "../services/conversation-history.service.js";

const listQuerySchema = z.object({
  source: z.enum(["codex", "claude"]).optional(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const conversationsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const query = listQuerySchema.parse(req.query);
    const executor = getExecutor(req);

    if (query.source) {
      const data = await conversationHistoryService.listPage(executor, query.source, query.offset, query.limit);
      res.json({ ok: true, data });
      return;
    }

    const data = await conversationHistoryService.list(executor);
    res.json({ ok: true, data });
  }),
  delete: asyncHandler(async (req: Request, res: Response) => {
    const { source, sessionIds } = req.body as {
      source?: string;
      sessionIds?: unknown;
    };

    if (source !== "codex" && source !== "claude") {
      throw new ValidationError("Invalid conversation source");
    }

    if (!Array.isArray(sessionIds)) {
      throw new ValidationError("sessionIds must be an array");
    }

    // Bound the request: cap the number of sessionIds and each id's length so a
    // malicious/oversized body can't blow up memory or the rewritten file.
    if (sessionIds.length > 1000) {
      throw new ValidationError("Too many sessionIds (max 1000)");
    }

    const executor = getExecutor(req);
    const data = await conversationHistoryService.delete(executor, {
      source,
      sessionIds: sessionIds.map((value) => String(value).slice(0, 256)),
    });

    res.json({ ok: true, data });
  }),
};
