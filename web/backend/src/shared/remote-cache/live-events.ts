import type { Executor } from "../executor/types.js";
import { cacheIdentity, liveFeatures } from "./live-config.js";
import { persistentCache, cacheAccessAllowed } from "./persistent-client.js";

const STREAM = "lprc:v2:events";
type Row = [string, string[]];
type Frame = {type: "data:invalidate" | "data:resync"; resources: string[]; cursor?: string; reason?: string};
type Listener = {keys: Set<string>; send: (frame: Frame) => void};
type Hub = {listeners: Set<Listener>; cursor: string; stopped: boolean; running: boolean; stopTimer?: ReturnType<typeof setTimeout>};
const hubs = new Map<object, Hub>();
export const validCursor = (value: unknown): value is string => typeof value === "string" && /^\d{1,16}-\d{1,10}$/.test(value);
function compare(a: string, b: string) {
  const [am, as] = a.split("-").map(BigInt), [bm, bs] = b.split("-").map(BigInt);
  return am! === bm! ? (as! < bs! ? -1 : as! > bs! ? 1 : 0) : am! < bm! ? -1 : 1;
}
function deliver(listener: Listener, rows: Row[], cursor?: string) {
  const keys = new Set<string>();
  for (const [, fields] of rows) {
    const values: Record<string, string> = {};
    for (let i = 0; i + 1 < fields.length; i += 2) values[fields[i]!] = fields[i+1]!;
    const key = `${values.module}/${values.collection}`;
    if (listener.keys.has(key)) keys.add(key);
  }
  if (keys.size) listener.send({type: "data:invalidate", resources: [...keys], cursor});
}
function resync(hub: Hub, reason: string) {
  for (const listener of hub.listeners) listener.send({type: "data:resync", resources: [...listener.keys], reason});
}
async function pump(executor: Executor, hub: Hub) {
  let disabled = false;
  const pause = () => new Promise<void>(resolve => {const timer = setTimeout(resolve, 5000); timer.unref();});
  while (!hub.stopped) {
    try {
      if (!(await liveFeatures(executor)).events) {
        if (!disabled) {resync(hub, "disabled"); hub.cursor = "";}
        disabled = true; await pause(); continue;
      }
      disabled = false;
      const read = await persistentCache(executor);
      const client = await persistentCache(executor, true);
      if (!read || !client) throw new Error("unavailable");
      if (!hub.cursor) {
        const tail = await read.xrevrange(STREAM, "+", "-", "COUNT", 1);
        hub.cursor = tail[0]?.[0] ?? "0-0";
        resync(hub, "connected");
      }
      if (hub.cursor !== "0-0") {
        const head = await read.xrange(STREAM, "-", "+", "COUNT", 1);
        if (head[0] && compare(hub.cursor, head[0][0]) < 0) resync(hub, "trimmed");
      }
      const result = await client.xread("COUNT", 100, "BLOCK", 5000, "STREAMS", STREAM, hub.cursor) as [string, Row[]][] | null;
      if (hub.stopped) break;
      for (const [, rows] of result ?? []) {
        hub.cursor = rows.at(-1)?.[0] ?? hub.cursor;
        for (const listener of hub.listeners) deliver(listener, rows, hub.cursor);
      }
      // Stream deletion/recreation or trimming cannot leave a cursor stranded.
      if (!result) {
        const tail = await read.xrevrange(STREAM, "+", "-", "COUNT", 1);
        if (!tail[0] || compare(hub.cursor, tail[0][0]) > 0) {hub.cursor = ""; resync(hub, "reset");}
      }
    } catch {
      if (hub.stopped) break;
      resync(hub, "disconnected"); hub.cursor = "";
      await pause();
    }
  }
  if (hubs.get(cacheIdentity(executor)) === hub) hubs.delete(cacheIdentity(executor));
}

/** One XREAD per executor regardless of tab/view count. Replay uses the read
 * connection so it never queues behind the blocking events connection. */
export async function subscribeData(executor: Executor, keys: string[], cursor: unknown, send: Listener["send"]): Promise<() => void> {
  if (!keys.length || !cacheAccessAllowed(executor) || !(await liveFeatures(executor)).events) {
    send({type: "data:resync", resources: keys, reason: "disabled"}); return () => {};
  }
  const identity = cacheIdentity(executor);
  let hub = hubs.get(identity);
  if (!hub) {
    hub = {listeners: new Set(), cursor: "", stopped: false, running: false}; hubs.set(identity, hub);
  }
  // A stopped hub can still be awaiting XREAD. Revive that reader rather
  // than queueing a second blocking command on the same Redis connection.
  clearTimeout(hub.stopTimer); hub.stopTimer = undefined; hub.stopped = false;
  const listener: Listener = {keys: new Set(keys), send};
  const first = !hub.running;
  hub.listeners.add(listener);
  if (first) { hub.running = true; void pump(executor, hub); }
  try {
    const client = await persistentCache(executor);
    if (!client || !validCursor(cursor)) throw new Error("resync");
    const head = await client.xrange(STREAM, "-", "+", "COUNT", 1);
    const tail = await client.xrevrange(STREAM, "+", "-", "COUNT", 1);
    if (!head[0] || !tail[0] || compare(cursor, head[0][0]) < 0 || compare(cursor, tail[0][0]) > 0) throw new Error("gap");
    const replay = await client.xrange(STREAM, `(${cursor}`, "+", "COUNT", 101);
    if (replay.length > 100) throw new Error("gap");
    deliver(listener, replay, replay.at(-1)?.[0] ?? cursor);
  } catch { send({type: "data:resync", resources: keys, reason: "reconcile"}); }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    hub!.listeners.delete(listener);
    if (!hub!.listeners.size) {
      hub!.stopTimer = setTimeout(() => {hub!.stopTimer = undefined; if (!hub!.listeners.size) hub!.stopped = true;}, 5000);
      hub!.stopTimer.unref();
    }
  };
}
