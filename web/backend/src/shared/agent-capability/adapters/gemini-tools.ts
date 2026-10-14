// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Gemini (Google generative-language v1beta) tool adapter.
 *
 * Gemini wraps function declarations in a single `tools: [{ functionDeclarations: [...] }]`
 * envelope. Names follow the same `[a-zA-Z0-9_-]+` rule, so we reuse the
 * dot-to-`__` mapping.
 */

import type { AgentTool } from "../types.js";
import {
  toAnthropicName as toWire,
  fromAnthropicName as fromWire,
  toWireSchema,
} from "./anthropic-tools.js";

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export interface GeminiToolsEnvelope {
  functionDeclarations: GeminiFunctionDeclaration[];
}

const toGeminiName = toWire;
export const fromGeminiName = fromWire;

export function toGeminiTools(tools: AgentTool[]): GeminiToolsEnvelope {
  return {
    functionDeclarations: tools.map((t) => ({
      name: toGeminiName(t.name),
      description: t.description,
      parameters: toWireSchema(t),
    })),
  };
}
