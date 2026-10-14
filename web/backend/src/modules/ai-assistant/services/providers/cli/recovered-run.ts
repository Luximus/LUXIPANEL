// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Recovery generator — re-attach to a CLI background job that is STILL on the
 * target after the panel process restarted. The `nohup`'d CLI survived; our
 * in-memory tracker + run did not. Re-registers the job with the CURRENT
 * executor, re-streams its log from the start, and emits the SAME terminal
 * events a fresh run would.
 */

import { cliJobTracker } from "../../cli-job-tracker.service.js";
import { extractAskRequest, stripAskBlock } from "../../ask-protocol.js";
import { ANSI_RE } from "./shell.js";
import { CLI_SPECS } from "./cli-specs.js";
import type { Executor } from "../../../../../shared/executor/index.js";
import type { AgentEvent } from "../provider.types.js";
import type { AssistantProviderId } from "../../../models/assistant-config.types.js";

/**
 * Recovery generator — re-attach to a CLI background job that is STILL on the
 * target after the panel process restarted. The `nohup`'d CLI survived; our
 * in-memory tracker + run did not. This re-registers the job in the tracker with
 * the CURRENT executor (the original SSH connection died with the old process),
 * re-streams its log from the start, and emits the SAME terminal events a fresh
 * run would — so the run registry's `onComplete` persists the answer and drains
 * the queue exactly as if nothing had been interrupted.
 *
 * It does NOT relaunch the CLI and runs NO tool: it only reads the existing
 * log/exit files, so it needs no per-user tool gating. The caller MUST have
 * confirmed (via `cliJobsRepository`) that a descriptor exists and the artifacts
 * are still on the target.
 */
export async function* makeRecoveredCliGen(
  executor: Executor,
  conversationId: string,
  desc: {
    jobId: string;
    logFile: string;
    exitFile: string;
    provider: AssistantProviderId;
    serverName: string;
    pid?: string;
    model?: string;
    startedAt: number;
  },
): AsyncGenerator<AgentEvent> {
  const spec = CLI_SPECS[desc.provider];

  // Re-register with byteOffset reset to 0 so the WHOLE log re-streams to a
  // reopened client; preserve the original startedAt for the runtime budget.
  const job = cliJobTracker.start({
    jobId: desc.jobId,
    logFile: desc.logFile,
    exitFile: desc.exitFile,
    executor,
    serverName: desc.serverName,
    pid: desc.pid,
    conversationId,
    provider: desc.provider,
    notificationCtx: { title: `Tarea IA completada en ${desc.serverName}`, link: "/panel/assistant" },
    transform: spec?.makeTransform?.(),
    startedAt: desc.startedAt,
  });

  // tool_use → the bubble renders the CLI terminal again (and the run registry /
  // usage recorder mark this as a CLI answer). Same shape as a fresh launch.
  yield { type: "tool_use", id: desc.jobId, name: `${desc.provider}.cli`, input: { jobId: desc.jobId, pid: desc.pid, startedAt: desc.startedAt, recovered: true } };
  yield { type: "text", delta: `\x1b[2m(reanudando ejecución en curso tras reinicio del panel)\x1b[0m\r\n` };

  cliJobTracker.setActiveStream(desc.jobId, true);

  let wakeFn: (() => void) | null = null;
  let jobDone = false;
  let jobExitCode = 0;
  const queue: string[] = [];
  const unsubOutput = cliJobTracker.subscribeOutput(desc.jobId, (chunk) => { queue.push(chunk); wakeFn?.(); wakeFn = null; });
  const unsubDone = cliJobTracker.subscribeDone(desc.jobId, (_, code) => { jobDone = true; jobExitCode = code; wakeFn?.(); wakeFn = null; });
  const waitNext = (): Promise<void> => new Promise<void>((res) => { wakeFn = res; });

  try {
    while (true) {
      while (queue.length > 0) yield { type: "text", delta: queue.shift()! };
      if (jobDone) break;
      await waitNext();
    }
  } finally {
    unsubOutput();
    unsubDone();
    cliJobTracker.setActiveStream(desc.jobId, false);
  }

  const accumulated = job.accumulated;
  const finalAnswer = jobExitCode === 0 ? spec?.parseFinalAnswer?.(accumulated) ?? "" : "";
  const success = jobExitCode === 0 && (desc.provider !== "codex" || !!finalAnswer.trim());
  const failureMessage = accumulated.includes('"code":"CLI_IDLE_TIMEOUT"')
    ? "La ejecución se interrumpió tras 60 minutos sin actividad. El trabajo no está confirmado como completo."
    : `La ejecución CLI no terminó correctamente (${jobExitCode === 0 ? "sin respuesta final verificable" : `salida ${jobExitCode}`}). El trabajo puede haber quedado incompleto.`;
  const askSource = spec?.parseFinalAnswer ? finalAnswer : accumulated.replace(ANSI_RE, "");
  const ask = success ? extractAskRequest(askSource) : null;
  const cleanAnswer = ask ? stripAskBlock(finalAnswer) : finalAnswer;

  yield {
    type: "tool_result",
    id: desc.jobId,
    success,
    output: success ? cleanAnswer : failureMessage,
  };

  if (ask) {
    yield { type: "ask", id: desc.jobId, questions: ask.questions, ...(ask.kind ? { kind: ask.kind } : {}) };
  }

  const realUsage = spec?.parseUsage?.(accumulated) ?? null;
  yield realUsage
    ? {
        type: "usage",
        model: desc.model ?? `${desc.provider}-cli`,
        inputTokens: realUsage.inputTokens,
        outputTokens: realUsage.outputTokens,
        estimated: false,
      }
    : {
        type: "usage",
        model: desc.model ?? `${desc.provider}-cli`,
        inputTokens: 0,
        outputTokens: Math.ceil(accumulated.length / 4),
        estimated: true,
      };

  yield success ? { type: "done" } : { type: "error", message: failureMessage };
}
