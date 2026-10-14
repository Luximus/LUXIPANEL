// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** GPT-6 agent loop. GPT-6 reasoning plus function calls require Responses. */

import { createModuleLogger } from "../../../../shared/logger/index.js";
import { toOpenAiTools, fromOpenAiName } from "../../../../shared/agent-capability/index.js";
import type { AgentEvent, AgentMessage, AgentProvider, ProviderApiConfig, ProviderRunOptions } from "./provider.types.js";
import { parseAskToolResult } from "../ask-tool.js";
import { MAX_TURNS, apiErrorExcerpt, compressForHistory, runToolHandler, withApiTimeout } from "./api-loop.js";

const log = createModuleLogger("provider-codex-responses");

interface ResponseItem {
  type: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  content?: string | Array<{ type: string; text?: string; image_url?: string }>;
  [key: string]: unknown;
}

export function makeOpenAiResponsesProvider(api: ProviderApiConfig): AgentProvider {
  const baseUrl = (api.baseUrl ?? "https://api.openai.com").replace(/\/+$/, "");
  return {
    id: "codex",
    mode: "api",
    async ping() {
      if (!api.apiKey) return { ok: false, detail: "API key vacía" };
      if (!api.model) return { ok: false, detail: "Modelo vacío" };
      return { ok: true, detail: `codex · ${api.model}` };
    },
    async *run(messages: AgentMessage[], opts: ProviderRunOptions): AsyncGenerator<AgentEvent> {
      if (!api.apiKey) {
        yield { type: "error", message: "API key de codex no configurada." };
        return;
      }

      const input: ResponseItem[] = [
        { type: "message", role: "system", content: opts.systemPrompt },
        ...messages.map((m) => ({ type: "message", role: m.role, content: m.content })),
      ];
      const lastUserIdx = input.map((m) => m.role).lastIndexOf("user");
      if (lastUserIdx >= 0) {
        const current = input[lastUserIdx]!;
        const currentText = `${typeof current.content === "string" ? current.content : ""}${opts.systemContext ? `\n\n${opts.systemContext}` : ""}`;
        const images = (opts.attachments ?? []).filter((a) => a.mimeType.startsWith("image/"));
        current.content = images.length
          ? [
              { type: "input_text", text: currentText },
              ...images.map((a) => ({ type: "input_image", image_url: `data:${a.mimeType};base64,${a.dataBase64}` })),
            ]
          : currentText;
      }

      // Responses uses flat function definitions, unlike Chat Completions.
      const tools = toOpenAiTools(opts.tools).map((t) => ({ type: "function", ...t.function }));
      let pendingHeadroomSaved = 0;

      for (let turn = 0; turn < MAX_TURNS; turn++) {
        const res = await fetch(`${baseUrl}/v1/responses`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${api.apiKey}` },
          body: JSON.stringify({
            model: api.model,
            store: false,
            input,
            tools: tools.length ? tools : undefined,
            reasoning: opts.effort ? { effort: opts.effort } : undefined,
          }),
          signal: withApiTimeout(opts.signal),
        });
        if (!res.ok) {
          const errText = await res.text();
          log.error({ status: res.status, errText }, "OpenAI Responses API error");
          yield { type: "error", message: `Error API codex (${res.status}): ${apiErrorExcerpt(errText)}` };
          return;
        }

        const data = (await res.json()) as {
          output?: ResponseItem[];
          usage?: { input_tokens?: number; output_tokens?: number };
        };
        if (data.usage) {
          yield {
            type: "usage", model: api.model,
            inputTokens: data.usage.input_tokens ?? 0,
            outputTokens: data.usage.output_tokens ?? 0,
            headroomSavedTokens: pendingHeadroomSaved,
          };
          pendingHeadroomSaved = 0;
        }

        const output = data.output ?? [];
        // Replay all output items, including encrypted reasoning, for a stateless
        // continuation after tool results. OpenAI does not store the response.
        input.push(...output);
        const calls: ResponseItem[] = [];
        for (const item of output) {
          if (item.type === "function_call") calls.push(item);
          if (item.type === "message") {
            for (const part of Array.isArray(item.content) ? item.content : []) {
              if (part.type === "output_text" && part.text) {
                for (const word of part.text.split(/(?<=\s)/)) yield { type: "text", delta: word };
              }
            }
          }
        }
        if (!calls.length) break;

        for (const call of calls) {
          if (!call.call_id || !call.name) {
            yield { type: "error", message: "Respuesta de herramienta OpenAI sin call_id o nombre." };
            return;
          }
          const realName = fromOpenAiName(call.name);
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(call.arguments ?? "{}") as Record<string, unknown>; } catch { /* empty */ }
          yield { type: "tool_use", id: call.call_id, name: realName, input: args };
          const outcome = await runToolHandler(opts.tools, realName, args, opts);
          yield { type: "tool_result", id: call.call_id, success: outcome.success, output: outcome.output };
          const compressed = await compressForHistory(outcome, api.model, realName, opts.signal);
          pendingHeadroomSaved += compressed.savedTokens;
          input.push({ type: "function_call_output", call_id: call.call_id, output: compressed.modelOutput });
          if (outcome.isAsk && outcome.success) {
            const ask = parseAskToolResult(outcome.output);
            if (ask) {
              yield { type: "ask", id: call.call_id, questions: ask.questions, ...(ask.kind ? { kind: ask.kind } : {}) };
              yield { type: "done" };
              return;
            }
          }
        }
      }

      if (pendingHeadroomSaved > 0) {
        yield { type: "usage", model: api.model, inputTokens: 0, outputTokens: 0, headroomSavedTokens: pendingHeadroomSaved };
      }
      yield { type: "done" };
    },
  };
}
