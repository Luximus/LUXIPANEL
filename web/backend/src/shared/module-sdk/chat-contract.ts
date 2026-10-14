// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { AgentCapability } from "../agent-capability/types.js";
export interface ChatOperation { id: string; tool: string; kind: "read" | "action"; permission: string; }
export interface ChatContract { version: 1; operations: ChatOperation[]; }
/** Pure admission check, shared by manifest validation and runtime loading. */
export function chatContractErrors(manifest: Record<string, unknown>, capability?: AgentCapability): string[] {
  const chat = manifest.chat as ChatContract | undefined, errors: string[] = [];
  if (!chat || chat.version !== 1 || !Array.isArray(chat.operations) || !chat.operations.length) return ["chat: version 1 and a nonempty operations catalog are required"];
  if (Object.keys(chat).some(key => !["version", "operations"].includes(key))) errors.push("chat: unknown contract field");
  const ids = new Set<string>(), tools = new Set<string>(), permissions = new Set<string>();
  for (const operation of chat.operations) {
    if (operation && Object.keys(operation).some(key => !["id", "tool", "kind", "permission"].includes(key))) errors.push("chat: unknown operation field");
    if (!operation || typeof operation.id !== "string" || !/^[a-z][a-z0-9_.-]*$/.test(operation.id) || ids.has(operation.id)) errors.push("chat: invalid or duplicate operation id");
    if (!operation || typeof operation.tool !== "string" || !/^[a-z][a-z0-9_-]*$/.test(operation.tool)) { errors.push("chat: invalid tool suffix"); continue; }
    ids.add(operation.id); tools.add(operation.tool);
    if (!["read", "action"].includes(operation.kind)) errors.push(`chat: invalid kind for ${operation.id}`);
    if (typeof operation.permission !== "string" || (!operation.permission.startsWith(`${manifest.id}.`) || !/^[a-z][a-z0-9-]*\.[a-z][a-z0-9_.-]*$/.test(operation.permission))) errors.push(`chat: explicit module permission required for ${operation.id}`);
    permissions.add(operation.permission);
    if (capability) {
      const tool = capability.tools.find(tool => tool.name === `${manifest.id}.${operation.tool}`);
      if (!tool || tool.kind !== operation.kind || tool.permission !== operation.permission) errors.push(`chat: missing or mismatched runtime tool for ${operation.id}`);
    }
  }
  const actions = (manifest.surface as { actions?: unknown } | undefined)?.actions;
  for (const action of Array.isArray(actions) ? actions : []) if (!permissions.has(action)) errors.push(`chat: declared action ${action} has no tool`);
  if (capability) for (const tool of capability.tools) if (!tools.has(tool.name.slice(String(manifest.id).length + 1))) errors.push(`chat: runtime tool ${tool.name} is absent from the contract`);
  return errors;
}
