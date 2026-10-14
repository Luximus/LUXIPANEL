export const dataResources: Readonly<Record<string, string>> = {
  "/api/users": "users/system", "/api/roles": "users/roles", "/api/nginx/sites": "nginx/sites",
  "/api/accounts": "mail/accounts", "/api/cron/jobs": "cron/jobs", "/api/firewall/rules": "firewall/rules",
  "/api/backups/schedules": "backup/schedules", "/api/webhooks": "webhooks/webhooks",
};
export const resourceForPath = (path: string) => dataResources[path.split("?")[0] ?? ""];
export const resourcesForModule: Record<string, string[]> = {
  users: ["users/system", "users/roles"], dns: ["nginx/sites"], nginx: ["nginx/sites"],
  mail: ["mail/accounts"], cron: ["cron/jobs"], firewall: ["firewall/rules"],
  backups: ["backup/schedules"], webhooks: ["webhooks/webhooks"],
};
export type Freshness = {state: "fresh" | "stale" | "offline" | "updating"; version?: string; collectedAt?: number; checkedAt?: number; failedAt?: number};
type Reply = {ok: boolean; data?: any};
const status = new Map<string, Freshness>();
const observers = new Set<() => void>();
export const listenFreshness = (listener: () => void) => {observers.add(listener); return () => {observers.delete(listener);};};
export const getFreshness = (server: string, resource: string) => status.get(JSON.stringify([server, resource]));
export function reportFreshness(server: string, resource: string, value: Freshness) {
  const key = JSON.stringify([server, resource]), previous = status.get(key);
  const next = {...previous, ...value};
  if (next.failedAt && next.state === "fresh") {
    if ((next.collectedAt ?? 0) < next.failedAt) next.state = "stale";
    else delete next.failedAt;
  }
  status.set(key, next);
  while (status.size > 128) status.delete(status.keys().next().value!);
  for (const listener of observers) listener();
}
export function createVersionedReads() {
  const entries = new Map<string, {server: string; value: Reply; version: string; bytes: number; until: number}>();
  // Track cancellation for the lifetime of each request. Evicting retained
  // payloads must never evict the identity of an unfinished request.
  type Read = {key: string; server: string; invalidated: boolean; cancelled: boolean};
  const active = new Set<Read>();
  return {
    invalidate(match: (key: string) => boolean) {
      for (const read of active) if (match(read.key)) read.invalidated = true;
    },
    clear(server?: string) {
      for (const [key, entry] of entries) if (server === undefined || entry.server === server) entries.delete(key);
      for (const read of active) if (server === undefined || read.server === server) read.cancelled = true;
      for (const key of status.keys()) if (server === undefined || JSON.parse(key)[0] === server) status.delete(key);
      for (const listener of observers) listener();
    },
    async read<T extends Reply>(key: string, server: string, path: string, load: (path: string) => Promise<T>, attempt = 0): Promise<T> {
      const resource = resourceForPath(path); if (!resource) return load(path);
      const reading: Read = {key, server, invalidated: false, cancelled: false};
      active.add(reading);
      const cancelled = () => ({ok:false,status:409,code:"READ_INVALIDATED"}) as unknown as T;
      const recover = () => !reading.cancelled && attempt < 1 ? this.read(key, server, path, load, attempt + 1) : Promise.resolve(cancelled());
      try {
        let old = entries.get(key);
        if (old && old.until < Date.now()) {entries.delete(key); old = undefined;}
        let result = await load(old ? `${path}${path.includes("?") ? "&" : "?"}knownVersion=${encodeURIComponent(old.version)}` : path);
        if (reading.cancelled || reading.invalidated) return recover();
        if (result.ok && result.data?.meta?.unchanged === true) {
          if (old) result = {...result, data: {...result.data, data: old.value.data?.data}};
          else result = await load(path);
        }
        if (reading.cancelled || reading.invalidated) return recover();
        const freshness = result.data?.meta?.freshness;
        if (result.ok && typeof freshness?.version === "string" && "data" in (result.data ?? {})) {
          const bytes = JSON.stringify(result).length * 2;
          entries.delete(key);
          if (bytes <= 8 * 1024 * 1024) entries.set(key, {server, value: result, version: freshness.version, bytes, until: Date.now() + 300_000});
          while (entries.size > 128 || [...entries.values()].reduce((sum, entry) => sum + entry.bytes, 0) > 8 * 1024 * 1024) entries.delete(entries.keys().next().value!);
        }
        reportFreshness(server, resource, result.ok ? freshness ?? {state:"fresh", checkedAt:Date.now()/1000} : {state:"offline"});
        return result;
      } finally { active.delete(reading); }
    },
  };
}
