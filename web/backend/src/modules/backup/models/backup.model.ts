// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Backup job and schedule types.
 */

export const BACKUP_STATUSES = ["pending", "running", "completed", "failed"] as const;
export type BackupStatus = (typeof BACKUP_STATUSES)[number];

export const STORAGE_PROVIDERS = ["local", "s3", "r2"] as const;
export type StorageProvider = (typeof STORAGE_PROVIDERS)[number];

export interface BackupJob {
  id: number;
  /** Program that created this job; absent for manual and legacy jobs. */
  scheduleId?: number | null;
  /** Human-readable label. */
  label: string;
  status: BackupStatus;
  /** Storage provider used for this backup. */
  provider: StorageProvider;
  /** Destination path or S3/R2 key. */
  destination: string | null;
  /** Byte size of the resulting archive. */
  sizeBytes: number | null;
  /** Error message if status = "failed". */
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

export interface NewBackupJob {
  id?: number;
  scheduleId?: number | null;
  /** Human-readable label. */
  label: string;
  status?: BackupStatus;
  /** Storage provider used for this backup. */
  provider?: StorageProvider;
  /** Destination path or S3/R2 key. */
  destination?: string | null;
  /** Byte size of the resulting archive. */
  sizeBytes?: number | null;
  /** Error message if status = "failed". */
  error?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdAt?: Date;
}

export interface BackupSchedule {
  id: number;
  name: string;
  /** Cron expression, e.g. "0 3 * * *". */
  schedule: string;
  /** Configured storage-target id (or "local"). */
  storageId: string;
  provider: StorageProvider;
  /** JSON config for the provider (bucket, prefix, etc.). */
  providerConfig: Record<string, string> | null;
  /** Legacy: include the panel host's own PostgreSQL dump (local target only). */
  includeDatabase: boolean;
  /** Include the connected server's databases (MySQL/MariaDB + PostgreSQL). */
  includeDatabases: boolean;
  /** Restrict the DB dump to these specific databases (empty → all). */
  databaseSelections: Array<{ engine: "mysql" | "postgresql"; name: string }> | null;
  /** Include the connected server's mail store + Postfix/Dovecot config. */
  includeMail: boolean;
  /** Include the connected server's LuxiPanel config dir. */
  includePanelConfig: boolean;
  /** Paths to include (JSON array). */
  includePaths: string[] | null;
  /** Curated full-server snapshot (DBs + mail + config + curated paths). */
  fullServer: boolean;
  /** How many backups to keep (oldest are pruned). */
  retainCount: number;
  enabled: boolean;
  lastRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewBackupSchedule {
  id?: number;
  name: string;
  /** Cron expression, e.g. "0 3 * * *". */
  schedule: string;
  /** Configured storage-target id (or "local"). */
  storageId?: string;
  provider?: StorageProvider;
  /** JSON config for the provider (bucket, prefix, etc.). */
  providerConfig?: Record<string, string> | null;
  /** Legacy: include the panel host's own PostgreSQL dump (local target only). */
  includeDatabase?: boolean;
  /** Include the connected server's databases (MySQL/MariaDB + PostgreSQL). */
  includeDatabases?: boolean;
  /** Restrict the DB dump to these specific databases (empty → all). */
  databaseSelections?: Array<{ engine: "mysql" | "postgresql"; name: string }> | null;
  /** Include the connected server's mail store + Postfix/Dovecot config. */
  includeMail?: boolean;
  /** Include the connected server's LuxiPanel config dir. */
  includePanelConfig?: boolean;
  /** Paths to include (JSON array). */
  includePaths?: string[] | null;
  /** Curated full-server snapshot (DBs + mail + config + curated paths). */
  fullServer?: boolean;
  /** How many backups to keep (oldest are pruned). */
  retainCount?: number;
  enabled?: boolean;
  lastRunAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}
