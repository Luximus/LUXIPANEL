// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Recovery controller — generate and verify backup recovery codes.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import crypto from "node:crypto";
import { recoveryRepository, panelUserRepository } from "../repositories/index.js";
import { hashRecoveryCode } from "../repositories/recovery.repository.js";
import {
  authService,
  bumpAndFormatFailedMessage,
  clearFailedCount,
  establishLocalBridge,
  recordFailedMfaAttempt,
  resolveLockScope,
} from "../services/auth.service.js";
import { resolveEffectiveLoginMethods, withLocalAuthScope } from "../services/login-methods.service.js";
import { uuid } from "../../../shared/utils/index.js";
import { asyncHandler } from "../../../shared/types/index.js";
import { AuthError } from "../../../shared/errors/index.js";
import { requestMeta } from "../../../shared/http/request-meta.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";

const log = createModuleLogger("recovery-ctrl");

const verifySchema = z.object({
  username: z.string().min(1).trim(),
  code: z.string().min(1),
  remember: z.boolean().default(false),
});

/** Number of recovery codes generated per batch. */
const CODES_COUNT = 10;

/** Generate a user-friendly recovery code: XXXX-XXXX-XXXX (base32-ish, no ambiguous chars). */
function generateRecoveryCode(): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 12; i++) {
    // crypto.randomInt is rejection-sampled → uniform regardless of the
    // alphabet length (no modulo bias if the alphabet ever changes size).
    code += alphabet[crypto.randomInt(0, alphabet.length)];
    if (i === 3 || i === 7) code += "-";
  }
  return code;
}

export const recoveryController = {
  /** GET /api/auth/recovery/status — check if user has active recovery codes. */
  status: asyncHandler(async (_req: Request, res: Response) => {
    const { userId } = res.locals.user;
    const has = await recoveryRepository.hasActiveCodes(userId);
    res.json({ ok: true, hasActiveCodes: has });
  }),

  /**
   * POST /api/auth/recovery/generate — (authenticated) generate a new set of recovery codes.
   * Returns plaintext codes ONCE — store them securely.
   */
  generate: asyncHandler(async (_req: Request, res: Response) => {
    const { userId } = res.locals.user;

    const plaintextCodes: string[] = [];
    const codeRecords = Array.from({ length: CODES_COUNT }, () => {
      const code = generateRecoveryCode();
      plaintextCodes.push(code);
      return {
        id: `rc_${uuid()}`,
        userId,
        // Salted, memory-hard scrypt (see recovery.repository). Recovery codes
        // use a reduced alphabet, so unsalted SHA-256 was GPU-brutable offline.
        codeHash: hashRecoveryCode(code),
      };
    });

    await recoveryRepository.replaceAll(userId, codeRecords);

    log.info({ userId, count: CODES_COUNT }, "Recovery codes generated");

    res.json({
      ok: true,
      codes: plaintextCodes,
      message: apiModuleMessage(res.locals.locale, "recoveryCodesNotice"),
    });
  }),

  /**
   * POST /api/auth/recovery/verify — (public) verify a recovery code and issue a session.
   * The code is consumed (single-use).
   */
  verify: asyncHandler(async (req: Request, res: Response) => {
    const forwardedHost = (req.headers["x-forwarded-host"] as string | undefined) || req.headers.host;
    const methods = await resolveEffectiveLoginMethods();
    if (!methods.recovery) {
      throw new AuthError("El inicio de sesión por código de recuperación está deshabilitado", "RECOVERY_LOGIN_DISABLED");
    }
    const body = verifySchema.parse(req.body);
    const lockScope = resolveLockScope(forwardedHost);

    // Pin the panel-host executor: user lookup, code consumption and session
    // build all hit the per-server kv-store, which fails closed pre-auth.
    await withLocalAuthScope(async () => {
    const user = await panelUserRepository.findByUsername(body.username);
    if (!user) {
      // We don't reveal whether the username exists, but we still bump the
      // counter against the entered username so brute-force attempts on
      // unknown names are also rate-limited.
      const formatted = await bumpAndFormatFailedMessage(
        lockScope,
        body.username,
        "Código de recuperación inválido",
      );
      throw new AuthError(formatted.message);
    }
    if (!user.enabled) throw new AuthError("Account is disabled", "ACCOUNT_DISABLED");

    // Shape-aware verification: `consumeByCandidate` compares the plaintext
    // candidate against each active stored hash via `verifyRecoveryCode`
    // (scrypt for new codes, legacy unsalted SHA-256 accepted transparently).
    const candidate = body.code.toUpperCase().replace(/\s/g, "");
    const consumed = await recoveryRepository.consumeByCandidate(user.id, candidate);

    if (!consumed) {
      await recordFailedMfaAttempt({
        lockScope,
        username: user.username,
        userId: user.id,
        reason: "recovery_code_invalid",
        baseMessage: "Código de recuperación inválido",
        meta: requestMeta(req),
      });
    }

    // Successful recovery — reset the shared failed-attempts counter.
    await clearFailedCount(lockScope, user.username);

    // Bind the session to the panel host (self-hosted single-node): a local
    // bridge, so module endpoints resolve to the localExecutor after a
    // recovery-code login.
    const bridge = establishLocalBridge(user.username);

    const loginResponse = await authService.buildLoginResponse(
      { ...user, bridge: bridge ?? undefined },
      body.remember,
      res,
    );

    await authService.logAudit("recovery_login", user.id, "high", requestMeta(req));

    log.warn({ userId: user.id }, "Recovery code used for login");

    res.json({ ok: true, ...loginResponse });
    });
  }),
};
