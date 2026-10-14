// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * At-rest encryption for the LOCAL SSH target vault (modules/servers).
 *
 * AES-256-GCM with a key derived via HKDF-SHA256 (mirrors LP-LS'
 * `agents/services/agent-crypto.service.ts`, v2 scheme). The input keying
 * material (IKM) is:
 *
 *   • `CREDENTIAL_VAULT_KEY` (64-hex / 32 bytes) when set — the canonical,
 *     JWT-independent vault key.
 *   • Otherwise a SHA-256 of the panel JWT secret (dev/back-compat). In
 *     production this still works but emits ONE actionable warning at first
 *     use urging an explicit `CREDENTIAL_VAULT_KEY`.
 *
 * Payload format: `v2:<ivHex>:<tagHex>:<ctHex>`. The `v2:` prefix leaves room
 * for a future re-keying without a data migration.
 */

import { env } from "../../../config/env.js";
import { authConfig } from "../../../config/auth.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import {
  AES_GCM_IV_BYTES,
  aesGcmDecrypt,
  aesGcmEncrypt,
  aesKeyFromHkdfSha256,
  aesKeyFromSha256,
} from "../../../shared/utils/aes-gcm.js";

const log = createModuleLogger("servers-vault-crypto");

const HKDF_SALT = Buffer.from("LUXIPANEL:servers-vault:at-rest:v2", "utf8");
const HKDF_INFO = Buffer.from("v2:targets", "utf8");

let warnedFallback = false;

/** 32-byte input keying material. */
function ikm(): Buffer {
  const explicit = (env.CREDENTIAL_VAULT_KEY ?? "").trim();
  if (/^[0-9a-fA-F]{64}$/.test(explicit)) {
    return Buffer.from(explicit, "hex");
  }
  if (env.NODE_ENV === "production" && !warnedFallback) {
    warnedFallback = true;
    log.warn(
      "CREDENTIAL_VAULT_KEY is not set — deriving the SSH target vault key from " +
        "JWT_SECRET. Set CREDENTIAL_VAULT_KEY (64 hex chars) so the vault key is " +
        "decoupled from the JWT secret and survives a JWT rotation.",
    );
  }
  // Derive a stable 32-byte IKM from the JWT secret (same 'derive from panel
  // secret' approach the SSH credentials cache uses).
  return aesKeyFromSha256(`servers-vault:${authConfig.jwt.secret}`);
}

// Memoize the derived master key. It changes only if the process restarts with
// a different CREDENTIAL_VAULT_KEY / JWT_SECRET, which requires a restart anyway.
let masterKey: Buffer | null = null;
function key(): Buffer {
  if (!masterKey) {
    masterKey = aesKeyFromHkdfSha256(ikm(), HKDF_SALT, HKDF_INFO);
  }
  return masterKey;
}

/** AES-256-GCM encrypt → `v2:<iv>:<tag>:<ct>`. */
export function encryptSecret(plaintext: string): string {
  const { iv, ciphertext, authTag } = aesGcmEncrypt(plaintext, key(), {
    ivLength: AES_GCM_IV_BYTES,
  });
  return `v2:${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

/** Decrypt a `v2:` payload. THROWS on tamper / wrong key (never silent). */
export function decryptSecret(payload: string): string {
  if (!payload.startsWith("v2:")) {
    throw new Error("Invalid vault payload (missing v2 prefix)");
  }
  const [ivHex, tagHex, dataHex] = payload.slice(3).split(":");
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error("Invalid vault payload format");
  }
  return aesGcmDecrypt(
    {
      iv: Buffer.from(ivHex, "hex"),
      authTag: Buffer.from(tagHex, "hex"),
      ciphertext: Buffer.from(dataHex, "hex"),
    },
    key(),
  ).toString("utf8");
}
