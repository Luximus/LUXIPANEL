// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * OTP requests repository — file-backed via dataStore. Lives at
 * `${LUXIPANEL_CONFIG_DIR}/auth/otp.json` on the connected server.
 */

import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { OtpRequest, NewOtpRequest } from "../models/index.js";

/** Max wrong-code tries before the OTP request is burned. A 6-digit code has
 *  1e6 entropy; without a per-request attempt cap (only an IP rate-limit) it is
 *  brute-forceable inside the 5-min window. Mirrors the TOTP/recovery lockout. */
const MAX_OTP_ATTEMPTS = 5;

interface StoredOtp {
  id: string;
  requestId: string;
  userId: number;
  phoneE164: string;
  codeHash: string;
  deliveryMode: string;
  deliveryId: string | null;
  previewCode: string | null;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
  /** Failed verification attempts; the request is invalidated at the cap. */
  attempts?: number;
}

const store = makeKvStore<StoredOtp>({ module: "auth", collection: "otp" });

function fromStored(d: StoredOtp): OtpRequest {
  return {
    requestId: d.requestId,
    userId: d.userId,
    phoneE164: d.phoneE164,
    codeHash: d.codeHash,
    deliveryMode: d.deliveryMode,
    deliveryId: d.deliveryId,
    previewCode: d.previewCode,
    createdAt: new Date(d.createdAt),
    expiresAt: new Date(d.expiresAt),
    consumedAt: d.consumedAt ? new Date(d.consumedAt) : null,
  } as unknown as OtpRequest;
}

export const otpRepository = {
  async findById(requestId: string, executor?: Executor | null): Promise<OtpRequest | undefined> {
    const doc = await store(executor).get(requestId);
    return doc ? fromStored(doc as unknown as StoredOtp) : undefined;
  },

  async create(data: NewOtpRequest, executor?: Executor | null): Promise<OtpRequest> {
    const created = await store(executor).create({
      id: data.requestId,
      requestId: data.requestId,
      userId: data.userId,
      phoneE164: data.phoneE164,
      codeHash: data.codeHash,
      deliveryMode: data.deliveryMode,
      deliveryId: data.deliveryId ?? null,
      previewCode: data.previewCode ?? null,
      createdAt: data.createdAt instanceof Date ? data.createdAt.toISOString() : new Date().toISOString(),
      expiresAt: data.expiresAt instanceof Date ? data.expiresAt.toISOString() : String(data.expiresAt),
      consumedAt: null,
      attempts: 0,
    });
    return fromStored(created as unknown as StoredOtp);
  },

  async consume(requestId: string, codeHash: string, executor?: Executor | null): Promise<OtpRequest | undefined> {
    const doc = await store(executor).get(requestId);
    if (!doc) return undefined;
    const stored = doc as unknown as StoredOtp;
    // Already used, or already burned by hitting the attempt cap.
    if (stored.consumedAt) return undefined;
    if ((stored.attempts ?? 0) >= MAX_OTP_ATTEMPTS) return undefined;

    if (stored.codeHash !== codeHash) {
      // Wrong code: count the attempt and burn the request once the cap is hit
      // (sets consumedAt so a later correct guess is rejected too).
      const next = (stored.attempts ?? 0) + 1;
      const patch: Partial<StoredOtp> =
        next >= MAX_OTP_ATTEMPTS
          ? { attempts: next, consumedAt: new Date().toISOString() }
          : { attempts: next };
      await store(executor).update(requestId, patch);
      return undefined;
    }

    const consumedAt = new Date().toISOString();
    await store(executor).update(requestId, { consumedAt });
    return fromStored({ ...stored, consumedAt });
  },
};
