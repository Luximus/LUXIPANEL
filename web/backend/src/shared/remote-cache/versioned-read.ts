import type { Executor } from "../executor/types.js";
import { gunzipB64 } from "./codec.js";
import { cacheIdentity, liveFeatures } from "./live-config.js";
import { persistentCache, cacheAccessAllowed } from "./persistent-client.js";
import { getRemoteCacheConn } from "./conn.js";
import { execWithRedisAuth, redisBase, escapeSingleQuoted } from "./redis-cli.js";
import type { CacheMeta } from "./index.js";

export const READ_VERSIONED = `
local raw = redis.call('GET', KEYS[1])
if not raw then return {} end
local meta = cjson.decode(raw)
if meta.version == ARGV[1] then return {raw, ''} end
local data = redis.call('GET', KEYS[2] .. meta.version)
if not data then return {} end
return {raw, data}
`;
type Snapshot = {meta: CacheMeta; rows: unknown[]; expires: number; bytes: number};
const memo = new Map<object, Map<string, Snapshot>>();
const pending = new WeakMap<object, Map<string, Promise<Snapshot | null>>>();
const snapshotName = (module: string, collection: string, scope?: string) => `${module}:${collection}${scope === undefined ? "" : `:scope:${scope}`}`;
export function forgetVersioned(executor: Executor, module?: string, collection?: string, scope?: string) {
  const identity = cacheIdentity(executor);
  if (module !== undefined && collection !== undefined) {
    const name = snapshotName(module, collection, scope);
    memo.get(identity)?.delete(name); pending.get(identity)?.delete(name);
  } else { memo.delete(identity); pending.delete(identity); }
}

export async function readVersioned(executor: Executor, module: string, collection: string, scope?: string): Promise<Snapshot | null> {
  if (!cacheAccessAllowed(executor)) return null;
  if (![module, collection, ...(scope === undefined ? [] : [scope])].every(x => /^[a-zA-Z0-9_-]{1,64}$/.test(x))) return null;
  const identity = cacheIdentity(executor), name = snapshotName(module, collection, scope);
  let inflight = pending.get(identity);
  if (!inflight) { inflight = new Map(); pending.set(identity, inflight); }
  const existing = inflight.get(name); if (existing) return existing;
  let task!: Promise<Snapshot | null>;
  const current = () => pending.get(identity) === inflight && inflight!.get(name) === task;
  task = (async () => {
    if (!(await liveFeatures(executor)).versionedReads || !current()) return null;
    let cache = memo.get(identity);
    if (!cache) { cache = new Map(); memo.set(identity, cache); }
    let previous = cache.get(name);
    if (previous && previous.expires < Date.now()) {cache.delete(name); previous = undefined;}
    const keys = [`lprc:v2:${name}:current`, `lprc:v2:${name}:full:`];
    const version = previous?.meta.version ?? "";
    let values: string[];
    const client = await persistentCache(executor);
    if (!current()) return null;
    if (client) values = await client.eval(READ_VERSIONED, 2, ...keys, version) as string[];
    else {
      const conn = await getRemoteCacheConn(executor); if (!conn) return null;
      const cmd = `${redisBase(conn)} --raw EVAL ${escapeSingleQuoted(READ_VERSIONED)} 2 ${keys.map(escapeSingleQuoted).join(" ")} ${escapeSingleQuoted(version)}`;
      const result = await execWithRedisAuth(executor, conn, cmd, {timeoutMs: 2000});
      if (result.exitCode !== 0) return null;
      values = result.stdout.split(/\r?\n/);
    }
    if (!current() || !values?.[0]) return null;
    const meta = JSON.parse(values[0]) as CacheMeta;
    if (typeof meta.version !== "string" || !Number.isFinite(meta.collectedAt)) return null;
    const rows = values[1] ? JSON.parse(gunzipB64(values[1])) : previous?.meta.version === meta.version ? previous.rows : null;
    if (!Array.isArray(rows)) return null;
    const bytes = values[1] ? Buffer.byteLength(JSON.stringify(rows)) : previous?.bytes ?? 0;
    const snapshot = {meta, rows, bytes, expires: Date.now() + 600_000};
    // Bound each executor's memo; the global executor pool already has a cap.
    cache.delete(name);
    if (bytes <= 4 * 1024 * 1024) cache.set(name, snapshot);
    while (cache.size > 32 || [...cache.values()].reduce((sum, row) => sum + row.bytes, 0) > 4 * 1024 * 1024) cache.delete(cache.keys().next().value!);
    // Global bound as well as the per-executor bound: dormant targets must
    // not pin hundreds of MB when a process serves many SSH sessions.
    memo.delete(identity); memo.set(identity, cache);
    for (const [key, values] of memo) {
      for (const [name, value] of values) if (value.expires < Date.now()) values.delete(name);
      if (!values.size) memo.delete(key);
    }
    while (memo.size > 200 || [...memo.values()].reduce((sum, values) => sum + [...values.values()].reduce((n,row) => n + row.bytes,0),0) > 64 * 1024 * 1024)
      memo.delete(memo.keys().next().value!);
    return snapshot;
  })().catch(() => null).finally(() => { if (inflight!.get(name) === task) inflight!.delete(name); });
  inflight.set(name, task); return task;
}
