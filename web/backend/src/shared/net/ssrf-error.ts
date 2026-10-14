// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * The ONE error type for "we refuse to dial that host/URL".
 *
 * `ssrf-guard.ts` (`SsrfBlockedError`) and `host-policy.ts` (`HostPolicyError`)
 * used to declare two identical classes wrapping the very same
 * `AppError(400, ErrorCodes.SSRF_BLOCKED)`. They now share this base:
 * `HostPolicyError` is a subclass kept only for its `name` (log/readability),
 * so `err instanceof SsrfBlockedError` is true for BOTH and the HTTP contract
 * (400 + `SSRF_BLOCKED`) is identical.
 *
 * Message policy: never echo the raw URL (query/userinfo may carry secrets);
 * the structured `context` is the place for a bare host.
 */

import { AppError } from "../errors/errors.js";
import { ErrorCodes } from "../errors/codes.js";

/**
 * Raised when a URL/host fails an SSRF check. 400 (client error): the caller
 * sent something we refuse to dial.
 */
export class SsrfBlockedError extends AppError {
  constructor(message = "URL is not allowed", context?: Record<string, unknown>) {
    super(message, 400, ErrorCodes.SSRF_BLOCKED, context);
    this.name = "SsrfBlockedError";
  }
}

/**
 * Same failure, raised by the SSH-target host policy. Subclass (not alias) so
 * logs keep saying `HostPolicyError` while `instanceof SsrfBlockedError` holds.
 */
export class HostPolicyError extends SsrfBlockedError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
    this.name = "HostPolicyError";
  }
}
