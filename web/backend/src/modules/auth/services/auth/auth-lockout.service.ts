// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Auth service — shared failed-login lockout counter + MFA-attempt recorder,
 * lock-scope resolution and the non-password local bridge helper. All standalone
 * functions here are re-exported by the facade (public surface). Pure code
 * movement out of auth.service.ts.
 */

import { randomUUID } from "node:crypto";
import { AuthError } from "../../../../shared/errors/index.js";
import { getRedis } from "../../../../shared/redis/index.js";
import { localExecutor, LOCAL_TARGET_ID, type Executor } from "../../../../shared/executor/index.js";
import { securitySettingsService } from "../../../admin/services/security-settings.service.js";
import { extractSubdomainFromHost } from "./auth-shared.js";
import { authAuditService } from "./auth-audit.service.js";

/** Per (panel, username) failed-login counter in Redis. Locks the account
 *  when it hits `maxFailedLoginAttempts` and resets on success. The same
 *  counter is shared across login methods (SSH passphrase, passkey, 2FA,
 *  recovery code) so 5 failed attempts across any path = lockout. */
const FAILED_PREFIX = "lp:login-fail:";
function failedKey(scope: string, username: string): string {
  return `${FAILED_PREFIX}${scope}:${username.toLowerCase()}`;
}
export async function getFailedCount(scope: string, username: string): Promise<number> {
  const redis = getRedis();
  const v = await redis.get(failedKey(scope, username));
  return Number.parseInt(v ?? "0", 10) || 0;
}
export async function bumpFailedCount(scope: string, username: string): Promise<number> {
  const redis = getRedis();
  const k = failedKey(scope, username);
  const next = await redis.incr(k);
  // 30-minute lockout window
  if (next === 1) await redis.expire(k, 30 * 60);
  return next;
}
export async function clearFailedCount(scope: string, username: string): Promise<void> {
  const redis = getRedis();
  await redis.del(failedKey(scope, username));
}

/** Bump the shared failed-login counter and return a Spanish message that
 *  appends the remaining attempts before lockout. Used by every auth method
 *  (SSH, passkey, 2FA, recovery) so the user sees the same UX after any
 *  failed attempt. */
export async function bumpAndFormatFailedMessage(
  scope: string,
  username: string,
  baseMessage: string,
): Promise<{ message: string; failedCount: number; threshold: number; locked: boolean }> {
  const settings = await securitySettingsService.read();
  const next = await bumpFailedCount(scope, username);
  const threshold = settings.maxFailedLoginAttempts;
  if (threshold <= 0) {
    return { message: baseMessage, failedCount: next, threshold, locked: false };
  }
  const remaining = Math.max(0, threshold - next);
  if (remaining <= 0) {
    return {
      message: `${baseMessage} — Cuenta bloqueada por ${threshold} intentos fallidos. Espera 30 minutos o contacta al admin.`,
      failedCount: next,
      threshold,
      locked: true,
    };
  }
  const word = remaining === 1 ? "intento restante" : "intentos restantes";
  return {
    message: `${baseMessage} / ${remaining} ${word} antes de bloquear`,
    failedCount: next,
    threshold,
    locked: false,
  };
}

/**
 * Record a failed MFA-style login attempt (passkey / 2FA / recovery code):
 * bump+format the shared lockout message, write a `login_failed` audit row
 * with the standard context, and throw the resulting `AuthError`. Centralises
 * the block that was copied verbatim across the MFA controllers.
 */
export async function recordFailedMfaAttempt(opts: {
  lockScope: string;
  username: string;
  userId: number;
  reason: string;
  baseMessage: string;
  meta: { ip: string; userAgent: string };
}): Promise<never> {
  const formatted = await bumpAndFormatFailedMessage(opts.lockScope, opts.username, opts.baseMessage);
  await authAuditService.logAudit("login_failed", opts.userId, "medium", opts.meta, {
    reason: opts.reason,
    username: opts.username,
    failedCount: formatted.failedCount,
    threshold: formatted.threshold,
  });
  throw new AuthError(formatted.message);
}

/** Resolve the lockout scope (subdomain or "local") from the request host. */
export function resolveLockScope(host: string | undefined): string {
  return extractSubdomainFromHost(host) ?? "local";
}

/**
 * Establish a LOCAL bridge for a user already authenticated by a non-password
 * method (passkey, recovery code). Self-hosted single-node: the panel manages
 * the server it runs on, so the session binds to the panel-host `localExecutor`
 * (no SSH, no credential cache). Returns the `local:true` bridge that
 * `buildLoginResponse` attaches to the session token.
 */
export function establishLocalBridge(
  username: string,
): { bridgeSessionId: string; targetId: string; targetName: string; sshUsername: string; executor: Executor; local: true } {
  return {
    bridgeSessionId: randomUUID(),
    targetId: LOCAL_TARGET_ID,
    targetName: "Local",
    sshUsername: username,
    executor: localExecutor,
    local: true,
  };
}
