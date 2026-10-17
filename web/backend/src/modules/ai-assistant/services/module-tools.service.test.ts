// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { beforeEach, describe, expect, it, vi } from "vitest";
import { agentCapabilityRegistry } from "../../../shared/agent-capability/registry.js";
import { runWithExecutor, setContextFileJail, getFileJailPaths } from "../../../shared/executor/context.js";
import type { Executor } from "../../../shared/executor/types.js";
import type { SessionUser } from "../../../shared/types/index.js";
const state = vi.hoisted(() => ({ profiles: [] as any[], projects: [] as any[], meta: null as any, enabled: { demo: true } as Record<string, boolean>, access: {} as any, mode: "manual", decision: null as null | (() => Promise<"allow" | "deny">), liveCalls: 0, blockOn: 0, release: undefined as undefined | ((user: SessionUser) => void), catalog: [] as {id:string;name:string;description:string}[], live: null as SessionUser | null }));
vi.mock("../../../shared/module-state/index.js", () => ({ getModuleCatalog: () => state.catalog, getModuleEnabledMap: async () => state.enabled }));
vi.mock("../repositories/assistant-module-access.repository.js", () => ({ assistantModuleAccessRepository: { load: async () => state.access } }));
vi.mock("../../auth/services/live-authorization.service.js", () => ({ resolveLiveAuthorization: async (user: SessionUser) => { state.liveCalls++; if (state.liveCalls === state.blockOn) return new Promise<SessionUser>(resolve => { state.release = resolve; }); return state.live ?? user; } }));
vi.mock("./agent-run-registry.js", () => ({ agentRunRegistry: { inject: vi.fn(), getApproval: () => ({ mode: state.mode, autoApprove: new Set() }) } }));
vi.mock("./permission-broker.js", () => ({ permissionBroker: { request: () => state.decision ? state.decision() : Promise.resolve("deny") } }));
vi.mock("../repositories/assistant-audit.repository.js", () => ({ assistantAuditRepository: { append: vi.fn(async () => {}) } }));
// External GitHub entitlement is tested separately; this suite exercises dispatch.
vi.mock("../../../shared/github/user-connection.js", () => ({ requireGithub: async () => {} }));
vi.mock("../repositories/conversations.repository.js", () => ({ conversationsRepository: { getMeta: async () => state.meta } }));
vi.mock("../repositories/agents.repository.js", () => ({ agentsRepository: { get: async (id: string) => state.profiles.find(a => a.id === id) ?? null } }));
vi.mock("../repositories/projects.repository.js", () => ({ projectsRepository: { list: async () => state.projects } }));
vi.mock("../repositories/agent-roles.repository.js", () => ({ agentRolesRepository: { get: async () => null } }));
import { hasAssignmentAdmission } from "./agent-assignment-lock.js";
import { agentRunRegistry } from "./agent-run-registry.js";
import { executeModuleTool, moduleDiscoveryTools, moduleToolRevision } from "./module-tools.service.js";
const executor = { target: { id: "A", name: "A" } } as Executor;
const user = { userId: 7, username: "admin", displayName: "Admin", role: "admin", modules: [], kind: "admin" } as SessionUser;
const handler = vi.fn(async () => ({ ok: true, output: getFileJailPaths() }));
function register() { agentCapabilityRegistry.register({ moduleId: "demo", catalogModuleId: "demo", version: 1, tools: [{ name: "demo.read", title: "Read", description: "Read demo", kind: "read", permission: "demo.read", inputSchema: { type: "object" }, handler }, { name: "demo.edit", title: "Edit", description: "Edit demo", kind: "action", permission: "demo.edit", inputSchema: { type: "object" }, handler }] }); }
const scoped = <T>(fn: () => T) => runWithExecutor(executor, fn, 7, user);
beforeEach(() => { state.profiles = []; state.projects = []; state.meta = null; agentCapabilityRegistry._resetForTest(); state.liveCalls = 0; state.blockOn = 0; state.release = undefined; state.catalog = []; state.enabled = { demo: true }; state.access = {}; state.mode = "manual"; state.decision = null; state.live = null; handler.mockClear(); register(); });
describe("live module dispatch", () => {
  it("discovers schemas dynamically and preserves the project jail", async () => scoped(async () => {
    setContextFileJail(["/srv/project"]);
    const discovery = moduleDiscoveryTools({ executor, user });
    const descriptions = await discovery[1]!.handler({ moduleId: "demo" });
    expect(descriptions.output).toEqual(expect.arrayContaining([expect.objectContaining({ name: "demo.read", revision: moduleToolRevision("demo"), inputSchema: { type: "object" } })]));
    expect(await executeModuleTool("demo.read", {}, { executor, user })).toEqual({ ok: true, output: ["/srv/project"] });
  }));
  it("rejects a stale snapshot after unload or an invalid replacement without losing the old module", async () => scoped(async () => {
    const old = agentCapabilityRegistry.findTool("demo.read")!.tool;
    expect(() => agentCapabilityRegistry.register({ moduleId: "demo", version: 1, tools: [{ ...old, name: "other.invalid" }] })).toThrow();
    expect(await old.handler({})).toMatchObject({ ok: true });
    agentCapabilityRegistry.unregister("demo"); await expect(old.handler({})).rejects.toThrow("changed");
  }));
  it("checks activation and sidecar again after obtaining a tool", async () => scoped(async () => {
    state.enabled.demo = false; expect(await executeModuleTool("demo.read", {}, { executor, user })).toMatchObject({ ok: false });
    state.enabled.demo = true; state.access = { demo: { tools: { "demo.read": { enabled: false } } } }; expect(await executeModuleTool("demo.read", {}, { executor, user })).toMatchObject({ ok: false }); expect(handler).not.toHaveBeenCalled();
  }));
  it.each(["replace", "disable", "revoke"])("rechecks %s while approval is pending", async change => scoped(async () => {
    let approve!: (decision: "allow") => void;
    state.decision = () => new Promise(resolve => { approve = resolve; });
    const pending = executeModuleTool("demo.edit", {}, { executor, user, conversationId: "chat" });
    await vi.waitFor(() => expect(approve).toBeTypeOf("function"));
    if (change === "replace") register(); else if (change === "disable") state.enabled.demo = false; else state.live = { ...user, kind: "user", modules: [] } as SessionUser;
    approve("allow"); expect(await pending).toMatchObject({ ok: false }); expect(handler).not.toHaveBeenCalled();
  }));
  it("denies actions with no approval channel and actions in plan mode", async () => scoped(async () => {
    expect(await executeModuleTool("demo.edit", {}, { executor, user })).toMatchObject({ ok: false });
    state.mode = "plan"; expect(await executeModuleTool("demo.edit", {}, { executor, user, conversationId: "chat" })).toMatchObject({ ok: false });
  }));
  it("asks in manual mode even when the module disables its own confirmation flag", async () => scoped(async () => {
    state.access = { demo: { tools: { "demo.edit": { requireConfirm: false } } } };
    state.decision = async () => "deny";
    expect(await executeModuleTool("demo.edit", {}, { executor, user, conversationId: "chat" })).toMatchObject({ ok: false });
    expect(handler).not.toHaveBeenCalled();
  }));
  it("keeps the tool generation usable when management tools are overlaid", async () => scoped(async () => {
    const previous = agentCapabilityRegistry.get("demo")!; agentCapabilityRegistry.register({ ...previous, tools: previous.tools });
    expect(await executeModuleTool("demo.read", {}, { executor, user })).toMatchObject({ ok: true });
  }));
});

describe("module discovery diagnostics", () => {
  it("lists disabled/new modules and marks the graph's separate scoped channel", async () => scoped(async () => {
    state.catalog = ["demo", "new-module", "codebase-graph"].map(id => ({ id, name: id, description: id }));
    state.enabled["new-module"] = false;
    const result = await moduleDiscoveryTools({ executor, user })[0]!.handler({});
    expect(result.output).toEqual(expect.arrayContaining([
      expect.objectContaining({ moduleId: "new-module", unavailableReason: "module-disabled" }),
      expect.objectContaining({ moduleId: "codebase-graph", channel: "project-scoped-graph" }),
    ]));
  }));
  it("traces the actual operation and redacts credentials returned to the chat", async () => scoped(async () => {
    agentCapabilityRegistry.register({ moduleId: "secret-demo", version: 1, tools: [{ name: "secret-demo.read", title: "read", description: "read", kind: "read", inputSchema: { type: "object" }, handler: async () => ({ ok: true, output: { token: "private", value: 1 } }) }] });
    const result = await moduleDiscoveryTools({ executor, user, conversationId: "chat" })[2]!.handler({ tool: "secret-demo.read", revision: moduleToolRevision("secret-demo"), input: {} });
    expect(result).toEqual({ ok: true, output: { token: "[redacted]", value: 1 } });
    expect(agentRunRegistry.inject).toHaveBeenCalledWith("chat", expect.objectContaining({ type: "tool_use", name: "secret-demo.read" }), "A");
  }));
});

it("rejects a gateway call whose moduleId differs from the discovered owner", async () => scoped(async () => {
  const result = await moduleDiscoveryTools({ executor, user })[2]!.handler({ moduleId: "other", tool: "demo.read", revision: moduleToolRevision("demo") });
  expect(result.ok).toBe(false); expect(handler).not.toHaveBeenCalled();
}));
it("snapshots input before waiting for approval", async () => scoped(async () => {
  let approve!: (decision: "allow") => void;
  state.decision = () => new Promise(resolve => { approve = resolve; });
  const input = { value: "approved" };
  const pending = executeModuleTool("demo.edit", input, { executor, user, conversationId: "chat" });
  await vi.waitFor(() => expect(approve).toBeTypeOf("function"));
  input.value = "changed"; approve("allow");
  expect((await pending).ok).toBe(true);
  expect(handler).toHaveBeenCalledWith({ value: "approved" });
}));

it("rejects a module disabled during the final identity check", async () => scoped(async () => {
  const { notifyModulesChanged } = await import("../../../shared/module-state/lifecycle.js");
  state.blockOn = 3;
  const pending = executeModuleTool("demo.read", {}, { executor, user });
  await vi.waitFor(() => expect(state.release).toBeTypeOf("function"));
  state.enabled.demo = false; notifyModulesChanged("demo", "A"); state.release!(user);
  await expect(pending).rejects.toThrow("changed"); expect(handler).not.toHaveBeenCalled();
}));

describe("project assignment at protected tool dispatch", () => {
  function setupContext() {
    state.profiles = [{ id: "a", ownerId: 7, name: "A", systemPrompt: "", allowedTools: null, projectIds: ["X", "Y"] }];
    state.projects = ["X", "Y"].map(id => ({ id, ownerId: 7, title: id, path: "/" + id, servers: [{ id: "server-" + id }] }));
    state.meta = { id: "chat", agentId: "a", projectId: "X", messageCount: 0 };
    return { executor, user, conversationId: "chat" };
  }
  it("denies a foreign project path and an explicit empty path scope", async () => scoped(async () => {
    const scope = setupContext();
    await expect(executeModuleTool("demo.read", { path: "/Y/source" }, scope)).rejects.toThrow("Path outside");
    state.profiles[0].assignments = [{ projectId: "X", status: "active", projectPaths: [] }];
    await expect(executeModuleTool("demo.read", { path: "/X/source" }, scope)).rejects.toThrow("Path outside");
    expect(handler).not.toHaveBeenCalled();
  }));
  it("denies a server from Y while executing X", async () => scoped(async () => {
    const scope = setupContext();
    state.enabled.servers = true;
    agentCapabilityRegistry.register({ moduleId: "servers", version: 1, tools: [{ name: "servers.read_file", title: "Read", description: "Read", kind: "read", permission: "servers.read", inputSchema: { type: "object" }, handler }] });
    expect(await executeModuleTool("servers.read_file", { serverId: "server-Y" }, scope)).toMatchObject({ ok: false });
    expect(handler).not.toHaveBeenCalled();
    expect(await executeModuleTool("servers.read_file", { serverId: "server-X" }, scope)).toMatchObject({ ok: true });
  }));
  it("revalidates withdrawal after waiting for approval", async () => scoped(async () => {
    const scope = setupContext();
    state.decision = async () => {
      state.profiles[0].assignments = [{ projectId: "X", status: "removed" }];
      return "allow";
    };
    await expect(executeModuleTool("demo.edit", {}, scope)).rejects.toMatchObject({ code: "ASSISTANT_ASSIGNMENT_REMOVED" });
    expect(handler).not.toHaveBeenCalled();
  }));
  it("holds admission until the protected operation finishes", async () => scoped(async () => {
    const scope = setupContext();
    handler.mockImplementationOnce(async () => {
      expect(hasAssignmentAdmission(executor, "a", new Set(["X"]))).toBe(true);
      expect(hasAssignmentAdmission(executor, "a", new Set(["Y"]))).toBe(false);
      return { ok: true, output: null };
    });
    expect(await executeModuleTool("demo.read", { path: "/X/source" }, scope)).toMatchObject({ ok: true });
    expect(hasAssignmentAdmission(executor, "a", new Set(["X"]))).toBe(false);
  }));
  it("intersects profile and assignment tool restrictions", async () => scoped(async () => {
    const scope = setupContext();
    state.profiles[0].allowedTools = ["demo.read"];
    state.profiles[0].assignments = [{ projectId: "X", status: "active", allowedTools: ["demo.edit"] }];
    expect(await executeModuleTool("demo.read", {}, scope)).toMatchObject({ ok: false });
    expect(handler).not.toHaveBeenCalled();
  }));
});

it("intersects normalized legacy tool aliases with assignment limits", async () => scoped(async () => {
  state.enabled.files = true;
  agentCapabilityRegistry.register({ moduleId: "files", version: 1, tools: [{ name: "files.list_dir", title: "List", description: "List", kind: "read", permission: "files.view", inputSchema: { type: "object" }, handler }] });
  state.profiles = [{ id: "a", ownerId: 7, name: "A", systemPrompt: "", allowedTools: ["files.list"], projectIds: ["X"], assignments: [{ projectId: "X", status: "active", allowedTools: ["files.list_dir"] }] }];
  state.projects = [{ id: "X", ownerId: 7, title: "X", path: "/X" }];
  state.meta = { id: "chat", agentId: "a", projectId: "X" };
  expect(await executeModuleTool("files.list_dir", { path: "/X" }, { executor, user, conversationId: "chat" })).toMatchObject({ ok: true });
}));
