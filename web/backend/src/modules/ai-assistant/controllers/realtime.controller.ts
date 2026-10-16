// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { asyncHandler, type SessionUser } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { panelOriginFromRequest } from "../../../shared/http/panel-origin.js";
import { ForbiddenError, ValidationError } from "../../../shared/errors/index.js";
import { realtimeService } from "../services/realtime.service.js";
import { liveVoiceSession } from "../services/realtime-state.js";
import { assistantConfigRepository } from "../repositories/assistant-config.repository.js";

function user(res: Response): SessionUser {
  const u = res.locals.user as SessionUser | undefined;
  if (!u || typeof u.userId !== "number") throw new ForbiddenError("Inicia sesión en el panel.");
  return u;
}
const startSchema = z.object({
  conversationId: z.string().min(1).max(64),
  sdp: z.string().min(10).max(100000).optional(),
  transport: z.enum(["webrtc","pcm"]).optional(),
}).strict().refine(value => value.transport === "pcm" || !!value.sdp);
/** UI disabling is not sufficient: all text entry points share this guard. */
export function rejectTextDuringLiveVoice(req: Request, res: Response, next: NextFunction): void {
  const id = req.body?.conversationId;
  if (typeof id === "string" && liveVoiceSession(id, getExecutor(req).target.id)) {
    res.status(409).json({ ok: false, error: "Termina la sesión de voz para enviar texto." });
    return;
  }
  next();
}
export const realtimeController = {
  capabilities: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const cfg = await assistantConfigRepository.load(executor);
    res.json({ ok: true, enabled: !!cfg.voice.realtimeEnabled && cfg.voice.enabled,
      available: !!cfg.providers.codex.api?.apiKey });
  }),
  conversation: asyncHandler(async (req: Request, res: Response) => {
    res.json({ ok: true, ...await realtimeService.conversation(getExecutor(req), user(res), String(req.params.conversationId)) });
  }),
  start: asyncHandler(async (req: Request, res: Response) => {
    const body = startSchema.safeParse(req.body);
    if (!body.success) throw new ValidationError("Actualiza la conversación e inicia el micrófono.");
    res.json({ ok: true, ...await realtimeService.start(getExecutor(req), user(res), {
      ...body.data, panelOrigin: panelOriginFromRequest(req),
    }) });
  }),
  snapshot: asyncHandler(async (req: Request, res: Response) => {
    const since = Number(req.query.since ?? 0);
    res.json({ ok: true, ...realtimeService.snapshot(String(req.params.id), getExecutor(req), user(res), Number.isFinite(since) ? since : 0) });
  }),
  answer: asyncHandler(async (req: Request, res: Response) => {
    const body = z.object({ taskId: z.string().max(64), askedAt: z.string().max(64), choice: z.number().int().min(0).max(100) }).parse(req.body);
    res.json({ ok: true, ...await realtimeService.answer(String(req.params.id), getExecutor(req), user(res), body.taskId, body.askedAt, body.choice) });
  }),
  stop: asyncHandler(async (req: Request, res: Response) => {
    await realtimeService.stop(String(req.params.id), getExecutor(req), user(res));
    res.json({ ok: true });
  }),
};
