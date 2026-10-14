import { withTenantIdentityControl } from "../../../shared/tenant/identity-control.js";
import { withHostingPolicyLock } from "../../hosting/services/hosting-policy-lock.js";
import { guardHostingResourceMutation } from "../../../shared/quota/resource-creation-lock.js";
import { authorizationChanged } from "../../../shared/auth/authorization-revision.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Users service — business logic for panel user management.
 */

import { panelUserRepository } from "../../auth/repositories/panel-user.repository.js";
import { roleRepository } from "../repositories/role.repository.js";
import { preferencesRepository } from "../repositories/preferences.repository.js";
import { type PanelUser, type NewPanelUser } from "../../auth/models/panel-users.model.js";
import { type UserPreferencesData } from "../models/preferences.model.js";
import { ConflictError, NotFoundError, AppError } from "../../../shared/errors/index.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { systemAccountsService } from "./system-accounts.service.js";
import { getContextUser, getContextExecutor } from "../../../shared/executor/context.js";
import { requireExecutor } from "../../../shared/executor/index.js";
import type { MutationStep } from "../../../shared/remote-cache/submit-mutation.js";
import { applyStepsOrThrow } from "../../../shared/remote-cache/apply-steps.js";
import {
  isHostingSession,
  getTenantEnvelope,
  type TenantEnvelope,
  assertTenantUsernameSafe,
  assertWithinSubUserQuota,
  assertTargetInTenant,
  assertNotOwner,
  clampGroupsToTenant,
  clampModulesToTenant,
  isTenantMember,
} from "../../../shared/tenant/tenant-scope.js";

export type UserJobRef = { id: string; mode: string } | null;

/** Enqueue a users/system command recipe and BLOCK until the worker applied it
 *  (the panel-side getent sync that follows needs the account to exist). Throws
 *  if it doesn't reach a terminal applied state in the wait window. */
async function applyUserSteps(op: "create" | "update" | "delete", steps: MutationStep[]): Promise<UserJobRef> {
  const result = await applyStepsOrThrow(requireExecutor(), {
    module: "users", collection: "system", op, steps,
    refresh: [["users", "system"]],
    notConfirmedMessage: "La operación de usuario no se confirmó a tiempo en el servidor",
    notConfirmedCode: "USER_OP_NOT_CONFIRMED",
  });
  return result ? { id: result.jobId, mode: result.mode } : null;
}

const log = createModuleLogger("users-svc");

/** Reject mutations targeting the protected `root` account. Callers decide WHEN
 *  to check (update() only for system-touching changes); this centralizes the
 *  EXACT error thrown so every path stays identical. */
function assertNotRoot(username: string): void {
  if (username === "root") {
    throw new AppError(`Cannot modify protected system user "root"`, 400, "PROTECTED_SYSTEM_USER");
  }
}

/** The tenant envelope for the current request, or null when the session is a
 *  normal admin/user (Fase 3 scoping does not apply). */
function tenantEnvelopeForRequest(): TenantEnvelope | null {
  const ctx = getContextUser();
  return isHostingSession(ctx) ? getTenantEnvelope(ctx!) : null;
}

/** Count the tenant's CURRENT sub-users (the owner is excluded). Uses the
 *  non-sudo getent read so it works under the privilege-dropped owner. */
async function countTenantSubUsers(env: TenantEnvelope): Promise<number> {
  const rows = await systemAccountsService.listUsersWithTenantGroup(env.tenantGroup);
  return rows.filter((u) => u.username !== env.owner && isTenantMember(env, u)).length;
}

/** Resolve a username to a tenant member (groups + homeDir) and throw if it is
 *  not part of the tenant — the single guard for update/delete targets. When the
 *  caller already fetched the live account (getent), pass it as `known` so the
 *  homeDir-under-homeRoot membership is honoured even for users not in the
 *  tenant group, AND so the check runs BEFORE any panel-record materialization. */
async function assertResolvedTargetInTenant(
  env: TenantEnvelope,
  username: string,
  known?: { username: string; groups?: string[]; homeDir?: string | null },
): Promise<void> {
  if (known) {
    // The live account is already in hand (its homeDir/groups). Augment with the
    // tenant-group membership view so either signal (group OR home) counts.
    const rows = await systemAccountsService.listUsersWithTenantGroup(env.tenantGroup);
    const inGroup = rows.find((u) => u.username === username);
    assertTargetInTenant(env, {
      username,
      groups: [...(known.groups ?? []), ...(inGroup?.groups ?? [])],
      homeDir: known.homeDir ?? inGroup?.homeDir ?? null,
    });
    return;
  }
  const rows = await systemAccountsService.listUsersWithTenantGroup(env.tenantGroup);
  const match = rows.find((u) => u.username === username);
  // If the account isn't visible via getent we still fail closed: an unknown
  // account is never "inside the tenant".
  assertTargetInTenant(env, match ?? { username, groups: [], homeDir: null });
}

/**
 * Resolve a panel user from a request id: by panel id, then by Linux UID (the
 * DataTable rows for unsynced system users carry the UID), then by username as a
 * last resort (the form sends the original username in `_lookupUsername`).
 */
async function resolveUser(id: number, lookupUsername?: string): Promise<PanelUser | undefined> {
  let user = (await panelUserRepository.findById(id)) ?? (await panelUserRepository.findBySystemUid(id));
  if (!user && lookupUsername) {
    user = await panelUserRepository.findByUsername(lookupUsername);
  }
  return user;
}

export interface CreateUserInput {
  username: string;
  email?: string;
  displayName?: string;
  password: string;
  /** Real Linux group NAMES to add the user to (supplementary membership). */
  groups?: string[];
  modules?: string[];
  enabled?: boolean;
  phoneE164?: string;
}

export interface UpdateUserInput {
  username?: string;
  email?: string | null;
  displayName?: string | null;
  /** Desired set of assignable group memberships (reconciled). */
  groups?: string[];
  modules?: string[] | null;
  enabled?: boolean;
  phoneE164?: string | null;
  /** Original username, for resolving the record when id/uid don't match. */
  _lookupUsername?: string;
}

export const usersService = {
  async list() {
    return panelUserRepository.findAll();
  },

  async getById(id: number): Promise<PanelUser> {
    const user = await panelUserRepository.findById(id);
    if (!user) throw new NotFoundError("User");
    return user;
  },

  async create(input: CreateUserInput): Promise<{ user: PanelUser; job: UserJobRef }> {
    const username = input.username.toLowerCase();
    const existing = await panelUserRepository.findByUsername(username);
    if (existing) throw new ConflictError(`Username "${input.username}" already exists`);
    if (input.email) {
      const existingEmail = await panelUserRepository.findByEmail(input.email);
      if (existingEmail) throw new ConflictError(`Email "${input.email}" already exists`);
    }

    // ── Fase 3: hosting tenant scoping. CLAMP everything to the envelope BEFORE
    //    building the step recipe (the on-box worker applies it with sudo and
    //    does NOT re-validate, so security lives entirely here).
    let groups = input.groups ?? [];
    let modules = input.modules;
    let tenantHome: string | undefined;
    let tenantPrimaryGroup: string | undefined;
    const env = tenantEnvelopeForRequest();
    if (env) {
      assertTenantUsernameSafe(username);
      assertWithinSubUserQuota(env, await countTenantSubUsers(env));
      // Force the sub-user inside the tenant: home under homeRoot, primary group
      // = tenant group, supplementary groups ⊆ {tenantGroup, tenantGroup-*}.
      tenantHome = `${env.homeRoot}/${username}`;
      tenantPrimaryGroup = env.tenantGroup;
      groups = [...new Set([env.tenantGroup, ...clampGroupsToTenant(env, input.groups)])];
      modules = clampModulesToTenant(env, input.modules ?? undefined);
    }

    // Whole on-box command recipe in one job: useradd + chpasswd, optional
    // lock (disabled), and role-group reconciliation — applied in order by the
    // worker (no per-command SSH latency). We wait for it to apply because the
    // getent sync below needs the account to exist.
    const steps: MutationStep[] = [
      ...systemAccountsService.buildCreateSteps({
        username, password: input.password, displayName: input.displayName ?? null,
        home: tenantHome ?? null, primaryGroup: tenantPrimaryGroup ?? null,
        shell: getContextUser()?.hostingPolicy?.runtime ? "/usr/lib/luxipanel/hosting-login" : undefined,
      }),
    ];
    if (input.enabled === false) steps.push(...systemAccountsService.buildSetEnabledSteps(username, false));
    steps.push(...await systemAccountsService.buildGroupMembershipSteps(username, groups));

    const job = await applyUserSteps("create", steps);

    const synced = await systemAccountsService.syncUserToDatabase(username);
    if (!synced) {
      throw new AppError(`Failed to sync newly created system user "${username}"`, 500, "SYSTEM_SYNC_FAILED");
    }

    const patch: Partial<Omit<NewPanelUser, "id">> = {
      email: input.email?.toLowerCase() ?? null,
      displayName: input.displayName ?? null,
      modules: modules ? JSON.stringify(modules) : null,
      enabled: input.enabled ?? true,
      phoneE164: input.phoneE164 ?? null,
    };
    await panelUserRepository.update(synced.id, patch);

    const user = await panelUserRepository.findById(synced.id);
    if (!user) {
      throw new AppError(`Failed to load created user "${username}"`, 500, "USER_RELOAD_FAILED");
    }

    await authorizationChanged();

    eventBus.emit(Events.USER_CREATED, { userId: user.id, username: user.username });
    log.info({ userId: user.id, username: user.username }, "User created");

    return { user, job };
  },

  async update(id: number, input: UpdateUserInput): Promise<UserJobRef> {
    // Resolve the tenant envelope up-front: a hosting session must validate the
    // target BEFORE any side effect (materializing a panel record), so a
    // non-tenant account is never written into the tenant's sidecar.
    const env = tenantEnvelopeForRequest();

    let user = await resolveUser(id, input._lookupUsername);
    if (!user) {
      // A real Linux user listed without a panel metadata record yet. Materialize
      // the record from the live account (getent) so the update applies — same
      // tolerance as delete(); the authoritative entity is the Linux account.
      const lookup = input._lookupUsername ?? input.username;
      const sysUser = lookup ? await systemAccountsService.getSystemUser(lookup) : null;
      if (sysUser) {
        // SECURITY (Fase 3): validate tenant membership of the LIVE account
        // BEFORE syncing it into panel_users — otherwise a non-tenant user would
        // get a panel record materialized in the tenant's sidecar before the
        // later membership check rejects the op.
        if (env) {
          assertNotOwner(env, sysUser.username);
          await assertResolvedTargetInTenant(env, sysUser.username, {
            username: sysUser.username,
            homeDir: sysUser.homeDir,
          });
        }
        user = (await systemAccountsService.syncUserToDatabase(sysUser.username)) ?? undefined;
      }
    }
    if (!user) {
      const all = await panelUserRepository.findAll().catch(() => []);
      log.warn(
        { id, lookupUsername: input._lookupUsername ?? null, count: all.length, ids: all.map((u) => u.id), usernames: all.map((u) => u.username), uids: all.map((u) => u.systemUid) },
        "user update: target not found in panel_users",
      );
      throw new NotFoundError("User");
    }
    const panelId = user.id;

    // ── Fase 3: hosting tenant scoping. The target MUST be a tenant member; the
    //    owner is never renamed; groups/modules are clamped to the envelope.
    //    (`env` was resolved at the top of update() so the pre-sync check above
    //    can run before any materialization.)
    if (env) {
      await assertResolvedTargetInTenant(env, user.username);
      if (input.username !== undefined) {
        const next = input.username.trim().toLowerCase();
        if (next !== user.username) {
          assertNotOwner(env, user.username);
          assertTenantUsernameSafe(next);
        }
      }
      if (input.groups !== undefined) {
        input = { ...input, groups: [...new Set([env.tenantGroup, ...clampGroupsToTenant(env, input.groups)])] };
      }
      if (input.modules !== undefined && input.modules !== null) {
        input = { ...input, modules: clampModulesToTenant(env, input.modules) };
      }
    }

    if (input.username !== undefined) {
      const normalized = input.username.trim().toLowerCase();
      if (normalized.length === 0) {
        throw new AppError("Username cannot be empty", 400, "INVALID_USERNAME");
      }
      if (normalized !== user.username) {
        const existingUsername = await panelUserRepository.findByUsername(normalized);
        if (existingUsername && existingUsername.id !== id) {
          throw new ConflictError(`Username "${normalized}" already exists`);
        }
      }
    }

    if (input.email !== undefined && input.email !== null) {
      const existingEmail = await panelUserRepository.findByEmail(input.email);
      if (existingEmail && existingEmail.id !== id) {
        throw new ConflictError(`Email "${input.email}" already exists`);
      }
    }

    const nextUsername = input.username?.trim().toLowerCase() ?? user.username;
    const changedUsername = nextUsername !== user.username;
    const activeUsername = changedUsername ? nextUsername : user.username;
    const touchesSystemUser =
      changedUsername || input.displayName !== undefined || input.enabled !== undefined;
    if (touchesSystemUser) assertNotRoot(user.username);

    // On-box recipe (rename → display name → lock state → group membership),
    // applied in order by the worker. Membership reconciliation reads current
    // groups under the CURRENT name (at build time) and applies under the
    // post-rename name (usermod -l already updated /etc/group by then).
    const steps: MutationStep[] = [];
    if (changedUsername) steps.push(...systemAccountsService.buildRenameSteps(user.username, nextUsername));
    if (input.displayName !== undefined) steps.push(...systemAccountsService.buildSetDisplayNameSteps(activeUsername, input.displayName));
    if (input.enabled !== undefined) steps.push(...systemAccountsService.buildSetEnabledSteps(activeUsername, input.enabled));
    // Reconcile group membership only when `groups` is explicitly provided. A
    // metadata-only update (email/phone) must NOT trigger a system job.
    if (input.groups !== undefined) {
      steps.push(...await systemAccountsService.buildGroupMembershipSteps(activeUsername, input.groups, user.username));
    }

    const job = await applyUserSteps("update", steps);

    // Re-sync (captures fresh `groups`) whenever we touched the system user OR
    // changed group membership, so stored groups stay authoritative.
    if (touchesSystemUser || input.groups !== undefined) {
      await systemAccountsService.syncUserToDatabase(activeUsername);
    }

    const patch: Partial<Omit<NewPanelUser, "id">> = {};
    if (input.username !== undefined) patch.username = nextUsername;
    if (input.email !== undefined) patch.email = input.email?.toLowerCase() ?? null;
    if (input.displayName !== undefined) patch.displayName = input.displayName;
    if (input.modules !== undefined) patch.modules = input.modules ? JSON.stringify(input.modules) : null;
    if (input.enabled !== undefined) patch.enabled = input.enabled;
    if (input.phoneE164 !== undefined) patch.phoneE164 = input.phoneE164;

    await panelUserRepository.update(panelId, patch);
    await authorizationChanged();
    eventBus.emit(Events.USER_UPDATED, { userId: panelId });
    return job;
  },

  async delete(id: number, lookupUsername?: string): Promise<UserJobRef> {
    const user = await resolveUser(id, lookupUsername);

    // ── Fase 3: hosting tenant scoping. Only tenant members; never the owner.
    const env = tenantEnvelopeForRequest();

    // A real Linux user can be listed (getent) without a panel metadata record
    // yet (sync skipped/pending). The authoritative entity is the Linux account,
    // not the panel sidecar — resolve by username and delete it on the server.
    if (!user) {
      const username = lookupUsername;
      if (!username) throw new NotFoundError("User");
      const sysUser = await systemAccountsService.getSystemUser(username);
      if (!sysUser) throw new NotFoundError("User");
      assertNotRoot(username);
      if (env) {
        assertNotOwner(env, username);
        await assertResolvedTargetInTenant(env, username, {
          username: sysUser.username,
          homeDir: sysUser.homeDir,
        });
      }
      // No panel record ⇒ no panel-derived admin status to guard against.
      const job = await applyUserSteps("delete", systemAccountsService.buildDeleteSteps(username));
      await authorizationChanged();
      eventBus.emit(Events.USER_DELETED, { userId: sysUser.uid, username });
      log.info({ username }, "Linux user deleted (no panel record)");
      return job;
    }

    const panelId = user.id;
    assertNotRoot(user.username);
    if (env) {
      assertNotOwner(env, user.username);
      await assertResolvedTargetInTenant(env, user.username);
    }

    // Guard: prevent deleting the last admin user. Admin = a per-user
    // `["admin"]` modules override OR membership in a Linux group whose
    // permission record carries the `admin` module.
    const allUsers = await panelUserRepository.findAll();
    const adminGroupNames = new Set(
      (await roleRepository.findAll())
        .filter((r) => Array.isArray(r.modules) && (r.modules as unknown as string[]).includes("admin"))
        .map((r) => r.name),
    );
    const isAdminUser = (u: PanelUser): boolean => {
      if (u.modules) {
        try {
          const m = JSON.parse(u.modules as string);
          if (Array.isArray(m) && m.includes("admin")) return true;
        } catch { /* ignore */ }
      }
      return (u.groups ?? []).some((g) => adminGroupNames.has(g));
    };
    const adminUsers = allUsers.filter(isAdminUser);
    if (isAdminUser(user) && adminUsers.length <= 1) {
      throw new AppError("Cannot delete the last admin user", 400, "LAST_ADMIN");
    }

    const job = await applyUserSteps("delete", systemAccountsService.buildDeleteSteps(user.username));
    await panelUserRepository.delete(panelId);

    await authorizationChanged();

    eventBus.emit(Events.USER_DELETED, { userId: panelId, username: user.username });
    log.info({ userId: panelId, username: user.username }, "User deleted");
    return job;
  },

  /** Change a user's Linux password on the connected server (chpasswd via the
   *  write-behind queue). ADMIN-only + 2FA gating is enforced at the controller;
   *  this just applies the recipe. `root` is protected. */
  async changePassword(id: number, newPassword: string): Promise<UserJobRef> {
    const user = await resolveUser(id);
    if (!user) throw new NotFoundError("User");
    assertNotRoot(user.username);
    const steps = systemAccountsService.buildSetPasswordSteps(user.username, newPassword);
    const job = await applyUserSteps("update", steps);
    await authorizationChanged();
    eventBus.emit(Events.USER_UPDATED, { userId: user.id });
    log.info({ userId: user.id, username: user.username }, "User password changed");
    return job;
  },

  /** Change own password — requires current password verification. */
  async changeOwnPassword(id: number, _currentPassword: string, _newPassword: string): Promise<void> {
    void id;
    throw new AppError(
      "Password changes are disabled in LUXIPANEL. Contact a system administrator.",
      400,
      "PASSWORD_MANAGED_EXTERNALLY",
    );
  },

  /** Get user preferences, returning empty object if none saved yet. */
  async getPreferences(userId: number): Promise<UserPreferencesData> {
    const row = await preferencesRepository.findByUserId(userId);
    return row?.data ?? {};
  },

  async updatePreferences(userId: number, patch: UserPreferencesData): Promise<UserPreferencesData> {
    const row = await preferencesRepository.upsert(userId, patch);
    return row.data;
  },
};

usersService.create = guardHostingResourceMutation("subusers", usersService.create);

for (const method of ["create", "update", "delete"] as const) {
  const handler = usersService[method] as (...args: any[]) => Promise<unknown>;
  (usersService as unknown as Record<string, (...args: any[]) => unknown>)[method] = (...args: any[]) => withTenantIdentityControl(async () => {
    const executor = getContextExecutor(), actor = getContextUser();
    const requested = method === "create" ? args[0] : method === "update" ? args[1] : undefined;
    if (actor && actor.kind !== "admin") {
      if (!isHostingSession(actor)) throw new AppError("User administration requires a hosting account or administrator", 403, "FORBIDDEN");
      if (requested?.modules?.includes("admin") || requested?.groups?.some((name: string) => ["root", "sudo", "wheel", "admin", "lxp-role-admin"].includes(name))) throw new AppError("Administrator privileges cannot be delegated", 403, "FORBIDDEN");
    }
    const { hostingAccountRepository } = await import("../../hosting/repositories/hosting-account.repository.js");
    const { hostingTemplateService } = await import("../../hosting/services/hosting-template.service.js");
    const { hostingRuntimeService } = await import("../../hosting/services/hosting-runtime.service.js");
    const accounts = executor && actor ? (await hostingAccountRepository.findAll({ limit: Number.MAX_SAFE_INTEGER }, executor)).rows.filter(account => account.status !== "terminated") : [];
    return withHostingPolicyLock(accounts.some(account => account.templateId) ? executor : null, async () => {
    const target = method === "create" ? undefined : await resolveUser(args[0], method === "update" ? args[1]?._lookupUsername : args[1]);
    const username = method === "create" ? args[0].username : target?.username ?? (method === "update" ? args[1]?._lookupUsername : args[1]);
    const linked = accounts.filter(account => account.username === username || (actor?.tenantId === account.id) || target?.groups?.includes(account.tenantGroup));
    if (method === "delete" && linked.some(account => account.username === username)) throw new AppError("Hosting owners must be removed through Hosting", 400, "PROTECTED_SYSTEM_USER");
    if (method === "update" && args[1]?.username && args[1].username.toLowerCase() !== username && linked.some(account => account.username === username)) throw new AppError("Hosting owners cannot be renamed", 400, "PROTECTED_SYSTEM_USER");
    if (method === "create" && accounts.some(account => account.templateId && args[0].groups?.includes(account.tenantGroup) && actor?.tenantId !== account.id)) throw new AppError("Create hosting sub-users within their account", 400, "PROTECTED_SYSTEM_USER");
    const runtimeAccounts = linked.filter(account => account.templateId);
    if (executor && (method === "delete" || method === "update" && (args[1]?.groups !== undefined || args[1]?.enabled !== undefined || args[1]?.username !== undefined))) {
      for (const account of runtimeAccounts) {
        await hostingAccountRepository.update(account.id, { policyState: "pending" }, executor);
        const revision = await authorizationChanged(executor.target.id);
        if (actor) actor.authorizationRevision = revision;
        await hostingRuntimeService.invalidate(executor, account);
      }
    }
    const result = await handler.apply(usersService, args);
    if (executor) {
      for (const account of runtimeAccounts) {
        try { await hostingTemplateService.reconcile(executor, account); }
        catch (error) { await hostingAccountRepository.update(account.id, { policyState: "pending" }, executor); log.warn({ accountId: account.id, error: String(error) }, "Sub-user runtime update pending"); }
      }
    }
    return result;
    });
  });
}
