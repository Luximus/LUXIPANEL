// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AES-256-GCM — the ONE authenticated-encryption primitive of the backend.
 *
 * Before this module there were four independent `createCipheriv("aes-256-gcm")`
 * cycles (sudo-credentials, servers vault, mcp secret-manager, ssh-credentials
 * cache) each with its own key derivation, IV length and payload layout — one
 * of them with a non-standard 16-byte IV. This file factors out the CYCLE
 * (`randomBytes(iv) → cipher → getAuthTag()` / `decipher.setAuthTag() → final`)
 * and the usual key derivations, WITHOUT owning the serialized at-rest format:
 * every consumer keeps encoding/decoding its own envelope so already-encrypted
 * data keeps decrypting byte-for-byte.
 *
 * Usage guide for consumers (`shared/` and `modules/` alike):
 *
 *   // 1. raw parts — you serialize them however your sidecar already does
 *   const { iv, ciphertext, authTag } = aesGcmEncrypt(plain, key);
 *   const plain = aesGcmDecrypt({ iv, ciphertext, authTag }, key).toString("utf-8");
 *
 *   // 2. three encoded fields (sudo-credentials style: base64 nonce/ct/tag)
 *   const fields = aesGcmEncryptFields(plain, key);              // base64
 *   const plain  = aesGcmDecryptFields(fields, key);
 *
 *   // 3. key derivation (pick the one your format already used — do NOT switch)
 *   aesKeyFromSha256(`${secret}:my-context`)          // sha256 of a string
 *   aesKeyFromHkdfSha256(secretBytes, salt, info)     // HKDF-SHA256
 *   aesKeyFromScrypt(password, salt)                  // scrypt
 *
 * IV length: GCM's standard is 12 bytes and that is the default here. Pass
 * `ivLength` ONLY to stay compatible with an existing non-standard format.
 */

import crypto from "node:crypto";

/** The one algorithm identifier — never re-declare `"aes-256-gcm"` elsewhere. */
export const AES_GCM_ALGO = "aes-256-gcm" as const;

/** NIST-recommended GCM nonce size. */
export const AES_GCM_IV_BYTES = 12;

/** Key size for AES-256. */
export const AES_KEY_BYTES = 32;

/** The three pieces every AES-GCM envelope has to carry, unencoded. */
export interface AesGcmParts {
  iv: Buffer;
  ciphertext: Buffer;
  authTag: Buffer;
}

export interface AesGcmEncryptOptions {
  /** Nonce length in bytes. Default 12 (GCM standard). */
  ivLength?: number;
  /** Optional additional authenticated data (must match on decrypt). */
  aad?: Buffer;
}

export interface AesGcmDecryptOptions {
  /** Optional additional authenticated data used at encrypt time. */
  aad?: Buffer;
}

/**
 * Encrypt with a fresh random IV. Returns the raw parts; the caller owns the
 * serialization (hex/base64/binary concat) so at-rest formats never change.
 */
export function aesGcmEncrypt(
  plaintext: string | Buffer,
  key: Buffer,
  opts: AesGcmEncryptOptions = {},
): AesGcmParts {
  const iv = crypto.randomBytes(opts.ivLength ?? AES_GCM_IV_BYTES);
  const cipher = crypto.createCipheriv(AES_GCM_ALGO, key, iv);
  if (opts.aad) cipher.setAAD(opts.aad);
  const input = typeof plaintext === "string" ? Buffer.from(plaintext, "utf-8") : plaintext;
  const ciphertext = Buffer.concat([cipher.update(input), cipher.final()]);
  return { iv, ciphertext, authTag: cipher.getAuthTag() };
}

/** Decrypt raw parts. Throws (auth-tag mismatch) on tamper — never returns junk. */
export function aesGcmDecrypt(
  parts: AesGcmParts,
  key: Buffer,
  opts: AesGcmDecryptOptions = {},
): Buffer {
  const decipher = crypto.createDecipheriv(AES_GCM_ALGO, key, parts.iv);
  if (opts.aad) decipher.setAAD(opts.aad);
  decipher.setAuthTag(parts.authTag);
  return Buffer.concat([decipher.update(parts.ciphertext), decipher.final()]);
}

/** The three-field envelope shape (`nonce`/`ciphertext`/`authTag`, encoded). */
export interface AesGcmFields {
  nonce: string;
  ciphertext: string;
  authTag: string;
}

export interface AesGcmFieldsOptions extends AesGcmEncryptOptions {
  /** Encoding of the three fields. Default `"base64"`. */
  encoding?: BufferEncoding;
}

/**
 * Encrypt into three separately-encoded fields — the layout used by the
 * sudo-credential sidecar (`{nonce, ciphertext, authTag}` in base64).
 */
export function aesGcmEncryptFields(
  plaintext: string | Buffer,
  key: Buffer,
  opts: AesGcmFieldsOptions = {},
): AesGcmFields {
  const encoding = opts.encoding ?? "base64";
  const { iv, ciphertext, authTag } = aesGcmEncrypt(plaintext, key, opts);
  return {
    nonce: iv.toString(encoding),
    ciphertext: ciphertext.toString(encoding),
    authTag: authTag.toString(encoding),
  };
}

/** Inverse of {@link aesGcmEncryptFields}. Returns the utf-8 plaintext. */
export function aesGcmDecryptFields(
  fields: AesGcmFields,
  key: Buffer,
  opts: { encoding?: BufferEncoding; aad?: Buffer } = {},
): string {
  const encoding = opts.encoding ?? "base64";
  return aesGcmDecrypt(
    {
      iv: Buffer.from(fields.nonce, encoding),
      ciphertext: Buffer.from(fields.ciphertext, encoding),
      authTag: Buffer.from(fields.authTag, encoding),
    },
    key,
    { aad: opts.aad },
  ).toString("utf-8");
}

// ── Key derivations ─────────────────────────────────────────────────────────
// Each consumer MUST keep the derivation its stored data was produced with;
// these helpers exist so the derivation code is not re-typed, not so formats
// can be switched.

/** 256-bit key = `sha256(material)`. */
export function aesKeyFromSha256(material: string | Buffer): Buffer {
  return crypto.createHash("sha256").update(material).digest();
}

/** 256-bit key = HKDF-SHA256(secret, salt, info). */
export function aesKeyFromHkdfSha256(
  secret: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  info: crypto.BinaryLike,
  length = AES_KEY_BYTES,
): Buffer {
  return Buffer.from(crypto.hkdfSync("sha256", secret, salt, info, length));
}

/** 256-bit key = scrypt(password, salt). */
export function aesKeyFromScrypt(
  password: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  length = AES_KEY_BYTES,
): Buffer {
  return crypto.scryptSync(password, salt, length);
}
