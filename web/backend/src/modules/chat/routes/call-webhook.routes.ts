// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Tolqia's inbound webhook — a PUBLIC router, mounted in `app.ts` BEFORE every
 * module router.
 *
 * ## Why it is mounted early
 * Its signed public request must reach the webhook handler before the chat
 * router's session gate on /api/chat. Like cron approvals and webhook ingest,
 * it uses its own credential rather than a panel session.
 *
 * ## Its authentication
 * There is no session and no CSRF token: the caller is the Tolqia service over
 * loopback. The credential is the HMAC-SHA256 signature over the RAW body
 * (`X-Tolqia-Signature`), checked with `timingSafeEqual` inside a ±300 s window
 * before the JSON is ever parsed. `express.raw` is mounted here so a non-JSON
 * content type still reaches the handler with its exact bytes; for
 * `application/json` the app-level `express.json({ verify })` has already
 * stashed them in `req.rawBody`.
 */

import { Router, raw, type Router as ExpressRouter } from "express";
import { callController } from "../controllers/call.controller.js";

const router: ExpressRouter = Router();

router.post(
  "/api/chat/calls/webhook",
  // 256 KiB caps a hostile body long before the HMAC runs. A real payload (a
  // RoomView plus a participant list) is a couple of KiB.
  raw({ type: "*/*", limit: "256kb" }),
  callController.webhook,
);

export { router as chatCallsPublicRouter };
