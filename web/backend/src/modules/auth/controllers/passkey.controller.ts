// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Passkey controller — WebAuthn registration and authentication.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import type { AuthenticationResponseJSON } from "@simplewebauthn/types";
import { passkeyService } from "../services/passkey.service.js";
import { normalizeRegistrationResponse } from "../services/passkey-registration.js";
import {
  authService,
  clearFailedCount,
  establishLocalBridge,
  recordFailedMfaAttempt,
  resolveLockScope,
} from "../services/auth.service.js";
import { panelUserRepository, passkeyRepository } from "../repositories/index.js";
import { asyncHandler } from "../../../shared/types/index.js";
import { AuthError, NotFoundError } from "../../../shared/errors/index.js";
import { requestMeta } from "../../../shared/http/request-meta.js";
import { resolveEffectiveLoginMethods, withLocalAuthScope } from "../services/login-methods.service.js";

const passkeyLabelSchema = z.string().trim().min(1).max(128);
const renamePasskeySchema = z.object({ label: passkeyLabelSchema });

const registerVerifySchema = z.object({
  label: passkeyLabelSchema.default("My passkey"),
  response: z.record(z.unknown()).optional(),
}).passthrough();

const authOptionsSchema = z.object({
  username: z.string().optional(),
});

const authVerifySchema = z.object({
  remember: z.boolean().optional().default(false),
}).passthrough();

export const passkeyController = {
  /** GET /api/auth/passkeys — list active passkeys for the current user. */
  list: asyncHandler(async (_req: Request, res: Response) => {
    const { userId } = res.locals.user;
    const data = await passkeyService.list(userId);
    res.json({ ok: true, data });
  }),

  /** POST /api/auth/passkeys/register-options — generate registration options. */
  registerOptions: asyncHandler(async (_req: Request, res: Response) => {
    const { userId } = res.locals.user;
    const user = await panelUserRepository.findById(userId);
    if (!user) throw new NotFoundError("User");
    const origin = _req.get("origin");

    const options = await passkeyService.getRegistrationOptions(user, origin);
    res.json(options);
  }),

  /** POST /api/auth/passkeys/register-verify — verify registration and store credential. */
  registerVerify: asyncHandler(async (req: Request, res: Response) => {
    const body = registerVerifySchema.parse(req.body);
    const { userId } = res.locals.user;
    const user = await panelUserRepository.findById(userId);
    if (!user) throw new NotFoundError("User");
    const origin = req.get("origin");
    const response = normalizeRegistrationResponse(body);

    const passkey = await passkeyService.verifyRegistration(
      user,
      response,
      body.label,
      origin,
    );

    res.status(201).json({ ok: true, data: { id: passkey.id, label: passkey.label } });
  }),

  /** POST /api/auth/passkeys/auth-options — generate authentication options (public). */
  authOptions: asyncHandler(async (req: Request, res: Response) => {
    const methods = await resolveEffectiveLoginMethods();
    if (!methods.passkey) {
      throw new AuthError("El inicio de sesión por passkey está deshabilitado", "PASSKEY_LOGIN_DISABLED");
    }
    const { username } = authOptionsSchema.parse(req.body);
    // Pin the panel-host executor: reading this user's passkeys hits the
    // per-server kv-store, which fails closed pre-auth without an executor.
    const options = await withLocalAuthScope(() =>
      passkeyService.getAuthenticationOptions(username, req.get("origin")),
    );
    res.json(options);
  }),

  /** POST /api/auth/passkeys/auth-verify — verify and issue session. */
  authVerify: asyncHandler(async (req: Request, res: Response) => {
    const forwardedHost = (req.headers["x-forwarded-host"] as string | undefined) || req.headers.host;
    const methods = await resolveEffectiveLoginMethods();
    if (!methods.passkey) {
      throw new AuthError("El inicio de sesión por passkey está deshabilitado", "PASSKEY_LOGIN_DISABLED");
    }
    const body = authVerifySchema.parse(req.body);
    // Pin the panel-host executor for the whole verify+session flow: passkey
    // lookup, user load and session build all hit the per-server kv-store.
    await withLocalAuthScope(async () => {
    const response = body as unknown as AuthenticationResponseJSON;
    if (!response?.id) throw new AuthError("Invalid authentication response", "INVALID_AUTH_RESPONSE");
    const origin = req.get("origin");
    const lockScope = resolveLockScope(forwardedHost);

    // Look up the candidate user up front so we can attribute failed attempts
    // to the correct username for the shared lockout counter.
    const candidatePasskey = await passkeyRepository.findByCredentialId(response.id);
    const candidateUser = candidatePasskey ? await panelUserRepository.findById(candidatePasskey.userId) : null;

    let userId: number;
    try {
      userId = await passkeyService.verifyAuthentication(response, origin);
    } catch (err) {
      if (candidateUser) {
        await recordFailedMfaAttempt({
          lockScope,
          username: candidateUser.username,
          userId: candidateUser.id,
          reason: "passkey_failed",
          baseMessage: "Passkey inválida",
          meta: requestMeta(req),
        });
      }
      throw err instanceof AuthError ? err : new AuthError("Passkey inválida", "PASSKEY_INVALID");
    }

    const user = await panelUserRepository.findById(userId);
    if (!user || !user.enabled) throw new AuthError("Account not found or disabled", "ACCOUNT_NOT_FOUND");

    // Successful passkey auth — reset the shared failed-attempts counter so
    // the next SSH/2FA flow doesn't see leftover increments.
    await clearFailedCount(lockScope, user.username);

    // Bind the session to the panel host (self-hosted single-node): a local
    // bridge, so module endpoints resolve to the localExecutor after a
    // passkey-only login.
    const bridge = establishLocalBridge(user.username);

    const loginResponse = await authService.buildLoginResponse(
      { ...user, bridge: bridge ?? undefined },
      body.remember,
      res,
    );

    await authService.logAudit("passkey_login", userId, "info", requestMeta(req));

    res.json({ ok: true, ...loginResponse });
    });
  }),

  /** PATCH /api/auth/passkeys/:id — rename an owned active passkey. */
  rename: asyncHandler(async (req: Request, res: Response) => {
    const { label } = renamePasskeySchema.parse(req.body);
    const { userId } = res.locals.user;
    const data = await passkeyService.rename(userId, req.params["id"] as string, label);
    res.json({ ok: true, data });
  }),

  /** DELETE /api/auth/passkeys/:id — revoke a passkey. */
  revoke: asyncHandler(async (req: Request, res: Response) => {
    const { userId } = res.locals.user;
    const passkeyId = req.params["id"] as string;

    await passkeyService.revoke(userId, passkeyId);
    res.json({ ok: true });
  }),
};
