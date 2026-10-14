import { Redis } from "ioredis";
import type { Duplex } from "node:stream";
import type { Executor } from "../executor/types.js";
import { getContextUser } from "../executor/context.js";
import { PrivilegeDropExecutor } from "../executor/privilege-drop-executor.js";
import { isHostingSession } from "../tenant/tenant-scope.js";
import { getRemoteCacheConn, type RemoteCacheConn } from "./conn.js";
import { cacheIdentity } from "./live-config.js";

type Entry = {read?: Redis; events?: Redis; ready: Map<Redis, Promise<void>>; lastUsed: number; failedUntil: number; signature: string};
const pools = new Map<object, Entry>();
let reap: ReturnType<typeof setInterval> | undefined;

export function closePersistentCache(executor: Executor) {
  const key = cacheIdentity(executor), entry = pools.get(key);
  entry?.read?.disconnect(); entry?.events?.disconnect(); pools.delete(key);
  if (!pools.size && reap) { clearInterval(reap); reap = undefined; }
}
export function cacheAccessAllowed(executor: Executor) {
  return !isHostingSession(getContextUser() ?? undefined) && !(executor instanceof PrivilegeDropExecutor);
}
function makeClient(executor: Executor, conn: RemoteCacheConn, events: boolean): Redis {
  const options = {
    host: "127.0.0.1", port: conn.port, password: conn.password,
    lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 0,
    retryStrategy: () => null, connectTimeout: 2000,
    commandTimeout: events ? 35_000 : 2000, autoResendUnfulfilledCommands: false,
  };
  if (executor.target.id === "local") return new Redis(options);
  // ioredis accepts a Connector with connect/disconnect/check. ssh2 channels
  // are Duplex streams; they never bind a TCP listener on the panel host.
  class SshConnector {
    stream?: Duplex;
    active = true;
    async connect() {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const opening = executor.openCacheStream!(conn.port).then(stream => {
          if (!this.active) {stream.destroy(); throw new Error("cache connection closed");}
          // ioredis treats Connector streams as sockets. TCP keepalive and
          // Nagle settings belong to the established SSH socket; a channel
          // supplies these fluent methods as no-ops.
          Object.assign(stream, {connecting: false, setNoDelay: () => stream, setKeepAlive: () => stream});
          this.stream = stream; return stream;
        });
        return await Promise.race([opening, new Promise<never>((_, reject) => {
          timer = setTimeout(() => {this.active = false; reject(new Error("cache connection timeout"));}, 2000);
        })]);
      } finally {clearTimeout(timer);}
    }
    disconnect() { this.active = false; this.stream?.destroy(); }
    check() { return true; }
  }
  // TCP tuning belongs to ssh2's underlying socket, not its logical channel.
  return new Redis({...options, noDelay: false, keepAlive: undefined, Connector: SshConnector as any});
}

/** At most two Redis connections per authenticated executor, never per table. */
export async function persistentCache(executor: Executor, events = false): Promise<Redis | null> {
  if (!cacheAccessAllowed(executor)) return null;
  if (executor.target.id !== "local" && !executor.openCacheStream) return null;
  const key = cacheIdentity(executor);
  let entry = pools.get(key);
  if (entry && entry.failedUntil > Date.now()) return null;
  const conn = await getRemoteCacheConn(executor);
  // Another first reader may have created the pool while credentials loaded.
  entry = pools.get(key);
  if (entry && entry.failedUntil > Date.now()) return null;
  if (!conn || !["127.0.0.1", "localhost", "::1"].includes(conn.host)) return null;
  const signature = JSON.stringify([conn.host, conn.port, conn.password]);
  if (entry && entry.signature !== signature) { closePersistentCache(executor); entry = undefined; }
  if (!entry) {
    if (pools.size >= 200) {
      const oldest = [...pools.entries()].sort((a,b) => a[1].lastUsed - b[1].lastUsed)[0];
      oldest?.[1].read?.disconnect(); oldest?.[1].events?.disconnect();
      if (oldest) pools.delete(oldest[0]);
    }
    entry = {ready: new Map(), lastUsed: Date.now(), failedUntil: 0, signature};
    pools.set(key, entry);
  }
  entry.lastUsed = Date.now();
  if (!reap) {
    reap = setInterval(() => {
      for (const [id, value] of pools) if (Date.now() - value.lastUsed > 60_000) {
        value.read?.disconnect(); value.events?.disconnect(); pools.delete(id);
      }
      if (!pools.size && reap) { clearInterval(reap); reap = undefined; }
    }, 30_000);
    reap.unref();
  }
  const slot = events ? "events" : "read";
  let client = entry[slot];
  if (!client || client.status === "end") {
    if (client) entry.ready.delete(client);
    client = entry[slot] = makeClient(executor, conn, events);
    client.on("error", () => { /* fall back without logging Redis credentials */ });
    entry.ready.set(client, client.connect().then(() => undefined));
  }
  try { await entry.ready.get(client); return client; }
  catch { client.disconnect(); entry.failedUntil = Date.now() + 30_000; return null; }
}

export function resetPersistentCaches() {
  for (const entry of pools.values()) { entry.read?.disconnect(); entry.events?.disconnect(); }
  pools.clear(); if (reap) clearInterval(reap); reap = undefined;
}
