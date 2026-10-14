// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Local executor — uses the host filesystem and shell.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { execFile, spawn as spawnProcess } from "node:child_process";
import { promisify } from "node:util";
import { Duplex, type Duplex as DuplexType } from "node:stream";

import type {
  DirEntry,
  ExecOptions,
  ExecResult,
  Executor,
  FileStat,
  SftpBatchOperation,
  SftpBatchResult,
  WriteOptions,
} from "./types.js";
import { EXEC_OUTPUT_MAX_BYTES } from "./constants.js";

const execFileAsync = promisify(execFile);

/** Canonical target id for the panel host itself (the "local" executor). */
export const LOCAL_TARGET_ID = "local" as const;

function toDirEntry(fullPath: string, stat: Awaited<ReturnType<typeof fs.stat>>, hasGit = false): DirEntry {
  const name = path.basename(fullPath);
  const type: DirEntry["type"] = stat.isSymbolicLink() ? "symlink" : stat.isDirectory() ? "dir" : "file";
  return {
    name,
    path: fullPath,
    type,
    isDir: type === "dir",
    size: Number(stat.size),
    mode: stat.mode.toString(8).slice(-4),
    mtime: stat.mtime,
    isReadable: true,
    isWritable: true,
    isHidden: name.startsWith("."),
    hasGit,
    gitStatus: null,
  };
}

/** Async, non-blocking check for a `.git` entry — only meaningful for
 *  directories. The old code ran a SYNC `existsSync` for EVERY entry (even
 *  regular files), so a listing of /usr/bin (~3000 entries) fired ~3000
 *  blocking syscalls on the event loop. */
async function hasGitChild(dirPath: string): Promise<boolean> {
  try {
    await fs.access(path.join(dirPath, ".git"));
    return true;
  } catch {
    return false;
  }
}

async function statToEntry(fullPath: string): Promise<FileStat> {
  const stat = await fs.lstat(fullPath);
  const hasGit = stat.isDirectory() ? await hasGitChild(fullPath) : false;
  return toDirEntry(fullPath, stat, hasGit);
}

export const localExecutor: Executor = {
  target: { id: LOCAL_TARGET_ID, name: "Local" },

  async exec(cmd: string, opts: ExecOptions = {}): Promise<ExecResult> {
    const started = Date.now();
    const environment = { ...(opts.isolatedEnv ? Object.fromEntries(["PATH", "HOME", "USER", "LANG", "LC_ALL", "TMPDIR", "PNPM_HOME"].filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]])) : process.env), ...(opts.env ?? {}) };
    if (opts.signal) return new Promise<ExecResult>((resolve, reject) => {
      opts.signal!.throwIfAborted();
      const child = spawnProcess(cmd, { shell: true, cwd: opts.cwd, env: environment, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "", stderr = "", bytes = 0, failure: Error | undefined;
      const stop = (error: Error) => { failure = error; try { if (child.pid && process.platform !== "win32") process.kill(-child.pid, "SIGKILL"); else child.kill("SIGKILL"); } catch { /* exited */ } };
      const abort = () => stop(new Error("Command aborted"));
      opts.signal!.addEventListener("abort", abort, { once: true });
      const timer = opts.timeoutMs ? setTimeout(() => stop(new Error("Command timed out")), opts.timeoutMs) : undefined;
      const clean = () => { opts.signal!.removeEventListener("abort", abort); if (timer) clearTimeout(timer); };
      for (const [stream, isError] of [[child.stdout, false], [child.stderr, true]] as const) stream?.on("data", (chunk: Buffer) => { bytes += chunk.length; if (bytes > EXEC_OUTPUT_MAX_BYTES) { stop(new Error("Command output limit exceeded")); return; } if (isError) stderr += chunk; else stdout += chunk; });
      child.on("error", (error) => { clean(); reject(error); });
      child.on("close", (code) => { clean(); if (failure) reject(failure); else resolve({ stdout, stderr, exitCode: code ?? 1, durationMs: Date.now() - started }); });
      if (opts.signal!.aborted) abort();
    });
    try {
      const { stdout, stderr } = await execFileAsync(cmd, {
        shell: true,
        cwd: opts.cwd,
        env: environment,
        timeout: opts.timeoutMs,
        maxBuffer: EXEC_OUTPUT_MAX_BYTES,
      });
      return { stdout: String(stdout), stderr: String(stderr), exitCode: 0, durationMs: Date.now() - started };
    } catch (err) {
      // A NON-ZERO EXIT IS A RESULT, NOT AN EXCEPTION.
      //
      // `execFile` rejects when the command exits non-zero, and this used to
      // hardcode `exitCode: 0` on the success path — so exec() could only ever
      // return 0, and a failing command threw instead. That silently broke the
      // ~140 call sites that branch on `exitCode !== 0`: unreachable in every
      // path served by the local executor (standalone-local mode, and the panel
      // host itself), while working fine over SSH.
      //
      // DirectSshExecutor is the reference contract — it resolves with
      // `exitCode: code ?? 0` and never throws on a non-zero exit. Both classes
      // implement the same `Executor` interface, so they must behave the same.
      const e = err as { code?: number | string; stdout?: unknown; stderr?: unknown };
      if (typeof e.code === "number") {
        return {
          stdout: String(e.stdout ?? ""),
          stderr: String(e.stderr ?? ""),
          exitCode: e.code,
          durationMs: Date.now() - started,
        };
      }
      // Everything else IS exceptional and keeps propagating: timeout kill
      // (`killed: true`, code null), maxBuffer overflow (code is a string
      // ERR_* id), spawn failure. Those are not "the command said no".
      throw err;
    }
  },

  async readFile(filePath: string, encoding?: BufferEncoding): Promise<string | Buffer> {
    return fs.readFile(filePath, encoding ? { encoding } : undefined);
  },

  async writeFile(filePath: string, data: string | Buffer, opts: WriteOptions = {}): Promise<void> {
    await fs.writeFile(filePath, data, { encoding: opts.encoding, mode: opts.mode });
    // fs.writeFile's `mode` only applies when it CREATES the file; on an
    // existing path the bits are untouched. chmod unconditionally so a secret
    // tmp ends at the requested mode even if the path was pre-created.
    if (opts.mode !== undefined) await fs.chmod(filePath, opts.mode);
  },

  async readdir(dirPath: string): Promise<DirEntry[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    // Parallelize the per-entry lstat + (dir-only) .git probe instead of a
    // sequential blocking loop — a large directory no longer stalls the loop.
    return Promise.all(
      entries.map(async (entry) => {
        const full = path.join(dirPath, entry.name);
        const stat = await fs.lstat(full);
        const hasGit = stat.isDirectory() ? await hasGitChild(full) : false;
        return toDirEntry(full, stat, hasGit);
      }),
    );
  },

  async stat(filePath: string): Promise<FileStat> {
    return statToEntry(filePath);
  },

  async mkdir(dirPath: string, opts: { recursive?: boolean } = {}): Promise<void> {
    await fs.mkdir(dirPath, { recursive: opts.recursive ?? false });
  },

  async unlink(filePath: string): Promise<void> {
    await fs.unlink(filePath);
  },

  async rename(from: string, to: string): Promise<void> {
    await fs.rename(from, to);
  },

  async batchSftp(operations: SftpBatchOperation[]): Promise<SftpBatchResult[]> {
    const results: SftpBatchResult[] = [];
    for (const op of operations) {
      try {
        if (op.op === "stat") {
          results.push({ id: op.id, op: op.op, ok: true, data: await this.stat(op.path) });
        } else if (op.op === "readFile") {
          const data = await this.readFile(op.path, op.encoding ?? "utf-8");
          results.push({ id: op.id, op: op.op, ok: true, data });
        } else if (op.op === "writeFile") {
          // Forward the requested `mode` so a batched writeFile enforces the
          // same POSIX bits as a single writeFile. `undefined` mode keeps the
          // default (umask) behaviour untouched.
          await this.writeFile(op.path, op.data, { mode: op.mode });
          results.push({ id: op.id, op: op.op, ok: true });
        } else if (op.op === "readdir") {
          results.push({ id: op.id, op: op.op, ok: true, data: await this.readdir(op.path) });
        } else if (op.op === "mkdir") {
          await this.mkdir(op.path, { recursive: op.recursive });
          results.push({ id: op.id, op: op.op, ok: true });
        } else if (op.op === "unlink") {
          await this.unlink(op.path);
          results.push({ id: op.id, op: op.op, ok: true });
        } else if (op.op === "rename") {
          await this.rename(op.from, op.to);
          results.push({ id: op.id, op: op.op, ok: true });
        }
      } catch (err) {
        results.push({ id: op.id, op: op.op, ok: false, error: (err as Error).message });
      }
    }
    return results;
  },

  spawn(cmd: string, args: string[]): DuplexType {
    const child = spawnProcess(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });

    class ChildProcessDuplex extends Duplex {
      _read(): void {}

      _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
        if (!child.stdin || child.killed) {
          callback(new Error("Process stdin is closed"));
          return;
        }
        child.stdin.write(chunk, callback);
      }

      _final(callback: (error?: Error | null) => void): void {
        child.stdin?.end();
        callback();
      }
    }

    const stream = new ChildProcessDuplex();
    child.stdout?.on("data", (chunk) => stream.push(chunk));
    child.stderr?.on("data", (chunk) => stream.push(chunk));
    child.on("close", () => stream.push(null));
    return stream;
  },
};
