// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * OpenAI / DeepSeek / Codex (OpenAI-compatible chat completions) tool adapter.
 *
 * Same restriction on function names (no dots). We reuse the Anthropic name
 * mapping for consistency so a tool round-trips identically across providers.
 */

import type { AgentTool } from "../types.js";
import {
  toAnthropicName as toWire,
  fromAnthropicName as fromWire,
  toWireSchema,
} from "./anthropic-tools.js";

export interface OpenAiTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties?: Record<string, unknown>;
      required?: string[];
    };
  };
}

export const toOpenAiName = toWire;
export const fromOpenAiName = fromWire;

export function toOpenAiTools(tools: AgentTool[]): OpenAiTool[] {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: toOpenAiName(t.name),
      description: t.description,
      parameters: toWireSchema(t),
    },
  }));
}
