// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * hCaptcha verification service.
 */

import { AuthError } from "../../../shared/errors/index.js";
import { ErrorCodes } from "../../../shared/errors/codes.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { securitySettingsService } from "../../admin/services/security-settings.service.js";

const log = createModuleLogger("hcaptcha");

const VERIFY_URL = "https://api.hcaptcha.com/siteverify";
/** Bound the siteverify call so a hung hCaptcha endpoint can't stall login. */
const HCAPTCHA_VERIFY_TIMEOUT_MS = 5_000;

export const hcaptchaService = {
  /** Verify an hCaptcha token. Throws AuthError if invalid. */
  async verify(token: string): Promise<void> {
    // Per-server config lives in the security sidecar. `verify` runs at login
    // with NO executor in context, so `read()` (no arg) safely falls back to
    // DEFAULTS (hcaptchaEnabled=false) via its own try/catch — captcha is a
    // no-op until an admin enables it for this server.
    const settings = await securitySettingsService.read();
    if (!settings.hcaptchaEnabled) return;

    if (!token) {
      throw new AuthError("Captcha verification required", ErrorCodes.CAPTCHA_REQUIRED);
    }

    try {
      const body = new URLSearchParams({
        secret: settings.hcaptchaSecret,
        response: token,
      });

      const res = await fetch(VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        // Bound the call so a hung siteverify can't stall the login request.
        // A timeout throws → caught below → fail-CLOSED (CAPTCHA_FAILED).
        signal: AbortSignal.timeout(HCAPTCHA_VERIFY_TIMEOUT_MS),
      });

      const data = (await res.json()) as { success: boolean; "error-codes"?: string[] };

      if (!data.success) {
        log.warn({ errors: data["error-codes"] }, "hCaptcha verification failed");
        throw new AuthError("Captcha verification failed", ErrorCodes.CAPTCHA_FAILED);
      }
    } catch (err) {
      if (err instanceof AuthError) throw err;
      log.error({ err }, "hCaptcha service error");
      throw new AuthError("Captcha verification failed", ErrorCodes.CAPTCHA_FAILED);
    }
  },
};
