import { filterTenantUsers, type TenantEnvelope } from "../../../shared/tenant/tenant-scope.js";

type UserRecord = { username: string; homeDir?: string | null };
type PanelUserRecord = { username: string; groups?: string[] | null };

/** Sessions are read VPS-wide; only return keys whose account belongs to the tenant. */
export function scopeSessionMap<T>(
  sessions: Record<string, T>,
  linuxUsers: UserRecord[],
  panelUsers: PanelUserRecord[],
  env: TenantEnvelope,
): Record<string, T> {
  const groupsByName = new Map(panelUsers.map((user) => [user.username.toLowerCase(), user.groups ?? []]));
  const permitted = new Set(filterTenantUsers(env, linuxUsers.map((user) => ({
    username: user.username,
    homeDir: user.homeDir,
    groups: groupsByName.get(user.username.toLowerCase()) ?? [],
  }))).map((user) => user.username));
  return Object.fromEntries(Object.entries(sessions).filter(([name]) => permitted.has(name)));
}
