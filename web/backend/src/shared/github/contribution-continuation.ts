// SPDX-License-Identifier: AGPL-3.0-only
/** Explicit assistant review of a repaired workspace. Publication still belongs to turn completion. */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { ConflictError, ForbiddenError } from "../errors/index.js";
import type { SessionUser } from "../types/index.js";
import { sameContributionPrincipal } from "./contribution-batches.js";
import { verifiedContributionInterruption } from "./contribution-review.js";
import { captureSource, contributionGit, publishablePath, publisherLock, reviewedContribution, validateContributionPatch, type ContributionJob } from "./owner-contributions.js";

export interface ContributionContinuationReview {
 version: 1; contributionId: string; sourceId: string; sourceHash: string;
 head: string; publicationBase?: string; before: string; after: string; patchHash: string; reviewedAt: string;
 sources: Array<{ id: string; snapshotHash: string }>;
}
const directory = (id: string) => path.join(env.LUXIPANEL_CONFIG_DIR, "github-users", "contributions", id);
const hash = (text: string) => createHash("sha256").update(text).digest("hex");

/** Read the committed public-source baseline without staging or checking out any files. */
export async function committedContributionSource(root: string, head: string, index: string): Promise<string> {
 const options = { GIT_INDEX_FILE: index };
 await contributionGit(root, ["read-tree", head], options);
 const excluded = (await contributionGit(root, ["ls-files", "-z"], options)).split("\0").filter(file => file && !publishablePath(file));
 for (let offset = 0; offset < excluded.length; offset += 100)
  await contributionGit(root, ["update-index", "--force-remove", "--", ...excluded.slice(offset, offset + 100)], options);
 return (await contributionGit(root, ["write-tree"], options)).trim();
}

/** An explicitly selected published contribution can be newer than the local
 * checkout. Keep that checkout untouched and retain its separate identity. */
async function verifiedPublicationBase(job: ContributionJob, jobs: ContributionJob[], requested?: string): Promise<string> {
 const base = requested ?? job.head;
 if (!/^[a-f0-9]{40}$/.test(base) || (base !== job.head && !jobs.some(candidate =>
   sameContributionPrincipal(candidate, job) && candidate.status === "pushed" && !candidate.isolated && candidate.commit === base)))
  throw new ConflictError("La base seleccionada no corresponde a un aporte publicado de esta identidad.");
 try { await contributionGit(job.root, ["merge-base", "--is-ancestor", job.head, base]); }
 catch { throw new ConflictError("La base publicada no continúa el historial local revisado."); }
 return base;
}

async function preview(user: SessionUser, sourceIds: string | string[], contributionId: string, requestedBase?: string) {
 const ids = [...new Set(typeof sourceIds === "string" ? [sourceIds] : sourceIds)];
 if (!ids.length || ids.length > 20) throw new ConflictError("Selecciona entre una y veinte instantáneas para revisar.");
 const verified = await Promise.all(ids.map(id => verifiedContributionInterruption(user, id)));
 const { job: source, jobs, snapshot } = verified[0]!;
 const job = jobs.find(candidate => candidate.id === contributionId);
 if (!job || verified.some(item => !sameContributionPrincipal(item.job, job))) throw new ForbiddenError();
 if (verified.some(item => reviewedContribution(item.job, jobs))) throw new ConflictError("Una de las instantáneas ya tiene una recuperación registrada.");
 if (job.status !== "capturing" || job.isolated || job.overlapped || job.teamTaskId || job.includedIn || job.batchId !== job.id ||
     jobs.some(other => other.id !== job.id && other.root === job.root && other.status === "capturing"))
  throw new ConflictError("Espera a que terminen los demás escritores antes de revisar la recuperación en este turno.");
 if ((await contributionGit(job.root, ["branch", "--show-current"])).trim() !== "developer" ||
     (await contributionGit(job.root, ["rev-parse", "HEAD"])).trim() !== job.head)
  throw new ConflictError("La revisión local cambió durante la tarea. Conserva los cambios y revisa de nuevo.");
 const index = path.join(directory(job.id), "continuation-" + randomUUID() + ".index");
 try {
  const publicationBase = await verifiedPublicationBase(job, jobs, requestedBase);
  const before = await committedContributionSource(job.root, publicationBase, index);
  const after = await captureSource(job.root, index);
  const files = (await contributionGit(job.root, ["diff", "--name-only", "-z", before, after])).split("\0").filter(Boolean);
  if (!files.length || files.some(file => !publishablePath(file) || file.startsWith("web/modules/")))
   throw new ConflictError("La recuperación no contiene código pendiente del núcleo que pueda enviarse por este flujo.");
  const patch = await contributionGit(job.root, ["diff", "--no-ext-diff", "--full-index", "--binary", before, after]);
  validateContributionPatch(patch);
  await contributionGit(job.root, ["diff", "--check", before, after]);
  const review: ContributionContinuationReview = {
   version: 1, contributionId: job.id, sourceId: source.id, sourceHash: snapshot.snapshotHash,
   head: job.head, publicationBase, before, after, patchHash: hash(patch), reviewedAt: new Date().toISOString(),
   sources: verified.map(item => ({ id: item.job.id, snapshotHash: item.snapshot.snapshotHash })),
  };
  return { review, files, patch };
 } finally { await fs.rm(index, { force: true }); }
}

/** The preview includes ALL pending public source, including the dependency baseline left by the interrupted worker. */
export async function previewContributionContinuation(user: SessionUser, sourceIds: string | string[], contributionId: string, publicationBase?: string) {
 return preview(user, sourceIds, contributionId, publicationBase);
}

/** Called only after the assistant has explicitly reviewed and validated this exact preview. No delivery is queued here. */
export async function reviewContributionContinuation(user: SessionUser, sourceIds: string | string[], contributionId: string, patchHash: string, publicationBase?: string) {
 const unlock = await publisherLock();
 if (!unlock) throw new ConflictError("El panel está procesando aportes. Vuelve a intentarlo en unos instantes.");
 try {
  const result = await preview(user, sourceIds, contributionId, publicationBase);
  if (patchHash !== result.review.patchHash) throw new ConflictError("Los archivos cambiaron después de la revisión. Verifica de nuevo el conjunto completo.");
  const job = (await verifiedContributionInterruption(user, result.review.sourceId)).jobs.find(job => job.id === contributionId)!;
  await contributionGit(job.root, ["update-ref", `refs/luxipanel/snapshots/${contributionId}-reviewed-before`, result.review.before]);
  await contributionGit(job.root, ["update-ref", `refs/luxipanel/snapshots/${contributionId}-reviewed-after`, result.review.after]);
  const file = path.join(directory(contributionId), "continuation-review.json"), temporary = file + "." + randomUUID();
  await fs.writeFile(temporary, JSON.stringify(result.review), { mode: 0o600 });
  await fs.rename(temporary, file);
  return { id: contributionId, patchHash };
 } finally { unlock(); }
}

/** A failed turn or a later edit cannot consume the review or clear the original interruption. */
export async function applyContributionContinuation(job: ContributionJob, after: string): Promise<void> {
 const file = path.join(directory(job.id), "continuation-review.json");
 const content = await fs.readFile(file, "utf8").catch(error => { if (error.code === "ENOENT") return null; throw error; });
 if (!content) return;
 const review = JSON.parse(content) as ContributionContinuationReview;
 if (review.version !== 1 || review.contributionId !== job.id || review.head !== job.head || review.after !== after ||
     job.succeeded !== true || job.overlapped || job.isolated || job.teamTaskId || job.batchId !== job.id ||
     !Array.isArray(review.sources) || !review.sources.length || review.sources.length > 20 ||
     review.sources[0]?.id !== review.sourceId || review.sources[0]?.snapshotHash !== review.sourceHash)
  throw new ConflictError("La tarea cambió después de revisar la recuperación. Los cambios siguen conservados y requieren una nueva comprobación.");
 const { job: source, snapshot, jobs } = await verifiedContributionInterruption(job.user, review.sourceId);
 if (!sameContributionPrincipal(source, job) || snapshot.snapshotHash !== review.sourceHash)
  throw new ForbiddenError();
 for (const item of review.sources) {
  const verified = await verifiedContributionInterruption(job.user, item.id);
  if (!sameContributionPrincipal(verified.job, job) || verified.snapshot.snapshotHash !== item.snapshotHash || reviewedContribution(verified.job, verified.jobs))
   throw new ForbiddenError();
 }
 const index = path.join(directory(job.id), "reviewed-baseline-" + randomUUID() + ".index");
 try {
  const publicationBase = await verifiedPublicationBase(job, jobs, review.publicationBase);
  if (await committedContributionSource(job.root, publicationBase, index) !== review.before) throw new ConflictError("La base revisada no coincide con el proyecto.");
 } finally { await fs.rm(index, { force: true }); }
 const patch = await contributionGit(job.root, ["diff", "--no-ext-diff", "--full-index", "--binary", review.before, review.after]);
 if (hash(patch) !== review.patchHash) throw new ConflictError("La integridad de la recuperación cambió.");
 validateContributionPatch(patch);
 job.continuationReview = review;
 job.recoveryOf = source.id; job.reviewedAt = review.reviewedAt;
}
