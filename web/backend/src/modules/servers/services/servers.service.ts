// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Business logic for the local SSH target vault (modules/servers).
 *
 * CRUD + TOFU flow: `test` performs the first-contact probe (capture host key
 * → `hostFingerprintPending`), `approveFingerprint` pins it. All persistence
 * goes through targetsRepository (bound to localExecutor). No express here.
 */

import { Client } from "ssh2";
import { ForbiddenError, NotFoundError, ValidationError } from "../../../shared/errors/index.js";
import { assertSafeTargetHost } from "../../../shared/net/host-policy.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import type { SshConnectionMaterial } from "../../auth/services/ssh-credentials-cache.service.js";
import { targetsRepository } from "../repositories/targets.repository.js";
import { SSH_CONNECT_TIMEOUT_MS } from "../../../shared/constants.js";
import type { CreateTargetInput, TargetRecord, TargetView, UpdateTargetInput } from "../models/index.js";

const log = createModuleLogger("servers-service");

// SSOT: shared/constants.ts (SSH connect / probe timeout).
const SSH_PROBE_TIMEOUT_MS = SSH_CONNECT_TIMEOUT_MS;

/** Identity used to authorize target visibility/use/management. */
export interface TargetViewer {
  userId: number | null;
  isAdmin: boolean;
}

/** Minimal ownership shape both TargetRecord and TargetView satisfy. */
type OwnershipFields = Pick<TargetRecord, "ownerId" | "allowedUserIds" | "visibility">;

/**
 * Single source of truth for "may this viewer SEE and USE this target".
 * Shared by list filtering, the sidebar switch, and the assistant's cross-server
 * tools so the three channels can't drift.
 *  - admin ⇒ always.
 *  - private target ⇒ only its owner.
 *  - global target ⇒ any authenticated user, subject to `allowedUserIds`
 *    (empty allowlist = everyone).
 */
export function userMayUseTarget(target: OwnershipFields, viewer: TargetViewer): boolean {
  if (viewer.isAdmin) return true;
  if (target.visibility === "private") {
    return target.ownerId != null && target.ownerId === viewer.userId;
  }
  const allow = Array.isArray(target.allowedUserIds) ? target.allowedUserIds : [];
  if (allow.length === 0) return true;
  return viewer.userId != null && allow.includes(String(viewer.userId));
}

/** May this viewer MUTATE this target (update/delete/test/approve)?
 *  Admins manage anything; non-admins only their own private targets. */
function mayManage(target: OwnershipFields, viewer: TargetViewer): boolean {
  if (viewer.isAdmin) return true;
  return target.visibility === "private" && target.ownerId != null && target.ownerId === viewer.userId;
}

function assertMayManage(target: OwnershipFields, viewer: TargetViewer): void {
  if (!mayManage(target, viewer)) {
    throw new ForbiddenError("No tienes permiso para gestionar este servidor");
  }
}

/**
 * SSRF-screen the optional panel-to-panel MCP base URL exactly like the SSH
 * host: the panel FETCHES this URL from its own host (pairing probe + agent
 * peer client), so an unscreened value is a blind-SSRF vector. Parses the URL
 * and runs its hostname through the same host policy (blocks RFC1918/loopback/
 * link-local unless SERVERS_ALLOW_PRIVATE; cloud metadata always blocked).
 */
async function assertSafePeerBaseUrl(baseUrl: string | null | undefined): Promise<void> {
  if (!baseUrl) return;
  let hostname: string;
  try {
    const u = new URL(baseUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      throw new ValidationError("La URL de LUXIPANEL debe ser http(s)");
    }
    hostname = u.hostname;
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError("URL de LUXIPANEL inválida");
  }
  await assertSafeTargetHost(hostname);
}

/** Outcome of a `test` probe (a normal business result, not an error). */
export type TestOutcome =
  | { outcome: "ok"; fingerprint: string; target: TargetView }
  | { outcome: "pending"; fingerprint: string; changed: boolean; target: TargetView }
  | { outcome: "error"; error: string; target: TargetView };

/**
 * Open an ssh2 connection ONLY to observe the host key (and, when an expected
 * fingerprint is supplied, to validate credentials too). Always captures the
 * presented host key hash. `ready` is true only when the host key matched the
 * expected pin AND authentication succeeded.
 */
function probeHostKey(
  material: SshConnectionMaterial,
  host: string,
  expected: string | null,
): Promise<{ captured: string; ready: boolean; error?: string }> {
  return new Promise((resolve) => {
    const client = new Client();
    let captured = "";
    let settled = false;
    const finish = (v: { captured: string; ready: boolean; error?: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { client.end(); } catch { /* ignore */ }
      resolve(v);
    };
    const timer = setTimeout(
      () => finish({ captured, ready: false, error: "Timeout de conexión" }),
      SSH_PROBE_TIMEOUT_MS,
    );

    client.on("ready", () => finish({ captured, ready: true }));
    client.on("error", (err) =>
      finish({ captured, ready: false, error: (err as Error).message }),
    );

    const authFields = material.privateKeyPem
      ? { privateKey: material.privateKeyPem, passphrase: material.passphrase || undefined }
      : { password: material.password, tryKeyboard: true as const };

    try {
      client.connect({
        host,
        port: material.port,
        username: material.username,
        ...authFields,
        hostHash: "sha256",
        hostVerifier: (hashedKey: Buffer | string): boolean => {
          captured = typeof hashedKey === "string" ? hashedKey : hashedKey.toString("hex");
          // No expected pin → we only wanted the key: reject to abort cleanly
          // (still captured above). Expected pin → accept iff it matches.
          return expected != null && captured === expected;
        },
        readyTimeout: SSH_PROBE_TIMEOUT_MS,
      });
    } catch (err) {
      finish({ captured, ready: false, error: (err as Error).message });
    }
  });
}

export const serversService = {
  /** List the targets this viewer may see (globals + own privates; admin = all). */
  async list(viewer: TargetViewer): Promise<TargetView[]> {
    const all = await targetsRepository.listView();
    return all.filter((t) => userMayUseTarget(t, viewer));
  },

  async get(id: string, viewer: TargetViewer): Promise<TargetView> {
    const v = await targetsRepository.getView(id);
    if (!v || !userMayUseTarget(v, viewer)) throw new NotFoundError("Servidor");
    return v;
  },

  async create(input: CreateTargetInput, viewer: TargetViewer): Promise<TargetView> {
    // SSRF screen (respects SERVERS_ALLOW_PRIVATE). Throws HostPolicyError (400).
    await assertSafeTargetHost(input.host);
    await assertSafePeerBaseUrl(input.luxipanelBaseUrl);
    if (input.authType === "password" && !input.secret) {
      throw new ValidationError("Se requiere una contraseña para auth por password");
    }
    // Admins create shared (global) targets; a non-admin creates a private
    // target owned by themselves. Only admins may set an allowlist (it only
    // applies to globals anyway). A non-admin without a numeric userId can't
    // own anything — refuse rather than mint an orphan nobody can use/manage.
    const isAdmin = viewer.isAdmin;
    if (!isAdmin && viewer.userId == null) {
      throw new ForbiddenError("No se pudo determinar tu usuario para registrar un servidor privado");
    }
    return targetsRepository.create({
      ...input,
      allowedUserIds: isAdmin ? input.allowedUserIds : undefined,
      ownerId: isAdmin ? null : viewer.userId,
      visibility: isAdmin ? "global" : "private",
    });
  },

  async update(id: string, patch: UpdateTargetInput, viewer: TargetViewer): Promise<TargetView> {
    const existing = await targetsRepository.get(id);
    if (!existing) throw new NotFoundError("Servidor");
    assertMayManage(existing, viewer);
    if (patch.host !== undefined) await assertSafeTargetHost(patch.host);
    if (patch.luxipanelBaseUrl !== undefined) await assertSafePeerBaseUrl(patch.luxipanelBaseUrl);
    // A non-admin can never (re)assign the allowlist (globals-only concept).
    const safePatch: UpdateTargetInput = viewer.isAdmin
      ? patch
      : { ...patch, allowedUserIds: undefined };
    const updated = await targetsRepository.update(id, safePatch);
    if (!updated) throw new NotFoundError("Servidor");
    return updated;
  },

  async remove(id: string, viewer: TargetViewer): Promise<void> {
    const existing = await targetsRepository.get(id);
    if (!existing) throw new NotFoundError("Servidor");
    assertMayManage(existing, viewer);
    const ok = await targetsRepository.delete(id);
    if (!ok) throw new NotFoundError("Servidor");
  },

  /**
   * First-contact / connectivity test. Captures the host key. If none is pinned
   * yet (or the key changed), stores it as `hostFingerprintPending` and returns
   * `pending` — the caller answers 409 HOST_FINGERPRINT_PENDING_APPROVAL.
   */
  async test(id: string, viewer: TargetViewer): Promise<TestOutcome> {
    const found = await targetsRepository.getMaterial(id);
    if (!found) throw new NotFoundError("Servidor");
    const { target, material } = found;
    assertMayManage(target, viewer);

    // Pin the resolved IP to defeat DNS rebinding; connect to it directly.
    const { pinnedAddress } = await assertSafeTargetHost(target.host);
    const host = pinnedAddress ?? target.host;

    const pinned = target.hostFingerprint || null;
    const probe = await probeHostKey(material, host, pinned);

    if (!probe.captured) {
      const error = probe.error || "No se pudo obtener la clave del host";
      await targetsRepository.markStatus(id, "error", { error });
      const view = (await targetsRepository.getView(id))!;
      return { outcome: "error", error, target: view };
    }

    // No pinned fingerprint yet → first contact (TOFU): store pending, await approval.
    if (!pinned) {
      const view = (await targetsRepository.setPendingFingerprint(id, probe.captured))!;
      return { outcome: "pending", fingerprint: probe.captured, changed: false, target: view };
    }

    // Pinned key changed → security event: store new one as pending (re-approval).
    if (probe.captured !== pinned) {
      log.warn({ id, pinned, got: probe.captured }, "Host key changed — re-approval required");
      const view = (await targetsRepository.setPendingFingerprint(id, probe.captured))!;
      return { outcome: "pending", fingerprint: probe.captured, changed: true, target: view };
    }

    // Fingerprint matched. `ready` also reflects credential validity.
    if (probe.ready) {
      await targetsRepository.markStatus(id, "ok", { seen: true });
      const view = (await targetsRepository.getView(id))!;
      return { outcome: "ok", fingerprint: probe.captured, target: view };
    }
    const error = probe.error || "Falló la autenticación";
    await targetsRepository.markStatus(id, "error", { error });
    const view = (await targetsRepository.getView(id))!;
    return { outcome: "error", error, target: view };
  },

  /** Promote pending → pinned fingerprint. */
  async approveFingerprint(id: string, viewer: TargetViewer): Promise<TargetView> {
    const existing = await targetsRepository.get(id);
    if (!existing) throw new NotFoundError("Servidor");
    assertMayManage(existing, viewer);
    const view = await targetsRepository.approveFingerprint(id);
    if (!view) throw new ValidationError("No hay un fingerprint pendiente de aprobar");
    return view;
  },
};
