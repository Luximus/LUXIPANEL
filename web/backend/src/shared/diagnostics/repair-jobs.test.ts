import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const settings = vi.hoisted(() => ({ LUXIPANEL_CONFIG_DIR: "/tmp", LOG_LEVEL: "silent", NODE_ENV: "test" }));
vi.mock("../../config/env.js", () => ({ env: settings }));
vi.mock("../executor/index.js", async () => ({ ...(await import("../executor/local-executor.js")), ...(await import("../executor/quote.js")) }));
const { localExecutor } = await import("../executor/local-executor.js");
const originalExec = localExecutor.exec.bind(localExecutor);
const { RepairJobs } = await import("./repair-jobs.js");
const { repairBridge } = await import("./repair-bridge.js");
const { diagnosticsStore } = await import("./store.js");
const { DEFAULT_LOGS_CONFIG } = await import("./types.js");
const { logsRepairTools } = await import("../../modules/module-dev/services/logs-tools.js");
const exec = promisify(execFile);
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "lxp-repair-job-tests-"));
const user = { userId: 1, username: "test-admin", displayName: "Test", role: "admin", kind: "admin", local: true, modules: ["module-dev", "ai-assistant"] } as const;
let sequence = 0; let repo: string; let remote: string; let jobs: InstanceType<typeof RepairJobs>; let incidentId: string;
let failCheck = false; let failPr = false; let changes = true; let manual = false;
let missingFork = false; let sourceContent = "export const fixed = true;\n";
let published = false; let runs = 0;
const apiMock = vi.fn();
beforeEach(async () => {
  const dir = path.join(temp, String(++sequence)); await fs.mkdir(dir);
  settings.LUXIPANEL_CONFIG_DIR = path.join(dir, "config"); repo = path.join(dir, "repo"); remote = path.join(dir, "remote.git");
  await exec("git", ["init", "--bare", remote]); await exec("git", ["init", "-b", "main", repo]);
  await fs.writeFile(path.join(repo, "source.ts"), "export const broken = true;\n");
  await fs.writeFile(path.join(repo, ".gitignore"), ".lxp/\n");
  await exec("git", ["add", "."], { cwd: repo }); await exec("git", ["-c", "user.name=Test", "-c", "user.email=test@example.test", "commit", "-m", "base"], { cwd: repo });
  await exec("git", ["push", remote, "main"], { cwd: repo });
  failCheck = failPr = manual = missingFork = false; sourceContent = "export const fixed = true;\n"; changes = true; published = false; runs = 0; apiMock.mockReset();
  vi.spyOn(localExecutor, "exec").mockImplementation(async (cmd, opts) => {
    if (cmd.startsWith("pnpm ")) return { exitCode: failCheck && cmd.includes("typecheck") ? 1 : 0, stdout: "verified", stderr: "", durationMs: 0 };
    return originalExec(cmd.replace(/https:\/\/github\.com\/(?:Luxisoft|contributor)\/LUXIPANEL\.git/g, remote), opts);
  });
  repairBridge.registerGithub({ options: async () => ({ credentials: [{ id: "test-credential", label: "Test" }], authenticated: true }), withAuth: async (_id, fn) => fn({ env: {}, api: async (method, route, body) => {
    apiMock(method, route, body);
    if (route === "/user") return { login: "contributor", id: 123 };
    if (route === "/repos/contributor/LUXIPANEL" && missingFork) throw Object.assign(new Error("missing"), { status: 404 });
    if (route.endsWith("/forks")) return { full_name: "contributor/LUXIPANEL", fork: true, parent: { full_name: "Luxisoft/LUXIPANEL" }, permissions: { push: true } };
    if (route === "/repos/contributor/LUXIPANEL") return { full_name: "contributor/LUXIPANEL", fork: true, parent: { full_name: "Luxisoft/LUXIPANEL" }, permissions: { push: true } };
    if (route.endsWith("/LUXIPANEL")) return { default_branch: "main", permissions: { push: true } };
    if (method === "GET") return published ? [{ html_url: "https://github.com/Luxisoft/LUXIPANEL/pull/42" }] : [];
    if (failPr) throw new Error("PR creation failed"); published = true; return { html_url: "https://github.com/Luxisoft/LUXIPANEL/pull/42" };
  } }) });
  repairBridge.registerAgent({ options: async () => ({ agents: [{ id: "test-agent", name: "Test", providerId: "claude", model: "test" }], providers: [{ id: "claude", model: "test", ready: true, mode: "api" }] }), run: async () => {
    runs++;
    if (changes) { const tool = logsRepairTools.find((t) => t.name.endsWith("_write"))!; const result = await tool.handler({ path: "source.ts", content: sourceContent }); if (!result.ok) throw new Error(String(result.output)); }
    return { text: "Fixed the source error", tokens: 100 };
  } });
  await diagnosticsStore.saveConfig("job-test", { ...DEFAULT_LOGS_CONFIG, agentId: "test-agent", credentialId: "test-credential", checks: ["backend-types"] });
  diagnosticsStore.capture({ scope: "job-test", severity: "error", message: `repair-case-${sequence}` });
  incidentId = (await diagnosticsStore.incidents("job-test"))[0]!.id;
  jobs = new RepairJobs(repo, async () => ({ passed: !failCheck, output: "verified" }));
});
afterAll(async () => { vi.restoreAllMocks(); await fs.rm(temp, { recursive: true, force: true }); });
afterEach(async () => { await jobs?.shutdown(); });
const start = () => jobs.create("job-test", incidentId, { ...user, modules: [...user.modules] });
const settled = async (id: string, state: string) => { await vi.waitFor(async () => expect((await jobs.get("job-test", id)).status).toBe(state), { timeout: 10000, interval: 20 }); return jobs.get("job-test", id); };
describe("Background Logs repairs (real isolated Git, simulated AI/GitHub)", () => {
  it("creates the verified contributor fork on a 404 and attributes its commit to that account", async () => {
    missingFork = true; const job = await start(); const done = await settled(job.id, "pr-created");
    expect(apiMock.mock.calls.some(([method, route]) => method === "POST" && route === "/repos/Luxisoft/LUXIPANEL/forks")).toBe(true);
    expect(done.forkRepository).toBe("contributor/LUXIPANEL");
    const commit = await exec("git", ["show", "-s", "--format=%an <%ae>", done.commit!], { cwd: repo });
    expect(commit.stdout).toContain("contributor <123+contributor@users.noreply.github.com>");
    const pull = apiMock.mock.calls.find(([method, route]) => method === "POST" && route === "/repos/Luxisoft/LUXIPANEL/pulls")!;
    expect(pull[2].head).toBe(`contributor:${done.branch}`);
  });
  it("never pushes recognized secrets even when checks pass", async () => {
    sourceContent = 'const apiKey = "' + 'ghp_' + 'a'.repeat(36) + '";';
    const job = await start(); const failed = await settled(job.id, "failed");
    expect(failed.error).toContain("credencial"); expect(failed.commit).toBeUndefined(); expect(failed.pushed).not.toBe(true);
    expect(apiMock.mock.calls.some(([method]) => method === "POST")).toBe(false);
  });
  it("deduplicates simultaneous creation attempts after asynchronous readiness", async () => {
    const requested = await Promise.all([start(), start(), start()]); expect(new Set(requested.map((job) => job.id)).size).toBe(1);
    await settled(requested[0]!.id, "pr-created"); expect(runs).toBe(1);
  });
  it("rechecks the requester's authority before publishing a prepared commit", async () => {
    const authorize = vi.fn().mockResolvedValueOnce(user).mockRejectedValueOnce(new Error("Administrator revoked"));
    repairBridge.registerAgent({ authorize, options: async () => ({ agents: [{ id: "test-agent", name: "Test", providerId: "claude", model: "test" }], providers: [{ id: "claude", model: "test", ready: true, mode: "api" }] }), run: async () => {
      const result = await logsRepairTools.find(t => t.name.endsWith("_write"))!.handler({ path: "source.ts", content: "export const fixed = true;\n" });
      if (!result.ok) throw new Error(String(result.output)); return { text: "Fixed", tokens: 1 };
    } });
    const job = await start(); const failed = await settled(job.id, "failed");
    expect(failed.error).toContain("revoked"); expect(failed.commit).toMatch(/^[a-f0-9]{40}$/);
    expect(failed.pushed).not.toBe(true); expect(authorize).toHaveBeenCalledTimes(2);
    expect(apiMock.mock.calls.filter(([method]) => method === "POST")).toHaveLength(0);
  });
  it("rejects agents whose tool permissions cannot perform a scoped repair", async () => {
    repairBridge.registerAgent({ options: async () => ({ agents: [{ id: "test-agent", name: "Read only", providerId: "claude", model: "test", repairReady: false }], providers: [{ id: "claude", model: "test", ready: true, mode: "api" }] }), run: async () => { throw new Error("Must not run"); } });
    await expect(start()).rejects.toThrow("permisos");
    expect(apiMock).not.toHaveBeenCalled();
  });
  it("creates a branch and PR without modifying the live checkout or including pending user changes", async () => {
    await fs.writeFile(path.join(repo, "source.ts"), "user pending work\n");
    const job = await start(); const done = await settled(job.id, "pr-created");
    expect(done.prUrl).toContain("/pull/42"); expect(done.commit).toMatch(/^[a-f0-9]{40}$/); expect(done.checks[0]?.passed).toBe(true);
    expect(await fs.readFile(path.join(repo, "source.ts"), "utf8")).toBe("user pending work\n");
    const changed = await exec("git", ["show", `${done.branch}:source.ts`], { cwd: repo }); expect(changed.stdout).toContain("fixed");
  });
  it("does not push or open a PR when verification fails", async () => {
    failCheck = true; const job = await start(); const failed = await settled(job.id, "failed");
    expect(failed.error).toContain("verificación"); expect(failed.commit).toBeUndefined(); expect(apiMock.mock.calls.filter(([method]) => method === "POST")).toHaveLength(0);
  });
  it("reports partial publication and retries only the verified commit", async () => {
    failPr = true; const job = await start(); const failed = await settled(job.id, "failed");
    expect(failed.pushed).toBe(true); expect(failed.prUrl).toBeUndefined(); expect(runs).toBe(1);
    failPr = false;
    // The terminal status is persisted before the worker releases its active
    // slot. Retry only once cleanup permits it, instead of racing that finally.
    await vi.waitFor(() => jobs.retry("job-test", job.id, { ...user, modules: [...user.modules] }), { timeout: 10000, interval: 20 });
    const done = await settled(job.id, "pr-created");
    expect(done.commit).toBe(failed.commit); expect(runs).toBe(1); expect(done.prUrl).toContain("/pull/42");
  });
  it("deduplicates active repair requests and isolates job lookup", async () => {
    const job = await start(); expect((await start()).id).toBe(job.id);
    await expect(jobs.get("other-panel", job.id)).rejects.toThrow("no encontrada"); await settled(job.id, "pr-created");
  });
  it("waits for a reviewable write approval in Logs and supports cancellation", async () => {
    manual = true; await diagnosticsStore.saveConfig("job-test", { ...DEFAULT_LOGS_CONFIG, agentId: "test-agent", credentialId: "test-credential", checks: ["backend-types"], approvalMode: manual ? "manual" : "auto" });
    const job = await start(); const waiting = await settled(job.id, "approval");
    expect(waiting.pendingApproval?.preview).toContain("fixed"); await jobs.cancel("job-test", job.id); await settled(job.id, "canceled");
    expect(apiMock.mock.calls.filter(([method]) => method === "POST")).toHaveLength(0);
  });
  it("marks non-code diagnoses for manual action without claiming a repair", async () => {
    changes = false; const job = await start(); const done = await settled(job.id, "manual-action"); expect(done.prUrl).toBeUndefined(); expect(done.result).toContain("Fixed");
  });
});
