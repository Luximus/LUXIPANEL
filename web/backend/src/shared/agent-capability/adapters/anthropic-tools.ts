// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Anthropic tool-format adapter.
 *
 * Anthropic's Messages API accepts tool names matching /^[a-zA-Z0-9_-]+$/.
 * Our internal names use `<moduleId>.<tool>` (dots), so we replace `.` with
 * `__` for the wire format and remember the mapping for reverse lookup.
 */

import type { AgentTool } from "../types.js";

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: { type: "object"; properties?: Record<string, unknown>; required?: string[] };
}

const SEP = "__";

export function toAnthropicName(name: string): string {
  return name.replaceAll(".", SEP);
}

export function fromAnthropicName(wireName: string): string {
  return wireName.replaceAll(SEP, ".");
}

/**
 * The JSON-Schema envelope every provider wants, under a different key:
 * Anthropic `input_schema`, OpenAI `function.parameters`, Gemini
 * `functionDeclarations[].parameters`. Exported so those adapters project the
 * SAME object instead of re-typing the `{type, properties, required}` literal.
 */
export function toWireSchema(tool: AgentTool): {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
} {
  return {
    type: "object",
    properties: tool.inputSchema.properties ?? {},
    required: tool.inputSchema.required ?? [],
  };
}

export function toAnthropicTools(tools: AgentTool[]): AnthropicTool[] {
  return tools.map((t) => ({
    name: toAnthropicName(t.name),
    description: t.description,
    input_schema: toWireSchema(t),
  }));
}
