// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Locale detection middleware.
 *
 * Sets res.locals.locale from ?lang=, the panel's locale cookie, or
 * Accept-Language, in the same precedence as the frontend.
 */

import type { RequestHandler } from "express";
import { env } from "../../config/env.js";

export const localeDetector: RequestHandler = (req, res, next) => {
  const supported = env.SUPPORTED_LOCALES;
  const defaultLocale = env.DEFAULT_LOCALE;
  const resolve = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const code = value.trim().split(";")[0]?.split("-")[0]?.toLowerCase();
    return code && supported.includes(code) ? code : null;
  };

  // 1. Explicit query param
  const qLang = resolve(req.query.lang);
  if (qLang) {
    res.locals.locale = qLang;
    next();
    return;
  }

  // 2. Saved UI preference (cookie-parser runs before this middleware).
  const cookieLang = resolve(req.cookies?.["lxp-locale"]);
  if (cookieLang) {
    res.locals.locale = cookieLang;
    next();
    return;
  }

  // 3. Accept-Language header
  const accept = req.headers["accept-language"] || "";
  for (const part of accept.split(",")) {
    const lang = resolve(part);
    if (lang) {
      res.locals.locale = lang;
      next();
      return;
    }
  }

  // 4. Default
  res.locals.locale = defaultLocale;
  next();
};
