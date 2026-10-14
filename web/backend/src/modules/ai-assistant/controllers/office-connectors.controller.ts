// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Office connectors HTTP controller.
 *
 * Connectors are instance-level; the service wraps every operation in
 * `runOnPanelHost`, so these handlers do not need the per-request executor.
 */

import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { AppError } from "../../../shared/errors/index.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";
import { officeConnectorsService } from "../services/office-connectors.service.js";

export const officeConnectorsController = {
  list: asyncHandler(async (_req: Request, res: Response) => {
    const connectors = await officeConnectorsService.list();
    res.json({ ok: true, data: { connectors } });
  }),

  connect: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const body = (req.body ?? {}) as { secrets?: Record<string, unknown> };
    const rawSecrets = body.secrets ?? {};
    const secrets: Record<string, string> = Object.fromEntries(
      Object.entries(rawSecrets)
        .filter(([, v]) => v != null)
        .map(([k, v]) => [k, String(v)]),
    );
    const connector = await officeConnectorsService.connect(id, secrets);
    res.json({ ok: true, data: { connector } });
  }),

  disconnect: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    await officeConnectorsService.disconnect(id);
    res.json({ ok: true });
  }),

  setActive: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const body = (req.body ?? {}) as { active?: unknown };
    const active = body.active === true || body.active === "true";
    const connector = await officeConnectorsService.setActive(id, active);
    res.json({ ok: true, data: { connector } });
  }),

  browse: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const query = typeof req.query["query"] === "string" ? req.query["query"] : "";
    const files = await officeConnectorsService.browse(id, query);
    res.json({ ok: true, data: { files } });
  }),

  fetchFile: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const body = (req.body ?? {}) as { fileId?: string; name?: string };
    const fileId = String(body.fileId ?? "");
    if (!fileId) throw new AppError(apiModuleMessage(res.locals.locale, "fileIdRequired"), 400, "MISSING_FILE_ID");
    const file = await officeConnectorsService.fetchFile(id, fileId, body.name);
    res.json({ ok: true, data: { file } });
  }),
};
