// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * MCP Secret Manager — Encrypt/decrypt sensitive credentials
 *
 * Uses AES-256-GCM for authenticated encryption.
 * Master key is derived from ENCRYPTION_KEY env var using PBKDF2.
 */

import { randomBytes, scrypt, type ScryptOptions } from "crypto";
import { env } from "../../../config/env.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { aesGcmDecrypt, aesGcmEncrypt } from "../../../shared/utils/aes-gcm.js";

// Promise wrapper around the callback `scrypt` (the promisified form's typings
// drop the `options` overload). Runs on the libuv threadpool → non-blocking.
function scryptAsync(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

const log = createModuleLogger("mcp-secrets");

// Constants
// NOTE: 16 bytes is NOT the GCM standard (12 is), but the at-rest payload
// `[salt|iv|tag|ct]` is parsed by fixed offsets — changing it would make every
// stored secret undecryptable. Kept, and passed explicitly to `aesGcmEncrypt`.
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;

// scrypt KDF params. Kept EXACTLY as before — changing any of these would make
// every stored secret (whose salt is embedded in the payload) undecryptable.
const SCRYPT_N = 16384;
const SCRYPT_r = 8;
const SCRYPT_p = 1;
const SCRYPT_KEYLEN = 32;

/**
 * Derive a 256-bit key from master key + salt using scrypt.
 *
 * Async (libuv threadpool) so the KDF — deliberately CPU-heavy (N=16384) —
 * does NOT block the event loop. Params are identical to the previous
 * `scryptSync` call, so keys derived before/after this change are byte-for-byte
 * the same (existing ciphertexts still decrypt).
 */
async function deriveKey(masterKey: string, salt: Buffer): Promise<Buffer> {
  return scryptAsync(masterKey, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_r, p: SCRYPT_p });
}

export const secretManagerService = {
  /**
   * Encrypt plaintext using AES-256-GCM
   * Returns: { ciphertext, iv, authTag, salt, keyId }
   */
  async encrypt(plaintext: string): Promise<{
    encrypted: Buffer;
    keyId: string;
  }> {
    // Length (≥32) is enforced by the env schema when present; guard only for
    // the optional-absent case (dev/test boxes that never provisioned MCP secrets).
    const masterKey = env.ENCRYPTION_KEY;
    if (!masterKey) {
      throw new Error("ENCRYPTION_KEY env var must be set and at least 32 chars");
    }

    // Generate random salt; the IV is minted by the shared AES-GCM helper.
    const salt = randomBytes(SALT_LENGTH);

    // Derive key from master + salt
    const key = await deriveKey(masterKey, salt);

    const { iv, ciphertext, authTag } = aesGcmEncrypt(plaintext, key, { ivLength: IV_LENGTH });

    // Package: [salt | iv | authTag | ciphertext]
    const encrypted = Buffer.concat([salt, iv, authTag, ciphertext]);

    return {
      encrypted,
      keyId: "v1", // Version identifier for future key rotation
    };
  },

  /**
   * Decrypt encrypted payload using AES-256-GCM
   * Expects: encrypted buffer containing [salt | iv | authTag | ciphertext]
   */
  async decrypt(encrypted: Buffer, keyId: string): Promise<string> {
    const masterKey = env.ENCRYPTION_KEY;
    if (!masterKey) {
      throw new Error("ENCRYPTION_KEY env var not set");
    }

    try {
      // Unpack buffer
      let offset = 0;
      const salt = encrypted.subarray(offset, (offset += SALT_LENGTH));
      const iv = encrypted.subarray(offset, (offset += IV_LENGTH));
      const authTag = encrypted.subarray(offset, (offset += AUTH_TAG_LENGTH));
      const ciphertext = encrypted.subarray(offset);

      // Derive same key
      const key = await deriveKey(masterKey, salt);

      // Decrypt (throws on auth-tag mismatch — never returns junk)
      return aesGcmDecrypt({ iv, authTag, ciphertext }, key).toString("utf8");
    } catch (err) {
      log.error({ err, keyId }, "Decryption failed");
      throw new Error(`Failed to decrypt secret (keyId=${keyId})`);
    }
  },

  /**
   * Mask secrets in a config object for logging/display.
   *
   * Matches by case-insensitive SUBSTRING (so `apiKey`, `accessToken`,
   * `clientSecret`, `X-Api-Key` are all caught, not just the exact names
   * `password`/`token`/`key`/`secret`) and recurses into nested objects/arrays
   * up to a bounded depth, since MCP `callTool` args are frequently nested. This
   * is the last defense on tool arguments before the audit log.
   */
  maskSecrets(
    config: Record<string, any>,
    sensitiveFields: string[] = ["password", "token", "key", "secret", "credential", "auth"],
  ): Record<string, any> {
    const needles = sensitiveFields.map((f) => f.toLowerCase());
    const isSensitive = (name: string): boolean => {
      const lower = name.toLowerCase();
      return needles.some((n) => lower.includes(n));
    };
    const MAX_DEPTH = 6;
    const walk = (value: unknown, depth: number): unknown => {
      if (depth > MAX_DEPTH || value === null || typeof value !== "object") return value;
      if (Array.isArray(value)) return value.map((v) => walk(v, depth + 1));
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (isSensitive(k) && typeof v === "string" && v.length > 0) out[k] = "***";
        else out[k] = walk(v, depth + 1);
      }
      return out;
    };
    return walk(config, 0) as Record<string, any>;
  },
};
