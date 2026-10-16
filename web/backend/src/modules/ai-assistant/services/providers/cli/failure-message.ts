// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

/** Report only observed outcomes; missing status is not a SIGKILL or an OOM. */
export function cliFailureMessage(output: string, exitCode: number): string {
  if (exitCode === -1) return "La ejecución del asistente se interrumpió sin dejar un resultado final. El trabajo puede estar incompleto; revisa los cambios antes de continuar.";
  if (output.includes('"code":"CLI_IDLE_TIMEOUT"')) return "La ejecución se interrumpió tras 60 minutos sin actividad. El trabajo no está confirmado como completo.";
  if (exitCode === 137) return "El proceso del asistente fue terminado de forma forzada. El trabajo puede estar incompleto; revisa los cambios antes de continuar.";
  return `La ejecución CLI no terminó correctamente (${exitCode === 0 ? "sin respuesta final verificable" : `salida ${exitCode}`}). El trabajo puede haber quedado incompleto.`;
}
