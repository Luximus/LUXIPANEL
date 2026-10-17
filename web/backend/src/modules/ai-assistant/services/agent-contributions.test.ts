// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentEvent, AgentMessage } from "./providers/provider.types.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { SessionUser } from "../../../shared/types/index.js";
import type { TeamTaskStatus } from "../models/team-task.types.js";

const state = vi.hoisted(() => ({
  cwd: "/core/web/backend" as string | undefined,
  mode: "auto" as "auto" | "manual" | "plan",
  enabled: true,
  worker: null as { id: string; status: TeamTaskStatus } | null,
  events: [{ type: "done" }] as AgentEvent[],
  order: [] as string[],
  release: vi.fn(),
  ticket: { job: { id: "task", root: "/core", teamTaskId: undefined as string | undefined } },
  run: vi.fn(),
}));
vi.mock("./agent-context.service.js", () => ({
  resolveConversationBinding: vi.fn(async (_e, opts) => opts),
  admitAgentWork: vi.fn(async () => ({ release: state.release })),
  resolveAgentContext: vi.fn(async () => ({ agent: null, role: null })),
}));
vi.mock("../../../shared/github/owner-contributions.js", () => ({
  assertCoreDeveloper: vi.fn(async () => {}),
  beginOwnerContribution: vi.fn(async (_user, _conversation, _cwd, _target, enabled) => {
    state.order.push("tracking"); return enabled ? state.ticket : null;
  }),
  finishOwnerContribution: vi.fn(async () => {}),
  saveContribution: vi.fn(async () => {}),
}));
vi.mock("../repositories/team-tasks.repository.js", () => ({ teamTasksRepository: { findByWorkerConversation: vi.fn(async () => state.worker), listForLeaderConversation: vi.fn(async () => []) } }));
vi.mock("../repositories/conversations.repository.js", () => ({ conversationsRepository: { getMeta: vi.fn(async () => ({ approvalMode: state.mode })) } }));
vi.mock("../repositories/assistant-config.repository.js", () => ({ assistantConfigRepository: { load: vi.fn(async () => ({
  enabled: state.enabled, activeProvider: "codex", approval: { mode: "auto" }, autoRouting: { enabled: false }, providers: { codex: { mode: "api" } },
})) } }));
vi.mock("../repositories/agents.repository.js", () => ({ agentsRepository: { list: vi.fn(async () => []) } }));
vi.mock("../repositories/assistant-audit.repository.js", () => ({ assistantAuditRepository: { append: vi.fn() } }));
vi.mock("./assistant-modules.service.js", () => ({ assistantModulesService: { permittedTools: vi.fn(async () => []) } }));
vi.mock("./agent-run-registry.js", () => ({ agentRunRegistry: { setApproval: vi.fn() } }));
vi.mock("./providers/provider-factory.js", () => ({
  buildProvider: vi.fn(() => ({ id: "codex", mode: "api", run: state.run })), ProviderUnavailableError: class extends Error {},
}));
vi.mock("./system-prompt-builder.js", () => ({ buildSystemPrompt: vi.fn(async () => ({ systemPrompt: "Prompt", systemContext: "", cwd: state.cwd, jailPaths: [], tools: [], cliTeamLeader: false })) }));
vi.mock("./orchestrator.service.js", () => ({ orchestratorService: {}, hasMutatingTools: vi.fn(() => false) }));
vi.mock("./slash-commands.service.js", () => ({ slashCommandsService: { isSlash: vi.fn(() => false) } }));
vi.mock("./module-tools.service.js", () => ({ moduleDiscoveryTools: vi.fn(() => []), bindModuleToolRun: vi.fn(() => () => {}) }));
vi.mock("./tool-allowlist.js", () => ({ normalizeAllowedTools: vi.fn((valid: string[]) => ({ valid })) }));
vi.mock("./mcp-run-tokens.js", () => ({ mintModuleMcpToken: vi.fn() }));
vi.mock("./cross-channel-origin.js", () => ({ resolveCrossChannelOrigin: vi.fn() }));
vi.mock("../../../shared/agent-capability/registry.js", () => ({ agentCapabilityRegistry: { findTool: vi.fn() } }));
vi.mock("../../../shared/executor/index.js", () => ({ getContextExecutor: vi.fn(() => null), setContextFileJail: vi.fn() }));

import { agentService, type AgentRunOptions } from "./agent.service.js";
import { beginOwnerContribution, finishOwnerContribution, saveContribution } from "../../../shared/github/owner-contributions.js";

const executor = { target: { id: "local" } } as Executor;
const user = { userId: 1, username: "maintainer", kind: "admin" } as SessionUser;
const messages: AgentMessage[] = [{ role: "user", content: "Update this project" }];
const run = async (options: AgentRunOptions = {}) => {
  for await (const _event of agentService.run(messages, { executor, user, conversationId: "worker-chat", ...options })) { /* consume */ }
};
beforeEach(() => {
  vi.clearAllMocks(); state.cwd = "/core/web/backend"; state.mode = "auto"; state.enabled = true;
  state.worker = null; state.ticket.job.teamTaskId = undefined; state.events = [{ type: "done" }]; state.order = [];
  state.run.mockImplementation(async function* () { state.order.push("provider"); yield* state.events; });
});

describe("contribution tracking uses the provider's resolved workspace", () => {
  it("tracks an agent-only worker before it runs, even without projectId or cwd", async () => {
    state.worker = { id: "team-task", status: "running" };
    await run({ agentId: "worker" });
    expect(beginOwnerContribution).toHaveBeenCalledWith(user, "worker-chat", state.cwd, "local", true);
    expect(state.order).toEqual(["tracking", "provider"]);
    expect(saveContribution).toHaveBeenCalledWith(expect.objectContaining({ teamTaskId: "team-task" }));
    expect(state.run.mock.calls[0]?.[1]).toMatchObject({ cwd: state.cwd, systemPrompt: expect.stringContaining("no hagas commit ni push") });
    expect(finishOwnerContribution).toHaveBeenCalledWith(state.ticket, true);
    expect(state.release).toHaveBeenCalledOnce();
  });
  it.each(["done", "failed", "canceled"] as const)("does not strand a follow-up behind its old %s team task", async status => {
    state.worker = { id: "old-task", status };
    await run({ agentId: "worker" });
    expect(state.ticket.job.teamTaskId).toBeUndefined();
    expect(saveContribution).not.toHaveBeenCalled();
    expect(finishOwnerContribution).toHaveBeenCalledWith(state.ticket, true);
  });
  it("uses the final workspace rather than a stale project or cwd hint", async () => {
    state.cwd = "/core/web/frontend";
    await run({ projectId: "project", cwd: "/other", forcedCwd: "/requested" });
    expect(beginOwnerContribution).toHaveBeenCalledWith(user, "worker-chat", state.cwd, "local", true);
  });
  it("keeps plan mode out of publication even if global approval is automatic", async () => {
    state.mode = "plan";
    await run();
    expect(beginOwnerContribution).toHaveBeenCalledWith(user, "worker-chat", state.cwd, "local", false);
    expect(finishOwnerContribution).toHaveBeenCalledWith(null, true);
    expect(state.run.mock.calls[0]?.[1].systemPrompt).not.toContain("no hagas commit ni push");
  });
  it.each(["error", "ask"] as const)("does not mark a %s response as successful", async type => {
    state.events = type === "error" ? [{ type, message: "Failure" }, { type: "done" }] : [{ type: "ask", questions: [] }, { type: "done" }];
    await run();
    expect(finishOwnerContribution).toHaveBeenCalledWith(state.ticket, false);
  });
  it("preserves an interrupted provider's ticket and releases admission", async () => {
    state.run.mockImplementation(async function* () { throw new Error("disconnected"); });
    await expect(run()).rejects.toThrow("disconnected");
    expect(finishOwnerContribution).toHaveBeenCalledWith(state.ticket, false);
    expect(state.release).toHaveBeenCalledOnce();
  });
  it("does not create a contribution for a disabled assistant", async () => {
    state.enabled = false;
    await run();
    expect(beginOwnerContribution).not.toHaveBeenCalled();
    expect(state.run).not.toHaveBeenCalled();
  });
});
