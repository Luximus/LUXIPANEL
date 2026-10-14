// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * shared/remote-cache/refresh.ts — fire-and-forget refresh of a single
 * cacheable (module, collection) on the customer's server after a mutation.
 *
 *  1. Drop the panel-local meta entry so the next read can't be misled by a
 *     short-lived TTL into thinking the cached version is still current.
 *  2. Drop the in-process blob memo for the same (module, collection).
 *  3. Ask the client-side dispatcher to re-collect just that entry now
 *     (`dispatcher.sh --entry <m> <c>`) so the user sees their own write at
 *     the next page load, without shortening the global interval.
 *
 * Coalescing: repeated refresh requests for the same (target, module,
 * collection) within `COALESCE_MS` reuse the in-flight promise and do not
 * trigger additional execs. This keeps a burst of writes (e.g. bulk
 * delete) from saturating the SSH pool.
 */

import { panelConfigDir } from "@config/paths.js";
import { createModuleLogger } from "../logger/index.js";
import { getRedis } from "../redis/index.js";
import type { Executor } from "../executor/types.js";

import { cachePolicyFor } from "../cache/cacheable-modules.js";
import { panelMetaKey } from "./keys.js";
import { errMessage } from "../utils/err-message.js";

const log = createModuleLogger("remote-cache.refresh");

const COALESCE_MS = 1_000;
const REFRESH_TIMEOUT_MS = 5_000;

interface InFlight {
  promise: Promise<void>;
  scheduledAt: number;
}
const inflight = new Map<string, InFlight>();

function key(targetId: string, module: string, collection: string, scope?: string): string {
  return scope === undefined
    ? `${targetId}|${module}|${collection}`
    : `${targetId}|${module}|${collection}|${scope}`;
}

function dispatcherPath(): string {
  return `${panelConfigDir()}/cache-engine/engines/dispatcher.sh`;
}

// Conservative shell quoting for module/collection/scope names. Allowlist
// values only — defense in depth even though they come from the kv-store path
// sanitizer. (`[a-z0-9_-]/i` is the same set as `[A-Za-z0-9_-]`.)
function safeToken(value: string): string | null {
  return /^[a-z0-9_-]{1,64}$/i.test(value) ? value : null;
}

function safeScope(value: string | undefined): string | null {
  return value === undefined ? null : safeToken(value);
}

/**
 * Build the `bash <dispatcher> --entry <m> <c> [--scope <s>]` command for a
 * targeted refresh. Returns `null` (caller bails) when any token is unsafe.
 */
function buildDispatcherCmd(module: string, collection: string, scope?: string): string | null {
  const m = safeToken(module);
  const c = safeToken(collection);
  if (!m || !c) return null;
  let entry = `bash ${dispatcherPath()} --entry ${m} ${c}`;
  if (scope !== undefined) {
    const s = safeScope(scope);
    if (s === null) return null; // refuse to pass through unsafe scope token
    entry += ` --scope ${s}`;
  }
  return entry;
}

async function drainPanelMeta(
  targetId: string,
  module: string,
  collection: string,
  scope?: string,
): Promise<void> {
  try {
    const r = getRedis();
    // Always DEL the unscoped key (covers full-collection callers) AND, when
    // a scope is given, the per-scope key too. Cheap and prevents staleness
    // when the engine re-emits both forms.
    await r.del(panelMetaKey(targetId, module, collection));
    if (scope !== undefined) {
      await r.del(panelMetaKey(targetId, module, collection, scope));
    }
  } catch {
    // Panel Redis down: the meta entry has a short TTL anyway.
  }
}

async function execRefresh(
  executor: Executor,
  module: string,
  collection: string,
  scope?: string,
): Promise<void> {
  const entry = buildDispatcherCmd(module, collection, scope);
  if (entry === null) return;
  // Run the collector DETACHED on the client and return immediately.
  //
  // The collector behind a targeted refresh can take longer than our exec
  // timeout — collector-mail walks every maildir and runs `doveadm quota -A`,
  // routinely >5s. If we waited inline (and let the timeout kill the SSH
  // command), the collector died mid-run and the client's Redis was NEVER
  // rewritten → every DataTable kept serving the pre-mutation rows until the
  // next periodic tick. `nohup … &` lets it finish on the client regardless
  // of how long it takes or whether our channel closes; `echo` makes the
  // foreground shell return in milliseconds. We don't need its output —
  // `getCached` always reads the freshest version straight from client Redis,
  // so the write lands as soon as the collector finishes (a few seconds later).
  const cmd = `nohup ${entry} >/dev/null 2>&1 </dev/null & echo lxp-refresh-queued`;
  try {
    await Promise.race([
      executor.exec(cmd, { timeoutMs: REFRESH_TIMEOUT_MS }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("refresh dispatch timeout")), REFRESH_TIMEOUT_MS + 250),
      ),
    ]);
    log.debug({ targetId: executor.target.id, module, collection, scope }, "targeted refresh dispatched (detached)");
  } catch (err) {
    log.debug(
      {
        err: errMessage(err),
        targetId: executor.target.id,
        module,
        collection,
      },
      "targeted refresh dispatch failed (fail-open — engine will pick it up on its next tick)",
    );
  }
}

/**
 * Schedule a targeted refresh of `<module>/<collection>` on the connected
 * server. Fire-and-forget: never throws, never blocks the caller. Returns
 * the in-flight promise mostly for tests.
 */
export function scheduleRefresh(
  executor: Executor,
  module: string,
  collection: string,
  scope?: string,
): Promise<void> {
  if (!cachePolicyFor(module, collection)) return Promise.resolve();
  const targetId = executor.target.id;
  const k = key(targetId, module, collection, scope);
  const existing = inflight.get(k);
  if (existing && Date.now() - existing.scheduledAt < COALESCE_MS) {
    return existing.promise;
  }
  const promise = (async () => {
    // Drop the panel-meta first so even if the targeted exec fails, the
    // next read goes back to the client server (where the engine will
    // refresh on its own schedule).
    await drainPanelMeta(targetId, module, collection, scope);
    await execRefresh(executor, module, collection, scope);
  })().finally(() => {
    // Keep the entry around for COALESCE_MS so a burst of writes coalesces.
    setTimeout(() => inflight.delete(k), COALESCE_MS).unref?.();
  });
  inflight.set(k, { promise, scheduledAt: Date.now() });
  return promise;
}

/**
 * SYNCHRONOUS targeted refresh — drains the panel meta, then runs the
 * client-side collector inline (NOT detached) and waits for it, so by the time
 * this resolves the per-server read cache already reflects the just-applied
 * write. Use for FAST collectors: `sidecar-mirror` (engine-mirror reads one
 * JSON file) and fast `system-collector`s (e.g. nginx scans /etc/nginx, ssl
 * reads certbot). NOT for slow collectors (mail accounts: `doveadm quota -A`
 * over every mailbox) — those use the write-behind queue + job polling so the
 * request doesn't block for seconds. Bounded by `maxWaitMs`; fail-open on
 * timeout/error (the 60s periodic tick is the backstop).
 */
export async function refreshSync(
  executor: Executor,
  module: string,
  collection: string,
  scope?: string,
  maxWaitMs = 8_000,
): Promise<void> {
  if (!cachePolicyFor(module, collection)) return;
  const targetId = executor.target.id;
  await drainPanelMeta(targetId, module, collection, scope);
  const entry = buildDispatcherCmd(module, collection, scope);
  if (entry === null) return;
  try {
    await executor.exec(entry, { timeoutMs: maxWaitMs });
  } catch (err) {
    log.debug(
      { err: errMessage(err), targetId, module, collection },
      "synchronous refresh failed (fail-open — periodic tick will catch up)",
    );
  }
}

/** Test seam. */
export function _resetRefreshForTests(): void {
  inflight.clear();
}
