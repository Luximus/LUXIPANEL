/**
 * PUBLIC human-approval routes — capability-token URL opened from the report
 * email; no session. Mounted in `createApp`'s public zone (BEFORE module
 * routers: several of them apply a global `requireAuth` that would otherwise
 * intercept these paths regardless of registration order).
 */

import { Router, type Router as ExpressRouter } from "express";
import { cronApprovalsPublicController } from "../controllers/approvals-public.controller.js";

const router: ExpressRouter = Router();

router.get("/api/cron-approvals/:token", cronApprovalsPublicController.page);
router.post("/api/cron-approvals/:token", cronApprovalsPublicController.decide);

export { router as cronApprovalsPublicRouter };
