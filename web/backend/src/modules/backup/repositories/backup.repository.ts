// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Backup repository — file-backed via dataStore.
 *   ${LUXIPANEL_CONFIG_DIR}/backup/jobs.json
 *   ${LUXIPANEL_CONFIG_DIR}/backup/schedules.json
 */

import { dataStore } from "../../../shared/data-store/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import type {
  BackupJob,
  NewBackupJob,
  BackupSchedule,
  NewBackupSchedule,
  BackupStatus,
} from "../models/index.js";

const MODULE = "backup";

interface StoredJob {
  id: number;
  scheduleId?: number | null;
  label: string;
  status: BackupStatus;
  provider: string;
  destination: string | null;
  sizeBytes: number | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface StoredSchedule {
  id: number;
  name: string;
  schedule: string;
  storageId: string;
  provider: string;
  providerConfig: Record<string, string>;
  includeDatabase: boolean;
  includeDatabases: boolean;
  databaseSelections: Array<{ engine: "mysql" | "postgresql"; name: string }>;
  includeMail: boolean;
  includePanelConfig: boolean;
  includePaths: string[];
  fullServer: boolean;
  retainCount: number;
  enabled: boolean;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function jobsStore(executor?: Executor | null) {
  return dataStore<StoredJob>(executor, MODULE, "jobs");
}
function schedulesStore(executor?: Executor | null) {
  return dataStore<StoredSchedule>(executor, MODULE, "schedules");
}

function jobFromStored(d: StoredJob): BackupJob {
  return {
    id: d.id,
    scheduleId: d.scheduleId ?? null,
    label: d.label,
    status: d.status,
    provider: d.provider,
    destination: d.destination,
    sizeBytes: d.sizeBytes,
    error: d.error,
    startedAt: d.startedAt ? new Date(d.startedAt) : null,
    completedAt: d.completedAt ? new Date(d.completedAt) : null,
    createdAt: new Date(d.createdAt),
  } as unknown as BackupJob;
}

function scheduleFromStored(d: StoredSchedule): BackupSchedule {
  return {
    id: d.id,
    name: d.name,
    schedule: d.schedule,
    storageId: d.storageId ?? "local",
    provider: d.provider,
    providerConfig: d.providerConfig,
    includeDatabase: d.includeDatabase,
    includeDatabases: d.includeDatabases,
    databaseSelections: d.databaseSelections ?? [],
    includeMail: d.includeMail,
    includePanelConfig: d.includePanelConfig,
    includePaths: d.includePaths,
    fullServer: d.fullServer ?? false,
    retainCount: d.retainCount ?? 7,
    enabled: d.enabled,
    lastRunAt: d.lastRunAt ? new Date(d.lastRunAt) : null,
    createdAt: new Date(d.createdAt),
    updatedAt: new Date(d.updatedAt),
  } as unknown as BackupSchedule;
}

export const backupRepository = {
  // ---- Jobs ----
  async listJobs(executor?: Executor | null): Promise<BackupJob[]> {
    return (await jobsStore(executor).list()).map((item) => jobFromStored(item as unknown as StoredJob));
  },

  async deleteJob(id: number, executor?: Executor | null): Promise<boolean> {
    return jobsStore(executor).delete(id);
  },

  async createJob(data: Omit<NewBackupJob, "id" | "createdAt">, executor?: Executor | null): Promise<BackupJob> {
    const created = await jobsStore(executor).create({
      scheduleId: data.scheduleId ?? null,
      label: data.label,
      status: (data.status ?? "pending") as BackupStatus,
      provider: data.provider ?? "local",
      destination: data.destination ?? null,
      sizeBytes: data.sizeBytes ?? null,
      error: data.error ?? null,
      startedAt: data.startedAt ? (data.startedAt instanceof Date ? data.startedAt.toISOString() : String(data.startedAt)) : null,
      completedAt: data.completedAt ? (data.completedAt instanceof Date ? data.completedAt.toISOString() : String(data.completedAt)) : null,
      createdAt: "",
    } as StoredJob & { id?: string | number });
    return jobFromStored(created as unknown as StoredJob);
  },

  async updateJobStatus(id: number, patch: {
    status: BackupStatus;
    destination?: string;
    sizeBytes?: number;
    error?: string;
    startedAt?: Date;
    completedAt?: Date;
  }, executor?: Executor | null): Promise<void> {
    const next: Partial<StoredJob> = {
      status: patch.status,
      ...(patch.destination !== undefined && { destination: patch.destination }),
      ...(patch.sizeBytes !== undefined && { sizeBytes: patch.sizeBytes }),
      ...(patch.error !== undefined && { error: patch.error }),
      ...(patch.startedAt !== undefined && { startedAt: patch.startedAt.toISOString() }),
      ...(patch.completedAt !== undefined && { completedAt: patch.completedAt.toISOString() }),
    };
    await jobsStore(executor).update(id, next);
  },

  // ---- Schedules ----
  async listSchedules(executor?: Executor | null): Promise<BackupSchedule[]> {
    const items = await schedulesStore(executor).list();
    return items
      .map((d) => scheduleFromStored(d as unknown as StoredSchedule))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async findScheduleById(id: number, executor?: Executor | null): Promise<BackupSchedule | undefined> {
    const doc = await schedulesStore(executor).get(id);
    return doc ? scheduleFromStored(doc as unknown as StoredSchedule) : undefined;
  },

  async findEnabledSchedules(executor?: Executor | null): Promise<BackupSchedule[]> {
    const items = await schedulesStore(executor).query((d) => d.enabled === true);
    return items.map((d) => scheduleFromStored(d as unknown as StoredSchedule));
  },

  async createSchedule(data: Omit<NewBackupSchedule, "id" | "createdAt" | "updatedAt">, executor?: Executor | null): Promise<BackupSchedule> {
    const created = await schedulesStore(executor).create({
      name: data.name,
      schedule: data.schedule,
      storageId: String((data as { storageId?: string | number }).storageId ?? "local"),
      provider: data.provider ?? "local",
      providerConfig: (data.providerConfig as Record<string, string> | undefined) ?? {},
      includeDatabase: data.includeDatabase ?? true,
      includeDatabases: data.includeDatabases ?? false,
      databaseSelections: (data.databaseSelections as StoredSchedule["databaseSelections"] | undefined) ?? [],
      includeMail: data.includeMail ?? false,
      includePanelConfig: data.includePanelConfig ?? false,
      includePaths: (data.includePaths as string[] | undefined) ?? [],
      fullServer: data.fullServer ?? false,
      retainCount: data.retainCount ?? 7,
      enabled: data.enabled ?? true,
      lastRunAt: null,
      createdAt: "",
      updatedAt: "",
    } as StoredSchedule & { id?: string | number });
    return scheduleFromStored(created as unknown as StoredSchedule);
  },

  async updateSchedule(id: number, data: Partial<Omit<NewBackupSchedule, "id" | "createdAt">>, executor?: Executor | null): Promise<BackupSchedule | undefined> {
    const patch: Partial<StoredSchedule> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v instanceof Date) (patch as Record<string, unknown>)[k] = v.toISOString();
      else (patch as Record<string, unknown>)[k] = v as unknown;
    }
    const updated = await schedulesStore(executor).update(id, patch);
    return updated ? scheduleFromStored(updated as unknown as StoredSchedule) : undefined;
  },

  async deleteSchedule(id: number, executor?: Executor | null): Promise<boolean> {
    return schedulesStore(executor).delete(id);
  },

  async touchScheduleRun(id: number, executor?: Executor | null): Promise<void> {
    await schedulesStore(executor).update(id, { lastRunAt: new Date().toISOString() });
  },
};
