// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * MCP Routes — /api/mcp/*
 */

import { Router } from "express";
import { requireAuth } from "../../auth/middlewares/session.middleware.js";
import { requireModule } from "../../auth/middlewares/require-module.middleware.js";
import { csrfProtection } from "../../auth/middlewares/csrf.middleware.js";
import { extensionsController } from "../controllers/extensions.controller.js";

const router = Router();

/**
 * Middleware: Require authentication + admin module for all MCP endpoints
 */
router.use(requireAuth);
router.use(requireModule("admin"));

/**
 * POST /api/mcp/:id/install
 * Install and configure an MCP extension
 * Body: { config: { key: value }, secrets: { password: value } }
 */
router.post("/:id/install", csrfProtection, extensionsController.install);

/**
 * POST /api/mcp/:id/test-connection
 * Test MCP connectivity with current configuration
 */
router.post("/:id/test-connection", csrfProtection, extensionsController.testConnection);

/**
 * POST /api/mcp/:id/uninstall
 * Uninstall MCP and remove configuration. MUST be a state-changing method with
 * CSRF protection — it disables the extension and deletes its encrypted secrets.
 * A GET here was CSRF-able (csrfProtection exempts GET/HEAD/OPTIONS), letting a
 * malicious page trigger the destructive uninstall via a top-level navigation.
 */
router.post("/:id/uninstall", csrfProtection, extensionsController.uninstall);

/**
 * POST /api/mcp/:id/tools
 * List available tools from MCP
 */
router.post("/:id/tools", csrfProtection, extensionsController.listTools);

/**
 * POST /api/mcp/:id/call-tool/:toolName
 * Execute a tool from MCP
 * Body: { arguments: { key: value } }
 */
router.post("/:id/call-tool/:toolName", csrfProtection, extensionsController.callTool);

export default router;
