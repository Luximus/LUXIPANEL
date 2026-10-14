// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * `git` command-line builder (B-13) — the ONE place that decides how the panel
 * shells out to git on a target server.
 *
 * EVERY invocation carries `-c safe.directory=*`: the panel runs git as the SSH
 * user, NOT as the repo owner, so repos under paths like `/var/www/*` (owned by
 * `www-data`/`root`) otherwise trip git's "dubious ownership" guard —
 * `git rev-parse` exits 128 and a perfectly good repo reads as "not a git
 * repository". The wildcard opts every path out of that check (git ≥ 2.35.3).
 * It must be applied to ALL git calls, not just detection, or status/commit/…
 * fail the same way after detection succeeded.
 *
 * Lives in `shared/` because both `files/` (git.service, file-history.service)
 * and `ai-assistant/` (team-isolation.service) build the same line, and modules
 * may not import each other.
 */

import { quoteCmd } from "../executor/quote.js";

/** `git -c safe.directory=* <args…>`, fully shell-quoted. */
export function gitCmd(args: string[]): string {
  return quoteCmd("git", ["-c", "safe.directory=*", ...args]);
}

/** `git -c safe.directory=* -C <repo> <args…>`. */
export function gitCmdIn(repo: string, args: string[]): string {
  return gitCmd(["-C", repo, ...args]);
}
