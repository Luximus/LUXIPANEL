// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * The ONE "is there a connected server in context?" guard (fail-closed).
 *
 * LUXIPANEL keeps ALL per-server state on the connected server, reached through
 * the request-scoped `Executor` pinned by `requireAuth`/`optionalAuth` via
 * `runWithExecutor` (AsyncLocalStorage). There is NO authoritative panel-host
 * store, so a missing executor must NEVER silently fall back to `localExecutor`
 * — that would read/write one shared store for every bridged server and leak
 * one tenant's data into another (CLAUDE.md §"Aislamiento total por servidor").
 *
 * That guard used to be copy-pasted in 8 places with 5 different error types
 * (`kv-store`, `remote-config`, `agent-capability`, `executor/run-command`,
 * `users`, `ssh-keys`, `mail`, `module-dev`). This module is the single
 * implementation.
 *
 * ── API for callers (including `modules/**`) ────────────────────────────────
 *
 *   // 1. Default: throw the canonical `NoServerExecutorError` (HTTP 503,
 *   //    code NO_SERVER_EXECUTOR).
 *   const executor = requireExecutor();
 *   const executor = requireExecutor(maybeExplicitExecutor);
 *
 *   // 2. Keep the canonical error type but with your own message (useful when
 *   //    a log/`msg.includes(...)` filter depends on the wording).
 *   const executor = requireExecutor(explicit, noServerExecutor("kv-store: ..."));
 *
 *   // 3. Preserve a DIFFERENT error because changing it would change the HTTP
 *   //    contract (e.g. mail's mailbox helpers answer 403 ForbiddenError):
 *   const executor = requireExecutor(explicit, () => {
 *     throw new ForbiddenError("...");
 *   });
 *
 * The `onMissing` handler MUST throw; its return type is `never`.
 */

import { NoServerExecutorError } from "../errors/errors.js";
import { getContextExecutor } from "./context.js";
import type { Executor } from "./types.js";

/** A handler invoked when neither an explicit nor a context executor exists. */
export type MissingExecutorHandler = () => never;

/**
 * Resolve the executor for a per-server operation:
 *   explicit argument → request-scoped context executor → fail closed.
 *
 * @param explicit  Executor threaded by the caller (wins when truthy).
 * @param onMissing Throwing handler for the fail-closed branch. Defaults to
 *                  `throw new NoServerExecutorError()` (HTTP 503).
 */
export function requireExecutor(
  explicit?: Executor | null,
  onMissing?: MissingExecutorHandler,
): Executor {
  if (explicit) return explicit;
  const ctx = getContextExecutor();
  if (ctx) return ctx;
  if (onMissing) onMissing();
  throw new NoServerExecutorError();
}

/**
 * Build a {@link MissingExecutorHandler} that throws the canonical
 * `NoServerExecutorError` with a custom message — for call sites whose wording
 * is matched elsewhere (e.g. `auth-audit.service` skips audits when the message
 * contains "no executor in scope").
 */
export function noServerExecutor(message: string): MissingExecutorHandler {
  return () => {
    throw new NoServerExecutorError(message);
  };
}
