import { validateRolePermissions } from "../../../shared/auth/role-permissions.js";
import { withHostingPolicyLock } from "../../hosting/services/hosting-policy-lock.js";
import { authorizationChanged } from "../../../shared/auth/authorization-revision.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Groups service — business logic for Linux-group permission records.
 *
 * Each record attaches an OPTIONAL permission matrix (modules + sidebar/views/
 * actions/file/command policy) to a REAL Linux group, keyed by the group NAME.
 * A user's effective permissions are the UNION of the records of every group
 * they belong to (resolved in `auth.service.buildTokenPayload`). Most real
 * groups have no record at all (they're plain Linux groups).
 *
 * NOTE: the on-disk sidecar (`users/roles.json`) and the API path (`/api/roles`)
 * keep their legacy names to avoid cache/route churn; semantically they are
 * "group permission records" now. There is NO synthetic `lxp-role-*` group.
 */

import { roleRepository } from "../repositories/role.repository.js";
import { type Role, type NewRole } from "../../auth/models/roles.model.js";
import { ConflictError, ForbiddenError, ValidationError } from "../../../shared/errors/index.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { systemAccountsService, ROLE_GROUP_PREFIX } from "./system-accounts.service.js";
import { normalizeRolePermissions, deriveModulesFromPermissions, assignableModuleSlugs } from "../../../shared/auth/role-permissions.js";
import { loginAclService } from "../../auth/services/login-acl.service.js";
import { getContextExecutor, getContextUser } from "../../../shared/executor/context.js";
import type { Executor } from "../../../shared/executor/index.js";
import {
  isHostingSession,
  getTenantEnvelope,
  type TenantEnvelope,
  assertTenantGroupCreatable,
  assertTenantGroupMutable,
  clampPermissionsToEnvelope,
  clampModulesToTenant,
} from "../../../shared/tenant/tenant-scope.js";

type JsonRecord = Record<string, unknown>;

const log = createModuleLogger("groups-svc");

/** The tenant envelope for the current request, or null for admin/user
 *  sessions (Fase 3 group scoping does not apply). */
function tenantEnvelopeForRequest(): TenantEnvelope | null {
  const ctx = getContextUser();
  return isHostingSession(ctx) ? getTenantEnvelope(ctx!) : null;
}

/** The real Linux group whose record grants full panel access. */
export const ADMIN_GROUP_NAME = "admin";

/**
 * All valid module slugs that can be assigned to a group. Derived from the
 * canonical assignable-permission catalog (`assignableModuleSlugs`, sourced from
 * the module registry ⊕ shell features) instead of a hand-maintained literal
 * that went stale — so new modules (obsidian, databases, cloudflare, expo,
 * hosting, terminal, …) are entitled automatically and can never diverge from
 * the catalog. Callers that need a static reference should call this at use
 * time (the registry is resolved dynamically). */
export function validModuleSlugs(): string[] {
  return assignableModuleSlugs();
}

/**
 * Modules granted to a group: the `admin` group always gets the full module set;
 * every other group derives its modules from its selected permissions.
 */
function modulesForGroup(name: string, permissions: unknown): string[] {
  return name === ADMIN_GROUP_NAME ? validModuleSlugs() : deriveModulesFromPermissions(permissions);
}

function validatePermissions(raw: unknown) {
  try { return validateRolePermissions(raw); }
  catch (error) { throw new ValidationError(error instanceof Error ? error.message : "Invalid permissions"); }
}

export const rolesService = {
  /** All group permission records (NOT the list of real groups — that's the controller's getent join). */
  async list(): Promise<Role[]> {
    return roleRepository.findAll();
  },

  /**
   * Create a real Linux group `name` (idempotent) and attach a permission
   * record to it. Runs on the connected client server via the context executor.
   */
  async create(data: { name: string; description?: string; modules?: string[]; permissions?: Record<string, unknown> }): Promise<Role> {
    const name = data.name.trim();
    if (name.startsWith(ROLE_GROUP_PREFIX)) {
      throw new ValidationError(`El prefijo '${ROLE_GROUP_PREFIX}' está reservado.`);
    }

    // ── Fase 3: hosting tenant scoping. The tenant may only create tenant-local
    //    groups (h-<owner>-*), never `admin`/system groups, and the permission
    //    matrix is CLAMPED to the envelope (⊆ template, fileAccess ⊆ homeRoot,
    //    modules ⊆ allowedModules). Admin/normal create is untouched.
    const env = tenantEnvelopeForRequest();
    let normalizedPerms = validatePermissions(data.permissions ?? {});
    if (env) {
      assertTenantGroupCreatable(env, name);
      normalizedPerms = clampPermissionsToEnvelope(env, normalizedPerms);
    }
    const permissions = normalizedPerms as unknown as JsonRecord;
    // Modules are DERIVED from the selected permissions (no manual module list).
    let modules = modulesForGroup(name, permissions);
    if (env) modules = clampModulesToTenant(env, modules); // defense-in-depth

    const existing = await roleRepository.findByName(name);
    if (existing) throw new ConflictError(`El grupo "${name}" ya tiene permisos asignados`);

    await systemAccountsService.ensureGroup(name);

    const role = await roleRepository.create({
      name,
      description: data.description ?? null,
      modules,
      permissions,
    });

    await authorizationChanged();

    eventBus.emit(Events.ROLE_CREATED, { roleId: role.id, name: role.name });
    log.info({ roleId: role.id, name: role.name }, "Group permission record created");
    void loginAclService.refresh(getContextExecutor());
    return role;
  },

  /**
   * Update a group's permission record by NAME (creating the record if the
   * group had none yet). `newName` renames the REAL Linux group too.
   */
  async updateByName(
    name: string,
    patch: { newName?: string; description?: string | null; permissions?: Record<string, unknown> },
  ): Promise<Role> {
    let targetName = name.trim();
    if (patch.permissions !== undefined) patch = { ...patch, permissions: validatePermissions(patch.permissions) as unknown as JsonRecord };

    // ── Fase 3: hosting tenant scoping. Only tenant-local child groups are
    //    editable; a rename target must also be tenant-local; the permission
    //    matrix is re-CLAMPED to the envelope.
    const env = tenantEnvelopeForRequest();
    if (env) {
      assertTenantGroupMutable(env, targetName);
    if (patch.newName && patch.newName.trim() !== targetName) {
        assertTenantGroupMutable(env, patch.newName.trim());
      }
      if (patch.permissions !== undefined) {
        const clamped = clampPermissionsToEnvelope(env, normalizeRolePermissions(patch.permissions));
        patch = { ...patch, permissions: clamped as unknown as Record<string, unknown> };
      }
    }

      const { hostingAccountRepository } = await import("../../hosting/repositories/hosting-account.repository.js");
    const { hostingTemplateService } = await import("../../hosting/services/hosting-template.service.js");
    const { hostingRuntimeService } = await import("../../hosting/services/hosting-runtime.service.js");
    const executor = getContextExecutor();
    const accounts = executor ? (await hostingAccountRepository.findAll({ limit: Number.MAX_SAFE_INTEGER }, executor)).rows.filter(a => a.status !== "terminated") : [];
    if (accounts.some(a => a.tenantGroup === name) && patch.newName && patch.newName.trim() !== name) throw new ValidationError("A hosting account's dedicated group cannot be renamed");
    const linked = accounts.filter(a => a.templateId && (a.tenantGroup === name || name.startsWith(a.tenantGroup + "-")));
    for (const account of linked) {
      await hostingAccountRepository.update(account.id, { policyState: "pending" }, executor);
      const revision = await authorizationChanged(executor!.target.id);
      const actor = getContextUser(); if (actor) actor.authorizationRevision = revision;
      await hostingRuntimeService.invalidate(executor!, account);
    }

    if (patch.newName && patch.newName.trim() !== targetName) {
      const nextName = patch.newName.trim();
      if (nextName.startsWith(ROLE_GROUP_PREFIX)) {
        throw new ValidationError(`El prefijo '${ROLE_GROUP_PREFIX}' está reservado.`);
      }
      const conflict = await roleRepository.findByName(nextName);
      if (conflict) throw new ConflictError(`El grupo "${nextName}" ya existe`);
      await systemAccountsService.renameGroup(targetName, nextName);
      targetName = nextName;
    }

    const existing = await roleRepository.findByName(name);
    const normalizedPermissions =
      patch.permissions !== undefined
        ? (validatePermissions(patch.permissions) as unknown as JsonRecord)
        : undefined;
    // Modules are DERIVED from permissions; the admin group always keeps all.
    const derivedModules =
      normalizedPermissions !== undefined
        ? modulesForGroup(targetName, normalizedPermissions)
        : undefined;

    let result: Role;
    if (!existing) {
      // The group existed without a permission record yet — create one now.
      result = await roleRepository.create({
        name: targetName,
        description: patch.description ?? null,
        modules: (derivedModules ?? []) as unknown as NewRole["modules"],
        permissions: (normalizedPermissions ?? {}) as JsonRecord,
      });
    } else {
      const nextPatch: Partial<NewRole> = { name: targetName };
      if (patch.description !== undefined) (nextPatch as { description?: string | null }).description = patch.description;
      if (derivedModules !== undefined) nextPatch.modules = derivedModules as unknown as NewRole["modules"];
      if (normalizedPermissions !== undefined) (nextPatch as { permissions?: JsonRecord }).permissions = normalizedPermissions;
      result = (await roleRepository.update(existing.id, nextPatch))!;
    }

    for (const account of linked.filter(a => a.tenantGroup === name)) {
      if (normalizedPermissions !== undefined) {
        const { hostingPermissionOverrides } = await import("../../hosting/services/hosting-template-policy.js");
        const base = account.templateBase ?? account.permissionTemplate;
        const restrictions = hostingPermissionOverrides(base, normalizeRolePermissions(normalizedPermissions));
        for (const field of ["sidebar", "views", "actions"] as const) {
          restrictions[field] = [...new Set([...restrictions[field], ...(account.permissionOverrides?.[field] ?? []).filter(id => !base[field].includes(id))])];
        }
        await hostingAccountRepository.update(account.id, { permissionOverrides: restrictions }, executor);
        account.permissionOverrides = restrictions;
      }
    }
    await authorizationChanged();

    eventBus.emit(Events.ROLE_UPDATED, { roleId: result.id });
    for (const account of linked) {
      try { await hostingTemplateService.reconcile(executor!, account); }
      catch (error) { log.warn({ accountId: account.id, error: String(error) }, "Hosting policy remains pending after group change"); }
    }
    log.info({ roleId: result.id, name: result.name }, "Group permission record updated");
    void loginAclService.refresh(getContextExecutor());
    return result;
  },

  /** Delete the real Linux group + its permission record (if any), by NAME. */
  async deleteByName(name: string): Promise<void> {
    const target = name.trim();
    // ── Fase 3: hosting tenant scoping. Only tenant-local child groups.
    const env = tenantEnvelopeForRequest();
    if (env) assertTenantGroupMutable(env, target);
    const executor = getContextExecutor();
    const { hostingAccountRepository } = await import("../../hosting/repositories/hosting-account.repository.js");
    const accounts = executor ? (await hostingAccountRepository.findAll({ limit: Number.MAX_SAFE_INTEGER }, executor)).rows : [];
    if (accounts.some(a => a.tenantGroup === target && a.status !== "terminated")) throw new ConflictError("A hosting account's dedicated group cannot be deleted");
    const linked = accounts.filter(a => a.templateId && target.startsWith(a.tenantGroup + "-"));
    const { hostingRuntimeService } = await import("../../hosting/services/hosting-runtime.service.js");
    const { hostingTemplateService } = await import("../../hosting/services/hosting-template.service.js");
    for (const account of linked) await hostingRuntimeService.invalidate(executor!, account);
    await systemAccountsService.deleteGroup(target);
    const existing = await roleRepository.findByName(target);
    if (existing) {
      await roleRepository.delete(existing.id);
      eventBus.emit(Events.ROLE_DELETED, { roleId: existing.id });
    }
    await authorizationChanged();
    for (const account of linked) {
      try { await hostingTemplateService.reconcile(executor!, account); }
      catch (error) { await hostingAccountRepository.update(account.id, { policyState: "pending" }, executor); log.warn({ accountId: account.id, error: String(error) }, "Hosting group deletion pending reconciliation"); }
    }
    log.info({ name: target }, "Group deleted");
    void loginAclService.refresh(getContextExecutor());
  },

  /**
   * Ensure the baseline `admin` permission record (all modules) exists on the
   * CURRENT target. Uses the repository directly (no Linux-group side effect —
   * the real `admin` group is created during the login admin-bootstrap, which
   * has the target executor). Returns its id for the login bootstrap.
   */
  async ensureBaseRoles(executor?: Executor | null): Promise<{ adminRoleId: number }> {
    let admin = await roleRepository.findByName(ADMIN_GROUP_NAME, executor);
    if (!admin) {
      admin = await roleRepository.create(
        { name: ADMIN_GROUP_NAME, description: "Acceso total a todos los módulos", modules: validModuleSlugs(), permissions: {} },
        executor,
      );
      log.info({ roleId: admin.id }, "Admin group record created (login bootstrap)");
    }
    return { adminRoleId: admin.id };
  },
};

for (const method of ["create", "updateByName", "deleteByName"] as const) {
  const handler = rolesService[method] as (...args: any[]) => Promise<unknown>;
  (rolesService as unknown as Record<string, (...args: any[]) => Promise<unknown>>)[method] = async (...args: any[]) => {
    const actor = getContextUser();
    if (actor && actor.kind !== "admin" && !isHostingSession(actor)) throw new ForbiddenError("User administration requires a hosting account or administrator");
    const executor = getContextExecutor();
    const { hostingAccountRepository } = await import("../../hosting/repositories/hosting-account.repository.js");
    const native = executor && (await hostingAccountRepository.findAll({ limit: Number.MAX_SAFE_INTEGER }, executor)).rows.some(a => a.templateId && a.status !== "terminated");
    return withHostingPolicyLock(native ? executor : null, () => handler.apply(rolesService, args));
  };
}
