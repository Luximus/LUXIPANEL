// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Assistant WebSocket wire message types (SSOT, backend side).
 *
 * These are the `type` strings exchanged on the assistant control WS
 * (hello / ping / pong keepalive, plus team-task update push).
 *
 * CROSS-REFERENCE: the frontend twin lives in
 * `frontend/src/lib/assistant-ws.ts`. The two build systems can't share this
 * module, so any change here MUST be mirrored there. Keep the string VALUES
 * stable — they are on the wire.
 */

export const AssistantWsTypes = {
  HELLO: "assistant:hello",
  PING: "assistant:ping",
  PONG: "assistant:pong",
  TEAM_TASK_UPDATE: "assistant.team_task_update",
} as const;
