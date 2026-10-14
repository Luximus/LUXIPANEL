// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Auth / session configuration derived from validated environment.
 */

import { env } from "./env.js";

export const authConfig = {
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    rememberExpiresIn: env.JWT_REMEMBER_EXPIRES_IN,
  },

  cookie: {
    domain: env.COOKIE_DOMAIN || undefined,
    // Wildcard domains to purge on every cookie set/clear (migration cleanup).
    legacyDomains: env.COOKIE_LEGACY_DOMAINS.split(",")
      .map((d) => d.trim())
      .filter(Boolean),
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    sessionName: env.SESSION_COOKIE_NAME,
    csrfName: env.CSRF_COOKIE_NAME,
  },

  hcaptcha: {
    enabled: env.HCAPTCHA_ENABLED,
    secret: env.HCAPTCHA_SECRET,
    sitekey: env.HCAPTCHA_SITEKEY,
  },

  webauthn: {
    rpName: env.WEBAUTHN_RP_NAME,
    rpId: env.WEBAUTHN_RP_ID,
    origin: env.WEBAUTHN_ORIGIN,
  },
} as const;
