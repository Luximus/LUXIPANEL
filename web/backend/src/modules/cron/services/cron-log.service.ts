// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Cron log service — reads the per-execution `.log` files written by the
 * `lxp-cron-run` wrapper, through the target executor.
 *
 * Layout on the target:
 *   ${cronLogsDir()}/<jobId>/<UTC-timestamp>.log
 *
 * Each log starts with `=== START <iso> jobId=... ===` and (when finished)
 * ends with `=== END <iso> exit=<code> durationMs=<n> ===`.
 */

import { createModuleLogger } from "../../../shared/logger/index.js";
import { quoteArg, quoteCmd, type Executor } from "../../../shared/executor/index.js";
import { DEFAULT_AUDIT_LIMIT } from "../../../shared/constants.js";
import { cronLogsDir } from "./cron-parser.service.js";
import type { CronExecutionLog } from "../models/index.js";

export type { CronExecutionLog };

const log = createModuleLogger("cron-log");

const SAFE_ID = /^[A-Za-z0-9._-]+$/;
const SAFE_FILE = /^[0-9A-Za-z._-]+\.log$/;

/**
 * The charset regex alone accepts "." and ".." — which, combined with the
 * `rm -rf ${jobDir(id)}` in `clear()` and the `read`/`tail` paths, let a
 * crafted `:id` climb one directory out of the logs tree (audit §5). Reject any
 * dot-traversal component explicitly.
 */
function isSafeId(id: string): boolean {
  return SAFE_ID.test(id) && !id.includes("..") && id !== ".";
}

function jobDir(jobId: string, logsRoot = cronLogsDir()): string {
  return `${logsRoot}/${jobId}`;
}

function parseStart(line: string): string | null {
  const m = /^=== START (\S+)/.exec(line.trim());
  return m ? m[1]! : null;
}

function parseEnd(line: string): { finishedAt: string; exitCode: number; durationMs: number } | null {
  const m = /^=== END (\S+) exit=(-?\d+) durationMs=(\d+)/.exec(line.trim());
  if (!m) return null;
  return { finishedAt: m[1]!, exitCode: parseInt(m[2]!, 10), durationMs: parseInt(m[3]!, 10) };
}

export const cronLogService = {
  /** List recent execution logs for a job (most recent first). */
  async list(jobId: string, executor: Executor, limit = DEFAULT_AUDIT_LIMIT, logsRoot = cronLogsDir(), runAs?: string): Promise<CronExecutionLog[]> {
    if (!isSafeId(jobId)) return [];
    const dir = jobDir(jobId, logsRoot);
    const n = Math.max(1, Math.min(limit, 200));
    // One round-trip: for each of the N newest logs print a record with the
    // START and END marker lines so we can derive status without N reads.
    // `-a` forces text mode: AI-agent logs can carry NUL bytes from the CLI
    // stream, and without it grep says "binary file matches" instead of the
    // marker line → the run shows as "running" forever.
    const script =
      `ls -1t ${quoteArg(dir)}/*.log 2>/dev/null | head -n ${n} | while IFS= read -r f; do ` +
      `echo "FILE:$(basename "$f")"; ` +
      `grep -a -m1 '^=== START' "$f" 2>/dev/null; ` +
      `grep -a -m1 '^=== END' "$f" 2>/dev/null; ` +
      `done`;
    let out = "";
    try {
      const command = runAs ? quoteCmd("sudo", ["-u", runAs, "-H", "sh", "-c", script]) : quoteCmd("sh", ["-c", script]);
      out = (await executor.exec(command, { timeoutMs: 8_000 })).stdout || "";
    } catch (err) {
      log.warn({ err, jobId }, "Failed to list cron logs");
      return [];
    }
    const records: CronExecutionLog[] = [];
    let cur: CronExecutionLog | null = null;
    for (const raw of out.split("\n")) {
      const line = raw.trimEnd();
      if (line.startsWith("FILE:")) {
        if (cur) records.push(cur);
        cur = { file: line.slice(5).trim(), startedAt: null, finishedAt: null, exitCode: null, durationMs: null, running: true };
      } else if (cur && line.startsWith("=== START")) {
        cur.startedAt = parseStart(line);
      } else if (cur && line.startsWith("=== END")) {
        const end = parseEnd(line);
        if (end) {
          cur.finishedAt = end.finishedAt;
          cur.exitCode = end.exitCode;
          cur.durationMs = end.durationMs;
          cur.running = false;
        }
      }
    }
    if (cur) records.push(cur);
    return records;
  },

  /** Read the raw content of one execution log (tail-limited). */
  async read(jobId: string, file: string, executor: Executor, maxBytes = 200_000, logsRoot = cronLogsDir(), runAs?: string): Promise<string> {
    if (!isSafeId(jobId) || !SAFE_FILE.test(file)) {
      throw new Error("Invalid log identifier");
    }
    const path = `${jobDir(jobId, logsRoot)}/${file}`;
    try {
      const command = runAs ? quoteCmd("sudo", ["-u", runAs, "-H", "tail", "-c", String(maxBytes), path]) : quoteCmd("tail", ["-c", String(maxBytes), path]);
      const out = await executor.exec(command, { timeoutMs: 8_000 });
      return out.stdout || "";
    } catch (err) {
      log.warn({ err, jobId, file }, "Failed to read cron log");
      return "";
    }
  },

  /** Append a raw text log file directly (used by the AI agent scheduler). */
  async write(jobId: string, file: string, content: string, executor: Executor): Promise<void> {
    if (!isSafeId(jobId) || !SAFE_FILE.test(file)) return;
    const dir = jobDir(jobId);
    try {
      await executor.exec(quoteCmd("mkdir", ["-p", dir]), { timeoutMs: 5_000 });
      // CLI streams can include NUL bytes; strip them so the file stays a text
      // file (grep-able markers, clean rendering in the viewer).
      await executor.writeFile(`${dir}/${file}`, content.replace(/\u0000/g, ""));
    } catch (err) {
      log.warn({ err, jobId, file }, "Failed to write cron log");
    }
  },

  /** Delete all logs for a job (on removal). */
  async clear(jobId: string, executor: Executor, logsRoot = cronLogsDir(), runAs?: string): Promise<void> {
    if (!isSafeId(jobId)) return;
    try {
      const command = runAs ? quoteCmd("sudo", ["-u", runAs, "-H", "rm", "-rf", jobDir(jobId, logsRoot)]) : quoteCmd("rm", ["-rf", jobDir(jobId, logsRoot)]);
      await executor.exec(command, { timeoutMs: 5_000 });
    } catch {
      /* best-effort */
    }
  },
};
