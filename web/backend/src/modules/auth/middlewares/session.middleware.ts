// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Session middleware — verifies JWT from cookie or Authorization header.
 *
 * On success, populates res.locals.user with SessionUser data.
 */

import { toolRequestContext } from "../../../shared/module-operations/request-context.js";
import type { RequestHandler } from "express";
import { tokenService } from "../services/token.service.js";
import { authConfig } from "../../../config/auth.js";
import { AuthError, BridgeSessionRequiredError } from "../../../shared/errors/index.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";
import { hydrateDirectSshExecutor, getExecutorAsync } from "../../../shared/executor/factory.js";
import { runWithExecutor } from "../../../shared/executor/context.js";
import { LOCAL_TARGET_ID } from "../../../shared/executor/local-executor.js";
import { resolveSessionPanelHost } from "../../../shared/utils/session-host.js";
import {
  readBridgeHeader,
  resolveOverrideBridge,
} from "../../../shared/session/bridge-header.js";
import { resolveLiveAuthorization } from "../services/live-authorization.service.js";
import { localExecutor } from "../../../shared/executor/local-executor.js";
import { getDirectExecutorByBridgeSessionId } from "../../../shared/executor/factory.js";
import { PrivilegeDropExecutor } from "../../../shared/executor/privilege-drop-executor.js";
import { ForbiddenError } from "../../../shared/errors/index.js";
import { isHostingSession } from "../../../shared/tenant/tenant-scope.js";

/** Completa `targetHost` en el SessionUser cuando el token no lo trae
 *  (sesiones direct-SSH): host de la request validado contra el subdominio
 *  de la sesión. Pura/defensiva — jamás afecta el flujo de login. */
function enrichTargetHost(
  user: { targetHost?: string; targetId?: string; targetName?: string } | undefined,
  req: import("express").Request,
): void {
  if (!user || user.targetHost) return;
  const headerHost =
    (req.headers["x-forwarded-host"] as string | undefined) || req.headers.host;
  const resolved = resolveSessionPanelHost(user, headerHost);
  if (resolved) user.targetHost = resolved;
}

async function hydrateBridgedSession(
  // `verify` es async (comprueba la denylist en Redis): el tipo útil aquí es el
  // valor YA resuelto, no la Promise.
  payload: Awaited<ReturnType<typeof tokenService.verify>>,
  req?: import("express").Request,
) {
  if (!payload) {
    return null;
  }

  // Per-tab isolation (Option B): if this tab sent an X-Bridge-Session-Id header
  // that differs from the cookie's own bridge id, resolve THAT target (switched
  // from the `servers` vault) as the request's bridged session. An explicit
  // override must resolve successfully; otherwise reject the request instead
  // of redirecting its reads/writes to the cookie's server.
  // Skipped when `req` is absent (the MFA-pending pre-login path). Runs BEFORE
  // the missing-target default below so a bridgeless base cookie can still be
  // driven to a switched remote target by its own per-tab header.
  if (req) {
    const requestedBridge = readBridgeHeader(req.headers);
    if (isHostingSession(tokenService.toSessionUser(payload)) && requestedBridge
      && requestedBridge !== payload.bridgeSessionId) {
      throw new AuthError("Invalid tenant session");
    }
    const override = await resolveOverrideBridge(requestedBridge, {
      userId: payload.userId,
      bridgeSessionId: payload.bridgeSessionId,
    });
    if (requestedBridge && requestedBridge !== payload.bridgeSessionId && (!override || !override.targetId)) {
      throw new BridgeSessionRequiredError(apiModuleMessage(req.res?.locals.locale, "terminalSessionExpired"));
    }
    if (override) {
      return {
        bridgeSessionId: override.bridgeSessionId,
        targetId: override.targetId,
        targetName: override.targetName,
        direct: true as const,
      };
    }
  }

  // No remote target selected in the token (no bridge metadata) → DEFAULT to the
  // LOCAL bridge: standalone LUXIPANEL manages the very server it runs on, so a
  // logged-in session that never switched to a remote target administers the
  // CONNECTED server via `localExecutor`. This is the documented standalone
  // default — NOT a per-server isolation hole: a DIRECT remote session ALWAYS
  // carries bridgeSessionId+targetId+direct and keeps its fail-closed resolution
  // (a dead bridge throws in getExecutorAsync, never silently falling to local);
  // only a session with no target ever selected lands here. Previously this
  // returned `null`, leaving requireAuth/optionalAuth with NO ambient executor,
  // so every per-server read (Settings list/timezone, firewall, cron, nginx…)
  // threw the fail-closed "no bridged session" error and 500'd/428'd the page
  // for a freshly-logged-in local user.
  if (!payload.bridgeSessionId || !payload.targetId) {
    return {
      bridgeSessionId: payload.bridgeSessionId ?? "",
      targetId: LOCAL_TARGET_ID,
      targetName: "Local",
      local: true as const,
    };
  }

  const base = {
    bridgeSessionId: payload.bridgeSessionId,
    targetId: payload.targetId,
    targetName: payload.targetName ?? payload.targetId,
  };

  // Direct-SSH bridge (a target switched from the `servers` vault): credentials
  // live in Redis on this host; `hydrateAndRun` eager-hydrates the executor.
  if (payload.direct) {
    return { ...base, direct: true as const };
  }

  // Local session (the panel manages the server it runs on) — and the default
  // for any session without an explicit direct flag: the per-request executor
  // resolves to the (sudo-wrapped) local executor. No SSH, no cached creds.
  return { ...base, local: true as const };
}

/**
 * Reflect the resolved bridged session's target onto res.locals.user so the
 * SSR/UI and downstream consumers (which read user.targetId/targetName) stay
 * consistent with the per-tab override actually driving the executor. No-op
 * when there is no user or no bridged session.
 */
function reflectTargetOnUser(
  user: import("../../../shared/types/index.js").SessionUser | undefined,
  bridgedSession: Awaited<ReturnType<typeof hydrateBridgedSession>>,
): void {
  if (!user || !bridgedSession) return;
  if (bridgedSession.bridgeSessionId === user.bridgeSessionId) return; // cookie session, nothing to reflect
  user.bridgeSessionId = bridgedSession.bridgeSessionId;
  user.targetId = bridgedSession.targetId;
  user.targetName = bridgedSession.targetName;
  // The override target may live on a different host; drop the stale cookie host
  // so enrichTargetHost can re-resolve it from the override's subdomain.
  user.targetHost = undefined;
}

/**
 * Shared tail for the auth middlewares: when a bridged session was resolved,
 * pin it on res.locals, eager-hydrate the direct-SSH executor if needed, and
 * run `next()` inside the per-server executor context. Otherwise just `next()`.
 */
async function hydrateAndRun(
  req: import("express").Request,
  res: import("express").Response,
  bridgedSession: Awaited<ReturnType<typeof hydrateBridgedSession>>,
  next: import("express").NextFunction,
  userId?: number,
  user?: import("../../../shared/types/index.js").SessionUser,
): Promise<void> {
  if (bridgedSession) {
    res.locals.bridgedSession = bridgedSession;
    if ((bridgedSession as { direct?: boolean }).direct) {
      // Eager-hydrate the direct-SSH executor so the synchronous getExecutor()
      // calls inside controllers see the cached connection.
      await hydrateDirectSshExecutor(bridgedSession.bridgeSessionId, bridgedSession.targetId, bridgedSession.targetName);
    }
    // Pin the resolved per-server executor for the whole request so any
    // kv()/dataStore()/settings call lands on the CONNECTED server, never
    // a panel-host shared store (cross-server data isolation).
    let executor = await getExecutorAsync(req);
    if (res.locals.mfaUser && executor instanceof PrivilegeDropExecutor) {
      const service = executor.trustedServiceExecutorFor(res.locals.mfaUser.owner ?? "");
      if (!service) throw new AuthError("Invalid MFA account executor");
      executor = service;
    }
    if (user && user.kind !== "mfa_pending") {
      const base = res.locals.authBaseUser ?? user;
      const source = base.direct && base.bridgeSessionId ? await getDirectExecutorByBridgeSessionId(base.bridgeSessionId) : localExecutor;
      if (!source) throw new AuthError("Identity server session expired");
      const live = await resolveLiveAuthorization(base, source);
      if (isHostingSession(live) && executor.target.id !== source.target.id) throw new ForbiddenError("Hosting account cannot change servers");
      reflectTargetOnUser(live, bridgedSession);
      res.locals.user = live;
      executor = await getExecutorAsync(req);
      if (executor instanceof PrivilegeDropExecutor && live.hostingPolicy?.runtime) executor.configureHostingRuntime(live.username);
      if (live.hostingPolicy?.state === "pending" && !["GET", "HEAD"].includes(req.method) && !/^\/api\/(logout|auth|preferences)(\/|$)/.test(req.originalUrl)) throw new ForbiddenError("Hosting runtime update pending");
      runWithExecutor(executor, () => next(), live.userId, live);
      return;
    }
    runWithExecutor(executor, () => next(), userId, user);
    return;
  }
  next();
}

/**
 * Require authentication. Returns 401 if no valid session exists.
 * Rejects MFA pending tokens — they cannot access protected routes.
 */
function sessionHandler(handler: RequestHandler): RequestHandler {
  // Some credential gates delegate without returning our Promise to Express.
  // Catch here so failed hydration cannot become an unhandled rejection and
  // terminate the backend while the browser waits for its connection.
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

export const requireAuth: RequestHandler = sessionHandler(async (req, res, next) => {
  if (toolRequestContext(req)) { next(); return; }
  const token = extractToken(req);

  if (!token) {
    next(new AuthError("Authentication required"));
    return;
  }

  const payload = await tokenService.verify(token);
  if (!payload) {
    next(new AuthError("Invalid or expired session"));
    return;
  }

  if (payload.mcpScope) { next(new AuthError("Scoped tokens are restricted to their MCP channel")); return; }
  if (payload.kind === "mfa_pending") {
    next(new AuthError("MFA verification required"));
    return;
  }

  res.locals.authBaseUser = tokenService.toSessionUser(payload);
  res.locals.user = tokenService.toSessionUser(payload);
  const bridgedSession = await hydrateBridgedSession(payload, req);
  reflectTargetOnUser(res.locals.user, bridgedSession);
  enrichTargetHost(res.locals.user, req);
  await hydrateAndRun(req, res, bridgedSession, next, res.locals.user?.userId, res.locals.user);
});

/**
 * Like `requireAuth` but STOPS short of resolving/hydrating the per-request
 * executor: it verifies the session, populates `res.locals.user` +
 * `res.locals.bridgedSession` and reflects the target onto the user, then calls
 * `next()` WITHOUT entering an executor context (no `getExecutorAsync`).
 *
 * ONLY for routes that must stay reachable when the bridge material is GONE — the
 * escape hatch `POST /api/servers/local/switch`. A JWT-pinned `direct` session
 * whose cached SSH material expired makes `getExecutorAsync` throw (fail-closed,
 * by design), which would 500 the very endpoint the user needs to return to
 * local. Such routes MUST NOT touch the target (no kv()/dataStore()/settings) —
 * there is deliberately NO ambient executor here.
 */
export const requireAuthNoExecutor: RequestHandler = sessionHandler(async (req, res, next) => {
  if (toolRequestContext(req)) { next(); return; }
  const token = extractToken(req);

  if (!token) {
    next(new AuthError("Authentication required"));
    return;
  }

  const payload = await tokenService.verify(token);
  if (!payload) {
    next(new AuthError("Invalid or expired session"));
    return;
  }

  if (payload.mcpScope) { next(new AuthError("Scoped tokens are restricted to their MCP channel")); return; }
  if (payload.kind === "mfa_pending") {
    next(new AuthError("MFA verification required"));
    return;
  }

  res.locals.authBaseUser = tokenService.toSessionUser(payload);
  res.locals.user = tokenService.toSessionUser(payload);
  const bridgedSession = await hydrateBridgedSession(payload, req);
  reflectTargetOnUser(res.locals.user, bridgedSession);
  enrichTargetHost(res.locals.user, req);
  if (bridgedSession) res.locals.bridgedSession = bridgedSession;
  // Logout must remain available when its bridge died. Every other escape
  // route revalidates the identity server before trusting a role snapshot.
  if (!/^\/api\/logout(?:\?|$)/.test(req.originalUrl)) {
    const source = payload.direct && payload.bridgeSessionId ? await getDirectExecutorByBridgeSessionId(payload.bridgeSessionId) : localExecutor;
    if (!source) { next(new AuthError("Identity server session expired")); return; }
    res.locals.user = await resolveLiveAuthorization(tokenService.toSessionUser(payload), source);
    reflectTargetOnUser(res.locals.user, bridgedSession);
  }
  next();
});

/**
 * Optional authentication. Populates res.locals.user if token is present
 * and valid, but does NOT reject the request if missing.
 */
export const optionalAuth: RequestHandler = sessionHandler(async (req, res, next) => {
  if (toolRequestContext(req)) { next(); return; }
  const token = extractToken(req);
  if (token) {
    const payload = await tokenService.verify(token);
    if (payload?.mcpScope) { next(new AuthError("Scoped tokens are restricted to their MCP channel")); return; }
    if (payload) {
      res.locals.authBaseUser = tokenService.toSessionUser(payload);
  res.locals.user = tokenService.toSessionUser(payload);
      const bridgedSession = await hydrateBridgedSession(payload, req);
      reflectTargetOnUser(res.locals.user, bridgedSession);
      enrichTargetHost(res.locals.user, req);
      await hydrateAndRun(req, res, bridgedSession, next, res.locals.user?.userId, res.locals.user);
      return;
    }
  }
  next();
});

/**
 * Require MFA pending token. Used for 2FA verification endpoint.
 * Token must have kind === "mfa_pending" and be valid.
 */
export const requireMfaPending: RequestHandler = sessionHandler(async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    next(new AuthError("MFA session required"));
    return;
  }

  const payload = await tokenService.verify(token);
  if (!payload || payload.kind !== "mfa_pending") {
    next(new AuthError("Invalid or expired MFA session"));
    return;
  }

  res.locals.mfaUser = payload;

  // The 2FA verify step reads per-server sidecars (totp secret, security
  // settings, audit log) through the request-scoped executor. The MFA-pending
  // token carries the SSH bridge metadata stashed at /login; re-hydrate that
  // direct-SSH executor and pin it for the request so those reads land on the
  // CONNECTED server. Without this the executor context is empty and the
  // fail-closed kv-store throws → "Internal server error" even on a valid code
  // (managed-only: there is no panel-host fallback).
  // NB: no per-tab override here — MFA-pending is a pre-login step and must
  // resolve strictly from the MFA token's own bridge metadata.
  const bridgedSession = await hydrateBridgedSession(payload);
  await hydrateAndRun(req, res, bridgedSession, next, payload.userId);
});

/** Extract token from cookie or Authorization: Bearer header. */
export function extractToken(req: import("express").Request): string | null {
  // 1. Cookie
  const cookieName = authConfig.cookie.sessionName;
  const cookie = req.cookies?.[cookieName];
  if (typeof cookie === "string" && cookie.length > 0) return cookie;

  // 2. Authorization header
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  return null;
}
