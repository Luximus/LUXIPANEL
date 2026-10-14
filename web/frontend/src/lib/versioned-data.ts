/** Only bounded JSON lists participate; secrets, files and live metrics do not. */
export const dataResources: Readonly<Record<string, string>> = {
  "/api/users": "users/system", "/api/roles": "users/roles",
  "/api/nginx/sites": "nginx/sites", "/api/accounts": "mail/accounts",
  "/api/cron/jobs": "cron/jobs", "/api/firewall/rules": "firewall/rules",
  "/api/backups/schedules": "backup/schedules", "/api/webhooks": "webhooks/webhooks",
};
export const resourceForPath = (path: string) => dataResources[path.split("?")[0] ?? ""];
export type Freshness = {version: string; state: "fresh" | "stale" | "offline" | "updating"; collectedAt: number; checkedAt: number};
type Response = {ok: boolean; data?: unknown; meta?: Record<string, unknown>};
type Entry = {value: Response; version: string; bytes: number; until: number};
/** Memory only, scoped by the caller's complete session/query identity. */
export function createVersionedData() {
  const entries = new Map<string, Entry>();
  const pending = new Map<string, Promise<Response>>();
  let generation = 0;
  return {
    clear() { generation++; entries.clear(); pending.clear(); },
    invalidate(predicate: (key: string) => boolean) { for (const key of pending.keys()) if (predicate(key)) pending.delete(key); },
    async read<T extends Response>(key: string, load: (knownVersion?: string) => Promise<T>): Promise<T> {
      const active = pending.get(key); if (active) return active as Promise<T>;
      const epoch = generation;
      let task!: Promise<T>;
      task = (async () => {
        let old = entries.get(key);
        if (old && old.until < Date.now()) { entries.delete(key); old = undefined; }
        let value = await load(old?.version);
        if (epoch !== generation || pending.get(key) !== task) throw new Error("READ_INVALIDATED");
        if (value.ok && value.meta?.unchanged === true) {
          if (!old) value = await load(); // Recovery after eviction/older server.
          else value = {...value, data: old.value.data};
        }
        if (epoch !== generation || pending.get(key) !== task) throw new Error("READ_INVALIDATED");
        const version = (value.meta?.freshness as Freshness | undefined)?.version;
        if (value.ok && typeof version === "string" && "data" in value) {
          const bytes = JSON.stringify(value).length * 2;
          entries.delete(key);
          if (bytes <= 8 * 1024 * 1024) entries.set(key, {value, version, bytes, until: Date.now() + 300_000});
          while (entries.size > 128 || [...entries.values()].reduce((sum, entry) => sum + entry.bytes, 0) > 8 * 1024 * 1024)
            entries.delete(entries.keys().next().value!);
        }
        return value;
      })().finally(() => { if (pending.get(key) === task) pending.delete(key); });
      pending.set(key, task); return task;
    },
  };
}
const slot = Symbol.for("luxipanel.versioned-data.v1");
export function browserVersionedData() {
  const host = globalThis as unknown as Record<symbol, ReturnType<typeof createVersionedData>>;
  if (!host[slot]) {
    const cache = host[slot] = createVersionedData();
    for (const event of ["luxipanel:target-changed", "luxipanel:session-started", "luxipanel:logout", "luxipanel:session-ended", "luxipanel:permissions-changed"])
      globalThis.addEventListener(event, () => cache.clear());
  }
  return host[slot]!;
}
