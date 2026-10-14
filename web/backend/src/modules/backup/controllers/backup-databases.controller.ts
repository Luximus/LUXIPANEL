// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** Read-only database names for the backup source picker. */
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { databasesService } from "../../databases/services/databases.service.js";

const log = createModuleLogger("backup-databases");

export const backupDatabasesController = {
  list: asyncHandler(async (req, res) => {
    const executor = getExecutor(req);
    const engines = await databasesService.detectEngines(executor);
    const data = await Promise.all(engines.map(async (engine) => {
      const group = {
        type: engine.type,
        label: engine.label,
        installed: engine.installed,
        running: engine.running,
        databases: [] as string[],
        error: false,
      };
      if (!engine.installed || !engine.running) return group;
      try {
        const databases = await databasesService.listDatabases(executor, engine.type);
        group.databases = databases.map((database) => database.name);
      } catch (error) {
        log.warn({ engine: engine.type, err: error }, "Could not list backup databases");
        group.error = true;
      }
      return group;
    }));
    res.json({ ok: true, data });
  }),
};
