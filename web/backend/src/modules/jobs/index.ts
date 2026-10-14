// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { registerModuleOperations } from "../../shared/module-operations/registry.js";
import type { Express } from "express";
import { jobsRouter } from "./routes/jobs.routes.js";
import { createModuleLogger } from "../../shared/logger/index.js";

const log = createModuleLogger("jobs-module");

export function registerJobsModule(app: Express): void {
  app.use(jobsRouter);
  registerModuleOperations("jobs", jobsRouter);
  log.info("Jobs module registered");
}
