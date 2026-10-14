// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Auth service — session issuance (2FA gating, partial vs full session token,
 * cookie set / SSO handoff ticket). Part of the merged `authService` surface
 * (`buildLoginResponse` / `issueSession`). Pure code movement out of
 * auth.service.ts.
 *
 * NOTE: `issueSession` used to call `this.buildTokenPayload`; after the split it
 * calls `authTokenService.buildTokenPayload` — the SAME function reference the
 * merged `authService` exposes, so behaviour is identical.
 */

import type { Response } from "express";
import { totpRepository } from "../../repositories/index.js";
import { authConfig } from "../../../../config/auth.js";
import { tokenService, parseDuration, type TokenPayload } from "../token.service.js";
import { AuthError } from "../../../../shared/errors/index.js";
import { ErrorCodes } from "../../../../shared/errors/codes.js";
import { securitySettingsService } from "../../../admin/services/security-settings.service.js";
import { runWithExecutor, type Executor } from "../../../../shared/executor/index.js";
import { authTokenService } from "./auth-token.service.js";
import { hostingAccountRepository } from "../../../hosting/repositories/hosting-account.repository.js";
import { hostingTemplateService } from "../../../hosting/services/hosting-template.service.js";

/** Resource limits are independent of the panel user's group permissions. */
export type TenantSessionScope = Pick<TokenPayload,
  "tenantId" | "owner" | "tenantGroup" | "homeRoot" | "maxSubUsers" |
  "maxDomains" | "maxEmailAccounts" | "maxDatabases" | "diskQuotaMb" |
  "bandwidthQuotaMb" | "jailEnabled" | "hostingPolicy"
>;

export const authSessionService = {
  /**
   * Build login response: either partial token (MFA pending) or full session token.
   * Checks if user has 2FA enabled; if so, issues a partial token + returns mfaPending: true.
   * Otherwise, issues a full session token and sets the cookie.
   */
  async buildLoginResponse(
    user: {
      id: number;
      username: string;
      displayName?: string | null;
      roleId?: number | null;
      modules?: string | null;
      groups?: string[] | null;
      bridge?: { bridgeSessionId: string; targetId: string; targetName: string; sshUsername: string; executor?: Executor; local?: boolean };
    },
    remember: boolean,
    res: Response,
  ): Promise<{ mfaPending: boolean; expiresAt?: number }> {
    const result = await this.issueSession(user, remember, res);
    return { mfaPending: result.mfaPending, expiresAt: result.expiresAt };
  },

  /**
   * Núcleo de emisión de sesión, compartido por dos caminos:
   *   - Login normal (`buildLoginResponse`, con `res`): setea la cookie de sesión.
   *   - Handoff SSO desde el portal LP-LS (`sso-handoff.controller`, SIN `res`):
   *     devuelve el `token` firmado para acuñarlo como ticket de un solo uso; la
   *     cookie la setea después el endpoint de canje, same-origin del box.
   * Con 2FA activo devuelve `{ mfaPending: true }` (token parcial) y NO emite
   * sesión completa: el handoff no puede saltarse el 2FA → cae al login del box.
   */
  async issueSession(
    user: {
      id: number;
      username: string;
      displayName?: string | null;
      roleId?: number | null;
      modules?: string | null;
      groups?: string[] | null;
      tenant?: TenantSessionScope;
      bridge?: { bridgeSessionId: string; targetId: string; targetName: string; sshUsername: string; executor?: Executor; local?: boolean };
    },
    remember: boolean,
    res?: Response,
  ): Promise<{ mfaPending: boolean; token?: string; expiresAt?: number }> {
    // issueSession runs from the controller, OUTSIDE authService.login's
    // executor scope. Pin the same target executor so totp/settings kv() land
    // on the connected server (managed-only: no panel-host fallback).
    const exec = user.bridge?.executor ?? null;
    const run = async (): Promise<{ mfaPending: boolean; token?: string; expiresAt?: number }> => {
    const settings = await securitySettingsService.read(exec);
    const principal = await authTokenService.buildTokenPayload(user);
    let tenant = user.tenant;
    if (principal.kind !== "admin" && exec) {
      const { rows } = await hostingAccountRepository.findAll({ limit: Number.MAX_SAFE_INTEGER }, exec);
      const linked = rows.filter(account => account.username === user.username || user.groups?.includes(account.tenantGroup));
      if (linked.length > 1) throw new AuthError("Multiple hosting account memberships");
      if (linked[0]) {
        const account = await hostingTemplateService.project(exec, linked[0]);
        if (account.status !== "active" || (account.expiresAt && Date.parse(account.expiresAt) <= Date.now())) throw new AuthError("Hosting account is inactive");
        tenant = { tenantId: account.id, owner: account.username, tenantGroup: account.tenantGroup, homeRoot: account.homeRoot,
          maxSubUsers: account.maxSubUsers, maxDomains: account.maxDomains, maxEmailAccounts: account.maxEmailAccounts,
          maxDatabases: account.maxDatabases, diskQuotaMb: account.diskQuotaMb, bandwidthQuotaMb: account.bandwidthQuotaMb, jailEnabled: account.jailEnabled,
          hostingPolicy: { revision: account.templateRevision ?? 0, runtime: !!account.templateId, state: account.policyState ?? "ready", expiresAt: account.expiresAt, security: account.security } };
      }
    }
    const require2fa = settings.requireTwoFa || tenant?.hostingPolicy?.security?.requireMfa;

    // Check if user has 2FA enabled
    const totp = await totpRepository.getByUser(user.id);
    if (require2fa && !totp?.enabled) {
      // NOTE: emits "TWO_FA_REQUIRED" (login-gate code), which the login page
      // localizes via authErrors["TWO_FA_REQUIRED"]. Distinct from the
      // TOTP-path "TWOFA_REQUIRED" — do NOT unify. See ErrorCodes in codes.ts.
      throw new AuthError("Esta cuenta requiere 2FA — configúralo desde Ajustes › Seguridad antes de iniciar sesión.", ErrorCodes.TWO_FA_REQUIRED);
    }

    if (totp?.enabled || require2fa) {
      // Emit partial token (MFA pending, 5 min expiry). Carry the SSH bridge
      // metadata AND the `remember` flag in the partial token so totp.verifyLogin
      // can hand them back in the final session JWT — otherwise the bridge or
      // the remember-me preference would be lost across the 2FA round-trip.
      const partialPayload: TokenPayload = {
        userId: user.id,
        username: user.username,
        displayName: user.displayName || user.username,
        role: "mfa_pending",
        modules: [],
        kind: "mfa_pending",
        remember,
      };
      // The MFA verifier needs the signed tenant owner to read this user's
      // private TOTP record through the bounded service identity.
      if (principal.kind !== "admin" && tenant) Object.assign(partialPayload, tenant);
      if (user.bridge) {
        partialPayload.bridgeSessionId = user.bridge.bridgeSessionId;
        partialPayload.targetId = user.bridge.targetId;
        partialPayload.targetName = user.bridge.targetName;
        if (user.bridge.local) partialPayload.local = true;
        else partialPayload.direct = true;
      }
      const { token } = tokenService.signPartial(partialPayload);
      if (res) tokenService.setSessionCookie(res, token, false);
      return { mfaPending: true };
    }

    // Emit full session token. If the login flow established a direct SSH
    // bridge, attach those fields to the JWT so subsequent requests reach the
    // correct target server via DirectSshExecutor.
    const payload = principal;
    if (payload.kind !== "admin" && tenant) Object.assign(payload, tenant);
    if (user.bridge) {
      payload.bridgeSessionId = user.bridge.bridgeSessionId;
      payload.targetId = user.bridge.targetId;
      payload.targetName = user.bridge.targetName;
      if (user.bridge.local) payload.local = true;
      else payload.direct = true;
    }
    // Session duration: respect the "remember me" checkbox first; otherwise
    // use the panel-configured `session_duration_hours`. Remember-me defaults
    // to JWT_REMEMBER_EXPIRES_IN (30d) and never falls below the configured
    // session duration so users don't perceive a shorter session.
    const baseHours = Math.max(1, settings.sessionDurationHours);
    const baseMs = baseHours * 60 * 60 * 1000;
    const rememberMs = parseDuration(authConfig.jwt.rememberExpiresIn, 30 * 24 * 60 * 60 * 1000);
    const sessionMs = remember ? Math.max(rememberMs, baseMs) : baseMs;
    const expiresAt = Date.now() + sessionMs;
    const result = tokenService.signWithExpiry(payload, expiresAt);
    if (res) tokenService.setSessionCookie(res, result.token, remember, expiresAt);
    return { mfaPending: false, token: result.token, expiresAt: result.expiresAt };
    };
    return exec ? runWithExecutor(exec, run) : run();
  },
};
