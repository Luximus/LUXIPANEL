// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

/**
 * Límites de adjuntos del chat del asistente, alineados con el esquema del
 * gateway LP (`/portal/ssh/assistant`): máximo 4 adjuntos y `dataBase64` de
 * hasta 8M caracteres por archivo (~6MB reales), con un presupuesto total que
 * deja margen bajo el parser de 30mb de LP y el upstream de LUXIPANEL.
 *
 * Se aplican AL ADJUNTAR (picker, portapapeles, conector Office) con aviso
 * visible; antes el exceso viajaba igual y el gateway lo rechazaba (400/413)
 * sin que el usuario viera nada — "el archivo no se enviaba".
 */

import type { ChatAttachment } from "./types";

/** Máximo de adjuntos por turno (esquema zod del gateway LP: `.max(4)`). */
export const MAX_ATTACHMENTS = 4;
/** Máximo de caracteres base64 por adjunto (esquema LP: `.max(8_000_000)`). */
export const MAX_ATTACHMENT_BASE64 = 8_000_000;
/** Presupuesto total de base64 del turno: margen holgado bajo el body de 30mb
 *  (JSON escapa/infla y el historial también viaja en el mismo body). */
export const MAX_TOTAL_ATTACHMENT_BASE64 = 20_000_000;

export type AttachmentRejection = "size" | "count";

/**
 * Fusiona adjuntos nuevos con los ya preparados respetando los límites:
 * descarta los que exceden el tamaño por archivo, corta al llegar al máximo
 * de adjuntos y respeta el presupuesto total. Devuelve la lista resultante y
 * el motivo del PRIMER descarte (para el aviso), o `null` si entró todo.
 */
export function mergeAttachments(
  prev: ChatAttachment[],
  incoming: ChatAttachment[],
): { next: ChatAttachment[]; rejected: AttachmentRejection | null } {
  const next = [...prev];
  let total = prev.reduce((n, a) => n + a.dataBase64.length, 0);
  let rejected: AttachmentRejection | null = null;
  for (const att of incoming) {
    if (att.dataBase64.length > MAX_ATTACHMENT_BASE64) {
      rejected = rejected ?? "size";
      continue;
    }
    if (next.length >= MAX_ATTACHMENTS) {
      rejected = rejected ?? "count";
      continue;
    }
    if (total + att.dataBase64.length > MAX_TOTAL_ATTACHMENT_BASE64) {
      rejected = rejected ?? "size";
      continue;
    }
    next.push(att);
    total += att.dataBase64.length;
  }
  return { next, rejected };
}
