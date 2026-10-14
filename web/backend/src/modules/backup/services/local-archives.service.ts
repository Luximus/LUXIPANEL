// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** Local archives created by LuxiPanel on one connected server. */
import path from "node:path";
import { quoteCmd, type Executor } from "../../../shared/executor/index.js";
import { remoteConfig } from "../../../shared/remote-config/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";

const log = createModuleLogger("backup-archives");
const INDEX_MODULE = "backup-archive-index";
const ARCHIVE_NAME = /^[A-Za-z0-9_-]+_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.tar\.gz$/;

export interface LocalArchive {
  path: string;
  sizeBytes: number;
  mtime: string;
}

interface ArchiveEntry {
  path: string;
  origin: string;
  createdAt: string;
}
interface ArchiveIndex { entries: ArchiveEntry[] }

const EMPTY_INDEX: ArchiveIndex = { entries: [] };
const retentionQueues = new Map<string, Promise<void>>();

export function isManagedArchive(filePath: string, dir: string): boolean {
  return path.posix.dirname(filePath) === dir && ARCHIVE_NAME.test(path.posix.basename(filePath));
}

export async function listLocalArchives(executor: Executor, dir: string): Promise<LocalArchive[]> {
  const out = await executor.exec(quoteCmd("sudo", [
    "-n", "find", dir, "-maxdepth", "1", "-type", "f", "-name", "*.tar.gz", "-printf", "%p\\t%s\\t%T@\\n",
  ]));
  if (out.exitCode !== 0) {
    // Missing directory is legitimate for a server with no previous backups.
    const exists = await executor.exec(quoteCmd("sudo", ["-n", "test", "-e", dir]));
    if (exists.exitCode !== 0) return [];
    throw new Error(`No se pudieron listar los backups de ${dir}: ${out.stderr.trim()}`);
  }
  return out.stdout.split(/\r?\n/).flatMap((line) => {
    const [filePath, size, seconds] = line.split("\t");
    if (!filePath || !isManagedArchive(filePath, dir)) return [];
    const timestamp = Number(seconds);
    if (!Number.isFinite(timestamp)) return [];
    return [{ path: filePath, sizeBytes: Number(size) || 0, mtime: new Date(timestamp * 1000).toISOString() }];
  }).sort((a, b) => b.mtime.localeCompare(a.mtime));
}

export async function removeLocalArchive(executor: Executor, filePath: string, dir: string): Promise<void> {
  if (!isManagedArchive(filePath, dir)) throw new Error("El archivo no pertenece al directorio de backups administrados.");
  const out = await executor.exec(quoteCmd("sudo", ["-n", "rm", "-f", "--", filePath]));
  if (out.exitCode !== 0) throw new Error(`No se pudo borrar ${path.posix.basename(filePath)}: ${out.stderr.trim()}`);
}

export async function clearArchiveIndexForDir(executor: Executor, dir: string): Promise<void> {
  await remoteConfig.update<ArchiveIndex>(executor, INDEX_MODULE, EMPTY_INDEX, (current) => ({
    entries: (current.entries ?? []).filter((entry) => path.posix.dirname(entry.path) !== dir),
  }));
}

/** Retention only touches explicitly tracked, successful local archives. */
export async function trackAndPruneLocalArchive(
  executor: Executor,
  dir: string,
  filePath: string,
  origin: "manual" | `schedule:${number}`,
  retainCount: number,
): Promise<void> {
  if (!isManagedArchive(filePath, dir)) throw new Error("La copia creada no coincide con la carpeta configurada.");
  const targetId = executor.target.id;
  const previous = retentionQueues.get(targetId) ?? Promise.resolve();
  const task = previous.catch(() => undefined).then(() => applyRetention(executor, dir, filePath, origin, retainCount));
  retentionQueues.set(targetId, task);
  try {
    await task;
  } finally {
    if (retentionQueues.get(targetId) === task) retentionQueues.delete(targetId);
  }
}

async function applyRetention(
  executor: Executor,
  dir: string,
  filePath: string,
  origin: string,
  retainCount: number,
): Promise<void> {
  const present = new Set((await listLocalArchives(executor, dir)).map((archive) => archive.path));
  if (!present.has(filePath)) throw new Error("La copia local terminada no está en la carpeta configurada.");
  const next = await remoteConfig.update<ArchiveIndex>(executor, INDEX_MODULE, EMPTY_INDEX, (current) => ({
    entries: [
      ...(current.entries ?? []).filter((entry) => entry.path !== filePath &&
        (path.posix.dirname(entry.path) !== dir || present.has(entry.path))),
      { path: filePath, origin, createdAt: new Date().toISOString() },
    ],
  }));
  const group = next.entries.filter((entry) => entry.origin === origin && path.posix.dirname(entry.path) === dir)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const candidates = group.slice(retainCount);
  for (const candidate of candidates) {
    if (!present.has(candidate.path)) continue;
    try {
      await removeLocalArchive(executor, candidate.path, dir);
    } catch (err) {
      log.warn({ err, path: candidate.path, target: executor.target.id }, "Local backup retention failed");
      continue;
    }
    await remoteConfig.update<ArchiveIndex>(executor, INDEX_MODULE, EMPTY_INDEX, (current) => ({
      entries: (current.entries ?? []).filter((entry) => entry.path !== candidate.path),
    }));
  }
}
