// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Usage-ledger recorder shared by every run path (live chat, backgrounded
 * drain, team workers). Extracted from turn-queue.service so team-tasks can
 * attach it to worker runs without importing the turn pipeline (ciclo:
 * turn-queue importa teamTasksService). Hoja: solo usageRepository + tipos.
 */

import type { Executor } from "../../../shared/executor/index.js";
import { usageRepository } from "../repositories/usage.repository.js";
import type { AgentEvent } from "./providers/provider.types.js";

/** The `cliHolder` flips true on the `.cli` tool_use / estimated usage so the
 *  persisted assistant turn re-renders in the terminal box. */
export function makeUsageRecorder(ctx: {
  executor: Executor | null;
  provider?: string;
  conversationId: string | null;
  projectId?: string | null;
  userId?: string | null;
  cliHolder: { value: boolean };
  /** Accumulates total tokens spent on the turn so the persisted assistant
   *  message can carry it (the live bubble shows the same sum). */
  tokensHolder?: { input: number; output: number; estimated: boolean };
}): (event: AgentEvent) => void {
  return (event: AgentEvent) => {
    if (event.type === "tool_use" && event.name.endsWith(".cli")) ctx.cliHolder.value = true;
    if (event.type !== "usage") return;
    if (event.model.endsWith("-cli") || event.estimated) ctx.cliHolder.value = true;
    if (ctx.tokensHolder) {
      ctx.tokensHolder.input += event.inputTokens;
      ctx.tokensHolder.output += event.outputTokens;
      if (event.estimated) ctx.tokensHolder.estimated = true;
    }
    void usageRepository.record(
      {
        ts: new Date().toISOString(),
        provider: ctx.provider ?? "claude",
        mode: event.model.endsWith("-cli") || event.estimated ? "cli" : "api",
        model: event.model,
        inputTokens: event.inputTokens,
        outputTokens: event.outputTokens,
        estimated: Boolean(event.estimated),
        headroomSavedTokens: event.headroomSavedTokens,
        conversationId: ctx.conversationId ?? null,
        projectId: ctx.projectId ?? null,
        userId: ctx.userId != null ? String(ctx.userId) : null,
      },
      ctx.executor,
    );
  };
}
