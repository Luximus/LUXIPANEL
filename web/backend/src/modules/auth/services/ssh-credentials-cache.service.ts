// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * SSH credentials cache — stores per-bridge-session SSH connection material
 * (private key + passphrase + host/port/user) for DirectSshExecutor.
 *
 * Material is encrypted with the panel JWT secret before being persisted to
 * Redis so an attacker with raw Redis access cannot extract usable keys
 * without the env. TTL is bound to the JWT TTL.
 */

import { aesGcmDecrypt, aesGcmEncrypt, aesKeyFromSha256 } from "../../../shared/utils/aes-gcm.js";
import { authConfig } from "../../../config/auth.js";
import { getRedis } from "../../../shared/redis/index.js";

export interface SshConnectionMaterial {
  host: string;
  port: number;
  username: string;
  privateKeyPem: string;
  passphrase: string;
  /**
   * Password for password-based SSH auth. When set AND `privateKeyPem` is
   * empty, the executor authenticates with this password instead of a key.
   * Used by the assistant's locally-registered servers (Servers tab). Also
   * serves as the `sudo -S` password when no passphrase is present.
   */
  password?: string;
  fingerprint: string | null;
  /**
   * TOFU host-key pin (sha256 hex). When set, DirectSshExecutor installs a
   * `hostVerifier` and FAILS CLOSED if the server's host key doesn't match.
   * Opt-in: the standalone target vault (modules/servers) sets it from the
   * approved fingerprint; the managed flow leaves it absent (current behavior,
   * no host-key pinning) so nothing about managed connections changes.
   */
  expectedHostFingerprint?: string | null;
  /**
   * Login-link subdomain that identifies the panel in LP. Used to attribute
   * this session's measured SSH bytes when reporting usage to LP. Optional for
   * back-compat with material cached before metering existed (those sessions
   * simply aren't reported).
   */
  accessSubdomain?: string | null;
  /**
   * Per-tab isolation metadata (Option B). Optional for back-compat with
   * material cached before per-tab bridge isolation existed.
   *
   * `userId` — the panel/account user id that owns this direct session (the
   * `user.id` / `account.id` minted into the JWT). `customerKey` — a stable
   * panel-scoped owner key for ownership validation; today it is the
   * login-link subdomain (see {@link accessSubdomain}) because LP does not
   * expose a stable customer id at the SSH-key lookup. `targetId`/`targetName`
   * mirror the bridge/JWT values so `resolveOverrideBridge` can hydrate a
   * per-tab override without re-deriving them.
   */
  userId?: number;
  customerKey?: string | null;
  targetId?: string;
  targetName?: string;
  /**
   * Service-key privilege-drop target. When present, this material is a
   * per-VPS SERVICE key (sudo-capable) and the panel must NOT operate as the
   * service user directly: every executor op is re-issued as `sudo -u <owner>`
   * (privilege drop to the hosting account's primary Linux user). The factory
   * wraps the executor in a {@link PrivilegeDropExecutor} when `owner` is set.
   * Hosting-account login path only; absent for normal direct-SSH sessions.
   */
  owner?: string;
  /** HOME root of `owner` (defaults to `/home/<owner>` when omitted). */
  homeRoot?: string;
  /**
   * Track 2 — when true (and env.JAIL_SHELL_ENABLED), the INTERACTIVE shell of
   * this privilege-dropped session is jailed (jk_chrootsh login shell). Track 1
   * panel ops are never affected. Absent ⇒ normal owner shell. Hosting login
   * path only.
   */
  jailEnabled?: boolean;
  /**
   * Tenant Linux group of `owner` (the `h-<user>` group). Carried for jail
   * tooling/audit; the executor itself doesn't need it but it keeps the cached
   * material self-describing for the privilege-drop layer.
   */
  tenantGroup?: string;
}

const PREFIX = "lp:ssh-creds:";

/**
 * At-rest envelope: `iv:authTag:ciphertext`, all hex, 12-byte GCM nonce, key =
 * `sha256("ssh-creds:" + JWT_SECRET)`. The CYCLE comes from the shared
 * `shared/utils/aes-gcm` primitive (T-02); the envelope stays here so entries
 * written by older builds keep decrypting byte-for-byte.
 */
function masterKey(): Buffer {
  return aesKeyFromSha256(`ssh-creds:${authConfig.jwt.secret}`);
}

function encrypt(plain: string): string {
  const { iv, ciphertext, authTag } = aesGcmEncrypt(plain, masterKey());
  return [iv.toString("hex"), authTag.toString("hex"), ciphertext.toString("hex")].join(":");
}

function decrypt(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) throw new Error("Invalid SSH-creds payload");
  return aesGcmDecrypt(
    {
      iv: Buffer.from(ivHex, "hex"),
      authTag: Buffer.from(tagHex, "hex"),
      ciphertext: Buffer.from(dataHex, "hex"),
    },
    masterKey(),
  ).toString("utf8");
}

export const sshCredentialsCache = {
  async put(bridgeSessionId: string, mat: SshConnectionMaterial, ttlSeconds: number): Promise<void> {
    const redis = getRedis();
    const blob = encrypt(JSON.stringify(mat));
    await redis.set(`${PREFIX}${bridgeSessionId}`, blob, "EX", Math.max(60, ttlSeconds));
  },

  async get(bridgeSessionId: string): Promise<SshConnectionMaterial | null> {
    const redis = getRedis();
    const blob = await redis.get(`${PREFIX}${bridgeSessionId}`);
    if (!blob) return null;
    try {
      return JSON.parse(decrypt(blob)) as SshConnectionMaterial;
    } catch {
      return null;
    }
  },

  async delete(bridgeSessionId: string): Promise<void> {
    const redis = getRedis();
    await redis.del(`${PREFIX}${bridgeSessionId}`);
  },
};
