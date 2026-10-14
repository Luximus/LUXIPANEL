// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Auth service — login entrypoints: standalone local PAM login (`loginLocal`)
 * and hosting password login (`loginHosting`). Part of the merged `authService`
 * surface. Pure code movement out of auth.service.ts.
 *
 * NOTE: these methods used to call `this.logAudit` / `this.ensureAdminBootstrap`;
 * after the split they call `authAuditService.logAudit` /
 * `authBootstrapService.ensureAdminBootstrap` — the SAME function references the
 * merged `authService` exposes (neither uses `this` on the login object), so
 * behaviour, ordering and side-effects are identical.
 */

import { panelUserRepository, totpRepository } from "../../repositories/index.js";
import { hostingTemplateService } from "../../../hosting/services/hosting-template.service.js";
import { tokenService, parseDuration, type TokenPayload } from "../token.service.js";
import { authConfig } from "../../../../config/auth.js";
import { AuthError } from "../../../../shared/errors/index.js";
import { eventBus, Events } from "../../../../shared/events/index.js";
import { systemAccountsService } from "../../../users/services/system-accounts.service.js";
import { rolesService } from "../../../users/services/roles.service.js";
import { kv } from "../../../../shared/kv-store/index.js";
import { lpSshKeyService } from "../lp-ssh-key.service.js";
import { sshCredentialsCache } from "../ssh-credentials-cache.service.js";
import { securitySettingsService } from "../../../admin/services/security-settings.service.js";
import { randomUUID } from "node:crypto";
import { runWithExecutor, localExecutor, LOCAL_TARGET_ID, type Executor } from "../../../../shared/executor/index.js";
import { DirectSshExecutor } from "../../../../shared/executor/direct-ssh-executor.js";
import { validateLocalPassword } from "../local-auth.service.js";
import { storeSudoPassword } from "../../../../shared/system/sudo-credentials.js";
import bcrypt from "bcryptjs";
import { hostingAccountRepository } from "../../../hosting/repositories/hosting-account.repository.js";
import type { HostingAccount } from "../../../hosting/models/hosting-account.model.js";
import { log, extractSubdomainFromHost } from "./auth-shared.js";
import {
  bumpAndFormatFailedMessage,
  clearFailedCount,
  getFailedCount,
} from "./auth-lockout.service.js";
import { authAuditService } from "./auth-audit.service.js";
import { authBootstrapService } from "./auth-bootstrap.service.js";

/** Constant-time decoy hash (cost 12, matches hosting BCRYPT_ROUNDS) used when
 *  a hosting account is absent so `bcrypt.compare` always runs and the response
 *  time can't be used to enumerate which usernames exist. Precomputed once at
 *  module load — never hash on the hot path (a per-request hash would itself add
 *  ~100ms and reintroduce a measurable signal). */
const HOSTING_DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO3FfXIu7eO5/9zZl1eqMqB1m0gUFqJ4G";

export const authLoginService = {

  /**
   * Authenticate a user in STANDALONE-LOCAL mode against the server's real
   * Linux accounts (no LP-LICENSE-SERVER, no SSH bridge). The panel manages the
   * very server it runs on, so every per-server read/write resolves to the
   * (sudo-wrapped) `localExecutor`. Mirrors `login()` but: validates the
   * password through local PAM (`validateLocalPassword`), pins `localExecutor`
   * for the whole flow, and returns a `local:true` bridge.
   */
  async loginLocal(
    username: string,
    passphrase: string,
    remember: boolean,
    meta: { ip: string; userAgent: string; host?: string },
  ): Promise<{
    id: number;
    username: string;
    displayName?: string | null;
    roleId?: number | null;
    modules?: string | null;
    groups?: string[];
    bridge?: {
      bridgeSessionId: string;
      targetId: string;
      targetName: string;
      sshUsername: string;
      executor?: Executor;
      local?: boolean;
    };
  }> {
    const normalizedUsername = username.trim().toLowerCase();
    const lockScope = "local";
    const targetId = LOCAL_TARGET_ID;
    const targetName = "Local";

    // Pin the local executor for the WHOLE login flow so panel-user
    // provisioning, audit log and security-settings (all kv()/dataStore reads)
    // resolve to the panel host's own sidecars under LUXIPANEL_CONFIG_DIR.
    return await runWithExecutor(localExecutor, async () => {
      // 1) Lockout check BEFORE validation.
      const settings = await securitySettingsService.read(localExecutor);
      const failedCount = await getFailedCount(lockScope, normalizedUsername);
      if (settings.maxFailedLoginAttempts > 0 && failedCount >= settings.maxFailedLoginAttempts) {
        await authAuditService.logAudit("login_locked", null, "high", meta, {
          username,
          failedCount,
          threshold: settings.maxFailedLoginAttempts,
        });
        throw new AuthError(`Cuenta bloqueada por ${settings.maxFailedLoginAttempts} intentos fallidos. Espera 30 minutos o contacta al admin.`);
      }

      // 2) PAM validation against the local Linux account (source of truth).
      try {
        await validateLocalPassword(normalizedUsername, passphrase);
      } catch (err) {
        const originalMsg = err instanceof AuthError ? err.message : "auth_failed";
        const isPassphraseError = originalMsg === "Invalid passphrase";
        const baseMessage = isPassphraseError ? "Contraseña incorrecta" : originalMsg;
        const formatted = await bumpAndFormatFailedMessage(lockScope, normalizedUsername, baseMessage);
        await authAuditService.logAudit("login_failed", null, "medium", meta, {
          reason: originalMsg,
          username,
          failedCount: formatted.failedCount,
          threshold: formatted.threshold,
        });
        throw new AuthError(isPassphraseError ? formatted.message : originalMsg);
      }
      await clearFailedCount(lockScope, normalizedUsername);

      // 3) Store the validated password as the sudo credential so the
      //    sudo-wrapped local executor can run privileged module commands
      //    (matches the managed model where the passphrase = sudo password).
      //    Best-effort: when the panel runs as root, sudo needs no password.
      await storeSudoPassword(localExecutor, passphrase).catch((err) => {
        log.warn({ err: (err as Error).message, username: normalizedUsername }, "storeSudoPassword failed (best-effort)");
      });

      const bridgeSessionId = randomUUID();

      // Reflect the validated Linux user into panel_users (per-user roles/prefs).
      await systemAccountsService.syncUserToDatabase(normalizedUsername).catch((err) => {
        log.warn({ err, username: normalizedUsername }, "syncUserToDatabase failed (best-effort)");
      });

      // First user to ever log in becomes admin (owner bootstrap); everyone
      // after starts dashboard-only until added to Linux groups.
      const authMeta = kv(localExecutor)
        .module("auth")
        .collection<{ id: string; adminBootstrapped?: boolean; adminUsername?: string; at?: string }>("meta");
      let pendingAdminBootstrap = false;
      try {
        await rolesService.ensureBaseRoles(localExecutor);
        const marker = await authMeta.get("bootstrap");
        pendingAdminBootstrap = !marker?.adminBootstrapped;
      } catch (err) {
        log.warn({ err: (err as Error).message }, "Admin bootstrap resolution failed");
      }

      let user = await panelUserRepository.findByUsername(normalizedUsername);
      if (!user) {
        const newUserInput = {
          username: normalizedUsername,
          email: null,
          displayName: null,
          passwordHash: "",
          authProvider: "system" as const,
          managedBySystem: true,
          enabled: true,
          phoneE164: null,
          roleId: null,
          modules: null,
        };
        try {
          user = await panelUserRepository.create(newUserInput);
        } catch (err) {
          log.error({ err, username: normalizedUsername }, "panelUserRepository.create failed (provisioning)");
        }
        user = await panelUserRepository.findByUsername(normalizedUsername);
        if (!user) user = await panelUserRepository.create(newUserInput);
      }

      if (!user) {
        await authAuditService.logAudit("login_failed", null, "medium", meta, { reason: "user_not_provisioned", username });
        throw new AuthError("User could not be provisioned in the panel", "USER_PROVISION_FAILED");
      }
      if (!user.enabled) {
        await authAuditService.logAudit("login_failed", user.id, "medium", meta, { reason: "user_disabled" });
        throw new AuthError("Account is disabled", "ACCOUNT_DISABLED");
      }

      if (pendingAdminBootstrap) {
        try {
          await authBootstrapService.ensureAdminBootstrap({ executor: localExecutor, username: normalizedUsername, allowElevate: true });
          user = (await panelUserRepository.findByUsername(normalizedUsername)) ?? user;
        } catch (err) {
          log.warn({ err: (err as Error).message }, "Admin bootstrap finalize failed; will retry next login");
        }
      }

      await authAuditService.logAudit("login_success", user.id, "info", meta, { remember, mode: "standalone-local" });
      eventBus.emit(Events.AUTH_LOGIN_SUCCESS, { userId: user.id, username: user.username });
      log.info({ userId: user.id, username: user.username }, "User logged in (standalone-local)");

      return {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        roleId: user.roleId,
        modules: user.modules,
        groups: user.groups ?? [],
        bridge: {
          bridgeSessionId,
          targetId,
          targetName,
          sshUsername: normalizedUsername,
          executor: localExecutor,
          local: true,
        },
      };
    });
  },

  /**
   * Authenticate a HOSTING account by PASSWORD (no SSH passphrase). The VPS is
   * derived from the request host's subdomain; LP provides a per-VPS SERVICE
   * SSH key (sudo-capable). We connect with the service key, read the account
   * sidecar on the VPS, validate bcrypt, then mint a `kind:"hosting"` session
   * whose bridge material carries `owner`/`homeRoot` so the executor factory
   * wraps it in a PrivilegeDropExecutor (`sudo -u <owner>`).
   *
   * The bcrypt hash NEVER leaves the VPS: it is read through the service-key
   * executor and compared in-process; only the resulting JWT is returned.
   */
  async loginHosting(
    username: string,
    password: string,
    remember: boolean,
    meta: { ip: string; userAgent: string; host?: string },
  ): Promise<{ token: string; expiresAt: number; mfaPending?: boolean; account: Omit<HostingAccount, "passwordHash"> }> {
    const normalizedUsername = username.trim().toLowerCase();

    // a) Resolve the VPS from the login host's subdomain.
    const subdomain = extractSubdomainFromHost(meta.host);
    if (!subdomain) {
      await authAuditService.logAudit("login_failed", null, "medium", meta, { reason: "no_subdomain", username, hosting: true });
      throw new AuthError("No se pudo determinar el panel de acceso", "PANEL_UNRESOLVED");
    }

    // b) Ask LP for the per-VPS service key. Not provisioned ⇒ clear error.
    const svc = await lpSshKeyService.lookupServiceKey(subdomain);
    if (svc.state !== "ok") {
      await authAuditService.logAudit("login_failed", null, "medium", meta, {
        reason: "service_key_not_configured",
        username,
        accessSubdomain: subdomain,
        hosting: true,
      });
      throw new AuthError("El hosting no está provisionado en este servidor. Contacta al proveedor.", "HOSTING_NOT_PROVISIONED");
    }

    // c) Service-key connection material. `owner` is set AFTER bcrypt validation
    //    (so the cached, privilege-dropped session targets the right account).
    const targetId = `panel:${subdomain}`;
    const targetName = subdomain;
    const serviceMaterial = {
      host: svc.serverIp,
      port: svc.sshPort,
      username: svc.serviceUsername,
      privateKeyPem: svc.privateKeyPem,
      passphrase: svc.passphrase,
      fingerprint: svc.fingerprint,
      accessSubdomain: subdomain,
    };

    // d) Connect with the service key (NO privilege drop yet — we must read the
    //    root-owned account sidecar as the sudo-capable service user) and
    //    validate the account + bcrypt within that executor scope.
    const serviceExec = new DirectSshExecutor(targetId, targetName, serviceMaterial);
    const { account, panelUser, mfaPending } = await runWithExecutor(serviceExec, async () => {
      // Same per-account lockout/throttle as login()/loginLocal(): enforced
      // BEFORE bcrypt.compare so a locked account never even runs the hash.
      // Scope = login subdomain (mirrors the SSH login path). The counter is
      // keyed by username only, so an existing/absent account is
      // indistinguishable by lockout behaviour (no enumeration).
      const lockScope = subdomain;
      const settings = await securitySettingsService.read(serviceExec);
      const failedCount = await getFailedCount(lockScope, normalizedUsername);
      if (settings.maxFailedLoginAttempts > 0 && failedCount >= settings.maxFailedLoginAttempts) {
        await authAuditService.logAudit("login_locked", null, "high", meta, {
          username,
          accessSubdomain: subdomain,
          failedCount,
          threshold: settings.maxFailedLoginAttempts,
          hosting: true,
        });
        throw new AuthError(`Cuenta bloqueada por ${settings.maxFailedLoginAttempts} intentos fallidos. Espera 30 minutos o contacta al admin.`);
      }

      const acc = await hostingAccountRepository.findByUsername(normalizedUsername, serviceExec);
      const fail = async (): Promise<never> => {
        // Bump the shared failed-login counter (same UX/threshold as every other
        // auth path). Keep the generic message so a missing account is not
        // distinguishable from a wrong password.
        const formatted = await bumpAndFormatFailedMessage(lockScope, normalizedUsername, "Credenciales inválidas");
        await authAuditService.logAudit("login_failed", null, "medium", meta, {
          reason: "invalid_credentials",
          username,
          accessSubdomain: subdomain,
          hosting: true,
          failedCount: formatted.failedCount,
          threshold: formatted.threshold,
        });
        throw new AuthError(formatted.message);
      };
      // Constant-time password check: ALWAYS run bcrypt.compare — against the
      // real hash if the account exists, else against a decoy of equal cost —
      // so a missing/terminated account is indistinguishable by response time
      // from a wrong password (no username enumeration via timing).
      const ok = await bcrypt.compare(password, acc?.passwordHash ?? HOSTING_DUMMY_HASH);
      if (!acc || !ok) return fail();
      // Password is correct — reset the failed-attempts counter BEFORE any
      // account-state gating (parity with login(): auth success clears the
      // lockout even if a later panel-state check rejects the session).
      await clearFailedCount(lockScope, normalizedUsername);
      // Password is correct — only now reveal actionable account-state errors.
      // (These messages only reach a caller who already proved the password,
      // so they don't leak account existence to an unauthenticated attacker.)
      if (acc.status === "suspended") {
        throw new AuthError("Esta cuenta está suspendida. Contacta a tu proveedor de hosting.", "ACCOUNT_SUSPENDED");
      }
      if (acc.status === "terminated") return fail();
      if (acc.expiresAt && new Date(acc.expiresAt) < new Date()) {
        throw new AuthError("Esta cuenta ha expirado. Contacta a tu proveedor de hosting.", "ACCOUNT_EXPIRED");
      }
      const panelUser = await panelUserRepository.findByUsername(acc.username) ?? await systemAccountsService.syncUserToDatabase(acc.username);
      if (!panelUser?.enabled) throw new AuthError("Account disabled or no longer exists");
      const account = await hostingTemplateService.project(serviceExec, acc);
      const totp = await totpRepository.getByUser(panelUser.id);
      if ((settings.requireTwoFa || account.security?.requireMfa) && !totp?.enabled) throw new AuthError("This hosting plan requires MFA authentication", "TWO_FA_REQUIRED");
      return { account, panelUser, mfaPending: !!totp?.enabled };
    });

    // e) Cache the SERVICE material WITH owner/homeRoot for the JWT lifetime so
    //    the factory wraps the executor in a PrivilegeDropExecutor (`sudo -u
    //    <owner>`). TTL mirrors login()'s remember/non-remember windows.
    const bridgeSessionId = randomUUID();
    const ttlSeconds = Math.floor(
      parseDuration(remember ? authConfig.jwt.rememberExpiresIn : authConfig.jwt.expiresIn) / 1000,
    );
    await sshCredentialsCache.put(
      bridgeSessionId,
      {
        ...serviceMaterial,
        owner: account.username,
        homeRoot: account.homeRoot,
        jailEnabled: account.jailEnabled === true,
        tenantGroup: account.tenantGroup,
        // Per-tab isolation metadata (mirrors the bridge/JWT). customerKey is
        // the login-link subdomain (no stable LP customer id at this layer).
        userId: panelUser.id,
        customerKey: subdomain ?? null,
        targetId,
        targetName,
      },
      ttlSeconds,
    );

    // f) Mint the hosting session token with the (already clamped) envelope.
    const payload: TokenPayload = {
      userId: panelUser.id,
      username: account.username,
      displayName: account.displayName ?? account.username,
      role: "user",
      modules: account.allowedModules,
      kind: "user",
      tenantId: account.id,
      // Fase 3 — envelope del tenant en el JWT (el owner dropped no puede leer
      // el sidecar root). El módulo Usuarios acota TODA lectura/mutación a esto.
      owner: account.username,
      tenantGroup: account.tenantGroup,
      homeRoot: account.homeRoot,
      maxSubUsers: account.maxSubUsers,
      // Fase 6 — cupos de recursos del tenant (el módulo nginx/mail/databases
      // los hace cumplir vía getTenantEnvelope; bandwidthQuotaMb durmiente).
      maxDomains: account.maxDomains,
      maxEmailAccounts: account.maxEmailAccounts,
      maxDatabases: account.maxDatabases,
      diskQuotaMb: account.diskQuotaMb,
      bandwidthQuotaMb: account.bandwidthQuotaMb,
      // Fase 5 — jaula prevista: el Terminal enjaula (fail-closed) la PTY de esta
      // sesión hosting. La PrivilegeDropExecutor ya enjaula el spawn cuando
      // jailEnabled && env.JAIL_SHELL_ENABLED (material de servicio en caché).
      jailEnabled: account.jailEnabled === true,
      permissions: account.permissionTemplate,
      bridgeSessionId,
      targetId,
      targetName,
      direct: true,
    };
    const signed = mfaPending
      ? tokenService.signPartial({ ...payload, kind: "mfa_pending", role: "mfa_pending", modules: [], permissions: undefined, remember })
      : tokenService.sign(payload, remember);
    const { token } = signed;
    const expiresAt = "expiresAt" in signed ? signed.expiresAt as number : Date.now() + 300_000;

    await authAuditService.logAudit("login_success", account.id, "info", meta, { remember, hosting: true });
    eventBus.emit(Events.AUTH_LOGIN_SUCCESS, { userId: account.id, username: account.username });
    log.info({ id: account.id, username: account.username, target: targetName }, "Hosting account logged in (password)");

    const { passwordHash: _omit, ...safeAccount } = account;
    return { token, expiresAt, mfaPending, account: safeAccount };
  },
};
