// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Backups controller — list/trigger/delete backup archives directly from
 * the connected target's filesystem (`/var/backups/luxipanel`). Recent job
 * status is persisted as `/etc/luxipanel/backup-history.json` on the
 * target so the panel can show progress without a local DB.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor, quoteCmd, quoteArg, LOCAL_TARGET_ID } from "../../../shared/executor/index.js";
import { backupEngine } from "../services/backup-engine.service.js";
import { storageProviderService } from "../services/storage-provider.service.js";
import { storageRepository } from "../repositories/storage.repository.js";
import { webhookDispatcher } from "../../webhooks/services/webhook-dispatcher.service.js";
import { NotFoundError, ValidationError, ConflictError } from "../../../shared/errors/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { remoteConfig } from "../../../shared/remote-config/index.js";
import { databaseSelectionSchema, STORAGE_PROVIDERS } from "../models/index.js";
import { backupRepository } from "../repositories/backup.repository.js";
import { beginBackupActivity, readBackupConfig } from "../services/backup-config.service.js";
import { listLocalArchives, removeLocalArchive, trackAndPruneLocalArchive } from "../services/local-archives.service.js";

const log = createModuleLogger("backups-ctrl");
export const HISTORY_MODULE = "backup-history";

const triggerSchema = z.object({
  label: z.string().min(1).max(128).trim().default("manual"),
  /** Storage selection: "local" (or empty) or a configured storage-target id. */
  storageId: z.union([z.string(), z.number()]).optional(),
  /** Legacy direct provider (kept for back-compat; superseded by storageId). */
  provider: z.enum(STORAGE_PROVIDERS).default("local"),
  providerConfig: z.record(z.string()).optional(),
  includePaths: z.array(z.string()).default([]),
  /** Legacy: dump the panel host's own PostgreSQL (only used on a "local" target). */
  includeDatabase: z.boolean().default(true),
  /** Dump the CONNECTED server's databases (MySQL/MariaDB + PostgreSQL). */
  includeDatabases: z.boolean().default(false),
  /** Restrict the DB dump to these specific databases (empty → all). */
  databaseSelections: z.array(databaseSelectionSchema).default([]),
  /** Back up the connected server's mail store + Postfix/Dovecot config. */
  includeMail: z.boolean().default(false),
  /** Back up the connected server's LuxiPanel config dir (/etc/luxipanel). */
  includePanelConfig: z.boolean().default(false),
  /** Curated full-server snapshot (DBs + mail + config + /etc /home /var/www /root). */
  fullServer: z.boolean().default(false),
});

export interface BackupJob {
  id: number;
  scheduleId?: number | null;
  label: string;
  provider: string;
  status: "running" | "completed" | "failed";
  destination: string | null;
  sizeBytes: number | null;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
}

export interface BackupHistory {
  jobs: BackupJob[];
}

export const HISTORY_FALLBACK: BackupHistory = { jobs: [] };

function fnv1aId(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash & 0x7fffffff;
}

export const backupsController = {
  /** GET /api/backups — list (history file + current archives on disk). */
  list: asyncHandler(async (req: Request, res: Response) => {
    const requestedLimit = Number.parseInt(String(req.query.limit ?? "50"), 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 50;
    const executor = getExecutor(req);
    const config = await readBackupConfig(executor);
    const history = await remoteConfig.read<BackupHistory>(executor, HISTORY_MODULE, HISTORY_FALLBACK);
    const [files, scheduledJobs] = await Promise.all([
      listLocalArchives(executor, config.localDir),
      backupRepository.listJobs(executor),
    ]);

    const fileJobs: BackupJob[] = files.map((f) => ({
      id: fnv1aId(f.path),
      label: f.path.split("/").pop() ?? "archive",
      provider: "local",
      status: "completed",
      destination: f.path,
      sizeBytes: f.sizeBytes,
      startedAt: f.mtime,
      completedAt: f.mtime,
      error: null,
    }));

    const seenIds = new Set(fileJobs.map((j) => j.id));
    const filePaths = new Set(files.map((f) => f.path));
    // Drop history rows superseded by an on-disk archive (same id, or a
    // completed job whose destination is now a listed file) so the downloadable
    // file row is the single source of truth; keep running/failed history rows.
    const visibleHistory = (job: BackupJob) =>
      !seenIds.has(job.id) &&
      !(job.destination && filePaths.has(job.destination)) &&
      !(job.provider === "local" && job.status === "completed" && job.destination && !filePaths.has(job.destination));
    const scheduledRows: BackupJob[] = scheduledJobs.map((job) => ({
      id: job.id,
      label: job.label,
      provider: job.provider,
      status: job.status === "pending" ? "running" : job.status,
      destination: job.destination,
      sizeBytes: job.sizeBytes,
      startedAt: (job.startedAt ?? job.createdAt).toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
      error: job.error,
      scheduleId: job.scheduleId,
    }));
    const allRows = [
      ...history.jobs.filter(visibleHistory),
      ...scheduledRows.filter(visibleHistory),
      ...fileJobs,
    ]
      .sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));
    const lastSuccessful = allRows
      .filter((job) => job.status === "completed")
      .sort((a, b) => (b.completedAt ?? b.startedAt).localeCompare(a.completedAt ?? a.startedAt))[0];

    res.json({
      ok: true,
      data: req.query.tableWindow ? allRows : allRows.slice(0, limit),
      meta: {
        total: allRows.length,
        localCount: files.length,
        lastSuccessAt: lastSuccessful?.completedAt ?? lastSuccessful?.startedAt ?? null,
      },
    });
  }),

  /** POST /api/backups — trigger a backup, append to remote history. */
  trigger: asyncHandler(async (req: Request, res: Response) => {
    const body = triggerSchema.parse(req.body);
    const executor = getExecutor(req);

    // Resolve the chosen storage target (or local). storageId supersedes the
    // legacy `provider` field; a numeric id that no longer exists is rejected.
    const storage = await storageRepository.resolve(body.storageId, executor);
    if (!storage) throw new ValidationError("Destino de backup no encontrado");
    const effectiveProvider = storage.provider;

    // Concurrency guard: a full-server backup can `tar -czf` /etc /home /var/www
    // /root for up to 30 min. Without this, N rapid POSTs launch N concurrent
    // heavy archivers on the same target. Reject if one is already running
    // (ignoring stale rows past the engine timeout so a crashed job can't block
    // backups forever).
    const BACKUP_RUNNING_TTL_MS = 35 * 60_000;
    const existing = await remoteConfig.read<BackupHistory>(executor, HISTORY_MODULE, HISTORY_FALLBACK);
    const now = Date.now();
    const active = existing.jobs.find(
      (j) => j.status === "running" && now - Date.parse(j.startedAt) < BACKUP_RUNNING_TTL_MS,
    );
    if (active) {
      throw new ConflictError("Ya hay un backup en curso para este servidor. Espera a que termine.");
    }

    const job: BackupJob = {
      id: fnv1aId(`${body.label}:${Date.now()}`),
      label: body.label,
      provider: effectiveProvider,
      status: "running",
      destination: null,
      sizeBytes: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
      error: null,
    };

    const releaseActivity = beginBackupActivity(executor);
    let config;
    try {
      config = await readBackupConfig(executor);
      await remoteConfig.update<BackupHistory>(executor, HISTORY_MODULE, HISTORY_FALLBACK, (current) => ({
        jobs: [job, ...current.jobs].slice(0, 100),
      }));
    } catch (err) {
      releaseActivity();
      throw err;
    }

    const sources = {
      includeDatabases: body.includeDatabases,
      databaseSelections: body.databaseSelections,
      includeMail: body.includeMail,
      includePanelConfig: body.includePanelConfig,
      includePaths: body.includePaths,
      fullServer: body.fullServer,
    };
    const wantsTargetSources =
      sources.fullServer ||
      sources.includeDatabases ||
      sources.includeMail ||
      sources.includePanelConfig ||
      sources.includePaths.length > 0;

    // The cloud target's credentials, threaded to the on-target uploader.
    const remoteStorage = storage.provider === "local" ? null : { provider: storage.provider, ...storage.config };

    void (async () => {
      try {
        let destination: string;
        let sizeBytes: number;
        if (executor.target.id === LOCAL_TARGET_ID && !wantsTargetSources) {
          // Legacy local path: dump the panel host's own DB + arbitrary paths.
          const result = await backupEngine.create(body.label, body.includePaths, body.includeDatabase);
          destination = await storageProviderService.upload(result.archivePath, {
            provider: storage.provider,
            localDir: config.localDir,
            ...(storage.provider !== "local" ? storage.config : {}),
          });
          sizeBytes = result.sizeBytes;
        } else {
          // Managed path: assemble the archive on the connected server itself,
          // and (if a cloud target is selected) offload it from there.
          const result = await backupEngine.createOnTarget(body.label, sources, executor, remoteStorage, config.localDir);
          if (remoteStorage && !result.remoteUri) {
            // The local archive was created, but the cloud upload the operator
            // asked for did not happen — fail loudly with the actual reason
            // instead of silently leaving it local.
            throw new Error(
              `Backup creado localmente, pero la subida a ${effectiveProvider.toUpperCase()} falló: ${result.remoteError || "motivo desconocido"}`,
            );
          }
          destination = result.remoteUri ?? result.archivePath;
          sizeBytes = result.sizeBytes;
        }
        await remoteConfig.update<BackupHistory>(executor, HISTORY_MODULE, HISTORY_FALLBACK, (current) => ({
          jobs: current.jobs.map((j) => j.id === job.id
            ? { ...j, status: "completed", destination, sizeBytes, completedAt: new Date().toISOString() }
            : j),
        }));
        if (storage.provider === "local") {
          try {
            await trackAndPruneLocalArchive(executor, config.localDir, destination, "manual", config.defaultRetainCount);
          } catch (err) {
            log.warn({ err, jobId: job.id }, "Manual backup succeeded but local retention failed");
          }
        }
        webhookDispatcher.dispatch("backup.completed", { jobId: job.id, destination });
        log.info({ jobId: job.id, target: executor.target.id }, "Manual backup completed");
      } catch (err) {
        const error = (err as Error).message;
        await remoteConfig.update<BackupHistory>(executor, HISTORY_MODULE, HISTORY_FALLBACK, (current) => ({
          jobs: current.jobs.map((j) => j.id === job.id
            ? { ...j, status: "failed", error, completedAt: new Date().toISOString() }
            : j),
        }));
        webhookDispatcher.dispatch("backup.failed", { jobId: job.id, error });
        log.error({ err, jobId: job.id }, "Manual backup failed");
      } finally {
        releaseActivity();
      }
    })();

    res.status(202).json({ ok: true, data: { jobId: job.id } });
  }),

  /** GET /api/backups/:id — get job detail. */
  get: asyncHandler(async (req: Request, res: Response) => {
    const id = Number.parseInt(String(req.params.id), 10);
    const executor = getExecutor(req);
    const config = await readBackupConfig(executor);
    const history = await remoteConfig.read<BackupHistory>(executor, HISTORY_MODULE, HISTORY_FALLBACK);
    const fromHistory = history.jobs.find((j) => j.id === id);
    if (fromHistory) {
      res.json({ ok: true, data: fromHistory });
      return;
    }
    const files = await listLocalArchives(executor, config.localDir);
    const file = files.find((f) => fnv1aId(f.path) === id);
    if (!file) throw new NotFoundError("Backup job");
    res.json({
      ok: true,
      data: {
        id,
        label: file.path.split("/").pop() ?? "archive",
        provider: "local",
        status: "completed",
        destination: file.path,
        sizeBytes: file.sizeBytes,
        startedAt: file.mtime,
        completedAt: file.mtime,
        error: null,
      } satisfies BackupJob,
    });
  }),

  /** GET /api/backups/:id/download — stream a backup archive from the target. */
  download: asyncHandler(async (req: Request, res: Response) => {
    const id = Number.parseInt(String(req.params.id), 10);
    const executor = getExecutor(req);
    const config = await readBackupConfig(executor);
    const files = await listLocalArchives(executor, config.localDir);
    const file = files.find((f) => fnv1aId(f.path) === id);
    if (!file) throw new NotFoundError("Backup archive");

    const MAX_DOWNLOAD_BYTES = 2 * 1024 * 1024 * 1024; // 2 GiB
    if (file.sizeBytes > MAX_DOWNLOAD_BYTES) {
      throw new ValidationError(
        `Backup demasiado grande para descarga directa (${(file.sizeBytes / 1_073_741_824).toFixed(1)} GB). Descárgalo por SFTP/scp desde ${file.path}.`,
      );
    }

    const filename = file.path.split("/").pop() ?? "backup.tar.gz";

    // Stream the archive in byte-range chunks instead of pulling the whole file
    // through a single SFTP/exec round-trip: a multi-MB backup (DB dump / mail /
    // full server) easily exceeds SSH_PROXY_TIMEOUT_MS when read in one shot
    // (the proxy returns the file as one JSON body). Each chunk is read with
    // `tail -c +N | head -c M | base64` and decoded server-side; base64 keeps
    // the binary intact over the text exec channel. Archives are chowned to the
    // SSH user on creation (readable without sudo); legacy root-owned archives
    // fall back to sudo.
    const CHUNK = 6 * 1024 * 1024; // 6 MiB raw per round-trip (~8 MiB base64)
    const readRange = (start: number, count: number, sudo: boolean) => {
      const pipe = `tail -c +${start + 1} ${quoteArg(file.path)} | head -c ${count} | base64`;
      const cmd = sudo ? quoteCmd("sudo", ["sh", "-c", pipe]) : quoteCmd("sh", ["-c", pipe]);
      return executor.exec(cmd, { timeoutMs: 90_000 });
    };

    // Read the first chunk before sending headers so a total failure still
    // surfaces as a clean error response (nothing written yet).
    let useSudo = false;
    const firstCount = Math.min(CHUNK, file.sizeBytes);
    let firstOut = file.sizeBytes > 0 ? await readRange(0, firstCount, false) : null;
    if (firstOut && firstOut.exitCode !== 0) {
      useSudo = true;
      firstOut = await readRange(0, firstCount, true);
      if (firstOut.exitCode !== 0) throw new NotFoundError("Backup archive");
    }

    res.setHeader("Content-Type", "application/gzip");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader("Content-Length", String(file.sizeBytes));

    const writeBuf = async (b: Buffer) => {
      if (!res.write(b)) await new Promise<void>((r) => res.once("drain", () => r()));
    };

    if (firstOut) await writeBuf(Buffer.from(firstOut.stdout, "base64"));
    for (let offset = firstCount; offset < file.sizeBytes; offset += CHUNK) {
      const count = Math.min(CHUNK, file.sizeBytes - offset);
      const out = await readRange(offset, count, useSudo);
      if (out.exitCode !== 0) {
        // Headers/body already sent — can't switch to an error status; abort the
        // stream so the client sees a truncated (failed) download rather than a
        // silently corrupt file.
        log.error({ file: file.path, offset }, "Backup download chunk failed mid-stream");
        res.destroy();
        return;
      }
      await writeBuf(Buffer.from(out.stdout, "base64"));
    }
    res.end();
  }),

  /** DELETE /api/backups/:id — remove a backup file. */
  remove: asyncHandler(async (req: Request, res: Response) => {
    const id = Number.parseInt(String(req.params.id), 10);
    const executor = getExecutor(req);
    const config = await readBackupConfig(executor);
    const files = await listLocalArchives(executor, config.localDir);
    const file = files.find((f) => fnv1aId(f.path) === id);

    if (file) {
      await removeLocalArchive(executor, file.path, config.localDir);
      const jobs = await backupRepository.listJobs(executor);
      for (const job of jobs.filter((item) => item.destination === file.path)) {
        await backupRepository.deleteJob(job.id, executor);
      }
    } else {
      const history = await remoteConfig.read<BackupHistory>(executor, HISTORY_MODULE, HISTORY_FALLBACK);
      const manualJob = history.jobs.find((item) => item.id === id);
      const scheduledJob = (await backupRepository.listJobs(executor)).find((item) => item.id === id);
      if (!manualJob && !scheduledJob) throw new NotFoundError("Backup job");
      if (manualJob?.status === "running" || scheduledJob?.status === "running") {
        throw new ConflictError("No se puede quitar un backup mientras está en curso.");
      }
      if (scheduledJob) await backupRepository.deleteJob(id, executor);
    }

    await remoteConfig.update<BackupHistory>(executor, HISTORY_MODULE, HISTORY_FALLBACK, (current) => ({
      jobs: current.jobs.filter((j) => j.id !== id && (!file || j.destination !== file.path)),
    }));

    res.json({ ok: true, data: { deletedFile: Boolean(file) } });
  }),
};
