// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { registerModuleOperations } from "../../shared/module-operations/registry.js";
/**
 * Terminal CLI module — server-global state for which agent CLI to
 * autostart in interactive shells, and the persistence layer for the
 * onboarding wizard.
 */

import type { Express } from "express";
import { terminalCliRouter } from "./routes/terminal-cli.routes.js";
import { createModuleLogger } from "../../shared/logger/index.js";

const log = createModuleLogger("terminal-cli-module");

export function registerTerminalCliModule(app: Express): void {
  app.use(terminalCliRouter);
  registerModuleOperations("terminal", terminalCliRouter);
  log.info("Terminal CLI module registered");
}
