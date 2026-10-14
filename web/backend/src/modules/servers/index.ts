// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Servers module — LOCAL encrypted vault of SSH targets for standalone
 * multi-node mode. Registers the REST surface (CRUD + TOFU + switch). The
 * vault is control-plane state on the panel host (localExecutor); nothing here
 * touches LP-LICENSE-SERVER. Additive: registering it does not affect managed.
 */

import type { Express } from "express";
import { serversRouter } from "./routes/servers.routes.js";
import { createModuleLogger } from "../../shared/logger/index.js";

const log = createModuleLogger("servers-module");

export function registerServersModule(app: Express): void {
  app.use(serversRouter);
  log.info("Servers module registered");
}

// Public module API — the single SSH target vault. The AI-assistant module
// consumes these for its cross-server tools (there is precedent for the
// assistant importing from modules/servers + modules/auth: both share the
// ssh-credentials cache). Keep this the ONLY cross-module entry point.
export { targetsRepository } from "./repositories/targets.repository.js";
export { userMayUseTarget, type TargetViewer } from "./services/servers.service.js";
