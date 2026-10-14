// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Request logger middleware — logs method, url, status, duration.
 */

import type { RequestHandler } from "express";
import { logger } from "../logger/index.js";
import { diagnosticContext } from "../diagnostics/context.js";

/** Redact one-shot / sensitive secrets carried in the query string (SSO
 *  `ticket`, OTP `code`, reset `token`) so they never land in the request log
 *  or audit trail — the `GET …?ticket=` handoff variant still exists. */
function redactUrl(url: string): string {
  return url.replace(/([?&](?:ticket|code|token|password|pass)=)[^&#]*/gi, "$1[redacted]");
}

export const requestLogger: RequestHandler = (req, res, next) => {
  const start = process.hrtime.bigint();
  const context = () => ({ user: res.locals.authBaseUser || res.locals.user, requestId: res.locals.requestId, url: req.originalUrl });

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    const safeUrl = redactUrl(req.originalUrl);

    diagnosticContext.run(context, () => logger[level](
      {
        method: req.method,
        url: safeUrl,
        status: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        requestId: res.locals.requestId,
        ip: req.ip,
      },
      `${req.method} ${safeUrl} → ${res.statusCode} (${durationMs.toFixed(1)}ms)`,
    ));
  });

  diagnosticContext.run(context, next);
};
