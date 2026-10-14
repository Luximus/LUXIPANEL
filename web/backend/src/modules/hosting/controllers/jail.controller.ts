// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Hosting jail controller (Fase 5) — provisión/desmonte/estado del chroot del
 * tenant. Vive en su propio controller/router para no colisionar con el
 * controller principal de hosting (editado en paralelo por otro agente).
 *
 * Endpoints (gateados por optionalAuth + requireAdminOrApiKey en el router):
 *   POST   /api/hosting/accounts/:id/jail   provisiona/reaprovisiona (idempotente)
 *   DELETE /api/hosting/accounts/:id/jail   desmonta (revierte shell + umount proc)
 *   GET    /api/hosting/accounts/:id/jail   estado del jail
 *
 * Degradación: si jailkit no está instalado (o JAIL_SHELL_ENABLED=false), POST
 * responde 200 con `{jailed:false, degraded:true, reason}` (NO error) y deja una
 * notificación accionable al admin.
 */

import type { Request, Response } from "express";
import { hostingService } from "../services/hosting.service.js";
import { hostingJailService } from "../services/jail.service.js";
import { hostingAccountRepository } from "../repositories/hosting-account.repository.js";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";

export const hostingJailController = {
  /** POST /api/hosting/accounts/:id/jail — provisiona/reaprovisiona el jail. */
  provision: asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params["id"]);
    const executor = getExecutor(req);
    const account = await hostingService.findById(id, executor);

    const result = await hostingJailService.provisionJail(account, executor);

    // Persistir la intención + marca de tiempo cuando el jail quedó efectivo.
    // (Fail-soft: no dejar caer el endpoint por un fallo de persistencia.)
    if (result.jailed) {
      await hostingAccountRepository
        .update(id, { jailEnabled: true, jailedAt: result.jailedAt }, executor)
        .catch(() => undefined);
    }
    res.json({ ok: true, data: result });
  }),

  /** DELETE /api/hosting/accounts/:id/jail — desmonta el jail. */
  teardown: asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params["id"]);
    const executor = getExecutor(req);
    const account = await hostingService.findById(id, executor);

    await hostingJailService.teardownJail(account, executor);
    await hostingAccountRepository
      .update(id, { jailEnabled: false, jailedAt: undefined }, executor)
      .catch(() => undefined);
    res.json({ ok: true, data: { jailed: false } });
  }),

  /** GET /api/hosting/accounts/:id/jail — estado del jail. */
  status: asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params["id"]);
    const executor = getExecutor(req);
    const account = await hostingService.findById(id, executor);
    const status = await hostingJailService.jailStatus(account, executor);
    res.json({ ok: true, data: status });
  }),
};
