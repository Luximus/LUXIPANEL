// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { ApiActivity, ApiActivityEvent } from "../assistant-api/api-activity";
import type { ToolTrace } from "./types";

/** Keep process order and call identity without changing the received payload. */
export function appendApiActivity(activity: ApiActivity | undefined, event: ApiActivityEvent): ApiActivity {
  const events = [...(activity?.events ?? [])];
  const last = events[events.length - 1];
  if (event.type === "text" && last?.type === "text") {
    events[events.length - 1] = { ...last, delta: last.delta + event.delta };
  } else if (event.type !== "text") {
    const index = events.findIndex(item => item.type === event.type && "id" in item && item.id === event.id);
    if (index >= 0) {
      if (event.type === "tool_result") events[index] = event;
    } else events.push(event);
  } else events.push(event);
  return { ...activity, events };
}

/** Rehydrate by id, never by name or by parsing prose. Results may be partial. */
export function apiActivityTools(activity: ApiActivity): ToolTrace[] {
  const tools = new Map<string, ToolTrace>();
  const results = new Map<string, ToolTrace["result"]>();
  for (const event of activity.events) {
    if (event.type === "tool_use" && !tools.has(event.id)) {
      tools.set(event.id, { id: event.id, name: event.name, input: event.input });
    } else if (event.type === "tool_result") {
      results.set(event.id, { success: event.success, output: event.output });
    }
  }
  return [...tools.values()].map(tool => results.has(tool.id) ? { ...tool, result: results.get(tool.id) } : tool);
}
