// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Log viewer service — reads and filters system logs via journalctl on the
 * CONNECTED SERVER (never the panel host: the panel journal contains other
 * tenants' traces). All I/O goes through the request's `Executor` and is
 * async, so a slow/hostile query never blocks the event loop.
 * Falls back gracefully when journalctl is unavailable (dev environments).
 */

import { createModuleLogger } from "../../../shared/logger/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import { quoteCmd } from "../../../shared/executor/quote.js";

const log = createModuleLogger("log-viewer");

/** Escape regex metacharacters so journalctl's `--grep` treats the user input
 *  as a LITERAL substring. Prevents a catastrophic-regex DoS (the pattern is
 *  attacker-controlled) while keeping the "search for this text" behavior. */
function grepLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Strict allowlist for journalctl `--since`/`--until` values. Covers absolute
 * timestamps ("2024-01-01 00:00:00"), relative expressions ("1 hour ago",
 * "yesterday") and "now". Anything outside this charset is rejected before it
 * reaches the command (defense-in-depth: we also pass args via execFile/argv so
 * there is no shell to inject into).
 */
const TIME_SPEC_RE = /^[A-Za-z0-9 :+-]{1,64}$/;
/** journalctl `--grep` is a regex; forbid only control chars (argv-safe). */
// eslint-disable-next-line no-control-regex
const GREP_CTRL_RE = /[\r\n\x00]/;

export interface LogEntry {
  timestamp: string;
  unit: string;
  priority: number;
  message: string;
}

export interface LogOptions {
  lines?: number;
  since?: string;  // e.g. "1 hour ago", "2024-01-01 00:00:00"
  until?: string;
  priority?: "emerg" | "alert" | "crit" | "err" | "warning" | "notice" | "info" | "debug";
  grep?: string;
}

/** Services that can be inspected via this API. */
export const LOGGABLE_SERVICES = [
  "postfix",
  "dovecot",
  "opendkim",
  "nginx",
  "postgresql",
  "redis-server",
  "luxipanel", // the panel itself
] as const;

export const logViewerService = {
  /**
   * Fetch logs for a given service unit from journalctl on the connected server.
   * Returns an array of parsed log entries.
   */
  async getServiceLogs(
    executor: Executor,
    service: string,
    options: LogOptions = {},
  ): Promise<LogEntry[]> {
    if (!(LOGGABLE_SERVICES as readonly string[]).includes(service)) {
      throw new Error(`Service "${service}" is not loggable`);
    }

    const lines = Math.min(Math.max(options.lines ?? 100, 1), 500);
    const args: string[] = [
      `--unit=${service}`,
      "--output=json",
      "--no-pager",
      "-n",
      String(lines),
    ];

    if (options.since) {
      if (!TIME_SPEC_RE.test(options.since)) throw new Error("Invalid 'since' value");
      args.push(`--since=${options.since}`);
    }
    if (options.until) {
      if (!TIME_SPEC_RE.test(options.until)) throw new Error("Invalid 'until' value");
      args.push(`--until=${options.until}`);
    }
    if (options.priority) args.push(`--priority=${options.priority}`);
    if (options.grep) {
      if (GREP_CTRL_RE.test(options.grep)) throw new Error("Invalid 'grep' value");
      // Literal substring match — never let a user-supplied regex reach the
      // journalctl engine (ReDoS / 10 s worst-case per request).
      args.push(`--grep=${grepLiteral(options.grep)}`);
    }

    try {
      // Runs on the CONNECTED server via the Executor (SSH/local), async — the
      // command string is fully quoted (quoteCmd) so there is no injection.
      const res = await executor.exec(`${quoteCmd("journalctl", args)} 2>/dev/null`, {
        timeoutMs: 10_000,
      });
      const out = res.stdout ?? "";

      return out
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          try {
            const entry = JSON.parse(line) as Record<string, string>;
            return {
              timestamp: new Date(
                parseInt(entry["__REALTIME_TIMESTAMP"] ?? "0", 10) / 1000,
              ).toISOString(),
              unit: entry["_SYSTEMD_UNIT"] ?? service,
              priority: parseInt(entry["PRIORITY"] ?? "6", 10),
              message: entry["MESSAGE"] ?? "",
            };
          } catch {
            return {
              timestamp: new Date().toISOString(),
              unit: service,
              priority: 6,
              message: line,
            };
          }
        })
        .reverse(); // most recent first
    } catch (err) {
      log.debug({ err, service }, "journalctl unavailable");
      return [];
    }
  },

  /**
   * Get recent kernel/system messages (equivalent to `dmesg`) from the
   * connected server. Limited to the last N lines.
   */
  async getKernelLogs(executor: Executor, lines = 50): Promise<string[]> {
    const cap = Math.min(Math.max(lines, 1), 500);
    try {
      // Async, on the connected server. Slice the last N lines in JS.
      const res = await executor.exec(
        `${quoteCmd("dmesg", ["--time-format=iso", "-H=never"])} 2>/dev/null`,
        { timeoutMs: 5_000 },
      );
      return (res.stdout ?? "").trim().split("\n").filter(Boolean).slice(-cap).reverse();
    } catch (err) {
      log.debug({ err }, "dmesg unavailable");
      return [];
    }
  },
};
