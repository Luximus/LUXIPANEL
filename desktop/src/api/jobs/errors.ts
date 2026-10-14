/**
 * Jobs Marketplace — mapeo de errores a clave i18n `jobs.*`.
 * Extraído de `src/api/jobs.ts` (fachada); los consumidores importan `../api/jobs`.
 */

// ── Mapeo de errores a clave i18n ─────────────────────────────────────────────
// `request` aplana el error del backend a `Error(message)` SIN status, así que
// mapeamos por substring del mensaje (en MAYÚSCULAS), espejo de `errorMessage`
// de portal-jobs.ts. Devuelve la clave bajo el namespace `jobs.*` que la UI
// resuelve con `t()`.

/** Convierte el `Error` lanzado por `request` en una clave i18n `jobs.*`. */
export function jobsErrorKey(err: unknown): string {
  const m = (err instanceof Error ? err.message : String(err ?? "")).toUpperCase();
  // Eje MB/datos (metering IA) agotado vs. eje TOKENS del escrow (§F).
  if (m.includes("DIAMOND") || m.includes("SALDO") || m.includes("BALANCE")) return "ai.noBalance";
  // 402 escrow (tokens insuficientes).
  if (m.includes("INSUFFICIENT") && m.includes("TOKEN")) return "error.insufficientTokens";
  // Gate de moderación (§C): el requerimiento no es apto / falta moderar.
  if (m.includes("MODERAT") || m.includes("MODERA")) return "ai.notModerated";
  if (m.includes("CANCELL")) return "error.notCancellable";
  if (m.includes("OFFER") && m.includes("ACTIVE")) return "error.offerActive";
  // Fase 4: el canal aún no tiene contraparte (sin profesional asignado).
  if (m.includes("NO_ASSIGNEE") || m.includes("ASSIGNEE")) return "channel.notAssignedYet";
  // Fase 4: nunca se comparte material de llave por el canal (§E).
  if (m.includes("KEY_MATERIAL") || m.includes("MATERIAL")) return "grants.keyForbidden";
  // Adjunto demasiado grande (413).
  if (m.includes("TOO_LARGE") || m.includes("TOO LARGE") || m.includes("413") || m.includes("ENTITY")) {
    return "channel.attachTooLarge";
  }
  // Fase 11: gate de elegibilidad y 1-intento del test técnico.
  if (m.includes("JOB_TEST_REQUIRED")) return "test.gateRequired";
  if (m.includes("JOB_TEST_ATTEMPT_EXISTS") || m.includes("JOB_TEST_ATTEMPT_DONE")) return "test.attemptExists";
  if (m.includes("JOB_TEST_NOT_GENERATED")) return "test.notGenerated";
  if (m.includes("JOB_TEST_INVALID")) return "test.invalid";
  return "error.generic";
}
