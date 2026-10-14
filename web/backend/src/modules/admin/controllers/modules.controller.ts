// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Modules controller — list, toggle and reorder optional modules.
 *
 * The panel treats modules as preinstalled core features. Runtime management
 * is limited to (a) visibility (sidebar show/hide), and (b) order — the
 * sequence the cards take in /panel/modules and the corresponding nav links
 * in the sidebar.
 */

import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { asyncHandler } from "../../../shared/types/index.js";
import { NotFoundError, ValidationError } from "../../../shared/errors/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { moduleRegistryService } from "../services/module-registry.service.js";
import { applyModuleEnablementToSchedule } from "../services/cache-modules.service.js";
import { getExecutor, runWithExecutor } from "../../../shared/executor/index.js";
import { auditRepository } from "../../auth/repositories/audit.repository.js";

const log = createModuleLogger("admin-modules");

const reorderSchema = z.object({
  order: z.array(z.string().min(1)).min(1),
});

export const modulesController = {
  /** GET /api/admin/modules — list all core modules with their visibility state, sorted by stored order. */
  list: asyncHandler(async (req: Request, res: Response) => {
    const defs = moduleRegistryService.getAll();
    const [enabledMap, order, displayMap] = await runWithExecutor(getExecutor(req), () =>
      Promise.all([
        moduleRegistryService.getEnabledMap(),
        moduleRegistryService.getOrder(),
        moduleRegistryService.getDisplayMap(),
      ]),
    );

    const orderIndex = new Map<string, number>();
    order.forEach((id, idx) => orderIndex.set(id, idx));

    // Self-hosted: no LP entitlement gate and no LP module catalog. Every
    // registered module is listed; presentation metadata that only LP-LS
    // supplied (version/installs/rating/author/dates) is reported as null.
    const data = defs
      .map((m) => {
        return {
          id: m.id,
          name: m.name,
          description: m.description,
          tag: m.tag,
          icon: m.icon,
          color: m.color,
          category: m.category,
          features: m.features,
          configFields: m.configFields ?? [],
          dependencies: m.dependencies ?? [],
          enabled: enabledMap[m.id] ?? false,
          kind: m.kind ?? "module",
          // Capacidades declaradas por el catálogo. La UI decide si dibuja el
          // segundo toggle (FAB) según `supportsFloatingButton`.
          supportsFloatingButton: Boolean(m.supportsFloatingButton),
          // Estado actual del FAB. `null` = no persistente aún (sólo aplica a
          // módulos con FAB; la UI lo trata como `false` por defecto).
          showFloatingButton: displayMap[m.id]?.showFloatingButton ?? false,
          version: null,
          installs: null,
          rating: null,
          author: null,
          createdAt: null,
          updatedAt: null,
          position: orderIndex.has(m.id) ? orderIndex.get(m.id)! : Number.MAX_SAFE_INTEGER,
        };
      })
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));

    // Normalize to contiguous 0..n-1 so the UI doesn't see SAFE_INTEGER.
    data.forEach((m, idx) => { m.position = idx; });

    log.info({ count: data.length }, "Admin module catalog returned");
    res.json({ ok: true, count: data.length, data });
  }),

  /** PUT /api/admin/modules/order — set the explicit display order. */
  reorder: asyncHandler(async (req: Request, res: Response) => {
    const body = reorderSchema.parse(req.body);
    const known = new Set(moduleRegistryService.getAll().map((m) => m.id));
    const missing = body.order.filter((id) => !known.has(id));
    if (missing.length > 0) {
      throw new ValidationError(`Unknown module ids: ${missing.join(", ")}`);
    }
    await runWithExecutor(getExecutor(req), () => moduleRegistryService.setOrder(body.order));
    log.info({ count: body.order.length }, "Module order updated");
    res.json({ ok: true, data: { order: body.order } });
  }),

  /** PATCH /api/admin/modules/:id — toggle module visibility. */
  update: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const def = moduleRegistryService.getById(id);
    if (!def) throw new NotFoundError("Module");

    const fabProvided = typeof req.body?.showFloatingButton === "boolean";
    const fabValue = Boolean(req.body?.showFloatingButton);

    // El flag FAB es independiente del master `enabled`: el módulo puede
    // tener el FAB apagado y seguir visible en el sidebar (o viceversa).
    // Persistirlo no enciende ni apaga el módulo.
    if (fabProvided) {
      await runWithExecutor(getExecutor(req), () =>
        moduleRegistryService.setDisplayFlag(id, "showFloatingButton", fabValue),
      );
    }

    // Si el body no trae `enabled`, no tocamos el estado master (sólo se
    // actualizó un flag de display). Devolvemos el estado actual.
    if (typeof req.body?.enabled !== "boolean") {
      const [enabledMap, displayMap] = await runWithExecutor(getExecutor(req), () =>
        Promise.all([
          moduleRegistryService.getEnabledMap(),
          moduleRegistryService.getDisplayMap(),
        ]),
      );
      res.json({
        ok: true,
        data: {
          id,
          enabled: enabledMap[id] ?? false,
          showFloatingButton: displayMap[id]?.showFloatingButton ?? false,
          affected: [{ id, enabled: enabledMap[id] ?? false }],
        },
      });
      return;
    }

    const enabled = Boolean(req.body?.enabled);

    // enableClosure returns [dep…, id, …implied closure] — every id written
    // when enabling (dependencies AND implied companion modules, e.g. the
    // Assistant brings Obsidian). On disable only the target itself is written.
    const affectedIds = enabled
      ? moduleRegistryService.enableClosure(id)
      : [id];

    await runWithExecutor(getExecutor(req), () =>
      enabled ? moduleRegistryService.enable(id) : moduleRegistryService.disable(id),
    );

    const enabledMap = await runWithExecutor(getExecutor(req), () => moduleRegistryService.getEnabledMap());
    const nextEnabled = enabledMap[id] ?? false;

    const affected = affectedIds.map((aid) => ({ id: aid, enabled: enabledMap[aid] ?? false }));

    // Propagar enablement al schedule.json del cache-engine en el target
    // conectado, para que el dispatcher pare/arranque la recolección de
    // las colecciones del módulo afectado (y de sus dependencias en
    // cascada). Fire-and-forget — fallar no debe bloquear el toggle UI.
    try {
      const executor = getExecutor(req);
      // Aplica a CADA módulo afectado (incluye dependencias resueltas).
      await Promise.allSettled(
        affected.map((a) => applyModuleEnablementToSchedule(executor, a.id, a.enabled)),
      );
    } catch (err) {
      log.warn({ err: (err as Error).message, id, enabled },
        "Failed to propagate module enablement to cache-engine schedule");
    }

    // Auditoría por usuario de la activación/desactivación (sidecar del servidor
    // conectado). Best-effort: no debe romper el toggle.
    try {
      const user = (res.locals as { user?: { id?: number; username?: string } }).user;
      const executor = getExecutor(req);
      await auditRepository.append({
        id: `audit_${randomUUID()}`,
        userId: typeof user?.id === "number" ? user.id : null,
        eventType: nextEnabled ? "module_activated" : "module_deactivated",
        severity: "info",
        ip: null,
        userAgent: null,
        deviceId: null,
        requestId: null,
        context: { module: id, enabled: nextEnabled, affected, actor: user?.username ?? "unknown" },
      }, executor);
    } catch (err) {
      log.warn({ err: (err as Error).message, id }, "Failed to write module toggle audit");
    }

    // Si Obsidian acaba de quedar habilitado (directo o arrastrado por el
    // asistente), sembrar en segundo plano un contenedor de contexto por cada
    // repo y proyecto existente. Es un escaneo SSH (lento) → fire-and-forget,
    // re-pinando el executor por estar fuera del ciclo de la request. Los chats
    // sueltos se cubren por evento al crearse y por el botón "Sincronizar".
    if (nextEnabled && affected.some((a) => a.id === "obsidian" && a.enabled)) {
      try {
        const executor = getExecutor(req);
        void (async () => {
          try {
            const { contextContainerService } = await import(
              "../../obsidian/services/context-container.service.js"
            );
            await runWithExecutor(executor, () =>
              contextContainerService.syncAll(executor, { includeChats: false }),
            );
          } catch (err) {
            log.warn({ err: (err as Error).message }, "Obsidian context container backfill failed");
          }
        })();
      } catch (err) {
        log.warn({ err: (err as Error).message }, "Could not start Obsidian container backfill");
      }
    }

    res.json({
      ok: true,
      data: {
        id,
        enabled: nextEnabled,
        affected,
      },
    });
  }),
};
