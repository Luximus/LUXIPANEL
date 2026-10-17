// SPDX-License-Identifier: AGPL-3.0-only
import { agentQueueRepository } from "../repositories/agent-queue.repository.js";
import { admitAgentWork, resolveConversationBinding } from "./agent-context.service.js";

/** Shared admission for HTTP, team, voice and message follow-ups. */
export async function enqueueAgentTurn(...args: Parameters<typeof agentQueueRepository.enqueue>) {
  const [executor, item] = args;
  const binding = await resolveConversationBinding(executor, item, item.user ?? undefined);
  const admission = await admitAgentWork(executor, binding.agentId, binding.projectId, item.user ?? undefined);
  try {
    return await agentQueueRepository.enqueue(executor, { ...item, agentId: binding.agentId, projectId: binding.projectId });
  } finally { admission.release(); }
}
