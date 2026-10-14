// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Public surface of the agent-capability layer.
 *
 * Modules import `agentCapabilityRegistry` to register their capability;
 * the assistant module imports the same registry plus the wire adapters
 * to build provider-specific tool lists.
 */

export type {
  AgentTool,
  AgentDataPanel,
  AgentCapability,
  AgentCapabilityDescriptor,
  AgentToolDescriptor,
  AgentDataPanelDescriptor,
  ToolInputSchema,
} from "./types.js";

export { agentCapabilityRegistry } from "./registry.js";
export { requireExecutor } from "./context.js";

export {
  toAnthropicTools,
  toAnthropicName,
  fromAnthropicName,
  type AnthropicTool,
} from "./adapters/anthropic-tools.js";

export {
  toOpenAiTools,
  toOpenAiName,
  fromOpenAiName,
  type OpenAiTool,
} from "./adapters/openai-tools.js";

export {
  toGeminiTools,
  fromGeminiName,
  type GeminiFunctionDeclaration,
  type GeminiToolsEnvelope,
} from "./adapters/gemini-tools.js";

export {
  toDeepSeekTools,
  toDeepSeekName,
  fromDeepSeekName,
  type DeepSeekTool,
} from "./adapters/deepseek-tools.js";
