// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Canonical "non-login shell" definition (SSOT).
 *
 * A Linux account whose login shell is one of these is a service/system
 * account that cannot log in interactively (nologin/false/`/dev/null`, or an
 * empty shell field). Centralized here so the predicate has ONE definition
 * instead of being re-encoded per module (users / files / monitor).
 *
 * Exported shape:
 *  - `NON_LOGIN_SHELLS` — the exact-match Set (empty + the absolute paths) used
 *    by `system-accounts.service.ts` to filter `getent passwd` rows. Membership
 *    is by full path string, identical to the legacy inline Set.
 */

/**
 * Exact login-shell strings that mark a non-interactive account. Mirrors the
 * canonical Set historically inlined in `system-accounts.service.ts`. Order is
 * irrelevant (Set), but kept stable for readability.
 */
export const NON_LOGIN_SHELLS: ReadonlySet<string> = new Set([
  "",
  "/usr/sbin/nologin",
  "/sbin/nologin",
  "/bin/nologin",
  "/usr/bin/nologin",
  "/bin/false",
  "/usr/bin/false",
  "/dev/null",
]);
