// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";
import { asyncHandler } from "../../../shared/types/index.js";
import { panelOriginFromRequest } from "../../../shared/http/panel-origin.js";
import { AuthError } from "../../../shared/errors/index.js";
import { extractToken } from "../middlewares/session.middleware.js";
import { nativeAuthService } from "../services/native-auth.service.js";
import { tokenService } from "../services/token.service.js";
const opaque = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const requestOrigin = (req: Parameters<typeof panelOriginFromRequest>[0]) => {
  const url = new URL(panelOriginFromRequest(req));
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new AuthError("Invalid panel origin.");
  return url.origin;
};
export const nativeAuthController = {
  capabilities: asyncHandler(async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, data: { browserLogin: "pkce-s256-v1", workspaceContext: true } });
  }),
  start: asyncHandler(async (req, res) => {
    const input = z.object({ state: opaque, codeChallenge: opaque, codeChallengeMethod: z.literal("S256"), language: z.string().regex(/^[a-z]{2}(?:-[A-Za-z]{2})?$/).default("en") }).strict().parse(req.body);
    res.setHeader("Cache-Control", "no-store");
    res.status(201).json({ ok: true, data: await nativeAuthService.start(requestOrigin(req), input.state, input.codeChallenge, input.language) });
  }),
  authorize: asyncHandler(async (req, res) => {
    const { requestId } = z.object({ requestId: opaque }).strict().parse(req.body);
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, data: await nativeAuthService.authorize(requestId, requestOrigin(req), extractToken(req) ?? "") });
  }),
  redeem: asyncHandler(async (req, res) => {
    const { code, state, codeVerifier } = z.object({ code: opaque, state: opaque, codeVerifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/) }).strict().parse(req.body);
    const session = await nativeAuthService.redeem(code, requestOrigin(req), state, codeVerifier);
    res.setHeader("Cache-Control", "no-store");
    tokenService.setSessionCookie(res, session.token, false, session.expiresAt);
    // The PKCE-bound app receives its bearer in a POST response, never in a URL.
    res.json({ ok: true, data: { jwt: session.token, expiresAt: session.expiresAt } });
  }),
};
