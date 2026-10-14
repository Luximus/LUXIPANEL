import { closeLocalCacheClient } from "./local-client.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * shared/remote-cache/conn.ts — read the dedicated cache Redis connection
 * info from the customer's server. The provisioner (LP Hito 3) writes
 * `${LUXIPANEL_CONFIG_DIR}/cache/conn.json` (chmod 600) when Redis is
 * installed; we read it lazily via the per-target `Executor`'s SFTP and
 * memoize it per target.id with a short TTL so we don't hit SFTP on every
 * DataTable load.
 *
 * Fail-open: every error path returns `null` so the caller seamlessly
 * falls back to the existing JSON/SSH read path.
 */

import { CONFIG_DIR } from "@config/paths.js";
import { createModuleLogger } from "../logger/index.js";
import type { Executor } from "../executor/types.js";
import { errMessage } from "../utils/err-message.js";

const log = createModuleLogger("remote-cache.conn");

const CONN_TTL_MS = 5 * 60 * 1000;

export interface RemoteCacheConn {
  readonly host: string;
  readonly port: number;
  readonly password: string;
}

type CacheEntry =
  | { kind: "ok"; conn: RemoteCacheConn; until: number }
  | { kind: "missing"; until: number };

let cache = new WeakMap<object, CacheEntry>();
const revisions = new Map<string, number>();
const seenRevisions = new WeakMap<object, number>();

function connPath(): string {
  return `${CONFIG_DIR.replace(/\/$/, "")}/cache/conn.json`;
}

/**
 * Resolve the dedicated cache Redis connection info for the server the
 * given Executor talks to. Returns `null` when the cache stack is not
 * provisioned yet (or the file is unreadable) — caller MUST fall back.
 */
export async function getRemoteCacheConn(
  executor: Executor,
): Promise<RemoteCacheConn | null> {
  const id = executor.target.id;
  const now = Date.now();
  const identity = executor.cacheTransportIdentity ?? executor;
  const revision = revisions.get(id) ?? 0;
  if (seenRevisions.get(identity) !== revision) { cache.delete(identity); seenRevisions.set(identity, revision); }
  const hit = cache.get(identity);
  if (hit && hit.until > now) {
    return hit.kind === "ok" ? hit.conn : null;
  }

  let raw: string;
  try {
    const data = await executor.readFile(connPath(), "utf-8");
    raw = typeof data === "string" ? data : data.toString("utf-8");
  } catch {
    // File doesn't exist (cache stack not provisioned) — short-cache the
    // negative result so we don't retry SFTP on every DataTable load.
    cache.set(identity, { kind: "missing", until: now + CONN_TTL_MS });
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    log.warn(
      { err: errMessage(err), targetId: id },
      "conn.json is not valid JSON",
    );
    cache.set(identity, { kind: "missing", until: now + CONN_TTL_MS });
    return null;
  }
  const conn = parseConn(parsed);
  if (!conn) {
    log.warn({ targetId: id }, "conn.json missing required fields");
    cache.set(identity, { kind: "missing", until: now + CONN_TTL_MS });
    return null;
  }

  cache.set(identity, { kind: "ok", conn, until: now + CONN_TTL_MS });
  return conn;
}

function parseConn(value: unknown): RemoteCacheConn | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const host = typeof obj.host === "string" && obj.host ? obj.host : "127.0.0.1";
  const port = typeof obj.port === "number" ? obj.port : Number(obj.port);
  const password = typeof obj.password === "string" ? obj.password : null;
  if (!Number.isInteger(port) || port <= 0 || !password) return null;
  return Object.freeze({ host, port, password });
}

/** Test seam: drop the memoized conn so the next call hits SFTP again. */
export function invalidateRemoteCacheConn(targetId: string): void {
  revisions.set(targetId, (revisions.get(targetId) ?? 0) + 1);
  if (targetId === "local") closeLocalCacheClient();
}

/** Test seam: clear everything. */
export function _resetRemoteCacheConnForTests(): void {
  cache = new WeakMap(); revisions.clear();
}
