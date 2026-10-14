// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { Express } from "express";
import { systemDepsRouter } from "./routes/system-deps.routes.js";
import { createModuleLogger } from "../../shared/logger/index.js";

const log = createModuleLogger("system-deps-module");

export function registerSystemDepsModule(app: Express): void {
  app.use(systemDepsRouter);
  log.info("System-deps module registered");
}
