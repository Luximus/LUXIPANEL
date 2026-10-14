// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Types + validation schemas for the LOCAL SSH target vault (modules/servers).
 *
 * A "target" is a server this standalone panel can SSH into. Records live in
 * a 0600 sidecar (`${LUXIPANEL_CONFIG_DIR}/servers/targets.json`) on the box
 * this panel runs on (control-plane state), with secret fields encrypted at
 * rest (see servers-vault-crypto.ts). The vault is ALWAYS bound to
 * `localExecutor`.
 */

import { z } from "zod";

export type TargetAuthType = "key" | "password";

/** TOFU / connectivity status of the last `test`. */
export type TargetStatus = "unknown" | "ok" | "fingerprint_pending" | "error";

/**
 * Ownership scope of a target.
 *  - `global`  — managed by admins; visible to every control-plane user (subject
 *                to `allowedUserIds`). This is the DEFAULT for legacy records
 *                (written before per-user targets existed), so an absent field
 *                reads as global — those old records had `ownerId` set to the
 *                admin who created them, but were always meant to be shared.
 *  - `private` — owned by a single non-admin user (`ownerId`); only that user
 *                (and admins) may see, use, or manage it.
 */
export type TargetVisibility = "global" | "private";

/** Persisted record (as stored in the sidecar). Secrets are ciphertext. */
export interface TargetRecord {
  id?: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: TargetAuthType;
  /** AES-GCM `v2:` payload: private key PEM (key auth) or password (password auth). */
  secretEnc: string;
  /** AES-GCM `v2:` passphrase for the key (key auth, optional). */
  passphraseEnc?: string | null;
  /** Approved (pinned) host key fingerprint, sha256 hex. Empty until approved. */
  hostFingerprint?: string | null;
  /** Captured-but-not-yet-approved fingerprint (first contact / key change). */
  hostFingerprintPending?: string | null;
  /** When false, `switch` refuses to hand out the material. */
  enabled: boolean;
  lastStatus: TargetStatus;
  lastError?: string | null;
  lastSeenAt?: string | null;
  /** Optional allowlist of panel user ids permitted to switch to this target.
   *  Empty/absent = any authenticated control-plane user. */
  allowedUserIds?: string[];
  ownerId?: number | null;
  /** Ownership scope. Absent ⇒ `global` (legacy records; see TargetVisibility). */
  visibility?: TargetVisibility;
  // --- Panel-to-panel MCP (optional; off unless the target runs LUXIPANEL) ---
  /** True when this target also runs LUXIPANEL, so the AI agent may reach it
   *  over the target's MCP endpoint instead of raw SSH (still SSH-managed). */
  hasLuxipanel?: boolean;
  /** Public base URL of the target's LUXIPANEL (e.g. `https://panel-b.example.com`),
   *  used as the MCP origin. */
  luxipanelBaseUrl?: string | null;
  /** AES-GCM `v2:` peer credential (`lxp_peer_…`) THIS box presents to the
   *  target's `/api/ai/mcp/cross`. Auto-provisioned over SSH by the pairing
   *  flow; never returned in a view. */
  peerCredentialEnc?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** UI-safe projection — NEVER carries secret bytes. */
export interface TargetView {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: TargetAuthType;
  hasPassphrase: boolean;
  hostFingerprint: string | null;
  hostFingerprintPending: string | null;
  enabled: boolean;
  lastStatus: TargetStatus;
  lastError: string | null;
  lastSeenAt: string | null;
  allowedUserIds: string[];
  ownerId: number | null;
  visibility: TargetVisibility;
  hasLuxipanel: boolean;
  luxipanelBaseUrl: string | null;
  /** Presence flag only — the peer credential itself is never exposed. */
  hasPeerCredential: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// ---- Validation ----

/** Default SSH port when a target record omits one. */
export const DEFAULT_SSH_PORT = 22;

export const authTypeSchema = z.enum(["key", "password"]);

export const createTargetSchema = z.object({
  name: z.string().min(1).max(120).trim(),
  host: z.string().min(1).max(255).trim(),
  port: z.coerce.number().int().min(1).max(65535).default(DEFAULT_SSH_PORT),
  username: z.string().min(1).max(64).trim(),
  authType: authTypeSchema,
  /** Plaintext secret: private key PEM (key) or password (password). */
  secret: z.string().min(1).max(65_536),
  /** Plaintext passphrase (key auth, optional). */
  passphrase: z.string().max(1024).nullish(),
  enabled: z.boolean().default(true),
  allowedUserIds: z.array(z.string().max(64)).max(256).optional(),
  /** Mark this target as running LUXIPANEL (enables panel-to-panel MCP). */
  hasLuxipanel: z.boolean().optional(),
  /** Public base URL of the target's LUXIPANEL (MCP origin). */
  luxipanelBaseUrl: z.string().url().max(255).nullish(),
});

export const updateTargetSchema = z
  .object({
    name: z.string().min(1).max(120).trim(),
    host: z.string().min(1).max(255).trim(),
    port: z.coerce.number().int().min(1).max(65535),
    username: z.string().min(1).max(64).trim(),
    authType: authTypeSchema,
    /** New secret (only re-encrypted when a non-empty value is provided). */
    secret: z.string().max(65_536),
    passphrase: z.string().max(1024).nullish(),
    enabled: z.boolean(),
    allowedUserIds: z.array(z.string().max(64)).max(256),
    hasLuxipanel: z.boolean(),
    luxipanelBaseUrl: z.string().url().max(255).nullable(),
  })
  .partial();

export type CreateTargetInput = z.infer<typeof createTargetSchema>;
export type UpdateTargetInput = z.infer<typeof updateTargetSchema>;
