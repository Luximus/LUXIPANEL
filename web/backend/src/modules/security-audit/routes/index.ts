// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { Router, type Router as ExpressRouter } from "express";
import { auditController } from "../controllers/audit.controller.js";
import { requireAuth } from "../../auth/middlewares/session.middleware.js";
import { csrfProtection } from "../../auth/middlewares/csrf.middleware.js";
import { requireModule } from "../../auth/middlewares/require-module.middleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);
// Security audit is part of the Firewall feature set in UI flows.
// Guard with firewall access to avoid 404 when "security-audit"
// is not present as an independent module entry.
router.use(requireModule("firewall"));

router.post("/start", csrfProtection, auditController.start);
router.get("/scanners", auditController.scannersStatus);
// Installing a scanner runs privileged (sudo) package installs — and for
// BitNinja `sudo bash <remote script>`. That is root-equivalent execution, so
// gate it on admin (parity with modules/sudo), not merely firewall access.
router.post("/scanners/:name/install", requireModule("admin"), csrfProtection, auditController.installScanner);
router.get("/reports", auditController.listReports);
router.get("/report/:id", auditController.getReport);

export { router as securityAuditRouter };
