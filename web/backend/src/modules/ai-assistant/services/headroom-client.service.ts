// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Headroom client — talks to the panel-host token-compression proxy
 * (headroom-ai) listening on loopback. Used by the API providers to shrink
 * large TOOL OUTPUTS (command output / JSON / logs) before they are sent to the
 * model inside the agentic loop.
 *
 * INVARIANTS:
 *  - INSTANCE state, NOT per-server: this is a loopback HTTP call to the panel
 *    host, so it takes NO Executor and is safe to call from any request scope.
 *  - EVERY method is FAIL-OPEN: on disabled / unhealthy / timeout / any error it
 *    returns null (or false), NEVER throws. Callers fall back to the original
 *    output, so the assistant keeps working if the proxy is down.
 *  - Only STRUCTURED tool outputs benefit (SmartCrusher reformats JSON/logs into
 *    a compact deterministic table). The same input always yields the same
 *    output, so compressing a tool_result once keeps claude's prompt-cache
 *    prefix stable across the tool loop.
 */
import { env } from "../../../config/env.js";
import { createModuleLogger } from "../../../shared/logger/index.js";

const log = createModuleLogger("headroom-client");

const HEALTH_TTL_MS = 30_000;
let health = { healthy: false, checkedAt: 0 };

function authHeaders(): Record<string, string> {
  return env.HEADROOM_API_KEY ? { authorization: `Bearer ${env.HEADROOM_API_KEY}` } : {};
}

/** AbortSignal that fires on the run's signal OR the headroom timeout. */
function timeoutSignal(signal?: AbortSignal): AbortSignal {
  const t = AbortSignal.timeout(env.HEADROOM_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, t]) : t;
}

/** Cheap token estimate (chars/4) — matches the rest of the module's heuristic. */
function estTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

export const headroomClient = {
  /** Synchronous gate for the hot path: never touches the network. Refreshes the
   *  cached health in the background when stale so the next call is accurate. */
  isReady(): boolean {
    if (!env.HEADROOM_ENABLED) return false;
    const fresh = Date.now() - health.checkedAt < HEALTH_TTL_MS;
    if (!fresh) void headroomClient.ping();
    return health.healthy && fresh;
  },

  /** GET /health → { status: "healthy" }. Updates the cached flag. */
  async ping(): Promise<boolean> {
    if (!env.HEADROOM_ENABLED) {
      health = { healthy: false, checkedAt: Date.now() };
      return false;
    }
    try {
      const res = await fetch(`${env.HEADROOM_BASE_URL}/health`, {
        signal: AbortSignal.timeout(env.HEADROOM_TIMEOUT_MS),
      });
      const ok = res.ok && ((await res.json().catch(() => ({})))?.status === "healthy");
      health = { healthy: Boolean(ok), checkedAt: Date.now() };
      return health.healthy;
    } catch {
      health = { healthy: false, checkedAt: Date.now() };
      return false;
    }
  },

  /**
   * Compress a single tool output via POST /v1/compress.
   * Returns { output, savedTokens } when compression actually helped, else null
   * (fail-open → caller keeps the original). Small outputs (< HEADROOM_MIN_TOKENS)
   * are skipped without a network call.
   */
  async compressToolOutput(
    output: string,
    model: string,
    toolName: string,
    opts: { signal?: AbortSignal } = {},
  ): Promise<{ output: string; savedTokens: number } | null> {
    if (!output || estTokens(output) < env.HEADROOM_MIN_TOKENS) return null;
    if (!headroomClient.isReady()) return null;
    try {
      // Headroom's structural compressors only fire on tool-result messages, so
      // wrap the output as a minimal OpenAI tool turn. The wrapper's other
      // messages are tiny; tokens_saved ≈ the tool output's saving.
      const messages = [
        { role: "user", content: `tool ${toolName}` },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            { id: "hr1", type: "function", function: { name: toolName, arguments: "{}" } },
          ],
        },
        { role: "tool", tool_call_id: "hr1", content: output },
      ];
      const res = await fetch(`${env.HEADROOM_BASE_URL}/v1/compress`, {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ model, messages }),
        signal: timeoutSignal(opts.signal),
      });
      if (!res.ok) return null;
      const d = (await res.json()) as {
        messages?: Array<{ role?: string; content?: unknown }>;
        tokens_saved?: number;
      };
      const toolMsg = Array.isArray(d.messages)
        ? d.messages.find((m) => m.role === "tool")
        : undefined;
      const compressed = typeof toolMsg?.content === "string" ? toolMsg.content : null;
      // Only adopt it if it's genuinely shorter; SmartCrusher is a no-op on
      // already-compact / unstructured content.
      if (compressed == null || compressed.length >= output.length) return null;
      const savedTokens =
        typeof d.tokens_saved === "number" && d.tokens_saved > 0
          ? d.tokens_saved
          : Math.max(0, estTokens(output) - estTokens(compressed));
      return { output: compressed, savedTokens };
    } catch (err) {
      log.warn({ err: (err as Error)?.message }, "headroom compress failed (fail-open)");
      return null;
    }
  },

  /** GET /stats — aggregate proxy stats. null = fail-open. */
  async stats(): Promise<{ before: number; saved: number; pct: number } | null> {
    if (!env.HEADROOM_ENABLED) return null;
    try {
      const res = await fetch(`${env.HEADROOM_BASE_URL}/stats`, {
        signal: AbortSignal.timeout(env.HEADROOM_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const d = (await res.json()) as {
        tokens?: { total_before_compression?: number; saved?: number; savings_percent?: number };
      };
      return {
        before: d.tokens?.total_before_compression ?? 0,
        saved: d.tokens?.saved ?? 0,
        pct: d.tokens?.savings_percent ?? 0,
      };
    } catch {
      return null;
    }
  },
};
