// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * A single crontab entry as surfaced by the panel.
 *
 * Panel-created ("managed") jobs are stored through the `lxp-cron-run` wrapper
 * (`<schedule> <wrapper> <jobId> <base64(command)> # <comment>`); `command`
 * here is always the ORIGINAL command (wrapper + base64 already decoded). Lines
 * not matching the wrapper are "legacy" external entries, shown read-as-is with
 * a hash id and no per-run logging.
 */
export interface CronJob {
  id: string; // stable UUID for panel jobs; hash for legacy lines
  schedule: string; // e.g. "0 2 * * *"
  command: string; // ORIGINAL command (wrapper + base64 already decoded)
  comment: string | null;
  user: string; // "root" or the running user
  enabled: boolean; // false when paused (#LXP-OFF prefix)
  managed: boolean; // true when written by the panel (wrapped, has logs)
  wrapperPath?: string; // distinguishes legacy root logs from per-user logs
  raw: string;
}
