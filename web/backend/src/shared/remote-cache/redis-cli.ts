// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * shared/remote-cache/redis-cli.ts — tiny shared primitives for building the
 * `redis-cli` invocation we run against the per-server cache Redis over the
 * `/api/agents/exec` contract. Centralised so the read path
 * (`remote-cache/index.ts`) and the write-behind path (`submit-mutation.ts`)
 * escape/quote identically (the produced shell strings MUST stay byte-for-byte
 * the same — the LP SSH proxy is picky about quoting and control chars).
 *
 * SECURITY — the cache Redis password is NEVER passed via `redis-cli -a <pw>`:
 * argv is visible in `ps` / `/proc/<pid>/cmdline` / auditd on the target. Every
 * call goes through {@link execWithRedisAuth}, which stages the secret in a 0600
 * tmp file via SFTP and `export`s it as `REDISCLI_AUTH` (redis-cli reads it from
 * its environment automatically) before running the command — the secret never
 * touches argv nor the command string. `redisBase()` therefore omits `-a`.
 */

import type { Executor, ExecOptions, ExecResult } from "../executor/types.js";
import { quoteArg } from "../executor/quote.js";
import { safeSegment } from "../utils/safe-segment.js";
import type { RemoteCacheConn } from "./conn.js";

/**
 * Wrap a value in single quotes, escaping any embedded single quote.
 *
 * DEPRECATED ALIAS — kept only so the existing call sites (and their test
 * mocks) keep compiling. It now delegates to the canonical `quoteArg()` from
 * `shared/executor/quote.ts`: same output for every non-empty input, plus the
 * empty-string guard (`""` → `''`). New code MUST import `quoteArg` directly.
 */
export const escapeSingleQuoted = quoteArg;

/**
 * The `redis-cli -h … -p … --no-auth-warning` prefix for `conn`. The password
 * is supplied out-of-band via `REDISCLI_AUTH` (see {@link execWithRedisAuth}),
 * NOT via `-a`, so it never lands in argv on the target.
 */
export function redisBase(conn: RemoteCacheConn): string {
  return `redis-cli -h ${conn.host} -p ${conn.port} --no-auth-warning`;
}

/**
 * `redisBase(conn)` followed by ALREADY-QUOTED redis arguments, joined with
 * spaces. Quoting stays at the call site (each arg goes through `quoteArg`)
 * because some callers pass literal flags like `--no-raw` that must not be
 * quoted. Was `buildRedisCmd()` private to `files-cache`.
 */
export function redisArgv(conn: RemoteCacheConn, redisArgs: string[]): string {
  return [redisBase(conn), ...redisArgs].join(" ");
}

/** redis-cli's nil reply in non-interactive mode. */
export const REDIS_NIL = "(nil)";

/** `true` when a redis-cli reply token means "key missing". */
export function isRedisNil(token: string): boolean {
  return token === REDIS_NIL;
}

/** Strip the wrapping quotes redis-cli `--no-raw` adds around a bulk string. */
export function stripRedisQuotes(tok: string): string {
  return tok.length >= 2 && tok[0] === '"' && tok[tok.length - 1] === '"' ? tok.slice(1, -1) : tok;
}

/**
 * Run `innerShell` (a redis-cli command line built with {@link redisBase}) with
 * the cache Redis password exported as `REDISCLI_AUTH`. The secret is staged in
 * a 0600 tmp file over SFTP and sourced (`export`ed) into the shell, so it is
 * absent from argv / the command string / process listings on the target. The
 * tmp file is always removed afterwards (best-effort).
 *
 * The sourced var is `export`ed so it propagates into the pipeline subshell
 * that runs redis-cli. The `. <tmp>;` prefix carries no control characters, so
 * it stays compatible with the LP SSH proxy's quoting/no-newline rules.
 */
// Memoization of the staged REDISCLI_AUTH tmp file, keyed by a STABLE STRING
// identity (bridge session / target id), NOT by the executor OBJECT. The
// per-request executor is a fresh `Proxy` (wrapExecutorWithSudo) on every call,
// so a WeakMap keyed by object identity almost never hit — every cache op then
// re-staged a `/tmp/.lxp-rcli-*` secret over SFTP and NEVER removed it (unbounded
// secret litter on the target). Keying by identity string means one 0600 tmp per
// SSH connection to a server (they share the same conn.password), reused for
// AUTH_TMP_TTL_MS, then re-staged in case tmpwatch/reboot removed it. The tmp is
// removed on session dispose via {@link disposeRedisAuthTmp} (wired into the
// executor-factory logout/reaper chokepoints).
const AUTH_TMP_TTL_MS = 5 * 60_000;
const authTmpByIdentity = new Map<string, { tmp: string; password: string; stagedAt: number }>();

function executorIdentity(executor: Executor): string {
  // Stable identity for the memo: bridgeSessionId when present, else target
  // id. We only need to distinguish different SSH connections to the same
  // server (which share the conn.password).
  const id = (executor as unknown as { bridgeSessionId?: string }).bridgeSessionId;
  return id || executor.target.id || "default";
}

/** Sanitize an identity for safe use as a filename segment (defense in depth —
 *  target ids/bridge ids are internal, but a stray char must never break the
 *  tmp path or escape /tmp). */
function safeIdentitySegment(identity: string): string {
  return safeSegment(identity) || "default";
}

async function getOrStageAuthTmp(
  executor: Executor,
  conn: RemoteCacheConn,
): Promise<string> {
  const identity = executorIdentity(executor);
  const cached = authTmpByIdentity.get(identity);
  const now = Date.now();
  if (cached && cached.password === conn.password && now - cached.stagedAt < AUTH_TMP_TTL_MS) {
    return cached.tmp;
  }
  const tmp = `/tmp/.lxp-rcli-${safeIdentitySegment(identity)}-${now}-${Math.random().toString(36).slice(2, 10)}`;
  // SFTP write (not argv): the password rides the file channel, never `ps`.
  // mode 0600 so the staged secret is owner-only for its short lifetime.
  await executor.writeFile(tmp, `export REDISCLI_AUTH=${escapeSingleQuoted(conn.password)}\n`, {
    encoding: "utf-8",
    mode: 0o600,
  });
  authTmpByIdentity.set(identity, { tmp, password: conn.password, stagedAt: now });
  return tmp;
}

/**
 * Remove the staged REDISCLI_AUTH tmp file for this executor's identity (0600
 * secret in /tmp) and forget the memo entry. Best-effort: called from the
 * executor-factory logout + idle-reaper chokepoints, BEFORE the SSH socket is
 * torn down (so the `rm` still has a live channel). A stale entry re-stages on
 * the next call, so a failed remove is harmless.
 */
export async function disposeRedisAuthTmp(executor: Executor): Promise<void> {
  const identity = executorIdentity(executor);
  const entry = authTmpByIdentity.get(identity);
  if (!entry) return;
  authTmpByIdentity.delete(identity);
  try {
    await executor.exec(`rm -f ${quoteArg(entry.tmp)}`);
  } catch {
    /* best-effort: the tmp expires by tmpwatch/reboot if the rm can't run */
  }
}

export async function execWithRedisAuth(
  executor: Executor,
  conn: RemoteCacheConn,
  innerShell: string,
  opts?: ExecOptions,
): Promise<ExecResult> {
  const tmp = await getOrStageAuthTmp(executor, conn);
  // Steady-state path: a single `exec` round-trip. The . <tmp> prefix sources
  // REDISCLI_AUTH so the secret stays out of argv. Falls back to re-staging
  // automatically on the next call if the file disappeared.
  return await executor.exec(`. ${quoteArg(tmp)}; ${innerShell}`, opts);
}
