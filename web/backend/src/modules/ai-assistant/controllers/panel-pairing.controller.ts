// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Panel-to-panel MCP pairing endpoint (panel A side).
 *
 * POST /api/ai/servers/:id/pair — provision an inbound peer credential on a
 * target that runs LUXIPANEL, over the SSH connection A already has. Gated by
 * the same vault authorization as the sidebar switch (userMayUseTarget) so a
 * user can only pair a target they may operate. The pairing itself is behind
 * `PANEL_PEER_MCP_ENABLED` for the transport to actually be used at runtime, but
 * provisioning the credential ahead of the flag flip is allowed.
 */

import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { AppError, ForbiddenError, ValidationError } from "../../../shared/errors/index.js";
import { ErrorCodes } from "../../../shared/errors/codes.js";
import { apiModuleMessage, type ModuleMessageKey } from "../../../shared/i18n/module-messages.js";
import { targetsRepository, userMayUseTarget } from "../../servers/index.js";
import { pairPanelTarget, type PairResult } from "../services/panel-pairing.service.js";
import { panelOriginFromRequest } from "../../../shared/http/panel-origin.js";

const failureMessages: Record<NonNullable<PairResult["code"]>, ModuleMessageKey> = {
  serverNotRegistered: "pairUnregistered",
  fingerprintRequired: "pairFingerprintRequired",
  writeFailed: "pairWriteFailed",
  pairFailed: "pairFailed",
};

export const panelPairingController = {
  pair: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const target = await targetsRepository.get(id);
    if (!target) throw new AppError(apiModuleMessage(res.locals.locale, "serverNotFound"), 404, ErrorCodes.NOT_FOUND);

    const u = res.locals.user;
    const viewer = {
      userId: typeof u?.userId === "number" ? u.userId : null,
      isAdmin: u?.kind === "admin",
    };
    if (!userMayUseTarget(target, viewer)) {
      throw new ForbiddenError(apiModuleMessage(res.locals.locale, "pairDenied"));
    }
    if (!target.hasLuxipanel) {
      throw new ValidationError(apiModuleMessage(res.locals.locale, "pairMarkTarget"));
    }

    const result = await pairPanelTarget(id, {
      label: panelOriginFromRequest(req),
      ...(target.luxipanelBaseUrl ? { baseUrl: target.luxipanelBaseUrl } : {}),
    });
    if (!result.ok) {
      res.status(502).json({ ok: false, error: apiModuleMessage(res.locals.locale, failureMessages[result.code ?? "pairFailed"]) });
      return;
    }
    res.json({ ok: true, data: { verified: result.verified } });
  }),
};
