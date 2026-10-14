// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Backup scheduler — runs enabled backup schedules on their cron expressions.
 * Uses setInterval polling every minute to check which schedules are due.
 */

import { backupRepository } from "../repositories/backup.repository.js";
import type { BackupSchedule } from "../models/index.js";
import { backupEngine, type RemoteStorage } from "./backup-engine.service.js";
import { webhookDispatcher } from "../../webhooks/services/webhook-dispatcher.service.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { runOnPanelHost, localExecutor, type Executor } from "../../../shared/executor/index.js";
import { runWithExecutor } from "../../../shared/executor/context.js";
import { getVaultExecutor, disposeAllVaultExecutors } from "../../../shared/executor/vault-executor.js";
import { targetsRepository } from "../../servers/index.js";
import { env } from "../../../config/env.js";
import { cronMatches as cronMatchesShared } from "../../../shared/cron/cron-match.js";
import { beginBackupActivity, readBackupConfig } from "./backup-config.service.js";
import { trackAndPruneLocalArchive } from "./local-archives.service.js";
import { storageRepository } from "../repositories/storage.repository.js";

const log = createModuleLogger("backup-scheduler");

let _timer: ReturnType<typeof setInterval> | null = null;

/**
 * Cron-time match for backup schedules. Fields are evaluated against the date's
 * LOCAL components (an admin's "0 3 * * *" means 3am server-local) — that is the
 * only reason this wrapper exists; the grammar itself is the shared evaluator
 * (`shared/cron/cron-match.ts`, B-18), which replaces a weaker local copy that
 * only understood `*`/n at the start of a field and AND-ed dom with dow.
 *
 * Exported for unit testing and reused by `cron/services/ai-cron-scheduler`.
 */
export function cronMatches(expression: string, date: Date): boolean {
  return cronMatchesShared(expression, date, "local");
}

export const backupSchedulerService = {
  start(): void {
    if (_timer) return;
    _timer = setInterval(() => void this._tick(), 60_000);
    log.info("Backup scheduler started");
  },

  stop(): void {
    if (_timer) { clearInterval(_timer); _timer = null; }
    // Release the scheduler-owned SSH connections to remote targets (idempotent).
    void disposeAllVaultExecutors().catch(() => undefined);
  },

  /**
   * Polling concern only: for each server (the panel host, plus every enabled
   * REMOTE vault target), find its due schedules and hand each off to
   * {@link _runSchedule} WITH that server's executor. Kept free of execution/
   * notification detail so the "which schedules are due now" logic stays
   * independently readable.
   *
   * Schedules are per-server sidecar state, so the executor must be pinned while
   * reading them AND while running the backup — otherwise a scheduled backup
   * would always snapshot the panel host (the historical bug).
   */
  async _tick(): Promise<void> {
    const now = new Date();

    // 1) The panel host itself (localExecutor), exactly as before. The interval
    //    fires with NO executor in AsyncLocalStorage, so a per-server kv read
    //    (`findEnabledSchedules`) would otherwise throw "no executor in scope".
    await runOnPanelHost(() => this._runDueForServer(localExecutor, now));

    // 2) Every enabled remote target with a pinned host key — each against its
    //    OWN scheduler-owned DirectSshExecutor (never the session bridges).
    if (!env.BACKUP_SCHEDULER_REMOTE_TARGETS) return;
    let targets;
    try {
      // The vault is panel-host state; read it there.
      targets = await runOnPanelHost(() => targetsRepository.listView());
    } catch (err) {
      log.error({ err }, "Backup scheduler: failed to list vault targets");
      return;
    }

    for (const t of targets) {
      // Skip disabled targets and any not yet TOFU-approved (no pinned host key
      // ⇒ DirectSshExecutor would refuse to connect anyway).
      if (!t.enabled || !t.hostFingerprint) continue;
      try {
        const executor = await getVaultExecutor(t.id);
        if (!executor) {
          log.warn({ targetId: t.id }, "Backup scheduler: no vault material for target — skipping");
          continue;
        }
        await runWithExecutor(executor, () => this._runDueForServer(executor, now));
      } catch (err) {
        log.error({ err, targetId: t.id }, "Backup scheduler: remote target tick threw");
      }
    }
  },

  /**
   * Run every schedule due at `now` for the server reachable through `executor`.
   * The executor is already pinned in AsyncLocalStorage by the caller, so
   * `findEnabledSchedules()` reads THIS server's sidecar.
   */
  async _runDueForServer(executor: Executor, now: Date): Promise<void> {
    let schedules;
    try {
      schedules = await backupRepository.findEnabledSchedules();
    } catch (err) {
      log.error({ err, target: executor.target.id }, "Backup scheduler: failed to load enabled schedules");
      return;
    }

    for (const sched of schedules) {
      if (!cronMatches(sched.schedule, now)) continue;
      try {
        await this._runSchedule(sched, executor);
      } catch (err) {
        log.error({ err, scheduleId: sched.id, target: executor.target.id }, "Backup scheduler: schedule run threw");
      }
    }
  },

  /**
   * Execution + notification concern for ONE due schedule: create the job row,
   * run the engine, upload, prune, record the outcome and emit the webhook.
   * Extracted from {@link _tick} so a single scheduled run can be exercised in
   * isolation (and so the loop stays purely about "what is due").
   *
   * `executor` is the server the schedule belongs to — the panel host
   * (`localExecutor`) or a remote vault target. The archive is built ON THAT
   * server (`createOnTarget`), never on the panel host.
   */
  async _runSchedule(sched: BackupSchedule, executor: Executor = localExecutor): Promise<void> {
    const releaseActivity = beginBackupActivity(executor);
    try {
    log.info({ scheduleId: sched.id, name: sched.name }, "Running scheduled backup");
    const config = await readBackupConfig(executor);
    const job = await backupRepository.createJob({
      scheduleId: sched.id,
      label: sched.name,
      status: "running",
      provider: sched.provider,
      startedAt: new Date(),
    });

    try {
      // Run the whole recipe on the schedule's OWN server via `executor` (the
      // panel host `localExecutor` OR a remote vault target) instead of
      // `backupEngine.create`, which shelled out with `execFileSync` ON THE
      // PANEL HOST — a violation of the "no host commands" module rule AND the
      // reason scheduled backups used to always snapshot the panel host. The
      // archive lands in TARGET_BACKUP_DIR on that server and, for a cloud
      // target, is offloaded from there (same path the manual controller uses).
      const sources = {
        includeDatabases: sched.includeDatabases,
        databaseSelections: sched.databaseSelections ?? [],
        includeMail: sched.includeMail,
        includePanelConfig: sched.includePanelConfig,
        includePaths: sched.includePaths ?? [],
        fullServer: sched.fullServer,
      };
      const selected = sched.storageId && sched.storageId !== "local"
        ? await storageRepository.resolve(sched.storageId, executor)
        : null;
      if (sched.storageId && sched.storageId !== "local" && !selected) {
        throw new Error("El destino de nube de esta programación no está disponible o no tiene credenciales.");
      }
      const remoteStorage: RemoteStorage | null = selected && selected.provider !== "local"
        ? { provider: selected.provider, ...selected.config }
        : sched.provider === "local" ? null
        : ({ provider: sched.provider, ...(sched.providerConfig ?? {}) } as RemoteStorage);

      const result = await backupEngine.createOnTarget(sched.name, sources, executor, remoteStorage, config.localDir);
      if (remoteStorage && !result.remoteUri) {
        throw new Error(
          `Backup creado localmente, pero la subida a ${sched.provider.toUpperCase()} falló: ${result.remoteError || "motivo desconocido"}`,
        );
      }
      const destination = result.remoteUri ?? result.archivePath;

      await backupRepository.updateJobStatus(job.id, {
        status: "completed",
        destination,
        sizeBytes: result.sizeBytes,
        completedAt: new Date(),
      });

      if (!remoteStorage) {
        try {
          await trackAndPruneLocalArchive(executor, config.localDir, result.archivePath, `schedule:${sched.id}`, sched.retainCount);
        } catch (err) {
          log.warn({ err, scheduleId: sched.id, target: executor.target.id }, "Scheduled backup succeeded but local retention failed");
        }
      }

      await backupRepository.touchScheduleRun(sched.id);
      webhookDispatcher.dispatch("backup.completed", { jobId: job.id, destination });
    } catch (err) {
      const error = (err as Error).message;
      await backupRepository.updateJobStatus(job.id, { status: "failed", error, completedAt: new Date() });
      webhookDispatcher.dispatch("backup.failed", { jobId: job.id, error });
      log.error({ err, scheduleId: sched.id }, "Scheduled backup failed");
    }
    } finally {
      releaseActivity();
    }
  },
};
