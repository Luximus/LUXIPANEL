// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Typed failures of the Tolqia PLAN gate.
 *
 * When this server is linked to a tolqia.com account with an API token, Tolqia
 * answers the room endpoints with a billing status instead of a generic error:
 *
 *   401 → the token was revoked / rotated  → `TOLQIA_TOKEN_INVALID` (401)
 *   402 → the subscription is `past_due`   → `TOLQIA_PLAN_INACTIVE`  (402)
 *   403 → the account has no Plus/Premium  → `TOLQIA_PLAN_REQUIRED`  (403)
 *
 * These are DELIBERATELY not folded into `ServiceUnavailableError`: they are
 * actionable by a human (pay, upgrade, paste a new token) and the frontend
 * keys its message off `code`, so a 503 "retry later" would be a lie.
 */

import { AppError, ErrorCodes } from "../../../shared/errors/index.js";

/** 401 — the stored token is no longer accepted by Tolqia. */
export class TolqiaTokenInvalidError extends AppError {
  constructor(message = "El token de Tolqia ya no es válido. Vuelve a generarlo en tolqia.com.") {
    super(message, 401, ErrorCodes.TOLQIA_TOKEN_INVALID);
  }
}

/** 402 — the Tolqia subscription exists but is not paid up. */
export class TolqiaPlanInactiveError extends AppError {
  constructor(message = "Tu plan de Tolqia está inactivo. Revisa la suscripción en tolqia.com.") {
    super(message, 402, ErrorCodes.TOLQIA_PLAN_INACTIVE);
  }
}

/** 403 — the account has no plan that allows this operation. */
export class TolqiaPlanRequiredError extends AppError {
  constructor(message = "Esta función requiere un plan Plus o Premium de Tolqia.") {
    super(message, 403, ErrorCodes.TOLQIA_PLAN_REQUIRED);
  }
}

/**
 * Map an upstream HTTP status to the right plan error, or null when the status
 * is not one of the billing statuses (the caller keeps its own handling).
 */
export function planErrorFor(status: number): AppError | null {
  if (status === 401) return new TolqiaTokenInvalidError();
  if (status === 402) return new TolqiaPlanInactiveError();
  if (status === 403) return new TolqiaPlanRequiredError();
  return null;
}
