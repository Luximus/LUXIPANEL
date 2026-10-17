// SPDX-License-Identifier: AGPL-3.0-only
/** Publish immutable development snapshots without waiting for unrelated turns. */
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { ConflictError, ForbiddenError } from "../errors/index.js";
import type { SessionUser } from "../types/index.js";
import { githubStatus } from "./user-connection.js";
import { sameContributionPrincipal } from "./contribution-batches.js";
import { committedContributionSource } from "./contribution-continuation.js";
import { contributionFailure, contributionGit, coreRepository, prepareContribution, publisherLock, readContributionJobs, saveContribution, type ContributionJob } from "./owner-contributions.js";

export interface ContributionCheckpoint {
 batchId: string; sourceId: string; through: string; members: string[]; parentId?: string;
}

export function checkpointDependencyReady(job: ContributionJob, jobs: ContributionJob[]): boolean {
 const visited = new Set<string>();
 while (job.checkpoint?.parentId) {
  const id = job.checkpoint.parentId;
  if (visited.has(id)) return false;
  visited.add(id);
  const parent = jobs.find(candidate => candidate.id === id);
  if (!parent) return false;
  if (parent.status === "pushed") return true;
  if (parent.status !== "empty") return false;
  // An empty turn has not sent its predecessor's changes to GitHub.
  job = parent;
 }
 return true;
}

/** Caller serializes the outbox. Source is a completed immutable snapshot,
 * never a new read of files that other agents may still be editing. Publication
 * saves development code; it does not verify or finish another agent's task. */
export async function checkpointCompletedContribution(source: ContributionJob): Promise<string | null> {
 const jobs = await readContributionJobs();
 if (!source.batchId || source.isolated || source.status === "capturing" || source.succeeded !== true || !source.completedAt || !source.after)
  throw new ConflictError("El turno todavía no tiene una instantánea final confirmada.");
 const members = jobs.filter(job => job.batchId === source.batchId);
 const leader = members.find(job => job.id === source.batchId);
 if (!leader || !leader.head || members.some(job => !sameContributionPrincipal(source, job)))
  throw new ConflictError("Los cambios de identidades diferentes requieren revisión antes de publicarse.");
 const existing = jobs.filter(job => job.checkpoint?.batchId === source.batchId)
  .sort((a, b) => a.checkpoint!.through.localeCompare(b.checkpoint!.through));
 const duplicate = existing.find(job => job.checkpoint?.sourceId === source.id);
 if (duplicate) return duplicate.status === "empty" ? null : duplicate.id;
 const previous = existing.filter(job => !!job.patchHash || job.status === "empty").at(-1);
 if (previous && previous.checkpoint!.through >= source.completedAt) return previous.status === "empty" ? null : previous.id;
 const confirmed = jobs.filter(job => job.status === "pushed" && job.commit && !job.isolated && sameContributionPrincipal(job, source))
  .sort((a, b) => (a.pushedAt ?? a.createdAt).localeCompare(b.pushedAt ?? b.createdAt)).at(-1);
 const head = previous?.head ?? confirmed?.commit ?? leader.head;
 try { await contributionGit(source.root, ["merge-base", "--is-ancestor", leader.head, head]); }
 catch { throw new ConflictError("La base publicada no continúa el historial de este grupo."); }
 const id = randomUUID();
 const index = path.join(env.LUXIPANEL_CONFIG_DIR, "github-users", "contributions", source.id, `checkpoint-${id}.index`);
 try {
  const before = previous?.after ?? await committedContributionSource(source.root, head, index);
  if (!before) throw new ConflictError("No se pudo verificar la base del aporte anterior.");
  const included = members.filter(job => !job.includedIn && job.succeeded === true && job.completedAt && job.completedAt <= source.completedAt! && job.after);
  const checkpoint: ContributionJob = {
   id, conversationId: source.conversationId, root: source.root, user: source.user,
   before, after: source.after, head, status: "pending", succeeded: true,
   // Order by the captured boundary, even if a restart queues it much later.
   createdAt: source.completedAt, updatedAt: new Date().toISOString(), completedAt: source.completedAt,
   checkpoint: { batchId: source.batchId, sourceId: source.id, through: source.completedAt, members: included.map(job => job.id), ...(previous ? { parentId: previous.id } : {}) },
  };
  // Keep both trees reachable even after snapshot cleanup or Git maintenance.
  await contributionGit(source.root, ["update-ref", `refs/luxipanel/snapshots/${id}-before`, before]);
  await contributionGit(source.root, ["update-ref", `refs/luxipanel/snapshots/${id}-after`, source.after]);
  await saveContribution(checkpoint);
  let prepared: boolean;
  try { prepared = await prepareContribution(checkpoint, source.after); }
  catch (error) {
   checkpoint.status = "blocked"; checkpoint.error = contributionFailure(error).message;
   await saveContribution(checkpoint);
   return checkpoint.id;
  }
  for (const member of included) {
   member.includedIn = id; member.status = checkpoint.status; member.error = undefined;
   await saveContribution(member);
  }
  return prepared ? id : null;
 } finally { await fs.rm(index, { force: true }); }
}

/** Explicit recovery of already completed turns in a still-active group.
 * It only queues existing snapshots; the normal panel publisher sends them. */
export async function queueCompletedGroupSnapshot(user: SessionUser, batchId: string): Promise<string | null> {
 if (!/^[a-f0-9-]{36}$/.test(batchId) || !(await githubStatus(user)).canEditCore) throw new ForbiddenError();
 const unlock = await publisherLock();
 if (!unlock) throw new ConflictError("El panel está procesando la cola; vuelve a intentarlo en unos instantes.");
 try {
 const jobs = await readContributionJobs(), members = jobs.filter(job => job.batchId === batchId);
 const leader = members.find(job => job.id === batchId);
 const source = members.filter(job => job.succeeded === true && job.completedAt && job.after && job.status !== "capturing")
  .sort((a, b) => a.completedAt!.localeCompare(b.completedAt!)).at(-1);
 if (!leader || !source || source.user.userId !== user.userId || source.user.username !== user.username || source.user.kind !== user.kind || members.some(job => !sameContributionPrincipal(job, source)) ||
     await fs.realpath(source.root) !== await fs.realpath(coreRepository())) throw new ForbiddenError();
 leader.publishCompletedTurns = true; await saveContribution(leader);
 return leader.id;
 } finally { unlock(); }
}
