// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { VOICE_AUDIO_MIMES } from "../models/chat-attachment.js";
/**
 * AI Assistant — attachment serving + storage manager.
 *
 *   GET    /api/ai/attachments/:id        stream a stored attachment (image/file)
 *   GET    /api/ai/audio/:id              stream a cached TTS audio clip
 *   GET    /api/ai/storage                disk usage (chats + images + audio)
 *   DELETE /api/ai/storage/images         remove all stored attachments
 *   DELETE /api/ai/storage/chats          remove all conversation history
 */

import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor, quoteArg } from "../../../shared/executor/index.js";
import { AppError } from "../../../shared/errors/index.js";
import { ErrorCodes } from "../../../shared/errors/codes.js";
import { apiErrorMessage } from "../../../shared/i18n/errors.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";
import { ONE_DAY_SECONDS } from "../../../shared/constants.js";
import { panelConfigDir } from "@config/paths.js";
import { attachmentsRepository } from "../repositories/attachments.repository.js";
import { audioRepository } from "../repositories/audio.repository.js";
import { conversationsRepository } from "../repositories/conversations.repository.js";

function baseDir(): string {
  return panelConfigDir();
}

function notFound(message: string): AppError {
  return new AppError(message, 404, ErrorCodes.NOT_FOUND);
}

/** Raster image MIME types safe to render `inline` (no scriptable formats). */
const INLINE_IMAGE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/bmp",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

/** Sum bytes of files matching a shell glob; 0 if none/error. */
async function duBytes(executor: { exec: (c: string, o?: { timeoutMs?: number }) => Promise<{ stdout: string }> }, findExpr: string): Promise<number> {
  try {
    const out = await executor.exec(
      `find ${findExpr} -type f -printf '%s\\n' 2>/dev/null | awk '{s+=$1} END {print s+0}'`,
      { timeoutMs: 15_000 },
    );
    return Number((out.stdout ?? "0").trim()) || 0;
  } catch {
    return 0;
  }
}

export const storageController = {
  serve: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const executor = getExecutor(req);
    if (!executor) throw notFound(apiErrorMessage(res.locals.locale, "noExecutor"));
    const rec = await attachmentsRepository.get(executor, id);
    if (!rec || !rec.path) throw notFound(apiModuleMessage(res.locals.locale, "assistantAttachmentNotFound"));
    // IDOR gate: `attachments-index` is a SHARED per-target collection, so an
    // attachment id from another user's chat would otherwise resolve. Require
    // the owning conversation to belong to the context user (same scope check
    // `activeRuns` uses).
    const owned = await conversationsRepository.listIds(executor);
    if (!owned.has(rec.convId)) throw notFound(apiModuleMessage(res.locals.locale, "assistantAttachmentNotFound"));
    const buf = await attachmentsRepository.read(executor, rec);
    // Stored-XSS defense: only raster images and safe audio are inline; everything else
    // (image/svg+xml, text/html, …) is forced to a generic type + downloaded.
    const rawMime = ((rec.mimeType || "").toLowerCase().split(";")[0] ?? "").trim();
    const inlineOk = INLINE_IMAGE_MIME.has(rawMime) || VOICE_AUDIO_MIMES.has(rawMime);
    res.setHeader("Content-Type", inlineOk ? rawMime : "application/octet-stream");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Length", String(buf.length));
    res.setHeader("Cache-Control", `private, max-age=${ONE_DAY_SECONDS}`);
    res.setHeader(
      "Content-Disposition",
      `${inlineOk ? "inline" : "attachment"}; filename="${rec.name.replace(/[^A-Za-z0-9._-]/g, "_")}"`,
    );
    res.end(buf);
  }),

  /** GET /api/ai/audio/:id — stream a cached TTS clip (long-lived: content is
   *  immutable, keyed by an unguessable UUID). */
  serveAudio: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const executor = getExecutor(req);
    if (!executor) throw notFound(apiErrorMessage(res.locals.locale, "noExecutor"));
    const rec = await audioRepository.get(executor, id);
    if (!rec || !rec.path) throw notFound(apiModuleMessage(res.locals.locale, "assistantAudioNotFound"));
    const buf = await audioRepository.read(executor, rec);
    res.setHeader("Content-Type", rec.mimeType || "audio/mpeg");
    res.setHeader("Content-Length", String(buf.length));
    res.setHeader("Accept-Ranges", "none");
    res.setHeader("Cache-Control", "private, max-age=2592000, immutable");
    res.end(buf);
  }),

  usage: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const dir = `${baseDir()}/assistant`;
    const [imagesBytes, chatsBytes, audioBytes] = executor
      ? await Promise.all([
          duBytes(executor, quoteArg(`${dir}/attachments`)),
          duBytes(
            executor,
            `${quoteArg(dir)} -maxdepth 1 \\( -name 'conv-*.json' -o -name 'conversations.json' \\)`,
          ),
          duBytes(executor, quoteArg(`${dir}/audio`)),
        ])
      : [0, 0, 0];
    res.json({
      ok: true,
      imagesBytes,
      chatsBytes,
      audioBytes,
      totalBytes: imagesBytes + chatsBytes + audioBytes,
    });
  }),

  clearImages: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    if (!executor) throw notFound(apiErrorMessage(res.locals.locale, "noExecutor"));
    await attachmentsRepository.clearAll(executor);
    res.json({ ok: true });
  }),

  clearChats: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const removed = await conversationsRepository.clearAll(executor);
    // History rows reference attachments + cached reply audio; drop both so a
    // cleared history leaves no orphaned files behind.
    if (executor) {
      await attachmentsRepository.clearAll(executor).catch(() => undefined);
      await audioRepository.clearAll(executor).catch(() => undefined);
    }
    res.json({ ok: true, removed });
  }),
};
