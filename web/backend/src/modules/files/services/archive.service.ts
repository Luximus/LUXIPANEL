// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Archive service — compress and decompress files (tar.gz, zip).
 * All paths validated through filesystem sandbox.
 */

import { execFileSync, execSync } from "node:child_process";
import path from "node:path";
import { safePath } from "./filesystem.service.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { quoteArg, quoteCmd, type Executor } from "../../../shared/executor/index.js";
import { isPathUnder } from "../../../shared/utils/path-containment.js";

const log = createModuleLogger("archive");

export type ArchiveFormat = "tar.gz" | "tar.bz2" | "zip";

function hasCommand(commandName: string): boolean {
  try {
    execSync(`command -v ${commandName}`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

async function hasCommandWithExecutor(executor: Executor, commandName: string): Promise<boolean> {
  try {
    const result = await executor.exec(`command -v ${commandName}`);
    return result.exitCode === 0 && result.stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Python ZIP builder used as the `zip`-command fallback (host-side and via
 * executor). Reads `sys.argv[1]` = dest, `sys.argv[2:]` = sources.
 */
const PYTHON_ZIP_SCRIPT = `
import os
import pathlib
import sys
import zipfile

dest = pathlib.Path(sys.argv[1])
sources = [pathlib.Path(arg) for arg in sys.argv[2:]]

with zipfile.ZipFile(dest, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    for source in sources:
        if source.is_dir():
            base = source.name
            for root, _, files in os.walk(source):
                root_path = pathlib.Path(root)
                for name in files:
                    full_path = root_path / name
                    arcname = pathlib.Path(base) / full_path.relative_to(source)
                    archive.write(full_path, arcname.as_posix())
        else:
            archive.write(source, source.name)
`.trim();

function createZipArchiveWithPython(sources: string[], dest: string): void {
  if (!hasCommand("python3")) {
    throw new Error("ZIP compression requires python3 when the zip command is not installed");
  }

  execFileSync("python3", ["-c", PYTHON_ZIP_SCRIPT, dest, ...sources], {
    timeout: 120_000,
    stdio: "pipe",
  });
}

// ---------------------------------------------------------------------------
// Zip-slip / symlink containment guard (shared by the local and executor
// extraction paths).
//
//   • Member names: reject NUL bytes, absolute paths, any `..` component, and
//     anything that — after posix normalisation — resolves outside the
//     destination directory.
//   • Symlink/hardlink members (tar): neither GNU tar nor unzip has a
//     `--no-follow-symlinks` extraction flag, so the "safe equivalent" is a
//     pre-extraction audit of the VERBOSE listing — symlink (`l`) and hardlink
//     (`h`) members whose target escapes the destination are rejected before
//     tar ever runs.
//   • Zip: Info-ZIP `unzip` DOES materialise symlink members on Unix and the
//     central directory does not expose their targets without extracting, so
//     zip archives containing symlink members are rejected outright.
//   • Listing failures are FAIL-CLOSED for tar/zip (cannot audit → do not
//     extract). RAR keeps the best-effort name-only guard (7z/unrar listings
//     don't expose link targets; 7z does not restore symlinks by default).
// ---------------------------------------------------------------------------

/** Throw unless `member` stays inside `resolvedDest` once extracted. */
function assertMemberContained(member: string, resolvedDest: string): void {
  if (member.includes("\0")) {
    throw new Error('Refusing to extract: archive member contains a NUL byte');
  }
  const unified = member.replace(/\\/g, "/");
  if (unified.startsWith("/") || /^[A-Za-z]:\//.test(unified)) {
    throw new Error(`Refusing to extract: absolute archive member "${member}"`);
  }
  if (unified.split("/").some((part) => part === "..")) {
    throw new Error(`Refusing to extract: archive member "${member}" contains ".."`);
  }
  const memberPath = path.posix.resolve(resolvedDest, path.posix.normalize(unified));
  if (!isPathUnder(resolvedDest, memberPath)) {
    throw new Error(`Refusing to extract: archive member "${member}" would escape destination`);
  }
}

/** Throw when a symlink/hardlink member's target escapes `resolvedDest`. */
function assertLinkTargetContained(name: string, target: string, resolvedDest: string): void {
  const t = target.replace(/\\/g, "/").trim();
  if (!t || t.includes("\0")) {
    throw new Error(`Refusing to extract: link member "${name}" has an invalid target`);
  }
  if (t.startsWith("/")) {
    throw new Error(`Refusing to extract: link member "${name}" targets an absolute path ("${target}")`);
  }
  const linkDir = path.posix.dirname(path.posix.resolve(resolvedDest, path.posix.normalize(name.replace(/\\/g, "/"))));
  const resolvedTarget = path.posix.resolve(linkDir, t);
  if (!isPathUnder(resolvedDest, resolvedTarget)) {
    throw new Error(`Refusing to extract: link member "${name}" points outside the destination ("${target}")`);
  }
}

/**
 * Validate a `tar -tv…` verbose listing: every member name must be contained,
 * and symlink (`l…`) / hardlink (`h…`) members must have contained targets.
 */
function assertTarVerboseListingSafe(lines: string[], resolvedDest: string): void {
  for (const line of lines) {
    if (!line.trim()) continue;
    // "lrwxrwxrwx owner/group 0 2026-07-21 10:00 dir/link -> ../../etc"
    const m = line.match(/^(\S+)\s+\S+\s+\S+\s+\S+\s+\S+\s+(.*)$/);
    if (!m) {
      // Unparseable listing row → we cannot prove containment. Fail closed.
      throw new Error(`Refusing to extract: could not validate archive member row "${line}"`);
    }
    const mode = m[1]!;
    let name = m[2]!;
    let linkTarget: string | null = null;
    if (mode.startsWith("l")) {
      const arrow = name.lastIndexOf(" -> ");
      if (arrow >= 0) {
        linkTarget = name.slice(arrow + 4);
        name = name.slice(0, arrow);
      }
    } else if (mode.startsWith("h")) {
      const arrow = name.lastIndexOf(" link to ");
      if (arrow >= 0) {
        linkTarget = name.slice(arrow + 9);
        name = name.slice(0, arrow);
      }
    }
    assertMemberContained(name, resolvedDest);
    if (linkTarget !== null) assertLinkTargetContained(name, linkTarget, resolvedDest);
  }
}

/** Verbose tar listing flag for a given archive basename (null = not tar). */
function tarVerboseListFlag(base: string): string | null {
  if (base.endsWith(".tar.gz") || base.endsWith(".tgz")) return "-tvzf";
  if (base.endsWith(".tar.bz2")) return "-tvjf";
  if (base.endsWith(".tar")) return "-tvf";
  return null;
}

/** Reject zipinfo (`unzip -Z`) rows describing symlink members. */
function assertZipinfoHasNoSymlinks(lines: string[]): void {
  for (const line of lines) {
    // Entry rows start with the unix mode string; headers/footers don't start with "l".
    if (/^l/.test(line)) {
      throw new Error("Refusing to extract: ZIP archive contains symlink members");
    }
  }
}

export const archiveService = {
  /**
   * Create an archive from the given source paths.
   * @param sources  Array of paths to include in the archive
   * @param dest     Destination archive file path
   * @param format   Archive format
   */
  compress(sources: string[], dest: string, format: ArchiveFormat = "tar.gz"): void {
    const safeSources = sources.map(safePath);
    const safeDest = safePath(dest);

    switch (format) {
      case "tar.gz":
        execFileSync("tar", ["-czf", safeDest, ...safeSources], { timeout: 120_000, stdio: "pipe" });
        break;
      case "tar.bz2":
        execFileSync("tar", ["-cjf", safeDest, ...safeSources], { timeout: 120_000, stdio: "pipe" });
        break;
      case "zip":
        if (!hasCommand("zip")) {
          createZipArchiveWithPython(safeSources, safeDest);
          log.info({ dest: safeDest, sources: safeSources, format, fallback: "python3" }, "Archive created");
          return;
        }
        execFileSync("zip", ["-r", safeDest, ...safeSources], { timeout: 120_000, stdio: "pipe" });
        break;
    }

    log.info({ dest: safeDest, sources: safeSources, format }, "Archive created");
  },

  /** Create an archive through an executor when the target is bridged. */
  async compressWithExecutor(
    sources: string[],
    dest: string,
    format: ArchiveFormat,
    executor: Executor,
  ): Promise<void> {
    const safeSources = sources.map(safePath);
    const safeDest = safePath(dest);

    switch (format) {
      case "tar.gz":
        await executor.exec(quoteCmd("tar", ["-czf", safeDest, ...safeSources]));
        break;
      case "tar.bz2":
        await executor.exec(quoteCmd("tar", ["-cjf", safeDest, ...safeSources]));
        break;
      case "zip": {
        if (await hasCommandWithExecutor(executor, "zip")) {
          await executor.exec(quoteCmd("zip", ["-r", safeDest, ...safeSources]));
          break;
        }
        if (!(await hasCommandWithExecutor(executor, "python3"))) {
          throw new Error("ZIP compression requires python3 when the zip command is not installed");
        }
        await executor.exec(quoteCmd("python3", ["-c", PYTHON_ZIP_SCRIPT, safeDest, ...safeSources]));
        break;
      }
    }

    log.info({ dest: safeDest, sources: safeSources, format, target: executor.target.id }, "Archive created via executor");
  },

  /**
   * Build a ZIP at a panel-controlled destination for streaming downloads
   * (folder / multi-select "download as zip").
   *
   * Unlike compressWithExecutor, `dest` is NOT run through safePath: it is a
   * temp path the panel generates itself (mktemp), never user input, so the
   * sandbox check would be meaningless here. The SOURCES are still safePath'd.
   *
   * python3 is preferred because zipfile stores clean member names
   * (`<basename>/…`); the `zip` fallback zips basenames from the sources' common
   * parent to get the same clean layout (a bare `zip -r /abs/dir` would embed
   * the full `var/www/…` path in every entry).
   */
  async buildDownloadZip(sources: string[], dest: string, executor: Executor): Promise<void> {
    if (sources.length === 0) throw new Error("No sources to archive");
    const safeSources = sources.map(safePath);

    if (await hasCommandWithExecutor(executor, "python3")) {
      await executor.exec(quoteCmd("python3", ["-c", PYTHON_ZIP_SCRIPT, dest, ...safeSources]));
    } else if (await hasCommandWithExecutor(executor, "zip")) {
      const parent = path.posix.dirname(safeSources[0]!);
      const shareParent = safeSources.every((s) => path.posix.dirname(s) === parent);
      if (!shareParent) {
        throw new Error("ZIP download of items from different folders requires python3 on the server");
      }
      const names = safeSources.map((s) => path.posix.basename(s));
      // cd into the common parent so entries are stored as `<name>/…`, not the
      // absolute path. executor.exec runs a shell, so `cd && zip` is safe here.
      const cmd = `cd ${quoteArg(parent)} && ${quoteCmd("zip", ["-r", "-q", dest, ...names])}`;
      await executor.exec(cmd);
    } else {
      throw new Error("ZIP download requires python3 or the 'zip' command on the server");
    }

    log.info({ dest, sources: safeSources, target: executor.target.id }, "Download ZIP built via executor");
  },

  /**
   * Extract an archive to the given destination directory.
   * @param archivePath  Path to archive file
   * @param destDir      Directory to extract into
   */
  extract(archivePath: string, destDir: string): void {
    const safeArchive = safePath(archivePath);
    const safeDest = safePath(destDir);

    const ext = path.extname(safeArchive).toLowerCase();
    const base = path.basename(safeArchive).toLowerCase();

    // Zip-slip + symlink containment guard: audit the archive listing BEFORE
    // extracting. tar/zip honor `../` member names (write outside the dest)
    // and symlink members let a later member write through the link.
    const resolvedDest = path.resolve(safeDest);
    const tarFlag = tarVerboseListFlag(base);
    if (tarFlag) {
      let listing: string;
      try {
        listing = execFileSync("tar", [tarFlag, safeArchive], { encoding: "utf-8", timeout: 30_000, stdio: "pipe" });
      } catch {
        throw new Error("Refusing to extract: could not list archive contents for validation");
      }
      assertTarVerboseListingSafe(listing.split("\n"), resolvedDest);
    } else if (ext === ".zip") {
      let names: string;
      let info: string;
      try {
        names = execFileSync("unzip", ["-Z1", safeArchive], { encoding: "utf-8", timeout: 30_000, stdio: "pipe" });
        info = execFileSync("unzip", ["-Z", safeArchive], { encoding: "utf-8", timeout: 30_000, stdio: "pipe" });
      } catch {
        throw new Error("Refusing to extract: could not list archive contents for validation");
      }
      for (const m of names.split("\n").filter(Boolean)) assertMemberContained(m, resolvedDest);
      assertZipinfoHasNoSymlinks(info.split("\n"));
    } else {
      // RAR: best-effort name guard (listings expose no link targets).
      for (const m of this.listContents(archivePath)) assertMemberContained(m, resolvedDest);
    }

    if (base.endsWith(".tar.gz") || base.endsWith(".tgz")) {
      execFileSync("tar", ["-xzf", safeArchive, "-C", safeDest], { timeout: 120_000, stdio: "pipe" });
    } else if (base.endsWith(".tar.bz2")) {
      execFileSync("tar", ["-xjf", safeArchive, "-C", safeDest], { timeout: 120_000, stdio: "pipe" });
    } else if (ext === ".zip") {
      execFileSync("unzip", ["-o", safeArchive, "-d", safeDest], { timeout: 120_000, stdio: "pipe" });
    } else if (ext === ".tar") {
      execFileSync("tar", ["-xf", safeArchive, "-C", safeDest], { timeout: 120_000, stdio: "pipe" });
    } else if (ext === ".rar") {
      if (hasCommand("7z")) {
        execFileSync("7z", ["x", "-y", safeArchive, `-o${safeDest}`], { timeout: 120_000, stdio: "pipe" });
      } else if (hasCommand("unrar")) {
        execFileSync("unrar", ["x", "-o+", safeArchive, `${safeDest}/`], { timeout: 120_000, stdio: "pipe" });
      } else {
        throw new Error("RAR extraction requires 7z or unrar to be installed on the server");
      }
    } else {
      throw new Error(`Unsupported archive format: ${ext}`);
    }

    log.info({ archive: safeArchive, dest: safeDest }, "Archive extracted");
  },

  /** Extract an archive through an executor when the target is bridged. */
  async extractWithExecutor(archivePath: string, destDir: string, executor: Executor): Promise<void> {
    const safeArchive = safePath(archivePath);
    const safeDest = safePath(destDir);

    const ext = path.extname(safeArchive).toLowerCase();
    const base = path.basename(safeArchive).toLowerCase();

    // Same zip-slip + symlink containment audit as the local path, but the
    // listing runs ON THE TARGET (the archive lives there). Fail closed when
    // the listing cannot be produced.
    const resolvedDest = path.posix.resolve(safeDest);
    const tarFlag = tarVerboseListFlag(base);
    if (tarFlag) {
      const out = await executor.exec(quoteCmd("tar", [tarFlag, safeArchive]), { timeoutMs: 30_000 });
      if (out.exitCode !== 0) {
        throw new Error("Refusing to extract: could not list archive contents for validation");
      }
      assertTarVerboseListingSafe(out.stdout.split("\n"), resolvedDest);
    } else if (ext === ".zip") {
      const names = await executor.exec(quoteCmd("unzip", ["-Z1", safeArchive]), { timeoutMs: 30_000 });
      const info = await executor.exec(quoteCmd("unzip", ["-Z", safeArchive]), { timeoutMs: 30_000 });
      if (names.exitCode !== 0 || info.exitCode !== 0) {
        throw new Error("Refusing to extract: could not list archive contents for validation");
      }
      for (const m of names.stdout.split("\n").filter(Boolean)) assertMemberContained(m, resolvedDest);
      assertZipinfoHasNoSymlinks(info.stdout.split("\n"));
    } else if (ext === ".rar") {
      // RAR: best-effort name guard (listings expose no link targets).
      const members = await this.listContentsWithExecutor(safeArchive, executor);
      for (const m of members) assertMemberContained(m, resolvedDest);
    }

    if (base.endsWith(".tar.gz") || base.endsWith(".tgz")) {
      await executor.exec(quoteCmd("tar", ["-xzf", safeArchive, "-C", safeDest]));
    } else if (base.endsWith(".tar.bz2")) {
      await executor.exec(quoteCmd("tar", ["-xjf", safeArchive, "-C", safeDest]));
    } else if (ext === ".zip") {
      await executor.exec(quoteCmd("unzip", ["-o", safeArchive, "-d", safeDest]));
    } else if (ext === ".tar") {
      await executor.exec(quoteCmd("tar", ["-xf", safeArchive, "-C", safeDest]));
    } else if (ext === ".rar") {
      if (await hasCommandWithExecutor(executor, "7z")) {
        await executor.exec(quoteCmd("7z", ["x", "-y", safeArchive, `-o${safeDest}`]));
      } else if (await hasCommandWithExecutor(executor, "unrar")) {
        await executor.exec(quoteCmd("unrar", ["x", "-o+", safeArchive, `${safeDest}/`]));
      } else {
        throw new Error("RAR extraction requires 7z or unrar to be installed on the server");
      }
    } else {
      throw new Error(`Unsupported archive format: ${ext}`);
    }

    log.info({ archive: safeArchive, dest: safeDest, target: executor.target.id }, "Archive extracted via executor");
  },

  /** List contents of an archive without extracting. */
  listContents(archivePath: string): string[] {
    const safeArchive = safePath(archivePath);
    const base = path.basename(safeArchive).toLowerCase();

    // No shell: resolve the binary + argv array and run through execFileSync
    // so an attacker-influenced path can never be interpreted as a command.
    let bin: string;
    let args: string[];
    if (base.endsWith(".tar.gz") || base.endsWith(".tgz")) {
      bin = "tar";
      args = ["-tzf", safeArchive];
    } else if (base.endsWith(".tar.bz2")) {
      bin = "tar";
      args = ["-tjf", safeArchive];
    } else if (base.endsWith(".zip")) {
      bin = "unzip";
      args = ["-l", safeArchive];
    } else if (base.endsWith(".tar")) {
      bin = "tar";
      args = ["-tf", safeArchive];
    } else if (base.endsWith(".rar")) {
      if (hasCommand("unrar")) {
        bin = "unrar";
        args = ["lb", safeArchive];
      } else if (hasCommand("7z")) {
        bin = "7z";
        args = ["l", "-ba", safeArchive];
      } else {
        return [];
      }
    } else {
      return [];
    }

    try {
      const out = execFileSync(bin, args, { encoding: "utf-8", timeout: 30_000, stdio: "pipe" });
      return out.trim().split("\n").filter(Boolean);
    } catch {
      return [];
    }
  },

  /** List archive contents through an executor. */
  async listContentsWithExecutor(archivePath: string, executor: Executor): Promise<string[]> {
    const safeArchive = safePath(archivePath);
    const base = path.basename(safeArchive).toLowerCase();

    let cmd: string;
    if (base.endsWith(".tar.gz") || base.endsWith(".tgz")) {
      cmd = quoteCmd("tar", ["-tzf", safeArchive]);
    } else if (base.endsWith(".tar.bz2")) {
      cmd = quoteCmd("tar", ["-tjf", safeArchive]);
    } else if (base.endsWith(".zip")) {
      cmd = `unzip -l ${quoteArg(safeArchive)} | tail -n +4 | head -n -2 | awk '{print $4}'`;
    } else if (base.endsWith(".tar")) {
      cmd = quoteCmd("tar", ["-tf", safeArchive]);
    } else if (base.endsWith(".rar")) {
      if (await hasCommandWithExecutor(executor, "unrar")) {
        cmd = quoteCmd("unrar", ["lb", safeArchive]);
      } else if (await hasCommandWithExecutor(executor, "7z")) {
        cmd = quoteCmd("7z", ["l", "-ba", safeArchive]);
      } else {
        return [];
      }
    } else {
      return [];
    }

    try {
      const out = await executor.exec(cmd);
      return out.stdout.trim().split("\n").filter(Boolean);
    } catch {
      return [];
    }
  },
};
