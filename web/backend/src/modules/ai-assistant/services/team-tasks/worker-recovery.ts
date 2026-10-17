// SPDX-License-Identifier: AGPL-3.0-only
import type { Executor } from "../../../../shared/executor/index.js";
import { getContextUser } from "../../../../shared/executor/context.js";
import { cliJobsRepository } from "../../repositories/cli-jobs.repository.js";

/** An empty in-memory registry after restart does not prove that a worker stopped. */
export async function preserveWorkerExecution(executor: Executor, conversationId: string): Promise<boolean> {
 try {
  const descriptor = await cliJobsRepository.get(executor, conversationId);
  if (!descriptor) return false;
  // Lazy import avoids making the dispatcher/recovery/task lifecycle cycle eager.
  const { recoverConversation } = await import("../cli-run-recovery.service.js");
  if (await recoverConversation(executor, conversationId, getContextUser() ?? undefined)) return true;
  // Unconfirmed target reads retain the descriptor. Only confirmed absence of
  // its artifacts removes it; do not finalize a task while that is uncertain.
  return !!await cliJobsRepository.get(executor, conversationId);
 } catch { return true; }
}
