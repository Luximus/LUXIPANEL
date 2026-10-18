// SPDX-License-Identifier: AGPL-3.0-only
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import type { ContributionJob } from "./owner-contributions.js";
import type { SessionUser } from "../types/index.js";

const config = vi.hoisted(() => ({ LUXIPANEL_CONFIG_DIR: "", LUXIPANEL_INSTALL_ROOT: "" }));
vi.mock("../../config/env.js", () => ({ env: config }));
vi.mock("./user-connection.js", () => ({ githubStatus: vi.fn(async () => ({ canEditCore: true })), githubToken: vi.fn(async () => ({ token: "unit-test", login: "Luximus", id: 80057597 })) }));
vi.mock("../logger/index.js", () => ({ createModuleLogger: () => ({ error: vi.fn(), warn: vi.fn() }) }));

const user = { userId: 1, username: "owner", kind: "local", role: "admin", modules: [] } as unknown as SessionUser;
let root: string, api: typeof import("./owner-contributions.js");
const noDelivery = async (): Promise<SessionUser> => { throw new Error("No external delivery in tests"); };
const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const file = (name: string) => path.join(root, "web/src", name);
const directory = (id: string) => path.join(root, "github-users/contributions", id);
const saved = async (id: string): Promise<ContributionJob> => JSON.parse(await fs.readFile(path.join(directory(id), "job.json"), "utf8"));
const begin = async (conversationId = "chat", owner = user) => (await api.beginOwnerContribution(owner, conversationId, root, "local", true))!;
async function interrupted() {
 const first = await begin();
 await fs.writeFile(file("new.ts"), "export const added=1;\n");
 await api.finishOwnerContribution(first, false);
 return first;
}
async function waitDelivery(id: string) {
 await vi.waitFor(async () => expect((await saved(id)).status).toBe("blocked"), { timeout: 5000 });
}
beforeEach(async () => {
 vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] }); vi.resetModules();
 root = await fs.mkdtemp(path.join(os.tmpdir(), "lxp-resumption-"));
 config.LUXIPANEL_CONFIG_DIR = config.LUXIPANEL_INSTALL_ROOT = root;
 git("init", "-q"); git("config", "user.name", "Test"); git("config", "user.email", "test@example.invalid");
 await fs.mkdir(path.join(root, "web/src"), { recursive: true });
 await fs.writeFile(file("a.ts"), "export const a=1;\n");
 git("add", "."); git("commit", "-qm", "Baseline"); git("branch", "-M", "developer");
 api = await import("./owner-contributions.js"); await api.initializeOwnerContributions(noDelivery);
 await new Promise(resolve => setTimeout(resolve, 40));
});
afterEach(async () => {
 await new Promise(resolve => setTimeout(resolve, 80)); vi.useRealTimers();
 await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 30 });
});

describe("automatic publication of consecutive chat continuations", () => {
 it("publishes new dependencies and later fixes after an interruption, legacy blocked delta and read-only turns", async () => {
  const first = await interrupted();
  const evidence = await fs.readFile(path.join(directory(first.job.id), "interrupted.patch"), "utf8");
  const middle = await begin();
  await fs.writeFile(file("new.ts"), "export const added=2;\n"); await api.finishOwnerContribution(middle, false);
  // Reproduce the old successful publisher's incomplete delta, before this fix.
  const legacy = await saved(middle.job.id);
  const delta = await api.contributionGit(root, ["diff", "--no-ext-diff", "--binary", legacy.before, legacy.after!]);
  legacy.status = "blocked"; legacy.succeeded = true; delete legacy.interruption;
  legacy.patchHash = createHash("sha256").update(delta).digest("hex");
  await fs.writeFile(path.join(directory(legacy.id), "change.patch"), delta); await api.saveContribution(legacy);
  const quiet = await begin(); await api.finishOwnerContribution(quiet, true);
  const canceled = await begin(); await api.finishOwnerContribution(canceled, false);
  const current = await begin();
  const index = await fs.readFile(path.join(root, ".git/index")), head = git("rev-parse", "HEAD");
  await fs.writeFile(file("new.ts"), "export const added=3;\n");
  await fs.writeFile(file("a.ts"), "export const a=2;\n");
  await api.finishOwnerContribution(current, true); await waitDelivery(current.job.id);
  const job = await saved(current.job.id), jobs = await api.readContributionJobs();
  expect(job.resumption?.sources.map(source => source.id)).toEqual([first.job.id, middle.job.id, quiet.job.id, canceled.job.id]);
  expect(api.reviewedContribution(first.job, jobs)?.id).toBe(job.id);
  expect(api.reviewedContribution(legacy, jobs)?.id).toBe(job.id);
  await expect(api.retryOwnerContribution(user, legacy.id)).rejects.toThrow("continuación");
  const patch = await fs.readFile(path.join(directory(job.id), "change.patch"), "utf8");
  expect(patch).toContain("new file mode"); expect(patch).toContain("+export const added=3;");
  expect(await saved(first.job.id)).toMatchObject({ status: "interrupted", succeeded: false });
  expect(await fs.readFile(path.join(directory(first.job.id), "interrupted.patch"), "utf8")).toBe(evidence);
  // Exercise the actual panel publisher against a local test remote only.
  const remote = path.join(root, "remote.git"); git("init", "--bare", "-q", remote); git("push", "-q", remote, "HEAD:refs/heads/developer");
  await api.deliverContribution(job, remote, async () => user);
  expect(git("--git-dir=" + remote, "show", "developer:web/src/new.ts")).toBe("export const added=3;");
  expect(git("--git-dir=" + remote, "show", "developer:web/src/a.ts")).toBe("export const a=2;");
  const published = git("--git-dir=" + remote, "rev-parse", "developer");
  await api.deliverContribution(job, remote, async () => user);
  expect(git("--git-dir=" + remote, "rev-parse", "developer")).toBe(published);
  expect(git("rev-parse", "HEAD")).toBe(head); expect(await fs.readFile(path.join(root, ".git/index"))).toEqual(index);
 });

 it.each([true, false])("does not publish an interrupted baseline from a read-only turn, success=%s", async success => {
  const first = await interrupted(), current = await begin();
  await api.finishOwnerContribution(current, success);
  expect((await saved(current.job.id)).resumption).toBeUndefined();
  expect((await saved(current.job.id)).patchHash).toBeUndefined();
  expect(api.reviewedContribution(first.job, await api.readContributionJobs())).toBeUndefined();
 });

 it.each(["conversation", "identity", "kind", "head", "untracked-gap", "unknown-baseline", "overlap", "intervening-chat", "missing-evidence"])("does not absorb an ambiguous %s boundary", async reason => {
  if (reason === "unknown-baseline") await fs.writeFile(file("preexisting.ts"), "export const external=true;\n");
  const first = await interrupted();
  if (["head", "overlap", "missing-evidence"].includes(reason)) {
   const old = await saved(first.job.id);
   if (reason === "head") old.head = "a".repeat(40);
   if (reason === "overlap") old.overlapped = true;
   if (reason === "missing-evidence") delete old.interruption;
   await api.saveContribution(old);
  }
  if (reason === "intervening-chat") { const other = await begin("other-chat"); await api.finishOwnerContribution(other, true); }
  if (reason === "untracked-gap") await fs.writeFile(file("external.ts"), "export const external=true;\n");
  const owner = reason === "identity" ? { ...user, userId: 2 } : reason === "kind" ? { ...user, kind: "external" as SessionUser["kind"] } : user;
  const current = await begin(reason === "conversation" ? "other-chat" : "chat", owner);
  await fs.writeFile(file("a.ts"), "export const a=2;\n"); await api.finishOwnerContribution(current, true); await waitDelivery(current.job.id);
  expect((await saved(current.job.id)).resumption).toBeUndefined();
  expect(api.reviewedContribution(await saved(first.job.id), await api.readContributionJobs())).toBeUndefined();
  expect(await fs.readFile(path.join(directory(current.job.id), "change.patch"), "utf8")).not.toContain("web/src/new.ts");
 });

 it.each(["hash", "tree"])("blocks corrupted %s evidence without queuing a partial replacement", async reason => {
  const first = await interrupted(), old = await saved(first.job.id);
  const evidenceFile = path.join(directory(first.job.id), "interrupted.patch");
  const tampered = (await fs.readFile(evidenceFile, "utf8")).replace("added=1", "added=9");
  await fs.writeFile(evidenceFile, tampered);
  if (reason === "tree") { old.interruption!.patchHash = createHash("sha256").update(tampered).digest("hex"); await api.saveContribution(old); }
  const current = await begin(); await fs.writeFile(file("new.ts"), "export const added=2;\n");
  await api.finishOwnerContribution(current, true);
  const rejected = await saved(current.job.id);
  expect(rejected.status).toBe("blocked"); expect(rejected.patchHash).toBeUndefined();
  expect(api.reviewedContribution(old, await api.readContributionJobs())).toBeUndefined();
 });

 it("reconciles a reverted interruption without publishing or retrying its old delta", async () => {
  const first = await interrupted(), current = await begin();
  await fs.rm(file("new.ts")); await api.finishOwnerContribution(current, true);
  const job = await saved(current.job.id);
  expect(job.status).toBe("empty"); expect(job.patchHash).toBeUndefined();
  expect(api.reviewedContribution(first.job, await api.readContributionJobs())?.id).toBe(job.id);
 });

 it("preserves a complete immutable patch across restart and later live edits", async () => {
  const first = await interrupted(), current = await begin();
  const descriptor = { conversationId: "chat", jobId: "resumed-cli", startedAt: Date.now(), moduleRecovery: "signed" };
  await api.bindOwnerContributionCli(user, descriptor, "local");
  await fs.writeFile(file("new.ts"), "export const added=2;\n");
  vi.resetModules(); api = await import("./owner-contributions.js");
  await api.initializeOwnerContributions(noDelivery, async job => job.cliBinding === api.contributionCliBinding(descriptor));
  const resumed = await api.recoverOwnerContribution(user, descriptor, "local"); expect(resumed?.job.id).toBe(current.job.id);
  await api.finishOwnerContribution(resumed, true); await waitDelivery(current.job.id);
  const job = await saved(current.job.id), patchFile = path.join(directory(job.id), "change.patch");
  const patch = await fs.readFile(patchFile, "utf8");
  await fs.writeFile(file("new.ts"), "export const added=99;\n");
  await api.recoverClosedContributionBatches(); await api.recoverClosedContributionBatches();
  expect(await fs.readFile(patchFile, "utf8")).toBe(patch); expect(patch).not.toContain("added=99");
  expect(api.reviewedContribution(first.job, await api.readContributionJobs())?.id).toBe(job.id);
 });

 it("combines a second successful continuation without re-enqueuing the first", async () => {
  const first = await interrupted(), middle = await begin();
  await fs.writeFile(file("new.ts"), "export const added=2;\n"); await api.finishOwnerContribution(middle, true); await waitDelivery(middle.job.id);
  const current = await begin(); await fs.writeFile(file("new.ts"), "export const added=3;\n");
  await api.finishOwnerContribution(current, true); await waitDelivery(current.job.id);
  const job = await saved(current.job.id);
  expect(job.resumption?.sources.map(source => source.id)).toEqual([first.job.id, middle.job.id]);
  expect(api.reviewedContribution(await saved(middle.job.id), await api.readContributionJobs())?.id).toBe(job.id);
  const prior = await saved(middle.job.id), attempts = prior.attempt;
  prior.status = "pending"; prior.nextAttempt = 0; await api.saveContribution(prior);
  api.requestContributionDelivery();
  await new Promise(resolve => setTimeout(resolve, 100));
  expect((await saved(prior.id)).attempt).toBe(attempts);
  expect((await api.listOwnerContributions(user)).find(row => row.id === prior.id)).toMatchObject({ canRetry: false, recoveredBy: job.id });
 });

 it("keeps a failed continuation interrupted even when its snapshots match", async () => {
  const first = await interrupted(), current = await begin();
  await fs.writeFile(file("new.ts"), "export const added=2;\n"); await api.finishOwnerContribution(current, false);
  const failed = await saved(current.job.id);
  expect(failed).toMatchObject({ status: "interrupted", succeeded: false });
  expect(failed.resumption).toBeUndefined(); expect(failed.patchHash).toBeUndefined();
  expect(api.reviewedContribution(first.job, await api.readContributionJobs())).toBeUndefined();
 });

 it.each([false, true])("handles legacy records without completedAt, possible overlap=%s", async overlaps => {
  const first = await interrupted(), started = Date.parse(first.job.createdAt);
  const legacy = { ...first.job, id: randomUUID(), status: "blocked" as const, completedAt: undefined,
   createdAt: new Date(started - 1000).toISOString(), updatedAt: new Date(started + (overlaps ? 1 : -1)).toISOString() };
  await fs.mkdir(directory(legacy.id)); await fs.writeFile(path.join(directory(legacy.id), "job.json"), JSON.stringify(legacy));
  const current = await begin(); await fs.writeFile(file("a.ts"), "export const a=2;\n");
  await api.finishOwnerContribution(current, true); await waitDelivery(current.job.id);
  expect(Boolean((await saved(current.job.id)).resumption)).toBe(!overlaps);
  expect((await saved(legacy.id)).status).toBe("blocked");
 });

 it("keeps conflicting remote changes blocked without overwriting either version", async () => {
  const first = await begin(); await fs.writeFile(file("a.ts"), "export const a=2;\n"); await api.finishOwnerContribution(first, false);
  const current = await begin(); await fs.writeFile(file("a.ts"), "export const a=3;\n");
  await api.finishOwnerContribution(current, true); await waitDelivery(current.job.id);
  const job = await saved(current.job.id), remote = path.join(root, "remote.git"); git("init", "--bare", "-q", remote);
  const remoteIndex = path.join(root, "remote.index"), options = { GIT_INDEX_FILE: remoteIndex };
  await api.contributionGit(root, ["read-tree", job.head], options);
  await fs.writeFile(file("a.ts"), "export const a=77;\n");
  await api.contributionGit(root, ["add", "web/src/a.ts"], options);
  const tree = (await api.contributionGit(root, ["write-tree"], options)).trim();
  const commit = (await api.contributionGit(root, ["commit-tree", tree, "-p", job.head, "-m", "Remote conflict"])).trim();
  git("push", "-q", remote, commit + ":refs/heads/developer");
  await expect(api.deliverContribution(job, remote, async () => user)).rejects.toMatchObject({ code: "patch-conflict" });
  expect(git("--git-dir=" + remote, "rev-parse", "developer")).toBe(commit);
  expect(await fs.readFile(file("a.ts"), "utf8")).toBe("export const a=77;\n");
 });
});
