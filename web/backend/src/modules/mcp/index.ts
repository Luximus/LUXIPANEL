// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { setMcpToolsProvider } from "../../shared/module-state/mcp-tools.js";
import { mcpConnectionService } from "./services/mcp-connection.service.js";
import { registerModuleOperations } from "../../shared/module-operations/registry.js";
/**
 * MCP Module — External MCP server integration
 *
 * Provides endpoints for:
 * - Installing and configuring MCP servers
 * - Testing connectivity
 * - Listing and executing tools
 * - Auditing tool usage
 */

import type { Express } from "express";
import mcpRoutes from "./routes/mcp.routes.js";

/**
 * Register MCP module with Express
 */
export function registerMCPModule(app: Express): void {
  setMcpToolsProvider(() => mcpConnectionService.refreshConnectedTools());
  app.use("/api/mcp", mcpRoutes);
  for (const id of ["filesystem-mcp", "github-mcp"]) registerModuleOperations(id, mcpRoutes, { prefix: "/api/mcp", fixedParams: { id } });
  registerModuleOperations("admin", mcpRoutes, { prefix: "/api/mcp" });
}
