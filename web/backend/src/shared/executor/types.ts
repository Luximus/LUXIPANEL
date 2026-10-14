// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Shared executor contract.
 */

import type { Duplex } from "node:stream";

export interface ExecOptions {
  /** Local jobs can abort a running process without waiting for its timeout. */
  signal?: AbortSignal;
  /** Instance repair verification must not inherit production secrets. */
  isolatedEnv?: boolean;
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export interface WriteOptions {
  encoding?: BufferEncoding;
  /**
   * POSIX permission bits to apply to the file AT CREATION (e.g. `0o600`).
   * Use this for any file that briefly holds a secret (a staged passphrase /
   * `REDISCLI_AUTH` tmp) so it is never group/world-readable during its short
   * lifetime — relying on the server umask leaves it `0644`/`0664`. On an
   * existing file the mode is also enforced. `undefined` keeps the default
   * (umask-derived) behaviour.
   */
  mode?: number;
}

export interface DirEntry {
  name: string;
  path: string;
  type: "file" | "dir" | "symlink";
  isDir: boolean;
  size: number;
  mode: string;
  mtime: Date;
  isReadable: boolean;
  isWritable: boolean;
  isHidden: boolean;
  hasGit: boolean;
  gitStatus: "new" | "modified" | "staged" | "deleted" | null;
  /** Owner username (or numeric uid if unresolved). Filled by the list
   *  endpoint via a single `find -printf` per directory; optional because
   *  raw readdir/SFTP doesn't carry it. */
  owner?: string;
  /** Owner group name (or numeric gid if unresolved). */
  group?: string;
}

export interface FileStat extends DirEntry {}

export type SftpBatchOperation =
  | { id: string; op: "readFile"; path: string; encoding?: BufferEncoding }
  | { id: string; op: "writeFile"; path: string; data: string | Buffer; mode?: number }
  | { id: string; op: "readdir"; path: string }
  | { id: string; op: "stat"; path: string }
  | { id: string; op: "mkdir"; path: string; recursive?: boolean }
  | { id: string; op: "unlink"; path: string }
  | { id: string; op: "rename"; from: string; to: string };

export type SftpBatchResult = {
  id: string;
  op: SftpBatchOperation["op"];
  ok: boolean;
  data?: unknown;
  error?: string;
};

/**
 * Command execution role: run one-shot commands and open interactive
 * (PTY) streams on the target.
 */
export interface CommandRunner {
  exec(cmd: string, opts?: ExecOptions): Promise<ExecResult>;
  spawn(cmd: string, args: string[]): Duplex;
}

/**
 * Filesystem / SFTP I/O role: read and mutate files and directories on the
 * target, optionally batched in a single round-trip.
 */
export interface RemoteFs {
  readFile(path: string, encoding?: BufferEncoding): Promise<string | Buffer>;
  writeFile(path: string, data: string | Buffer, opts?: WriteOptions): Promise<void>;
  readdir(path: string): Promise<DirEntry[]>;
  stat(path: string): Promise<FileStat>;
  mkdir(path: string, opts?: { recursive?: boolean }): Promise<void>;
  unlink(path: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  batchSftp?(operations: SftpBatchOperation[]): Promise<SftpBatchResult[]>;
}

/**
 * Credential / identity metadata role: who this executor connects as and
 * the secrets/identity it can surface for scoping and elevation.
 */
export interface CredentialSource {
  readonly target: { id: string; name: string };
  /**
   * The Linux username of the SSH connection to the client server (the
   * operator's account on that box). Available on direct-SSH executors;
   * `undefined` on the proxy executor (LP holds the credential). Used to
   * scope per-(linux-user) bookkeeping on the client server.
   */
  readonly sshUsername?: string;
  /**
   * The secret that unlocks this connection's SSH key, which by design also
   * doubles as the `sudo -S` password on the target (LP's "one passphrase
   * covers SSH unlock + sudo elevation" model — see `user_ssh_keys.
   * encryptedPassphrase`). Returned per executor INSTANCE (one operator's
   * live session), never cached under the shared server `target.id`, so it
   * can't leak across operators on the same server. `undefined` when the
   * executor doesn't hold a passphrase (key without one). The proxy executor
   * fetches it from LP, hence the optional Promise return — always `await`.
   */
  getSudoPasswordHint?(): string | undefined | Promise<string | undefined>;
}

/**
 * Full executor contract — the composition of the command-execution,
 * filesystem and credential roles. Structurally identical to the historical
 * monolithic interface; consumers may depend on a narrower role instead.
 */
export interface Executor extends CommandRunner, RemoteFs, CredentialSource {
  /** Private cache transport only; never exposed as an HTTP/tool port forward. */
  openCacheStream?(port: number): Promise<Duplex>;
  readonly cacheTransportIdentity?: object;
}
