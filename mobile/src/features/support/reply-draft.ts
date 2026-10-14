// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Validación PURA del borrador de respuesta de un ticket (dominio soporte).
 *
 * Extraída de `TicketDetailScreen` para poder testearla y, sobre todo, para que
 * la regla viva en un solo sitio: el host (MainScreen) publica el botón "Enviar"
 * en su barra inferior, así que la pantalla y el controlador tienen que estar de
 * acuerdo en cuándo un borrador es enviable (`useMainTabController.sendTicketReply`
 * aplica la MISMA regla contra su ref fresca).
 *
 * Reglas (espejo del host):
 *  - Con subidas en curso NO se envía (el adjunto llegaría sin URL).
 *  - El texto es obligatorio SOLO si no hay ningún adjunto listo.
 */
export type ReplyDraft = {
  /** Texto del campo de respuesta (sin recortar). */
  content: string;
  /** Adjuntos ya subidos y listos para enviarse. */
  readyAttachments: number;
  /** Hay subidas en curso. */
  hasPendingUploads: boolean;
};

export type ReplyDraftVerdict = "uploads-pending" | "empty" | "ok";

export function validateReplyDraft(draft: ReplyDraft): ReplyDraftVerdict {
  if (draft.hasPendingUploads) return "uploads-pending";
  if (draft.content.trim().length === 0 && draft.readyAttachments <= 0) return "empty";
  return "ok";
}
