// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { AgentTool } from "../../../shared/agent-capability/types.js";
import type { Executor } from "../../../shared/executor/types.js";
import { conversationsRepository } from "../repositories/conversations.repository.js";
import { projectsRepository } from "../repositories/projects.repository.js";

export const PROJECT_CHAT_LIST_TOOL = "project.chats.list";
export const PROJECT_CHAT_READ_TOOL = "project.chats.read";

export async function activeProjectChatScope(executor: Executor, conversationId: string) {
  if (!(await conversationsRepository.listIds(executor)).has(conversationId)) return null;
  const meta = await conversationsRepository.getMeta(executor, conversationId);
  if (!meta?.projectId) return null;
  const project = await projectsRepository.get(executor, meta.projectId);
  // `listIds` is scoped to the current user by the conversation repository.
  return {
    projectId: meta.projectId,
    conversationId,
    projectPath: project?.path ?? "",
    projectOwnerId: project?.ownerId ?? null,
  };
}

export function buildProjectChatTools(scope: { executor: Executor; conversationId: string; projectId: string }): AgentTool[] {
  const currentScope = async () => {
    const active = await activeProjectChatScope(scope.executor, scope.conversationId);
    return active?.projectId === scope.projectId ? active : null;
  };
  return [
    {
      name: PROJECT_CHAT_LIST_TOOL,
      title: "Consultar chats del proyecto",
      description: "List or search previous chats in the project attached to this conversation. The project is fixed by the active chat; no other project can be selected.",
      kind: "read", dangerous: false,
      inputSchema: { type: "object", properties: { q: { type: "string", maxLength: 200 }, limit: { type: "integer", minimum: 1, maximum: 25 }, offset: { type: "integer", minimum: 0 } }, required: [], additionalProperties: false },
      handler: async value => {
        const active = await currentScope();
        if (!active) return { ok: false, output: "Esta conversación ya no está vinculada a ese proyecto." };
        const args = (value ?? {}) as Record<string, unknown>;
        const q = typeof args.q === "string" ? args.q.trim().slice(0, 200) : undefined;
        const limit = Math.max(1, Math.min(25, Number.isInteger(args.limit) ? Number(args.limit) : 10));
        const offset = Math.max(0, Math.min(500, Number.isInteger(args.offset) ? Number(args.offset) : 0));
        const result = await conversationsRepository.list(scope.executor, { projectId: active.projectId, ...(q ? { q } : {}), limit, offset });
        return { ok: true, output: result.items.map(chat => ({ id: chat.id, title: chat.title, preview: chat.preview, messageCount: chat.messageCount, updatedAt: chat.updatedAt })) };
      },
    },
    {
      name: PROJECT_CHAT_READ_TOOL,
      title: "Leer un chat del proyecto",
      description: "Read messages from a previous chat in the same active project. First use project.chats.list to find its exact id. Chats from other projects or users are inaccessible.",
      kind: "read", dangerous: false,
      inputSchema: { type: "object", properties: { conversationId: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 40 }, offset: { type: "integer", minimum: 0 } }, required: ["conversationId"], additionalProperties: false },
      handler: async value => {
        const active = await currentScope();
        if (!active) return { ok: false, output: "Esta conversación ya no está vinculada a ese proyecto." };
        const args = (value ?? {}) as Record<string, unknown>;
        const conversationId = typeof args.conversationId === "string" ? args.conversationId.trim() : "";
        if (!conversationId || !(await conversationsRepository.listIds(scope.executor)).has(conversationId)) {
          return { ok: false, output: "Chat no encontrado en tus conversaciones." };
        }
        const meta = await conversationsRepository.getMeta(scope.executor, conversationId);
        if (!meta || meta.projectId !== active.projectId) return { ok: false, output: "Chat no encontrado en este proyecto." };
        const limit = Math.max(1, Math.min(40, Number.isInteger(args.limit) ? Number(args.limit) : 20));
        const offset = Math.max(0, Math.min(5000, Number.isInteger(args.offset) ? Number(args.offset) : 0));
        const result = await conversationsRepository.messages(scope.executor, conversationId, { limit, offset });
        return { ok: true, output: { id: conversationId, title: meta.title, messages: result.items.map(message => ({
          role: message.role,
          content: (message.role === "user" ? (message.textOriginal ?? message.content) : (message.textTranslated ?? message.content)).slice(0, 4000),
          ts: message.ts,
        })) } };
      },
    },
  ];
}
