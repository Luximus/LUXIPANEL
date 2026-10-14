// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
export {
  packageInstaller,
  buildSudoPrefix,
  sudoShell,
  SUDO_PASSWORD_REQUIRED,
  SUDO_PASSWORD_INVALID,
} from "./installer.js";
export type { InstallResult, PackageManager, PackageSpec, SudoOptions, SudoShellResult } from "./installer.js";
export {
  getStoredSudoPassword,
  storeSudoPassword,
  clearSudoPassword,
  hasStoredSudoPassword,
} from "./sudo-credentials.js";
export {
  runWithSudoBypass,
  resolveSudoPassword,
  invalidateSudoPasswordCache,
} from "./sudo-runtime.js";
export {
  readPrivilegedFile,
  readPrivilegedFileOrNull,
  readPrivilegedFileOrEmpty,
} from "./privileged-file-io.js";
export type {
  PrivilegedReadOptions,
  PrivilegedReadResult,
  PrivilegedReadStatus,
} from "./privileged-file-io.js";
export { systemctlIsActive } from "./service-status.js";
export type { SystemctlIsActiveOptions } from "./service-status.js";
export { isCommandInPath, isSafeCommandName, SAFE_COMMAND_NAME_RE } from "./command-probe.js";
export { FILE_MODES } from "./file-modes.js";
export type { FileModeKey } from "./file-modes.js";
