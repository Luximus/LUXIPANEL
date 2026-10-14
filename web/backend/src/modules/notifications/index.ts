// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { registerModuleOperations } from "../../shared/module-operations/registry.js";
import type { Express } from "express";
import { createModuleLogger } from "../../shared/logger/index.js";
import { notificationsRouter } from "./routes/notifications.routes.js";
import { wireInternalNotifications } from "./services/notifications.service.js";

const log = createModuleLogger("notifications-module");

export function registerNotificationsModule(app: Express): void {
  app.use(notificationsRouter);
  registerModuleOperations("notifications", notificationsRouter);
  wireInternalNotifications();
  log.info("Notifications module registered");
}
