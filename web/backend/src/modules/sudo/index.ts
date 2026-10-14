// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { Express } from "express";
import { sudoRouter } from "./routes/sudo.routes.js";
import { createModuleLogger } from "../../shared/logger/index.js";

const log = createModuleLogger("sudo-module");

export function registerSudoModule(app: Express): void {
  app.use(sudoRouter);
  log.info("Sudo credential module registered");
}
