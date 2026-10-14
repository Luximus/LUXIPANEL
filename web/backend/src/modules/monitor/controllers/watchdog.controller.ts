/**
 * Watchdog controller — auto-reboot policy of the connected server.
 *
 * GET returns the stored config plus the live unit status; PUT (admin-only)
 * persists the config in the per-server sidecar and materializes it on the
 * client server (install+restart when enabled, disable otherwise).
 */

import type { Request, Response } from "express";
import { asyncHandler, type SessionUser } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { ForbiddenError } from "../../../shared/errors/index.js";
import { watchdogConfigSchema } from "../models/watchdog.model.js";
import { watchdogRepository } from "../repositories/watchdog.repository.js";
import { resourceWatchdogService } from "../services/resource-watchdog.service.js";

function assertAdmin(res: Response): void {
  const user = res.locals["user"] as SessionUser | undefined;
  // Fail-closed: a missing user must be denied too (the old `user && …` let an
  // unpopulated session through — this endpoint installs a root reboot service).
  if (user?.kind !== "admin") {
    throw new ForbiddenError(
      "Solo un administrador puede configurar el reinicio automático del servidor",
    );
  }
}

export const watchdogController = {
  /** GET /api/monitor/watchdog — config + live status. */
  get: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const config = await watchdogRepository.load(executor);
    const status = await resourceWatchdogService.status(executor);
    res.json({ ok: true, data: { config, status } });
  }),

  /** PUT /api/monitor/watchdog — save + apply on the client server (admin). */
  update: asyncHandler(async (req: Request, res: Response) => {
    assertAdmin(res);
    const config = watchdogConfigSchema.parse(req.body);
    const executor = getExecutor(req);

    await watchdogRepository.save(executor, config);
    if (config.enabled) {
      await resourceWatchdogService.install(executor, config);
    } else {
      await resourceWatchdogService.disable(executor);
    }

    const status = await resourceWatchdogService.status(executor);
    res.json({ ok: true, data: { config, status } });
  }),
};
