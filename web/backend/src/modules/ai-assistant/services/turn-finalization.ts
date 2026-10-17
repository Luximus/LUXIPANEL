// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { AgentEvent } from "./providers/provider.types.js";
import type { Executor } from "../../../shared/executor/index.js";
import { teamTasksRepository } from "../repositories/team-tasks.repository.js";
import { isTerminalTaskStatus } from "../models/team-task.types.js";

export async function hasUncollectedTeamTasks(executor: Executor | null, conversationId?: string): Promise<boolean> {
  if (!conversationId) return false;
  if (!executor) throw new Error("No se pudo verificar el equipo sin el contexto del servidor.");
  const tasks = await teamTasksRepository.listForLeaderConversation(executor, conversationId);
  return tasks.some(task => !isTerminalTaskStatus(task.status) || (task.status !== "canceled" && !task.collected));
}

/** Keep the last answer provisional until the provider and delegated work settle.
 * Tool activity still streams; this never launches or retries any operation. */
export async function* guardTurnFinalization(
  source: AsyncGenerator<AgentEvent>,
  hasPendingTasks: () => Promise<boolean>,
): AsyncGenerator<AgentEvent> {
  let cliId: string | undefined;
  let text: Extract<AgentEvent, { type: "text" }>[] = [];
  let answer: Extract<AgentEvent, { type: "tool_result" }> | undefined;
  let asked = false;
  let failed = false;
  try {
    for await (const event of source) {
      if (event.type === "text" && !cliId && event.phase !== "commentary") { text.push(event); continue; }
      if (event.type === "tool_use") {
        for (const part of text) yield { ...part, phase: "commentary" };
        text = [];
        if (event.name.endsWith(".cli")) cliId = event.id;
      }
      if (event.type === "tool_result" && event.id === cliId) {
        if (event.success) { answer = event; continue; }
        failed = true;
      }
      if (event.type === "ask") asked = true;
      if (event.type === "done") {
        const pending = !asked && !failed && (event.pending === true || await hasPendingTasks());
        // Pending prose remains evidence in the activity history, not a final.
        for (const part of text) yield { ...part, phase: pending ? "commentary" : "final_answer" };
        text = [];
        if (!pending) {
          if (answer) yield answer;
        } else if (answer) {
          yield { ...answer, output: "[La ejecución sigue pendiente de finalizar o recoger sus resultados.]" };
        }
        yield pending ? { type: "done", pending: true } : event;
        return;
      }
      if (event.type === "error") {
        // Preserve partial output as evidence, with its explicit error outcome.
        for (const part of text) yield { ...part, phase: "commentary" };
        yield event;
        return;
      }
      yield event;
    }
  } catch (err) {
    // A thrown provider/board read must not erase the evidence already received.
    for (const part of text) yield { ...part, phase: "commentary" };
    throw err;
  }
  for (const part of text) yield { ...part, phase: "commentary" };
  // EOF without a terminal event is handled as an interruption by the registry.
}
