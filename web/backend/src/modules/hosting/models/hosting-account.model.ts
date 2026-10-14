// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Hosting accounts — nested tenants living inside a single VPS.
 *
 * A hosting account is NOT a parallel auth realm anymore (the old bcrypt+Drizzle
 * design is gone). It is a thin envelope on top of the existing Linux-user /
 * group / permission machinery:
 *
 *   - `username`     → the account owner's PRIMARY Linux user on the VPS.
 *   - `tenantGroup`  → a dedicated Linux group (e.g. `h-<username>`). Every
 *                      sub-user the account creates belongs to it, so they all
 *                      inherit the same permission envelope via the normal
 *                      group → role-record → permissions path.
 *   - `homeRoot`     → the tenant's filesystem root ("their VPS root"), e.g.
 *                      `/home/<username>`. The permission template scopes file
 *                      access to this subtree.
 *   - `allowedModules` + `permissionTemplate` → the MAX envelope any user or
 *                      group inside this tenant may hold. Persisted ALSO as the
 *                      `tenantGroup` role record in `users/roles.json`.
 *
 * NO DB: persisted as a JSON sidecar via dataStore under
 *   ${LUXIPANEL_CONFIG_DIR}/hosting/accounts.json
 * (per the no-database, per-server kv-store architecture). All timestamps are
 * stored as ISO strings; there is no Drizzle table and no SQL migration.
 */

import type { RolePermissionsData } from "../../../shared/auth/role-permissions.js";

type HostingAccountStatus = "active" | "suspended" | "terminated";

export interface HostingAccount {
  templateId?: string;
  limitOverrides?: Partial<import("./hosting-template.model.js").HostingLimits>;
  templateRevision?: number;
  templateBase?: RolePermissionsData;
  permissionOverrides?: import("../services/hosting-template-policy.js").HostingPermissionOverrides;
  runtimeRevision?: number;
  policyState?: "ready" | "pending";
  resourceLimits?: import("./hosting-template.model.js").HostingLimits;
  runtimeCapabilities?: { php: boolean };
  security?: import("./hosting-template.model.js").HostingSecurity;
  id: number;
  /** Login username — unique; also the owner's primary Linux user on the VPS. */
  username: string;
  displayName: string | null;
  email: string | null;
  /** Panel credential for /login (bcrypt). This is NOT an SSH passphrase. */
  passwordHash: string;
  /** Plan label e.g. "basic" | "pro" | "business" | "custom". */
  plan: string;
  status: HostingAccountStatus;

  // ── Tenant envelope ───────────────────────────────────────────
  /** Dedicated Linux group owning this tenant; sub-users all belong to it. */
  tenantGroup: string;
  /** Tenant filesystem root ("their VPS root"), e.g. /home/<username>. */
  homeRoot: string;
  /** Modules the reseller exposes to this account's users (catalog subset). */
  allowedModules: string[];
  /** Max permission envelope, clamped to homeRoot + allowedModules. Mirrored as
   *  the `tenantGroup` role record so sub-users inherit it. */
  permissionTemplate: RolePermissionsData;

  // ── Shell isolation (Track 2 — jailkit chroot) ─────────────────
  /** When true (and env.JAIL_SHELL_ENABLED), this account's interactive shell
   *  (web terminal + direct SSH) is a jailkit chroot rooted at `homeRoot`. The
   *  owner's login shell is set to jk_chrootsh and the PTY uses `sudo -u owner -i`.
   *  Opt-in per account; new plans fail closed when isolation is unavailable. */
  jailEnabled: boolean;
  /** ISO timestamp of the last successful jail provisioning (audit only). */
  jailedAt?: string;

  // ── Resource quotas ───────────────────────────────────────────
  diskQuotaMb: number;
  bandwidthQuotaMb: number;
  maxDomains: number;
  maxEmailAccounts: number;
  maxDatabases: number;
  /** Max sub-users the account owner may create inside the tenant. */
  maxSubUsers: number;

  notes: string | null;
  suspendedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Shape accepted by the repository on create (id/timestamps are assigned). */
export type NewHostingAccount = Omit<
  HostingAccount,
  "id" | "createdAt" | "updatedAt"
>;
