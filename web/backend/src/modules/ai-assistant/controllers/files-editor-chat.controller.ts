// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Files editor AI bar controller.
 *
 *   POST /api/ai/files/editor-chat
 *
 * Answers a conversational turn about the file open in the Monaco editor and,
 * when the user asked for a change, returns a structured edit the frontend
 * applies to the buffer (undoable, marks dirty — never written to disk here).
 *
 * Response shape is the exact contract (NOT wrapped in {ok,data}):
 *   { reply: string, edit?: { mode:"replaceAll", content } | { mode:"replaceRange", range, content } }
 */

import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { ServiceUnavailableError } from "../../../shared/errors/index.js";
import { assistantConfigRepository } from "../repositories/assistant-config.repository.js";
import { filesEditorChatService } from "../services/files-editor-chat.service.js";
import { editorChatRequestSchema } from "../models/files-editor-chat.types.js";

export const filesEditorChatController = {
  editorChat: asyncHandler(async (req: Request, res: Response) => {
    const body = editorChatRequestSchema.parse(req.body);

    // Per-server config, resolved via the context executor like the rest of the
    // module (fail-closed: no executor → throws upstream).
    const executor = getExecutor(req);
    const config = await assistantConfigRepository.load(executor);
    if (!config.enabled) {
      throw new ServiceUnavailableError("El asistente de IA está deshabilitado en este servidor.");
    }

    const result = await filesEditorChatService.chat(config, body);
    res.json(result);
  }),
};
