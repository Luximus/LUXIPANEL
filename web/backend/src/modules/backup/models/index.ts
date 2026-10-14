// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { z } from "zod";

export {
  BACKUP_STATUSES, STORAGE_PROVIDERS,
  type BackupJob, type NewBackupJob,
  type BackupSchedule, type NewBackupSchedule,
  type BackupStatus, type StorageProvider,
} from "./backup.model.js";

/** One DB selection (engine + name) for a backup's `databaseSelections`. */
export const databaseSelectionSchema = z.object({
  engine: z.enum(["mysql", "postgresql"]),
  name: z.string().min(1).max(128),
});
