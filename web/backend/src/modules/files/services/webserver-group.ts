// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Detect the group the webserver worker runs as on the CONNECTED server.
 *
 * Used to group-own files the webserver must read (share `meta.json`,
 * `.htpasswd`) WITHOUT making them world-readable: the file gets
 * `0640`/`0660` + `chgrp <webgroup>` instead of `a+r`.
 *
 * Tries the usual worker groups in order; returns null when none exists
 * (callers decide their own fallback). Best-effort and read-only.
 */

import type { Executor } from "../../../shared/executor/index.js";

const CANDIDATE_GROUPS = ["www-data", "nginx", "apache", "http"];

export async function detectWebserverGroup(executor: Executor): Promise<string | null> {
  try {
    // `getent group a b c` prints the entries that exist (exit 2 when any key
    // is missing — the output is still valid, so don't gate on exitCode).
    const res = await executor.exec(
      `getent group ${CANDIDATE_GROUPS.join(" ")} | head -n1 | cut -d: -f1`,
      { timeoutMs: 8_000 },
    );
    const group = (res.stdout || "").trim().split("\n")[0]?.trim() ?? "";
    return /^[a-z_][a-z0-9_-]*$/i.test(group) ? group : null;
  } catch {
    return null;
  }
}
