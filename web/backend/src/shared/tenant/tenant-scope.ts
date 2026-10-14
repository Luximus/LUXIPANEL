// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Tenant-scope helper (Fase 3) — single source of truth for clamping the Users
 * module to a hosting tenant's envelope.
 *
 * Background: a `kind:"hosting"` session runs through a PrivilegeDropExecutor
 * that executes everything as `sudo -u <owner>` (the owner has NO sudo). The
 * owner can NOT read the root-owned `/etc/luxipanel` sidecar, so the tenant
 * envelope (owner / tenantGroup / homeRoot / maxSubUsers / allowedModules /
 * permissionTemplate) is carried in the signed JWT (see auth.service.loginHosting
 * + token.service). This module is the ONLY place that knows the envelope rules.
 *
 * SECURITY MODEL: user mutations (useradd/groupadd/gpasswd) are privileged and
 * are applied by the on-box write-behind worker with ITS sudo — NOT by the
 * dropped owner. The worker is generic and does not re-validate. Therefore ALL
 * security lives here: every list/create/update/delete/role op CLAMPS its
 * input to the envelope BEFORE the step recipe is built/submitted. Never trust
 * client-provided groups/home/modules/permissions for a hosting session.
 *
 * Pure module: imports no express. Called from users.service / users.controller
 * / roles.service / roles.controller, all gated by `isHostingSession()`.
 */

import { createHash } from "node:crypto";
import type { SessionUser } from "../types/index.js";
import type { RolePermissionsData } from "../auth/role-permissions.js";
import { ForbiddenError, ValidationError } from "../errors/index.js";
import { isPathUnder } from "../utils/path-containment.js";

/** System users/groups a tenant may NEVER manage, assign, become, or collide
 *  with. Privilege-bearing groups (sudo/wheel/admin/staff/adm) are the critical
 *  ones; the rest block accidental clobbering of base accounts. */
const FORBIDDEN_NAMES = new Set([
  "root", "admin", "sudo", "wheel", "staff", "adm",
  "bin", "sys", "daemon", "nobody", "www-data",
]);

export interface TenantEnvelope {
  /** Owner's primary Linux user — also a member of its own tenant. */
  owner: string;
  /** Linux group joining all sub-users (e.g. `h-<owner>`). */
  tenantGroup: string;
  /** Tenant filesystem root (e.g. `/home/<owner>`). */
  homeRoot: string;
  /** Max sub-users the account may create. */
  maxSubUsers: number;
  /** Live account quotas. Missing limits deny resource creation. */
  maxDomains: number;
  maxEmailAccounts: number;
  maxDatabases: number;
  diskQuotaMb: number;
  /** Modules the reseller exposes to the tenant (= session.modules). */
  allowedModules: string[];
  /** Ceiling permission matrix (= session.permissions). */
  permissionTemplate: RolePermissionsData;
}

/** Resource isolation also applies to ordinary panel users linked to a tenant.
 * The scope does not select a UI or replace group-derived permissions. */
export function isHostingSession(u: SessionUser | undefined | null): boolean {
  return !!u && (u.kind === "hosting" || (u.kind === "user" && u.tenantId !== undefined));
}

/**
 * Build the envelope from a hosting SessionUser. Throws (fail-closed) if any
 * field is missing — e.g. a token minted before Fase 3 — so a stale token can
 * NEVER silently fall back to unrestricted behaviour.
 */
export function getTenantEnvelope(u: SessionUser): TenantEnvelope {
  const rawHomeRoot = u.homeRoot ?? u.permissions?.fileAccess.allowPaths?.[0];
  if (!u.owner || !u.tenantGroup || !rawHomeRoot || u.maxSubUsers === undefined) {
    throw new ForbiddenError("Sesión de hosting incompleta (vuelve a iniciar sesión)");
  }
  // SECURITY: homeRoot is the boundary for isTenantMember() (home-under-root
  // check). A degenerate value (`/`, a relative path, or one containing `..`)
  // would make almost every VPS user "inside the tenant" → cross-tenant
  // exposure. Reject it fail-closed instead of trusting the token/sidecar.
  const homeRoot = rawHomeRoot.replace(/\/+$/, "");
  if (
    !homeRoot.startsWith("/") ||
    homeRoot === "" ||
    homeRoot === "/" ||
    homeRoot.split("/").includes("..")
  ) {
    throw new ForbiddenError("Configuración de tenant inválida (homeRoot)");
  }
  return {
    owner: u.owner,
    tenantGroup: u.tenantGroup,
    homeRoot,
    maxSubUsers: u.maxSubUsers,
    maxDomains: u.maxDomains ?? 0,
    maxEmailAccounts: u.maxEmailAccounts ?? 0,
    maxDatabases: u.maxDatabases ?? 0,
    diskQuotaMb: u.diskQuotaMb ?? 0,
    allowedModules: u.modules ?? [],
    permissionTemplate: (u.permissions ?? EMPTY_TEMPLATE) as RolePermissionsData,
  };
}

const EMPTY_TEMPLATE: RolePermissionsData = {
  sidebar: [], views: [], actions: [],
  fileAccess: { allowAll: false, allowPaths: [], denyPaths: [], readOnlyPaths: [], defaultPath: null },
  commandPolicy: { allowAll: false, groups: [], allowCommands: [], denyCommands: [] },
};

/** Canonical prefix for tenant-local groups the account may create
 *  (e.g. `h-operator-`). */
export function tenantGroupPrefix(env: TenantEnvelope): string {
  return `${env.tenantGroup}-`;
}

/** A group name the tenant is allowed to reference/create: the tenant group
 *  itself or one of its `h-<owner>-*` children. Never a system/privileged name. */
export function isTenantGroupName(env: TenantEnvelope, name: string): boolean {
  const g = name.trim();
  if (FORBIDDEN_NAMES.has(g)) return false;
  return g === env.tenantGroup || g.startsWith(tenantGroupPrefix(env));
}

type UserLike = { username: string; groups?: string[] | null; homeDir?: string | null };

/** Whether `user` belongs to the tenant: it's the owner, a member of the tenant
 *  group, or its home is under homeRoot. */
export function isTenantMember(env: TenantEnvelope, user: UserLike): boolean {
  if (user.username === env.owner) return true;
  if (user.groups?.includes(env.tenantGroup)) return true;
  const home = (user.homeDir ?? "").replace(/\/+$/, "");
  if (home && isPathUnder(env.homeRoot, home)) return true;
  return false;
}

/** Filter a user list down to the tenant's members only. */
export function filterTenantUsers<T extends UserLike>(env: TenantEnvelope, users: T[]): T[] {
  return users.filter((u) => isTenantMember(env, u));
}

/** Clamp assignable groups to {tenantGroup, tenantGroup-*}; drop everything
 *  else (system/privileged groups, other tenants' groups). */
export function clampGroupsToTenant(env: TenantEnvelope, groups: string[] | undefined): string[] {
  return [...new Set((groups ?? []).map((g) => g.trim()).filter((g) => isTenantGroupName(env, g)))];
}

/** Clamp module slugs to the tenant's allowedModules. */
export function clampModulesToTenant(env: TenantEnvelope, modules: string[] | undefined): string[] {
  const allowed = new Set(env.allowedModules);
  return (modules ?? []).filter((m) => allowed.has(m));
}

/**
 * Shared body of the four `assertWithin*Quota` helpers below.
 *
 * NOTE — deliberately NOT unified with `quota/quota-checker.ts#assertResourceQuota`:
 * that one throws `QuotaExceededError` (HTTP **402**) while these throw
 * `ValidationError` (HTTP **400**), and the frontend distinguishes them. Only
 * the duplicated body is factored out; the status/message contract is untouched.
 */
function assertWithinQuota(currentCount: number, cap: number, label: string): void {
  if (currentCount >= cap) {
    throw new ValidationError(`Cupo de ${label} alcanzado (${cap}).`);
  }
}

/** Throw if creating one more sub-user would exceed the quota. `currentCount`
 *  is the number of sub-users that already exist (owner NOT counted). */
export function assertWithinSubUserQuota(env: TenantEnvelope, currentCount: number): void {
  assertWithinQuota(currentCount, env.maxSubUsers, "sub-usuarios");
}

// ── Fase 6: resource-count quotas ────────────────────────────────────────
// Each asserts BEFORE a create, given the count of resources ALREADY OWNED by
// the tenant (see the per-module tenant filters below). Infinity caps (legacy
// tokens) never throw.

/** Throw if creating one more domain/vhost would exceed the tenant's cap. */
export function assertWithinDomainQuota(env: TenantEnvelope, currentCount: number): void {
  assertWithinQuota(currentCount, env.maxDomains, "dominios");
}

/** Throw if creating one more mail account would exceed the tenant's cap. */
export function assertWithinEmailQuota(env: TenantEnvelope, currentCount: number): void {
  assertWithinQuota(currentCount, env.maxEmailAccounts, "cuentas de correo");
}

/** Throw if creating one more database would exceed the tenant's cap. */
export function assertWithinDatabaseQuota(env: TenantEnvelope, currentCount: number): void {
  assertWithinQuota(currentCount, env.maxDatabases, "bases de datos");
}

// ── Fase 6: tenant-ownership filters ─────────────────────────────────────
// SECURITY BOUNDARY: in a hosting session the executor runs as `sudo -u owner`,
// so module list()s (nginx sites / mail accounts / databases) may show MORE
// than the tenant strictly owns. Counting/authorizing therefore filters by:
//   - nginx: docroot under homeRoot,
//   - mail:  domain ∈ the tenant's vhost domains,
//   - db:    name prefixed with `<owner>_`.

/** A vhost belongs to the tenant when its docroot lives under homeRoot. */
export function isTenantDomainRoot(env: TenantEnvelope, docRoot: string | null | undefined): boolean {
  const r = (docRoot ?? "").replace(/\/+$/, "");
  return !!r && isPathUnder(env.homeRoot, r);
}

/** Canonical prefix tenant databases must use. Linux usernames can contain
 * hyphens, which are unsuitable for our SQL identifier policy; those accounts
 * receive a stable hashed prefix. */
export function tenantDbPrefix(env: TenantEnvelope): string {
  if (/^[a-z][a-z0-9_]*$/.test(env.owner)) return `${env.owner}_`;
  return `lxp_${createHash("sha256").update(env.owner).digest("hex").slice(0, 16)}_`;
}

/** A database name the tenant owns/may create. Longer registered usernames
 * take precedence, so `foo_` never captures `foo_bar_database`. */
export function isTenantDbName(env: TenantEnvelope, name: string, otherOwners: string[] = []): boolean {
  return name.startsWith(tenantDbPrefix(env))
    && !otherOwners.some((owner) => owner !== env.owner && owner.length > env.owner.length
      && /^[a-z][a-z0-9_]*$/.test(owner) && name.startsWith(`${owner}_`));
}

/** A mail address belongs to the tenant when its domain is one the tenant owns
 *  (`tenantDomains` = lowercased domains derived from the tenant's vhosts). */
export function isTenantMailAddress(tenantDomains: Set<string>, address: string): boolean {
  const at = address.lastIndexOf("@");
  return at > 0 && tenantDomains.has(address.slice(at + 1).toLowerCase());
}

/** Throw if `username` is a system/privileged name a tenant may never manage. */
export function assertTenantUsernameSafe(username: string): void {
  if (FORBIDDEN_NAMES.has(username.trim())) {
    throw new ValidationError(`No puedes gestionar el usuario de sistema "${username}".`);
  }
}

/** Throw unless `user` is a member of the tenant. */
export function assertTargetInTenant(env: TenantEnvelope, user: UserLike): void {
  if (!isTenantMember(env, user)) {
    throw new ForbiddenError("No puedes operar sobre un usuario fuera de tu tenant.");
  }
}

/** The owner is never deleted or renamed from the Users module. */
export function assertNotOwner(env: TenantEnvelope, username: string): void {
  if (username === env.owner) {
    throw new ForbiddenError("No puedes eliminar/renombrar al titular de la cuenta.");
  }
}

/** Throw unless a group name is a tenant-local group (for create). */
export function assertTenantGroupCreatable(env: TenantEnvelope, name: string): void {
  const g = name.trim();
  if (g === env.tenantGroup) {
    throw new ValidationError("El grupo raíz del tenant lo gestiona tu proveedor.");
  }
  if (!g.startsWith(tenantGroupPrefix(env))) {
    throw new ValidationError(`Los grupos deben empezar por "${tenantGroupPrefix(env)}".`);
  }
  if (FORBIDDEN_NAMES.has(g)) {
    throw new ForbiddenError(`Nombre de grupo reservado: "${g}".`);
  }
}

/** Throw unless a group name is a tenant-local CHILD group the tenant may
 *  edit/delete (never the root tenant group, never a system group). */
export function assertTenantGroupMutable(env: TenantEnvelope, name: string): void {
  const g = name.trim();
  if (g === env.tenantGroup) {
    throw new ForbiddenError("No puedes modificar/eliminar el grupo raíz del tenant.");
  }
  if (!g.startsWith(tenantGroupPrefix(env)) || FORBIDDEN_NAMES.has(g)) {
    throw new ForbiddenError("Solo puedes gestionar los grupos de tu tenant.");
  }
}

/**
 * Clamp a permission matrix to the envelope, for tenant-local group records:
 *   - sidebar/views/actions ⊆ permissionTemplate (the ceiling)
 *   - fileAccess clamped to homeRoot (allowAll→[homeRoot]; paths outside dropped;
 *     "/" rewritten to homeRoot); never allowAll
 *   - commandPolicy.allowAll forced false; groups ⊆ template.commandPolicy.groups
 * Modules derived downstream from the CLAMPED matrix are therefore ⊆ the
 * template's surface; callers additionally intersect with allowedModules.
 */
export function clampPermissionsToEnvelope(
  env: TenantEnvelope,
  original: RolePermissionsData,
): RolePermissionsData {
  const t = env.permissionTemplate;
  const sb = new Set(t.sidebar);
  const vw = new Set(t.views);
  const ac = new Set(t.actions);
  const acPrefixes = new Set([...t.actions].filter((a) => a.endsWith(".*")));
  const root = env.homeRoot;
  const inRoot = (p: string): boolean => isPathUnder(root, p);
  const clampPath = (p: string): string | null => (inRoot(p) ? p : p === "/" ? root : null);
  const clampList = (ps: string[]): string[] =>
    ps.map(clampPath).filter((p): p is string => p !== null);
  // An action passes if listed, or if the template granted its "<prefix>.*".
  const actionAllowed = (a: string): boolean =>
    ac.has(a) || acPrefixes.has(`${a.split(".")[0]}.*`);

  const fa = original.fileAccess;
  const proposed = fa.allowAll ? [root] : clampList(fa.allowPaths);
  const parent = t.fileAccess;
  const parentPaths = parent.allowAll ? [root] : clampList(parent.allowPaths);
  const allowPaths = [...new Set(proposed.flatMap((path) => parentPaths.flatMap((ceiling) =>
    isPathUnder(ceiling, path) ? [path] : isPathUnder(path, ceiling) ? [ceiling] : [],
  )))];

  return {
    sidebar: original.sidebar.filter((s) => sb.has(s)),
    views: original.views.filter((v) => vw.has(v)),
    actions: original.actions.filter((a) => actionAllowed(a)),
    fileAccess: {
      allowAll: false,
      allowPaths,
      denyPaths: [...new Set(clampList([...fa.denyPaths, ...parent.denyPaths,
        ...(parent.grants ?? []).flatMap((grant) => grant.denyPaths)]))],
      readOnlyPaths: [...new Set(clampList([...fa.readOnlyPaths, ...parent.readOnlyPaths]))],
      defaultPath: fa.defaultPath && inRoot(fa.defaultPath) ? fa.defaultPath : root,
    },
    commandPolicy: {
      allowAll: false,
      groups: original.commandPolicy.groups.filter((g) => t.commandPolicy.groups.includes(g)),
      allowCommands: original.commandPolicy.allowCommands.filter((command) => t.commandPolicy.allowCommands.includes(command)),
      denyCommands: [...new Set([...original.commandPolicy.denyCommands, ...t.commandPolicy.denyCommands,
        ...(t.commandPolicy.grants ?? []).flatMap((grant) => grant.denyCommands)])],
    },
  };
}
