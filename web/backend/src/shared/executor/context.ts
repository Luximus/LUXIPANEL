// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Request-scoped executor context.
 *
 * LUXIPANEL backend is a SINGLE Node process that, in managed mode, bridges
 * over SSH to MANY remote servers (X, Y, Z) — potentially concurrently and
 * for different users. All per-server state (config, users, mail, modules,
 * settings, …) lives in JSON sidecars under `LUXIPANEL_CONFIG_DIR` on the
 * *connected* server and is reached through an `Executor`.
 *
 * Historically, any code path that called `kv()` / `dataStore()` /
 * `settingsRepository` WITHOUT explicitly threading the request's executor
 * silently fell back to the panel host's `localExecutor`. That panel-host
 * store is shared by every server, so server X's data leaked into server Y.
 *
 * This module pins the resolved executor for the lifetime of a request via
 * `AsyncLocalStorage`. Middleware establishes it once (after the bridged
 * session is hydrated); every downstream `pickExecutor()` fallback then
 * resolves to the right server automatically — no call-site changes needed.
 *
 * Outside any request scope (boot, background jobs, WS handlers that pass
 * their executor explicitly) the store is empty and callers keep their
 * existing explicit-executor behaviour.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type { Executor } from "./types.js";
import { localExecutor } from "./local-executor.js";
import type { SessionUser } from "../types/index.js";
import { isPathUnder } from "../utils/path-containment.js";

interface ExecutorStore {
  executor: Executor;
  /** Panel user id of the authenticated request, when established. Lets
   *  per-USER state (assistant config/conversations, terminal-cli state, …)
   *  namespace its per-server sidecar by user WITHOUT threading userId through
   *  every call site — mirrors how the executor itself is pinned. Absent on
   *  boot/background/login flows (those touch no per-user collection). */
  userId?: number;
  /** Full authenticated user of the request, when established. Lets ambient
   *  code that has no `req` (agent capability tool handlers running detached in
   *  the assistant pipeline) enforce the SAME per-group permission/path policy
   *  the HTTP middlewares apply — e.g. `canAccessPath`. Absent outside an
   *  authenticated request scope; callers MUST treat its absence as
   *  "no user context" (admin/internal), never as "denied". */
  user?: SessionUser;
  permissionAction?: string;
  /**
   * Optional FILE-ACCESS JAIL for the current async scope: an allowlist of
   * absolute path prefixes the file tools (`files.*`) may touch. Set by the
   * assistant when a run is bound to an agent/project that declares working
   * directories, so file reads/writes are confined to that project tree —
   * ON TOP of the user's `canAccessPath` policy (it only ever narrows, and
   * applies even to admins, unlike `canAccessPath`). Empty/absent = no jail.
   */
  fileJail?: string[];
}

const storage = new AsyncLocalStorage<ExecutorStore>();

/**
 * Run `fn` with `executor` pinned as the ambient per-request executor (and,
 * optionally, the authenticated `userId`/`user`). All async work spawned inside
 * `fn` inherits it.
 */
export function runWithExecutor<T>(
  executor: Executor,
  fn: () => T,
  userId?: number,
  user?: SessionUser,
): T {
  return storage.run(
    {
      executor,
      ...(typeof userId === "number" ? { userId } : {}),
      ...(user ? { user } : {}),
    },
    fn,
  );
}

/**
 * The executor pinned for the current async context, or `null` when none
 * was established (boot / background / explicit-executor code paths).
 */
export function getContextExecutor(): Executor | null {
  return storage.getStore()?.executor ?? null;
}

/**
 * The panel user id pinned for the current async context, or `null` when none
 * was established. Used by per-USER repositories to scope their per-server
 * sidecar by user so two Linux users on one server don't share state.
 */
export function getContextUserId(): number | null {
  const uid = storage.getStore()?.userId;
  return typeof uid === "number" ? uid : null;
}

/**
 * The full authenticated user pinned for the current async context, or `null`
 * when none was established (boot / background / unauthenticated / explicit-
 * executor code paths). Lets ambient handlers (agent capability tools) apply
 * the request user's permission/path policy without a `req`. A `null` result
 * means "no user context" — callers decide the safe default (typically: allow,
 * matching admin/internal behaviour), never blanket-deny.
 */
export function getContextUser(): SessionUser | null {
  return storage.getStore()?.user ?? null;
}

/**
 * Run `fn` pinned to the panel-host (`localExecutor`).
 *
 * Reserved for genuinely INSTANCE-LEVEL state that belongs to this LUXIPANEL
 * installation itself — not to any bridged server: the license credentials,
 * the panel's own module catalog/branding, MCP extension registry, etc.
 * These are read at boot and on background timers when no server is
 * connected. This is an explicit, intentional choice — never a silent
 * per-request fallback (per-request code resolves its own server executor).
 *
 * Timers/intervals created inside `fn` inherit this context, so periodic
 * instance-level work (license heartbeat, stats collector) keeps resolving
 * to the panel host. Incoming HTTP requests do NOT inherit it — they are
 * scoped per-request by the auth middleware.
 */
export function runOnPanelHost<T>(fn: () => T): T {
  return storage.run({ executor: localExecutor }, fn);
}

/**
 * Set the FILE-ACCESS JAIL for the CURRENT run scope: file tools may only touch
 * paths inside `paths` (absolute prefixes). Mutates the ambient store in place
 * (rather than nesting a new scope) so the jail stays visible while an async
 * generator created in this scope is iterated LATER by an outer consumer — the
 * assistant's provider/orchestrator stream yields out of any nested `run()`, so
 * a wrapper scope would not survive iteration, but the shared store object does.
 * No-op when there is no run scope (boot/background) or `paths` is empty.
 */
export function setContextFileJail(paths: string[]): void {
  const cur = storage.getStore();
  if (!cur) return;
  const clean = paths.map((p) => p.replace(/\/+$/, "") || "/").filter(Boolean);
  cur.fileJail = clean.length ? clean : undefined;
}

/** Allowed path prefixes for the current scope, or `null` when no jail is set. */
export function getFileJailPaths(): string[] | null {
  const j = storage.getStore()?.fileJail;
  return j && j.length ? j : null;
}

/**
 * Whether `targetPath` is allowed by the current file jail. No jail → always
 * `true`. With a jail, the path must equal or sit under one allowed prefix
 * (`/` allows everything). `targetPath` should already be absolute/normalized.
 */
export function pathInFileJail(targetPath: string): boolean {
  const jail = getFileJailPaths();
  if (!jail) return true;
  const p = targetPath.replace(/\/+$/, "") || "/";
  // `rule === "/"` means "no restriction"; everything else is plain containment
  // (shared `isPathUnder`, so this jail can't drift from the other 8 copies).
  return jail.some((rule) => rule === "/" || isPathUnder(rule, p));
}

/** Refresh identity without dropping the pinned executor or project jail. */
export function runWithToolIdentity<T>(user: SessionUser, fn: () => T): T {
  const store = storage.getStore();
  if (!store) throw new Error("Tool execution requires a pinned server");
  return storage.run({ ...store, user, userId: user.userId }, fn);
}

export function runWithPermissionAction<T>(action: string, fn: () => T): T {
  const store = storage.getStore();
  return store ? storage.run({ ...store, permissionAction: action }, fn) : fn();
}
export function getContextPermissionAction(): string | undefined { return storage.getStore()?.permissionAction; }
