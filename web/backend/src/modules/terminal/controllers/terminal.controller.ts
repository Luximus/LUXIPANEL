// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Terminal WebSocket controller.
 *
 * Handles the WebSocket upgrade for /api/terminal/ws.
 * Protocol (all messages are JSON). The `type` string VALUES are the SSOT
 * `TerminalWsMsg` in `shared/terminal-ws-protocol.ts` (input/resize/ping/
 * output/pong); the emit sites live in `services/terminal-connection.service.ts`
 * and use that const. The block below documents the full wire shape:
 *
 *   Client → Server:
 *     { type: "input",  data: "<string>" }
 *     { type: "resize", cols: <number>, rows: <number> }
 *     { type: "ping" }
 *
 *   Server → Client:
 *     { type: "output", data: "<string>" }
 *     { type: "exit",   code: <number>, reason?: "<string>" }
 *     { type: "error",  message: "<string>" }
 *     { type: "pong" }
 *     { type: "connected", sessionId: "<string>", pid: <number> }
 *
 * This controller is a THIN ORCHESTRATOR. The connection lifecycle is split into
 * cohesive phases in `services/terminal-connection.service.ts` (SOLID decomposition
 * of the former god-function). This file only sequences those phases — in the same
 * load-bearing order as before — and maps a phase's typed failure onto the exact
 * legacy `error` message + WS close code.
 */

import type { WebSocket } from "ws";
import type { IncomingMessage } from "http";
import { apiErrorMessage, apiLocaleFromRequest } from "../../../shared/i18n/errors.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";
import {
  authenticateTerminalWs,
  resolveTerminalExecutor,
  enforceHostingJail,
  openTerminalPty,
  registerTerminalSession,
  wireTerminalDispatch,
  send,
  type WsFailure,
} from "../services/terminal-connection.service.js";

// Re-export the pure PTY adapter from its new home so existing importers
// (and the characterization test) keep resolving it from this controller path.
export { createPtyFromStream } from "../services/terminal-connection.service.js";

/**
 * Turn a phase {@link WsFailure} into the legacy socket teardown: `send` the
 * error message, then close with the phase's code/reason. Same observable order
 * as the former inline early-returns (send → close).
 */
function failConnection(ws: WebSocket, failure: WsFailure, req: IncomingMessage): void {
  const locale = apiLocaleFromRequest(req);
  const source = failure.message;
  const message = source === "Authentication required" ? apiModuleMessage(locale, "wsAuthenticationRequired")
    : source === "Invalid or expired session" ? apiModuleMessage(locale, "wsInvalidSession")
    : source === "Insufficient permissions" ? apiModuleMessage(locale, "wsInsufficientPermissions")
    : source === "Sesión del servidor expirada. Reconéctate al servidor desde el panel."
      ? apiModuleMessage(locale, "terminalSessionExpired")
    : source === "Sesión del servidor expirada o no autorizada."
      || source === "Sesión sin servidor seleccionado. Reconéctate al servidor desde el panel."
      ? apiErrorMessage(locale, "bridgeRequired")
    : source === "Terminal requiere una cuenta administradora del grupo sudo en este servidor."
      ? apiModuleMessage(locale, "terminalAdminRequired")
    : source === "No se pudo iniciar la terminal."
      ? apiModuleMessage(locale, "terminalStartFailed")
    : source;
  send(ws, { type: "error", message });
  ws.close(failure.code, failure.reason);
}

/**
 * Handle a new WebSocket connection to the terminal endpoint.
 * Called by the WebSocket server's `connection` event.
 *
 * The phase order below is load-bearing and MUST NOT be reordered:
 *   auth → executor → jail → pty → register → dispatch.
 */
export async function handleTerminalConnection(
  ws: WebSocket,
  req: IncomingMessage,
): Promise<void> {
  // --- Auth ---
  const authResult = await authenticateTerminalWs(req);
  if (!authResult.ok) {
    failConnection(ws, authResult.failure, req);
    return;
  }
  const { payload, sessionUser, sessionId, clientSessionId } = authResult.auth;

  // --- Spawn PTY: executor selection ---
  const executorResult = await resolveTerminalExecutor(payload, req, sessionId);
  if (!executorResult.ok) {
    failConnection(ws, executorResult.failure, req);
    return;
  }
  const { executor } = executorResult;

  // --- Fase 5: jaula (chroot) fail-closed para sesiones hosting ---
  const jailFailure = await enforceHostingJail(executor, payload, sessionId);
  if (jailFailure) {
    failConnection(ws, jailFailure, req);
    return;
  }

  // --- Persistencia opcional vía tmux (reattach) + spawn PTY ---
  const clientManagesCli = new URL(req.url ?? "/", "http://localhost").searchParams.get("autostart") === "client";
  const ptyResult = await openTerminalPty(executor, payload, clientSessionId, sessionId, clientManagesCli);
  if (!ptyResult.ok) {
    failConnection(ws, ptyResult.failure, req);
    return;
  }
  const { pty, reattached } = ptyResult;

  // --- Register session --- (kills the PTY itself on the cap error)
  const registerFailure = registerTerminalSession({ ws, pty, sessionId, payload });
  if (registerFailure) {
    failConnection(ws, registerFailure, req);
    return;
  }

  // --- Notify client + wire PTY↔WS dispatch / close / error ---
  wireTerminalDispatch({ ws, pty, sessionId, sessionUser, payload, executor, reattached });
}
