// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Security settings (per-server) — stored as a JSON sidecar on the CONNECTED
 * server (`${LUXIPANEL_CONFIG_DIR}/security-settings.json`) so each managed
 * target carries its own rules (2FA requirement, session duration, login
 * methods, lockout threshold).
 *
 * Managed-only: there is NO shared panel-host copy. The executor is resolved
 * explicitly (login flow, before any session) or from the request-scoped
 * context (authenticated requests). If none is available the read returns the
 * built-in DEFAULTS and a write fails closed — we never read or write a
 * panel-host store that would be shared across every server.
 */

import { getContextExecutor, type Executor } from "../../../shared/executor/index.js";
import { ValidationError } from "../../../shared/errors/index.js";
import { remoteConfig } from "../../../shared/remote-config/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { createTargetTtlCache } from "./target-ttl-cache.js";

const MODULE = "security-settings";
const log = createModuleLogger("security-settings");

export interface SecuritySettings {
  requireTwoFa: boolean;
  auditLogEnabled: boolean;
  sessionDurationHours: number;
  maxFailedLoginAttempts: number;
  loginAllowPassword: boolean;
  loginAllowPasskey: boolean;
  loginAllowRecovery: boolean;
  hcaptchaEnabled: boolean;
  hcaptchaSitekey: string;
  hcaptchaSecret: string;
}

const DEFAULTS: SecuritySettings = {
  requireTwoFa: false,
  auditLogEnabled: true,
  sessionDurationHours: 1,
  maxFailedLoginAttempts: 5,
  loginAllowPassword: true,
  loginAllowPasskey: false,
  loginAllowRecovery: false,
  hcaptchaEnabled: false,
  hcaptchaSitekey: "",
  hcaptchaSecret: "",
};

function normalize(raw: Partial<SecuritySettings> | null | undefined): SecuritySettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULTS };
  return {
    requireTwoFa: typeof raw.requireTwoFa === "boolean" ? raw.requireTwoFa : DEFAULTS.requireTwoFa,
    auditLogEnabled: typeof raw.auditLogEnabled === "boolean" ? raw.auditLogEnabled : DEFAULTS.auditLogEnabled,
    sessionDurationHours:
      typeof raw.sessionDurationHours === "number" && Number.isFinite(raw.sessionDurationHours)
        ? raw.sessionDurationHours
        : DEFAULTS.sessionDurationHours,
    maxFailedLoginAttempts:
      typeof raw.maxFailedLoginAttempts === "number" && Number.isFinite(raw.maxFailedLoginAttempts)
        ? raw.maxFailedLoginAttempts
        : DEFAULTS.maxFailedLoginAttempts,
    loginAllowPassword: typeof raw.loginAllowPassword === "boolean" ? raw.loginAllowPassword : DEFAULTS.loginAllowPassword,
    loginAllowPasskey: typeof raw.loginAllowPasskey === "boolean" ? raw.loginAllowPasskey : DEFAULTS.loginAllowPasskey,
    loginAllowRecovery: typeof raw.loginAllowRecovery === "boolean" ? raw.loginAllowRecovery : DEFAULTS.loginAllowRecovery,
    hcaptchaEnabled: typeof raw.hcaptchaEnabled === "boolean" ? raw.hcaptchaEnabled : DEFAULTS.hcaptchaEnabled,
    hcaptchaSitekey: typeof raw.hcaptchaSitekey === "string" ? raw.hcaptchaSitekey : DEFAULTS.hcaptchaSitekey,
    hcaptchaSecret: typeof raw.hcaptchaSecret === "string" ? raw.hcaptchaSecret : DEFAULTS.hcaptchaSecret,
  };
}

// TTL cache: en cada visita a Ajustes pegamos a este sidecar 2-3 veces
// (loadAuthMethodStatus + loadPasskeysSettings + loadRecoveryStatus...).
// Sin esto cada uno paga un SFTP independiente. Invalidamos en write().
const SEC_TTL_MS = 15_000;
const secCache = createTargetTtlCache<SecuritySettings>(SEC_TTL_MS);

function cacheKey(executor?: Executor | null): string {
  return executor?.target?.id ?? "__no_executor__";
}

export const securitySettingsService = {
  /**
   * Read security settings for the connected server. `executor` is optional:
   * when omitted, the request-scoped executor is used (see remoteConfig). If
   * no executor can be resolved (e.g. unauthenticated boot with no target)
   * the safe DEFAULTS are returned instead of throwing.
   */
  async read(executor?: Executor | null): Promise<SecuritySettings> {
    executor = executor ?? getContextExecutor();
    const key = cacheKey(executor);
    const cached = secCache.get(key);
    if (cached !== undefined) return cached;
    try {
      const data = normalize(await remoteConfig.read<Partial<SecuritySettings>>(executor, MODULE, DEFAULTS));
      secCache.set(key, data);
      return data;
    } catch {
      // No executor in scope (no connected server) — fail safe to DEFAULTS so
      // public/boot paths keep working without touching any shared store.
      return { ...DEFAULTS };
    }
  },

  /**
   * Merge-write security settings to the connected server's sidecar. Requires
   * a resolvable executor (explicit or request-scoped); fails closed if none.
   */
  async write(executor: Executor | null | undefined, partial: Partial<SecuritySettings>): Promise<SecuritySettings> {
    executor = executor ?? getContextExecutor();
    const current = await this.read(executor);
    const next: SecuritySettings = normalize({ ...current, ...partial });
    if (!next.loginAllowPassword && !next.loginAllowPasskey && !next.loginAllowRecovery) {
      throw new ValidationError("Debe quedar al menos un método de inicio de sesión activo.");
    }
    try {
      await remoteConfig.write(executor, MODULE, next);
    } catch (err) {
      // Fail CLOSED: in managed there is NO local panel-host store, so a failed
      // remote write means the policy change (2FA/lockout/session/methods) was
      // NOT persisted. Swallowing it reported success while the UI kept showing
      // the new value and read() kept serving the stale one — a silent security
      // downgrade. Re-throw so the caller surfaces the failure; the cache is
      // left intact (it still holds the OLD value, which is what's persisted).
      log.warn({ err: (err as Error).message }, "remote security-settings write failed — not persisted");
      throw err;
    }
    // Invalidate cache ONLY after a confirmed write so the next read reflects
    // the change (and never caches a value we failed to persist).
    secCache.invalidate(cacheKey(executor));
    return next;
  },
};
