// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { Router, type Router as ExpressRouter, type RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import { ForbiddenError } from "../../../shared/errors/index.js";
import { requireAuth } from "../../auth/middlewares/session.middleware.js";
import { csrfProtection } from "../../auth/middlewares/csrf.middleware.js";
import { clientIpKey } from "../../auth/middlewares/rate-limiter.middleware.js";
import { chatController } from "../controllers/chat.controller.js";
import { callController } from "../controllers/call.controller.js";
import { tolqiaController } from "../controllers/tolqia.controller.js";
import type { SessionUser } from "../../../shared/types/index.js";
import { apiErrorMessage } from "../../../shared/i18n/errors.js";

const router: ExpressRouter = Router();

// Tolqia's signed webhook lives in call-webhook.routes.ts, mounted early in
// app.ts before session authentication for the other /api/chat paths.

// Internal chat is available to EVERY authenticated panel user (peer feature);
// there is intentionally no module/permission gate.
router.use("/api/chat", requireAuth);

/**
 * Starting a call is expensive downstream (a room + a token + a push fan-out),
 * so it is capped per USER — the panel is commonly reached through one shared
 * egress IP, where an IP bucket would punish the whole office for one user.
 * `clientIpKey` is the fallback for the (impossible here) session-less case.
 */
const callStartRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => {
    const user = (req as { res?: { locals?: { user?: SessionUser } } }).res?.locals?.user;
    return user?.username ? `u:${user.username}` : clientIpKey(req);
  },
  handler: (_req, res) => res.status(429).json({ ok: false, error: apiErrorMessage(res.locals.locale, "rateLimit"), code: "RATE_LIMIT" }),
});

// Read-side -----------------------------------------------------------------
router.get("/api/chat/stream", chatController.stream);
router.get("/api/chat/conversations", chatController.listConversations);
router.get("/api/chat/conversations/:id/messages", chatController.listMessages);
router.get("/api/chat/unread-count", chatController.unreadCount);
router.get("/api/chat/directory", chatController.directory);
router.get(
  "/api/chat/conversations/:id/messages/:messageId/transcript",
  chatController.callTranscript,
);
router.get("/api/chat/conversations/:id/attachments", chatController.listAttachments);
router.get("/api/chat/me/profile", chatController.getMyProfile);
router.get("/api/chat/attachments/:id", chatController.serveAttachment);

// Write-side — CSRF protected like the rest of the panel API.
router.put("/api/chat/me/profile", csrfProtection, chatController.updateMyProfile);
router.post("/api/chat/conversations", csrfProtection, chatController.createConversation);
router.post("/api/chat/conversations/:id/messages", csrfProtection, chatController.sendMessage);
router.post("/api/chat/conversations/:id/read", csrfProtection, chatController.markRead);
router.patch("/api/chat/conversations/:id/messages/:messageId", csrfProtection, chatController.editMessage);
router.delete("/api/chat/conversations/:id/messages/:messageId", csrfProtection, chatController.deleteMessage);

// F3 — audio calls. `GET`s are plain reads; every mutation is CSRF-protected
// like the rest of the panel API. All of them 404 when `CALL_ENABLED=false`.
router.get("/api/chat/conversations/:id/call", callController.active);
router.get("/api/chat/calls/:callId", callController.get);
router.post(
  "/api/chat/conversations/:id/call",
  csrfProtection,
  callStartRateLimiter,
  callController.start,
);
router.post("/api/chat/calls/:callId/accept", csrfProtection, callController.accept);
router.post("/api/chat/calls/:callId/reject", csrfProtection, callController.reject);
router.post("/api/chat/calls/:callId/end", csrfProtection, callController.end);

/**
 * Enlace con la cuenta de tolqia.com (token de API `tq_live_…`).
 *
 * El token es una credencial de FACTURACIÓN de todo el servidor: leerlo,
 * guardarlo, borrarlo o probarlo es admin-only, como el resto de tarjetas de
 * Ajustes → Credenciales. `plan` NO: cualquier usuario autenticado necesita
 * saber si su servidor tiene traducción disponible (y no expone token alguno).
 */
const requireAdmin: RequestHandler = (_req, res, next) => {
  if ((res.locals.user as { kind?: string } | undefined)?.kind !== "admin") {
    next(new ForbiddenError("Solo un administrador puede gestionar el token de Tolqia"));
    return;
  }
  next();
};

router.get("/api/chat/tolqia/plan", tolqiaController.plan);
router.get("/api/chat/tolqia/config", requireAdmin, tolqiaController.getConfig);
router.put("/api/chat/tolqia/config", csrfProtection, requireAdmin, tolqiaController.setConfig);
router.delete("/api/chat/tolqia/config", csrfProtection, requireAdmin, tolqiaController.clearConfig);
router.post("/api/chat/tolqia/test", csrfProtection, requireAdmin, tolqiaController.test);

export { router as chatRouter };
