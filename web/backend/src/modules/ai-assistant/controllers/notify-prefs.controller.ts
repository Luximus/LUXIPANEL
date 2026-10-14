// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Assistant notification preferences on the connected server.
 *
 * v1: a single toggle — whether finishing a chat pushes a notification to the
 * owner's devices (web/app/desktop). Stored on the same server as the chat.
 * Default = enabled when unset.
 */

import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import {
  CHAT_FINISHED_PREF_KEY,
  isChatFinishedPushEnabled,
} from "../../server-alerts/services/chat-finished-push.service.js";
import { settingsRepository } from "../../admin/repositories/settings.repository.js";

export const notifyPrefsController = {
  /** GET /api/ai/notify-prefs → { chatFinished: boolean }. */
  get: asyncHandler(async (req: Request, res: Response) => {
    const chatFinished = await isChatFinishedPushEnabled(getExecutor(req));
    res.json({ ok: true, chatFinished });
  }),

  /** PUT /api/ai/notify-prefs { chatFinished: boolean }. */
  set: asyncHandler(async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as { chatFinished?: unknown };
    const enabled = body.chatFinished === true || body.chatFinished === "true";
    await settingsRepository.set(
        CHAT_FINISHED_PREF_KEY,
        String(enabled),
        "notifications",
        "Avisar en mis dispositivos (web/app/desktop) cuando un chat del asistente termina",
        getExecutor(req),
    );
    res.json({ ok: true, chatFinished: enabled });
  }),
};
