// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Login controller — handles POST /api/login and GET /api/auth/login-methods.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { authService } from "../services/auth.service.js";
import { hcaptchaService } from "../services/hcaptcha.service.js";
import { requestMeta } from "../../../shared/http/request-meta.js";
import { asyncHandler } from "../../../shared/types/index.js";
import { resolveEffectiveLoginMethods } from "../services/login-methods.service.js";
import { ErrorCodes } from "../../../shared/errors/codes.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";

const loginSchema = z.object({
  user: z.string().min(1, "Username is required").trim(),
  pass: z.string().min(1, "Password is required"),
  hcaptchaToken: z.string().default(""),
  remember: z.boolean().default(false),
});

/** Public host the request arrived at: the proxy's `x-forwarded-host` header
 *  when present, else the `Host` header. */
function getForwardedHost(req: Request): string | undefined {
  return (req.headers["x-forwarded-host"] as string | undefined) || req.headers.host;
}

export const loginController = {
  login: asyncHandler(async (req: Request, res: Response) => {
    const body = loginSchema.parse(req.body);

    // Block when the password method has been disabled in panel security
    // settings. The frontend already hides the tab, but we enforce here so
    // direct calls to /api/login can't bypass an admin-disabled flow.
    const methods = await resolveEffectiveLoginMethods();
    if (!methods.password) {
      res.status(403).json({ ok: false, error: apiModuleMessage(res.locals.locale, "passwordLoginDisabled"), code: ErrorCodes.PASSWORD_LOGIN_DISABLED });
      return;
    }

    // Verify captcha if enabled
    try {
      await hcaptchaService.verify(body.hcaptchaToken);
    } catch (_err) {
      res.status(400).json({ ok: false, error: apiModuleMessage(res.locals.locale, "captchaFailed"), code: ErrorCodes.CAPTCHA_FAILED });
      return;
    }

    // Authenticate against the server's real Linux accounts (self-hosted): no
    // LP-LICENSE-SERVER, no SSH bridge — the session binds to the local executor.
    const forwardedHost = getForwardedHost(req);
    const authMeta = { ...requestMeta(req), host: forwardedHost };
    const user = await authService.loginLocal(body.user, body.pass, body.remember, authMeta);

    // Build login response: either partial (MFA pending) or full session
    const response = await authService.buildLoginResponse(user, body.remember, res);

    res.json({ ok: true, ...response });
  }),

  /** GET /api/auth/login-methods — public endpoint to check enabled login methods. */
  getLoginMethods: asyncHandler(async (_req: Request, res: Response) => {
    // Single source of truth for ENABLEMENT so the tabs rendered at /login match
    // exactly what the verify endpoints allow (all sourced from the per-server
    // security sidecar). The panel is self-hosted, so it always "matches".
    const data = await resolveEffectiveLoginMethods();
    res.json({ ok: true, matched: true, configured: true, data });
  }),
};
