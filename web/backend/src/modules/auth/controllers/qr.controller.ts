// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * QR Auth controller — desktop-to-mobile session handoff.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { qrAuthService, qrRequesterFingerprint } from "../services/qr-auth.service.js";
import { authService } from "../services/auth.service.js";
import { tokenService } from "../services/token.service.js";
import { configuredSessionExpiry } from "../services/session-duration.js";
import { securitySettingsService } from "../../admin/services/security-settings.service.js";
import { getDirectExecutorByBridgeSessionId } from "../../../shared/executor/factory.js";
import { localExecutor } from "../../../shared/executor/local-executor.js";
import { panelUserRepository } from "../repositories/index.js";
import { asyncHandler } from "../../../shared/types/index.js";
import { AuthError } from "../../../shared/errors/index.js";
import { extractIp } from "../../../shared/utils/ip.js";
import { pickDefined } from "../../../shared/utils/pick-defined.js";
import { requestMeta } from "../../../shared/http/request-meta.js";
import type { QrBridgeContext } from "../services/qr-auth.service.js";

/** Drop `undefined`-valued keys (keeps `null`/`false`). */

const approveSchema = z.object({
  requestId: z.string().uuid(),
});

const pollSchema = z.object({
  requestId: z.string().uuid(),
});

export const qrController = {
  /** POST /api/auth/qr/request — desktop creates a QR session. Binds it to the
   *  requesting client (IP + user-agent) so only it can poll the issued token. */
  request: asyncHandler(async (req: Request, res: Response) => {
    const requester = qrRequesterFingerprint(extractIp(req), String(req.headers["user-agent"] || ""));
    const { requestId, expiresAt } = await qrAuthService.createRequest(requester);
    res.json({ ok: true, requestId, expiresAt });
  }),

  /** POST /api/auth/qr/approve — mobile (authenticated) approves the QR session. */
  approve: asyncHandler(async (req: Request, res: Response) => {
    const { requestId } = approveSchema.parse(req.body);
    const user = res.locals.user;
    const bridged = res.locals.bridgedSession as
      | { remoteSessionId?: string; remoteUserId?: number; targetId?: string; targetName?: string; licenseSlots?: number; direct?: boolean }
      | undefined;

    // Capture the approver's bridged-session context so the desktop token
    // inherits it (managed mode requires a bridged session on every /panel/*).
    const bridge: QrBridgeContext = pickDefined({
      bridgeSessionId: user.bridgeSessionId,
      remoteSessionId: user.remoteSessionId ?? bridged?.remoteSessionId,
      remoteUserId: bridged?.remoteUserId,
      targetId: user.targetId ?? bridged?.targetId,
      targetName: user.targetName ?? bridged?.targetName,
      targetHost: user.targetHost,
      licenseSlots: user.licenseSlots ?? bridged?.licenseSlots,
      direct: bridged?.direct ? true : undefined,
      tenantId: user.tenantId,
    });

    await qrAuthService.approve(requestId, user.userId, Object.keys(bridge).length ? bridge : undefined);
    res.json({ ok: true });
  }),

  /** GET /api/auth/qr/poll/:requestId — desktop polls for approval. */
  poll: asyncHandler(async (req: Request, res: Response) => {
    const { requestId } = pollSchema.parse({ requestId: req.params["requestId"] });
    const requester = qrRequesterFingerprint(extractIp(req), String(req.headers["user-agent"] || ""));

    const result = await qrAuthService.poll(requestId, requester);

    if (result.status !== "approved" || !result.userId) {
      res.json({ ok: true, status: result.status });
      return;
    }

    // Session approved — issue token
    const user = await panelUserRepository.findById(result.userId);
    if (!user || !user.enabled) throw new AuthError("Account not found or disabled", "ACCOUNT_NOT_FOUND");

    const payload = await authService.buildTokenPayload(user);
    // Re-attach the bridge context captured at approval time. buildTokenPayload
    // only restores DB-derived fields (role/modules/permissions); without the
    // bridge fields the cookie is "unbridged" and every /panel/* route 401s.
    if (result.bridge) Object.assign(payload, pickDefined(result.bridge as Record<string, unknown>));
    const executor = result.bridge?.direct
      ? await getDirectExecutorByBridgeSessionId(result.bridge.bridgeSessionId ?? "", result.bridge.targetId, result.bridge.targetName)
      : localExecutor;
    if (!executor) throw new AuthError("Invalid or expired session");
    const settings = await securitySettingsService.read(executor);
    const expiresAt = configuredSessionExpiry(settings.sessionDurationHours);
    const { token } = tokenService.signWithExpiry(payload, expiresAt);

    tokenService.setSessionCookie(res, token, false, expiresAt);

    await authService.logAudit("qr_login", user.id, "info", requestMeta(req));

    res.json({ ok: true, status: "approved", expiresAt });
  }),
};
