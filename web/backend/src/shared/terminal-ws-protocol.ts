// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Terminal WebSocket wire-protocol message types (SSOT, backend side).
 *
 * The panel terminal speaks a tiny JSON protocol over WS. These `type` strings
 * are the wire contract between the browser terminal and the backend PTY:
 *   - client → server: INPUT, RESIZE, PING
 *   - server → client: OUTPUT, PONG
 *
 * Cross-reference: the frontend twin lives in the terminal client scripts
 * (handled separately by the frontend build). The two build systems can't share
 * this module, so any change here MUST be mirrored there. Keep the string
 * VALUES stable — they are on the wire.
 */

export const TerminalWsMsg = {
  INPUT: "input",
  RESIZE: "resize",
  PING: "ping",
  OUTPUT: "output",
  PONG: "pong",
} as const;
