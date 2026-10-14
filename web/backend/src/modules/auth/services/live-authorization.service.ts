import { migratePermissionSnapshots } from "./permission-migration.service.js";
import type { SessionUser } from "../../../shared/types/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import { runWithExecutor } from "../../../shared/executor/context.js";
import { authorizationRevision } from "../../../shared/auth/authorization-revision.js";
import { AuthError, ForbiddenError } from "../../../shared/errors/index.js";
import { PrivilegeDropExecutor } from "../../../shared/executor/privilege-drop-executor.js";
import { panelUserRepository } from "../repositories/index.js";
import { systemAccountsService } from "../../users/services/system-accounts.service.js";
import { authTokenService } from "./auth/auth-token.service.js";
import { invalidateRolesCache } from "./auth/auth-roles-cache.js";
import { hostingAccountRepository } from "../../hosting/repositories/hosting-account.repository.js";
import { hostingTemplateService } from "../../hosting/services/hosting-template.service.js";
import { getRolesForTarget } from "./auth/auth-roles-cache.js";
import { buildEffectivePermissions, deriveModulesFromPermissions, getRolePermissionsCatalog, mergeRolePermissions } from "../../../shared/auth/role-permissions.js";
import { clampPermissionsToEnvelope, getTenantEnvelope } from "../../../shared/tenant/tenant-scope.js";

function assertSessionPolicy(user: SessionUser): SessionUser {
  const security = user.hostingPolicy?.security;
  if (user.hostingPolicy?.expiresAt && Date.parse(user.hostingPolicy.expiresAt) <= Date.now()) throw new AuthError("Hosting account is inactive");
  if (security?.requireMfa && !user.mfaAuthenticated) throw new AuthError("This hosting plan requires MFA authentication");
  if (security && (!user.sessionIssuedAt || Date.now() >= (user.sessionIssuedAt + security.sessionHours * 3600) * 1000)) throw new AuthError("Hosting session lifetime exceeded");
  return user;
}
const cache = new Map<string, { revision: string; expires: number; user: SessionUser }>();
/** The JWT authenticates identity; it never remains the authority for a
 * permission snapshot after a group/account/template mutation. */
export async function resolveLiveAuthorization(user: SessionUser, executor: Executor): Promise<SessionUser> {
  if (user.kind === "mfa_pending" || user.kind === "external-guest") return user;
  const service = executor instanceof PrivilegeDropExecutor ? executor.trustedServiceExecutorFor(user.owner ?? "") : executor;
  if (!service) throw new AuthError("Invalid account executor");
  const revision = await authorizationRevision(service.target.id);
  const key = `${service.target.id}:${user.userId}:${user.username}`;
  const cached = cache.get(key);
  if (cached?.revision === revision && cached.expires > Date.now()) return assertSessionPolicy({ ...user, ...cached.user });
  if (cached?.revision !== revision) invalidateRolesCache();
  const fresh = await runWithExecutor(service, async () => {
    await migratePermissionSnapshots(service);
    const identityRevision = await authorizationRevision(service.target.id);
    const legacyOwner = user.kind === "hosting" ? await hostingAccountRepository.findById(user.tenantId ?? user.userId, service) : undefined;
    const record = legacyOwner && legacyOwner.username === user.username
      ? await panelUserRepository.findByUsername(user.username) ?? await systemAccountsService.syncUserToDatabase(user.username)
      : await panelUserRepository.findById(user.userId);
    if (!record || record.username !== user.username || !record.enabled) throw new AuthError("Account disabled or no longer exists");
    const groups = await systemAccountsService.userGroups(record.username);
    const principal = legacyOwner ? { kind: "hosting", role: "hosting", modules: legacyOwner.allowedModules, permissions: legacyOwner.permissionTemplate } : await authTokenService.buildTokenPayload({ ...record, groups } as Parameters<typeof authTokenService.buildTokenPayload>[0]);
    const updated = { ...user, ...principal, userId: record.id, authorizationRevision: identityRevision } as SessionUser;
    const { rows } = await hostingAccountRepository.findAll({ limit: Number.MAX_SAFE_INTEGER }, service);
    const accounts = rows.filter(a => a.username === user.username || groups.includes(a.tenantGroup));
    if (accounts.length > 1) throw new ForbiddenError("Multiple hosting account memberships");
    const stored = accounts[0];
    if (user.tenantId !== undefined && (!stored || stored.id !== user.tenantId)) throw new AuthError("Hosting account membership changed");
    if (stored) {
      if (stored.status !== "active" || (stored.expiresAt && Date.parse(stored.expiresAt) <= Date.now())) throw new AuthError("Hosting account is inactive");
      if (groups.some(g => ["sudo", "wheel", "admin"].includes(g))) throw new ForbiddenError("Hosting account has privileged Linux membership");
      const account = await hostingTemplateService.project(service, stored);
      if (!account.templateId) {
        const root = (await getRolesForTarget()).find(r => r.name === account.tenantGroup);
        if (root) account.permissionTemplate = buildEffectivePermissions({ rolePermissions: root.permissions, modules: root.modules as string[], isAdminKind: false });
      }
      Object.assign(updated, { kind: "user", role: "user", tenantId: account.id, owner: account.username,
        tenantGroup: account.tenantGroup, homeRoot: account.homeRoot, maxSubUsers: account.maxSubUsers,
        maxDomains: account.maxDomains, maxEmailAccounts: account.maxEmailAccounts, maxDatabases: account.maxDatabases,
        diskQuotaMb: account.diskQuotaMb, bandwidthQuotaMb: account.bandwidthQuotaMb, jailEnabled: account.jailEnabled,
        hostingPolicy: { capabilities: account.runtimeCapabilities, expiresAt: account.expiresAt, revision: account.templateRevision ?? 0, state: account.policyState ?? "ready", security: account.security, runtime: !!account.templateId },
        modules: account.allowedModules, permissions: account.permissionTemplate });
      if (user.username !== account.username) {
        // Membership in h-owner links the account; it must not grant every
        // privilege in the provider-owned root matrix to its sub-users.
        const roles = (await getRolesForTarget()).filter(r => r.name !== account.tenantGroup && groups.includes(r.name));
        const own = mergeRolePermissions(roles.map(r => buildEffectivePermissions({ rolePermissions: r.permissions, modules: r.modules as string[], isAdminKind: false })));
        updated.permissions = clampPermissionsToEnvelope(getTenantEnvelope(updated), own);
      }
    }
    if (updated.kind !== "admin" && updated.permissions) {
      const catalog = getRolePermissionsCatalog();
      const reserved = new Set(catalog.modules.filter(m => m.actions.length > 0 && m.actions.every(a => catalog.actionMetadata[a]?.adminOnly)).map(m => m.module));
      updated.permissions = { ...updated.permissions,
        sidebar: (updated.permissions.sidebar ?? []).filter(id => !reserved.has(id)),
        views: (updated.permissions.views ?? []).filter(id => !reserved.has(id.replace(/^panel\./, ""))),
        actions: (updated.permissions.actions ?? []).filter(id => !catalog.actionMetadata[id]?.adminOnly),
      };
      updated.modules = deriveModulesFromPermissions(updated.permissions);
    }
    if (await authorizationRevision(service.target.id) !== identityRevision) throw new ForbiddenError("Authorization changed; retry the operation");
    return updated;
  });
  const stable = { ...fresh };
  // Bridge selection is request-specific; never cache it across tabs.
  delete stable.mfaAuthenticated; delete stable.sessionIssuedAt; delete stable.direct; delete stable.local;
  delete stable.bridgeSessionId; delete stable.targetId; delete stable.targetName; delete stable.targetHost;
  cache.set(key, { revision: fresh.authorizationRevision!, expires: Date.now() + 30_000, user: stable });
  if (cache.size > 5000) cache.delete(cache.keys().next().value!);
  return assertSessionPolicy(fresh);
}
