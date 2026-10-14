// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Placeholders de interrupción (reinicio del panel).
 *
 * Tras un reinicio, la recuperación puede escribir en el chat del worker un
 * mensaje `assistant` que NO es una respuesta real sino una nota de
 * interrupción. Los caminos de cierre que toman "el último assistant" como
 * resultado (listener AI_CHAT_FINISHED, reconciliación) marcaban la tarea
 * `done` con ese placeholder → el líder reportaba ÉXITO falso (visto en
 * conversaciones reales de producción).
 */

/**
 * FUENTE ÚNICA de la nota que `agent.controller.ts#recoverConversation` persiste
 * en el chat del worker cuando un CLI job no se pudo recuperar tras un reinicio.
 * El controller (capa superior) la IMPORTA de aquí — así el literal vive en un
 * solo sitio y no puede derivar. (El matcher de `isInterruptionPlaceholder`
 * tolera variaciones que conserven el prefijo "⚠️ La ejecución se interrumpió".)
 */
export const CLI_RECOVERY_INTERRUPTED_TEXT =
  "⚠️ La ejecución se interrumpió por un reinicio del servidor y no se pudo recuperar la salida. Reenvía tu mensaje para continuar.";

/** Error con el que este servicio cierra una tarea interrumpida sin respuesta. */
export const TASK_INTERRUPTED_ERROR =
  "El trabajo se interrumpió (reinicio del panel u otra causa) y no dejó respuesta.";

const INTERRUPTION_PLACEHOLDERS: readonly string[] = [CLI_RECOVERY_INTERRUPTED_TEXT, TASK_INTERRUPTED_ERROR];

/** ¿Es este texto un placeholder de interrupción y no una respuesta real? */
export function isInterruptionPlaceholder(text: string | null | undefined): boolean {
  const t = (text ?? "").trim();
  if (!t) return false;
  return INTERRUPTION_PLACEHOLDERS.includes(t) || t.startsWith("⚠️ La ejecución se interrumpió");
}
