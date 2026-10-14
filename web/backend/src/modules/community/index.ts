// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { csrfProtection } from "../auth/middlewares/csrf.middleware.js";
import { communityPreviewRegistry } from "../../shared/community-preview/index.js";
/**
 * Módulo Community — runtime de módulos de terceros en LUXIPANEL.
 * Ruta GENÉRICA de dispatch (no se montan routers por módulo) + loader.
 *
 * Mounted at startup; approved local modules are loaded before listening.
 */
import { Router, type Express, type Request, type Response } from "express";
import { requireAuth } from "../auth/middlewares/session.middleware.js";
import { requireModule } from "../auth/middlewares/require-module.middleware.js";
import { agentCapabilityRegistry } from "../../shared/agent-capability/registry.js";
import { createModuleLogger } from "../../shared/logger/index.js";
import { eventBus, Events } from "../../shared/events/index.js";
import { reloadModule, unloadModule } from "./community-loader.service.js";
import { previewSandboxRuntime } from "../../shared/preview-sandbox/runtime.js";
import { asyncHandler } from "../../shared/types/index.js";
import { NotFoundError, ForbiddenError, ValidationError } from "../../shared/errors/index.js";
import { hasActionPermission } from "../../shared/auth/role-permissions.js";
import { requireLpApiKey } from "../../shared/lp-api-key.js";

const log = createModuleLogger("community");
const router = Router();

/** Extrae moduleId del payload de un evento (cadena vacía si ausente). */
function payloadModuleId(payload: unknown): string {
  return String((payload as { moduleId?: unknown } | undefined)?.moduleId ?? "");
}

/** Verifica permiso de usuario declarado en la tool (admin lo salta). */
function hasPermission(res: Response, permission?: string): boolean {
  if (!permission) return true;
  const user = res.locals.user;
  return Boolean(user && hasActionPermission(user, permission));
}

// POST /api/community/:moduleId/tool/:name — ejecuta una AgentTool del módulo.
const dispatchTool = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { moduleId, name } = req.params;
  const preview = communityPreviewRegistry.get(String(moduleId));
  if (preview && preview.ownerUserId !== String(res.locals.user?.userId)) throw new NotFoundError("module not found");
  const found = agentCapabilityRegistry.findTool(`${moduleId}.${name}`);
  if (!found || found.moduleId !== moduleId) {
    throw new NotFoundError("tool no encontrada");
  }
  if (!hasPermission(res, found.tool.permission)) {
    throw new ForbiddenError(`permiso requerido: ${found.tool.permission}`);
  }
  let out;
  try {
    out = await found.tool.handler(req.body?.input);
  } catch (err) {
    log.error({ err, moduleId, name }, "community tool dispatch failed");
    // Don't reflect raw tool error message to the client (it may contain
    // internal state or file contents). Surface a generic validation
    // message; detail stays in logs.
    throw new ValidationError("tool error");
  }
  res.json({ ok: out.ok, data: out.output });
});

// GET /api/community/:moduleId/panel/:name — recoge un AgentDataPanel.
const dispatchPanel = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { moduleId, name } = req.params;
  const preview = communityPreviewRegistry.get(String(moduleId));
  if (preview && preview.ownerUserId !== String(res.locals.user?.userId)) throw new NotFoundError("module not found");
  const found = agentCapabilityRegistry.findDataPanel(`${moduleId}.${name}`);
  if (!found || found.moduleId !== moduleId) {
    throw new NotFoundError("panel no encontrado");
  }
  let data;
  try {
    data = await found.panel.collect();
  } catch (err) {
    log.error({ err, moduleId, name }, "community panel collect failed");
    throw new ValidationError("panel error");
  }
  res.json({ ok: true, data });
});

const dynModule = (req: Request, res: Response, next: any) => requireModule(String(req.params.moduleId))(req, res, next);

router.post("/api/community/:moduleId/tool/:name", requireAuth, requireLpApiKey, csrfProtection, dynModule, dispatchTool);
router.get("/api/community/:moduleId/panel/:name", requireAuth, requireLpApiKey, dynModule, dispatchPanel);

let listenersRegistered = false;
export function registerCommunityModule(app: Express): void {
  app.use(router);
  // Estado de instancia: inicializa (y registra a nivel boot) el runtime de
  // sandbox de previews. Hoy queda no disponible → previews inertes; el log
  // permite a los operadores ver el estado REAL antes de confiar en el flag.
  previewSandboxRuntime.init();
  log.info({ previewSandbox: previewSandboxRuntime.describe() }, "preview sandbox runtime state at boot");

  if (listenersRegistered) return;
  listenersRegistered = true;
  // Recarga/descarga en caliente disparada por otros módulos vía event bus
  // (module-dev preview Modo B) — sin cross-imports. Nunca crashear: el
  // loader ya aísla fallos por módulo, aquí solo protegemos el listener.
  eventBus.on(Events.COMMUNITY_RELOAD, (payload: unknown) => {
    try {
      const moduleId = payloadModuleId(payload);
      if (!moduleId) return;
      void reloadModule(moduleId).catch((err) =>
        log.error({ err, moduleId }, "community reload (event) failed"),
      );
    } catch (err) {
      log.error({ err }, "community reload listener failed");
    }
  });
  eventBus.on(Events.COMMUNITY_UNLOAD, (payload: unknown) => {
    try {
      const moduleId = payloadModuleId(payload);
      if (!moduleId) return;
      unloadModule(moduleId);
    } catch (err) {
      log.error({ err }, "community unload listener failed");
    }
  });
  // Standalone: el poll de cambios a LP (marketplace sync) se eliminó junto con
  // `community-sync.service.ts`. El loader local sigue vivo (módulos de terceros
  // instalados on-box + recarga en caliente por event bus).
  log.info("Community module registered");
}
