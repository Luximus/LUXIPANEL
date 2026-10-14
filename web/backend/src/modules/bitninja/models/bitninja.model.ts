// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * BitNinja server-security agent models — types shared across the module.
 *
 * BitNinja is a commercial protection agent (WAF, anti-DoS, malware
 * detection, IP reputation), NOT a file scanner. The module installs it with
 * the CLIENT's own license key, reports its runtime status, controls the
 * service and toggles its components. Flags follow the official BitNinja CLI
 * (`--status-all`, `--version`, `--licenseinfo`, `--reinstall-license-key=`,
 * `--module=<N> --enable|--disable`) and output is parsed defensively, so we
 * never hard-fail on unexpected output across versions.
 */

import { SUDO_PASSWORD_REQUIRED, SUDO_PASSWORD_INVALID } from "../../../shared/system/index.js";

export type ServiceAction = "start" | "stop" | "restart";

export interface BitNinjaComponent {
  /** Component/module name as reported by `bitninjacli --status-all` (e.g. "WAFManager"). */
  name: string;
  /** Whether the component is currently active/running. */
  active: boolean;
}

export interface BitNinjaStatus {
  /** `bitninjacli` is present on the target. */
  installed: boolean;
  /** The agent service is running. */
  running: boolean;
  /** License looks valid according to the status output (best-effort). */
  licenseValid: boolean;
  /** `bitninjacli --version` (null when not installed/unknown). */
  version: string | null;
  /** Components parsed from the status output. */
  components: BitNinjaComponent[];
  /** Raw `bitninjacli --status-all` text (trimmed) for the UI to show verbatim. */
  raw: string;
}

export interface BitNinjaActionResult {
  ok: boolean;
  exitCode: number;
  output: string;
  /** Set when sudo refused: the UI prompts for the passphrase / re-binds sudoers. */
  code?: typeof SUDO_PASSWORD_REQUIRED | typeof SUDO_PASSWORD_INVALID;
}
