// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Cron constants — single source of truth for the `@alias` → 5-field cron
 * expression expansion shared by the AI-cron scheduler (`normalizeSchedule`)
 * and the cron parser's validation allow-set.
 *
 * NOTE: `@reboot` is intentionally NOT here — it is not time-matchable, so the
 * scheduler treats it specially (returns null) and the parser accepts it via a
 * separate allow-set entry. Human-readable descriptions of these aliases live
 * separately in `cron-parser.service.ts#describe` (different purpose).
 */

/** Alias → the 5-field cron expression it expands to. */
export const CRON_ALIASES: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};
