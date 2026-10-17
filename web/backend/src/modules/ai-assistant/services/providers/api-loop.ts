// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Shared machinery of the three API providers' agentic loop (B-04 / B-05).
 *
 * `claude-api`, `openai-api` and `gemini-api` each carried their own copy of
 * the preamble (`MAX_TURNS`, `API_CALL_TIMEOUT_MS`, `withApiTimeout`) and of
 * the tool-dispatch block (resolve in `opts.tools`, try/catch, JSON-stringify
 * the output, Headroom-compress the copy that re-enters history, detect the
 * `ask` protocol). Only the WIRE shape of the message pushed back into history
 * genuinely differs between them (`tool_result` block / `role:"tool"` message /
 * `functionResponse` part), so that part stays in each provider.
 *
 * The dispatch is deliberately split in TWO steps — `runToolHandler()` then
 * `compressForHistory()` — because the providers must `yield` the
 * `tool_result` event to the UI BEFORE awaiting Headroom: merging them would
 * delay every tool result on screen by one compression round-trip.
 */

import type { AgentTool } from "../../../../shared/agent-capability/index.js";
import { env } from "../../../../config/env.js";
import { headroomClient } from "../headroom-client.service.js";
import { isAskToolName } from "../ask-tool.js";
import { agentRunRegistry } from "../agent-run-registry.js";
import { permissionBroker } from "../permission-broker.js";
import type { ProviderRunOptions } from "./provider.types.js";

/** Hard ceiling on model↔tool round-trips within a single run. */
export const MAX_TURNS = 15;

/**
 * Per-request hang guard for the (non-streaming) completion call. `opts.signal`
 * only fires on an explicit stop, so a connection the API accepts but never
 * answers would otherwise pin a turn-queue slot and keep the SSE open forever.
 * Generous enough not to abort a legitimate long completion.
 */
export const API_CALL_TIMEOUT_MS = env.ASSISTANT_API_TIMEOUT_MS;

/** Combine the caller's abort signal with the per-request timeout. */
export function withApiTimeout(signal?: AbortSignal): AbortSignal {
  const t = AbortSignal.timeout(API_CALL_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, t]) : t;
}

/**
 * Body excerpt for a non-2xx API response. Capped at 200 chars: upstream error
 * bodies can be enormous and this string goes into an SSE `error` event AND the
 * log line.
 */
export function apiErrorExcerpt(errText: string): string {
  return errText.slice(0, 200);
}

export interface ToolCallOutcome {
  /** Raw output — this is what the UI's `tool_result` event must carry. */
  output: string;
  success: boolean;
  /** True when the resolved tool is the `lxp_ask` protocol tool. */
  isAsk: boolean;
  /** A failed operation may have applied changes. End this loop without retry. */
  unconfirmed?: string;
}

/**
 * Run ONE tool call against the run's own tool set.
 *
 * Dispatch goes through `tools` (= `opts.tools`), NOT the capability registry:
 * it is the already-narrowed allowlist AND it carries the run-scoped tools
 * (`lxp_ask`, `agents.delegate`, `chats.create`, `team.*`) that do not live in
 * the registry at all. Resolving through the registry silently broke every
 * run-scoped tool with "Tool no permitida o desconocida" (found in the
 * team-delegation E2E).
 *
 * Never throws: a handler error becomes `{ success: false, output: message }`.
 */
export async function runToolHandler(
  tools: AgentTool[],
  name: string,
  input: Record<string, unknown>,
  opts?: Pick<ProviderRunOptions, "approvalMode" | "conversationId">,
): Promise<ToolCallOutcome> {
  const toolObj = tools.find((t) => t.name === name);
  const isAsk = isAskToolName(name) && Boolean(toolObj);
  let output = "";
  let success = false;
  let unconfirmed: string | undefined;
  try {
    if (!toolObj) {
      output = `Tool no permitida o desconocida: ${name}`;
    } else {
      const approval = opts?.conversationId ? agentRunRegistry.getApproval(opts.conversationId) : null;
      const mode = opts?.approvalMode ?? approval?.mode ?? "manual";
      const mutating = toolObj.kind === "action" || toolObj.dangerous === true;
      if (mutating && mode === "plan") {
        return { output: "El modo Plan no permite ejecutar cambios.", success: false, isAsk };
      }
      // modules.execute applies its own per-operation approval after resolving
      // the actual module tool. Asking here too would show two prompts.
      if (mutating && mode === "manual" && name !== "modules.execute" && !approval?.autoApprove.has(name)) {
        if (!opts?.conversationId) return { output: "Esta acción requiere una conversación activa para aprobarla.", success: false, isAsk };
        const decision = await permissionBroker.request({
          conversationId: opts.conversationId,
          tool: name,
          title: toolObj.title,
        });
        if (decision !== "allow") return { output: "Acción denegada.", success: false, isAsk };
      }
      const r = await toolObj.handler(input);
      success = r.ok;
      if (!r.ok && r.output && typeof r.output === "object" && "operationStatus" in r.output && r.output.operationStatus === "unconfirmed") {
        const detail = r.output as Record<string, unknown>;
        unconfirmed = [detail.message, detail.nextStep].filter(value => typeof value === "string").join(" ") ||
          "No se pudo confirmar el resultado de la operación. Comprueba su estado antes de repetir cambios.";
      }
      output =
        typeof r.output === "string"
          ? r.output
          // Compact on purpose: pretty-printing inflates large JSON
          // tool_results ~10-25% and they re-enter context every turn.
          : JSON.stringify(r.output);
    }
  } catch (err) {
    output = (err as Error).message;
  }
  return { output, success, isAsk, ...(unconfirmed ? { unconfirmed } : {}) };
}

export interface CompressedToolOutput {
  /** Copy of the output that enters the model history (possibly shrunk). */
  modelOutput: string;
  /** Tokens Headroom saved; add to the run's `pendingHeadroomSaved`. */
  savedTokens: number;
}

/**
 * Shrink a large structured tool output before it enters the history (which is
 * re-sent every turn). Deterministic → cache-stable. FAIL-OPEN: any problem
 * keeps the original. The user-facing `tool_result` event already streamed the
 * FULL output; only the copy the model re-reads is compressed.
 */
export async function compressForHistory(
  outcome: ToolCallOutcome,
  model: string,
  toolName: string,
  signal?: AbortSignal,
): Promise<CompressedToolOutput> {
  if (!outcome.success || !outcome.output) {
    return { modelOutput: outcome.output, savedTokens: 0 };
  }
  const hr = await headroomClient.compressToolOutput(outcome.output, model, toolName, { signal });
  return hr
    ? { modelOutput: hr.output, savedTokens: hr.savedTokens }
    : { modelOutput: outcome.output, savedTokens: 0 };
}
