// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { authorizationChanged } from "../../../shared/auth/authorization-revision.js";
/**
 * Token service — JWT sign, verify, and cookie management.
 */

import { deflateRawSync, inflateRawSync } from "node:zlib";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import type { Response } from "express";
import { authConfig } from "../../../config/auth.js";
import { env } from "../../../config/env.js";
import { cookieDomainMatchesHost, purgeLegacyDomainCookies } from "../../../shared/cookies.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { errMessage } from "../../../shared/utils/err-message.js";
import { getRedis } from "../../../shared/redis/index.js";
import type { SessionUser } from "../../../shared/types/index.js";

const log = createModuleLogger("auth.token");

const DENYLIST_PREFIX = "auth:revoked:jti:";

export interface TokenPayload {
  githubIdentityTargetId?: string;
  githubIdentityDirect?: boolean;
  authTime?: number;
  iat?: number;
  exp?: number;
  mfaAuthenticated?: boolean;
  permissionsCompressed?: string;
  authorizationRevision?: string;
  hostingPolicy?: { capabilities?: { php: boolean }; expiresAt?: string | null; revision: number; state: "ready" | "pending"; runtime: boolean; security?: import("../../hosting/models/hosting-template.model.js").HostingSecurity };
  /** JWT ID (`jwtid` al firmar): la clave con la que se revoca el token en la
   *  denylist de Redis. Opcional en el tipo porque un token EMITIDO ANTES de la
   *  revocación no lo trae — `verify` rechaza esos explícitamente en vez de
   *  dejarlos vivir para siempre sin poder revocarlos. */
  jti?: string;
  userId: number;
  username: string;
  displayName: string;
  role: string;
  modules: string[];
  kind: "admin" | "user" | "hosting" | "mfa_pending" | "external-guest";
  /** External-panel guest session (WHM/cPanel enmascarado por subdominio).
   *  NO hay executor SSH. Los FABs (terminal/asistente/más opciones) sólo se
   *  habilitan si `external.hasSsh` Y los permisos del usuario lo permiten. */
  external?: {
    accessCode: string;
    /** https://<accessCode>.<root> — destino enmascarado del WHM. */
    entryUrl: string;
    displayName: string;
    category?: string | null;
    tag?: string | null;
    hasSsh: boolean;
  };
  permissions?: {
    sidebar: string[];
    views: string[];
    actions: string[];
    fileAccess: {
      allowAll: boolean;
      allowPaths: string[];
      denyPaths: string[];
      readOnlyPaths: string[];
      defaultPath?: string | null;
      grants?: import("../../../shared/auth/group-policy.types.js").FileAccessGrant[];
    };
    commandPolicy: {
      allowAll: boolean;
      groups: string[];
      allowCommands: string[];
      denyCommands: string[];
      grants?: import("../../../shared/auth/group-policy.types.js").CommandGrant[];
    };
  };
  tenantId?: number;
  /** Hosting-only: dueño primario del tenant (= username del owner Linux). */
  owner?: string;
  /** Hosting-only: grupo Linux que une a los sub-usuarios (h-<owner>). */
  tenantGroup?: string;
  /** Hosting-only: raíz del tenant (= permissions.fileAccess.allowPaths[0]). */
  homeRoot?: string;
  /** Hosting-only: cupo máximo de sub-usuarios que la cuenta puede crear. */
  maxSubUsers?: number;
  /** Hosting-only (Fase 6): cupos de recursos del tenant en el JWT firmado. */
  maxDomains?: number;
  maxEmailAccounts?: number;
  maxDatabases?: number;
  diskQuotaMb?: number;
  bandwidthQuotaMb?: number;
  /** Hosting-only (Fase 5): la cuenta tiene el chroot/jail previsto. El Terminal
   *  lo lee para enjaular (fail-closed) la PTY de las sesiones `kind:"hosting"`. */
  jailEnabled?: boolean;
  bridgeSessionId?: string;
  remoteSessionId?: string;
  /** LP customer id that owns the bridged session. With SSO_IDENTITY=linux the
   *  token `userId` is the per-server Linux panel user (NOT the customer), so
   *  the bridged-session integrity check matches `remoteUserId` (the customer)
   *  instead of `userId`. Equal to `userId` in customer-identity/legacy tokens. */
  remoteUserId?: number;
  targetId?: string;
  targetName?: string;
  /** Stable display host of the connected panel (verified custom domain or
   *  `<accessSubdomain>.<managed-domain>`), from LP's SSO `thost` claim. The
   *  sidebar server switcher shows its subdomain instead of the cryptic dynamic
   *  login host. Carried in the JWT so it survives keepalive refreshes without
   *  a bridged-session round trip. */
  targetHost?: string;
  /** Marks the session as a "direct SSH" bridge — credentials cached locally,
   *  no LP-side remote session involved. Used by the /login flow on multi-host
   *  setups where LP holds the keys but each host SSHes directly to the target. */
  direct?: boolean;
  /** Marks the session as a "local" bridge (standalone-local mode): the panel
   *  manages the server it runs on via `localExecutor`. No SSH, no LP, no cached
   *  credentials — every per-request executor resolves to the (sudo-wrapped)
   *  local executor. Mutually exclusive with `direct`. */
  local?: boolean;
  remember?: boolean;
  /** Scopes an MCP token. `"cross"` = minted for the per-run cross-server MCP
   *  channel (only `servers.*` tools). The full `/api/ai/mcp` endpoint REJECTS
   *  cross-scoped tokens so a token written to a target shell can never be
   *  replayed to reach the connected server's full toolset. */
  mcpScope?: "cross" | "graph" | "modules";
  /** Cross-scoped MCP tokens only: the conversation this per-run channel belongs
   *  to. Lets the `permissions.approve` MCP tool route an approval prompt back to
   *  the right live run (agent-run-registry) and block on the user's decision. */
  conversationId?: string;
}

/**
 * Parse duration string to milliseconds. Supports "24h", "30d", "60m", "120s".
 * Returns `fallback` (default 24h) for unparseable input.
 */
export function parseDuration(value: string, fallback = 86400000): number {
  const match = String(value ?? "").match(/^(\d+)\s*(ms|s|m|h|d)$/i);
  if (!match) return fallback;
  const n = parseInt(match[1]!, 10);
  const unit = match[2]!.toLowerCase();
  switch (unit) {
    case "ms": return n;
    case "s": return n * 1000;
    case "m": return n * 60 * 1000;
    case "h": return n * 60 * 60 * 1000;
    case "d": return n * 24 * 60 * 60 * 1000;
    default: return fallback;
  }
}

function signCore(payload: TokenPayload, expiresSeconds: number): string {
  const envelope = { ...payload, authTime: payload.authTime ?? payload.iat ?? Math.floor(Date.now() / 1000) };
  for (const claim of ["iat", "exp", "jti", "iss", "sub", "aud", "nbf"]) delete (envelope as unknown as Record<string, unknown>)[claim];
  if (envelope.permissions) {
    envelope.permissionsCompressed = deflateRawSync(Buffer.from(JSON.stringify(envelope.permissions))).toString("base64url");
    delete envelope.permissions;
  }
  return jwt.sign(envelope, authConfig.jwt.secret, {
    expiresIn: expiresSeconds,
    issuer: "luxipanel",
    subject: String(payload.userId),
    jwtid: randomUUID(),
  });
}

export const tokenService = {
  /** Sign a JWT session token. */
  sign(payload: TokenPayload, remember = false): { token: string; expiresAt: number } {
    const expiresIn = remember ? authConfig.jwt.rememberExpiresIn : authConfig.jwt.expiresIn;
    const expiresMs = parseDuration(expiresIn);
    const token = signCore(payload, Math.floor(expiresMs / 1000));
    return {
      token,
      expiresAt: Date.now() + expiresMs,
    };
  },

  /** Sign a JWT session token using an explicit expiration timestamp. */
  signWithExpiry(payload: TokenPayload, expiresAt: number): { token: string; expiresAt: number } {
    const expiresMs = Math.max(expiresAt - Date.now(), 1000);
    const token = signCore(payload, Math.max(Math.floor(expiresMs / 1000), 1));
    return { token, expiresAt };
  },

  /** Sign a partial JWT token (MFA pending — default 5 minute expiry). */
  signPartial(payload: TokenPayload): { token: string; expiresAt: number } {
    const expiresMs = parseDuration(env.JWT_PARTIAL_EXPIRES_IN, 5 * 60 * 1000);
    const token = signCore(payload, Math.floor(expiresMs / 1000));
    return {
      token,
      expiresAt: Date.now() + expiresMs,
    };
  },

  /**
   * Verify and decode a JWT. Returns null on invalid/expired/revoked.
   *
   * ES ASÍNCRONA a propósito: la comprobación de la denylist es un `EXISTS`
   * contra Redis, y `exists()` devuelve una Promise. Sin `await`, el valor era
   * SIEMPRE truthy (una Promise lo es), así que se daba por revocado cualquier
   * token y toda petición autenticada acababa en 401 — un apagón total del
   * login en cuanto Redis estuviera conectado (en tests sin Redis no se veía,
   * porque `getRedis()` lanzaba y el catch dejaba pasar el token).
   */
  async verify(token: string): Promise<TokenPayload | null> {
    let decoded: TokenPayload | null = null;
    try {
      decoded = jwt.verify(token, authConfig.jwt.secret, {
        issuer: "luxipanel",
        // SECURITY: pin the symmetric algorithm so a token cannot be presented
        // with alg=none or via HS/RS confusion. Tokens are signed with HS256.
        algorithms: ["HS256"],
      }) as TokenPayload;
    } catch {
      return null;
    }
    if (!decoded || typeof (decoded as { jti?: unknown }).jti !== "string") {
      // No jti means the token was signed before this revision — refuse it
      // rather than allow pre-denylist tokens to live forever.
      return null;
    }
    // Revocation is an authorization boundary; an unavailable denylist must
    // never make a previously revoked token usable again.
    try {
      const redis = getRedis();
      const revoked = await redis.exists(DENYLIST_PREFIX + decoded.jti);
      if (revoked > 0) return null;
    } catch (err) {
      log.warn(
        { err: errMessage(err) },
        "Redis unavailable during JWT denylist check — rejecting the token",
      );
      return null;
    }
    if (decoded.permissionsCompressed) {
      try { decoded.permissions = JSON.parse(inflateRawSync(Buffer.from(decoded.permissionsCompressed, "base64url"), { maxOutputLength: 262144 }).toString("utf8")); }
      catch { return null; }
      delete decoded.permissionsCompressed;
    }
    return decoded;
  },

  /**
   * Revoke a JWT immediately by adding its `jti` (with TTL = remaining
   * lifetime) to the Redis denylist. Logout calls this so a stolen cookie
   * can't keep riding the previous session.
   */
  async revoke(token: string): Promise<boolean> {
    let payload: { exp?: number; jti?: unknown } | null = null;
    try {
      payload = jwt.decode(token) as { exp?: number; jti?: unknown } | null;
    } catch {
      return false;
    }
    const jti = payload && typeof payload.jti === "string" ? payload.jti : null;
    const exp = payload && typeof payload.exp === "number" ? payload.exp : null;
    if (!jti) return false;
    const ttlMs = exp ? exp * 1000 - Date.now() : 60_000;
    if (ttlMs <= 0) return true; // already expired; nothing to do
    try {
      const redis = getRedis();
      // SET key 1 PX ttl — single round-trip, atomic.
      await (redis as unknown as {
        set: (k: string, v: string, mode: string, ttl: number) => Promise<unknown>;
      }).set(DENYLIST_PREFIX + jti, "1", "PX", ttlMs);
      await authorizationChanged("session-revocations").catch(error => log.warn({ error: errMessage(error) }, "Revocation notification unavailable; denylist remains enforced"));
      return true;
    } catch (err) {
      log.warn(
        { err: errMessage(err), jti },
        "JWT revoke: Redis unavailable — denial will not be enforced until Redis recovers",
      );
      return false;
    }
  },

  /** Set the session cookie on the response. */
  setSessionCookie(res: Response, token: string, remember = false, expiresAt?: number) {
    const maxAge = typeof expiresAt === "number"
      ? Math.max(expiresAt - Date.now(), 0)
      : remember
        ? parseDuration(authConfig.jwt.rememberExpiresIn)
        : parseDuration(authConfig.jwt.expiresIn);

    const reqHost = res.req?.headers?.host;
    const configuredDomain = authConfig.cookie.domain;
    const effectiveDomain = cookieDomainMatchesHost(configuredDomain, reqHost) ? configuredDomain : undefined;
    const secure = authConfig.cookie.secure || Boolean(res.req?.secure);

    res.cookie(authConfig.cookie.sessionName, token, {
      httpOnly: true,
      secure,
      sameSite: authConfig.cookie.sameSite,
      domain: effectiveDomain,
      ...(remember ? { maxAge } : {}),
      path: "/",
    });
    // Delete any stale wildcard-domain copy so it can't shadow this cookie.
    purgeLegacyDomainCookies(res, authConfig.cookie.sessionName, {
      legacyDomains: authConfig.cookie.legacyDomains,
      activeDomain: authConfig.cookie.domain,
      requestHost: res.req?.headers?.host,
      secure: authConfig.cookie.secure || Boolean(res.req?.secure),
      sameSite: authConfig.cookie.sameSite,
      httpOnly: true,
    });
  },

  /** Clear the session cookie. */
  clearSessionCookie(res: Response) {
    const reqHost = res.req?.headers?.host;
    const configuredDomain = authConfig.cookie.domain;
    const effectiveDomain = cookieDomainMatchesHost(configuredDomain, reqHost) ? configuredDomain : undefined;
    const secure = authConfig.cookie.secure || Boolean(res.req?.secure);

    res.clearCookie(authConfig.cookie.sessionName, {
      httpOnly: true,
      secure,
      sameSite: authConfig.cookie.sameSite,
      domain: effectiveDomain,
      path: "/",
    });
    // Also delete any legacy wildcard-domain copy so logout is complete.
    purgeLegacyDomainCookies(res, authConfig.cookie.sessionName, {
      legacyDomains: authConfig.cookie.legacyDomains,
      activeDomain: authConfig.cookie.domain,
      requestHost: res.req?.headers?.host,
      secure: authConfig.cookie.secure || Boolean(res.req?.secure),
      sameSite: authConfig.cookie.sameSite,
      httpOnly: true,
    });
  },

  /** Build a SessionUser from a token payload. */
  toSessionUser(payload: TokenPayload): SessionUser {
    return {
      githubIdentityTargetId: payload.githubIdentityTargetId,
      githubIdentityDirect: payload.githubIdentityDirect,
      sessionIssuedAt: payload.authTime ?? payload.iat,
      mfaAuthenticated: payload.mfaAuthenticated,
      direct: payload.direct,
      local: payload.local,
      userId: payload.userId,
      username: payload.username,
      displayName: payload.displayName,
      role: payload.role,
      modules: payload.modules,
      kind: payload.kind,
      authorizationRevision: payload.authorizationRevision,
      hostingPolicy: payload.hostingPolicy,
      ...(payload.external !== undefined ? { external: payload.external } : {}),
      ...(payload.permissions !== undefined ? { permissions: payload.permissions } : {}),
      ...(payload.tenantId !== undefined ? { tenantId: payload.tenantId } : {}),
      // Hosting-only envelope (Fase 3): el owner dropped NO puede leer el sidecar
      // /etc/luxipanel, así que el envelope para acotar el módulo Usuarios al
      // tenant viaja en el JWT firmado (no manipulable por el owner).
      ...(payload.owner !== undefined ? { owner: payload.owner } : {}),
      ...(payload.tenantGroup !== undefined ? { tenantGroup: payload.tenantGroup } : {}),
      ...(payload.homeRoot !== undefined ? { homeRoot: payload.homeRoot } : {}),
      ...(payload.maxSubUsers !== undefined ? { maxSubUsers: payload.maxSubUsers } : {}),
      // Fase 6 — cupos de recursos del tenant (dominios/correo/db/disco/BW).
      ...(payload.maxDomains !== undefined ? { maxDomains: payload.maxDomains } : {}),
      ...(payload.maxEmailAccounts !== undefined ? { maxEmailAccounts: payload.maxEmailAccounts } : {}),
      ...(payload.maxDatabases !== undefined ? { maxDatabases: payload.maxDatabases } : {}),
      ...(payload.diskQuotaMb !== undefined ? { diskQuotaMb: payload.diskQuotaMb } : {}),
      ...(payload.bandwidthQuotaMb !== undefined ? { bandwidthQuotaMb: payload.bandwidthQuotaMb } : {}),
      // Fase 5 — bandera de jaula previsto (el Terminal la usa para fail-closed).
      ...(payload.jailEnabled !== undefined ? { jailEnabled: payload.jailEnabled } : {}),
      ...(payload.bridgeSessionId !== undefined ? { bridgeSessionId: payload.bridgeSessionId } : {}),
      ...(payload.remoteSessionId !== undefined ? { remoteSessionId: payload.remoteSessionId } : {}),
      ...(payload.targetId !== undefined ? { targetId: payload.targetId } : {}),
      ...(payload.targetName !== undefined ? { targetName: payload.targetName } : {}),
      // Host de panel confiable (claim `thost` de LP). Sin esto, los flujos
      // que prometen preservarlo (refresh SSO, módulos host-resueltos contra
      // LP) leían siempre undefined de res.locals.user.
      ...(payload.targetHost !== undefined ? { targetHost: payload.targetHost } : {}),
    };
  },
};
