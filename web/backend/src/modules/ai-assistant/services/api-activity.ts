// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { ApiActivity, ApiActivityEvent } from "../models/api-activity.types.js";
import type { AgentEvent } from "./providers/provider.types.js";
import { sanitize, sanitizeText } from "../../../shared/diagnostics/sanitize.js";

/** Bounded independently of SSE replay; preserves call ids, order and outcomes. */
export function createApiActivity() {
  const events: ApiActivityEvent[] = [];
  let remaining = 32_000;
  let truncated = false;
  const tooLarge = (value: string) => {
    if (value.length <= 4_000 && remaining > 0) return false;
    truncated = true;
    return true;
  };
  const retain = (clean: string) => {
    const retained = clean.slice(0, Math.min(4_000, remaining));
    remaining -= retained.length;
    if (retained.length < clean.length) truncated = true;
    return retained;
  };
  return {
    record(event: AgentEvent): void {
      if (event.type !== "tool_use" && event.type !== "tool_result" && !(event.type === "text" && event.phase === "commentary")) return;
      if (events.length >= 200) { truncated = true; return; }
      if (event.type === "text") {
        // Scrub after joining chunks: a credential can span text deltas.
        const delta = retain(tooLarge(event.delta) ? "[Detalle omitido por tamaño]" : event.delta);
        const last = events.at(-1);
        if (last?.type === "text") last.delta += delta;
        else events.push({ type: "text", phase: "commentary", delta });
      } else if (event.type === "tool_use") {
        const input = tooLarge(JSON.stringify(event.input)) ? { truncated: true } : sanitize(event.input) as Record<string, unknown>;
        const full = JSON.stringify(input);
        const retained = retain(full);
        events.push({ type: "tool_use", id: event.id, name: event.name, input: full.length === retained.length ? input : { detail: retained, truncated: true } });
      } else {
        let output: string;
        if (tooLarge(event.output)) output = "[Detalle omitido por tamaño]";
        else {
          try { output = JSON.stringify(sanitize(JSON.parse(event.output))); }
          catch { output = sanitizeText(event.output); }
        }
        events.push({ type: "tool_result", id: event.id, success: event.success, output: retain(output) });
      }
    },
    snapshot(): ApiActivity | undefined {
      const sanitized = events.map(event => {
        if (event.type !== "text") return event;
        if (event.delta.length > 4_000) { truncated = true; return { ...event, delta: "[Detalle omitido por tamaño]" }; }
        return { ...event, delta: sanitizeText(event.delta) };
      });
      return events.length ? { events: sanitized, ...(truncated ? { truncated: true as const } : {}) } : undefined;
    },
  };
}
