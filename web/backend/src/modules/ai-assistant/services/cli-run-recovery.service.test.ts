// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Executor } from "../../../shared/executor/index.js";
import type { SessionUser } from "../../../shared/types/index.js";
import type { CliJobDescriptor } from "../repositories/cli-jobs.repository.js";
const state = vi.hoisted(() => ({
  active: false, owner: 7, ac: new AbortController(), starts: 0,
  desc: null as CliJobDescriptor | null, generator: null as AsyncGenerator | null,
  complete: null as null | ((...args:unknown[])=>Promise<void>),
  approval: null as null | { mode: string; autoApprove: Set<string> },
}));
vi.mock("./agent-run-registry.js", () => ({ agentRunRegistry: {
  has: () => state.active,
  runContext: () => state.active && !state.ac.signal.aborted ? { ownerUserId: state.owner, signal: state.ac.signal } : null,
  getApproval: () => state.approval,
  setApproval: (_id: string, value: { mode: string; autoApproveTools: string[] }) => {
    state.approval = { mode: value.mode, autoApprove: new Set(value.autoApproveTools) };
  },
  start: (params: { makeGen: () => AsyncGenerator; onComplete:(...args:unknown[])=>Promise<void> }) => {
    if (state.active) return;
    state.active = true; state.starts++;
    state.complete=params.onComplete;
    state.generator = params.makeGen(); void state.generator.next();
  },
} }));
vi.mock("../repositories/cli-jobs.repository.js", () => ({ cliJobsRepository: {
  get: async () => state.desc, set: vi.fn(async()=>undefined), delete: vi.fn(async()=>true),
} }));
vi.mock("../repositories/cli-sessions.repository.js", () => ({ cliSessionsRepository: { getProvider: async () => null } }));
vi.mock("./providers/cli/cli-session.js", () => ({ discoverCodexOrphanJob: async () => null }));
vi.mock("./providers/cli/recovered-run.js", () => ({ makeRecoveredCliGen: async function* () { yield { type: "tool_use", name: "codex.cli" }; yield { type: "done" }; } }));
vi.mock("./turn-queue.service.js", () => ({ makeUsageRecorder: () => () => {}, persistAssistantMessage: vi.fn(), drainConversationQueue: vi.fn() }));
vi.mock("../../../shared/github/owner-contributions.js",()=>({
  contributionCliBinding:vi.fn(), recoverOwnerContribution:vi.fn(async()=>null), finishOwnerContribution:vi.fn(async()=>null),
}));
import { runWithExecutor, setContextFileJail } from "../../../shared/executor/context.js";
import { bindModuleToolRun, moduleToolRunScope } from "./module-tools.service.js";
import { captureModuleRunRecovery, readModuleRunRecovery } from "./module-run-recovery.service.js";
import { ensureModuleToolRun } from "./cli-run-recovery.service.js";
import { finishOwnerContribution } from "../../../shared/github/owner-contributions.js";
const user = { userId: 7, username: "test", kind: "admin", role: "admin", modules: ["assistant"] } as SessionUser;
const token = "original-token-never-persisted";
const executor = { target: { id: "recovery-test", name: "Test" }, exec: vi.fn() } as unknown as Executor;
const scoped = <T>(fn: () => T) => runWithExecutor(executor, fn, user.userId, user);
const recover = (bearer = token) => scoped(() => ensureModuleToolRun(executor, "conversation", user, bearer));
beforeEach(() => {
  state.active = false; state.owner = 7; state.ac = new AbortController(); state.starts = 0; state.generator = null;state.complete=null;
  vi.mocked(finishOwnerContribution).mockClear();
  state.approval = { mode: "plan", autoApprove: new Set(["files.read"]) };
  state.desc = { conversationId: "conversation", jobId: "lxp-cli-123-abcdef", logFile: "/tmp/lxp-cli-123-abcdef.log", exitFile: "/tmp/lxp-cli-123-abcdef.exit", provider: "codex", serverName: "Test", pid: "123", startedAt: 123 };
  vi.mocked(executor.exec).mockImplementation(async (command) => ({ stdout: command.includes("ps -p") ? "bash /tmp/lxp-cli-123-abcdef.sh" : "Y", stderr: "", exitCode: 0 }));
  scoped(() => {
    setContextFileJail(["/srv/allowed"]);
    const release = bindModuleToolRun("conversation", executor, user, [["files.read"], null], "original-agent");
    state.desc!.moduleRecovery = captureModuleRunRecovery(executor, state.desc!, token);
    release();
  });
  state.approval = null;
});
afterEach(async () => { await state.generator?.return(undefined); state.active = false; vi.restoreAllMocks(); });
describe("module channel after a backend restart", () => {
  it.each([
    {errored:false,ask:undefined,outcome:undefined,success:true},
    {errored:true,ask:undefined,outcome:undefined,success:false},
    {errored:false,ask:[{id:"approval"}],outcome:undefined,success:false},
    {errored:false,ask:undefined,outcome:{interrupted:true},success:false},
    {errored:false,ask:undefined,outcome:{error:"failed"},success:false},
  ])("seals recovered contributions only on confirmed completion: $success",async({errored,ask,outcome,success})=>{
    expect(await recover()).toBe(true);
    await state.complete!("answer",errored,ask,undefined,1,undefined,undefined,outcome);
    expect(finishOwnerContribution).toHaveBeenCalledWith(null,success);
  });
  it("reattaches the existing job with the original permissions and approval mode", async () => {
    expect(await recover()).toBe(true);
    expect(moduleToolRunScope("conversation", executor, user)).toMatchObject({
      jail: ["/srv/allowed"], allowlists: [["files.read"], null], agentId: "original-agent",
    });
    expect(state.approval).toEqual({ mode: "plan", autoApprove: new Set(["files.read"]) });
    expect(state.starts).toBe(1);
    expect(await recover()).toBe(true);
    expect(state.starts).toBe(1);
    expect(executor.exec).not.toHaveBeenCalledWith(expect.stringMatching(/nohup|restart|build/), expect.anything());
  });
  it("joins concurrent callbacks without starting a second run", async () => {
    expect(await Promise.all([recover(), recover()])).toEqual([true, true]);
    expect(state.starts).toBe(1);
  });
  it.each(["done", "stop"])("drops recovered authority when the job is %s", async kind => {
    expect(await recover()).toBe(true);
    if (kind === "done") state.active = false; else state.ac.abort();
    expect(moduleToolRunScope("conversation", executor, user)).toBeUndefined();
  });
  it.each(["token", "signature", "job", "expired", "missing", "conversation"])("rejects %s mismatches without reattaching", async kind => {
    if (kind === "signature") state.desc!.moduleRecovery += "a";
    if (kind === "job") state.desc!.pid = "999";
    if (kind === "expired") vi.spyOn(Date, "now").mockReturnValue(Date.now() + 8 * 86400000);
    if (kind === "missing") delete state.desc!.moduleRecovery;
    if (kind === "conversation") state.desc!.conversationId = "another";
    expect(await recover(kind === "token" ? "wrong" : token)).toBe(false);
    expect(state.starts).toBe(0);
  });
  it("rejects another owner or target", () => {
    expect(readModuleRunRecovery(executor, state.desc!, { ...user, userId: 8 }, token)).toBeNull();
    expect(readModuleRunRecovery({ ...executor, target: { ...executor.target, id: "another" } }, state.desc!, user, token)).toBeNull();
  });
  it.each(["dead", "reused"])("does not restore a %s process", async kind => {
    vi.mocked(executor.exec).mockResolvedValue({ stdout: kind === "reused" ? "unrelated-process" : "", stderr: "", exitCode: kind === "dead" ? 1 : 0 });
    expect(await recover()).toBe(false); expect(state.starts).toBe(0);
  });
  it("rejects a different token after recovering the scope", async () => {
    expect(await recover()).toBe(true); expect(await recover("new-token")).toBe(false);
    expect(state.starts).toBe(1);
  });
  it("persists a signed scope without persisting the bearer token", () => {
    const body = Buffer.from(state.desc!.moduleRecovery!.split(".")[0]!, "base64url").toString();
    expect(body).not.toContain(token); expect(JSON.parse(body)).toMatchObject({ owner: 7, targetId: "recovery-test" });
  });
});
