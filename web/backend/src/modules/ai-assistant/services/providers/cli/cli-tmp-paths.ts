// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Shared temp-path conventions for the CLI bridge.
 *
 * The bridge mints a per-job workspace under `/tmp/lxp-cli-<id>` (the cwd of
 * the CLI process) and a parallel secrets dir at `/tmp/lxp-cli-<id>-sec`
 * (sudo askpass shim, see `cli-sudo-askpass.ts`). These paths are referenced
 * from the runner, the background-job tracker, the graph indexer's
 * "ephemeral project" sweep and the sudo askpass setup — keeping the
 * construction in one place makes sure the producer and consumer (and the
 * indexer's exclusion predicate) agree byte-for-byte.
 *
 * NOTE: the `id` here is the SAME token the call site already had — for the
 * cli-bridge job it is the `jobId` (which itself starts with `lxp-cli-`,
 * hence `/tmp/lxp-cli-lxp-cli-<ts>-<rand>-sec`), and for the per-conversation
 * cwd it is the raw `conversationId`. Helpers do NOT prefix anything: the
 * caller controls which token flows in, the same way the original inline
 * templates did.
 */

const CLI_WORK_DIR_PREFIX = "/tmp/lxp-cli-";
const CLI_SECRETS_DIR_SUFFIX = "-sec";

/** Per-job (or per-conversation) working dir used as the CLI's `cwd`. */
export function cliWorkDir(id: string): string {
  return `${CLI_WORK_DIR_PREFIX}${id}`;
}

/** Per-job secrets dir holding the sudo askpass shim + 0600 password file. */
export function cliSecretsDir(id: string): string {
  return `${CLI_WORK_DIR_PREFIX}${id}${CLI_SECRETS_DIR_SUFFIX}`;
}

/**
 * True when `path` lies under the per-job CLI temp tree (work dir or secrets
 * dir). Used by the graph indexer's ephemeral-project sweep to drop entries
 * that auto-index picked up from per-conversation CLI cwds. Matches BOTH the
 * `/tmp/lxp-cli-<id>` and `/tmp/lxp-cli-<id>-sec` shapes via the shared
 * `/tmp/lxp-cli-` prefix.
 */
export function isCliTempPath(path: string): boolean {
  return path.startsWith(CLI_WORK_DIR_PREFIX);
}