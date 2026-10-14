import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import { getRedis } from "../redis/index.js";
import { getContextExecutor, getContextUser } from "../executor/context.js";
import { isHostingSession } from "../tenant/tenant-scope.js";
import { ConflictError, ForbiddenError } from "../errors/index.js";
const owned = new AsyncLocalStorage<Map<string, { active: boolean }>>();
/** Distributed serialization holds the quota check and physical create in the
 * same critical section. Nested service/controller guards share the lease. */
export async function withResourceCreationLock<T>(scope: string, resource: string, fn: () => Promise<T>): Promise<T> {
  const key = `hosting:resource-lock:${createHash("sha256").update(`${scope}:${resource}`).digest("hex")}`;
  if (owned.getStore()?.get(key)?.active) return fn();
  const redis = getRedis(), token = randomUUID();
  if (await redis.set(key, token, "EX", 120, "NX") !== "OK") throw new ConflictError("Account resource creation in progress; retry");
  const lease = { active: true }, inherited = new Map(owned.getStore()); inherited.set(key, lease);
  const heartbeat = setInterval(() => { void redis.eval("if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('EXPIRE',KEYS[1],120) else return 0 end", 1, key, token).then((renewed: unknown) => { if (!renewed) lease.active = false; }).catch(() => { lease.active = false; }); }, 30_000);
  heartbeat.unref();
  try {
    return await owned.run(inherited, async () => { if (!lease.active) throw new ForbiddenError("Quota lease expired"); return fn(); });
  } finally {
    lease.active = false; clearInterval(heartbeat);
    await redis.eval("if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end", 1, key, token);
  }
}
export function guardHostingResourceMutation<T extends (...args: any[]) => Promise<any>>(resource: string, handler: T): T {
  return (function(this: unknown, ...args: Parameters<T>) {
    const user = getContextUser(), executor = getContextExecutor();
    if (!user || !isHostingSession(user)) return handler.apply(this, args);
    if (!executor) throw new ForbiddenError("Hosting executor missing");
    return withResourceCreationLock(`${executor.target.id}:${user.tenantId}`, resource, () => handler.apply(this, args));
  }) as T;
}

export function assertHostingCreationLease(): void {
  for (const lease of owned.getStore()?.values() ?? []) if (!lease.active) throw new ForbiddenError("Account resource creation lease expired");
}
