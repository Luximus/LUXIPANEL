import type { Executor } from "../executor/types.js";
import { panelConfigDir } from "../../config/paths.js";
type Schedule = Record<string, {enabled?: boolean;intervalSeconds?: number}>;
const cache = new Map<string, {until:number;task:Promise<Schedule>}>();
/** Schedule reads are coalesced per target; Settings writes invalidate immediately. */
export function invalidateCacheSchedule(targetId: string) { cache.delete(targetId); }
export async function cacheScheduleEntry(executor: Executor, module: string, collection: string) {
  const key = executor.target.id;
  let entry = cache.get(key);
  if (!entry || entry.until < Date.now()) {
    const task = executor.readFile(`${panelConfigDir()}/cache-engine/schedule.json`, "utf-8")
      .then(data => { const value = JSON.parse(String(data)); return value && typeof value === "object" && !Array.isArray(value) ? value as Schedule : {}; }).catch(() => ({} as Schedule));
    entry = {until:Date.now()+30_000,task}; cache.set(key,entry);
    if (cache.size > 128) cache.delete(cache.keys().next().value!);
  }
  const value = (await entry.task)[`${module}/${collection}`];
  return {enabled:value?.enabled !== false, intervalSeconds:Number.isFinite(value?.intervalSeconds) && value!.intervalSeconds! >= 30 && value!.intervalSeconds! <= 86400 ? value!.intervalSeconds : undefined};
}
