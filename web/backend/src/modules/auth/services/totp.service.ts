// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * TOTP service — Time-based One-Time Password (2FA) operations.
 */

import { TOTP } from "otplib";
import { NobleCryptoPlugin } from "@otplib/plugin-crypto-noble";
import { ScureBase32Plugin } from "@otplib/plugin-base32-scure";
import type { Executor } from "../../../shared/executor/index.js";
import { totpRepository } from "../repositories/index.js";

// Initialize plugins
const cryptoPlugin = new NobleCryptoPlugin();
const base32Plugin = new ScureBase32Plugin();

/**
 * Anti-replay context. When supplied, a verified code's matched RFC-6238 time
 * step is persisted per user and any code whose matched step is <= the last
 * accepted one is rejected — so a captured 6-digit code can't be reused inside
 * its (skew) window. Omitting the context preserves the legacy stateless check.
 */
export interface TotpVerifyContext {
  userId: number;
  /**
   * Optional explicit per-server executor for the anti-replay store. Normally
   * OMITTED: `verify` is only ever called inside an authenticated request, where
   * `requireAuth`/`optionalAuth` have already pinned the target executor in
   * AsyncLocalStorage, so `totpRepository` resolves it via `getContextExecutor()`
   * (fail-closed — no `localExecutor` fallback) and the replay step lands in the
   * correct per-server sidecar. Pass it only to override that ALS resolution
   * (e.g. a flow without an ambient request scope).
   */
  executor?: Executor | null;
}

export const totpService = {
  /**
   * Generate a new TOTP secret.
   */
  generateSecret(): string {
    const totp = new TOTP({ crypto: cryptoPlugin, base32: base32Plugin });
    return totp.generateSecret();
  },

  /**
   * Generate the otpauth:// URI for displaying a QR code.
   */
  otpAuthUri(username: string, secret: string): string {
    const totp = new TOTP({
      secret,
      issuer: "LUXIPANEL",
      label: username,
      crypto: cryptoPlugin,
      base32: base32Plugin,
    });
    return totp.toURI();
  },

  /**
   * Verify a TOTP code.
   *
   * When `ctx` is supplied, enforces single-use: rejects any code whose matched
   * RFC-6238 time step is <= the last step accepted for that user, then persists
   * the newly accepted step. Without `ctx` the check stays stateless (legacy).
   * The verification (skew) window is unchanged — only replays are added.
   */
  async verify(code: string, secret: string, ctx?: TotpVerifyContext): Promise<boolean> {
    try {
      const totp = new TOTP({
        secret,
        crypto: cryptoPlugin,
        base32: base32Plugin,
      });

      if (!ctx) {
        const result = await totp.verify(code);
        return result.valid;
      }

      // Anti-replay: reject steps already used (otplib's `afterTimeStep` makes
      // the verify itself fail for timeStep <= lastUsedStep).
      const lastUsedStep = await totpRepository.getLastUsedStep(ctx.userId, ctx.executor);
      const result = await totp.verify(
        code,
        lastUsedStep !== undefined ? { afterTimeStep: lastUsedStep } : undefined,
      );
      if (!result.valid) return false;
      // Belt-and-suspenders: also reject if somehow at/below the last step.
      if (lastUsedStep !== undefined && result.timeStep <= lastUsedStep) return false;
      await totpRepository.setLastUsedStep(ctx.userId, result.timeStep, ctx.executor);
      return true;
    } catch {
      return false;
    }
  },
};
