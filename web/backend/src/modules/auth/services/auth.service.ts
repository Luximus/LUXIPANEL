// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Auth service — FACADE (core login/session logic).
 *
 * The implementation is split by responsibility under `services/auth/` — this
 * file only re-assembles the SAME public surface, without any behaviour change:
 *   - `auth-shared.ts`          — private helpers/constants (subdomain, groups…).
 *   - `auth-roles-cache.ts`     — per-target role memoization + `invalidateRolesCache`.
 *   - `auth-lockout.service.ts` — failed-login counter, MFA-attempt recorder,
 *                                 lock-scope + local-bridge helpers.
 *   - `auth-audit.service.ts`   — `logAudit`.
 *   - `auth-token.service.ts`   — `computeModules` / `buildTokenPayload`.
 *   - `auth-bootstrap.service.ts` — admin bootstrap + bridged Linux identity.
 *   - `auth-session.service.ts` — `buildLoginResponse` / `issueSession`.
 *   - `auth-login.service.ts`   — `login` / `loginLocal` / `loginHosting`.
 *
 * `authService` is the union (spread) of the sub-service objects; because all
 * cross-method calls reference the SAME function objects (either via `this`
 * within a group or via the defining sub-service), the merged object behaves
 * exactly like the previous single object. Standalone functions are re-exported
 * unchanged.
 */

// Standalone helpers (public surface) — re-exported unchanged.
export {
  getFailedCount,
  bumpFailedCount,
  clearFailedCount,
  bumpAndFormatFailedMessage,
  recordFailedMfaAttempt,
  resolveLockScope,
  establishLocalBridge,
} from "./auth/auth-lockout.service.js";
export { invalidateRolesCache } from "./auth/auth-roles-cache.js";

import { authLoginService } from "./auth/auth-login.service.js";
import { authBootstrapService } from "./auth/auth-bootstrap.service.js";
import { authTokenService } from "./auth/auth-token.service.js";
import { authSessionService } from "./auth/auth-session.service.js";
import { authAuditService } from "./auth/auth-audit.service.js";

export const authService = {
  ...authLoginService,
  ...authBootstrapService,
  ...authTokenService,
  ...authSessionService,
  ...authAuditService,
};
