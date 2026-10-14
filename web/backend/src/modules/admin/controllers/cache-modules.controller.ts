// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * cache-modules.controller.ts — endpoints for the "Ajustes → Módulos" tab.
 *
 * Lives under the existing admin module (auth + requireModule("admin")
 * middlewares are applied at the router level). All operations resolve the
 * per-server `Executor` from the request, so the schedule and metrics are
 * isolated per connected server.
 */

import { panelConfigDir } from "../../../config/paths.js";
import { liveFeatures } from "../../../shared/remote-cache/live-config.js";
import type { Request, Response } from "express";
import { z } from "zod";

import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { ValidationError } from "../../../shared/errors/index.js";
import {
  cacheModulesService,
  updateEntryInputSchema,
} from "../services/cache-modules.service.js";
import {
  remoteCacheHealth,
  remoteCacheStatsSnapshot,
} from "../../../shared/remote-cache/index.js";

const tokenSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9_-]+$/i);

export const cacheModulesController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const rows = await cacheModulesService.list(executor);
    res.json({ ok: true, data: rows });
  }),

  /** GET /admin/cache-modules/health — observability snapshot for the
   *  current target (breaker state + per-collection counters). Read-only;
   *  no tenant data crosses the wire. */
  health: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const targetId = executor.target.id;
    res.json({
      ok: true,
      data: {
        targetId,
        liveData: await liveFeatures(executor),
        watcher: await executor.readFile(`${panelConfigDir()}/cache-engine/watch-status.json`, "utf-8").then(raw => JSON.parse(String(raw))).catch(() => null),
        breaker: remoteCacheHealth(targetId).breaker,
        collections: remoteCacheStatsSnapshot(targetId),
      },
    });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const module = tokenSchema.safeParse(req.params.module);
    const collection = tokenSchema.safeParse(req.params.collection);
    if (!module.success || !collection.success) {
      throw new ValidationError("invalid module/collection token");
    }
    const patch = updateEntryInputSchema.safeParse(req.body);
    if (!patch.success) {
      throw new ValidationError(
        "invalid payload: " + patch.error.issues.map((i) => i.message).join("; "),
      );
    }
    const executor = getExecutor(req);
    const row = await cacheModulesService.update(
      executor,
      module.data,
      collection.data,
      patch.data,
    );
    res.json({ ok: true, data: row });
  }),
};
