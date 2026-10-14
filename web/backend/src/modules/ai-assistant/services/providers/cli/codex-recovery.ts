// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

export type CodexFailure = "overloaded" | "missing-session" | "active-writer" | null;

/** Only classify CLI errors, never text quoted by the agent or a tool. */
export function codexFailure(rawLog: string, exitCode: number): CodexFailure {
  let failure = "";
  let sawFailedTurn = false;
  let completedAfterFailure = false;
  for (const line of rawLog.slice(-32_000).split("\n")) {
    try {
      const event = JSON.parse(line) as {
        type?: string;
        message?: string;
        error?: { message?: string; codex_error_info?: string };
      };
      if (event.type === "turn.completed") completedAfterFailure = true;
      if (event.type === "turn.failed" || event.type === "error") {
        sawFailedTurn = true;
        completedAfterFailure = false;
        failure += ` ${event.message ?? ""} ${event.error?.message ?? ""} ${event.error?.codex_error_info ?? ""}`;
      }
    } catch {
      if (/^(?:Selected model is at capacity|(?:\d{4}-\d\d-\d\dT\S+\s+)?ERROR\s+codex_core::session:)/i.test(line.trim())) {
        failure += ` ${line}`;
      }
    }
  }
  if (completedAfterFailure || (exitCode === 0 && !sawFailedTurn)) return null;
  if (/server_overloaded|Selected model is at capacity/i.test(failure)) return "overloaded";
  if (/thread-store conflict: thread\s+[0-9a-f-]{36}\s+already has an active writer/i.test(failure)) return "active-writer";
  if (/thread\s+[0-9a-f-]{36}\s+not found|session\s+[0-9a-f-]{36}\s+not found|No conversation found with session ID/i.test(failure)) return "missing-session";
  return null;
}

export function codexContinuationPrompt(lastUserMessage: string): string {
  return `La ejecución anterior se interrumpió por falta temporal de capacidad del modelo. Continúa la solicitud del usuario tras comprobar el estado actual de archivos, procesos y acciones externas. No repitas acciones que ya se hayan completado. Si algo quedó a medias, termínalo y verifica el resultado.\n\nÚltima solicitud del usuario:\n${lastUserMessage}`;
}
