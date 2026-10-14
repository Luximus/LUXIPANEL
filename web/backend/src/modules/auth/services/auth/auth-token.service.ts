// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Auth service — JWT token-payload construction: per-user module resolution and
 * the group-union permission matrix. Part of the merged `authService` surface
 * (`authService.computeModules` / `authService.buildTokenPayload`). Pure code
 * movement out of auth.service.ts.
 */

import { panelUserRepository } from "../../repositories/index.js";
import type { TokenPayload } from "../token.service.js";
import { buildEffectivePermissions, mergeRolePermissions, deriveModulesFromPermissions } from "../role-permissions.service.js";
import { loginAclService } from "../login-acl.service.js";
import { getContextExecutor } from "../../../../shared/executor/context.js";
import { systemAccountsService } from "../../../users/services/system-accounts.service.js";
import { log, PRIVILEGED_ADMIN_GROUPS, sanitizeModules } from "./auth-shared.js";
import { getRolesForTarget } from "./auth-roles-cache.js";

export const authTokenService = {
  /**
   * Compute effective modules for a user.
   * If user has custom modules_json, use those; otherwise inherit from role.
   */
  /** Parse the optional per-user modules override (JSON array), [] if none. */
  computeModules(user: { modules?: string | null }): string[] {
    if (user.modules) {
      try {
        const parsed = JSON.parse(user.modules);
        if (Array.isArray(parsed)) return sanitizeModules(parsed.map(String));
      } catch {
        // fall through to empty
      }
    }
    return [];
  },

  /**
   * Build a JWT token payload from a panel user. Permissions derive from the
   * UNION of the permission records of every REAL Linux group the user belongs
   * to (`user.groups`, captured at sync — NO SSH here), plus the optional
   * per-user modules override. `kind=admin` if any contributing group (or the
   * override) carries the `admin` module. Empty union → dashboard-only.
   */
  async buildTokenPayload(user: {
    id: number;
    username: string;
    displayName?: string | null;
    modules?: string | null;
    groups?: string[] | null;
  }): Promise<TokenPayload> {
    const overrideModules = this.computeModules(user);

    // Resolve group names. Prefer the caller-provided list (login path); else
    // read the stored value (refresh/totp paths run inside the executor scope).
    let groupNames: string[] | null | undefined = user.groups;
    if (!groupNames || groupNames.length === 0) {
      // Stored groups are empty — typically an unprivileged login whose
      // syncUserToDatabase couldn't persist (can't write the config). A user
      // can always read its OWN Linux group membership (`id -nG`, no sudo), so
      // resolve live before falling back to the stored record.
      groupNames = await systemAccountsService.userGroups(user.username).catch(() => []);
      if (!groupNames || groupNames.length === 0) {
        const fresh = await panelUserRepository.findById(user.id).catch(() => undefined);
        groupNames = fresh?.groups ?? [];
      }
    }

    // Match the user's groups against the per-server permission records.
    let matched: Array<{ modules: string[]; permissions: Record<string, unknown> }> = [];
    try {
      const records = await getRolesForTarget();
      const want = new Set(groupNames);
      matched = records
        .filter((r) => want.has(r.name))
        .map((r) => ({
          modules: groupModulesForPermissions(r.modules, r.permissions, r.name),
          permissions: (r.permissions ?? {}) as Record<string, unknown>,
        }));
    } catch (err) {
      log.warn({ err }, "Failed to read group permission records; using override-only");
    }

    // Unprivileged login: the role sidecars aren't readable (sudo denied), so
    // `roleRepository.findAll()` came back empty. Fall back to the
    // world-readable login-acl mirror written by a privileged (admin) session.
    if (matched.length === 0 && (groupNames?.length ?? 0) > 0) {
      const acl = await loginAclService.read(getContextExecutor()).catch(() => null);
      if (acl) {
        const want = new Set(groupNames);
        matched = Object.entries(acl.groups)
          .filter(([name]) => want.has(name))
          .map(([name, g]) => ({
            modules: groupModulesForPermissions(g.modules, g.permissions, name),
            permissions: (g.permissions ?? {}) as Record<string, unknown>,
          }));
        if (matched.length > 0) log.info({ username: user.username, matched: matched.length }, "Permissions resolved via login-acl mirror");
      }
    }

    const groupModules = matched.flatMap((m) => m.modules);
    // Membership in a privileged Linux group (sudo/wheel) grants full admin,
    // regardless of the per-group permission records — inject the `admin`
    // module so the admin path below builds the all-access matrix.
    const isPrivilegedByGroup = (groupNames ?? []).some((g) =>
      PRIVILEGED_ADMIN_GROUPS.has(String(g).trim().toLowerCase()),
    );
    const modules = sanitizeModules([
      ...new Set([...overrideModules, ...groupModules, ...(isPrivilegedByGroup ? ["admin"] : [])]),
    ]);
    const isAdmin = isPrivilegedByGroup || (groupNames ?? []).includes("admin") || overrideModules.includes("admin");

    let permissions;
    if (isAdmin) {
      permissions = buildEffectivePermissions({ rolePermissions: {}, modules, isAdminKind: true });
    } else {
      // One effective matrix per contributing group, plus one for the override
      // modules, then union them (most-permissive). Empty → dashboard default.
      const matrices = matched.map((m) =>
        buildEffectivePermissions({ rolePermissions: m.permissions, modules: m.modules, isAdminKind: false }),
      );
      if (overrideModules.length > 0) {
        matrices.push(buildEffectivePermissions({ rolePermissions: {}, modules: overrideModules, isAdminKind: false }));
      }
      permissions =
        matrices.length > 0
          ? mergeRolePermissions(matrices)
          : buildEffectivePermissions({ rolePermissions: {}, modules: [], isAdminKind: false });
    }

    // A privileged (admin) session CAN read the role sidecars and write the
    // config — refresh the world-readable mirror so unprivileged logins can
    // resolve their group permissions. Fire-and-forget; never blocks login.
    if (isAdmin) {
      void loginAclService.refresh(getContextExecutor()).catch((err) => {
        // Best-effort mirror refresh. A transient SSH failure here must NEVER
        // surface as an unhandledRejection (server.ts turns those into
        // process.exit(1) = full backend crash). Log accionable and move on —
        // the next admin login retries the refresh.
        log.warn({ err, username: user.username }, "login-acl mirror refresh failed (best-effort)");
      });
    }

    log.info(
      {
        username: user.username,
        groupNames,
        roleRecords: matched.length,
        matchedModules: groupModules,
        overrideModules,
        resultModules: modules,
        kind: isAdmin ? "admin" : "user",
        sidebar: (permissions as { sidebar?: string[] }).sidebar,
      },
      "buildTokenPayload: resolved permissions",
    );

    return {
      userId: user.id,
      username: user.username,
      displayName: user.displayName || user.username,
      role: isAdmin ? "admin" : "user",
      modules,
      kind: isAdmin ? "admin" : "user",
      permissions,
    };
  },
};

/** Explicit matrices are authoritative; recompute their derived module list
 * so old records cannot turn file actions into an accidental admin grant.
 * Empty legacy matrices still support intentional module-level grants. */
function groupModulesForPermissions(modules: unknown, permissions: unknown, name: string): string[] {
  // The reserved real admin group is the explicit all-access group managed by
  // rolesService. Its matrix cannot accidentally downgrade its membership.
  if (name === "admin") return ["admin"];
  const p = permissions as Record<string, unknown> | null;
  if (p && (p.version === 2 || ["sidebar", "views", "actions"].some((key) => Array.isArray(p[key]) && (p[key] as unknown[]).length > 0))) {
    return deriveModulesFromPermissions(p).filter(m => m !== "admin");
  }
  return Array.isArray(modules) ? sanitizeModules(modules.map(String)).filter(m => m !== "admin") : [];
}
