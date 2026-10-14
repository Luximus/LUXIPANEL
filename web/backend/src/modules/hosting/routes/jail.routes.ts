// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Hosting jail routes (Fase 5) — router propio para los endpoints del chroot,
 * separado del `hostingRouter` principal para evitar colisiones de edición con
 * otros agentes que tocan `hosting.routes.ts` en paralelo.
 *
 *   POST   /api/hosting/accounts/:id/jail
 *   DELETE /api/hosting/accounts/:id/jail
 *   GET    /api/hosting/accounts/:id/jail
 *
 * Mismo gate que el resto de la API de reseller: optionalAuth (para callers
 * solo-API-key) + requireAdminOrApiKey (sesión admin O lxp_ key válida).
 */

import { Router, type Router as ExpressRouter } from "express";
import { optionalAuth } from "../../auth/index.js";
import { requireAdminOrApiKey } from "../middlewares/tenant-scope.middleware.js";
import { hostingJailController } from "../controllers/jail.controller.js";

export const hostingJailRouter: ExpressRouter = Router();

hostingJailRouter.use("/api/hosting/accounts/:id/jail", optionalAuth, requireAdminOrApiKey);

hostingJailRouter.post("/api/hosting/accounts/:id/jail",   hostingJailController.provision);
hostingJailRouter.delete("/api/hosting/accounts/:id/jail", hostingJailController.teardown);
hostingJailRouter.get("/api/hosting/accounts/:id/jail",    hostingJailController.status);
