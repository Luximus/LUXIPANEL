// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * MCP Audit Repository — record that a tool call happened.
 *
 * Persistence is intentionally NOT implemented: LUXIPANEL has no DB and there
 * is (by design) no reader for MCP tool-call history yet. The only durable,
 * observable output is the structured `log.debug` line below (greppable in
 * `pm2 logs luxipanel-backend`). The previous in-memory `auditLogs` array was a
 * pure write-only sink — nothing ever read it, so it only grew the heap; it was
 * removed. Re-add real persistence here (data-store sidecar or LP push) the day
 * a consumer needs to READ the audit trail — keep the same `logToolCall` shape.
 */

import { createModuleLogger } from "../../../shared/logger/index.js";

const log = createModuleLogger("mcp-audit-repo");

export const auditRepository = {
  /**
   * Record a tool call. `input`/`output` are already secret-masked by the
   * caller (extensions.controller). `error` is truncated defensively.
   */
  async logToolCall(
    extensionId: string,
    toolName: string,
    userId: string | null,
    input: Record<string, any> | null,
    output: Record<string, any> | null,
    error: string | null,
    durationMs: number,
  ): Promise<void> {
    log.debug(
      {
        extensionId,
        toolName,
        userId,
        durationMs,
        error: error ? error.slice(0, 1000) : null,
        hasInput: input != null,
        hasOutput: output != null,
      },
      "MCP tool call",
    );
  },
};
