// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { z } from "zod";

export const VOICE_AUDIO_MIMES = new Set([
  "audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/aac",
]);

/** Voice recordings are history media; the agent receives their transcript. */
export const chatAttachmentSchema = z.object({
  name: z.string().max(256),
  mimeType: z.string().max(128),
  dataBase64: z.string().max(15_000_000),
  voice: z.object({ transcript: z.string().trim().min(1).max(100_000) }).optional(),
}).refine(a => !a.voice || VOICE_AUDIO_MIMES.has(a.mimeType.split(";")[0]!.trim().toLowerCase()), {
  message: "La grabación debe tener un formato de audio compatible.",
});

export type ChatAttachment = z.infer<typeof chatAttachmentSchema>;

/** Exclude original recordings from every model/CLI attachment pipeline. */
export function modelAttachments(attachments?: ChatAttachment[]): ChatAttachment[] | undefined {
  return attachments?.filter(a => !a.voice);
}
