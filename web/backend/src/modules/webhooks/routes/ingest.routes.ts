// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * PUBLIC ingest routes for receive-data gateway webhooks. No session: a gateway
 * authenticates inbound calls with its own api-key/IP rules. Mounted in
 * `createApp`'s public zone (BEFORE module routers that apply a global
 * `requireAuth`), mirroring cron-approvals-public.routes.
 *
 * Accepts any HTTP method so callers can POST/GET/PUT exactly like Make.com's
 * custom webhook.
 */

import { Router, type Router as ExpressRouter } from "express";
import { ingestController } from "../controllers/ingest.controller.js";

const router: ExpressRouter = Router();

router.all("/api/hooks/in/:token", ingestController.receive);

export { router as webhookIngestPublicRouter };
