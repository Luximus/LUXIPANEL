// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * MCP Policy Service — Authorization & access control
 *
 * Determines who can access which tools based on:
 * - License (must be valid)
 * - Role (admin/operator/user)
 * - Extension status (must be connected)
 * - Tool allowlist (per extension)
 */

import { extensionRegistryService } from "./extension-registry.service.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import type { MCPTool } from "./mcp-connection.service.js";

const log = createModuleLogger("mcp-policy");

export interface AuthContext {
  userId?: string;
  role?: string; // "admin" | "operator" | "user"
  isAdmin?: boolean;
}

export const mcpPolicyService = {
  /**
   * Check if user can use an MCP extension
   */
  canUseExtension(extensionId: string, ctx: AuthContext): boolean {
    // Standalone: no LP license gate. Access is governed by role only.
    // Must be admin for now (v1)
    if (!ctx.isAdmin) {
      log.warn({ extensionId, userId: ctx.userId }, "User is not admin");
      return false;
    }

    return true;
  },

  /**
   * Check if user can call a specific tool
   */
  canCallTool(extensionId: string, _toolName: string, ctx: AuthContext): boolean {
    // v1: calling any tool from an allowed extension is permitted, so this is
    // exactly the extension-access check. (A v2+ per-tool allowlist would add
    // logic here.)
    return this.canUseExtension(extensionId, ctx);
  },

  /**
   * Filter tools based on user permissions
   */
  filterTools(
    tools: Array<MCPTool & { origin?: string }>,
    ctx: AuthContext,
  ): Array<MCPTool & { origin?: string }> {
    // Standalone: no LP license gate. Admin-only in v1
    if (!ctx.isAdmin) {
      log.warn({ userId: ctx.userId }, "Filtering tools: user not admin");
      return [];
    }

    // Builtin tools (no origin) are always allowed; MCP tools are kept only
    // when their origin extension is a registered mcp_server.
    const filtered = tools.filter(
      (tool) =>
        !tool.origin ||
        extensionRegistryService.getById(tool.origin.replace(/^mcp:/, ""))?.kind === "mcp_server",
    );

    log.debug(
      {
        original: tools.length,
        filtered: filtered.length,
        userId: ctx.userId,
      },
      "Tools filtered",
    );

    return filtered;
  },
};
