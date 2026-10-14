// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Webhook discovery controller.
 *
 * GET  /api/webhooks/discovered        — scan & list webhooks found on server
 * POST /api/webhooks/discovered/scan   — same, explicit (re)scan
 * POST /api/webhooks/discovered/action — manage a discovered item by id
 *
 * Discovery is an on-demand scan over the connected client server (no
 * persistence), mirroring the Files module's project scan. Management is
 * best-effort and source-dependent: panel-native (`sidecar`) items get full
 * CRUD via the webhooks controller; `git-hook` items can be disabled (chmod -x)
 * or deleted (unlink) at the source; everything else is read-only here and
 * must be managed from its owning module.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { quoteArg } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { ValidationError, NotFoundError } from "../../../shared/errors/index.js";
import { webhookDiscoveryService } from "../services/discovery/index.js";
import { webhookRepository } from "../repositories/webhook.repository.js";
import type { DiscoveredWebhook } from "../models/discovery.model.js";

const log = createModuleLogger("webhook-discovery");

const actionSchema = z.object({
  id: z.string().min(8).max(64),
  op: z.enum(["delete", "enable", "disable"]),
});

/** Re-scan and locate a discovered item by its stable id, so an action can be
 *  validated against ground truth (we persist nothing). */
async function findById(req: Request, id: string): Promise<DiscoveredWebhook> {
  const executor = getExecutor(req);
  const all = await webhookDiscoveryService.discover(executor);
  const found = all.find((w) => w.id === id);
  if (!found) throw new NotFoundError("Webhook detectado");
  return found;
}

export const discoveryController = {
  /** GET /api/webhooks/discovered */
  list: asyncHandler(async (req: Request, res: Response) => {
    try {
      const executor = getExecutor(req);
      const data = await webhookDiscoveryService.discover(executor);
      res.json({ ok: true, data, count: data.length });
    } catch (err) {
      log.error({ err }, "discovery scan failed");
      res.json({ ok: true, data: [], count: 0 });
    }
  }),

  /** POST /api/webhooks/discovered/scan */
  scan: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    // Explicit (re)scan — bypass the per-target cache.
    const data = await webhookDiscoveryService.discover(executor, { force: true });
    log.info({ count: data.length, target: executor.target.id }, "discovery scan complete");
    res.json({ ok: true, data, count: data.length });
  }),

  /** POST /api/webhooks/discovered/action */
  action: asyncHandler(async (req: Request, res: Response) => {
    const { id, op } = actionSchema.parse(req.body);
    const item = await findById(req, id);
    const executor = getExecutor(req);

    // ── Panel-native sidecar item → delegate to the webhooks store ──
    if (item.source === "sidecar") {
      const numericId = Number(item.location.split("#").pop());
      if (!Number.isFinite(numericId)) throw new ValidationError("Webhook gestionado inválido");
      if (op === "delete") {
        const ok = await webhookRepository.delete(numericId, executor);
        if (!ok) throw new NotFoundError("Webhook");
      } else {
        await webhookRepository.update(numericId, { enabled: op === "enable" }, executor);
      }
      res.json({ ok: true });
      return;
    }

    // ── Git hook → enable/disable via +x/-x, delete via unlink ──
    if (item.source === "git-hook") {
      const path = item.location.split(":")[0]!;
      if (op === "delete") {
        await executor.exec(`rm -f -- ${quoteArg(path)}`, { timeoutMs: 10_000 });
      } else if (op === "disable") {
        await executor.exec(`chmod -x -- ${quoteArg(path)}`, { timeoutMs: 10_000 });
      } else {
        await executor.exec(`chmod +x -- ${quoteArg(path)}`, { timeoutMs: 10_000 });
      }
      res.json({ ok: true });
      return;
    }

    // ── Everything else: read-only here ──
    throw new ValidationError(
      `Los webhooks de tipo "${item.source}" se gestionan desde su módulo correspondiente.`,
    );
  }),
};
