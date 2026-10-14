// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Terminal HTTP routes.
 *
 * WebSocket endpoint (/api/terminal/ws) is NOT registered here —
 * it is attached directly to the HTTP server in index.ts via a
 * separate WebSocket server listening for upgrade events.
 *
 * These routes handle the admin management surface (list/close sessions).
 */

import { Router, type Router as ExpressRouter } from "express";
import { requireAuth } from "../../auth/middlewares/session.middleware.js";
import { requireActionPermission } from "../../auth/middlewares/require-permission.middleware.js";
import { conversationsController } from "../controllers/conversations.controller.js";
import { sessionsController } from "../controllers/sessions.controller.js";
import { snippetsController } from "../controllers/snippets.controller.js";
import { tmuxController } from "../controllers/tmux.controller.js";
import { requireTerminalAccess, requireTerminalOwnerIdentity } from "../middlewares/require-terminal-access.js";
import { preferencesController } from "../controllers/preferences.controller.js";

const router: ExpressRouter = Router();

// Terminal is gated by the per-group `terminal.view` permission (NOT admin),
// scoped to /api/terminal so it never blocks fall-through to other modules.
// Per-route handlers below further require terminal.open / terminal.manage.
// Admins pass via the terminal.* wildcard in their permission matrix.
router.use("/api/terminal", requireAuth, requireTerminalAccess, requireActionPermission("terminal.view"));
router.get("/api/terminal/preferences", preferencesController.get);
router.patch("/api/terminal/preferences", preferencesController.patch);

/** List active terminal sessions */
router.get("/api/terminal/sessions", requireActionPermission("terminal.manage"), sessionsController.list);

/** Force-close a session */
router.delete("/api/terminal/sessions/:sessionId", requireActionPermission("terminal.manage"), sessionsController.close);

/** Conversation history from Codex and Claude */
router.get("/api/terminal/conversations", requireTerminalOwnerIdentity, requireActionPermission("terminal.manage"), conversationsController.list);
router.delete("/api/terminal/conversations", requireTerminalOwnerIdentity, requireActionPermission("terminal.manage"), conversationsController.delete);

/** tmux preflight: estado en el servidor objetivo + instalación guiada
 *  (el terminal usa tmux para persistir/re-adjuntar la sesión tras un corte). */
router.get("/api/terminal/tmux-status", requireActionPermission("terminal.open"), tmuxController.status);
router.post("/api/terminal/tmux-install", requireActionPermission("terminal.open"), tmuxController.install);

/** Snippet state */
router.get("/api/terminal/snippets", requireActionPermission("terminal.open"), snippetsController.list);

/** Snippet categories */
router.post("/api/terminal/snippets/categories", requireActionPermission("terminal.open"), snippetsController.createCategory);
router.patch("/api/terminal/snippets/categories/:id", requireActionPermission("terminal.open"), snippetsController.updateCategory);
router.delete("/api/terminal/snippets/categories/:id", requireActionPermission("terminal.open"), snippetsController.deleteCategory);

/** Snippet tags */
router.post("/api/terminal/snippets/tags", requireActionPermission("terminal.open"), snippetsController.createTag);
router.patch("/api/terminal/snippets/tags/:id", requireActionPermission("terminal.open"), snippetsController.updateTag);
router.delete("/api/terminal/snippets/tags/:id", requireActionPermission("terminal.open"), snippetsController.deleteTag);

/** Snippets */
// Bulk-import (folder → snippets). Declared before the `:id` routes so the
// literal `/import` segment is never shadowed by a param match.
router.post("/api/terminal/snippets/import", requireActionPermission("terminal.open"), snippetsController.importSnippets);
router.post("/api/terminal/snippets", requireActionPermission("terminal.open"), snippetsController.createSnippet);
router.patch("/api/terminal/snippets/:id", requireActionPermission("terminal.open"), snippetsController.updateSnippet);
router.delete("/api/terminal/snippets/:id", requireActionPermission("terminal.open"), snippetsController.deleteSnippet);

export { router as terminalRouter };
