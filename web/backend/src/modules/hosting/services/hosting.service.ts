import { authorizationChanged } from "../../../shared/auth/authorization-revision.js";
import { deriveModulesFromPermissions } from "../../../shared/auth/role-permissions.js";
import { hostingTemplateService } from "./hosting-template.service.js";
import { HOSTING_LOGIN_SHELL, hostingRuntimeService } from "./hosting-runtime.service.js";
import { instantiateProviderGroupTemplate } from "./provider-group-policy.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Hosting service — lifecycle for nested-tenant accounts.
 *
 * A hosting account is provisioned ON the VPS as real Linux objects, reusing the
 * existing users/roles machinery (NO parallel realm):
 *
 *   1. `rolesService.create(tenantGroup, permissionTemplate)` — creates the
 *      dedicated Linux group + its permission record (the envelope). Sub-users
 *      added to this group inherit the envelope through the normal
 *      group → role → permissions path.
 *   2. write-behind job — `useradd` the owner, add to the tenant group, and
 *      lock down the home subtree (`chown owner:tenantGroup`, `chmod 750`).
 *
 * The bcrypt hash here is the panel credential for /login only (Phase 2 wires
 * the password-based /login + the `sudo -u <owner>` privilege-drop executor).
 * It is NOT an SSH passphrase.
 */

import bcrypt from "bcryptjs";
import { hostingAccountRepository } from "../repositories/hosting-account.repository.js";
import { hostingAuditRepository } from "../repositories/audit.repository.js";
import {
  buildEffectivePermissions,
  type RolePermissionsData,
} from "../../../shared/auth/role-permissions.js";
import { systemAccountsService, DEFAULT_LOGIN_SHELL } from "../../users/services/system-accounts.service.js";
import { rolesService, validModuleSlugs } from "../../users/services/roles.service.js";
import { submitMutation, type MutationStep } from "../../../shared/remote-cache/submit-mutation.js";
import { applyStepsOrThrow } from "../../../shared/remote-cache/apply-steps.js";
import { CACHE_KEYS } from "../../../shared/cache/cacheable-modules.js";
import type { HostingAccount } from "../models/hosting-account.model.js";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../../shared/errors/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { quoteArg, type Executor } from "../../../shared/executor/index.js";
import { env } from "../../../config/env.js";
import { detectQuotaSupport } from "../../../shared/quota/quota-support.js";
import { DEFAULT_AUDIT_LIMIT } from "../../../shared/constants.js";

const log = createModuleLogger("hosting");

const BCRYPT_ROUNDS = 12;
const TENANT_GROUP_PREFIX = "h-";

/** Default module envelope when the reseller doesn't pick one. */
const DEFAULT_ALLOWED_MODULES = ["files", "mail", "dns", "backups", "cron"];

function tenantGroupFor(username: string): string {
  return `${TENANT_GROUP_PREFIX}${username}`;
}
function homeRootFor(username: string): string {
  return `/home/${username}`;
}

/** Keep only known module slugs; fall back to the default set when empty. */
function sanitizeAllowedModules(modules?: string[]): string[] {
  const valid = new Set<string>(validModuleSlugs());
  const picked = (modules ?? [])
    .map((m) => m.trim())
    .filter((m) => valid.has(m));
  const unique = [...new Set(picked)];
  return unique.length > 0 ? unique : [...DEFAULT_ALLOWED_MODULES];
}

/**
 * Build the tenant's permission envelope: the modules' default surfaces, but
 * with file access clamped to the tenant home subtree (allowAll OFF).
 */
function buildTenantPermissionTemplate(
  allowedModules: string[],
  homeRoot: string,
): RolePermissionsData {
  const base = buildEffectivePermissions({
    rolePermissions: {},
    modules: allowedModules,
    isAdminKind: false,
  });
  return {
    ...base,
    fileAccess: {
      allowAll: false,
      allowPaths: [homeRoot],
      denyPaths: [],
      readOnlyPaths: [],
      defaultPath: homeRoot,
    },
  };
}

/** Enqueue a write-behind job and require it to apply before returning. */
async function applyTenantSteps(
  executor: Executor,
  op: "create" | "update" | "delete",
  steps: MutationStep[],
): Promise<void> {
  await applyStepsOrThrow(executor, {
    module: CACHE_KEYS.hosting.accounts.module,
    collection: CACHE_KEYS.hosting.accounts.collection,
    op,
    steps,
    // The owner is a Linux user — refresh the users table so it shows up.
    refresh: [["users", "system"]],
    notConfirmedMessage: "La operación de hosting no se confirmó a tiempo en el servidor",
    notConfirmedCode: "HOSTING_OP_NOT_CONFIRMED",
  });
}

/**
 * Best-effort audit append for a tenant lifecycle event. NEVER throws: an audit
 * write failure (e.g. server unreachable mid-op) must not break the operation
 * it is recording. Errors are logged at warn.
 */
async function audit(
  executor: Executor,
  account: Pick<HostingAccount, "id" | "username">,
  eventType: string,
  severity: "info" | "warning" | "critical",
  context: Record<string, unknown> = {},
): Promise<void> {
  try {
    await hostingAuditRepository.append(
      { accountId: account.id, eventType, severity, actor: account.username, context },
      executor,
    );
  } catch (err) {
    log.warn({ id: account.id, eventType, err: String(err) }, "hosting audit append failed (non-fatal)");
  }
}

export const hostingService = {
  // ── Account CRUD ─────────────────────────────────────────────

  async list(opts?: { search?: string; status?: string; username?: string; plan?: string; sortBy?: string; sortDir?: string; limit?: number; offset?: number }, executor?: Executor | null) {
    return hostingAccountRepository.findAll(opts, executor);
  },

  async findById(id: number, executor?: Executor | null): Promise<HostingAccount> {
    const account = await hostingAccountRepository.findById(id, executor);
    if (!account) throw new NotFoundError("Hosting account");
    return account;
  },

  async create(
    data: {
      username: string;
      password: string;
      displayName?: string;
      email?: string;
      plan?: string;
      templateId?: string;
      allowedModules?: string[];
      permissionTemplate?: RolePermissionsData;
      diskQuotaMb?: number;
      bandwidthQuotaMb?: number;
      maxDomains?: number;
      maxEmailAccounts?: number;
      maxDatabases?: number;
      maxSubUsers?: number;
      jailEnabled?: boolean;
      notes?: string;
      expiresAt?: Date;
    },
    executor: Executor,
  ): Promise<HostingAccount> {
    const username = data.username.toLowerCase();
    if (!/^[a-z][a-z0-9_-]{2,31}$/.test(username)) {
      throw new ValidationError(
        "El usuario debe tener 3–32 caracteres: minúsculas, dígitos, '-' y '_', empezando por letra",
      );
    }
    const existing = await hostingAccountRepository.findByUsername(username, executor);
    if (existing) throw new ConflictError(`El usuario '${username}' ya está en uso`);


    const tenantGroup = tenantGroupFor(username);
    const homeRoot = homeRootFor(username);
    const linkedTemplate = data.templateId ? await hostingTemplateService.get(executor, data.templateId) : null;
    if (linkedTemplate) {
      const caps = await hostingRuntimeService.capabilities(executor);
      if (!caps.cpu || !caps.memory || !caps.processes || !caps.jail || !caps.disk) throw new ValidationError("El servidor requiere cgroups v2, Jailkit y cuotas de proyecto activas");
      data = { ...data, ...linkedTemplate.limits, allowedModules: deriveModulesFromPermissions(linkedTemplate.permissions),
        permissionTemplate: instantiateProviderGroupTemplate(linkedTemplate.permissions, deriveModulesFromPermissions(linkedTemplate.permissions), homeRoot),
        jailEnabled: linkedTemplate.security.shell === "jailed" };
    }
    const allowedModules = data.permissionTemplate ? [...new Set(data.allowedModules ?? [])] : sanitizeAllowedModules(data.allowedModules);
    const permissionTemplate = data.permissionTemplate ?? buildTenantPermissionTemplate(allowedModules, homeRoot);
    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    // 1. Persist the account envelope (kv-store sidecar).
    const account = await hostingAccountRepository.create(
      {
        username,
        ...(linkedTemplate ? { templateId: linkedTemplate.id, templateRevision: linkedTemplate.revision, templateBase: permissionTemplate, security: linkedTemplate.security, resourceLimits: linkedTemplate.limits, policyState: "pending" as const } : {}),
        displayName:      data.displayName ?? username,
        email:            data.email ?? null,
        passwordHash,
        plan:             data.plan ?? "basic",
        status:           "active",
        tenantGroup,
        homeRoot,
        allowedModules,
        permissionTemplate,
        diskQuotaMb:      data.diskQuotaMb ?? 10240,
        bandwidthQuotaMb: data.bandwidthQuotaMb ?? 102400,
        maxDomains:       data.maxDomains ?? 10,
        maxEmailAccounts: data.maxEmailAccounts ?? 20,
        maxDatabases:     data.maxDatabases ?? 5,
        maxSubUsers:      data.maxSubUsers ?? 10,
        jailEnabled:      data.jailEnabled === true,
        notes:            data.notes ?? null,
        suspendedAt:      null,
        expiresAt:        data.expiresAt ? data.expiresAt.toISOString() : null,
      },
      executor,
    );

    // 2. Provision the tenant on the VPS.
    try {
      await this.provisionWithExecutor(account, data.password, executor);
      if (linkedTemplate) await hostingTemplateService.reconcile(executor, account, linkedTemplate);
    } catch (err) {
      // Roll back the record so a failed provision doesn't leave a phantom
      // account that can never be re-created (username conflict).
      if (linkedTemplate) await hostingAccountRepository.update(account.id, { policyState: "pending", status: "suspended" }, executor).catch(() => undefined);
      else await hostingAccountRepository.delete(account.id, executor).catch(() => undefined);
      throw err;
    }

    log.info({ id: account.id, username, tenantGroup }, "Hosting account created");
    await audit(executor, account, "ACCOUNT_CREATED", "info", {
      username,
      plan: account.plan,
      tenantGroup,
      homeRoot,
      allowedModules,
      diskQuotaMb: account.diskQuotaMb,
      maxDomains: account.maxDomains,
      maxEmailAccounts: account.maxEmailAccounts,
      maxDatabases: account.maxDatabases,
      maxSubUsers: account.maxSubUsers,
      jailEnabled: account.jailEnabled,
    });
    await authorizationChanged(executor.target.id);
    return (await hostingAccountRepository.findById(account.id, executor))!;
  },

  /**
   * Provision the Linux objects for an account: the tenant group + its envelope
   * role record, then the owner user (member of the tenant group) with a locked
   * down home subtree. The group/role is created first (synchronously) so the
   * subsequent `gpasswd -a` in the write-behind job finds it.
   */
  async provisionWithExecutor(account: HostingAccount, plainPassword: string, executor: Executor): Promise<void> {
    // a) tenant group + permission envelope (creates the Linux group too).
    await rolesService.create({
      name:        account.tenantGroup,
      description: `Hosting tenant: ${account.username}`,
      permissions: account.permissionTemplate as unknown as Record<string, unknown>,
    });

    // b) owner Linux user + group membership + home lockdown.
    const steps: MutationStep[] = [
      ...systemAccountsService.buildCreateSteps({
        username:    account.username,
        password:    plainPassword,
        shell: account.templateId ? HOSTING_LOGIN_SHELL : undefined,
        displayName: account.displayName,
      }),
      { type: "sh", argv: ["gpasswd", "-a", account.username, account.tenantGroup], sudo: true },
      { type: "sh", argv: ["chown", `${account.username}:${account.tenantGroup}`, account.homeRoot], sudo: true },
      { type: "sh", argv: ["chmod", "750", account.homeRoot], sudo: true },
    ];

    // c) OPT-IN shell isolation (Track 2): only when the global flag is on AND
    //    this account opted in. Appended to the SAME job (same transport /
    //    atomicity) AFTER the home chown/chmod so jk_jailuser operates on a
    //    fully-owned home. Track 1 panel ops are unaffected — they keep using
    //    `sudo -u owner sh -c` against the host /bin/sh, not the login shell.
    if (!account.templateId && env.JAIL_SHELL_ENABLED && account.jailEnabled) {
      steps.push(
        ...systemAccountsService.buildJailSetupSteps(
          account.homeRoot,
          account.username,
          account.tenantGroup,
          account.allowedModules,
        ),
      );
    }

    await applyTenantSteps(executor, "create", steps);
    if (!account.templateId && env.JAIL_SHELL_ENABLED && account.jailEnabled) {
      await hostingAccountRepository
        .update(account.id, { jailedAt: new Date().toISOString() }, executor)
        .catch(() => undefined);
    }
    // d) FAIL-SOFT disk quota: provision a kernel quota when the FS supports it,
    //    in a SEPARATE best-effort job so a missing mechanism (most VPS images)
    //    NEVER aborts the account. The home subtree already reflects in stats
    //    via `du`, so "no kernel quota" degrades to stats-only — not a failure.
    if (!account.templateId) await this.provisionDiskQuota(account, executor).catch((err) => {
      log.warn(
        { err: (err as Error).message, id: account.id, username: account.username },
        "Disk quota not provisioned (fail-soft → stats only)",
      );
    });

    log.info({ id: account.id, username: account.username, target: executor.target.id, jailed: Boolean(env.JAIL_SHELL_ENABLED && account.jailEnabled) }, "Hosting tenant provisioned");
  },

  /**
   * Best-effort hard disk quota for the tenant owner. Detects XFS project /
   * ext user quota support (cached) and, when present, enqueues a small job.
   * When neither is available it is a no-op (soft/stats only). The quota
   * commands run in a job independent of the create job so a tooling hiccup on
   * the box cannot leave the account half-provisioned.
   */
  async provisionDiskQuota(account: HostingAccount, executor: Executor): Promise<void> {
    if (!Number.isFinite(account.diskQuotaMb) || account.diskQuotaMb <= 0) return;
    const support = await detectQuotaSupport(executor);
    if (support.softOnly) return; // no kernel mechanism → stats only.

    const steps: MutationStep[] = [];
    if (support.extQuota) {
      // hard block limit in KiB (soft=0 → only hard enforced), inodes unlimited.
      const hardKb = account.diskQuotaMb * 1024;
      steps.push({
        type: "sh",
        argv: ["setquota", "-u", account.username, "0", String(hardKb), "0", "0", support.mount],
        sudo: true,
      });
    } else if (support.xfsQuota) {
      const proj = String(account.id);
      steps.push(
        { type: "sh", argv: ["xfs_quota", "-x", "-c", `project -s -p ${account.homeRoot} ${proj}`, support.mount], sudo: true },
        { type: "sh", argv: ["xfs_quota", "-x", "-c", `limit -p bhard=${account.diskQuotaMb}m ${proj}`, support.mount], sudo: true },
      );
    }
    if (steps.length === 0) return;

    // Independent best-effort job (NOT the create job). Failure bubbles to the
    // caller's .catch → stats-only fallback.
    await submitMutation(executor, {
      module: CACHE_KEYS.hosting.accounts.module,
      collection: CACHE_KEYS.hosting.accounts.collection,
      op: "update",
      steps,
      syncWaitMs: 15_000,
    });
  },

  async update(
    id: number,
    data: {
      displayName?: string;
      email?: string;
      plan?: string;
      templateId?: string;
      allowedModules?: string[];
      diskQuotaMb?: number;
      bandwidthQuotaMb?: number;
      maxDomains?: number;
      maxEmailAccounts?: number;
      maxDatabases?: number;
      maxSubUsers?: number;
      jailEnabled?: boolean;
      notes?: string;
      expiresAt?: Date | null;
    },
    executor: Executor,
  ): Promise<HostingAccount> {
    const account = await this.findById(id, executor);

    const patch: Partial<HostingAccount> = {};
    const planId = data.templateId ?? account.templateId;
    if (planId) {
      const plan = await hostingTemplateService.get(executor, planId);
      if (data.templateId && data.templateId !== account.templateId) {
        const caps = await hostingRuntimeService.capabilities(executor);
        if (!caps.cpu || !caps.memory || !caps.processes || !caps.jail || !caps.disk) throw new ValidationError("Hosting runtime requires active project quotas and cgroups v2");
        patch.templateId = plan.id;
      }
      if (data.allowedModules !== undefined || data.jailEnabled !== undefined) throw new ValidationError("Modules and shell policy are inherited from the hosting plan");
      const overrides = { ...account.limitOverrides };
      for (const key of ["diskQuotaMb", "maxDomains", "maxEmailAccounts", "maxDatabases", "maxSubUsers"] as const) {
        const value = data[key];
        if (value !== undefined) {
          if (value > plan.limits[key]) throw new ValidationError("Account quota exceeds its hosting plan");
          overrides[key] = value;
        }
      }
      patch.limitOverrides = overrides;
    }
    if (data.displayName !== undefined) patch.displayName = data.displayName;
    if (data.email !== undefined) patch.email = data.email ?? null;
    if (data.plan !== undefined) patch.plan = data.plan;
    if (data.diskQuotaMb !== undefined) patch.diskQuotaMb = data.diskQuotaMb;
    if (data.bandwidthQuotaMb !== undefined) patch.bandwidthQuotaMb = data.bandwidthQuotaMb;
    if (data.maxDomains !== undefined) patch.maxDomains = data.maxDomains;
    if (data.maxEmailAccounts !== undefined) patch.maxEmailAccounts = data.maxEmailAccounts;
    if (data.maxDatabases !== undefined) patch.maxDatabases = data.maxDatabases;
    if (data.maxSubUsers !== undefined) patch.maxSubUsers = data.maxSubUsers;
    if (data.jailEnabled !== undefined) patch.jailEnabled = data.jailEnabled;
    if (data.notes !== undefined) patch.notes = data.notes ?? null;

    // Toggle the chroot jail on/off when the flag flips AND the feature is on.
    // Fail-soft: a jail build/teardown failure is logged and never blocks the
    // metadata update (the next login simply falls back to the normal shell).
    if (!planId && env.JAIL_SHELL_ENABLED && data.jailEnabled !== undefined && data.jailEnabled !== account.jailEnabled) {
      try {
        if (data.jailEnabled) {
          await applyTenantSteps(
            executor,
            "update",
            systemAccountsService.buildJailSetupSteps(
              account.homeRoot,
              account.username,
              account.tenantGroup,
              account.allowedModules,
            ),
          );
          patch.jailedAt = new Date().toISOString();
        } else {
          const jailProc = `${account.homeRoot}/proc`;
          await applyTenantSteps(executor, "update", [
            { type: "sh", argv: ["usermod", "-s", DEFAULT_LOGIN_SHELL, account.username], sudo: true },
            {
              type: "sh",
              argv: ["sh", "-c", `mountpoint -q ${quoteArg(jailProc)} && umount ${quoteArg(jailProc)} || true`],
              sudo: true,
            },
          ]);
        }
      } catch (err) {
        log.warn({ id, jailEnabled: data.jailEnabled, err: String(err) }, "hosting jail toggle failed (fail-soft)");
      }
    }
    if (data.expiresAt !== undefined) patch.expiresAt = data.expiresAt ? data.expiresAt.toISOString() : null;

    // Re-derive + re-apply the envelope when the module set changes.
    if (data.allowedModules !== undefined) {
      const allowedModules = sanitizeAllowedModules(data.allowedModules);
      const permissionTemplate = buildTenantPermissionTemplate(allowedModules, account.homeRoot);
      patch.allowedModules = allowedModules;
      patch.permissionTemplate = permissionTemplate;
      await rolesService.updateByName(account.tenantGroup, {
        permissions: permissionTemplate as unknown as Record<string, unknown>,
      });
    }

    // Mirror the display name to the Linux account.
    if (data.displayName !== undefined) {
      await applyTenantSteps(
        executor,
        "update",
        systemAccountsService.buildSetDisplayNameSteps(account.username, data.displayName),
      );
    }

    const updated = await hostingAccountRepository.update(id, patch, executor);
    if (!updated) throw new NotFoundError("Hosting account");
    await authorizationChanged(executor.target.id);
    if (updated.templateId) {
      await hostingTemplateService.reconcile(executor, updated);
      return (await hostingAccountRepository.findById(id, executor))!;
    }
    log.info({ id }, "Hosting account updated");
    await audit(executor, updated, "ACCOUNT_UPDATED", "info", {
      // Only the keys that actually changed (the applied patch).
      changed: Object.keys(patch),
      ...(patch.plan !== undefined ? { plan: patch.plan } : {}),
      ...(patch.allowedModules !== undefined ? { allowedModules: patch.allowedModules } : {}),
      ...(patch.jailEnabled !== undefined ? { jailEnabled: patch.jailEnabled } : {}),
    });
    return updated;
  },

  async changePassword(id: number, newPassword: string, executor: Executor): Promise<void> {
    const account = await this.findById(id, executor);
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await applyTenantSteps(
      executor,
      "update",
      systemAccountsService.buildSetPasswordSteps(account.username, newPassword),
    );
    await hostingAccountRepository.update(id, { passwordHash }, executor);
    await authorizationChanged(executor.target.id);
    log.info({ id }, "Hosting account password changed");
    await audit(executor, account, "PASSWORD_CHANGED", "warning", { username: account.username });
  },

  async suspend(id: number, executor: Executor): Promise<HostingAccount> {
    const account = await this.findById(id, executor);
    if (account.status === "suspended") return account;
    await hostingRuntimeService.invalidate(executor, account);
    await applyTenantSteps(executor, "update", systemAccountsService.buildSetEnabledSteps(account.username, false));
    const updated = await hostingAccountRepository.update(
      id,
      { status: "suspended", suspendedAt: new Date().toISOString() },
      executor,
    );
    await authorizationChanged(executor.target.id);
    log.info({ id }, "Hosting account suspended");
    await audit(executor, account, "ACCOUNT_SUSPENDED", "warning", { username: account.username });
    return updated!;
  },

  async unsuspend(id: number, executor: Executor): Promise<HostingAccount> {
    const account = await this.findById(id, executor);
    if (account.status !== "suspended") return account;
    await applyTenantSteps(executor, "update", systemAccountsService.buildSetEnabledSteps(account.username, true));
    const updated = await hostingAccountRepository.update(
      id,
      { status: "active", suspendedAt: null },
      executor,
    );
    if (updated?.templateId) await hostingTemplateService.reconcile(executor, updated);
    await authorizationChanged(executor.target.id);
    log.info({ id }, "Hosting account unsuspended");
    await audit(executor, account, "ACCOUNT_UNSUSPENDED", "info", { username: account.username });
    return updated!;
  },

  /** Terminate: remove the owner Linux user + home, the tenant group/role, then
   *  the account record. */
  async terminate(id: number, executor: Executor): Promise<void> {
    const account = await this.findById(id, executor);
    await hostingRuntimeService.invalidate(executor, account);
    await authorizationChanged(executor.target.id);
    const deleteSteps: MutationStep[] = [];

    // Track 2 teardown — emitted BEFORE userdel/rm so the jail is dismantled on
    // a live tree. Each step is idempotent (runs harmlessly on non-jailed
    // accounts too): revert the login shell off jk_chrootsh, then ALWAYS
    // `umount` the jail /proc before the home is removed (a still-mounted /proc
    // would make `rm -rf` of the home recurse into the host's /proc).
    const jailProc = `${account.homeRoot}/proc`;
    deleteSteps.push(
      { type: "sh", argv: ["usermod", "-s", DEFAULT_LOGIN_SHELL, account.username], sudo: true },
      {
        type: "sh",
        argv: [
          "sh", "-c",
          `mountpoint -q ${quoteArg(jailProc)} && umount ${quoteArg(jailProc)} || true`,
        ],
        sudo: true,
      },
    );
    // -r removes the home dir; -f forces even with a stale session/processes.
    deleteSteps.push({ type: "sh", argv: ["userdel", "-rf", account.username], sudo: true });
    await applyTenantSteps(executor, "delete", deleteSteps);
    // Idempotent: drops the Linux group + its permission record.
    await rolesService.deleteByName(account.tenantGroup).catch((err) => {
      log.warn({ id, tenantGroup: account.tenantGroup, err: String(err) }, "tenant group cleanup failed");
    });
    // Audit BEFORE deleting the account record — the audit log is its own
    // collection and survives the account removal (history for the reseller).
    await audit(executor, account, "ACCOUNT_TERMINATED", "critical", {
      username: account.username,
      tenantGroup: account.tenantGroup,
      homeRoot: account.homeRoot,
    });
    await hostingAccountRepository.delete(id, executor);
    await authorizationChanged(executor.target.id);
    log.info({ id }, "Hosting account terminated");
  },

  /**
   * Audit history for one account (newest first). Does NOT require the account
   * to still exist — a terminated account's history stays readable by the
   * reseller. Scope (admin vs own-account) is enforced in the controller.
   */
  async getAudit(id: number, limit = DEFAULT_AUDIT_LIMIT, executor?: Executor | null) {
    const entries = await hostingAuditRepository.findByAccount(id, limit, executor);
    return { total: entries.length, entries };
  },

};

// Plan/account changes use the same lease as group and identity writes.
for (const method of ["create", "update", "suspend", "unsuspend", "terminate"] as const) {
  const handler = hostingService[method] as (...args: any[]) => Promise<unknown>;
  (hostingService as unknown as Record<string, (...args: any[]) => Promise<unknown>>)[method] = async (...args: any[]) => {
    const executor = args[method === "create" ? 1 : method === "update" ? 2 : 1] as Executor;
    const native = method === "create" ? !!args[0]?.templateId : !!(await hostingAccountRepository.findById(args[0], executor))?.templateId || method === "update" && !!args[1]?.templateId;
    const { withHostingPolicyLock } = await import("./hosting-policy-lock.js");
    return withHostingPolicyLock(native ? executor : null, () => handler.apply(hostingService, args));
  };
}
