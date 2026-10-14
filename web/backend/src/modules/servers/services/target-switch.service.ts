// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Target-switch session service — the shared cookie re-signing logic behind
 * `POST /api/servers/:id/switch` (remote target) and `POST /api/servers/local/switch`
 * (return to the connected server).
 *
 * The switch is authoritative in the JWT itself: after a switch, a request that
 * arrives WITHOUT the per-tab `X-Bridge-Session-Id` header must still resolve to
 * the switched target (remote) or to LOCAL — never silently fall through to the
 * panel host. That means the session cookie has to be re-signed with (or without)
 * the bridge claims. This module owns that re-sign so both controller paths share
 * one implementation and stay in lockstep.
 *
 * NB: it takes `req`/`res` (type-only express imports) because it reads the
 * current cookie and writes the fresh one — it is session I/O, not business
 * logic, and carries no other express coupling.
 */

import type { Request, Response } from "express";
import { extractToken } from "../../auth/middlewares/session.middleware.js";
import {
  parseDuration,
  tokenService,
  type TokenPayload,
} from "../../auth/services/token.service.js";
import { authConfig } from "../../../config/auth.js";
import { createModuleLogger } from "../../../shared/logger/index.js";

const log = createModuleLogger("target-switch");

/** JWT claims that pin a session to a remote/direct bridge target. Stripping
 *  these (+ the reserved JWT claims re-issued by `signCore`) turns any session
 *  back into a pure LOCAL session that resolves to `localExecutor`. */
export const BRIDGE_CLAIMS = [
  "bridgeSessionId",
  "remoteSessionId",
  "remoteUserId",
  "targetId",
  "targetName",
  "targetHost",
  "direct",
  "local",
] as const;
/** Reserved claims injected by `jwt.sign`; must NOT be re-supplied in the payload
 *  (jsonwebtoken throws "Bad options" if both the claim and its option are set). */
export const RESERVED_JWT_CLAIMS = ["iat", "exp", "nbf", "iss", "sub", "jti"] as const;

/** Bridge-material TTL = the session TTL (JWT expiry), min 60s (enforced in cache.put). */
export function bridgeTtlSeconds(): number {
  return Math.max(60, Math.floor(parseDuration(authConfig.jwt.expiresIn) / 1000));
}

/** The bridge/target claims a switched session carries. `null` = return to LOCAL. */
export interface BridgeClaims {
  bridgeSessionId: string;
  targetId: string;
  targetName: string;
}

/**
 * Re-sign the current session cookie, replacing every bridge/target claim.
 *
 * - `claims` provided → pin the session to that DIRECT bridge target
 *   (`{bridgeSessionId, targetId, targetName, direct:true}`), so a request
 *   without the per-tab header still resolves to it (no silent LOCAL fallthrough).
 * - `claims === null` → strip every bridge claim and mark the session `local:true`
 *   (explicit return to the connected server; escapes a JWT-pinned remote).
 *
 * Preserves the original JWT expiration (a switch must not extend the session).
 * Best-effort revokes the previous token's `jti` (Redis denylist) so the old
 * cookie can't keep riding the prior session; a revoke failure never breaks the
 * switch (the fresh cookie is already set). Returns the previous verified payload
 * so the caller can also tear down the previous bridge (dispose its executor).
 */
export async function resignSessionWithBridge(
  req: Request,
  res: Response,
  claims: BridgeClaims | null,
): Promise<{ oldToken: string | null; oldPayload: TokenPayload | null }> {
  const oldToken = extractToken(req);
  const base = oldToken ? await tokenService.verify(oldToken) : null;
  if (!base || !oldToken) {
    return { oldToken, oldPayload: null };
  }

  const raw = { ...(base as unknown as Record<string, unknown>) };
  for (const claim of [...BRIDGE_CLAIMS, ...RESERVED_JWT_CLAIMS]) delete raw[claim];
  if (claims) {
    raw.bridgeSessionId = claims.bridgeSessionId;
    raw.targetId = claims.targetId;
    raw.targetName = claims.targetName;
    raw.direct = true;
  } else {
    raw.local = true;
  }

  const payload = raw as unknown as TokenPayload;
  const exp = (base as TokenPayload & { exp?: number }).exp;
  const expiresAtMs = typeof exp === "number" ? exp * 1000 : Date.now() + bridgeTtlSeconds() * 1000;
  const { token: fresh, expiresAt } = tokenService.signWithExpiry(payload, expiresAtMs);
  tokenService.setSessionCookie(res, fresh, false, expiresAt);

  // Revoke the previous JWT best-effort (denylist by jti). A revoke failure must
  // not break the switch — the fresh cookie is already set on the response.
  await tokenService.revoke(oldToken).catch((err) => {
    log.warn({ err }, "revoke previous session token failed (non-fatal)");
  });

  return { oldToken, oldPayload: base };
}
