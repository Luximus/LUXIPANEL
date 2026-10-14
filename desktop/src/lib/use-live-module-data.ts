import { useEffect, useRef, useSyncExternalStore } from "react";
import { listenServerData } from "./server-data-events";
import { getFreshness, listenFreshness, type Freshness } from "./native-live-read";
import { useNativeModuleVisible } from "../screens/server/module-visibility";

export function useDataAppActive() {
  return useSyncExternalStore(listener => { document.addEventListener("visibilitychange", listener); return () => document.removeEventListener("visibilitychange", listener); }, () => !document.hidden);
}
export function useLiveModuleData(serverId: string, resources: string[], reload: () => Promise<unknown>, enabled = true) {
  const visible = useNativeModuleVisible(), active = useDataAppActive();
  const callback = useRef(reload); callback.current = reload;
  const keys = JSON.stringify(resources);
  useEffect(() => {
    if (!enabled || !visible || !active || !serverId || !resources.length) return;
    let closed = false, busy = false, dirty = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      if (closed) return;
      clearTimeout(timer); timer = undefined;
      if (busy) {dirty = true; return;}
      busy = true;
      try {await callback.current();} catch { /* the resource owns its error UI */ }
      finally {busy = false; if (dirty && !closed) {dirty = false; void run();}}
    };
    const release = listenServerData(serverId, resources, () => {void run();});
    // Returning to a retained view keeps rows visible and revalidates them.
    timer = setTimeout(() => {void run();}, 300);
    return () => {closed = true; clearTimeout(timer); release();};
  }, [serverId, keys, visible, active, enabled]);
}
export function useDataFreshness(serverId: string, resources: string[]): Freshness | null {
  const value = useSyncExternalStore(listenFreshness, () => JSON.stringify(resources.map(key => getFreshness(serverId, key) ?? null)));
  const known = (JSON.parse(value) as (Freshness | null)[]).filter((row): row is Freshness => !!row);
  if (!known.length) return null;
  const state = known.some(row => row.state === "offline") ? "offline" : known.some(row => row.state === "updating") ? "updating" : known.some(row => row.state === "stale") ? "stale" : "fresh";
  return {state, collectedAt: Math.min(...known.map(row => row.collectedAt ?? row.checkedAt ?? Date.now()/1000))};
}
