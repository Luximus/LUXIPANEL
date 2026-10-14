// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Schedules controller — CRUD for backup schedules.
 */

import { z } from "zod";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { backupRepository } from "../repositories/backup.repository.js";
import { storageRepository } from "../repositories/storage.repository.js";
import { databaseSelectionSchema, STORAGE_PROVIDERS } from "../models/index.js";
import { NotFoundError, ValidationError } from "../../../shared/errors/index.js";
import { readBackupConfig } from "../services/backup-config.service.js";

const createSchema = z.object({
  name: z.string().min(2).max(128).trim(),
  schedule: z.string().min(9).max(64).trim(),
  /** Configured storage-target id, or "local"/empty. */
  storageId: z.union([z.string(), z.number()]).transform((v) => String(v)).optional(),
  provider: z.enum(STORAGE_PROVIDERS).default("local"),
  providerConfig: z.record(z.string()).optional().default({}),
  includeDatabase: z.boolean().default(true),
  includeDatabases: z.boolean().default(false),
  databaseSelections: z.array(databaseSelectionSchema).default([]),
  includeMail: z.boolean().default(false),
  includePanelConfig: z.boolean().default(false),
  includePaths: z.array(z.string()).default([]),
  fullServer: z.boolean().default(false),
  retainCount: z.number().int().min(1).max(365).optional(),
  enabled: z.boolean().default(true),
});

const updateSchema = createSchema.partial();

export const schedulesController = {
  /** GET /api/backups/schedules — list all backup schedules. */
  list: asyncHandler(async (_req, res) => {
    const data = await backupRepository.listSchedules();
    res.json({ ok: true, data });
  }),

  /** POST /api/backups/schedules — create a new schedule. */
  create: asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const executor = getExecutor(req);
    // Derive the display provider from the chosen storage target.
    const storage = body.storageId !== undefined ? await storageRepository.resolve(body.storageId, executor) : null;
    if (body.storageId !== undefined && !storage) throw new ValidationError("Destino de backup no disponible o sin credenciales.");
    const provider = storage && storage.provider !== "local" ? storage.provider : body.provider;
    const config = await readBackupConfig(executor);
    const schedule = await backupRepository.createSchedule({ ...body, retainCount: body.retainCount ?? config.defaultRetainCount, provider });
    res.status(201).json({ ok: true, data: schedule });
  }),

  /** PUT /api/backups/schedules/:id — update a schedule. */
  update: asyncHandler(async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const body = updateSchema.parse(req.body);
    const existing = await backupRepository.findScheduleById(id);
    if (!existing) throw new NotFoundError("Backup schedule");
    const executor = getExecutor(req);
    const storage = body.storageId !== undefined ? await storageRepository.resolve(body.storageId, executor) : null;
    if (body.storageId !== undefined && !storage) throw new ValidationError("Destino de backup no disponible o sin credenciales.");
    const updated = await backupRepository.updateSchedule(id, {
      ...body,
      ...(storage ? { provider: storage.provider } : {}),
    });
    res.json({ ok: true, data: updated });
  }),

  /** DELETE /api/backups/schedules/:id — delete a schedule. */
  remove: asyncHandler(async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const ok = await backupRepository.deleteSchedule(id);
    if (!ok) throw new NotFoundError("Backup schedule");
    res.json({ ok: true });
  }),
};
