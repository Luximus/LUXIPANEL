import type { RolePermissionsData } from "../../../shared/auth/role-permissions.js";
import { normalizeRolePermissions } from "../../../shared/auth/role-permissions.js";

export interface HostingPermissionOverrides {
  sidebar: string[];
  views: string[];
  actions: string[];
  fileAccess?: RolePermissionsData["fileAccess"];
  commandPolicy?: RolePermissionsData["commandPolicy"];
}

/** Store individual reductions independently of the last rendered projection.
 * A permission temporarily removed from a plan must stay individually denied
 * when that permission is added to a later revision. */
export function hostingPermissionOverrides(base: RolePermissionsData, group: RolePermissionsData): HostingPermissionOverrides {
  const result: HostingPermissionOverrides = { sidebar: [], views: [], actions: [] };
  for (const key of ["sidebar", "views", "actions"] as const) result[key] = base[key].filter(id => !group[key].includes(id));
  if (JSON.stringify(base.fileAccess) !== JSON.stringify(group.fileAccess)) result.fileAccess = structuredClone(group.fileAccess);
  if (JSON.stringify(base.commandPolicy) !== JSON.stringify(group.commandPolicy)) result.commandPolicy = structuredClone(group.commandPolicy);
  return result;
}

/** A stored group is a projection, not a second source of plan policy. Rebase
 * explicit differences onto a new ceiling. Removed grants cannot survive. */
export function rebaseHostingPermissions(previous: RolePermissionsData, group: RolePermissionsData, next: RolePermissionsData, stored?: HostingPermissionOverrides): RolePermissionsData {
  const overrides = stored ?? hostingPermissionOverrides(previous, group);
  const result = structuredClone(next);
  for (const key of ["sidebar", "views", "actions"] as const) {
    const removed = new Set(overrides[key]);
    result[key] = next[key].filter(id => !removed.has(id));
  }
  const under = (root: string, p: string) => p === root || p.startsWith(root + "/");
  if (overrides.fileAccess) {
    const policy = overrides.fileAccess;
    result.fileAccess = { ...policy, allowAll: false,
      allowPaths: [...new Set(policy.allowPaths.flatMap(p => next.fileAccess.allowPaths.flatMap(root => under(root, p) ? [p] : under(p, root) ? [root] : [])))],
      denyPaths: [...new Set([...next.fileAccess.denyPaths, ...policy.denyPaths])],
      readOnlyPaths: [...new Set([...next.fileAccess.readOnlyPaths, ...policy.readOnlyPaths])],
    };
  }
  if (overrides.commandPolicy) {
    const policy = overrides.commandPolicy;
    result.commandPolicy = { allowAll: false,
      groups: policy.groups.filter(g => next.commandPolicy.groups.includes(g)),
      allowCommands: policy.allowCommands.filter(c => next.commandPolicy.allowCommands.includes(c)),
      denyCommands: [...new Set([...next.commandPolicy.denyCommands, ...policy.denyCommands])],
    };
  }
  const start = result.fileAccess.defaultPath;
  if (start && (!result.fileAccess.allowPaths.some(root => under(root, start)) || result.fileAccess.denyPaths.some(root => under(root, start)))) result.fileAccess.defaultPath = result.fileAccess.allowPaths[0] ?? null;
  return normalizeRolePermissions(result);
}

/** Explicit account reductions survive later plan changes, but never exceed
 * the current ceiling. A removed grant/raised quota is never inferred. */
export function projectHostingLimits(ceiling: import("../models/hosting-template.model.js").HostingLimits, overrides: Partial<import("../models/hosting-template.model.js").HostingLimits> = {}) {
  const result = { ...ceiling };
  for (const key of Object.keys(ceiling) as (keyof typeof ceiling)[]) {
    if (overrides[key] !== undefined) result[key] = Math.min(ceiling[key], overrides[key]!);
  }
  return result;
}
