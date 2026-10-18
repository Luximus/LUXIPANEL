// SPDX-License-Identifier: AGPL-3.0-only
/** Carry unpublished dependencies across consecutive, verified chat boundaries. */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { ConflictError } from "../errors/index.js";
import { sameContributionPrincipal } from "./contribution-batches.js";
import { committedContributionSource } from "./contribution-continuation.js";
import { contributionGit, readContributionJobs, validateContributionPatch, type ContributionJob } from "./owner-contributions.js";

export interface ContributionResumption {
 version: 1;
 before: string;
 after: string;
 patchHash: string;
 sources: Array<{ id: string; before: string; after: string; snapshotHash?: string }>;
}
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const directory = (id: string) => path.join(env.LUXIPANEL_CONFIG_DIR, "github-users", "contributions", id);
const tree = (value?: string) => typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
const evidenceHash = (job: ContributionJob) => job.status === "interrupted" ? job.interruption?.patchHash : job.patchHash;
const singleWriter = (job: ContributionJob) => !job.isolated && !job.overlapped && !job.teamTaskId && !job.includedIn &&
 !job.checkpoint && !job.legacyRecovery && !job.continuationReview && !job.recoveryOf && job.batchId === job.id;
const completed = (job: ContributionJob) => Number.isFinite(Date.parse(job.createdAt)) && !!job.completedAt &&
 Number.isFinite(Date.parse(job.completedAt)) && Date.parse(job.completedAt) >= Date.parse(job.createdAt);

/** All writers are considered, including foreign chats: never jump over one to
 * find a convenient matching tree. Read-only turns can bridge, never trigger. */
export function consecutiveContributionSources(job: ContributionJob, jobs: ContributionJob[], baseline: string): ContributionJob[] {
 if (!singleWriter(job) || !completed(job) || job.succeeded !== true || !tree(job.before) || !tree(job.after) ||
     job.before === job.after || job.before === baseline || job.commit) return [];
 const previous = jobs.filter(other => other.id !== job.id && other.root === job.root)
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
 if (previous.some(other => other.status === "capturing" || other.createdAt >= job.createdAt)) return [];
 const sources: ContributionJob[] = [];
 let cursor = job;
 for (const source of previous.slice(0, 100)) {
  if (!singleWriter(source) || !sameContributionPrincipal(source, job) || source.conversationId !== job.conversationId ||
      source.head !== job.head || !tree(source.before) || !tree(source.after) || !completed(source) || source.commit ||
      Date.parse(source.completedAt!) > Date.parse(cursor.createdAt) || source.after !== cursor.before) return [];
  const interrupted = source.status === "interrupted" && source.succeeded === false;
  const successful = source.succeeded === true && ["empty", "pending", "blocked"].includes(source.status);
  if (!interrupted && !successful) return [];
  if (source.before !== source.after && !evidenceHash(source)) return [];
  if (source.status === "empty" && source.before !== source.after) return [];
  sources.unshift(source);
  if (source.before === baseline) {
   // A writer started earlier may still have overlapped this interval even if
   // old metadata never set the overlap flag on the selected participants.
   const ids = new Set([job.id, ...sources.map(item => item.id)]);
   if (previous.some(other => {
    if (ids.has(other.id)) return false;
    // Pre-upgrade terminal records lack completedAt. Their last persisted
    // observation must predate this chain; it does not imply task success.
    const end = Date.parse(other.completedAt ?? other.updatedAt);
    return !Number.isFinite(end) || end > Date.parse(source.createdAt);
   })) return [];
   return sources;
  }
  cursor = source;
 }
 return [];
}

/** Called only while preparing a successful immutable turn, never from chat
 * startup/preflight. The canonical baseline excludes unknown pre-existing work. */
export async function applyContributionResumption(job: ContributionJob, after: string): Promise<void> {
 if (job.resumption || job.continuationReview || !singleWriter(job) || job.succeeded !== true ||
     job.after !== after || job.before === after) return;
 const index = path.join(directory(job.id), "resumption-" + randomUUID() + ".index");
 try {
  const baseline = await committedContributionSource(job.root, job.head, index);
  const sources = consecutiveContributionSources(job, await readContributionJobs(), baseline);
  if (!sources.length) return;
  for (const source of sources) {
   if (source.before === source.after) continue;
   const interrupted = source.status === "interrupted";
   const file = path.join(directory(source.id), interrupted ? "interrupted.patch" : "change.patch");
   try {
    const patch = await fs.readFile(file, "utf8");
    if (hash(patch) !== evidenceHash(source)) throw new Error("hash");
    validateContributionPatch(patch);
    // Apply the original evidence to its own base, never to live source. This
    // also accepts historical patches whose Git object IDs were abbreviated.
    const options = { GIT_INDEX_FILE: index };
    await contributionGit(job.root, ["read-tree", source.resumption?.before ?? source.before], options);
    await contributionGit(job.root, ["apply", "--cached", file], options);
    if ((await contributionGit(job.root, ["write-tree"], options)).trim() !== source.after) throw new Error("tree");
   } catch {
    throw new ConflictError("No se pudo verificar la instantánea del turno anterior. Los cambios están conservados y necesitan revisión antes de publicarse.");
   }
  }
  const patch = await contributionGit(job.root, ["diff", "--no-ext-diff", "--full-index", "--binary", baseline, after]);
  validateContributionPatch(patch);
  job.resumption = { version: 1, before: baseline, after, patchHash: hash(patch),
   sources: sources.map(source => ({ id: source.id, before: source.before, after: source.after!, snapshotHash: evidenceHash(source) })) };
 } finally { await fs.rm(index, { force: true }); }
}

/** A durable replacement suppresses stale retries without rewriting a failed
 * task as successful. Empty replacements mean the continuation reverted it. */
export function resumedContribution(job: ContributionJob, jobs: ContributionJob[]): ContributionJob | undefined {
 return jobs.find(next => {
  const resume = next.resumption;
  if (!resume || resume.version !== 1 || next.id === job.id || !singleWriter(next) || next.succeeded !== true ||
      !completed(next) || !["pending", "blocked", "pushed", "empty"].includes(next.status) ||
      !sameContributionPrincipal(next, job) || next.conversationId !== job.conversationId || next.head !== job.head ||
      resume.after !== next.after || !resume.sources.length || resume.sources.length > 100 ||
      (next.status === "empty" ? resume.before !== resume.after || resume.patchHash !== hash("") : resume.patchHash !== next.patchHash)) return false;
  let before = resume.before;
  const seen = new Set<string>();
  for (const proof of resume.sources) {
   const source = jobs.find(candidate => candidate.id === proof.id);
   if (!source || seen.has(source.id) || !sameContributionPrincipal(source, next) || source.conversationId !== next.conversationId ||
       source.head !== next.head || proof.before !== before || source.before !== proof.before || source.after !== proof.after ||
       evidenceHash(source) !== proof.snapshotHash) return false;
   seen.add(source.id); before = proof.after;
  }
  return before === next.before && seen.has(job.id);
 });
}
