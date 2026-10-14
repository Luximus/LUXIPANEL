// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Local SSH target vault repository.
 *
 * ALWAYS bound to `localExecutor`: the target registry is control-plane state
 * of the box this panel runs on (which servers it may reach), not per-managed-
 * server data. Sidecar: `${LUXIPANEL_CONFIG_DIR}/servers/targets.json` (0600,
 * enforced by the kv-store invariant). Secret fields are additionally encrypted
 * at rest via servers-vault-crypto (AES-256-GCM + HKDF).
 *
 * `listView()`/`toView()` NEVER return secret material — presence flags only.
 * Decrypted material is exposed solely via `getMaterial()` for the executor.
 */

import { dataStore } from "../../../shared/data-store/index.js";
import { localExecutor } from "../../../shared/executor/index.js";
import type { SshConnectionMaterial } from "../../auth/services/ssh-credentials-cache.service.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { encryptSecret, decryptSecret } from "../services/servers-vault-crypto.js";
import type {
  TargetRecord,
  TargetView,
  TargetStatus,
  CreateTargetInput,
  UpdateTargetInput,
} from "../models/index.js";
import { DEFAULT_SSH_PORT } from "../models/index.js";

const log = createModuleLogger("targets-repository");

const MODULE = "servers";
const COLLECTION = "targets";

/** Vault store — pinned to the panel host (localExecutor). */
function store() {
  return dataStore<TargetRecord>(localExecutor, MODULE, COLLECTION, { idStrategy: "uuid" });
}

function toView(s: TargetRecord): TargetView {
  return {
    id: String(s.id),
    name: s.name,
    host: s.host,
    port: s.port,
    username: s.username,
    authType: s.authType,
    hasPassphrase: Boolean(s.passphraseEnc),
    hostFingerprint: s.hostFingerprint ?? null,
    hostFingerprintPending: s.hostFingerprintPending ?? null,
    enabled: s.enabled !== false,
    lastStatus: s.lastStatus ?? "unknown",
    lastError: s.lastError ?? null,
    lastSeenAt: s.lastSeenAt ?? null,
    allowedUserIds: Array.isArray(s.allowedUserIds) ? s.allowedUserIds : [],
    ownerId: s.ownerId ?? null,
    // Absent ⇒ global (legacy records predate per-user targets).
    visibility: s.visibility === "private" ? "private" : "global",
    hasLuxipanel: s.hasLuxipanel === true,
    luxipanelBaseUrl: s.luxipanelBaseUrl ?? null,
    hasPeerCredential: Boolean(s.peerCredentialEnc),
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

export const targetsRepository = {
  /** UI list — no secrets. */
  async listView(): Promise<TargetView[]> {
    const all = await store().list();
    return [...all].sort((a, b) => (a.name || "").localeCompare(b.name || "")).map(toView);
  },

  async get(id: string): Promise<(TargetRecord & { id: string }) | null> {
    return store().get(id) as Promise<(TargetRecord & { id: string }) | null>;
  },

  async getView(id: string): Promise<TargetView | null> {
    const rec = await targetsRepository.get(id);
    return rec ? toView(rec) : null;
  },

  async create(
    input: CreateTargetInput & { ownerId?: number | null; visibility?: TargetRecord["visibility"] },
  ): Promise<TargetView> {
    const rec = await store().create({
      name: input.name.slice(0, 120) || "Servidor",
      host: input.host.slice(0, 255),
      port: Number.isFinite(input.port) ? Number(input.port) : DEFAULT_SSH_PORT,
      username: input.username.slice(0, 64),
      authType: input.authType === "password" ? "password" : "key",
      secretEnc: encryptSecret(input.secret),
      passphraseEnc: input.passphrase ? encryptSecret(input.passphrase) : null,
      hostFingerprint: null,
      hostFingerprintPending: null,
      enabled: input.enabled !== false,
      lastStatus: "unknown",
      lastError: null,
      lastSeenAt: null,
      allowedUserIds: input.allowedUserIds ?? [],
      ownerId: input.ownerId ?? null,
      visibility: input.visibility === "private" ? "private" : "global",
      hasLuxipanel: input.hasLuxipanel === true,
      luxipanelBaseUrl: input.luxipanelBaseUrl ?? null,
      peerCredentialEnc: null,
    });
    return toView(rec);
  },

  async update(id: string, patch: UpdateTargetInput): Promise<TargetView | null> {
    const clean: Partial<TargetRecord> = {};
    if (patch.name !== undefined) clean.name = patch.name.slice(0, 120);
    if (patch.host !== undefined) clean.host = patch.host.slice(0, 255);
    if (patch.port !== undefined) clean.port = Number.isFinite(patch.port) ? Number(patch.port) : DEFAULT_SSH_PORT;
    if (patch.username !== undefined) clean.username = patch.username.slice(0, 64);
    if (patch.authType !== undefined) clean.authType = patch.authType === "password" ? "password" : "key";
    if (patch.enabled !== undefined) clean.enabled = patch.enabled;
    if (patch.allowedUserIds !== undefined) clean.allowedUserIds = patch.allowedUserIds;
    if (patch.hasLuxipanel !== undefined) clean.hasLuxipanel = patch.hasLuxipanel;
    if (patch.luxipanelBaseUrl !== undefined) clean.luxipanelBaseUrl = patch.luxipanelBaseUrl;
    // Secrets: only re-encrypt when a non-empty new value is provided (so an
    // edit that doesn't touch the secret keeps the stored one).
    if (patch.secret) clean.secretEnc = encryptSecret(patch.secret);
    if (patch.passphrase !== undefined) {
      clean.passphraseEnc = patch.passphrase ? encryptSecret(patch.passphrase) : null;
    }
    // Changing the host invalidates the pinned fingerprint (TOFU re-run needed).
    if (patch.host !== undefined) {
      clean.hostFingerprint = null;
      clean.hostFingerprintPending = null;
      clean.lastStatus = "unknown";
    }
    const rec = await store().update(id, clean);
    return rec ? toView(rec) : null;
  },

  async delete(id: string): Promise<boolean> {
    return store().delete(id);
  },

  /** Store (encrypted) or clear the panel-to-panel peer credential for a target.
   *  Pass null to clear. Encrypted with the same vault key as the SSH secrets. */
  async setPeerCredential(id: string, plain: string | null): Promise<boolean> {
    const rec = await store().update(id, {
      peerCredentialEnc: plain ? encryptSecret(plain) : null,
    });
    return !!rec;
  },

  /** Decrypt the peer credential, or null if unset. THROWS on decrypt failure
   *  (vault key changed) — same fail-loud contract as getMaterial. */
  async getPeerCredential(id: string): Promise<string | null> {
    const rec = await targetsRepository.get(id);
    if (!rec?.peerCredentialEnc) return null;
    return decryptSecret(rec.peerCredentialEnc);
  },

  /** Record a captured-but-unapproved fingerprint (first contact / key change). */
  async setPendingFingerprint(id: string, fingerprint: string): Promise<TargetView | null> {
    const rec = await store().update(id, {
      hostFingerprintPending: fingerprint,
      lastStatus: "fingerprint_pending" as TargetStatus,
      lastError: "Host fingerprint awaiting approval",
    });
    return rec ? toView(rec) : null;
  },

  /** Promote pending → pinned fingerprint. Returns null if nothing pending. */
  async approveFingerprint(id: string): Promise<TargetView | null> {
    const rec = await targetsRepository.get(id);
    if (!rec) return null;
    if (!rec.hostFingerprintPending) return null;
    const updated = await store().update(id, {
      hostFingerprint: rec.hostFingerprintPending,
      hostFingerprintPending: null,
      lastStatus: "unknown" as TargetStatus,
      lastError: null,
    });
    return updated ? toView(updated) : null;
  },

  /** Update the connectivity status after a `test`. */
  async markStatus(
    id: string,
    status: TargetStatus,
    opts: { error?: string | null; seen?: boolean } = {},
  ): Promise<void> {
    await store().update(id, {
      lastStatus: status,
      lastError: opts.error ?? null,
      ...(opts.seen ? { lastSeenAt: new Date().toISOString() } : {}),
    });
  },

  /**
   * Decrypt a target into SSH connection material for the executor. Returns
   * null if not found. THROWS if a secret can't be decrypted (key mismatch)
   * rather than silently connecting wrong. `expectedHostFingerprint` is set
   * from the pinned fingerprint so DirectSshExecutor pins the host key.
   */
  async getMaterial(id: string): Promise<{ target: TargetRecord; material: SshConnectionMaterial } | null> {
    const s = await targetsRepository.get(id);
    if (!s) return null;
    let secret = "";
    let passphrase = "";
    try {
      secret = decryptSecret(s.secretEnc);
      passphrase = s.passphraseEnc ? decryptSecret(s.passphraseEnc) : "";
    } catch (err) {
      log.error({ err, id }, "Failed to decrypt target secret");
      throw new Error("No se pudo descifrar la credencial del servidor (clave de bóveda cambiada?).");
    }
    const expectedHostFingerprint = s.hostFingerprint || null;
    const material: SshConnectionMaterial =
      s.authType === "password"
        ? {
            host: s.host,
            port: s.port,
            username: s.username,
            privateKeyPem: "",
            passphrase: "",
            password: secret,
            fingerprint: expectedHostFingerprint,
            expectedHostFingerprint,
            targetId: String(s.id),
            targetName: s.name,
          }
        : {
            host: s.host,
            port: s.port,
            username: s.username,
            privateKeyPem: secret,
            passphrase,
            fingerprint: expectedHostFingerprint,
            expectedHostFingerprint,
            targetId: String(s.id),
            targetName: s.name,
          };
    return { target: s, material };
  },
};
