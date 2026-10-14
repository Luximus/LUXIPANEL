// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Panel-to-panel MCP — pairing (this box = "panel A").
 *
 * SSH is the root of trust: A already manages the target over SSH, so it uses
 * that same connection to provision an inbound peer credential ON the target
 * ("panel B") — no manual token copy. Flow:
 *   1. generate a fresh secret `lxp_peer_…`
 *   2. over SSH, add its SHA-256 hash to B's peer-credentials sidecar
 *      (`<configDir>/assistant/peer-credentials.json`, 0600) — B stores the hash
 *      only; the plaintext never lands on B
 *   3. store the plaintext ENCRYPTED in A's own vault (targetsRepository)
 *   4. optionally verify against B's `/api/ai/mcp/peer` (only succeeds if B has
 *      PANEL_PEER_MCP_ENABLED=true; a failure is not fatal — B may enable later)
 *
 * Rotation = run this again (it appends a new hash; old ones can be revoked on B).
 */

import { randomBytes, randomUUID } from "node:crypto";
import { sha256 } from "../../../shared/utils/crypto.js";
import { panelConfigDir } from "../../../config/paths.js";
import { DirectSshExecutor } from "../../../shared/executor/direct-ssh-executor.js";
import { wrapExecutorWithSudo } from "../../../shared/executor/sudo-exec-wrap.js";
import { targetsRepository } from "../../servers/index.js";
import { PEER_CREDENTIAL_PREFIX } from "./peer-credentials.service.js";
import { PanelPeerMcpClient } from "./panel-peer-mcp-client.js";
import { createModuleLogger } from "../../../shared/logger/index.js";

const log = createModuleLogger("panel-pairing");

export interface PairResult {
  ok: boolean;
  /** True when B answered a live peer-MCP handshake (PANEL_PEER_MCP_ENABLED on). */
  verified: boolean;
  error?: string;
  code?: "serverNotRegistered" | "fingerprintRequired" | "writeFailed" | "pairFailed";
}

/** JSON-shell-safe: single-quote wrap for a heredoc-free `printf` install. */
function shSingleQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/**
 * Pair THIS panel with a target that runs LUXIPANEL. `label` identifies this
 * panel in B's credential listing (e.g. this panel's public origin).
 */
export async function pairPanelTarget(
  serverId: string,
  opts: { label?: string; baseUrl?: string; configDir?: string } = {},
): Promise<PairResult> {
  const found = await targetsRepository.getMaterial(serverId);
  if (!found) return { ok: false, verified: false, code: "serverNotRegistered", error: "Servidor no registrado" };
  const { target, material } = found;
  if (!target.hostFingerprint) {
    return { ok: false, verified: false, code: "fingerprintRequired", error: "Aprueba el fingerprint del host antes de emparejar" };
  }
  const baseUrl = opts.baseUrl ?? target.luxipanelBaseUrl ?? null;

  const ssh = new DirectSshExecutor(serverId, target.name || material.host, material);
  const exec = wrapExecutorWithSudo(ssh);
  const configDir = (opts.configDir ?? panelConfigDir()).replace(/\/+$/, "");
  const dir = `${configDir}/assistant`;
  const file = `${dir}/peer-credentials.json`;

  // Generate the secret + its hash. B stores the hash only.
  const secret = `${PEER_CREDENTIAL_PREFIX}${randomBytes(32).toString("hex")}`;
  const hashHex = sha256(secret);
  const id = randomUUID();
  const label = (opts.label ?? "peer-panel").slice(0, 200);

  try {
    // Read B's existing sidecar (root-owned tolerant); merge in the new hash.
    let existing: Record<string, unknown> = {};
    const readRes = await exec.exec(`sudo cat ${file} 2>/dev/null || true`, { timeoutMs: 15_000 });
    if (readRes.stdout.trim()) {
      try {
        existing = JSON.parse(readRes.stdout) as Record<string, unknown>;
      } catch {
        existing = {}; // corrupt → start fresh (B's kv would have preserved a .corrupt copy on its own reads)
      }
    }
    existing[id] = { hashHex, label, createdAt: new Date().toISOString() };
    const content = JSON.stringify(existing, null, 2);

    // Install via a tmp file + sudo (mkdir + move + 0600). The content carries a
    // hash, not a secret, but we still lock it down to 0600 like every sidecar.
    const tmp = `/tmp/.lxp-peer-${id}.json`;
    await exec.writeFile(tmp, content, { mode: 0o600 });
    const install = await exec.exec(
      `sudo sh -c ${shSingleQuote(`mkdir -p ${dir} && cp ${tmp} ${file} && chmod 600 ${file}`)} ; rm -f ${tmp}`,
      { timeoutMs: 20_000 },
    );
    if (install.exitCode !== 0) {
      return { ok: false, verified: false, code: "writeFailed", error: install.stderr || "No se pudo escribir la credencial en el destino" };
    }

    // Persist the plaintext (encrypted) in A's vault so the agent can use it.
    await targetsRepository.setPeerCredential(serverId, secret);
    log.info({ serverId, id }, "Peer credential provisioned on target");

    // Best-effort verification (needs B's flag on).
    let verified = false;
    if (baseUrl) {
      try {
        verified = await new PanelPeerMcpClient(baseUrl, secret).probe();
      } catch {
        verified = false;
      }
    }
    return { ok: true, verified };
  } catch (err) {
    return { ok: false, verified: false, code: "pairFailed", error: (err as Error).message };
  } finally {
    await ssh.dispose().catch(() => undefined);
  }
}
