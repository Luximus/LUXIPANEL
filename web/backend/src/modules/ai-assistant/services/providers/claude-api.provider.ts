// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Anthropic-compatible API provider — used by:
 *   - claude   (api.anthropic.com/v1/messages)
 *   - minimax  (api.minimax.io/anthropic/v1/messages — MiniMax's *recommended*
 *              integration surface; its models have no native wire format, only
 *              Anthropic- and OpenAI-compatible layers. Both are TEXT-ONLY:
 *              image/document content blocks are rejected upstream.)
 *
 * Agentic loop over `${baseUrl}/v1/messages` with tool_use. Tools come from the
 * capability registry (already filtered by sidecar access) and are mapped
 * to Anthropic's wire format with `.` → `__` name translation.
 */

import { createModuleLogger } from "../../../../shared/logger/index.js";
import {
  toAnthropicTools,
  fromAnthropicName,
} from "../../../../shared/agent-capability/index.js";
import type {
  AgentEvent,
  AgentMessage,
  AgentProvider,
  ProviderApiConfig,
  ProviderRunOptions,
} from "./provider.types.js";
import type { AssistantProviderId } from "../../models/assistant-config.types.js";
import { parseAskToolResult } from "../ask-tool.js";
// B-04/B-05: preamble + tool dispatch shared with the openai/gemini providers.
import {
  MAX_TURNS,
  apiErrorExcerpt,
  compressForHistory,
  runToolHandler,
  withApiTimeout,
} from "./api-loop.js";
import { env } from "../../../../config/env.js";

const log = createModuleLogger("provider-claude-api");

const ANTHROPIC_DEFAULT_BASE_URL = "https://api.anthropic.com";

interface MakeArgs {
  /** Provider id (for logs/telemetry); the wire format is identical. */
  id: AssistantProviderId;
  api: ProviderApiConfig;
  /** Fallback base URL when `api.baseUrl` is unset (MiniMax overrides this). */
  defaultBaseUrl?: string;
}

interface CacheControl {
  type: "ephemeral";
  /** Extended TTL. Omitted = 5-minute default; "1h" needs the beta header. */
  ttl?: "1h";
}
interface AnthropicContentBlock {
  type: "text" | "tool_use" | "tool_result" | "image" | "document";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
  source?: { type: "base64"; media_type: string; data: string };
  cache_control?: CacheControl;
}
interface AnthropicHistoryMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}
/** A `system` text block (the array form, which supports cache_control). */
interface AnthropicSystemBlock {
  type: "text";
  text: string;
  cache_control?: CacheControl;
}

/** 5-minute cache (default). Used on the volatile, per-turn tail. */
const EPHEMERAL: CacheControl = { type: "ephemeral" };
/** 1-hour cache. Used on the STABLE prefix (tools+system) and the prior-turn
 *  history boundary, so multi-turn chats with >5-min think gaps still cache-hit
 *  instead of re-reading the whole prefix at full price. */
const EPHEMERAL_1H: CacheControl = { type: "ephemeral", ttl: "1h" };
/** Beta flag that enables the `ttl: "1h"` cache_control (accepted-and-ignored
 *  once GA, so it's safe to always send on the real Anthropic endpoint). */
const EXTENDED_CACHE_TTL_BETA = "extended-cache-ttl-2025-04-11";

/**
 * Models that accept `output_config.effort` + adaptive thinking. Haiku 4.5 and
 * older Sonnets reject the effort param, so the auto-router only ever pairs
 * effort with Fable 5 / Opus 4.6+ / Opus 5 / Sonnet 5 / Sonnet 4.6 (see
 * PROVIDER_MODEL_TIERS) — gate here too. (Fable 5 accepts `thinking: adaptive`;
 * an explicit `disabled` would 400, but the provider never sends that.)
 */
function claudeSupportsEffort(model: string): boolean {
  return /opus-(?:4-(?:6|7|8)|5(?:-5)?)|sonnet-4-6|sonnet-5|fable-5/i.test(model);
}

/**
 * Return a shallow copy of `messages` with a `cache_control` marker on the LAST
 * content block of the message at `idx`. A string content is wrapped into a
 * single text block (the only form that accepts cache_control). Out-of-range idx
 * or empty content is a no-op. Does not mutate the input.
 */
function markCacheBreakpoint(
  messages: AnthropicHistoryMessage[],
  idx: number,
  cc: CacheControl,
): AnthropicHistoryMessage[] {
  if (idx < 0 || idx >= messages.length) return messages;
  const out = messages.slice();
  const msg = out[idx]!;
  const blocks: AnthropicContentBlock[] =
    typeof msg.content === "string"
      ? [{ type: "text", text: msg.content }]
      : msg.content.slice();
  if (blocks.length === 0) return out;
  blocks[blocks.length - 1] = { ...blocks[blocks.length - 1]!, cache_control: cc };
  out[idx] = { ...msg, content: blocks };
  return out;
}

/**
 * Place the cache breakpoints for a claude request:
 *  - a 1-hour breakpoint at the end of the STABLE prior history (`priorTurnEnd`)
 *    — everything up to (but not including) the current user turn is byte-stable
 *    across future turns, so caching it long lets later turns cache-READ it at
 *    ~0.1× instead of re-billing the whole transcript at 1× every turn. This is
 *    the lever that was previously defeated by the volatile server snapshot
 *    sitting in the `system` block ahead of the history.
 *  - a 5-minute breakpoint on the MOVING last message (grows through the tool
 *    loop; carries this turn's volatile server snapshot, so a long TTL would be
 *    wasted 2× writes that rarely read).
 * Together with the 1-hour breakpoint on the system block this is 3 of the 4
 * allowed breakpoints. `priorTurnEnd` is fixed before the tool loop, so it keeps
 * pointing at the same stable boundary as the loop appends messages.
 */
function applyBreakpoints(
  messages: AnthropicHistoryMessage[],
  priorTurnEnd: number,
): AnthropicHistoryMessage[] {
  if (messages.length === 0) return messages;
  let out = messages;
  if (priorTurnEnd >= 0 && priorTurnEnd < messages.length - 1) {
    out = markCacheBreakpoint(out, priorTurnEnd, EPHEMERAL_1H);
  }
  out = markCacheBreakpoint(out, out.length - 1, EPHEMERAL);
  return out;
}

export function makeClaudeApiProvider(args: MakeArgs): AgentProvider {
  const { id, api } = args;
  const baseUrl = (api.baseUrl ?? args.defaultBaseUrl ?? ANTHROPIC_DEFAULT_BASE_URL).replace(/\/+$/, "");
  const endpoint = `${baseUrl}/v1/messages`;
  return {
    id,
    mode: "api",
    async ping() {
      if (!api.apiKey) return { ok: false, detail: "API key vacía" };
      if (!api.model)  return { ok: false, detail: "Modelo vacío" };
      return { ok: true, detail: `${id} · ${api.model}` };
    },
    async *run(messages: AgentMessage[], opts: ProviderRunOptions): AsyncGenerator<AgentEvent> {
      if (!api.apiKey) {
        yield { type: "error", message: `API key de ${id} no configurada.` };
        return;
      }

      // Prompt caching is the real Anthropic endpoint only (MiniMax's
      // Anthropic-compat layer rejects `cache_control` + the array `system`).
      const supportsCache = id === "claude";

      // Deterministic tool order: tools render at prefix position 0, so any
      // reorder would invalidate the entire cache between turns.
      const tools = toAnthropicTools(opts.tools);
      if (supportsCache) tools.sort((a, b) => a.name.localeCompare(b.name));

      // System: STABLE base only, in a 1-hour cached block (the breakpoint caches
      // tools+system). The volatile server snapshot is NOT placed here — it used
      // to sit in a second `system` block after this one, but any `system` change
      // invalidates the whole message cache, so a snapshot that changes every turn
      // silently defeated cross-turn history caching. It is now injected as a
      // TRAILING block on the current user turn (below), leaving the
      // tools+system+prior-history prefix byte-stable across turns. Other
      // endpoints (MiniMax) get the plain concatenated string, no cache_control.
      const systemField: string | AnthropicSystemBlock[] = supportsCache
        ? [{ type: "text", text: opts.systemPrompt, cache_control: EPHEMERAL_1H }]
        : opts.systemContext
          ? `${opts.systemPrompt}\n\n${opts.systemContext}`
          : opts.systemPrompt;

      const history: AnthropicHistoryMessage[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Attachments → image/document blocks on the last user message.
      if (opts.attachments?.length) {
        const lastUserIdx = history.map((m) => m.role).lastIndexOf("user");
        if (lastUserIdx >= 0) {
          const blocks: AnthropicContentBlock[] = [];
          const txt = history[lastUserIdx]!.content;
          if (typeof txt === "string" && txt) blocks.push({ type: "text", text: txt });
          for (const a of opts.attachments) {
            if (a.mimeType === "application/pdf") {
              blocks.push({ type: "document", source: { type: "base64", media_type: a.mimeType, data: a.dataBase64 } });
            } else if (a.mimeType.startsWith("image/")) {
              blocks.push({ type: "image", source: { type: "base64", media_type: a.mimeType, data: a.dataBase64 } });
            }
          }
          history[lastUserIdx] = { role: "user", content: blocks };
        }
      }

      // Inject the volatile server snapshot as a TRAILING text block on the
      // current user turn (claude only). Placing it after the history — instead
      // of in the `system` field ahead of it — keeps the tools+system+prior-
      // history prefix byte-stable, so the prior history actually cache-hits
      // across turns. The model still sees the snapshot, now nearest the query.
      // It is not persisted, so prior turns stay clean on the next request.
      if (supportsCache && opts.systemContext) {
        const idx = history.map((m) => m.role).lastIndexOf("user");
        if (idx >= 0) {
          const msg = history[idx]!;
          const blocks: AnthropicContentBlock[] =
            typeof msg.content === "string"
              ? msg.content
                ? [{ type: "text", text: msg.content }]
                : []
              : msg.content.slice();
          blocks.push({ type: "text", text: opts.systemContext });
          history[idx] = { role: "user", content: blocks };
        }
      }

      // Stable cross-turn boundary: everything before the current user turn is
      // byte-identical on future requests, so cache it with the long TTL. Fixed
      // before the tool loop; the loop only appends, so the index stays valid.
      const priorTurnEnd = history.length - 2;

      // Auto-router effort → adaptive thinking + output_config.effort, but ONLY
      // on the real Anthropic endpoint with an effort-capable model (MiniMax's
      // compat layer and Haiku reject these fields).
      const effortBody =
        id === "claude" && opts.effort && claudeSupportsEffort(api.model)
          ? {
              thinking: { type: "adaptive" as const },
              output_config: { effort: opts.effort },
            }
          : {};

      // Headroom: tool-output tokens removed since the last `usage` emit. Attached
      // to the next usage event (incremental) so the recorder can sum savings.
      let pendingHeadroomSaved = 0;
      let completed = false;

      for (let turn = 0; turn < MAX_TURNS; turn++) {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": api.apiKey,
            "anthropic-version": "2023-06-01",
            // 1-hour prompt-cache TTL (accepted-and-ignored once GA). claude only.
            ...(supportsCache ? { "anthropic-beta": EXTENDED_CACHE_TTL_BETA } : {}),
          },
          body: JSON.stringify({
            model: api.model,
            max_tokens: env.ASSISTANT_API_MAX_TOKENS,
            system: systemField,
            tools,
            messages: supportsCache ? applyBreakpoints(history, priorTurnEnd) : history,
            ...effortBody,
          }),
          signal: withApiTimeout(opts.signal),
        });

        if (!res.ok) {
          const errText = await res.text();
          log.error({ status: res.status, errText }, "Anthropic API error");
          yield {
            type: "error",
            message: `Error de API (${res.status}): ${apiErrorExcerpt(errText)}`,
          };
          return;
        }

        const data = (await res.json()) as {
          stop_reason: string;
          content: AnthropicContentBlock[];
          usage?: {
            input_tokens?: number;
            output_tokens?: number;
            cache_read_input_tokens?: number;
            cache_creation_input_tokens?: number;
          };
        };

        if (data.usage) {
          // `input_tokens` is the UNCACHED remainder; cache reads bill at ~0.1×
          // and cache writes at ~1.25×. Log them so the saving is verifiable.
          if (supportsCache) {
            log.info(
              {
                model: api.model,
                input: data.usage.input_tokens ?? 0,
                cacheRead: data.usage.cache_read_input_tokens ?? 0,
                cacheWrite: data.usage.cache_creation_input_tokens ?? 0,
              },
              "claude api usage (prompt cache)",
            );
          }
          yield {
            type: "usage",
            model: api.model,
            inputTokens: data.usage.input_tokens ?? 0,
            outputTokens: data.usage.output_tokens ?? 0,
            headroomSavedTokens: pendingHeadroomSaved,
          };
          pendingHeadroomSaved = 0;
        }

        if (data.stop_reason && !["end_turn", "tool_use", "stop_sequence"].includes(data.stop_reason)) {
          yield { type: "error", message: "El proveedor interrumpió la respuesta antes de completarla. Revisa el estado antes de repetir cambios." };
          return;
        }
        const toolUses: AnthropicContentBlock[] = [];
        const toolResults: AnthropicContentBlock[] = [];

        for (const block of data.content) {
          if (block.type === "text" && block.text) {
            for (const word of block.text.split(/(?<=\s)/)) {
              yield { type: "text", delta: word };
            }
          } else if (block.type === "tool_use" && block.id && block.name) {
            const realName = fromAnthropicName(block.name);
            const input = (block.input ?? {}) as Record<string, unknown>;
            yield { type: "tool_use", id: block.id, name: realName, input };
            toolUses.push(block);

            const outcome = await runToolHandler(opts.tools, realName, input, opts);
            const { output, success } = outcome;
            yield { type: "tool_result", id: block.id, success, output };
            if (outcome.unconfirmed) { yield { type: "error", message: outcome.unconfirmed }; return; }

            const compressed = await compressForHistory(outcome, api.model, realName, opts.signal);
            const modelOutput = compressed.modelOutput;
            pendingHeadroomSaved += compressed.savedTokens;

            // Ask protocol: a successful lxp_ask result carries the sentinel
            // marker. Emit the `ask` event and END the run — no further turns.
            if (outcome.isAsk && success) {
              const ask = parseAskToolResult(output);
              if (ask) {
                yield { type: "ask", id: block.id, questions: ask.questions, ...(ask.kind ? { kind: ask.kind } : {}) };
                yield { type: "done" };
                return;
              }
            }

            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: modelOutput,
            });
          }
        }

        history.push({ role: "assistant", content: data.content });

        if (toolUses.length > 0 && toolResults.length > 0) {
          history.push({ role: "user", content: toolResults });
          continue;
        }
        completed = data.content.some(block => block.type === "text" && !!block.text?.trim());
        break;
      }

      // Flush any Headroom savings from the terminal turn: if compression ran on
      // the last allowed turn and the loop exited via MAX_TURNS, no further usage
      // event would carry it. Emit a residual one so /stats/savings stays exact.
      if (pendingHeadroomSaved > 0) {
        yield { type: "usage", model: api.model, inputTokens: 0, outputTokens: 0, headroomSavedTokens: pendingHeadroomSaved };
        pendingHeadroomSaved = 0;
      }

      yield completed ? { type: "done" } : { type: "error", message: "Se alcanzó el límite del turno o no hubo respuesta final. El trabajo sigue sin confirmar; revisa su estado antes de continuar." };
    },
  };
}
