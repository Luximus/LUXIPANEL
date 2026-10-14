// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * `executor.stat` existence probes — `try/catch` written once.
 *
 * `obsidian` (twice), `module-dev` and others each wrapped `executor.stat` in
 * the same try/catch to answer "is this path there?" / "give me the stat or
 * null". Both shapes are here so callers stop re-deriving them.
 */

import type { Executor, FileStat } from "./types.js";

/** `stat` of `path`, or `null` when it does not exist / is not reachable. */
export async function statOrNull(executor: Executor, path: string): Promise<FileStat | null> {
  try {
    return await executor.stat(path);
  } catch {
    return null;
  }
}

/** `true` when `path` exists on the target. */
export async function pathExists(executor: Executor, path: string): Promise<boolean> {
  return (await statOrNull(executor, path)) !== null;
}
