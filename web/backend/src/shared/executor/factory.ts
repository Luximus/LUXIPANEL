// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Executor factory — selects local vs license-proxy execution.
 */

import { toolRequestContext } from "../module-operations/request-context.js";
import type { Request } from "express";

import { createModuleLogger } from "../logger/index.js";
import { EXECUTOR_IDLE_TTL_MS } from "./constants.js";
import type { Executor } from "./types.js";
import { DirectSshExecutor } from "./direct-ssh-executor.js";
import { localExecutor } from "./local-executor.js";
import { wrapExecutorWithSudo } from "./sudo-exec-wrap.js";
import { PrivilegeDropExecutor } from "./privilege-drop-executor.js";
import { isHostingSession } from "../tenant/tenant-scope.js";
import { sshCredentialsCache } from "../../modules/auth/services/ssh-credentials-cache.service.js";
import { bumpPreviewSessionEpoch } from "../preview-sandbox/runtime.js";
import { disposeRedisAuthTmp } from "../remote-cache/redis-cli.js";
import { errMessage } from "../utils/err-message.js";
import { BridgeSessionRequiredError } from "../errors/index.js";
import type { SessionUser } from "../types/index.js";

const log = createModuleLogger("executor-factory");

/**
 * Apply the standard direct-SSH wrapping: sudo-password injection, then — when
 * the cached material is a SERVICE key (`mat.owner` present) — an outer
 * {@link PrivilegeDropExecutor} so every op runs as `sudo -u <owner>` (hosting
 * privilege drop). The drop config rides on the DirectSshExecutor instance
 * (`exec.privilegeDrop`), so both the sync and async paths get it without a
 * second Redis read.
 */
function finalizeDirectExecutor(exec: DirectSshExecutor, user?: SessionUser): Executor {
  const sudoWrapped = wrapExecutorWithSudo(exec);
  const drop = exec.privilegeDrop;
  if (!drop && !(user && isHostingSession(user))) return sudoWrapped;
  const owner = user && isHostingSession(user) ? user.owner : drop?.owner;
  const home = user && isHostingSession(user) ? user.homeRoot : drop?.homeRoot;
  if (!owner || !/^[a-z][a-z0-9_-]{2,31}$/.test(owner) || home !== `/home/${owner}`) throw new Error("Invalid hosting executor scope");
  const wrapped = new PrivilegeDropExecutor(sudoWrapped, user && isHostingSession(user) ? user.username : owner, home, user?.jailEnabled ?? drop?.jailEnabled ?? false, owner);
  if (user?.hostingPolicy?.runtime) wrapped.configureHostingRuntime(user.username);
  return wrapped;
}

// Cache one DirectSshExecutor per bridge session (per process). Each carries
// its own ssh2 client + sftp wrapper so subsequent calls reuse the connection.
const directExecutorByBridgeId = new Map<string, DirectSshExecutor>();

// ── Idle reaper + hard cap (leak guard) ─────────────────────────────────────
// Without this the map only shrank on explicit logout or re-bridge: a browser
// closed, a session expired by TTL, or a crashed client left the `ssh2.Client`
// (30s keepalive) alive indefinitely — leaking FDs, sockets and open SSH
// sessions on every target. We track `lastUsedAt` per entry (bumped on every
// resolve/sync-hit), sweep idle entries periodically, and cap total entries so
// a burst of sessions can't exhaust the box. A reaped-but-still-valid session
// simply rebuilds from `sshCredentialsCache` on its next request.
const EXECUTOR_MAX_ENTRIES = 200; // hard cap; evict LRU beyond this
const EXECUTOR_REAP_INTERVAL_MS = 5 * 60_000;
const lastUsedAt = new Map<string, number>();
let reaperTimer: NodeJS.Timeout | null = null;

function touchExecutor(bridgeSessionId: string): void {
  lastUsedAt.set(bridgeSessionId, Date.now());
}

/** Tear down one cached executor: remove its staged redis-auth tmp (needs a
 *  live channel, so BEFORE dispose), then close the SSH socket. Does NOT touch
 *  the credential cache — that is logout-only semantics; a reaped-but-valid
 *  session must be able to rebuild. */
async function tearDownExecutor(bridgeSessionId: string, exec: DirectSshExecutor): Promise<void> {
  directExecutorByBridgeId.delete(bridgeSessionId);
  lastUsedAt.delete(bridgeSessionId);
  await disposeRedisAuthTmp(exec).catch(() => undefined);
  await exec.dispose().catch(() => undefined);
}

async function reapIdleExecutors(): Promise<void> {
  const now = Date.now();
  for (const [bridgeSessionId, exec] of [...directExecutorByBridgeId.entries()]) {
    const idle = now - (lastUsedAt.get(bridgeSessionId) ?? 0);
    if (idle > EXECUTOR_IDLE_TTL_MS) {
      log.info({ bridgeSessionId, idleMs: idle }, "Reaping idle direct-SSH executor");
      await tearDownExecutor(bridgeSessionId, exec);
    }
  }
}

function ensureReaper(): void {
  if (reaperTimer) return;
  reaperTimer = setInterval(() => {
    void reapIdleExecutors();
  }, EXECUTOR_REAP_INTERVAL_MS);
  // Never keep the event loop alive just for the sweep.
  if (typeof reaperTimer.unref === "function") reaperTimer.unref();
}

/** Evict least-recently-used entries until the map is back under the cap. */
async function enforceExecutorCap(): Promise<void> {
  while (directExecutorByBridgeId.size > EXECUTOR_MAX_ENTRIES) {
    let lruId: string | undefined;
    let lruTime = Infinity;
    for (const bridgeSessionId of directExecutorByBridgeId.keys()) {
      const t = lastUsedAt.get(bridgeSessionId) ?? 0;
      if (t < lruTime) {
        lruTime = t;
        lruId = bridgeSessionId;
      }
    }
    if (lruId === undefined) break;
    const exec = directExecutorByBridgeId.get(lruId);
    if (!exec) break;
    log.warn({ bridgeSessionId: lruId }, "Direct-SSH executor cache at cap — evicting LRU");
    await tearDownExecutor(lruId, exec);
  }
}

/**
 * Resolve (and cache) the DirectSshExecutor for a bridge session, ENFORCING
 * that the cached executor points at the requested target. If a session is
 * re-bridged to a different server, the stale SSH socket is disposed and a
 * fresh executor is built — server X's connection is never reused for Y.
 */
async function resolveDirectExecutor(
  bridgeSessionId: string,
  targetId?: string,
  targetName?: string,
): Promise<DirectSshExecutor | null> {
  const cached = directExecutorByBridgeId.get(bridgeSessionId);
  if (cached) {
    // Only an EXPLICIT, different targetId disposes+rebuilds (real
    // re-bridge to another server). Callers without a targetId — WS entry
    // points like terminal/monitor that call
    // getDirectExecutorByBridgeSessionId(bridgeSessionId) — must reuse the
    // live connection, NOT churn it. (Previously they passed bridgeSessionId
    // as a fake targetId, which thrashed the SSH socket on every request.)
    if (!targetId || cached.target.id === targetId) {
      touchExecutor(bridgeSessionId);
      return cached;
    }
    log.warn(
      { bridgeSessionId, was: cached.target.id, now: targetId },
      "Direct executor target changed — disposing stale SSH connection",
    );
    await cached.dispose().catch(() => undefined);
    directExecutorByBridgeId.delete(bridgeSessionId);
  }
  const mat = await sshCredentialsCache.get(bridgeSessionId);
  if (!mat) return null;
  const exec = new DirectSshExecutor(targetId ?? bridgeSessionId, targetName ?? targetId ?? bridgeSessionId, mat);
  directExecutorByBridgeId.set(bridgeSessionId, exec);
  touchExecutor(bridgeSessionId);
  ensureReaper();
  void enforceExecutorCap();
  log.info({ bridgeSessionId, host: mat.host, targetId: exec.target.id }, "Direct-SSH executor ready");
  return exec;
}

/** Close and forget the direct executor for a bridge session (logout). */
export async function disposeDirectExecutor(bridgeSessionId: string): Promise<void> {
  // Revoke any in-flight/queued preview-sandbox dispatch authorized by THIS
  // session BEFORE tearing the executor down. The preview broker re-checks the
  // monotonic session epoch on every capCall; bumping it here makes a queued or
  // draining dispatch fail-closed (DENY) the instant the session logs out
  // (RUNTIME-DESIGN §6.5, matrix row 17). This is the single chokepoint for both
  // logout paths (session.controller + SSO sso.controller), so wiring it here
  // covers both without coupling either controller to the sandbox.
  //
  // It bumps the GLOBAL epoch (no per-session epoch map exists), so a logout
  // invalidates ALL in-flight preview sessions, not just this bridge's. That is
  // the safe (fail-closed) direction: a preview dispatch is a rare, short-lived,
  // opt-in operation; over-cancelling on a concurrent logout is acceptable and
  // strictly safer than letting a revoked session keep brokering capCalls.
  bumpPreviewSessionEpoch();
  // Release the cached SSH connection material for this session. Disposing the
  // live executor tears down the socket + in-process cache, but the encrypted
  // credential blob (private key + passphrase / password) also lives in Redis
  // keyed by bridge session (put at login/target-switch, TTL = JWT TTL, up to
  // 30d on remember-me). Without this delete it survived logout for the full
  // TTL — the credential outliving the session it belongs to. Purge it here so
  // the material's lifetime is bound to the session, not to the JWT expiry.
  // Best-effort: a Redis hiccup must not break logout (the blob still expires by
  // TTL, and the JWT is already denylisted by the logout controller).
  await sshCredentialsCache.delete(bridgeSessionId).catch((err) => {
    log.warn(
      { bridgeSessionId, err: errMessage(err) },
      "Failed to purge cached SSH credentials on logout — will expire by TTL",
    );
  });
  const cached = directExecutorByBridgeId.get(bridgeSessionId);
  if (!cached) return;
  directExecutorByBridgeId.delete(bridgeSessionId);
  lastUsedAt.delete(bridgeSessionId);
  // Remove the staged redis-auth tmp (needs a live channel) before the socket
  // is torn down, so the 0600 secret in /tmp doesn't outlive the session.
  await disposeRedisAuthTmp(cached).catch(() => undefined);
  await cached.dispose().catch(() => undefined);
  log.info({ bridgeSessionId }, "Direct-SSH executor disposed on logout");
}

/**
 * Snapshot of every live direct-SSH executor currently cached in this process,
 * keyed by bridge session id. Used by background workers (e.g. the
 * server-alerts metric worker) that need to operate per-server WITHOUT a
 * request: only servers with a live SSH session are returned, which keeps the
 * worker inside the managed per-server isolation model (no localExecutor
 * fallback, no leaking of one tenant's data to another). Each executor is
 * finalized (sudo + privilege-drop) exactly like the request path.
 */
export function listLiveDirectExecutors(): Array<{ bridgeSessionId: string; executor: Executor }> {
  const out: Array<{ bridgeSessionId: string; executor: Executor }> = [];
  for (const [bridgeSessionId, exec] of directExecutorByBridgeId.entries()) {
    out.push({ bridgeSessionId, executor: finalizeDirectExecutor(exec) });
  }
  return out;
}

export async function getDirectExecutorByBridgeSessionId(
  bridgeSessionId: string,
  targetId?: string,
  targetName?: string,
): Promise<Executor | null> {
  if (!bridgeSessionId) return null;
  // Pass targetId through as-is (may be undefined): WS entry points don't
  // know it and must reuse the cached connection without re-targeting.
  const exec = await resolveDirectExecutor(bridgeSessionId, targetId, targetName);
  return exec ? finalizeDirectExecutor(exec) : null;
}

export async function hydrateDirectSshExecutor(bridgeSessionId: string, targetId: string, targetName: string): Promise<void> {
  const exec = await resolveDirectExecutor(bridgeSessionId, targetId, targetName);
  if (!exec) {
    log.warn({ bridgeSessionId }, "Cannot hydrate direct executor — credentials missing");
  }
}

interface BridgedSessionLocals {
  bridgeSessionId?: string;
  targetId?: string;
  targetName?: string;
  /** Direct-SSH session: resolve to the target node's DirectSshExecutor from
   *  the cached SSH material (populated by the `servers` target-switch). */
  direct?: boolean;
  /** Local session: resolve to the (sudo-wrapped) panel-host executor. The
   *  panel manages the very server it runs on — this is the authoritative
   *  store for that single node. */
  local?: boolean;
}

function readBridgedSession(req?: Request): BridgedSessionLocals | undefined {
  return req?.res?.locals?.bridgedSession as BridgedSessionLocals | undefined;
}

/** Return the request's bridged session, or throw — a per-server executor
 *  cannot be resolved without one (fail-closed, no silent panel-host fallback). */
function requireBridgedSession(req?: Request): BridgedSessionLocals {
  const b = readBridgedSession(req);
  if (!b) {
    throw new Error(
      "executor-factory: no bridged session on request — cannot resolve a " +
        "per-server executor (fail-closed: no panel-host fallback)",
    );
  }
  return b;
}

/** A local hosting session must run as its Linux owner, never as panel admin. */
function localSessionExecutor(req?: Request): Executor {
  const base = wrapExecutorWithSudo(localExecutor);
  const user = req?.res?.locals?.user as SessionUser | undefined;
  if (!isHostingSession(user)) return base;
  if (!user?.owner || !user.homeRoot || user.homeRoot !== `/home/${user.owner}`) {
    throw new Error("executor-factory: invalid local hosting envelope");
  }
  const wrapped = new PrivilegeDropExecutor(base, user.username, user.homeRoot, user.jailEnabled === true, user.owner);
  if (user.hostingPolicy?.runtime) wrapped.configureHostingRuntime(user.username);
  return wrapped;
}

export async function getExecutorAsync(req?: Request): Promise<Executor> {
  if (req?.res?.locals?.tenantControlExecutor && /^\/api\/(users|roles)(?:\/|\?|$)/.test(req.originalUrl)) return req.res.locals.tenantControlExecutor as Executor;
  if (req?.res?.locals?.mailExecutor) return req.res.locals.mailExecutor as Executor;
  const internal = toolRequestContext(req);
  if (internal) return internal.executor;
  const b = requireBridgedSession(req);
  // Direct-SSH: resolve the target node's executor from the cached material.
  if (b.direct && b.bridgeSessionId && b.targetId) {
    const exec = await resolveDirectExecutor(b.bridgeSessionId, b.targetId, b.targetName ?? b.targetId);
    if (exec) return finalizeDirectExecutor(exec, req?.res?.locals?.user);
    throw new BridgeSessionRequiredError();
  }
  // Local session (default): the panel manages the server it runs on. Resolve
  // the sudo-wrapped local executor (the stored sudo password, captured at
  // login, is injected transparently for any `sudo …` command).
  return localSessionExecutor(req);
}

export function getExecutor(req?: Request): Executor {
  if (req?.res?.locals?.tenantControlExecutor && /^\/api\/(users|roles)(?:\/|\?|$)/.test(req.originalUrl)) return req.res.locals.tenantControlExecutor as Executor;
  if (req?.res?.locals?.mailExecutor) return req.res.locals.mailExecutor as Executor;
  const internal = toolRequestContext(req);
  if (internal) return internal.executor;
  const b = requireBridgedSession(req);

  // Direct-SSH path (sync): the executor must already be hydrated by
  // requireAuth/optionalAuth. Enforce the cached target matches the request.
  if (b.direct && b.bridgeSessionId) {
    const cached = directExecutorByBridgeId.get(b.bridgeSessionId);
    if (cached && (!b.targetId || cached.target.id === b.targetId)) {
      touchExecutor(b.bridgeSessionId);
      return finalizeDirectExecutor(cached, req?.res?.locals?.user);
    }
    if (cached) {
      // Stale (session re-bridged to another server). Drop it; the next
      // async resolution rebuilds against the right target.
      directExecutorByBridgeId.delete(b.bridgeSessionId);
      void cached.dispose().catch(() => undefined);
    }
    throw new BridgeSessionRequiredError();
  }

  // Local session (default): sudo-wrapped panel-host executor.
  return localSessionExecutor(req);
}

/**
 * READ-endpoint variant of {@link getExecutor}: resolves the per-request
 * executor but translates the fail-closed "no bridged session / executor not
 * hydrated for the current target" throw into a typed, actionable
 * {@link BridgeSessionRequiredError} (HTTP 428, `BRIDGE_SESSION_REQUIRED`)
 * instead of letting it bubble as an opaque 500 INTERNAL_ERROR.
 *
 * This is the ONLY behavioral difference — the isolation invariant is untouched:
 * we still NEVER fall back to `localExecutor`; a missing bridge just gets a clean
 * 4xx the frontend can act on ("re-select / reconnect the server") rather than a
 * 500 that hangs the page in a skeleton. Use ONLY on GET/read controllers that
 * would otherwise 500 when the in-memory bridge is gone (e.g. after a backend
 * restart). Mutating endpoints keep plain {@link getExecutor}.
 */
export function getExecutorForRead(req?: Request): Executor {
  try {
    return getExecutor(req);
  } catch (err) {
    log.debug(
      { err: errMessage(err) },
      "No per-server executor for read — signaling BRIDGE_SESSION_REQUIRED (re-select server)",
    );
    throw new BridgeSessionRequiredError();
  }
}
