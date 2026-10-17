// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Gemini (Google generative-language v1beta) API provider.
 *
 * Function-calling loop. Gemini wraps tools in `tools: [{ functionDeclarations }]`
 * and emits `functionCall` parts; results come back as `functionResponse` parts.
 */

import { createModuleLogger } from "../../../../shared/logger/index.js";
import {
  toGeminiTools,
  fromGeminiName,
} from "../../../../shared/agent-capability/index.js";
import type {
  AgentEvent,
  AgentMessage,
  AgentProvider,
  ProviderApiConfig,
  ProviderRunOptions,
} from "./provider.types.js";
import { parseAskToolResult } from "../ask-tool.js";
// B-04/B-05: preamble + tool dispatch shared with the claude/openai providers.
import {
  MAX_TURNS,
  apiErrorExcerpt,
  compressForHistory,
  runToolHandler,
  withApiTimeout,
} from "./api-loop.js";

const log = createModuleLogger("provider-gemini-api");

interface GeminiPart {
  text?: string;
  functionCall?: { id?: string; name: string; args?: Record<string, unknown> };
  functionResponse?: { id?: string; name: string; response: { output: string } };
  inline_data?: { mime_type: string; data: string };
}
interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

export function makeGeminiApiProvider(api: ProviderApiConfig): AgentProvider {
  return {
    id: "gemini",
    mode: "api",
    async ping() {
      if (!api.apiKey) return { ok: false, detail: "API key vacía" };
      if (!api.model)  return { ok: false, detail: "Modelo vacío" };
      return { ok: true, detail: `gemini · ${api.model}` };
    },
    async *run(messages: AgentMessage[], opts: ProviderRunOptions): AsyncGenerator<AgentEvent> {
      if (!api.apiKey) {
        yield { type: "error", message: "API key de Gemini no configurada." };
        return;
      }

      const base = (api.baseUrl ?? "https://generativelanguage.googleapis.com").replace(/\/+$/, "");
      // Key goes in the `x-goog-api-key` header (like Claude/OpenAI), NOT the
      // query string — `?key=` leaks the secret into access logs/proxies.
      const endpoint =
        `${base}/v1beta/models/${encodeURIComponent(api.model)}:generateContent`;

      const contents: GeminiContent[] = messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      // Volatile server snapshot → trailing part on the CURRENT user turn, not
      // in system_instruction: a per-turn snapshot there invalidates Gemini's
      // implicit prefix caching every request (mirrors the claude provider).
      if (opts.systemContext) {
        const lastUserIdx = contents.map((c) => c.role).lastIndexOf("user");
        if (lastUserIdx >= 0) contents[lastUserIdx]!.parts.push({ text: opts.systemContext });
      }

      // Attachments → inline_data parts on the last user content.
      if (opts.attachments?.length) {
        const lastUserIdx = contents.map((c) => c.role).lastIndexOf("user");
        if (lastUserIdx >= 0) {
          for (const a of opts.attachments) {
            contents[lastUserIdx]!.parts.push({ inline_data: { mime_type: a.mimeType, data: a.dataBase64 } });
          }
        }
      }

      const toolsEnvelope = toGeminiTools(opts.tools);

      // Headroom: tool-output tokens removed since the last `usage` emit.
      let pendingHeadroomSaved = 0;
      let completed = false;

      for (let turn = 0; turn < MAX_TURNS; turn++) {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": api.apiKey,
          },
          body: JSON.stringify({
            system_instruction: { role: "system", parts: [{ text: opts.systemPrompt }] },
            contents,
            tools: opts.tools.length > 0 ? [toolsEnvelope] : undefined,
          }),
          signal: withApiTimeout(opts.signal),
        });

        if (!res.ok) {
          const errText = await res.text();
          log.error({ status: res.status, errText }, "Gemini API error");
          yield {
            type: "error",
            message: `Error API Gemini (${res.status}): ${apiErrorExcerpt(errText)}`,
          };
          return;
        }

        const data = (await res.json()) as {
          candidates?: Array<{ content?: GeminiContent; finishReason?: string }>;
          usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
        };
        if (data.usageMetadata) {
          yield {
            type: "usage",
            model: api.model,
            inputTokens: data.usageMetadata.promptTokenCount ?? 0,
            outputTokens: data.usageMetadata.candidatesTokenCount ?? 0,
            headroomSavedTokens: pendingHeadroomSaved,
          };
          pendingHeadroomSaved = 0;
        }
        const candidate = data.candidates?.[0];
        const content = candidate?.content;
        if (!content) {
          yield { type: "error", message: "El proveedor no devolvió una respuesta final." };
          return;
        }
        if (candidate?.finishReason && candidate.finishReason !== "STOP") {
          yield { type: "error", message: "El proveedor interrumpió la respuesta antes de completarla. Revisa el estado antes de repetir cambios." };
          return;
        }

        const functionCalls: Array<{ id: string; apiId?: string; name: string; args: Record<string, unknown> }> = [];

        for (const part of content.parts ?? []) {
          if (part.text) {
            for (const word of part.text.split(/(?<=\s)/)) {
              yield { type: "text", delta: word };
            }
          } else if (part.functionCall) {
            const id = `gem-${turn}-${functionCalls.length}`;
            functionCalls.push({
              id,
              apiId: part.functionCall.id,
              name: part.functionCall.name,
              args: part.functionCall.args ?? {},
            });
          }
        }

        contents.push(content);

        if (functionCalls.length > 0) {
          const responseParts: GeminiPart[] = [];
          for (const call of functionCalls) {
            const realName = fromGeminiName(call.name);
            yield { type: "tool_use", id: call.id, name: realName, input: call.args };

            const outcome = await runToolHandler(opts.tools, realName, call.args, opts);
            const { output, success } = outcome;
            yield { type: "tool_result", id: call.id, success, output };
            if (outcome.unconfirmed) { yield { type: "error", message: outcome.unconfirmed }; return; }

            const compressed = await compressForHistory(outcome, api.model, realName, opts.signal);
            pendingHeadroomSaved += compressed.savedTokens;
            responseParts.push({
              functionResponse: {
                ...(call.apiId ? { id: call.apiId } : {}),
                name: call.name,
                response: { output: compressed.modelOutput },
              },
            });

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
          contents.push({ role: "user", parts: responseParts });
          continue;
        }

        completed = content.parts.some(part => !!part.text?.trim());
        break;
      }

      // Flush terminal-turn Headroom savings (see claude provider for rationale).
      if (pendingHeadroomSaved > 0) {
        yield { type: "usage", model: api.model, inputTokens: 0, outputTokens: 0, headroomSavedTokens: pendingHeadroomSaved };
        pendingHeadroomSaved = 0;
      }

      yield completed ? { type: "done" } : { type: "error", message: "Se alcanzó el límite del turno o no hubo respuesta final. El trabajo sigue sin confirmar; revisa su estado antes de continuar." };
    },
  };
}
