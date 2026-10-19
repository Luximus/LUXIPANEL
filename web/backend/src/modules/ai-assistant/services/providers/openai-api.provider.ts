// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * OpenAI-compatible API provider — used by:
 *   - codex   (api.openai.com/v1/chat/completions)
 *   - deepseek (api.deepseek.com/v1/chat/completions)
 *   - grok    (api.x.ai/v1/chat/completions)
 *
 * Function-calling loop. Tool names are mapped `.` → `__` and back. The
 * caller supplies the base URL + provider id so logs/telemetry stay clean.
 */

import { createModuleLogger } from "../../../../shared/logger/index.js";
import {
  toOpenAiTools,
  fromOpenAiName,
} from "../../../../shared/agent-capability/index.js";
import type {
  AgentEvent,
  AgentMessage,
  AgentProvider,
  ProviderApiConfig,
  ProviderRunOptions,
} from "./provider.types.js";
import { parseAskToolResult } from "../ask-tool.js";
// B-04/B-05: preamble + tool dispatch shared with the claude/gemini providers.
import {
  MAX_TURNS,
  apiErrorExcerpt,
  compressForHistory,
  runToolHandler,
  withApiTimeout,
} from "./api-loop.js";

/**
 * Which (provider, model) accepts the OpenAI-style `reasoning_effort` param.
 * Only reasoning models take it: OpenAI GPT-5 and xAI Grok-4. GPT-6 uses the
 * Responses provider. GPT-4.1 rejects
 * it, and DeepSeek-reasoner reasons by default with no effort knob — so the
 * auto-router's effort is simply ignored for those.
 */
function supportsReasoningEffort(id: "codex" | "deepseek" | "grok", model: string): boolean {
  if (id === "codex") return /gpt-5/i.test(model);
  if (id === "grok") return /grok-4/i.test(model);
  return false;
}

type OpenAiContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

interface OpenAiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | OpenAiContentPart[] | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

interface MakeArgs {
  id: "codex" | "deepseek" | "grok";
  api: ProviderApiConfig;
  defaultBaseUrl: string;
}

export function makeOpenAiCompatibleProvider(args: MakeArgs): AgentProvider {
  const log = createModuleLogger(`provider-${args.id}-api`);
  const baseUrl = (args.api.baseUrl ?? args.defaultBaseUrl).replace(/\/+$/, "");
  const endpoint = `${baseUrl}/v1/chat/completions`;

  return {
    id: args.id,
    mode: "api",
    async ping() {
      if (!args.api.apiKey) return { ok: false, detail: "API key vacía" };
      if (!args.api.model)  return { ok: false, detail: "Modelo vacío" };
      return { ok: true, detail: `${args.id} · ${args.api.model}` };
    },
    async *run(messages: AgentMessage[], opts: ProviderRunOptions): AsyncGenerator<AgentEvent> {
      if (!args.api.apiKey) {
        yield { type: "error", message: `API key de ${args.id} no configurada.` };
        return;
      }

      const tools = toOpenAiTools(opts.tools);
      // System = STABLE prompt only. The volatile server snapshot changes every
      // turn; placed in the system message it invalidated OpenAI's automatic
      // prefix caching on the whole request. It is appended to the CURRENT user
      // turn instead (below), mirroring the claude provider — the prefix
      // (system + prior history) stays byte-stable and cache-hits across turns.
      const history: OpenAiMessage[] = [
        { role: "system", content: opts.systemPrompt },
        ...messages.map((m): OpenAiMessage => ({ role: m.role, content: m.content })),
      ];
      if (opts.systemContext) {
        const idx = history.map((m) => m.role).lastIndexOf("user");
        if (idx >= 0) {
          const prev = history[idx]!.content;
          if (typeof prev === "string") {
            history[idx] = { role: "user", content: prev ? `${prev}\n\n${opts.systemContext}` : opts.systemContext };
          }
        } else {
          // No user turn to anchor to (shouldn't happen) — keep old behavior.
          history[0] = { role: "system", content: `${opts.systemPrompt}\n\n${opts.systemContext}` };
        }
      }

      // Attachments → image_url parts on the last user message (images only).
      const images = (opts.attachments ?? []).filter((a) => a.mimeType.startsWith("image/"));
      if (images.length) {
        const lastUserIdx = history.map((m) => m.role).lastIndexOf("user");
        if (lastUserIdx >= 0) {
          const txt = history[lastUserIdx]!.content;
          const parts: OpenAiContentPart[] = [];
          if (typeof txt === "string" && txt) parts.push({ type: "text", text: txt });
          for (const a of images) {
            parts.push({ type: "image_url", image_url: { url: `data:${a.mimeType};base64,${a.dataBase64}` } });
          }
          history[lastUserIdx] = { role: "user", content: parts };
        }
      }

      // Auto-router effort → `reasoning_effort` on reasoning models only.
      // Grok 4.7 accepts xhigh; older models stay capped at high.
      const reasoningEffort =
        opts.effort && supportsReasoningEffort(args.id, args.api.model)
          ? opts.effort === "xhigh" && !/grok-4\.7/i.test(args.api.model)
            ? "high"
            : opts.effort
          : undefined;

      // Headroom: tool-output tokens removed since the last `usage` emit.
      let pendingHeadroomSaved = 0;
      let completed = false;

      for (let turn = 0; turn < MAX_TURNS; turn++) {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${args.api.apiKey}`,
          },
          body: JSON.stringify({
            model: args.api.model,
            tools: tools.length > 0 ? tools : undefined,
            messages: history,
            ...(args.id === "codex" && opts.speed ? { service_tier: opts.speed === "fast" ? "fast" : "default" } : {}),
            ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
          }),
          signal: withApiTimeout(opts.signal),
        });

        if (!res.ok) {
          const errText = await res.text();
          log.error({ status: res.status, errText }, `${args.id} API error`);
          yield {
            type: "error",
            message: `Error API ${args.id} (${res.status}): ${apiErrorExcerpt(errText)}`,
          };
          return;
        }

        const data = (await res.json()) as {
          choices: Array<{ finish_reason: string; message: OpenAiMessage }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        if (data.usage) {
          yield {
            type: "usage",
            model: args.api.model,
            inputTokens: data.usage.prompt_tokens ?? 0,
            outputTokens: data.usage.completion_tokens ?? 0,
            headroomSavedTokens: pendingHeadroomSaved,
          };
          pendingHeadroomSaved = 0;
        }
        const msg = data.choices[0]?.message;
        if (!msg) {
          yield { type: "error", message: "El proveedor no devolvió una respuesta final." };
          return;
        }
        const finish = data.choices[0]?.finish_reason;
        if (finish && finish !== "stop" && finish !== "tool_calls") {
          yield { type: "error", message: "El proveedor interrumpió la respuesta antes de completarla. Revisa el estado antes de repetir cambios." };
          return;
        }

        if (typeof msg.content === "string" && msg.content) {
          for (const word of msg.content.split(/(?<=\s)/)) {
            yield { type: "text", delta: word };
          }
        }

        if (msg.tool_calls && msg.tool_calls.length > 0) {
          history.push(msg);
          for (const call of msg.tool_calls) {
            const realName = fromOpenAiName(call.function.name);
            let input: Record<string, unknown> = {};
            try {
              input = JSON.parse(call.function.arguments) as Record<string, unknown>;
            } catch {
              /* keep empty */
            }
            yield { type: "tool_use", id: call.id, name: realName, input };

            const outcome = await runToolHandler(opts.tools, realName, input, opts);
            const { output, success } = outcome;
            yield { type: "tool_result", id: call.id, success, output };
            if (outcome.unconfirmed) { yield { type: "error", message: outcome.unconfirmed }; return; }

            const compressed = await compressForHistory(outcome, args.api.model, realName, opts.signal);
            pendingHeadroomSaved += compressed.savedTokens;
            history.push({ role: "tool", content: compressed.modelOutput, tool_call_id: call.id });

            // Ask protocol: emit the `ask` event and END the run.
            if (outcome.isAsk && success) {
              const ask = parseAskToolResult(output);
              if (ask) {
                yield { type: "ask", id: call.id, questions: ask.questions, ...(ask.kind ? { kind: ask.kind } : {}) };
                yield { type: "done" };
                return;
              }
            }
          }
          continue;
        }

        completed = typeof msg.content === "string" && !!msg.content.trim();
        break;
      }

      // Flush terminal-turn Headroom savings (see claude provider for rationale).
      if (pendingHeadroomSaved > 0) {
        yield { type: "usage", model: args.api.model, inputTokens: 0, outputTokens: 0, headroomSavedTokens: pendingHeadroomSaved };
        pendingHeadroomSaved = 0;
      }

      yield completed ? { type: "done" } : { type: "error", message: "Se alcanzó el límite del turno o no hubo respuesta final. El trabajo sigue sin confirmar; revisa su estado antes de continuar." };
    },
  };
}
