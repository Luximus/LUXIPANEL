// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * "Me" controller — datos mínimos del usuario AUTENTICADO para clientes externos
 * (p. ej. LP-LICENSE-SERVER por el túnel SSH). Expone qué MÓDULOS hay: los flags
 * assistant/terminal (para gatear sus botones dedicados) y `available`, la lista
 * de módulos ACTIVOS en el servidor (habilitados ∩ con entitlement), idéntica a
 * `GET /api/modules/installed` (lo que ve el sidebar del panel), para el modal
 * "Más herramientas" de los clientes. No expone secretos.
 *
 * `available` NO se filtra por los `modules` del usuario del túnel: ese identity
 * (usuario SSH puenteado por LP) suele resolver `modules` vacío / no-admin cuando
 * los sidecars de roles no son legibles sin sudo, lo que ocultaba TODOS los
 * módulos aunque estuvieran activos. El gating fino por permiso ya lo aplica cada
 * página de módulo de LUXIPANEL al navegar; aquí solo es un lanzador.
 *
 * Auth: `requireAuth` (cookie o `Authorization: Bearer`). El JWT trae los
 * `modules` resueltos desde los grupos del usuario; `kind === "admin"` ve todo.
 */
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { errMessage } from "../../../shared/utils/err-message.js";
import { getExecutor, runWithExecutor } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { moduleRegistryService } from "../../../modules/admin/services/module-registry.service.js";

const log = createModuleLogger("me-controller");

// assistant/terminal tienen botón dedicado en los clientes ("Empezar conversación"
// / "Nueva terminal") y se exponen como flags aparte: no se listan en `available`.
const EXCLUDED_FROM_AVAILABLE = new Set(["assistant", "terminal"]);

export const meController = {
  /** GET /api/me/modules — módulos del usuario autenticado + lista de módulos activos. */
  getModules: asyncHandler(async (req: Request, res: Response) => {
    const user = res.locals.user;
    const userModules: string[] = Array.isArray(user?.modules) ? user.modules : [];
    const isAdmin = user?.kind === "admin";

    // Módulos ACTIVOS en el servidor: habilitados (enabled-map a nivel
    // servidor conectado). MISMA lógica que /api/modules/installed
    // (lo que pinta el sidebar). Self-hosted: sin gate de entitlement LP —
    // todo módulo habilitado es usable. Fail-soft: ante error → lista vacía
    // (se loguea para diagnóstico).
    let available: { id: string; name: string }[] = [];
    try {
      available = await runWithExecutor(getExecutor(req), async () => {
        const enabledMap = await moduleRegistryService.getEnabledMap();
        const order = await moduleRegistryService.getOrder();
        const byId = new Map(moduleRegistryService.getAll().map((m) => [m.id, m] as const));
        const enabled = order
          .map((id) => byId.get(id))
          .filter((m): m is NonNullable<typeof m> => Boolean(m && enabledMap[m.id]));
        return enabled
          .filter((m) => !EXCLUDED_FROM_AVAILABLE.has(m.id))
          .map((m) => ({ id: m.id, name: m.name }));
      });
    } catch (err) {
      log.warn({ err: errMessage(err) }, "me/modules: no se pudo resolver `available`");
      available = [];
    }

    res.json({
      ok: true,
      modules: {
        assistant: isAdmin || userModules.includes("assistant"),
        terminal: isAdmin || userModules.includes("terminal"),
      },
      available,
    });
  }),
};
