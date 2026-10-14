// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { registerModuleOperations } from "../../shared/module-operations/registry.js";
import type { Express } from "express";
import { searchRouter } from "./routes/search.routes.js";
import { createModuleLogger } from "../../shared/logger/index.js";

const log = createModuleLogger("search-module");

export function registerSearchModule(app: Express): void {
  app.use(searchRouter);
  registerModuleOperations("search", searchRouter);
  log.info("Search module registered");
}
