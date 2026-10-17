// SPDX-License-Identifier: AGPL-3.0-only
/** Review immutable evidence, then queue a separate delivery. Never approve a failed run. */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { ConflictError, ForbiddenError } from "../errors/index.js";
import type { SessionUser } from "../types/index.js";
import { assertPublishableSource } from "../diagnostics/publication-check.js";
import { collectChangeNotes } from "./change-notes.js";
import { githubStatus } from "./user-connection.js";
import { captureSource, contributionGit, coreRepository, publishablePath, publisherLock, readContributionJobs, requestContributionDelivery, reviewedContribution, saveContribution, validateContributionPatch, type ContributionJob } from "./owner-contributions.js";

const directory = (id: string) => path.join(env.LUXIPANEL_CONFIG_DIR, "github-users", "contributions", id);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

async function ownedInterruption(user: SessionUser, id: string) {
 if (!/^[a-f0-9-]{36}$/.test(id) || !(await githubStatus(user)).canEditCore) throw new ForbiddenError();
 const jobs = await readContributionJobs(), job = jobs.find(row => row.id === id);
 if (!job || job.user.userId !== user.userId || job.user.username !== user.username || job.user.kind !== user.kind) throw new ForbiddenError();
 if (job.status !== "interrupted" || job.isolated || job.includedIn || job.overlapped || job.patchHash || job.commit || !job.completedAt || job.succeeded !== false || !job.interruption?.patchHash || !/^[a-f0-9]{40}$/.test(job.before) || !/^[a-f0-9]{40}$/.test(job.after ?? ""))
  throw new ConflictError("Esta tarea necesita completarse en el asistente antes de publicar sus cambios.");
 if (await fs.realpath(job.root) !== await fs.realpath(coreRepository())) throw new ForbiddenError();
 return { job, jobs };
}

async function evidence(job: ContributionJob) {
 const patch = await fs.readFile(path.join(directory(job.id), "interrupted.patch"), "utf8");
 const snapshotHash = hash(patch);
 if (snapshotHash !== job.interruption?.patchHash) throw new ConflictError("La instantánea cambió. Revisa de nuevo los cambios conservados.");
 validateContributionPatch(patch);
 const regenerated = await contributionGit(job.root, ["diff", "--no-ext-diff", "--full-index", "--binary", job.before, job.after!]);
 if (regenerated !== patch) throw new ConflictError("La instantánea no coincide con los cambios conservados.");
 const files = (await contributionGit(job.root, ["diff", "--name-only", "-z", job.before, job.after!])).split("\0").filter(Boolean);
 if (!files.length || files.some(file => !publishablePath(file) || file.startsWith("web/modules/"))) throw new ConflictError("La instantánea contiene rutas que requieren otro flujo de revisión.");
 for (const file of files) {
  const entry = (await contributionGit(job.root, ["ls-tree", job.after!, "--", file])).trim();
  if (entry && !/^100(?:644|755) blob /.test(entry)) throw new ConflictError("La instantánea contiene un archivo que no es código regular.");
  if (entry) assertPublishableSource(await contributionGit(job.root, ["show", job.after! + ":" + file]));
 }
 return { id: job.id, snapshotHash, files, patch };
}

export async function previewContributionRecovery(user: SessionUser, id: string) {
 const { job } = await ownedInterruption(user, id);
 return evidence(job);
}

export async function reviewContributionRecovery(user: SessionUser, id: string, snapshotHash: string): Promise<{ id: string }> {
 // Also excludes a second reviewer and the background publisher across processes.
 const unlock = await publisherLock();
 if (!unlock) throw new ConflictError("El panel está procesando aportes. Vuelve a intentarlo en unos instantes.");
 let index: string | undefined;
 try {
  const { job, jobs } = await ownedInterruption(user, id);
  const snapshot = await evidence(job);
  if (snapshotHash !== snapshot.snapshotHash) throw new ConflictError("La instantánea cambió. Revisa de nuevo los cambios conservados.");
  const existing = reviewedContribution(job, jobs);
  if (existing) return { id: existing.id }; // Lost HTTP response: never queue twice.
  if ((await contributionGit(job.root, ["branch", "--show-current"])).trim() !== "developer") throw new ConflictError("La recuperación requiere la rama developer.");
  index = path.join(directory(id), "review-" + randomUUID() + ".index");
  const current = await captureSource(job.root, index);
  for (let i = 0; i < snapshot.files.length; i += 100) {
   if ((await contributionGit(job.root, ["diff", "--name-only", current, job.after!, "--", ...snapshot.files.slice(i, i + 100)])).trim())
    throw new ConflictError("Estos archivos cambiaron después de la interrupción. Completa su revisión en el asistente para conservar también los cambios posteriores.");
  }
  await contributionGit(job.root, ["diff", "--check", job.before, job.after!]);
  const notes = await collectChangeNotes(snapshot.files, async file => {
   const present = (await contributionGit(job.root, ["ls-tree", "--name-only", job.after!, "--", file])).trim();
   return present ? contributionGit(job.root, ["show", job.after! + ":" + file]) : "";
  });
  const now = new Date().toISOString();
  const recovery: ContributionJob = { id: randomUUID(), root: job.root, user: job.user, conversationId: job.conversationId,
   before: job.before, after: job.after, head: job.head, status: "pending", createdAt: now, updatedAt: now,
   recoveryOf: job.id, reviewedAt: now, files: snapshot.files, patchHash: snapshotHash, notes };
  await fs.mkdir(directory(recovery.id), { recursive: true, mode: 0o700 });
  await fs.writeFile(path.join(directory(recovery.id), "change.patch"), snapshot.patch, { mode: 0o600 });
  await saveContribution(recovery); // Durable queue first; a crash cannot lose or duplicate it.
  job.recoveredBy = recovery.id;
  await saveContribution(job);
  return { id: recovery.id };
 } finally {
  if (index) await fs.rm(index, { force: true });
  unlock(); requestContributionDelivery();
 }
}
