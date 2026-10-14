// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Auth service — first-admin bootstrap for the current target and bridged
 * (SSO) Linux-identity resolution. Part of the merged `authService` surface
 * (`ensureAdminBootstrap` / `resolveBridgedLinuxIdentity` /
 * `getAdminBootstrapStatus`). Pure code movement out of auth.service.ts.
 *
 * NOTE: `resolveBridgedLinuxIdentity` used to call `this.buildTokenPayload`;
 * after the split it calls `authTokenService.buildTokenPayload` — the SAME
 * function reference the merged `authService` exposes (buildTokenPayload uses no
 * `this` on the audit/bootstrap objects), so behaviour is identical.
 */

import { panelUserRepository } from "../../repositories/index.js";
import { AuthError } from "../../../../shared/errors/index.js";
import { kv } from "../../../../shared/kv-store/index.js";
import { runWithExecutor, quoteArg, type Executor } from "../../../../shared/executor/index.js";
import { systemAccountsService } from "../../../users/services/system-accounts.service.js";
import { rolesService, ADMIN_GROUP_NAME } from "../../../users/services/roles.service.js";
import type { TokenPayload } from "../token.service.js";
import { log, readGecosDisplayName, stableBridgedUserId } from "./auth-shared.js";
import { authTokenService } from "./auth-token.service.js";

export const authBootstrapService = {
  /**
   * Idempotent first-admin bootstrap for the CURRENT target (managed mode).
   *
   * Ensures the baseline roles exist ("admin" + "Sin rol"); if the per-target
   * marker says the bootstrap hasn't happened yet AND the caller is allowed to
   * elevate, it assigns `username` to the admin role and persists the marker.
   * Safe to call repeatedly (login flow + Settings → General badge endpoint):
   * once the marker is set it only reads it back.
   *
   * Must run within the target executor scope (kv/role stores are per-server).
   */
  async ensureAdminBootstrap(opts: {
    executor?: Executor | null;
    username: string;
    /** Only elevate when the caller is authorized (fresh SSH login or an
     *  already-admin session). Non-admin callers just read the status. */
    allowElevate: boolean;
  }): Promise<{ adminBootstrapped: boolean; adminUsername: string | null; at: string | null }> {
    const { executor, username, allowElevate } = opts;
    const authMeta = kv(executor)
      .module("auth")
      .collection<{ id: string; adminBootstrapped?: boolean; adminUsername?: string; at?: string }>("meta");

    await rolesService.ensureBaseRoles(executor);
    const marker = await authMeta.get("bootstrap");
    if (marker?.adminBootstrapped) {
      return { adminBootstrapped: true, adminUsername: marker.adminUsername ?? null, at: marker.at ?? null };
    }
    if (!allowElevate) {
      return { adminBootstrapped: false, adminUsername: null, at: null };
    }

    // Create the real `admin` Linux group on the target and add the connecting
    // user to it, so the group-union resolution grants them admin. Keep a
    // per-user `["admin"]` modules override too as a safety net so a transient
    // group/record read failure can never silently downgrade the owner.
    const existing = await panelUserRepository.findByUsername(username);
    if (existing) {
      try {
        await systemAccountsService.ensureGroup(ADMIN_GROUP_NAME);
        await systemAccountsService.addUserToGroup(username, ADMIN_GROUP_NAME);
      } catch (err) {
        log.warn({ err: (err as Error).message, username }, "Failed to add bootstrap user to admin group (override still applies)");
      }
      // Re-capture group membership so `admin` lands in the stored groups now.
      const groups = await systemAccountsService.userGroups(username).catch(() => existing.groups ?? []);
      await panelUserRepository.update(existing.id, { modules: JSON.stringify(["admin"]), groups });
    }
    const at = new Date().toISOString();
    await authMeta.set("bootstrap", { id: "bootstrap", adminBootstrapped: true, adminUsername: username, at });
    log.info({ username }, "Admin bootstrap completed");
    return { adminBootstrapped: true, adminUsername: username, at };
  },

  /**
   * Resolve the panel identity for an SSO/bridge session from the CONNECTED
   * LINUX USER (not the LP customer account), so two Linux users sharing one LP
   * account get distinct panel profiles + group-derived permissions.
   *
   * READ-ONLY + no sudo: SSO sessions run through LP's agents gateway, which
   * proxies `exec` via `sanitizeShellCommand` (rejects any command containing
   * `\r`/`\n`/`\0`). Provisioning the panel_users sidecar requires sudo writes
   * to a root-owned dir whose injected commands carry newlines → rejected. So
   * we resolve identity from ONLY no-sudo reads: live `id -nG` group membership
   * (single-line command), the existing sidecar row (SFTP read, not exec) for a
   * stable id, and `getent passwd` for the GECOS name. The passphrase-login
   * path remains responsible for provisioning the sidecar row + admin bootstrap
   * (it owns a direct-SSH executor that can sudo).
   *
   * Returns ONLY the identity portion of the token; the caller merges bridge
   * fields. THROWS on failure so the caller falls back to the customer identity
   * (SSO must never hard-fail).
   */
  async resolveBridgedLinuxIdentity(executor: Executor, linuxUsername: string): Promise<TokenPayload> {
    const username = (linuxUsername || "").trim().toLowerCase();
    if (!username) throw new AuthError("Empty Linux username for bridged identity");

    return await runWithExecutor(executor, async () => {
      // Live supplementary groups (no sudo) — the source of truth for the
      // group-union permission resolution in buildTokenPayload.
      let liveGroups: string[] = [];
      try {
        const r = await executor.exec(`id -nG ${quoteArg(username)}`);
        if (r.exitCode === 0) {
          liveGroups = r.stdout.trim().split(/\s+/).filter(Boolean);
        }
      } catch (err) {
        log.warn({ err: (err as Error).message, username }, "bridged identity: `id -nG` failed; using stored groups");
      }

      // Existing per-server panel user (SFTP read, no write). Gives a stable
      // numeric id (so per-user config aligns with the passphrase-login path)
      // and fallbacks for groups/displayName/modules.
      const existing = await panelUserRepository.findByUsername(username).catch(() => undefined);
      if (existing && existing.enabled === false) throw new AuthError("Account is disabled", "ACCOUNT_DISABLED");

      const id = existing?.id ?? stableBridgedUserId(executor.target.id, username);
      const groups = liveGroups.length > 0 ? liveGroups : (existing?.groups ?? []);
      const displayName =
        (existing?.displayName && existing.displayName.trim().length > 0)
          ? existing.displayName
          : (await readGecosDisplayName(executor, username)) ?? username;
      const modules = existing?.modules ?? null;

      return authTokenService.buildTokenPayload({ id, username, displayName, groups, modules });
    });
  },

  /**
   * Read-only first-admin bootstrap status for the CURRENT target. Pure read
   * of the per-target marker — NO role creation, NO assignment, NO writes.
   * The actual bootstrap happens exclusively on the first SSH login
   * (`login()` → `ensureAdminBootstrap`). This only powers the
   * Settings → General badge so the page never mutates server state.
   *
   * Must run within the target executor scope (kv store is per-server).
   */
  async getAdminBootstrapStatus(
    executor?: Executor | null,
  ): Promise<{ adminBootstrapped: boolean; adminUsername: string | null; at: string | null }> {
    const authMeta = kv(executor)
      .module("auth")
      .collection<{ id: string; adminBootstrapped?: boolean; adminUsername?: string; at?: string }>("meta");
    const marker = await authMeta.get("bootstrap");
    return {
      adminBootstrapped: Boolean(marker?.adminBootstrapped),
      adminUsername: marker?.adminUsername ?? null,
      at: marker?.at ?? null,
    };
  },
};
