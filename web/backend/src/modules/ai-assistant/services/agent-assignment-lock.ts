// SPDX-License-Identifier: AGPL-3.0-only
import type { Executor } from "../../../shared/executor/index.js";

/** Same process/target discipline as the existing run registry and task dispatcher. */
const locks = new Map<string, Promise<unknown>>();
const admitted = new Map<string, Set<{ projectId: string | null }>>();
const keyOf = (executor: Executor, agentId: string) => JSON.stringify([executor.target.id, agentId]);
export async function withAssignmentLock<T>(executor: Executor, agentId: string, work: () => Promise<T>): Promise<T> {
  const key = keyOf(executor, agentId);
  const previous = locks.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(work);
  locks.set(key, current);
  try { return await current; } finally { if (locks.get(key) === current) locks.delete(key); }
}
export function markAssignmentAdmission(executor: Executor, agentId: string, projectId: string | null): () => void {
  const key = keyOf(executor, agentId), entry = { projectId };
  const active = admitted.get(key) ?? new Set();
  active.add(entry); admitted.set(key, active);
  return () => { active.delete(entry); if (!active.size) admitted.delete(key); };
}
export function hasAssignmentAdmission(executor: Executor, agentId: string, projects: Set<string>): boolean {
  return [...(admitted.get(keyOf(executor, agentId)) ?? [])].some(a => !a.projectId || projects.has(a.projectId));
}
