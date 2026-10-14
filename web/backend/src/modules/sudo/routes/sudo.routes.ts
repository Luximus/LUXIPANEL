// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { Router, type Router as ExpressRouter } from "express";

import { sudoController } from "../controllers/sudo.controller.js";
import { requireAuth } from "../../auth/middlewares/session.middleware.js";
import { requireModule } from "../../auth/middlewares/require-module.middleware.js";
import { csrfProtection } from "../../auth/middlewares/csrf.middleware.js";

const router: ExpressRouter = Router();

router.use("/api/sudo", requireAuth);

router.get("/api/sudo/status", sudoController.status);
// Setting/clearing the per-target sudo credential is a privileged operation:
// it controls the password used for every `sudo` on the connected server.
// Gate behind admin (was previously any authenticated user — even dashboard-only).
router.post("/api/sudo/credential", requireModule("admin"), csrfProtection, sudoController.set);
router.delete("/api/sudo/credential", requireModule("admin"), csrfProtection, sudoController.clear);

export { router as sudoRouter };
