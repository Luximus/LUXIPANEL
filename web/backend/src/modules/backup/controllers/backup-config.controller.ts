// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { z } from "zod";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { remoteConfig } from "../../../shared/remote-config/index.js";
import { ConflictError, ValidationError } from "../../../shared/errors/index.js";
import { backupRepository } from "../repositories/backup.repository.js";
import { HISTORY_FALLBACK, HISTORY_MODULE, type BackupHistory } from "./backups.controller.js";
import { beginDirectoryChange, prepareBackupDir, readBackupConfig, validateBackupDir, writeBackupConfig } from "../services/backup-config.service.js";
import { clearArchiveIndexForDir, listLocalArchives, removeLocalArchive } from "../services/local-archives.service.js";

const countSchema = z.object({ defaultRetainCount: z.number().int().min(1).max(365) });
const pathSchema = z.object({ localDir: z.string().min(2).max(240) });
const applySchema = pathSchema.extend({ expectedOldDir: z.string(), expectedDeleteCount: z.number().int().min(0), confirmDelete: z.literal(true) });

export const backupConfigController = {
  get: asyncHandler(async (req, res) => {
    res.json({ ok: true, data: await readBackupConfig(getExecutor(req)) });
  }),

  update: asyncHandler(async (req, res) => {
    const body = countSchema.parse(req.body);
    const executor = getExecutor(req);
    const release = beginDirectoryChange(executor);
    try {
      const current = await readBackupConfig(executor);
      const next = await writeBackupConfig(executor, { ...current, ...body });
      res.json({ ok: true, data: next });
    } finally {
      release();
    }
  }),

  previewDirectory: asyncHandler(async (req, res) => {
    const body = pathSchema.parse(req.body);
    const executor = getExecutor(req);
    const localDir = validateBackupDir(body.localDir);
    const current = await readBackupConfig(executor);
    const changing = localDir !== current.localDir;
    if (changing && (localDir.startsWith(`${current.localDir}/`) || current.localDir.startsWith(`${localDir}/`))) {
      throw new ValidationError("La carpeta nueva no puede contener a la actual ni estar dentro de ella.");
    }
    const [oldFiles, newFiles] = await Promise.all([
      changing ? listLocalArchives(executor, current.localDir) : Promise.resolve([]),
      changing ? listLocalArchives(executor, localDir) : Promise.resolve([]),
    ]);
    res.json({ ok: true, data: { currentDir: current.localDir, localDir, deleteCount: oldFiles.length, destinationCount: newFiles.length } });
  }),

  changeDirectory: asyncHandler(async (req, res) => {
    const body = applySchema.parse(req.body);
    const executor = getExecutor(req);
    const localDir = validateBackupDir(body.localDir);
    const release = beginDirectoryChange(executor);
    let deletedCount = 0;
    let totalToDelete = 0;
    try {
      const current = await readBackupConfig(executor);
      if (body.expectedOldDir !== current.localDir) throw new ConflictError("La carpeta actual cambió. Revísala antes de continuar.");
      if (localDir === current.localDir) {
        res.json({ ok: true, data: { ...current, deletedCount: 0 } });
        return;
      }
      if (localDir.startsWith(`${current.localDir}/`) || current.localDir.startsWith(`${localDir}/`)) {
        throw new ValidationError("La carpeta nueva no puede contener a la actual ni estar dentro de ella.");
      }
      const [history, jobs] = await Promise.all([
        remoteConfig.read<BackupHistory>(executor, HISTORY_MODULE, HISTORY_FALLBACK),
        backupRepository.listJobs(executor),
      ]);
      const stillRunning = (startedAt: string | Date | null) =>
        startedAt && Date.now() - new Date(startedAt).getTime() < 35 * 60_000;
      if (history.jobs.some((job) => job.status === "running" && stillRunning(job.startedAt)) ||
          jobs.some((job) => job.status === "running" && stillRunning(job.startedAt))) {
        throw new ConflictError("Hay un backup en curso para este servidor. Espera a que termine.");
      }
      await prepareBackupDir(executor, localDir);
      if ((await listLocalArchives(executor, localDir)).length > 0) {
        throw new ConflictError("La carpeta nueva ya contiene backups de LUXIPANEL. Selecciona una carpeta vacía.");
      }
      const oldFiles = await listLocalArchives(executor, current.localDir);
      if (oldFiles.length !== body.expectedDeleteCount) {
        throw new ConflictError("El número de copias locales cambió. Revisa la vista previa antes de continuar.");
      }
      totalToDelete = oldFiles.length;
      for (const file of oldFiles) {
        await removeLocalArchive(executor, file.path, current.localDir);
        deletedCount++;
      }
      await remoteConfig.update<BackupHistory>(executor, HISTORY_MODULE, HISTORY_FALLBACK, (state) => ({
        jobs: state.jobs.filter((job) => job.provider !== "local"),
      }));
      for (const job of jobs.filter((item) => item.provider === "local")) {
        await backupRepository.deleteJob(job.id, executor);
      }
      await clearArchiveIndexForDir(executor, current.localDir);
      const next = await writeBackupConfig(executor, { ...current, localDir });
      res.json({ ok: true, data: { ...next, deletedCount } });
    } catch (err) {
      if (totalToDelete > 0) {
        throw new Error(`Se eliminaron ${deletedCount} de ${totalToDelete} copias locales. La ruta anterior sigue activa. ${(err as Error).message}`);
      }
      throw err;
    } finally {
      release();
    }
  }),
};
