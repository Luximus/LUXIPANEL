// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Custom error hierarchy.
 *
 * Every error carries an HTTP statusCode so the error handler can respond
 * consistently without inspecting error messages.
 */
import { ErrorCodes, type ErrorCode } from "./codes.js";
import { errReason } from "../utils/err-message.js";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode = 500,
    code: ErrorCode = ErrorCodes.INTERNAL_ERROR,
    context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.context = context;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  public readonly details: Array<{ field: string; message: string }>;

  constructor(
    message = "Validation failed",
    details: Array<{ field: string; message: string }> = [],
  ) {
    super(message, 400, ErrorCodes.VALIDATION_ERROR);
    this.details = details;
  }
}

export class AuthError extends AppError {
  /**
   * `code` lets the frontend map the failure to a localized message
   * (login namespace) instead of showing the raw server string. Defaults to
   * the generic "AUTH_ERROR" for back-compat with throws that don't pass one.
   */
  constructor(message = "Authentication required", code: ErrorCode = ErrorCodes.AUTH_ERROR) {
    super(message, 401, code);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied") {
    super(message, 403, ErrorCodes.FORBIDDEN);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, 404, ErrorCodes.NOT_FOUND);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource already exists") {
    super(message, 409, ErrorCodes.CONFLICT);
  }
}

/**
 * Canonical "an upstream dependency is temporarily unavailable" error. HTTP
 * 503 (the standard semantic for a degraded upstream) with code
 * `SERVICE_UNAVAILABLE`. Use this when the panel itself is healthy but a
 * backing service (AI provider, license server, mail server, …) is failing —
 * the client should retry rather than treat the response as a permanent
 * failure. The reflected message MUST be a sanitized/generic string; raw
 * upstream provider messages (which may contain API keys, stack traces,
 * internal host names) must be logged server-side via the normal `log.error`
 * path, not surfaced to the caller.
 */
export class ServiceUnavailableError extends AppError {
  constructor(
    message = "El servicio no está disponible temporalmente. Intenta de nuevo.",
    code: ErrorCode = ErrorCodes.SERVICE_UNAVAILABLE,
    context?: Record<string, unknown>,
  ) {
    super(message, 503, code, context);
  }
}

/**
 * A tenant tried to create a resource (domain / mailbox / database / sub-user)
 * that would exceed its account quota. HTTP 402 (Payment Required) — the
 * reseller-facing "you need a bigger plan" semantics — with `code:
 * "QUOTA_EXCEEDED"` so the frontend can localize the message. `resource` and any
 * extra context are folded into the standard `context` bag (the error handler
 * already surfaces `code`/`message`; `resource` lets the UI badge which quota
 * was hit). Thrown by `shared/quota/quota-checker.ts#assertResourceQuota`.
 */
export class QuotaExceededError extends AppError {
  constructor(
    message: string,
    resource?: string,
    context?: Record<string, unknown>,
  ) {
    super(message, 402, ErrorCodes.QUOTA_EXCEEDED, { resource, ...context });
  }
}

/**
 * Canonical "no connected server in context" error. In managed mode every
 * per-server operation needs the per-request `Executor` (resolved from the
 * AsyncLocalStorage context); fail-closed — we never fall back to a local
 * executor (CLAUDE.md §"Aislamiento total por servidor"). Several modules
 * (users, module-dev, …) used to throw this with divergent statuses (409/503)
 * and ad-hoc messages; this unifies them on HTTP 503 (the target is temporarily
 * unavailable: no SSH executor in context) with one Spanish message and the
 * shared `code: "NO_SERVER_EXECUTOR"`.
 */
export class NoServerExecutorError extends AppError {
  constructor(message = "No hay un servidor conectado en contexto.") {
    super(message, 503, ErrorCodes.NO_SERVER_EXECUTOR);
  }
}

/**
 * Canonical "the request carries no bridged session" error. Per-server
 * endpoints resolve their `Executor` from the request's bridged session
 * (`bridgeSessionId` + `targetId`, hydrated in `session.middleware.ts`).
 * When it is absent — a JWT minted before a target was selected, or (the common
 * case) the in-memory bridge sessions were lost on a backend restart so the
 * still-valid cookie no longer resolves an executor — the factory fails closed
 * (NO panel-host fallback; the per-server isolation invariant is untouched).
 *
 * This surfaces that fail-close as an ACTIONABLE 428 (Precondition Required)
 * with `code: "BRIDGE_SESSION_REQUIRED"`, distinct from the transient
 * `NO_SERVER_EXECUTOR` (503, "retry"): retrying the same request will not help,
 * the user must re-select / reconnect the server. The frontend keys off this
 * code to prompt exactly that instead of showing an opaque 500. Only the error
 * SIGNALLING changes — we never resolve a local/panel-host executor.
 */
export class BridgeSessionRequiredError extends AppError {
  constructor(message = "Selecciona o reconecta un servidor para continuar.") {
    super(message, 428, ErrorCodes.BRIDGE_SESSION_REQUIRED);
  }
}

/**
 * A kv-store sidecar read failed for a reason OTHER than the file not existing
 * (an SSH/SFTP hiccup, a dropped session, a proxy transport error). It is thrown
 * so a read→mutate→write cycle ABORTS instead of misreading the transient
 * failure as "file absent" and rewriting the whole collection with only the
 * current doc (silent data loss — the exact bug that emptied the assistant
 * conversations index). HTTP 503: the target is momentarily unreachable, retry
 * is appropriate; the on-disk data is left intact.
 */
export class KvReadError extends AppError {
  constructor(filePath: string, cause?: unknown) {
    const reason = errReason(cause);
    super(
      `No se pudo leer el almacén per-servidor (${filePath}): ${reason}`,
      503,
      ErrorCodes.KV_READ_FAILED,
      { filePath },
    );
  }
}

/**
 * An atomic kv-store overwrite (temp + rename) failed after a retry on an
 * executor that supports rename. Thrown INSTEAD of falling back to a truncating
 * in-place write, so the mutation fails clean and the collection on disk is left
 * intact rather than exposing the O_TRUNC window that could empty it. HTTP 503:
 * transient target unavailability; the caller may retry.
 */
export class KvWriteError extends AppError {
  constructor(filePath: string, cause?: unknown) {
    const reason = errReason(cause);
    super(
      `No se pudo escribir el almacén per-servidor (${filePath}): ${reason}`,
      503,
      ErrorCodes.KV_WRITE_FAILED,
      { filePath },
    );
  }
}
