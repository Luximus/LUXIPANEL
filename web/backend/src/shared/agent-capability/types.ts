// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AgentCapability — contract every LUXIPANEL module implements (optionally)
 * to expose its data and actions to the AI Assistant agent.
 *
 * Modules declare a capability in `<module>/agent-capability.ts` and call
 * `agentCapabilityRegistry.register(...)` from their `index.ts`. The
 * registry is in-process, per-installation (panel host), built at boot.
 *
 * Tools and dataPanels are executed INSIDE the request scope of the chat
 * call. The executor of the connected target is resolved automatically via
 * `getContextExecutor()` — handlers must not capture an executor at import
 * time. Fail-closed: handlers that try to read/write per-server state
 * outside a request will throw (no localExecutor fallback).
 */

/**
 * Minimal JSON-Schema shape we accept for tool inputs. Permissive on
 * purpose — providers (Anthropic/OpenAI/Gemini/DeepSeek) accept slightly
 * different dialects, and the adapter layer is responsible for any final
 * normalization. We avoid pulling in `@types/json-schema` for this.
 */
export interface ToolInputSchema {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
  description?: string;
  [k: string]: unknown;
}

/** A function-callable tool the agent can invoke. */
export interface AgentTool {
  /** Globally unique, prefixed by `<moduleId>.` (e.g. "monitor.cpu_top"). */
  name: string;
  /** Human title shown in the assistant Modules tab. */
  title: string;
  /** LLM-facing description (English, imperative). */
  description: string;
  /** "read" = inspect-only; "action" = side-effects on the target. */
  kind: "read" | "action";
  /**
   * Action that may change/destroy server state. Defaults to true for
   * `kind: "action"` unless the module opts out explicitly. Dangerous
   * tools start disabled OR with `requireConfirm=true` in the sidecar.
   */
  dangerous?: boolean;
  /**
   * Optional permission slug that the calling user must hold. If omitted,
   * the assistant module's own permission gate applies.
   */
  permission?: string;
  /** JSON Schema-like object for the tool input (must be `type: "object"`). */
  inputSchema: ToolInputSchema;
  /**
   * Handler. Runs in the request's AsyncLocalStorage scope — the per-target
   * executor is implicit via `getContextExecutor()`.
   *
   * Return `{ ok: true, output }` on success (output is JSON-serializable)
   * or `{ ok: false, output: string }` with a user-facing error message.
   * Throw to signal an unrecoverable error (the agent loop surfaces it).
   */
  handler: (input: unknown) => Promise<{ ok: boolean; output: unknown }>;
}

/**
 * A precomputed context blob the agent can fold into its system prompt
 * ("give me the current snapshot of module X"). dataPanels are read-only
 * and cheap by contract — heavy data goes through a tool instead.
 */
export interface AgentDataPanel {
  /** Globally unique, prefixed by `<moduleId>.` (e.g. "monitor.snapshot"). */
  name: string;
  /** Human title. */
  title: string;
  /** LLM-facing description of what the snapshot contains. */
  description: string;
  /** Collector. Same execution scope contract as `AgentTool.handler`. */
  collect: () => Promise<Record<string, unknown>>;
  /**
   * Optional read-through cache TTL (seconds). The agent runtime is free
   * to memoize per (target, name). Leave unset for "always recompute".
   */
  ttlSeconds?: number;
}

export interface AgentCapability {
  /** Must match the moduleId from `module-registry.service.ts` catalog. */
  moduleId: string;
  /** Canonical id owned by the module manager; null is internal infrastructure. */
  catalogModuleId?: string | null;
  moduleVersion?: string;
  /** Contract version. Reserved for future schema migrations. */
  version: 1;
  tools: AgentTool[];
  dataPanels?: AgentDataPanel[];
  /** Prompts surfaced in the assistant Chat tab as starter chips. */
  suggestedPrompts?: string[];
}

/** Compact descriptor for the Modules tab UI / list endpoints. */
export interface AgentToolDescriptor {
  name: string;
  title: string;
  description: string;
  kind: "read" | "action";
  dangerous: boolean;
  permission?: string;
}

export interface AgentDataPanelDescriptor {
  name: string;
  title: string;
  description: string;
  ttlSeconds?: number;
}

export interface AgentCapabilityDescriptor {
  moduleId: string;
  tools: AgentToolDescriptor[];
  dataPanels: AgentDataPanelDescriptor[];
  suggestedPrompts: string[];
}
