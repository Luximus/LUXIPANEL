// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { registerModuleOperations } from "../../shared/module-operations/registry.js";
import type { Express } from "express";
import { createModuleLogger } from "../../shared/logger/index.js";
import { chatRouter } from "./routes/chat.routes.js";

const log = createModuleLogger("chat-module");

export function registerChatModule(app: Express): void {
  app.use(chatRouter);
  registerModuleOperations("chat", chatRouter);
  log.info("Chat module registered");
}
