// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * CSRF protection middleware.
 *
 * Uses double-submit cookie pattern:
 * 1. Server sets a random CSRF token in a non-httpOnly cookie.
 * 2. Client reads it and sends it back in X-CSRF-Token header.
 * 3. Server compares the two.
 */

import type { RequestHandler } from "express";
import { ONE_DAY_SECONDS } from "../../../shared/constants.js";
import { randomHex, safeEqual } from "../../../shared/utils/crypto.js";
import { authConfig } from "../../../config/auth.js";
import { AppError } from "../../../shared/errors/index.js";
import { cookieDomainMatchesHost, purgeLegacyDomainCookies } from "../../../shared/cookies.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Middleware that sets CSRF cookie if not present. */
export const csrfCookieSetter: RequestHandler = (req, res, next) => {
  const name = authConfig.cookie.csrfName;
  purgeLegacyDomainCookies(res, name, {
    legacyDomains: authConfig.cookie.legacyDomains,
    activeDomain: authConfig.cookie.domain,
    requestHost: req.headers.host,
    secure: authConfig.cookie.secure,
    sameSite: authConfig.cookie.sameSite,
    httpOnly: false,
  });
  if (!req.cookies?.[name]) {
    const token = randomHex(32);
    // Only scope to COOKIE_DOMAIN when it actually covers the request host —
    // same guard the session cookie uses (token.service). Otherwise the browser
    // silently drops the CSRF cookie (access by IP / alternate host), and every
    // mutating request — including login — would 403 forever.
    const effectiveDomain = cookieDomainMatchesHost(authConfig.cookie.domain, req.headers.host)
      ? authConfig.cookie.domain
      : undefined;
    res.cookie(name, token, {
      httpOnly: false, // JS must be able to read it
      secure: authConfig.cookie.secure,
      sameSite: authConfig.cookie.sameSite,
      domain: effectiveDomain,
      path: "/",
      maxAge: ONE_DAY_SECONDS * 1000, // 24h
    });
  }
  next();
};

/** Middleware that verifies CSRF token on state-changing requests. */
export const csrfProtection: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const name = authConfig.cookie.csrfName;
  const cookieToken = req.cookies?.[name];
  const headerToken = req.headers["x-csrf-token"];

  if (
    !cookieToken ||
    !headerToken ||
    typeof cookieToken !== "string" ||
    typeof headerToken !== "string" ||
    // SECURITY: constant-time compare to avoid a timing oracle on the token.
    !safeEqual(cookieToken, headerToken)
  ) {
    next(new AppError("CSRF token mismatch", 403, "CSRF_ERROR"));
    return;
  }

  next();
};
