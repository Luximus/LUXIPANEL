// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * OTP controller — request and verify one-time passwords.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { otpService } from "../services/otp.service.js";
import { authService, establishLocalBridge } from "../services/auth.service.js";
import { withLocalAuthScope } from "../services/login-methods.service.js";
import { panelUserRepository } from "../repositories/index.js";
import { asyncHandler } from "../../../shared/types/index.js";
import { AuthError } from "../../../shared/errors/index.js";
import { requestMeta } from "../../../shared/http/request-meta.js";
import { env } from "../../../config/env.js";

const requestSchema = z.object({
  username: z.string().min(1).trim(),
});

const verifySchema = z.object({
  requestId: z.string().min(1),
  code: z.string().length(6).regex(/^\d{6}$/),
  remember: z.boolean().default(false),
});

export const otpController = {
  /** POST /api/auth/otp/request — request an OTP for a username. */
  request: asyncHandler(async (req: Request, res: Response) => {
    const { username } = requestSchema.parse(req.body);

    const result = await otpService.request(username);

    const payload: Record<string, unknown> = {
      ok: true,
      requestId: result.requestId,
      expiresAt: result.expiresAt,
      deliveryMode: result.deliveryMode,
    };

    // Only expose preview code in non-production environments
    if (env.NODE_ENV !== "production" && result.previewCode) {
      payload["previewCode"] = result.previewCode;
    }

    res.json(payload);
  }),

  /** POST /api/auth/otp/verify — verify an OTP and issue a session. */
  verify: asyncHandler(async (req: Request, res: Response) => {
    const body = verifySchema.parse(req.body);

    const userId = await otpService.verify(body.requestId, body.code);

    // Pin the panel-host executor: user lookup + session build hit the
    // per-server kv-store, which fails closed pre-auth (same as recovery login).
    await withLocalAuthScope(async () => {
      const user = await panelUserRepository.findById(userId);
      if (!user || !user.enabled) throw new AuthError("Account not found or disabled", "ACCOUNT_NOT_FOUND");

      // Route through buildLoginResponse (like password/passkey/recovery) so the
      // mandatory-2FA gate applies. Signing a full session directly here would
      // let an OTP login bypass a required TOTP second factor.
      const bridge = establishLocalBridge(user.username);
      const response = await authService.buildLoginResponse(
        { ...user, bridge },
        body.remember,
        res,
      );

      await authService.logAudit("otp_login", userId, "info", requestMeta(req));

      res.json({ ok: true, ...response });
    });
  }),
};
