// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

vi.mock("../../../shared/executor/index.js", () => ({ getExecutor: vi.fn(() => ({ target: { id: "server-a" } })) }));
vi.mock("../../../shared/remote-config/index.js", () => ({ remoteConfig: { read: vi.fn(), update: vi.fn() } }));
vi.mock("../repositories/backup.repository.js", () => ({ backupRepository: { listJobs: vi.fn(), deleteJob: vi.fn() } }));
vi.mock("./backups.controller.js", () => ({ HISTORY_MODULE: "backup-history", HISTORY_FALLBACK: { jobs: [] } }));
vi.mock("../services/backup-config.service.js", () => ({
  beginDirectoryChange: vi.fn(() => () => undefined),
  prepareBackupDir: vi.fn(),
  readBackupConfig: vi.fn(),
  validateBackupDir: vi.fn((value: string) => value),
  writeBackupConfig: vi.fn(),
}));
vi.mock("../services/local-archives.service.js", () => ({
  clearArchiveIndexForDir: vi.fn(),
  listLocalArchives: vi.fn(),
  removeLocalArchive: vi.fn(),
}));

import { backupConfigController } from "./backup-config.controller.js";
import { remoteConfig } from "../../../shared/remote-config/index.js";
import { backupRepository } from "../repositories/backup.repository.js";
import { readBackupConfig, writeBackupConfig } from "../services/backup-config.service.js";
import { listLocalArchives, removeLocalArchive } from "../services/local-archives.service.js";

const OLD = "/var/backups/luxipanel";
const NEW = "/mnt/new-backups";
const FILE = `${OLD}/daily_2026-09-27T01-02-03-123Z.tar.gz`;

function invoke(body: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = { body } as Request;
    const res = { json: vi.fn((value: unknown) => resolve(value)) } as unknown as Response;
    const next = ((error?: unknown) => reject(error)) as NextFunction;
    backupConfigController.changeDirectory(req, res, next);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readBackupConfig).mockResolvedValue({ localDir: OLD, defaultRetainCount: 7 });
  vi.mocked(writeBackupConfig).mockImplementation(async (_executor, value) => value);
  vi.mocked(listLocalArchives).mockImplementation(async (_executor, dir) => dir === OLD
    ? [{ path: FILE, sizeBytes: 10, mtime: "2026-09-27T01:02:03.123Z" }] : []);
  vi.mocked(backupRepository.listJobs).mockResolvedValue([
    { id: 1, provider: "local" },
    { id: 2, provider: "s3" },
  ] as never);
  vi.mocked(backupRepository.deleteJob).mockResolvedValue(true);
  const history = { jobs: [
    { id: 3, provider: "local", status: "completed" },
    { id: 4, provider: "r2", status: "completed" },
  ] };
  vi.mocked(remoteConfig.read).mockResolvedValue(history as never);
  vi.mocked(remoteConfig.update).mockImplementation(async (_executor, _module, _fallback, mutate) => mutate(history as never));
});

describe("confirmed backup folder change", () => {
  it("deletes local archives and jobs while preserving cloud history", async () => {
    const result = await invoke({ localDir: NEW, expectedOldDir: OLD, expectedDeleteCount: 1, confirmDelete: true });
    expect(removeLocalArchive).toHaveBeenCalledWith(expect.anything(), FILE, OLD);
    expect(backupRepository.deleteJob).toHaveBeenCalledWith(1, expect.anything());
    expect(backupRepository.deleteJob).not.toHaveBeenCalledWith(2, expect.anything());
    const updated = vi.mocked(remoteConfig.update).mock.results[0]?.value;
    expect(await updated).toEqual({ jobs: [{ id: 4, provider: "r2", status: "completed" }] });
    expect(writeBackupConfig).toHaveBeenCalledWith(expect.anything(), { localDir: NEW, defaultRetainCount: 7 });
    expect(result).toMatchObject({ ok: true, data: { localDir: NEW, deletedCount: 1 } });
  });

  it("keeps the old directory configured and reports the deletion count on failure", async () => {
    vi.mocked(removeLocalArchive).mockRejectedValue(new Error("permission denied"));
    await expect(invoke({ localDir: NEW, expectedOldDir: OLD, expectedDeleteCount: 1, confirmDelete: true }))
      .rejects.toThrow("Se eliminaron 0 de 1 copias locales");
    expect(writeBackupConfig).not.toHaveBeenCalled();
  });
});
