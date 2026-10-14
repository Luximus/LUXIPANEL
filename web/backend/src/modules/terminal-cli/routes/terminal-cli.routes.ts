// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { Router, type Router as ExpressRouter } from "express";
import { requireAuth } from "../../auth/middlewares/session.middleware.js";
import { requireModule } from "../../auth/middlewares/require-module.middleware.js";
import {
  requireActionPermission,
  requireViewPermission,
} from "../../auth/middlewares/require-permission.middleware.js";
import { terminalCliController } from "../controllers/terminal-cli.controller.js";
import { requireTerminalAccess, requireTerminalOwnerIdentity } from "../../terminal/middlewares/require-terminal-access.js";

const router: ExpressRouter = Router();

// All guards MUST be path-scoped to `/api/terminal-cli`. This router is mounted
// at `/`, so an unscoped `router.use(mw)` runs `mw` for EVERY later-mounted
// module (mcp, notifications, chat, jobs, …) → those users get spurious 403s.
router.use(
  "/api/terminal-cli",
  requireAuth,
  requireTerminalAccess,
  requireTerminalOwnerIdentity,
  requireModule("admin"),
  requireViewPermission("panel.settings"),
  requireActionPermission("terminal.view"),
);

router.get(
  "/api/terminal-cli/state",
  requireActionPermission("terminal.open"),
  terminalCliController.getState,
);

router.get(
  "/api/terminal-cli/probe",
  requireActionPermission("terminal.open"),
  terminalCliController.probe,
);

router.post(
  "/api/terminal-cli/installed",
  requireActionPermission("terminal.manage"),
  terminalCliController.setInstalled,
);

router.post(
  "/api/terminal-cli/active",
  requireActionPermission("terminal.manage"),
  terminalCliController.setActive,
);

router.post(
  "/api/terminal-cli/onboarding/complete",
  requireActionPermission("terminal.manage"),
  terminalCliController.completeOnboarding,
);

router.post(
  "/api/terminal-cli/onboarding/skip",
  requireActionPermission("terminal.manage"),
  terminalCliController.skipOnboarding,
);

export { router as terminalCliRouter };
