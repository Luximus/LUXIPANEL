// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Tolqia API token — the credential that joins THIS server to a tolqia.com
 * account (plan Plus/Premium).
 *
 * PER-SERVIDOR like everything else in this module: the record lives in
 * `${LUXIPANEL_CONFIG_DIR}/chat/tolqia-credential.json` on the bridged server
 * (`kv` writes it `0600`), so two panels bridged to two boxes never share a
 * Tolqia account.
 *
 * AT-REST ENCRYPTION mirrors `modules/servers/services/servers-vault-crypto.ts`
 * (AES-256-GCM, key derived with HKDF-SHA256 from `CREDENTIAL_VAULT_KEY`, or
 * from the panel JWT secret as the dev/back-compat fallback). The payload is
 * `v2:<iv>:<tag>:<ct>`; the `v2:` prefix leaves room for a re-key without a
 * data migration, and a legacy plaintext value (none is written by this file)
 * is still readable so a hand-edited sidecar degrades instead of exploding.
 *
 * The plaintext token NEVER leaves the backend: every HTTP-facing read goes
 * through `redact()` (presence + a 12-char prefix), and the token is never
 * logged, not even truncated.
 */

import { env } from "../../../config/env.js";
import { authConfig } from "../../../config/auth.js";
import { kv } from "../../../shared/kv-store/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import {
  AES_GCM_IV_BYTES,
  aesGcmDecrypt,
  aesGcmEncrypt,
  aesKeyFromHkdfSha256,
  aesKeyFromSha256,
} from "../../../shared/utils/aes-gcm.js";

const log = createModuleLogger("chat-tolqia-credential");

const MODULE = "chat";
/** → `chat/tolqia-credential.json` on the connected server. */
const COLLECTION = "tolqia-credential";
/** Single-row collection: one Tolqia account per server. */
const DOC_ID = "token";

const HKDF_SALT = Buffer.from("LUXIPANEL:chat-tolqia:at-rest:v2", "utf8");
const HKDF_INFO = Buffer.from("v2:tolqia-token", "utf8");

/** Wire format of the token Tolqia mints: `tq_live_` + 40 base62 chars. */
export const TOLQIA_TOKEN_RE = /^tq_live_[A-Za-z0-9]{40}$/;

/** How much of the token the UI is allowed to see (`tq_live_abcd`). */
const PREVIEW_CHARS = 12;

/** The record as it sits in the sidecar. `token` is the `v2:` payload. */
export interface TolqiaCredentialRecord {
  token: string;
  /** Panel username that saved it — useful in an audit, never a secret. */
  savedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** What HTTP is allowed to know about the stored token. */
export interface TolqiaCredentialPublic {
  tokenSet: boolean;
  tokenPreview: string;
  updatedAt?: string;
}

// ── crypto ──────────────────────────────────────────────────────────────────

let masterKey: Buffer | null = null;

function key(): Buffer {
  if (masterKey) return masterKey;
  const explicit = (env.CREDENTIAL_VAULT_KEY ?? "").trim();
  const ikm = /^[0-9a-fA-F]{64}$/.test(explicit)
    ? Buffer.from(explicit, "hex")
    : aesKeyFromSha256(`chat-tolqia:${authConfig.jwt.secret}`);
  masterKey = aesKeyFromHkdfSha256(ikm, HKDF_SALT, HKDF_INFO);
  return masterKey;
}

function encrypt(plaintext: string): string {
  const { iv, ciphertext, authTag } = aesGcmEncrypt(plaintext, key(), {
    ivLength: AES_GCM_IV_BYTES,
  });
  return `v2:${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

/**
 * Decrypt a stored value. A value that is not a `v2:` payload is returned as-is
 * (a hand-written sidecar), and a payload that fails to decrypt — the usual
 * cause is a rotated `JWT_SECRET` with no `CREDENTIAL_VAULT_KEY` — returns null
 * so the panel behaves as "no token configured" instead of erroring on every
 * call. The admin simply pastes the token again.
 */
function decrypt(stored: string): string | null {
  if (!stored) return null;
  if (!stored.startsWith("v2:")) return stored;
  const [ivHex, tagHex, dataHex] = stored.slice(3).split(":");
  if (!ivHex || !tagHex || !dataHex) return null;
  try {
    return aesGcmDecrypt(
      {
        iv: Buffer.from(ivHex, "hex"),
        authTag: Buffer.from(tagHex, "hex"),
        ciphertext: Buffer.from(dataHex, "hex"),
      },
      key(),
    ).toString("utf8");
  } catch {
    log.warn(
      "tolqia credential could not be decrypted (vault key changed?) — treating the server as unlinked",
    );
    return null;
  }
}

// ── store ───────────────────────────────────────────────────────────────────

function store(executor: Executor) {
  return kv(executor).module(MODULE).collection<TolqiaCredentialRecord>(COLLECTION);
}

/** `tq_live_abcd` — the only part of the token that may reach a browser. */
export function previewOf(token: string): string {
  return token ? token.slice(0, PREVIEW_CHARS) : "";
}

export const tolqiaCredentialRepository = {
  /**
   * The DECRYPTED token, or null when this server is not linked. Never throws:
   * a missing/unreadable sidecar means "not linked", which is the behaviour
   * every caller wants (calls fall back to the S2S secret).
   */
  async token(executor: Executor): Promise<string | null> {
    try {
      const row = await store(executor).get(DOC_ID);
      if (!row?.token) return null;
      return decrypt(row.token);
    } catch (err) {
      log.warn({ err: (err as Error).message }, "tolqia credential read failed");
      return null;
    }
  },

  /** Presence + preview for the credentials card. Never throws. */
  async redacted(executor: Executor): Promise<TolqiaCredentialPublic> {
    try {
      const row = await store(executor).get(DOC_ID);
      const token = row?.token ? decrypt(row.token) : null;
      if (!token) return { tokenSet: false, tokenPreview: "" };
      return {
        tokenSet: true,
        tokenPreview: previewOf(token),
        ...(row?.updatedAt ? { updatedAt: row.updatedAt } : {}),
      };
    } catch (err) {
      log.warn({ err: (err as Error).message }, "tolqia credential read failed");
      return { tokenSet: false, tokenPreview: "" };
    }
  },

  /** Store (encrypted) a validated token. Overwrites any previous one. */
  async save(executor: Executor, token: string, savedBy?: string): Promise<TolqiaCredentialPublic> {
    const now = new Date().toISOString();
    const existing = await store(executor).get(DOC_ID).catch(() => null);
    await store(executor).set(DOC_ID, {
      token: encrypt(token),
      ...(savedBy ? { savedBy } : {}),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    return { tokenSet: true, tokenPreview: previewOf(token), updatedAt: now };
  },

  /** Unlink the server. Idempotent. */
  async clear(executor: Executor): Promise<TolqiaCredentialPublic> {
    try {
      await store(executor).delete(DOC_ID);
    } catch (err) {
      log.warn({ err: (err as Error).message }, "tolqia credential delete failed");
    }
    return { tokenSet: false, tokenPreview: "" };
  },
};
