// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Cryptographic utilities.
 */

import crypto from "node:crypto";
import { aesGcmDecrypt, aesGcmEncrypt } from "./aes-gcm.js";

/** Generate a cryptographically random hex string. */
export function randomHex(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/** Generate a cryptographically random base64url string. */
export function randomBase64url(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

/** Generate a UUID v4. */
export function uuid(): string {
  return crypto.randomUUID();
}

/** HMAC-SHA256 of a value. */
export function hmacSha256(key: string, value: string): string {
  return crypto.createHmac("sha256", key).update(value).digest("hex");
}

/**
 * AES-256-GCM encrypt.
 * Returns "iv:authTag:ciphertext" in hex.
 */
export function encrypt(plaintext: string, keyHex: string): string {
  const { iv, ciphertext, authTag } = aesGcmEncrypt(plaintext, Buffer.from(keyHex, "hex"));
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

/** AES-256-GCM decrypt. Expects "iv:authTag:ciphertext" in hex. */
export function decrypt(token: string, keyHex: string): string {
  const [ivHex, authTagHex, ciphertextHex] = token.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Invalid encrypted token format");
  }
  return aesGcmDecrypt(
    {
      iv: Buffer.from(ivHex, "hex"),
      ciphertext: Buffer.from(ciphertextHex, "hex"),
      authTag: Buffer.from(authTagHex, "hex"),
    },
    Buffer.from(keyHex, "hex"),
  ).toString("utf8");
}

/** SHA-256 hash (hex). */
export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** Cryptographically secure random integer in [min, max). */
export function randomInt(min: number, max: number): number {
  return crypto.randomInt(min, max);
}

/**
 * Constant-time string comparison. Returns false on length mismatch without
 * leaking timing. Use when comparing tokens/secrets (CSRF, signatures, etc.).
 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
