// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { AssistantProject, ConversationMeta } from "../assistant-api";

/** Include the selected project and every nested subproject in history search. */
export function projectScopeIds(selectedId: string | null, projects: AssistantProject[]): Set<string> {
  if (!selectedId) return new Set();
  const ids = new Set([selectedId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const project of projects) {
      if (project.parentId && ids.has(project.parentId) && !ids.has(project.id)) {
        ids.add(project.id);
        changed = true;
      }
    }
  }
  return ids;
}

export function isLooseConversation(conversation: ConversationMeta): boolean {
  return !conversation.projectId && !conversation.agentId;
}

export function conversationInProjectScope(conversation: ConversationMeta, selectedId: string | null, ids: Set<string>): boolean {
  return selectedId === null ? isLooseConversation(conversation) : Boolean(conversation.projectId && ids.has(conversation.projectId));
}
