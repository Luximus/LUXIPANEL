// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Test doubles for `Executor` (B-41) — TEST-ONLY, never imported by src code.
 *
 * ~15 variants of the same two helpers were re-declared across the suite
 * (firewall/ufw, firewall/fail2ban, files/name-search, dashboard/overview,
 * bitninja, …): a fake executor with a sequential `target.id` and an
 * `exec: vi.fn(...)`, plus a helper mapping `mock.calls` to command strings.
 *
 * Two shapes are provided because the suites genuinely need both:
 *  - {@link mockExecutor} — one canned stdout for every command.
 *  - {@link handlerExecutor} — a `(cmd) => result` router, for services that
 *    probe several commands in one call.
 *
 * `target.id` is unique per instance ON PURPOSE: several services key
 * per-server caches/cooldowns off it, so a shared id makes the second test in a
 * file silently hit the first one's cache.
 */

import { vi } from "vitest";

import type { ExecResult, Executor } from "../types.js";

let seq = 0;

/** Result shape a handler may return; missing fields default to a clean run. */
export interface MockExecResult {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}

/** Router from a command string to its canned result. */
export type MockExecHandler = (cmd: string) => MockExecResult;

function fill(r: MockExecResult): ExecResult {
  return {
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    exitCode: r.exitCode ?? 0,
    durationMs: 1,
  } as ExecResult;
}

/**
 * Executor whose `exec` routes through `handler`. `writeFile`/`mkdir`/`unlink`
 * are no-op `vi.fn()`s so services that stage temp files work unchanged.
 */
export function handlerExecutor(handler: MockExecHandler, id?: string): Executor {
  return {
    target: { id: id ?? `t-${Date.now()}-${seq++}`, name: "test" },
    exec: vi.fn(async (cmd: string) => fill(handler(cmd))),
    writeFile: vi.fn(async () => undefined),
    mkdir: vi.fn(async () => undefined),
    unlink: vi.fn(async () => undefined),
  } as unknown as Executor;
}

/** Executor that answers every command with the same `stdout` and exit 0. */
export function mockExecutor(stdout = "", id?: string): Executor {
  return handlerExecutor(() => ({ stdout }), id);
}

/** Every command string passed to `executor.exec`, in call order. */
export function execCmds(executor: Executor): string[] {
  return (executor.exec as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
}
