// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Session controller — handles GET /api/session, POST /api/logout.
 */

import type { Request, Response } from "express";
import { tokenService, type TokenPayload } from "../services/token.service.js";
import { authConfig } from "../../../config/auth.js";
import { extractToken } from "../middlewares/session.middleware.js";
import { authService } from "../services/auth.service.js";
import { panelUserRepository } from "../repositories/index.js";
import { asyncHandler } from "../../../shared/types/index.js";
import { errMessage } from "../../../shared/utils/err-message.js";
import { requestMeta } from "../../../shared/http/request-meta.js";
import { pickDefined } from "../../../shared/utils/pick-defined.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import { AuthError } from "../../../shared/errors/index.js";
import { systemAccountsService } from "../../users/services/system-accounts.service.js";
import { disposeDirectExecutor, getDirectExecutorByBridgeSessionId } from "../../../shared/executor/factory.js";
import { localExecutor } from "../../../shared/executor/local-executor.js";
import { getContextExecutor, runWithExecutor } from "../../../shared/executor/context.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { PrivilegeDropExecutor } from "../../../shared/executor/privilege-drop-executor.js";
import { isHostingSession, getTenantEnvelope } from "../../../shared/tenant/tenant-scope.js";

const log = createModuleLogger("auth:session");

/** Return a copy of `obj` with all `undefined`-valued keys dropped (keeps
 *  `null`). Replaces the repeated `...(x !== undefined ? { x } : {})` idiom. */

export const sessionController = {
  /** GET /api/session — returns current session user data. */
  getSession: asyncHandler(async (_req: Request, res: Response) => {
    const user = res.locals.user;
    const bridged = res.locals.bridgedSession as { direct?: boolean; remoteUserId?: number } | undefined;
    // Best-effort: sync Linux system users from the connected server into the
    // local panel DB. This is SSH/SFTP to the remote server and the frontend
    // SSR middleware calls /api/session on EVERY /panel/* navigation, so doing
    // it inline serialized a multi-second stall per navigation. Detach it off
    // the response path, re-entering the request's pinned executor so the
    // fail-closed per-server isolation invariant still holds (a floating task
    // would otherwise lose the AsyncLocalStorage executor and no-op). The
    // session payload comes from requireAuth, not from this sync.
    const ctxExecutor = getContextExecutor();
    if (ctxExecutor && !isHostingSession(user)) {
      const { username } = user;
      setImmediate(() => {
        void runWithExecutor(ctxExecutor, async () => {
          try {
            await systemAccountsService.ensureRecentFullSync();
            await systemAccountsService.ensureRecentUserSync(username);
          } catch (err) {
            log.warn({ err, username }, "Background session user sync failed (non-fatal)");
          }
        });
      });
    }
    res.json({
      ok: true,
      user: {
        userId: user.userId,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        modules: user.modules,
        kind: user.kind,
        ...pickDefined({
          hostingPolicy: user.hostingPolicy,
          permissions: user.permissions,
          tenantId: user.tenantId,
          owner: user.owner,
          tenantGroup: user.tenantGroup,
          homeRoot: user.homeRoot,
          maxSubUsers: user.maxSubUsers,
          maxDomains: user.maxDomains,
          maxEmailAccounts: user.maxEmailAccounts,
          maxDatabases: user.maxDatabases,
          diskQuotaMb: user.diskQuotaMb,
          bandwidthQuotaMb: user.bandwidthQuotaMb,
          jailEnabled: user.jailEnabled,
          bridgeSessionId: user.bridgeSessionId,
          targetId: user.targetId,
          targetName: user.targetName,
          targetHost: user.targetHost,
          // LP customer id (owner of the bridged session). The panel `userId` is
          // the per-server Linux user under SSO_IDENTITY=linux, so the server
          // switcher needs this to list the customer's OTHER servers.
          remoteUserId: bridged?.remoteUserId,
        }),
        ...(bridged?.direct ? { direct: true } : {}),
      },
    });
  }),

  /** GET /api/auth/ws-token — short-lived token for cross-origin bridge WebSockets.
   *  TTL = 15 min: el token solo se usa en el handshake (no durante la vida del WS),
   *  pero en MÓVIL el SO suspende el WebView al cambiar de app y, al volver, la
   *  reconexión necesita un token aún válido para re-adjuntar (tmux) sin pedir uno
   *  nuevo. Con 2 min, cualquier background >2 min mataba el token → el WS reconectaba
   *  con "Invalid or expired session"/"Authentication required" antes de lograrlo. */
  getWebsocketToken: asyncHandler(async (_req: Request, res: Response) => {
    const user = res.locals.user;
    const bridgedSession = res.locals.bridgedSession as
      | {
          remoteSessionId?: string;
          targetId?: string;
          targetName?: string;
          direct?: boolean;
          local?: boolean;
        }
      | undefined;

    const expiresAt = Date.now() + 15 * 60 * 1000;
    // Prefer the bridged session's values, falling back to the token's. None of
    // these fields are ever `null` (only string/number | undefined), so `??`
    // matches the original `!== undefined` chain exactly.
    const targetId = bridgedSession?.targetId ?? user.targetId;
    const targetName = bridgedSession?.targetName ?? user.targetName;
    const payload: TokenPayload = {
      userId: user.userId,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      modules: user.modules,
      kind: user.kind,
      ...pickDefined({
        permissions: user.permissions,
        tenantId: user.tenantId,
        owner: user.owner,
        tenantGroup: user.tenantGroup,
        homeRoot: user.homeRoot,
        maxSubUsers: user.maxSubUsers,
        maxDomains: user.maxDomains,
        maxEmailAccounts: user.maxEmailAccounts,
        maxDatabases: user.maxDatabases,
        diskQuotaMb: user.diskQuotaMb,
        bandwidthQuotaMb: user.bandwidthQuotaMb,
        jailEnabled: user.jailEnabled,
        bridgeSessionId: user.bridgeSessionId,
        remoteSessionId: bridgedSession?.remoteSessionId,
        targetId,
        targetName,
        // Propagate the session KIND the middleware resolved. Without these the
        // WS token carried a bridgeSessionId but neither flag, and the terminal
        // WS controller's default is the OPPOSITE of the HTTP middleware's:
        // hydrateBridgedSession treats "no explicit direct" as local, while the
        // terminal treats "no explicit local" as direct → it tried to resolve
        // cached SSH creds for a LOCAL session and closed with "Sesión del
        // servidor expirada" on every connect.
        direct: bridgedSession?.direct,
        local: bridgedSession?.local,
      }),
    };

    const { token } = tokenService.signWithExpiry(payload, expiresAt);
    res.json({ ok: true, data: { token, expiresAt } });
  }),

  /**
   * GET /api/auth/bootstrap-status — READ-ONLY report of the per-target
   * first-admin bootstrap state for the Settings → General badge. It does NOT
   * create roles or assign anyone: the bootstrap happens exclusively on the
   * first SSH login from LP-LICENSE-SERVER (`authService.login`). This page
   * only displays whether it already happened.
   */
  bootstrapStatus: asyncHandler(async (_req: Request, res: Response) => {
    const executor = getContextExecutor();
    let status: { adminBootstrapped: boolean; adminUsername: string | null; at: string | null } = {
      adminBootstrapped: false,
      adminUsername: null,
      at: null,
    };
    try {
      status = await authService.getAdminBootstrapStatus(executor);
    } catch (err) {
      log.warn({ err: (err as Error).message }, "bootstrap-status read failed");
    }
    res.json({ ok: true, data: status });
  }),

  /** POST /api/auth/refresh — re-issues JWT from current DB state without logout. */
  refresh: asyncHandler(async (req: Request, res: Response) => {
    const current = res.locals.user;
    // Per-tab isolation: res.locals.user (and res.locals.bridgedSession) may
    // reflect a PER-TAB override target — when this request carried an
    // X-Bridge-Session-Id header, reflectTargetOnUser rewrote
    // bridgeSessionId/targetId/targetName/targetHost (and `bridged` IS the
    // override). Refresh must re-sign the BASE cookie unchanged, so read the
    // bridge/session-continuity fields from the cookie's OWN un-reflected token
    // payload — not from `current`/`bridged`. Otherwise a keepalive fired from a
    // tab that switched servers would silently migrate the base cookie to that
    // server for every other tab.
    const token = extractToken(req);
    const base = token ? await tokenService.verify(token) : null;
    if (!base) throw new AuthError("Invalid or expired session");
    // A tenant runs module operations as its Linux owner. Only the auth layer
    // may read the protected user/group records through the service executor.
    let identityExecutor = getContextExecutor();
    if (current.bridgeSessionId && current.bridgeSessionId !== base.bridgeSessionId) {
      // A per-tab server override must never feed its users/groups into the
      // base cookie, whose identity and target belong to another server.
      identityExecutor = base.direct
        ? await getDirectExecutorByBridgeSessionId(base.bridgeSessionId ?? "", base.targetId, base.targetName)
        : localExecutor;
      if (!identityExecutor) throw new AuthError("Invalid or expired session");
    }
    if (isHostingSession(current)) {
      const scope = getTenantEnvelope(current);
      if (!(identityExecutor instanceof PrivilegeDropExecutor)) throw new AuthError("Invalid tenant session");
      identityExecutor = identityExecutor.trustedServiceExecutorFor(scope.owner);
      if (!identityExecutor) throw new AuthError("Invalid tenant session");
    }
    const resolveIdentity = async () => {
      if (base.kind === "hosting") return { ...base, ...current, kind: "hosting" as const };
      const user = await panelUserRepository.findById(current.userId);
      if (!user || user.username !== current.username) throw new AuthError("User not found", "USER_NOT_FOUND");
      if (!user.enabled) throw new AuthError("Account is disabled", "ACCOUNT_DISABLED");
      const groups = await systemAccountsService.userGroups(user.username);
      return authService.buildTokenPayload({ ...user, groups });
    };
    const payload = identityExecutor ? await runWithExecutor(identityExecutor, resolveIdentity) : await resolveIdentity();
    // Carry the bridge/session-continuity fields buildTokenPayload (DB-only)
    // can't reconstruct. Passkey/SSO refresh already preserve these; this
    // generic refresh re-signed WITHOUT them, so the re-issued cookie lost its
    // bridge and every /panel/* route 401'd in managed mode. Hosting context
    // (owner/tenant/quotas/jail) is unaffected by per-tab override and read from
    // `current` so hosting sessions survive.
    Object.assign(
      payload,
      pickDefined({
        authTime: base.authTime ?? base.iat,
        mfaAuthenticated: base.mfaAuthenticated,
        hostingPolicy: current.hostingPolicy,
        bridgeSessionId: base.bridgeSessionId,
        remoteSessionId: base.remoteSessionId,
        remoteUserId: base.remoteUserId,
        targetId: base.targetId,
        targetName: base.targetName,
        targetHost: base.targetHost,
        direct: base.direct ? true : undefined,
        // Preserve the session KIND across a refresh. The generic refresh
        // re-signed WITHOUT `local`, so a standalone-local cookie lost its
        // explicit flag on every keepalive. The HTTP middleware defaults a
        // bridgeless session to local anyway, but the terminal/monitor WS token
        // path defaults to the OPPOSITE — so dropping `local` here made a
        // refreshed local session look direct to the WS layer.
        local: base.local ? true : undefined,
        tenantId: current.tenantId,
        owner: current.owner,
        tenantGroup: current.tenantGroup,
        homeRoot: current.homeRoot,
        maxSubUsers: current.maxSubUsers,
        maxDomains: current.maxDomains,
        maxEmailAccounts: current.maxEmailAccounts,
        maxDatabases: current.maxDatabases,
        diskQuotaMb: current.diskQuotaMb,
        bandwidthQuotaMb: current.bandwidthQuotaMb,
        jailEnabled: current.jailEnabled,
        external: current.external,
      }),
    );
    const result = tokenService.sign(payload, false);
    tokenService.setSessionCookie(res, result.token, false);
    res.json({
      ok: true,
      kind: payload.kind,
      modules: payload.modules,
      expiresAt: result.expiresAt,
      ...pickDefined({
        bridgeSessionId: payload.bridgeSessionId,
        targetId: payload.targetId,
        targetName: payload.targetName,
      }),
    });
  }),

  /** POST /api/logout — clears session cookie and revokes the JWT. */
  logout: asyncHandler(async (req: Request, res: Response) => {
    const user = res.locals.user;

    // Read the JWT from the cookie BEFORE we clear it so we can add its
    // `jti` to the denylist. Without this, a stolen cookie remains valid
    // until the natural expiry (24h / 30d `remember`).
    // Fuente única del nombre de cookie: `authConfig` (lo mismo que lee
    // `session.middleware`). Evita que el logout limpie/deniegue una cookie
    // distinta de la que se emitió.
    const cookieName = authConfig.cookie.sessionName;
    const token =
      (req.cookies?.[cookieName] as string | undefined) ??
      (() => {
        const header = req.headers["authorization"];
        if (typeof header === "string" && header.startsWith("Bearer ")) {
          return header.slice(7);
        }
        return undefined;
      })();
    // Read the BASE cookie payload BEFORE revoking (verify checks the denylist,
    // which the revoke below populates). `reflectTargetOnUser` may have
    // overwritten `user.bridgeSessionId` with the per-tab OVERRIDE id, so the
    // cookie's own bridge would otherwise survive in Redis until its natural TTL
    // (up to 30 days with remember). Dispose BOTH the override and the base.
    let baseBridgeSessionId: string | undefined;
    if (token) {
      try {
        const base = await tokenService.verify(token);
        baseBridgeSessionId = base?.bridgeSessionId;
      } catch {
        /* best-effort: a malformed/expired token has no live bridge to purge */
      }
      try {
        await tokenService.revoke(token);
      } catch (err) {
        log.warn({ err: errMessage(err) }, "logout: revoke failed");
      }
    }

    tokenService.clearSessionCookie(res);

    const bridged = res.locals.bridgedSession as { bridgeSessionId?: string } | undefined;
    const bridgeIds = new Set<string>();
    if (bridged?.bridgeSessionId) bridgeIds.add(bridged.bridgeSessionId);
    const userBridge = (user as { bridgeSessionId?: string } | undefined)?.bridgeSessionId;
    if (userBridge) bridgeIds.add(userBridge);
    if (baseBridgeSessionId) bridgeIds.add(baseBridgeSessionId);
    // Revoke credentials immediately; SSH channel and remote-temp cleanup can
    // take seconds and must not delay the response or depend on a live target.
    for (const bridgeSessionId of bridgeIds) {
      void disposeDirectExecutor(bridgeSessionId).catch(err => log.warn({ err: errMessage(err) }, "logout: bridge cleanup failed"));
    }

    if (user) {
      const auditExecutor = getContextExecutor();
      if (auditExecutor) void runWithExecutor(auditExecutor, () => authService.logAudit("logout", user.userId, "info", requestMeta(req))).catch(err => log.warn({ err: errMessage(err) }, "logout: audit failed"));

      eventBus.emit(Events.AUTH_LOGOUT, {
        userId: user.userId,
        username: user.username,
      });
    }

    res.json({ ok: true });
  }),
};
