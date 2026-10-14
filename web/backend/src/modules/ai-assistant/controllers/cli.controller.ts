// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AI Assistant — CLI status (read-only).
 *
 *   GET /api/ai/cli/specs              — list of CLI specs per provider
 *   GET /api/ai/cli/:provider/status   — probe (installed, loggedIn, version)
 *
 * Install + login of CLIs is handled by the Terminal module's floating
 * terminal. The Assistant just inspects the resulting state.
 */

import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { assistantNotFound } from "./not-found-i18n.js";
import { isAssistantProviderId } from "../models/assistant-config.types.js";
import { cliInstallerService } from "../services/cli-installer.service.js";

export const cliController = {
  specs: asyncHandler(async (_req: Request, res: Response) => {
    res.json({ ok: true, specs: cliInstallerService.list() });
  }),

  status: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["provider"] ?? "");
    if (!isAssistantProviderId(id)) throw assistantNotFound(res.locals.locale, "provider");
    const executor = getExecutor(req);
    const result = await cliInstallerService.status(id, executor);
    res.json({ ok: true, status: result });
  }),
};
