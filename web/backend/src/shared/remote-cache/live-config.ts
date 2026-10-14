import type { Executor } from "../executor/types.js";
import { panelConfigDir } from "../../config/paths.js";

export type LiveFeatures = { versionedReads: boolean; events: boolean; watcher: boolean };
const disabled: LiveFeatures = {versionedReads: false, events: false, watcher: false};
const config = new WeakMap<object, {until: number; pending: Promise<LiveFeatures>}>();
export const cacheIdentity = (executor: Executor): object => executor.cacheTransportIdentity ?? executor;
export function invalidateLiveConfig(executor: Executor) { config.delete(cacheIdentity(executor)); }
export function liveFeatures(executor: Executor): Promise<LiveFeatures> {
  const key = cacheIdentity(executor), current = config.get(key);
  if (current && current.until > Date.now()) return current.pending;
  const pending = executor.readFile(`${panelConfigDir()}/cache-engine/live-data.json`, "utf-8")
    .then(raw => {
      const value = JSON.parse(String(raw));
      return {versionedReads: value?.versionedReads === true, events: value?.events === true, watcher: value?.watcher === true};
    }).catch(() => ({...disabled}));
  config.set(key, {until: Date.now() + 30_000, pending});
  return pending;
}
