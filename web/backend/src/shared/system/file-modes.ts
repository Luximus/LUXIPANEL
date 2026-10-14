// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * POSIX file mode constants (SSOT) — single source of truth for the
 * permission bits used across the panel. Removes the drift between
 * `0o600` / `0o640` / `"0644"` / `"0600"` / `chmod 0644` call sites that
 * were historically hardcoded per module. The `_STR` twins exist for commands that accept octal strings
 * (`chmod`, `MutationStep.mode`, dotenv defaults).
 *
 * Conventions used by these constants:
 *  - WORLD_READABLE   : root-owned, world-readable (mail spool files).
 *  - OWNER_READABLE   : root-owned, group-readable (Dovecot mailboxes).
 *  - OWNER_ONLY       : root-only, no group/world read or write (secrets).
 *  - OWNER_ONLY_DIR   : directory twin of OWNER_ONLY (executable by owner).
 *  - EXECUTABLE       : standard 0755 for scripts/system tools.
 */

export const FILE_MODES = {
  WORLD_READABLE: 0o644,
  WORLD_READABLE_STR: "0644",
  OWNER_READABLE: 0o640,
  OWNER_READABLE_STR: "0640",
  OWNER_ONLY: 0o600,
  OWNER_ONLY_STR: "0600",
  OWNER_ONLY_DIR: 0o700,
  OWNER_ONLY_DIR_STR: "0700",
  EXECUTABLE: 0o755,
  EXECUTABLE_STR: "0755",
} as const;

export type FileModeKey = keyof typeof FILE_MODES;
