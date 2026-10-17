// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import type { ContributionJob } from "./owner-contributions.js";
import type { SessionUser } from "../types/index.js";

const config = vi.hoisted(() => ({ LUXIPANEL_CONFIG_DIR: "", LUXIPANEL_INSTALL_ROOT: "" }));
vi.mock("../../config/env.js", () => ({ env: config }));
vi.mock("./user-connection.js", () => ({ githubStatus: vi.fn(async () => ({ canEditCore: true })), githubToken: vi.fn(async () => ({ token: "unit-test", login: "Luximus", id: 80057597 })) }));
vi.mock("../logger/index.js", () => ({ createModuleLogger: () => ({ error: vi.fn(), warn: vi.fn() }) }));

const user = { userId: 1, username: "owner", kind: "local", role: "admin", modules: [] } as unknown as SessionUser;
let root: string;
let api: typeof import("./owner-contributions.js");
const noDelivery = async (): Promise<SessionUser> => { throw new Error("No external delivery in tests"); };
const sourceFile = () => path.join(root, "web/src/a.ts");
const patchFile = (job: ContributionJob) => path.join(root, "github-users/contributions", job.id, "change.patch");
const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
async function checkpoint(sourceId: string) {
 let found: ContributionJob | undefined;
 await vi.waitFor(async () => {
  found = (await api.readContributionJobs()).find(job => job.checkpoint?.sourceId === sourceId);
  expect(!!found?.patchHash || found?.status === "empty").toBe(true);
 }, { timeout: 5000, interval: 20 });
 return found!;
}
beforeEach(async () => {
 vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] }); vi.resetModules();
 root = await fs.mkdtemp(path.join(os.tmpdir(), "lxp-checkpoints-"));
 config.LUXIPANEL_CONFIG_DIR = config.LUXIPANEL_INSTALL_ROOT = root;
 git("init", "-q"); git("config", "user.name", "Test"); git("config", "user.email", "test@example.invalid");
 await fs.mkdir(path.join(root, "web/src"), { recursive: true });
 await fs.writeFile(sourceFile(), "export const a=1;\n");
 git("add", "."); git("commit", "-qm", "Baseline"); git("branch", "-M", "developer");
 api = await import("./owner-contributions.js"); await api.initializeOwnerContributions(noDelivery);
 await new Promise(resolve => setTimeout(resolve, 50));
});
afterEach(async () => {
 await new Promise(resolve => setTimeout(resolve, 80));
 vi.useRealTimers();
 await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 30 });
});

describe("completed-turn development publication", () => {
 it("queues the immutable completed turn while another worker remains active", async () => {
  const leader = await api.beginOwnerContribution(user, "leader", root, "local", true);
  const finished = await api.beginOwnerContribution(user, "finished", root, "local", true);
  const index = await fs.readFile(path.join(root, ".git/index")); const head = git("rev-parse", "HEAD");
  await fs.writeFile(sourceFile(), "export const a=2;\n");
  await api.finishOwnerContribution(finished, true);
  await fs.writeFile(sourceFile(), "export const a=3;\n");
  const saved = await checkpoint(finished!.job.id);
  const patch = await fs.readFile(patchFile(saved), "utf8");
  expect(patch).toContain("+export const a=2;"); expect(patch).not.toContain("+export const a=3;");
  expect((await api.readContributionJobs()).find(job => job.id === leader!.job.id)?.status).toBe("capturing");
  expect(await api.contributionUpdateBlocker(root, [])).toBe("assistant-active");
  expect(await fs.readFile(path.join(root, ".git/index"))).toEqual(index); expect(git("rev-parse", "HEAD")).toBe(head);
  await api.finishOwnerContribution(leader, false);
 });
 it("chains later turns without repeating published additions and preserves the interrupted task", async () => {
  const active = await api.beginOwnerContribution(user, "active", root, "local", true);
  const first = await api.beginOwnerContribution(user, "first", root, "local", true);
  await fs.writeFile(sourceFile(), "export const a=2;\n");
  await fs.writeFile(path.join(root, "web/src/new.ts"), "export const added=true;\n");
  await api.finishOwnerContribution(first, true); const a = await checkpoint(first!.job.id);
  const second = await api.beginOwnerContribution(user, "second", root, "local", true);
  await fs.writeFile(sourceFile(), "export const a=3;\n");
  await api.finishOwnerContribution(second, true); const b = await checkpoint(second!.job.id);
  expect(b.before).toBe(a.after); expect(b.checkpoint?.parentId).toBe(a.id);
  const patch = await fs.readFile(patchFile(b), "utf8");
  expect(patch).toContain("-export const a=2;"); expect(patch).not.toContain("web/src/new.ts");
  const options = { GIT_INDEX_FILE: path.join(root, "delivery.index") };
  await api.contributionGit(root, ["read-tree", a.head], options);
  await api.contributionGit(root, ["apply", "--cached", patchFile(a)], options);
  await api.contributionGit(root, ["apply", "--cached", patchFile(b)], options);
  expect((await api.contributionGit(root, ["write-tree"], options)).trim()).toBe(b.after);
  await api.finishOwnerContribution(active, false);
  const failed = (await api.readContributionJobs()).find(job => job.id === active!.job.id)!;
  expect(failed.status).toBe("interrupted"); expect(failed.succeeded).toBe(false); expect(failed.includedIn).toBeUndefined();
 });
 it("does not let a prior interrupted member prevent a later completed snapshot", async () => {
  const live = await api.beginOwnerContribution(user, "live", root, "local", true);
  const interrupted = await api.beginOwnerContribution(user, "interrupted", root, "local", true);
  await api.finishOwnerContribution(interrupted, false);
  const repair = await api.beginOwnerContribution(user, "repair", root, "local", true);
  await fs.writeFile(sourceFile(), "export const a=4;\n"); await api.finishOwnerContribution(repair, true);
  const saved = await checkpoint(repair!.job.id);
  expect(saved.checkpoint?.members).not.toContain(interrupted!.job.id);
  expect((await api.readContributionJobs()).find(job => job.id === interrupted!.job.id)).toMatchObject({ status: "interrupted", succeeded: false });
  await api.finishOwnerContribution(live, false);
 });
 it("does not mix principals or change the live participant's status", async () => {
  const live = await api.beginOwnerContribution(user, "live", root, "local", true);
  const foreign = await api.beginOwnerContribution({ ...user, userId: 2 }, "foreign", root, "local", true);
  await fs.writeFile(sourceFile(), "export const a=2;\n"); await api.finishOwnerContribution(foreign, true);
  await vi.waitFor(async () => expect((await api.readContributionJobs()).find(job => job.id === foreign!.job.id)?.status).toBe("blocked"));
  expect((await api.readContributionJobs()).some(job => job.checkpoint)).toBe(false);
  expect((await api.readContributionJobs()).find(job => job.id === live!.job.id)?.status).toBe("capturing");
  await api.finishOwnerContribution(live, false);
 });
 it("retains the worker's verification gate without retaining unrelated successful turns", async () => {
  const worker = await api.beginOwnerContribution(user, "worker", root, "local", true);
  worker!.job.teamTaskId = "task"; await api.saveContribution(worker!.job);
  const other = await api.beginOwnerContribution(user, "other", root, "local", true);
  await fs.writeFile(sourceFile(), "export const a=2;\n");
  expect(await api.finishOwnerContribution(worker, true)).toBeNull();
  await api.finishOwnerContribution(other, true); await checkpoint(other!.job.id);
  expect((await api.readContributionJobs()).find(job => job.id === worker!.job.id)?.status).toBe("capturing");
  await api.finishOwnerTeamContribution("worker", "task", true); await checkpoint(worker!.job.id);
 });
 it("reuses a durable checkpoint during later outbox scans", async () => {
  const live = await api.beginOwnerContribution(user, "live", root, "local", true);
  const done = await api.beginOwnerContribution(user, "done", root, "local", true);
  await fs.writeFile(sourceFile(), "export const a=2;\n"); await api.finishOwnerContribution(done, true);
  const saved = await checkpoint(done!.job.id);
  await api.recoverClosedContributionBatches(); await api.recoverClosedContributionBatches();
  expect((await api.readContributionJobs()).filter(job => job.checkpoint?.sourceId === done!.job.id).map(job => job.id)).toEqual([saved.id]);
  await api.finishOwnerContribution(live, false);
 });
 it("allows a corrected completed turn after an earlier snapshot failed validation", async () => {
  const live = await api.beginOwnerContribution(user, "live", root, "local", true);
  const rejected = await api.beginOwnerContribution(user, "rejected", root, "local", true);
  await fs.writeFile(sourceFile(), `export const secret="${"test".repeat(8)}";\n`);
  await api.finishOwnerContribution(rejected, true);
  let blocked: ContributionJob | undefined;
  await vi.waitFor(async () => {
   blocked = (await api.readContributionJobs()).find(job => job.checkpoint?.sourceId === rejected!.job.id);
   expect(blocked?.status).toBe("blocked");
  });
  expect(blocked!.patchHash).toBeUndefined();
  const corrected = await api.beginOwnerContribution(user, "corrected", root, "local", true);
  await fs.writeFile(sourceFile(), "export const a=2;\n");
  await api.finishOwnerContribution(corrected, true);
  const saved = await checkpoint(corrected!.job.id);
  expect(saved.checkpoint?.parentId).toBeUndefined();
  expect(saved.checkpoint?.members).toContain(rejected!.job.id);
  expect(await fs.readFile(patchFile(saved), "utf8")).toContain("+export const a=2;");
  expect((await api.readContributionJobs()).find(job => job.id === blocked!.id)?.status).toBe("blocked");
  await api.finishOwnerContribution(live, false);
 });
 it.each(["missing", "pending", "blocked", "pushed", "empty"])("checks a %s predecessor before sending the dependent snapshot", async status => {
  const { checkpointDependencyReady } = await import("./contribution-checkpoints.js");
  const parent = { id: "parent", status } as ContributionJob;
  const child = { checkpoint: { parentId: "parent" } } as ContributionJob;
  expect(checkpointDependencyReady(child, status === "missing" ? [] : [parent])).toBe(status === "pushed" || status === "empty");
 });
 it("does not skip an unpublished predecessor through an empty turn", async () => {
  const { checkpointDependencyReady } = await import("./contribution-checkpoints.js");
  const first = { id: "first", status: "pending" } as ContributionJob;
  const empty = { id: "empty", status: "empty", checkpoint: { parentId: "first" } } as ContributionJob;
  const next = { checkpoint: { parentId: "empty" } } as ContributionJob;
  expect(checkpointDependencyReady(next, [first, empty])).toBe(false);
  first.status = "pushed";
  expect(checkpointDependencyReady(next, [first, empty])).toBe(true);
  first.status = "empty"; first.checkpoint = { parentId: "empty" } as ContributionJob["checkpoint"];
  expect(checkpointDependencyReady(next, [first, empty])).toBe(false);
 });
});
