// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * config/paths.ts — single source of truth for the per-server config dir.
 *
 * The directory is validated (and defaulted to `/etc/luxipanel`) by the Zod
 * schema in `config/env.ts`, so the `env.LUXIPANEL_CONFIG_DIR || "/etc/luxipanel"`
 * pattern that used to be copy-pasted across ~19 files was both a duplicated
 * literal AND dead code (the `|| …` branch can never run). It also drifted:
 * some callers stripped a trailing slash, some did not.
 *
 * Use these two accessors instead of re-reading the env / re-typing the literal:
 *
 *  • {@link CONFIG_DIR} — the validated value verbatim (matches the former
 *    `env.LUXIPANEL_CONFIG_DIR || "/etc/luxipanel"` sites that did NOT strip).
 *  • {@link panelConfigDir} — the validated value with trailing slashes removed
 *    (matches the former `.replace(/\/$/, "")` / `.replace(/\/+$/, "")` sites).
 *
 * Both return `/etc/luxipanel` for the default, so behaviour is unchanged; the
 * only difference (an operator-supplied trailing slash) is normalised once here.
 *
 * NOTE (managed mode): this is the path *string* resolved on whichever server
 * the current session is bridged to — it does NOT touch the panel host's disk.
 * Reads/writes under it always go through the per-request `Executor`.
 */

import { env } from "./env.js";

/** Validated per-server config dir, verbatim (default `/etc/luxipanel`). */
export const CONFIG_DIR: string = env.LUXIPANEL_CONFIG_DIR;

/** {@link CONFIG_DIR} with any trailing slash(es) removed. */
export function panelConfigDir(): string {
  return CONFIG_DIR.replace(/\/+$/, "");
}
