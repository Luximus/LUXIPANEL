// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { registerModuleOperations } from "../../shared/module-operations/registry.js";
/**
 * Terminal module.
 *
 * Two registration points:
 *
 *  1. registerTerminalModule(app)      — registers HTTP management routes
 *  2. attachTerminalWebSocket(server)  — attaches the WebSocket server for
 *                                        the PTY endpoint (/api/terminal/ws)
 *
 * The WebSocket server must be attached AFTER app.listen() because it needs
 * the underlying http.Server to intercept the HTTP upgrade event.
 */

import type { Express } from "express";
import { terminalRouter } from "./routes/terminal.routes.js";
import { handleTerminalConnection } from "./controllers/terminal.controller.js";
import { sessionManagerService } from "./services/session-manager.service.js";
import { createModuleLogger } from "../../shared/logger/index.js";
import { env } from "../../config/env.js";
import type { WsRouter } from "../../shared/websocket/ws-router.js";

const log = createModuleLogger("terminal-module");

/** WebSocket path for the terminal PTY endpoint (single source of truth;
 *  imported by the auth/connection tests so they can't drift from it). */
export const TERMINAL_WS_PATH = "/api/terminal/ws";

export function registerTerminalModule(app: Express): void {
  if (!env.TERMINAL_ENABLED) {
    log.info("Web Terminal is disabled (TERMINAL_ENABLED=false)");
    return;
  }

  app.use(terminalRouter);
  registerModuleOperations("terminal", terminalRouter);
  log.info(
    { maxSessions: env.TERMINAL_MAX_SESSIONS, shell: env.TERMINAL_SHELL },
    "Terminal module registered (HTTP routes)",
  );
}

/**
 * Register the terminal WebSocket route with the shared WsRouter.
 * Must be called after app.listen() returns the http.Server.
 */
export function attachTerminalWebSocket(router: WsRouter): void {
  if (!env.TERMINAL_ENABLED) return;

  router.register(TERMINAL_WS_PATH, (ws, req) => handleTerminalConnection(ws, req));

  // Start idle-cleanup loop
  sessionManagerService.start();

  log.info(`Terminal WebSocket handler registered at ${TERMINAL_WS_PATH}`);
}

/** Stop the session manager on graceful shutdown. */
export function stopTerminalModule(): void {
  sessionManagerService.stop();
}
