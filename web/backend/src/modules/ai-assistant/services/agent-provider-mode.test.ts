// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistantConfig, AssistantProviderId } from "../models/assistant-config.types.js";
import type { AssistantAgent } from "../models/assistant-agent.types.js";
import type { AgentEvent } from "./providers/provider.types.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { SessionUser } from "../../../shared/types/index.js";

const state = vi.hoisted(() => ({
  config: {} as AssistantConfig,
  agent: {} as AssistantAgent,
  role: null as { canSpawnChats: boolean; name: string; description: string; systemPrompt: string } | null,
  events: [{ type: "done" }] as AgentEvent[],
  run: vi.fn(),
}));
vi.mock("./agent-context.service.js", () => ({
  resolveAgentContext: async () => ({ agent: state.agent, role: state.role, projectId: null, ancestors: [], contextProjects: [] }),
  scopedAgents: async (_e: unknown, agents: AssistantAgent[]) => agents,
}));
vi.mock("../repositories/assistant-config.repository.js", () => ({ assistantConfigRepository: { load: async () => state.config } }));
vi.mock("../repositories/conversations.repository.js", () => ({ conversationsRepository: { getMeta: async () => ({ approvalMode: "auto", provider: "codex" }) } }));
vi.mock("../repositories/agents.repository.js", () => ({ agentsRepository: { list: async () => [state.agent, {
  id: "worker", parentAgentId: "leader", name: "Specialist", description: "", providerId: "codex", model: "gpt-6-astra",
  allowedTools: null, projectIds: [], projectPaths: [],
}] } }));
vi.mock("../repositories/agent-roles.repository.js", () => ({ agentRolesRepository: { list: async () => [] } }));
vi.mock("../repositories/projects.repository.js", () => ({ projectsRepository: { list: async () => [] } }));
vi.mock("../repositories/assistant-audit.repository.js", () => ({ assistantAuditRepository: { append: vi.fn() } }));
vi.mock("../repositories/assistant-skills.repository.js", () => ({ assistantSkillsRepository: { load: async () => ({}) } }));
vi.mock("./assistant-skills.service.js", () => ({ assistantSkillsService: { resolveFromMap: () => ({ isEnabled: () => false, promptBlocks: () => "" }) } }));
vi.mock("./providers/cli/cli-sudo-askpass.js", () => ({ hasSudoCredential: async () => false }));
vi.mock("./assistant-modules.service.js", () => ({ assistantModulesService: { permittedTools: async () => [] } }));
vi.mock("./agent-run-registry.js", () => ({ agentRunRegistry: { setApproval: vi.fn() } }));
vi.mock("./providers/provider-factory.js", () => ({
  buildProvider: vi.fn((config: AssistantConfig, id?: AssistantProviderId) => {
    const provider = id ?? config.activeProvider;
    return { id: provider, mode: config.providers[provider].mode, run: state.run };
  }),
  ProviderUnavailableError: class extends Error {},
}));
vi.mock("./module-tools.service.js", () => ({ moduleDiscoveryTools: () => [], bindModuleToolRun: () => () => {} }));
vi.mock("./mcp-run-tokens.js", () => ({ mintModuleMcpToken: () => "module-fixture" }));
vi.mock("./cross-channel-origin.js", () => ({ resolveCrossChannelOrigin: async () => "http://127.0.0.1:8080" }));
vi.mock("./slash-commands.service.js", () => ({ slashCommandsService: { isSlash: () => false } }));
vi.mock("./orchestrator.service.js", () => ({ orchestratorService: {}, hasMutatingTools: () => false }));
vi.mock("../../../shared/executor/index.js", async importOriginal => ({
  ...await importOriginal<typeof import("../../../shared/executor/index.js")>(),
  getContextExecutor: () => null, setContextFileJail: vi.fn(),
}));
vi.mock("../../../shared/github/owner-contributions.js", () => ({ assertCoreDeveloper: vi.fn() }));

import { agentService, type AgentRunOptions } from "./agent.service.js";
import { buildProvider } from "./providers/provider-factory.js";

const executor = { target: { id: "local" } } as Executor;
const user = { userId: 7, username: "fixture", kind: "admin" } as SessionUser;
async function run(overrides: AgentRunOptions = {}) {
  const events: AgentEvent[] = [];
  for await (const event of agentService.runUntracked([{ role: "user", content: "Continue the team task" }], {
    executor, user, userId: "7", agentId: "leader", conversationId: "leader-chat", withContext: false,
    panelOrigin: "https://panel.test", crossMcpToken: "cross-fixture", ...overrides,
  })) events.push(event);
  return events;
}
beforeEach(() => {
  vi.clearAllMocks();
  state.config = { enabled: true, activeProvider: "codex", approval: { mode: "auto" }, autoRouting: { enabled: false },
    providers: Object.fromEntries(["claude", "codex", "minimax", "gemini", "grok"].map(id => [id, {
      mode: "cli", cli: { installed: true, model: "gpt-6-astra" }, api: { apiKey: "fixture-api-key", model: "gpt-6-astra" },
    }])) } as AssistantConfig;
  state.agent = { id: "leader", name: "Leader", description: "", systemPrompt: "", providerId: "codex", model: "gpt-6-astra",
    allowedTools: null, canSpawnChats: true, projectPaths: [], projectIds: [] } as AssistantAgent;
  state.role = null;
  state.events = [{ type: "done" }];
  state.run.mockImplementation(async function* () { yield* state.events; });
});

describe("leader transport honours the selected billing mode", () => {
  it.each(["claude", "codex", "minimax"] as const)("coordinates through MCP while %s remains CLI with an API key saved", async providerId => {
    state.agent.providerId = providerId;
    await run({ providerId });
    expect(buildProvider).toHaveReturnedWith(expect.objectContaining({ id: providerId, mode: "cli" }));
    expect(state.config.providers[providerId].mode).toBe("cli");
    const options = state.run.mock.calls[0]![1];
    expect(options).toMatchObject({ teamLeader: true, crossServerMcp: { url: "http://127.0.0.1:8080/api/ai/mcp/cross", token: "cross-fixture" } });
    expect(options.systemPrompt).toContain("mcp__luxipanel-servers__team__assign");
    expect(options.systemPrompt).toContain("mcp__luxipanel-servers__team__collect");
    expect(options.systemPrompt).toContain("Specialist");
    expect(options.tools.some((tool: { name: string }) => tool.name === "team.assign")).toBe(false);
  });
  it.each(["gemini", "grok"] as const)("does not silently switch an unsupported %s leader to API", async providerId => {
    state.agent.providerId = providerId;
    await run({ providerId });
    expect(buildProvider).toHaveReturnedWith(expect.objectContaining({ mode: "cli" }));
    expect(state.run.mock.calls[0]![1].crossServerMcp).toBeUndefined();
    expect(state.run.mock.calls[0]![1].systemPrompt).toContain("La coordinación de equipo no está disponible");
  });
  it("supports a supervisor permission granted by the role", async () => {
    state.agent.canSpawnChats = false;
    state.role = { canSpawnChats: true, name: "Supervisor", description: "", systemPrompt: "" };
    await run();
    expect(state.run.mock.calls[0]![1].teamLeader).toBe(true);
    expect(state.config.providers.codex.mode).toBe("cli");
  });
  it.each(["crossMcpToken", "panelOrigin", "conversationId"] as const)("keeps CLI and reports unavailable coordination without %s", async missing => {
    await run({ [missing]: undefined });
    const options = state.run.mock.calls[0]![1];
    expect(options.teamLeader).toBeUndefined();
    expect(options.systemPrompt).not.toContain("mcp__luxipanel-servers__team__assign");
    expect(options.systemPrompt).toContain("La coordinación de equipo no está disponible");
    expect(state.config.providers.codex.mode).toBe("cli");
  });
  it("does not retry a CLI failure through the API", async () => {
    state.events = [{ type: "error", message: "CLI login unavailable (401)" }];
    expect(await run()).toEqual(state.events);
    expect(buildProvider).toHaveBeenCalledTimes(1);
    expect(state.run).toHaveBeenCalledTimes(1);
    expect(state.config.providers.codex.mode).toBe("cli");
  });
  it("keeps API coordination when API mode was explicitly configured", async () => {
    state.config.providers.codex.mode = "api";
    await run();
    expect(buildProvider).toHaveReturnedWith(expect.objectContaining({ mode: "api" }));
    const options = state.run.mock.calls[0]![1];
    expect(options.crossServerMcp).toBeUndefined();
    expect(options.tools.some((tool: { name: string }) => tool.name === "team.assign")).toBe(true);
  });
  it("does not require an API key for a CLI leader", async () => {
    state.config.providers.codex.api!.apiKey = "";
    await run();
    expect(state.run.mock.calls[0]![1].teamLeader).toBe(true);
  });
  it("retains the administrator requirement for CLI instead of bypassing it via API", async () => {
    const events = await run({ user: { ...user, kind: "user" } as SessionUser });
    expect(events).toEqual([{ type: "error", message: expect.stringContaining("reservado a administradores") }]);
    expect(state.run).not.toHaveBeenCalled();
  });
});
