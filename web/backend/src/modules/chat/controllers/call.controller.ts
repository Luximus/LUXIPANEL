// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Audio-call HTTP surface (F3) — a thin adapter over `tolqiaBridge`.
 *
 * Two very different audiences share this file:
 *
 *   • the PANEL routes (`/api/chat/conversations/:id/call`, `/api/chat/calls/*`)
 *     run behind `requireAuth` + CSRF like the rest of the chat API;
 *   • the WEBHOOK route is called by Tolqia itself over loopback, so it has no
 *     session and no CSRF token. Its authentication is the HMAC signature over
 *     the RAW body, which is why it is mounted with `express.raw` BEFORE the
 *     router's `requireAuth`.
 *
 * `CALL_ENABLED=false` makes every route 404 — the feature disappears rather
 * than erroring, so a box without Tolqia looks like a panel that simply has no
 * calls.
 */

import type { Request, Response } from "express";
import { env } from "../../../config/env.js";
import { asyncHandler, type SessionUser } from "../../../shared/types/index.js";
import { getExecutor, type Executor } from "../../../shared/executor/index.js";
import { ForbiddenError, NotFoundError } from "../../../shared/errors/index.js";
import { tolqiaBridge } from "../services/tolqia-bridge.service.js";

function sessionUser(res: Response): SessionUser {
  const user = res.locals.user as SessionUser | undefined;
  if (!user) throw new ForbiddenError("Autenticación requerida");
  return user;
}

function requireExecutor(req: Request): Executor {
  const executor = getExecutor(req);
  if (!executor) throw new NotFoundError("Ningún servidor conectado");
  return executor;
}

/** The feature gate. Disabled ⇒ the route does not exist. */
function assertCallsEnabled(): void {
  if (!env.CALL_ENABLED) throw new NotFoundError("Las llamadas están desactivadas");
}

export const callController = {
  /** POST /api/chat/conversations/:id/call — start, or join a live one. */
  start: asyncHandler(async (req: Request, res: Response) => {
    assertCallsEnabled();
    const user = sessionUser(res);
    const executor = requireExecutor(req);
    const convId = String(req.params.id ?? "");
    const session = await tolqiaBridge.startCall(executor, user.username, convId);
    res.status(session.joined ? 200 : 201).json({ ok: true, data: session });
  }),

  /** GET /api/chat/conversations/:id/call — the live call, or `null`. */
  active: asyncHandler(async (req: Request, res: Response) => {
    assertCallsEnabled();
    const user = sessionUser(res);
    const executor = requireExecutor(req);
    const convId = String(req.params.id ?? "");
    const data = await tolqiaBridge.getActiveCall(executor, user.username, convId);
    res.json({ ok: true, data });
  }),

  /** GET /api/chat/calls/:callId — snapshot of one call. */
  get: asyncHandler(async (req: Request, res: Response) => {
    assertCallsEnabled();
    const user = sessionUser(res);
    const executor = requireExecutor(req);
    const data = await tolqiaBridge.getCall(executor, user.username, String(req.params.callId ?? ""));
    res.json({ ok: true, data });
  }),

  /** POST /api/chat/calls/:callId/accept — mint this user's participant token. */
  accept: asyncHandler(async (req: Request, res: Response) => {
    assertCallsEnabled();
    const user = sessionUser(res);
    const executor = requireExecutor(req);
    const data = await tolqiaBridge.acceptCall(executor, user.username, String(req.params.callId ?? ""));
    res.json({ ok: true, data });
  }),

  /** POST /api/chat/calls/:callId/reject */
  reject: asyncHandler(async (req: Request, res: Response) => {
    assertCallsEnabled();
    const user = sessionUser(res);
    const executor = requireExecutor(req);
    const data = await tolqiaBridge.rejectCall(executor, user.username, String(req.params.callId ?? ""));
    res.json({ ok: true, data });
  }),

  /** POST /api/chat/calls/:callId/end */
  end: asyncHandler(async (req: Request, res: Response) => {
    assertCallsEnabled();
    const user = sessionUser(res);
    const executor = requireExecutor(req);
    const data = await tolqiaBridge.endCall(executor, user.username, String(req.params.callId ?? ""));
    res.json({ ok: true, data });
  }),

  /**
   * POST /api/chat/calls/webhook — Tolqia → panel.
   *
   * The signature covers the exact bytes on the wire, so re-serializing the
   * parsed object would break verification on any key-order or
   * unicode-escaping difference. `req.rawBody` is captured by the app-level
   * `express.json({ verify })`; a `Buffer` body (from `express.raw`) is the
   * fallback for a non-JSON content type.
   */
  webhook: asyncHandler(async (req: Request, res: Response) => {
    assertCallsEnabled();
    const captured = (req as unknown as { rawBody?: string }).rawBody;
    const raw =
      typeof captured === "string"
        ? Buffer.from(captured, "utf8")
        : Buffer.isBuffer(req.body)
          ? req.body
          : Buffer.alloc(0);
    const result = await tolqiaBridge.handleWebhook(raw, req.headers);
    res.json({ ok: true, ...(result.deduped ? { deduped: true } : {}) });
  }),
};
