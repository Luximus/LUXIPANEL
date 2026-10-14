import type { SessionUser } from "../types/index.js";
import { canUseModule, hasActionPermission, hasViewPermission, getRolePermissionsCatalog } from "../auth/role-permissions.js";
import { actionForHttp, actionRequiresAdmin } from "../auth/module-actions.js";
import { isHostingSession } from "../tenant/tenant-scope.js";
import { moduleRegistryService } from "../../modules/admin/services/module-registry.service.js";
import { LIVE_ROUTES } from "./response-freshness.js";

export const resources = Object.fromEntries(Object.entries(LIVE_ROUTES).map(([path, key]) => [key, {
  path, module: key.startsWith("nginx/") ? "dns" : key.startsWith("backup/") ? "backups" : key.split("/")[0]!,
}]));

/** Match the HTTP read gates. Hosting uses its scoped live loader and must
 * never subscribe to the administrative Redis stream (even metadata). */
export async function canReadResource(user: SessionUser, key: string): Promise<boolean> {
  const entry = Object.hasOwn(resources, key) ? resources[key] : undefined;
  if (!entry || isHostingSession(user)) return false;
  if (entry.module === "users") return user.kind === "admin" && hasViewPermission(user, "panel.users")
    && hasActionPermission(user, key === "users/roles" ? "roles.view" : "users.view");
  if (!canUseModule(user, entry.module)) return false;
  const action = actionForHttp(entry.module, "GET", entry.path);
  if (user.kind !== "admin" && action && (actionRequiresAdmin(action)
    || getRolePermissionsCatalog().actionMetadata[action]?.adminOnly || !hasActionPermission(user, action))) return false;
  return moduleRegistryService.isEnabled(entry.module);
}
