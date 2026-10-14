import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import type { Executor } from "../../../shared/executor/index.js";
import { getRedis } from "../../../shared/redis/index.js";
import { ConflictError } from "../../../shared/errors/index.js";

const context = new AsyncLocalStorage<{ target: string; assertHeld: () => Promise<void> }>();

/** Account, group, identity and plan writes share one target lease. Nested
 * reconciliation reuses it; concurrent requests must retry instead of applying
 * an older native policy after a newer group edit. */
export async function withHostingPolicyLock<T>(executor: Executor | null, fn: () => Promise<T>): Promise<T> {
  if (!executor) return fn();
  const target = executor.target.id;
  const current = context.getStore();
  if (current?.target === target) { await current.assertHeld(); return fn(); }
  const redis = getRedis(), token = randomUUID();
  const key = `hosting:policy-lock:${createHash("sha256").update(target).digest("hex")}`;
  if (await redis.set(key, token, "EX", 120, "NX") !== "OK") throw new ConflictError("Hosting policy update in progress");
  let valid = true;
  const assertHeld = async () => {
    if (!valid || await redis.eval("if redis.call('GET',KEYS[1])==ARGV[1] then return 1 else return 0 end", 1, key, token) !== 1) throw new ConflictError("Hosting policy update lease expired");
  };
  const timer = setInterval(() => { void redis.eval("if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('EXPIRE',KEYS[1],120) else return 0 end", 1, key, token).then((value: unknown) => { if (value !== 1) valid = false; }).catch(() => { valid = false; }); }, 30_000);
  timer.unref();
  try { return await context.run({ target, assertHeld }, async () => { await assertHeld(); const result = await fn(); await assertHeld(); return result; }); }
  finally { clearInterval(timer); await redis.eval("if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end", 1, key, token); }
}

export async function assertHostingPolicyLease(): Promise<void> { await context.getStore()?.assertHeld(); }
