// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * TOTP controller — 2FA setup, enable, disable, and verification endpoints.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { totpRepository, panelUserRepository } from "../repositories/index.js";
import { totpService } from "../services/totp.service.js";
import {
  authService,
  clearFailedCount,
  getFailedCount,
  recordFailedMfaAttempt,
  resolveLockScope,
} from "../services/auth.service.js";
import { securitySettingsService } from "../../admin/services/security-settings.service.js";
import { tokenService } from "../services/token.service.js";
import { AuthError } from "../../../shared/errors/index.js";
import { ErrorCodes } from "../../../shared/errors/codes.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { requestMeta } from "../../../shared/http/request-meta.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";

const log = createModuleLogger("totp-controller");

const enableSchema = z.object({
  code: z.string().length(6, "Code must be 6 digits"),
});

const verifySchema = z.object({
  code: z.string().length(6, "Code must be 6 digits"),
});

export const totpController = {
  /** GET /api/auth/totp/status — check if user has 2FA enabled and/or configured. */
  status: asyncHandler(async (_req: Request, res: Response) => {
    const { userId } = res.locals.user;
    const totp = await totpRepository.getByUser(userId);
    res.json({
      ok: true,
      enabled: totp?.enabled ?? false,
      configured: Boolean(totp),
    });
  }),

  /** GET /api/auth/totp/setup — generate a new secret and QR code URI. */
  setup: asyncHandler(async (_req: Request, res: Response) => {
    const { userId, username } = res.locals.user;

    // CSRF hardening: `setup` rotates the secret and stores it with
    // enabled=false. If 2FA is ALREADY enabled, honoring this (reachable via a
    // forged top-level GET with a `lax` session cookie) would silently disable
    // the victim's 2FA. Refuse to touch an active secret — the user must
    // explicitly disable 2FA first. This preserves the normal setup flow (only
    // ever invoked when 2FA is not yet enabled).
    const existing = await totpRepository.getByUser(userId);
    if (existing?.enabled) {
      throw new AuthError(
        apiModuleMessage(res.locals.locale, "totpAlreadyActive"),
        ErrorCodes.TWOFA_REQUIRED,
      );
    }

    const secret = totpService.generateSecret();
    const qrUri = totpService.otpAuthUri(username, secret);

    // Store secret temporarily (enabled=false) so user can verify before enabling
    await totpRepository.upsert(userId, secret, false);

    log.info({ userId }, "TOTP setup initiated");

    res.json({
      ok: true,
      data: {
        secret,
        qrUri,
      },
    });
  }),

  /** POST /api/auth/totp/enable — verify code and enable 2FA. */
  enable: asyncHandler(async (req: Request, res: Response) => {
    const body = enableSchema.parse(req.body);
    const { userId } = res.locals.user;

    const totp = await totpRepository.getByUser(userId);
    if (!totp) {
      throw new AuthError(apiModuleMessage(res.locals.locale, "totpSetupRequired"));
    }

    // Verify code against the stored secret (single-use: anti-replay per user)
    const valid = await totpService.verify(body.code, totp.secret, { userId });
    if (!valid) {
      throw new AuthError(apiModuleMessage(res.locals.locale, "invalidTotpCode"), "INVALID_TOTP");
    }

    // Code is valid — enable 2FA
    await totpRepository.enable(userId);

    log.info({ userId }, "2FA enabled");

    res.json({ ok: true, message: apiModuleMessage(res.locals.locale, "totpEnabled") });
  }),

  /** PATCH /api/auth/totp/disable — disable 2FA for the user without deleting the secret. */
  disable: asyncHandler(async (_req: Request, res: Response) => {
    const { userId } = res.locals.user;

    await totpRepository.disable(userId);

    log.info({ userId }, "2FA disabled");

    res.json({ ok: true, message: apiModuleMessage(res.locals.locale, "totpDisabled") });
  }),

  /** PATCH /api/auth/totp/activate — enable 2FA for an existing secret without reconfiguring it. */
  activate: asyncHandler(async (_req: Request, res: Response) => {
    const { userId } = res.locals.user;

    const totp = await totpRepository.getByUser(userId);
    if (!totp) {
      throw new AuthError(apiModuleMessage(res.locals.locale, "totpNotConfigured"));
    }

    await totpRepository.enable(userId);

    log.info({ userId }, "2FA activated");

    res.json({ ok: true, message: apiModuleMessage(res.locals.locale, "totpActivated") });
  }),

  /** DELETE /api/auth/totp/delete — remove the stored 2FA secret entirely. */
  remove: asyncHandler(async (_req: Request, res: Response) => {
    const { userId } = res.locals.user;

    await totpRepository.remove(userId);

    log.info({ userId }, "2FA secret deleted");

    res.json({ ok: true, message: apiModuleMessage(res.locals.locale, "totpSecretDeleted") });
  }),

  /** POST /api/auth/2fa/verify — verify TOTP code during login (requires MFA pending token). */
  verifyLogin: asyncHandler(async (req: Request, res: Response) => {
    const body = verifySchema.parse(req.body);
    const mfaUser = res.locals.mfaUser;
    const { userId, remember } = mfaUser;
    const forwardedHost = (req.headers["x-forwarded-host"] as string | undefined) || req.headers.host;
    const lockScope = resolveLockScope(forwardedHost);
    const username = (mfaUser.username as string | undefined) ?? String(userId);

    // Enforce max-failed-login lockout BEFORE we even try to verify the TOTP
    // code — the SAME gate the password path applies in authService.login()
    // (which checks lockout BEFORE validating). The MFA-pending token is
    // reusable until it expires (~5 min), so without this an attacker could
    // brute-force the 6-digit code. Mirrors the password gate's check, error
    // wording and 30-minute window exactly.
    const settings = await securitySettingsService.read();
    const failedCount = await getFailedCount(lockScope, username);
    if (settings.maxFailedLoginAttempts > 0 && failedCount >= settings.maxFailedLoginAttempts) {
      throw new AuthError(apiModuleMessage(res.locals.locale, "accountLocked").replace("{count}", String(settings.maxFailedLoginAttempts)));
    }

    // Get TOTP secret for the user
    const totp = await totpRepository.getByUser(userId);
    if (!totp?.enabled) {
      throw new AuthError(apiModuleMessage(res.locals.locale, "totpNotConfigured"));
    }

    // Verify the code (single-use: anti-replay per user)
    const valid = await totpService.verify(body.code, totp.secret, { userId });
    if (!valid) {
      await recordFailedMfaAttempt({
        lockScope,
        username,
        userId,
        reason: "totp_invalid",
        baseMessage: apiModuleMessage(res.locals.locale, "invalidTotpCode"),
        meta: requestMeta(req),
      });
    }

    // Code verified — issue full session token, carrying any SSH bridge
    // metadata that was stashed in the MFA-pending token.
    const user = await panelUserRepository.findById(userId);
    if (!user || !user.enabled) {
      throw new AuthError(apiModuleMessage(res.locals.locale, "accountUnavailable"));
    }

    // Successful 2FA — reset the shared failed-attempts counter so any
    // partial increments from earlier attempts don't trigger a later lockout.
    await clearFailedCount(lockScope, user.username);

    const payload = await authService.buildTokenPayload(user);
    if (mfaUser.bridgeSessionId) payload.bridgeSessionId = mfaUser.bridgeSessionId;
    if (mfaUser.targetId) payload.targetId = mfaUser.targetId;
    if (mfaUser.targetName) payload.targetName = mfaUser.targetName;
    if (mfaUser.local) payload.local = true;
    else if (mfaUser.direct) payload.direct = true;

    payload.mfaAuthenticated = true;
    const result = tokenService.sign(payload, remember ?? false);
    tokenService.setSessionCookie(res, result.token, remember ?? false);

    log.info({ userId }, "2FA verification successful");

    res.json({ ok: true, expiresAt: result.expiresAt });
  }),
};
