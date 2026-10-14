// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * OTP service — generation, delivery, and verification of one-time passwords.
 *
 * Delivery modes:
 *  - "preview": dev-only, code is logged and optionally returned in the response
 *  - "whatsapp": production delivery via WhatsApp Business API (placeholder)
 */

import { otpRepository, panelUserRepository } from "../repositories/index.js";
import { sha256, uuid, randomInt } from "../../../shared/utils/index.js";
import { AuthError } from "../../../shared/errors/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { env } from "../../../config/env.js";

const log = createModuleLogger("otp-service");

/** OTP validity window in minutes. */
const OTP_TTL_MINUTES = 5;

/** Generate a random 6-digit numeric code. */
function generateCode(): string {
  // SECURITY: use a CSPRNG (crypto.randomInt). Math.random() is V8 xorshift128+,
  // which is predictable and must not gate authentication codes.
  return String(randomInt(100000, 1000000));
}

export interface OtpResult {
  requestId: string;
  deliveryMode: string;
  expiresAt: Date;
  /** Only present in dev/preview mode — never send to frontend in production. */
  previewCode?: string;
}

export const otpService = {
  /**
   * Request a new OTP for the given username.
   * Returns requestId (and previewCode in dev mode).
   */
  async request(username: string): Promise<OtpResult> {
    const user = await panelUserRepository.findByUsername(username);
    if (!user) {
      // Throw generic error to avoid user enumeration
      throw new AuthError("OTP delivery failed");
    }

    if (!user.phoneE164) {
      throw new AuthError("No phone number configured for this account");
    }

    const code = generateCode();
    const codeHash = sha256(code);
    const requestId = `otp_${uuid()}`;
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    const deliveryMode = env.NODE_ENV === "production" ? "whatsapp" : "preview";
    const deliveryId: string | null = null;
    let previewCode: string | undefined;

    if (deliveryMode === "preview") {
      // SECURITY: never log the OTP code (it would leak the auth secret to log
      // sinks). Preview mode is dev-only (NODE_ENV !== "production"); the code
      // is returned in the response for the dev UI, not written to logs.
      log.warn({ username, phone: user.phoneE164 }, "OTP PREVIEW (dev only)");
      previewCode = code;
    } else {
      // WhatsApp OTP delivery is not implemented (no provider integration).
      log.error("WhatsApp delivery not implemented — configure a provider");
      throw new AuthError("WhatsApp OTP not implemented");
    }

    await otpRepository.create({
      requestId,
      userId: user.id,
      phoneE164: user.phoneE164,
      codeHash,
      deliveryMode,
      deliveryId,
      previewCode: deliveryMode === "preview" ? code : null,
      expiresAt,
    });

    log.info({ requestId, userId: user.id, deliveryMode }, "OTP requested");

    return { requestId, deliveryMode, expiresAt, previewCode };
  },

  /**
   * Verify an OTP code. On success returns the userId.
   * The OTP request is consumed (single-use).
   */
  async verify(requestId: string, code: string): Promise<number> {
    const codeHash = sha256(code);
    const otpReq = await otpRepository.consume(requestId, codeHash);

    if (!otpReq) {
      throw new AuthError("Invalid or expired OTP code");
    }

    // Check expiry
    if (new Date() > otpReq.expiresAt) {
      throw new AuthError("OTP code has expired");
    }

    log.info({ requestId, userId: otpReq.userId }, "OTP verified");
    return otpReq.userId;
  },
};
