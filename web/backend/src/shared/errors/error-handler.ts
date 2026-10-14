// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Centralized error handler middleware.
 *
 * Maps any thrown value to a `{statusCode, body, logLevel}` triple via
 * `mapErrorToResponse()` and writes a single response. Operational errors
 * (`AppError` subclasses) surface as-is; unexpected errors are masked with a
 * generic 500 in production to avoid leaking stack traces.
 */

import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError, ValidationError } from "./errors.js";
import { ErrorCodes } from "./codes.js";
import { logger } from "../logger/index.js";
import { env } from "../../config/env.js";
import { apiErrorMessage, apiLocaleFromRequest, localizeDefaultError } from "../i18n/errors.js";
import { zodIssues } from "../validators/zod-issues.js";

export type ErrorLogLevel = "warn" | "error";

export interface MappedErrorResponse {
  statusCode: number;
  body: { ok: false; error: string; code: string; details?: unknown };
  logLevel: ErrorLogLevel | null;
}

/**
 * Pure mapper: given any thrown value, returns the HTTP status, JSON body, and
 * the log level the handler should emit. Decoupling the mapping from the
 * handler keeps the middleware a thin glue layer and lets unit tests assert
 * the response shape without touching `res`/`next`.
 */
export function mapErrorToResponse(err: unknown, locale: unknown = "en"): MappedErrorResponse {
  if (err instanceof ZodError) {
    const details = zodIssues(err.issues, locale);
    // Surface the concrete field errors in the message so clients that only
    // show `error` (not `details`) still tell the user what's wrong.
    const summary = details
      .map((d) => (d.field ? `${d.field}: ${d.message}` : d.message))
      .join(" · ");
    const wrapped = new ValidationError(summary || apiErrorMessage(locale, "validation"), details);
    return {
      statusCode: wrapped.statusCode,
      logLevel: "warn",
      body: {
        ok: false,
        error: wrapped.message,
        code: wrapped.code,
        details: wrapped.details,
      },
    };
  }

  if (err instanceof AppError && err.isOperational) {
    const body: MappedErrorResponse["body"] = {
      ok: false,
      error: localizeDefaultError(locale, err.message, err.code),
      code: err.code,
    };
    if (err instanceof ValidationError) {
      body.details = err.details;
    }
    return {
      statusCode: err.statusCode,
      logLevel: err.statusCode >= 500 ? "error" : "warn",
      body,
    };
  }

  // raw-body / body-parser payload-too-large (e.g. express.raw({ limit }) on the
  // file upload route). It carries `type: "entity.too.large"` + statusCode 413
  // but is NOT an AppError, so without this it would fall through to the generic
  // branch below and surface as an opaque "Internal server error" (masked in
  // prod) with an INTERNAL_ERROR code. Map it to a clean, typed 413.
  if ((err as { type?: unknown })?.type === "entity.too.large") {
    return {
      statusCode: 413,
      logLevel: "warn",
      body: { ok: false, error: apiErrorMessage(locale, "payloadTooLarge"), code: ErrorCodes.PAYLOAD_TOO_LARGE },
    };
  }

  const statusCode =
    typeof (err as { statusCode?: unknown })?.statusCode === "number"
      ? (err as { statusCode: number }).statusCode
      : 500;
  const message =
    // Preserve masking even when NODE_ENV changes after config was parsed
    // (for example in a test or a process supervisor transition).
    (env.NODE_ENV === "production" || process.env.NODE_ENV === "production")
      ? apiErrorMessage(locale, "internal")
      : (err as Error)?.message || apiErrorMessage(locale, "internal");

  return {
    statusCode,
    logLevel: "error",
    body: { ok: false, error: message, code: ErrorCodes.INTERNAL_ERROR },
  };
}

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  // ---- Response already started/sent → don't try to respond again ----
  // Express' standard contract: once headers are flushed, a second
  // res.status(...).json(...) throws `ERR_HTTP_HEADERS_SENT`. Delegate to the
  // default Express handler (it will close the connection) and log one line so
  // the underlying error is still traceable.
  if (res.headersSent) {
    logger.warn(
      { code: (err as { code?: string })?.code, method: req.method, url: req.originalUrl },
      "Error after response already sent — delegating to default handler",
    );
    return next(err);
  }

  const mapped = mapErrorToResponse(err, res.locals?.locale ?? apiLocaleFromRequest(req));

  if (mapped.logLevel === "error") {
    logger.error({ err, method: req.method, url: req.originalUrl, requestId: res.locals?.requestId, statusCode: mapped.statusCode }, mapped.body.error);
  } else if (mapped.logLevel === "warn") {
    logger.warn(
      { err, code: mapped.body.code, statusCode: mapped.statusCode, method: req.method, url: req.originalUrl, requestId: res.locals?.requestId },
      mapped.body.error,
    );
  }

  res.status(mapped.statusCode).json(mapped.body);
};
