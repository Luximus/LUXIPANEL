import { Redis } from "ioredis";
import type { RemoteCacheConn } from "./conn.js";
import { env } from "../../config/env.js";
let client: Redis | null = null;
let current: RemoteCacheConn | null = null;
let ready: Promise<void> | null = null;
export function closeLocalCacheClient() { client?.disconnect(); client = null; current = null; ready = null; }
/** Only the local cache uses TCP directly. Remote targets keep their authenticated SSH path. */
export async function localCacheMget(conn: RemoteCacheConn, keys: string[]): Promise<(string|null)[]> {
  if (!client || current?.host !== conn.host || current?.port !== conn.port || current?.password !== conn.password) {
    closeLocalCacheClient(); current = conn;
    client = new Redis({host:conn.host,port:conn.port,password:conn.password,
      lazyConnect:true,enableOfflineQueue:false,maxRetriesPerRequest:0,retryStrategy:()=>null,
      connectTimeout:env.REMOTE_CACHE_EXEC_TIMEOUT_MS,commandTimeout:env.REMOTE_CACHE_EXEC_TIMEOUT_MS});
    client.on("error", () => { /* caller handles cache failure without logging credentials */ });
  }
  const active = client;
  try {
    if (active.status === "wait" && !ready) ready = active.connect().then(() => undefined);
    if (ready) await ready;
    return await active.mget(...keys);
  } catch (error) { if (client === active) closeLocalCacheClient(); throw error; }
}
