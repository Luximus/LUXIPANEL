type Result = { ok: boolean };
type Entry = { generation: number; until: number; pending: Promise<Result> };

/** Opt-in JSON reads only. Challenges, files, streams and live state stay out. */
export function listReadTtl(path: string): number | null {
  const route = path.split("?")[0];
  // Live JSON may share concurrent reads, but never retain settled values.
  if (/^\/api\/(?:ai\/stats\/(?:cli-quota|daily|usage-summary|usage|cost|savings)|monitor\/stats|chat\/unread-count|users\/sessions)$/.test(route ?? "")) return 0;
  return /^\/api\/(?:ai\/(?:bootstrap|config|projects|agents|agent-roles|conversations)|admin\/modules|users|roles|accounts|hosting\/accounts|backups(?:\/schedules|\/storages)?|cron\/jobs|webhooks|nginx\/sites|databases|firewall\/rules|obsidian\/vaults)$/.test(route ?? "") ? 20_000 : null;
}

export function createReadCache(now = Date.now) {
  const entries = new Map<string, Entry>();
  let generation = 0;
  const clear = () => { generation++; entries.clear(); };
  const trim = () => {
    if (entries.size <= 256) return;
    for (const [key, entry] of entries) if (entry.until !== Infinity && entry.until <= now()) entries.delete(key);
    for (const [key, entry] of entries) {
      if (entries.size <= 256) break;
      if (entry.until !== Infinity) entries.delete(key);
    }
  };
  return {
    clear,
    invalidate(predicate: (key: string) => boolean) { for (const key of entries.keys()) if (predicate(key)) entries.delete(key); },
    async read<T extends Result>(key: string, load: () => Promise<T>, ttl = 20_000, fresh = false): Promise<T> {
      const old = entries.get(key);
      if (old && (old.until === Infinity || (!fresh && old.until > now()))) return old.pending as Promise<T>;
      const epoch = generation;
      const entry: Entry = { generation: epoch, until: Infinity, pending: Promise.resolve({ ok: false }) };
      const task = Promise.resolve().then(load).then(value => {
        if (epoch !== generation || entries.get(key) !== entry) throw new Error("READ_INVALIDATED");
        if (value.ok) entry.until = now() + ttl;
        else entries.delete(key);
        trim();
        return value;
      }).catch(error => { if (entries.get(key) === entry) entries.delete(key); throw error; });
      entry.pending = task;
      entries.set(key, entry);
      trim();
      return task;
    },
  };
}

// Extracted scripts and React bundles share the same cache in this browser tab.
const slot = Symbol.for("luxipanel.read-cache.v2");
export function browserReadCache() {
  const host = window as unknown as Record<symbol, ReturnType<typeof createReadCache>>;
  if (!host[slot]) {
    const cache = createReadCache();
    host[slot] = cache;
    for (const event of ["luxipanel:target-changed", "luxipanel:logout", "luxipanel:session-ended", "luxipanel:permissions-changed",
      "lxp:assistant:agents-updated", "lxp:assistant:projects-updated", "lxp:assistant:connectors-updated", "lxp:assistant:conversations-updated"]) {
      window.addEventListener(event, cache.clear);
    }
  }
  return host[slot]!;
}
