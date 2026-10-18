// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { resourceGuardFailure } from "../../../../../shared/resource-guard.js";

/** Report only observed outcomes; missing status is not a SIGKILL or an OOM. */
export function cliFailureMessage(output: string, exitCode: number): string {
  const resourceFailure = resourceGuardFailure(output);
  if (resourceFailure) return resourceFailure;
  if (exitCode === -1) return "La ejecución del asistente se interrumpió sin dejar un resultado final. El trabajo puede estar incompleto; revisa los cambios antes de continuar.";
  if (output.includes('"code":"CLI_IDLE_TIMEOUT"')) return "La ejecución se interrumpió tras 60 minutos sin actividad. El trabajo no está confirmado como completo.";
  if (exitCode === 137) return "El proceso del asistente fue terminado de forma forzada. El trabajo puede estar incompleto; revisa los cambios antes de continuar.";
  // Inspect provider error frames, not quoted prompts or tool output. An
  // expired login is unrelated to server connectivity or MCP permissions.
  for (const line of output.split("\n")) {
    try {
      const event = JSON.parse(line);
      if (event.type === "turn.failed" && event.error?.code === "CLI_NO_FINAL_RESPONSE") {
        return "El agente terminó sin una respuesta final verificable. Revisa el detalle de la ejecución antes de reintentar; el resultado de la tarea sigue sin confirmar.";
      }
      if ((event.type === "assistant" && event.error === "authentication_failed") ||
          (event.type === "result" && event.is_error === true &&
           /Failed to authenticate|OAuth session expired/i.test([event.result, ...(Array.isArray(event.errors) ? event.errors : [])].join(" ")))) {
        return "El proveedor rechazó la autenticación del asistente. Vuelve a conectar su cuenta en Proveedores y revisa el estado de la tarea antes de reintentar.";
      }
    } catch { /* Non-JSON terminal lines are not provider error frames. */ }
  }
  return `La ejecución CLI no terminó correctamente (${exitCode === 0 ? "sin respuesta final verificable" : `salida ${exitCode}`}). El trabajo puede haber quedado incompleto.`;
}
