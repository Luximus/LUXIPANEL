// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * One per-execution `.log` file written by the `lxp-cron-run` wrapper (classic
 * jobs) or by the AI-agent scheduler. `running` is true until the `=== END ===`
 * marker line is present.
 */
export interface CronExecutionLog {
  file: string; // bare filename, e.g. "20260607T120000Z.log"
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  durationMs: number | null;
  running: boolean;
}
