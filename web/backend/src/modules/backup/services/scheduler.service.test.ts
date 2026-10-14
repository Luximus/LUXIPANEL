// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — backup/services/scheduler.service.ts
 *
 * Covers:
 *  - the exported `cronMatches()` pure logic;
 *  - `_runSchedule()` — the per-schedule execution path: it runs the backup on
 *    the GIVEN server's executor via `backupEngine.createOnTarget` (never on the
 *    panel host directly), records the outcome and emits the webhook;
 *  - `_tick()` fan-out — the panel host PLUS each enabled remote vault target,
 *    each against its OWN executor; and the `BACKUP_SCHEDULER_REMOTE_TARGETS`
 *    kill-switch that restores the historical local-only behaviour.
 *
 * cronMatches reads the date's LOCAL components, so dates here are built with
 * the local-time `new Date(y, mIndex, d, h, min)` constructor — NOT ISO `…Z`
 * strings, which would shift by the runner's UTC offset.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../repositories/backup.repository.js", () => ({
  backupRepository: {
    findEnabledSchedules: vi.fn(),
    createJob: vi.fn(),
    updateJobStatus: vi.fn(),
    touchScheduleRun: vi.fn(),
  },
}));
vi.mock("./backup-engine.service.js", () => ({
  backupEngine: { createOnTarget: vi.fn() },
}));
vi.mock("./backup-config.service.js", () => ({
  beginBackupActivity: vi.fn(() => () => undefined),
  readBackupConfig: vi.fn(async () => ({ localDir: "/var/backups/luxipanel", defaultRetainCount: 7 })),
}));
vi.mock("./local-archives.service.js", () => ({ trackAndPruneLocalArchive: vi.fn(async () => undefined) }));
vi.mock("../../webhooks/services/webhook-dispatcher.service.js", () => ({
  webhookDispatcher: { dispatch: vi.fn() },
}));
vi.mock("../../../shared/executor/vault-executor.js", () => ({
  getVaultExecutor: vi.fn(),
  disposeAllVaultExecutors: vi.fn(),
}));
vi.mock("../../servers/index.js", () => ({
  targetsRepository: { listView: vi.fn() },
}));

import { cronMatches, backupSchedulerService } from "./scheduler.service.js";
import { backupRepository } from "../repositories/backup.repository.js";
import { backupEngine } from "./backup-engine.service.js";
import { trackAndPruneLocalArchive } from "./local-archives.service.js";
import { webhookDispatcher } from "../../webhooks/services/webhook-dispatcher.service.js";
import { getVaultExecutor } from "../../../shared/executor/vault-executor.js";
import { targetsRepository } from "../../servers/index.js";
import { localExecutor } from "../../../shared/executor/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import { env } from "../../../config/env.js";
import type { BackupSchedule } from "../models/index.js";

describe("cronMatches", () => {
  it("wildcard * matches any value", () => {
    expect(cronMatches("* * * * *", new Date(2024, 5, 15, 14, 30))).toBe(true);
  });
  it("exact minute match", () => {
    const date = new Date(2024, 5, 15, 14, 30);
    expect(cronMatches("30 * * * *", date)).toBe(true);
    expect(cronMatches("29 * * * *", date)).toBe(false);
  });
  it("step syntax */N", () => {
    expect(cronMatches("*/15 * * * *", new Date(2024, 5, 15, 10, 30))).toBe(true);
    expect(cronMatches("*/15 * * * *", new Date(2024, 5, 15, 10, 31))).toBe(false);
  });
  it("every midnight", () => {
    expect(cronMatches("0 0 * * *", new Date(2024, 5, 15, 0, 0))).toBe(true);
    expect(cronMatches("0 0 * * *", new Date(2024, 5, 15, 0, 1))).toBe(false);
  });
});

/** Minimal schedule fixture with only the fields `_runSchedule` reads. */
function makeSchedule(overrides: Partial<BackupSchedule> = {}): BackupSchedule {
  return {
    id: 7,
    name: "nightly",
    schedule: "* * * * *", // always due, so _tick fans it out
    provider: "local",
    providerConfig: {},
    includeDatabases: false,
    databaseSelections: [],
    includeMail: false,
    includePanelConfig: false,
    includePaths: [],
    fullServer: false,
    retainCount: 5,
    enabled: true,
    ...overrides,
  } as unknown as BackupSchedule;
}

const repo = vi.mocked(backupRepository);
const engine = vi.mocked(backupEngine);
const webhook = vi.mocked(webhookDispatcher);
const vaultExec = vi.mocked(getVaultExecutor);
const targets = vi.mocked(targetsRepository);

beforeEach(() => {
  vi.clearAllMocks();
  repo.createJob.mockResolvedValue({ id: 99 } as never);
  repo.updateJobStatus.mockResolvedValue(undefined as never);
  repo.touchScheduleRun.mockResolvedValue(undefined as never);
});

describe("backupSchedulerService._runSchedule", () => {
  it("runs createOnTarget with the GIVEN executor, records completion, emits webhook", async () => {
    const exec = { target: { id: "srv-x", name: "X" } } as unknown as Executor;
    engine.createOnTarget.mockResolvedValue({
      archivePath: "/var/backups/luxipanel/nightly.tar.gz",
      sizeBytes: 4242,
    } as never);

    await backupSchedulerService._runSchedule(makeSchedule(), exec);

    // Third arg MUST be the passed executor (never the panel host by default).
    expect(engine.createOnTarget).toHaveBeenCalledWith(
      "nightly",
      expect.objectContaining({ includeMail: false, fullServer: false }),
      exec,
      null, // local provider → no remote storage
      "/var/backups/luxipanel",
    );
    expect(trackAndPruneLocalArchive).toHaveBeenCalledWith(
      exec, "/var/backups/luxipanel", "/var/backups/luxipanel/nightly.tar.gz", "schedule:7", 5,
    );
    expect(repo.updateJobStatus).toHaveBeenCalledWith(
      99,
      expect.objectContaining({
        status: "completed",
        destination: "/var/backups/luxipanel/nightly.tar.gz",
        sizeBytes: 4242,
      }),
    );
    expect(repo.touchScheduleRun).toHaveBeenCalledWith(7);
    expect(webhook.dispatch).toHaveBeenCalledWith("backup.completed", {
      jobId: 99,
      destination: "/var/backups/luxipanel/nightly.tar.gz",
    });
  });

  it("records failure and emits backup.failed when the engine throws (no schedule touch)", async () => {
    engine.createOnTarget.mockRejectedValue(new Error("disk full"));

    await backupSchedulerService._runSchedule(makeSchedule(), localExecutor);

    expect(repo.updateJobStatus).toHaveBeenCalledWith(
      99,
      expect.objectContaining({ status: "failed", error: "disk full" }),
    );
    expect(repo.touchScheduleRun).not.toHaveBeenCalled();
    expect(webhook.dispatch).toHaveBeenCalledWith("backup.failed", { jobId: 99, error: "disk full" });
  });

  it("treats a cloud provider whose upload didn't land as a failure", async () => {
    engine.createOnTarget.mockResolvedValue({
      archivePath: "/var/backups/luxipanel/x.tar.gz",
      sizeBytes: 1,
      remoteUri: undefined,
      remoteError: "credenciales inválidas",
    } as never);

    await backupSchedulerService._runSchedule(makeSchedule({ provider: "s3" as never }), localExecutor);

    expect(repo.updateJobStatus).toHaveBeenCalledWith(
      99,
      expect.objectContaining({ status: "failed" }),
    );
    expect(webhook.dispatch).toHaveBeenCalledWith("backup.failed", expect.objectContaining({ jobId: 99 }));
  });
});

describe("backupSchedulerService._tick — per-target fan-out", () => {
  afterEach(() => {
    // Restore the flag between tests (it is a plain, mutable env object field).
    (env as { BACKUP_SCHEDULER_REMOTE_TARGETS: boolean }).BACKUP_SCHEDULER_REMOTE_TARGETS = true;
  });

  it("runs due schedules on BOTH the panel host and each enabled remote target", async () => {
    (env as { BACKUP_SCHEDULER_REMOTE_TARGETS: boolean }).BACKUP_SCHEDULER_REMOTE_TARGETS = true;
    repo.findEnabledSchedules.mockResolvedValue([makeSchedule()] as never);
    engine.createOnTarget.mockResolvedValue({ archivePath: "/a.tgz", sizeBytes: 1 } as never);
    targets.listView.mockResolvedValue([
      { id: "t1", name: "remote-1", enabled: true, hostFingerprint: "ab:cd" },
      { id: "t2", name: "no-tofu", enabled: true, hostFingerprint: null }, // skipped (no pinned key)
      { id: "t3", name: "disabled", enabled: false, hostFingerprint: "ee" }, // skipped (disabled)
    ] as never);
    const remoteExec = { target: { id: "t1", name: "remote-1" } } as unknown as Executor;
    vaultExec.mockResolvedValue(remoteExec);

    await backupSchedulerService._tick();

    // Only the eligible target (t1) is resolved.
    expect(vaultExec).toHaveBeenCalledTimes(1);
    expect(vaultExec).toHaveBeenCalledWith("t1");
    // createOnTarget ran for the panel host AND for the remote target.
    const usedExecutors = engine.createOnTarget.mock.calls.map((c) => c[2]);
    expect(usedExecutors).toContain(localExecutor);
    expect(usedExecutors).toContain(remoteExec);
  });

  it("kill-switch OFF: only the panel host runs; the vault is never touched", async () => {
    (env as { BACKUP_SCHEDULER_REMOTE_TARGETS: boolean }).BACKUP_SCHEDULER_REMOTE_TARGETS = false;
    repo.findEnabledSchedules.mockResolvedValue([makeSchedule()] as never);
    engine.createOnTarget.mockResolvedValue({ archivePath: "/a.tgz", sizeBytes: 1 } as never);

    await backupSchedulerService._tick();

    expect(targets.listView).not.toHaveBeenCalled();
    expect(vaultExec).not.toHaveBeenCalled();
    const usedExecutors = engine.createOnTarget.mock.calls.map((c) => c[2]);
    expect(usedExecutors).toEqual([localExecutor]);
  });
});
