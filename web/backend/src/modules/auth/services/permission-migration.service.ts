import { invalidateRolesCache } from "./auth/auth-roles-cache.js";
import { kv } from "../../../shared/kv-store/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import { roleRepository } from "../../users/repositories/role.repository.js";
import { buildEffectivePermissions } from "../../../shared/auth/role-permissions.js";
import { authorizationChanged } from "../../../shared/auth/authorization-revision.js";
const migrations = new Map<string, Promise<void>>();
/** Freeze legacy module defaults/wildcards once, before authenticating on a
 * target. Existing internal groups keep their names and Linux membership. */
export function migratePermissionSnapshots(executor: Executor): Promise<void> {
  const key = executor.target.id;
  const existing = migrations.get(key);
  if (existing) return existing;
  const migration = (async () => {
    // An ordinary SSH identity can read its login mirror, but cannot rewrite
    // protected server records. Leave its migration for a service/admin scope.
    const privilege = await executor.exec('test "$(id -u)" = 0 || sudo -n true', { timeoutMs: 5000 });
    if (privilege.exitCode !== 0) { migrations.delete(key); return; }
    const roles = await roleRepository.findAll(executor);
    let changed = false;
    for (const role of roles) {
      if ((role.permissions as { version?: unknown }).version === 2) continue;
      const backups = kv(executor).module("users").collection<Record<string, unknown>>("permission-migration-original");
      if (!await backups.get(String(role.id))) await backups.set(String(role.id), { ...role, savedAt: new Date().toISOString() });
      const permissions = buildEffectivePermissions({ rolePermissions: role.permissions, modules: role.modules as string[], isAdminKind: role.name === "admin" });
      permissions.version = 2;
      await roleRepository.update(role.id, { permissions: permissions as unknown as Record<string, unknown> }, executor);
      changed = true;
    }
    invalidateRolesCache();
    if (changed) await authorizationChanged(executor.target.id);
  })();
  migrations.set(key, migration);
  void migration.catch(() => migrations.delete(key));
  return migration;
}
