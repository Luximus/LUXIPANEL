// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Permission policy — decides whether a tool the Claude CLI wants to run should
 * be auto-allowed (read-only, no interruption) or surfaced to the user for an
 * explicit approve/deny (anything that mutates the connected server).
 *
 * The Claude CLI calls our `permissions.approve` MCP tool with `{ tool_name,
 * input }`. `tool_name` is either a built-in Claude tool ("Bash", "Edit", …) or
 * a fully-qualified MCP tool ("mcp__luxipanel-servers__servers__exec"). We map
 * MCP tools back to the capability registry and honour their declared `kind`
 * (read → allow, action → ask); built-ins use a curated read-only allowlist.
 *
 * Default is fail-safe: anything NOT recognised as read-only → ask. We never
 * silently allow an unknown/mutating tool.
 *
 * Split into two collaborating concerns:
 *   • `decide`  — pure authorisation (no presentation, no I/O)
 *   • `summarize` — human-readable prompt rendering for the chat bubble
 *
 * `summarize` is driven by a renderer registry (`BUILTIN_TOOL_RENDERERS`);
 * adding a new built-in is one map entry. The MCP path lives in
 * `renderMcpTool` and the default fallback in `renderDefault`.
 */

import { fromOpenAiName } from "../../../shared/agent-capability/index.js";
import { agentCapabilityRegistry } from "../../../shared/agent-capability/index.js";

/** MCP server name the cross-server channel registers as (cli-bridge.provider). */
const CROSS_MCP_SERVER = "luxipanel-servers";

/**
 * Built-in Claude CLI tools that only READ — they never mutate the target, so
 * they auto-allow (asking on every file read would make the agent unusable).
 * Everything else (Bash, Edit, Write, MultiEdit, NotebookEdit, …) is gated.
 */
const READONLY_BUILTINS = new Set<string>([
  "Read",
  "Glob",
  "Grep",
  "LS",
  "NotebookRead",
  "TodoWrite", // scratchpad only — no server effect
  // NOTE: WebFetch / WebSearch are deliberately NOT here. Although they don't
  // mutate the target, they are writes *outbound*: a prompt injection in a file
  // the agent reads could pack secrets it gathered with Read/Grep into a
  // WebFetch URL and exfiltrate them with no user approval. Gate them ("ask").
  "Task", // spawns a sub-agent; the sub-agent's own tool calls are gated separately
]);

export type PermissionVerdict = "allow" | "ask";

/**
 * Map a Claude tool name to the capability registry's real name, if it's one of
 * our MCP tools. Returns null for built-in Claude tools.
 *   mcp__luxipanel-servers__servers__exec → servers.exec
 */
function mcpRealName(toolName: string): string | null {
  const prefix = `mcp__${CROSS_MCP_SERVER}__`;
  if (!toolName.startsWith(prefix)) return null;
  return fromOpenAiName(toolName.slice(prefix.length));
}

// ── presentation helpers ────────────────────────────────────────────────────

function clip(s: string, n = 600): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function clipInput(obj: Record<string, unknown>): string | undefined {
  try {
    const j = JSON.stringify(obj);
    return j && j !== "{}" ? clip(j) : undefined;
  } catch {
    return undefined;
  }
}

// ── tool renderer registry ──────────────────────────────────────────────────

type ToolRenderer = (input: Record<string, unknown>) => { title: string; detail?: string };

/**
 * Per-builtin renderers. Multi-tool entries (Edit / MultiEdit, etc.) share a
 * single renderer via the same key, so they don't repeat copy.
 */
const BUILTIN_TOOL_RENDERERS: Record<string, ToolRenderer> = {
  Bash: (input) => ({
    title: "Ejecutar comando en el servidor",
    detail: clip(String(input["command"] ?? "")),
  }),
  Edit: (input) => ({ title: "Modificar un archivo", detail: str(input["file_path"]) }),
  MultiEdit: (input) => ({ title: "Modificar un archivo", detail: str(input["file_path"]) }),
  Write: (input) => ({ title: "Crear o sobrescribir un archivo", detail: str(input["file_path"]) }),
  NotebookEdit: (input) => ({
    title: "Editar un notebook",
    detail: str(input["notebook_path"]),
  }),
  WebFetch: (input) => ({
    title: "Acceder a una URL externa (posible salida de datos)",
    detail: str(input["url"]) ?? str(input["prompt"]),
  }),
  WebSearch: (input) => ({
    title: "Buscar en la web (posible salida de datos)",
    detail: str(input["query"]),
  }),
};

function renderMcpTool(real: string, input: Record<string, unknown>): { title: string; detail?: string } {
  if (real === "servers.exec") {
    return {
      title: "Ejecutar comando en un servidor asociado",
      detail: clip(String(input["command"] ?? "")),
    };
  }
  return { title: `Acción del servidor: ${real}`, detail: clipInput(input) };
}

function renderDefault(toolName: string, input: Record<string, unknown>): { title: string; detail?: string } {
  return { title: `Usar la herramienta "${toolName}"`, detail: clipInput(input) };
}

// ── public surface ──────────────────────────────────────────────────────────

export const permissionPolicy = {
  /**
   * Decide whether `toolName` needs an explicit user approval. Synchronous and
   * side-effect-free: a read-only built-in or a registry `read` tool → "allow";
   * everything else → "ask".
   */
  decide(toolName: string): PermissionVerdict {
    if (READONLY_BUILTINS.has(toolName)) return "allow";
    const real = mcpRealName(toolName);
    if (real) {
      const found = agentCapabilityRegistry.findTool(real);
      // A registry tool explicitly marked read-only and not dangerous → allow.
      if (found && found.tool.kind === "read" && !found.tool.dangerous) return "allow";
      return "ask";
    }
    // Unknown built-in or any mutating tool → ask (fail-safe).
    return "ask";
  },

  /**
   * Build a short, human-readable title + detail for the approval prompt shown
   * in the chat bubble. Never throws; falls back to a compact JSON of the input.
   *
   * Lookup order: MCP tools (registry → real MCP name) → built-in renderer →
   * generic fallback. Each layer is a separate function so new MCP names or
   * built-ins are one entry, not an extra `case`.
   */
  summarize(toolName: string, input: Record<string, unknown>): { title: string; detail?: string } {
    const real = mcpRealName(toolName);
    if (real !== null) return renderMcpTool(real, input);
    const builtin = BUILTIN_TOOL_RENDERERS[toolName];
    if (builtin) return builtin(input);
    return renderDefault(toolName, input);
  },
};
