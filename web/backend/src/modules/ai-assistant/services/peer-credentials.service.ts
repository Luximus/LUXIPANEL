// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Inbound peer credentials for panel-to-panel MCP (this box = "panel B").
 *
 * Another LUXIPANEL ("panel A") that manages THIS box over SSH can pair with it:
 * A generates a secret `lxp_peer_…`, provisions it here over SSH, and later
 * presents it as `Authorization: Bearer lxp_peer_…` on `POST /api/ai/mcp/peer`
 * to run peer.* tools on THIS box (under this box's audit; the interactive
 * confirmation happened on A, which gates servers.exec as an action).
 *
 * Security model: we store ONLY the SHA-256 hash of each credential — the
 * plaintext lives on panel A (encrypted in its own vault). B can validate a
 * presented secret but can never reproduce or leak it. The sidecar is instance
 * state on the panel host, so it is bound to `localExecutor`.
 *
 * Kill-switches:
 *  - `PANEL_PEER_MCP_ENABLED=false` (default) — the whole transport is off
 *    (checked by the middleware before this service is consulted).
 *  - No stored hashes AND empty `PANEL_PEER_CREDENTIAL` env → every bearer is
 *    rejected (there is nothing to match).
 */

import { timingSafeEqual } from "node:crypto";
import { randomUUID } from "node:crypto";
import { sha256 } from "../../../shared/utils/crypto.js";
import { kv } from "../../../shared/kv-store/index.js";
import { localExecutor } from "../../../shared/executor/index.js";
import { env } from "../../../config/env.js";
import { createModuleLogger } from "../../../shared/logger/index.js";

const log = createModuleLogger("peer-credentials");

const MODULE = "assistant";
const COLLECTION = "peer-credentials";

export const PEER_CREDENTIAL_PREFIX = "lxp_peer_";

interface PeerCredentialRecord {
  id?: string;
  /** SHA-256 hex of the plaintext credential (the plaintext is never stored). */
  hashHex: string;
  /** Who provisioned it (the pairing panel's label / host), for the operator. */
  label?: string;
  createdAt?: string;
}

function store() {
  return kv(localExecutor).module(MODULE).collection<PeerCredentialRecord>(COLLECTION);
}

/** Constant-time compare of two equal-length hex digests. */
function hexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

export const peerCredentialsService = {
  /** Provision (idempotently) a new inbound peer credential from its plaintext.
   *  Returns the record id. Stores only the hash. */
  async add(plain: string, label?: string): Promise<string> {
    const hashHex = sha256(plain);
    const existing = await store().find((r) => r.hashHex === hashHex);
    if (existing?.id) return existing.id;
    const id = randomUUID();
    await store().set(id, { hashHex, label: label?.slice(0, 200), createdAt: new Date().toISOString() });
    log.info({ id, label }, "Inbound peer credential provisioned");
    return id;
  },

  /** Remove a stored credential by id (revocation). */
  async remove(id: string): Promise<boolean> {
    return store().delete(id);
  },

  /** Metadata only (never the hash) for an operator listing. */
  async list(): Promise<Array<{ id: string; label?: string; createdAt?: string }>> {
    const all = await store().list();
    return all.map((r) => ({ id: String(r.id), ...(r.label ? { label: r.label } : {}), ...(r.createdAt ? { createdAt: r.createdAt } : {}) }));
  },

  /**
   * Verify a presented `lxp_peer_…` bearer against the stored hashes AND the
   * `PANEL_PEER_CREDENTIAL` env override (which lets an operator hard-wire one
   * without the SSH pairing flow). Constant-time. Returns true iff it matches
   * an active credential.
   */
  async verify(bearer: string): Promise<boolean> {
    if (!bearer.startsWith(PEER_CREDENTIAL_PREFIX)) return false;
    const presentedHash = sha256(bearer);
    // Env override (optional manual escape hatch).
    const envCred = env.PANEL_PEER_CREDENTIAL;
    if (envCred && hexEqual(presentedHash, sha256(envCred))) return true;
    const all = await store().list().catch(() => []);
    for (const r of all) {
      if (typeof r.hashHex === "string" && r.hashHex.length === presentedHash.length && hexEqual(r.hashHex, presentedHash)) {
        return true;
      }
    }
    return false;
  },
};
