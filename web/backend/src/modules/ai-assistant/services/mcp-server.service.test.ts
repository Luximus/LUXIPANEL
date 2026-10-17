// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { runWithExecutor } from "../../../shared/executor/context.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { agentCapabilityRegistry } from "../../../shared/agent-capability/index.js";
import type { AgentCapability } from "../../../shared/agent-capability/index.js";
import { localExecutor } from "../../../shared/executor/index.js";
import { communityPreviewRegistry } from "../../../shared/community-preview/index.js";
import type { SessionUser } from "../../../shared/types/index.js";

// Bypass per-target sidecar reads: every tool is allowed.
vi.mock("../repositories/assistant-module-access.repository.js", () => ({
  assistantModuleAccessRepository: {
    load: async () => ({}),
  },
}));

vi.mock("../repositories/assistant-audit.repository.js", () => ({
  assistantAuditRepository: { append: vi.fn().mockResolvedValue(undefined) },
}));

// Module activation is hermetic: the "ping" cap is not a core-catalog module, so
// it bypasses the active filter regardless — these stubs just keep the test from
// reaching the real registry/entitlement (and LP over the network).
vi.mock("../../../shared/module-state/index.js", () => ({
  getModuleCatalog: () => [], getModuleEnabledMap: async () => ({}),
}));
// Mock the approval registry + broker so the permissions.approve table-of-truth
// tests below can drive each mode without touching the real run registry or
// the SSE-pausing broker. The other tests in this file don't use either API,
// so these mocks are inert outside of the new `permissions.approve` describe.
const mockGetApproval = vi.fn();
const mockBrokerRequest = vi.fn();
vi.mock("./agent-run-registry.js", () => ({
  agentRunRegistry: { inject: vi.fn(), getApproval: (...args: unknown[]) => mockGetApproval(...args) },
}));
vi.mock("./permission-broker.js", () => ({
  permissionBroker: { request: (...args: unknown[]) => mockBrokerRequest(...args) },
}));

// Control the run-scoped team toolkit resolution so we can drive each outcome
// (leader chat / not a leader / transient read failure) without SSH or a real
// leader conversation.
const mockBuildTeamTools = vi.fn();
vi.mock("./team-tools.js", () => ({
  buildTeamToolsForConversation: (...args: unknown[]) => mockBuildTeamTools(...args),
}));

import { mcpServerService as rawMcpServerService } from "./mcp-server.service.js";

const mcpServerService = {
  handle: (request: Parameters<typeof rawMcpServerService.handle>[0], ctx: Parameters<typeof rawMcpServerService.handle>[1]) => {
    const user = ctx.user ?? { userId: 1, username: "test", displayName: "Test", role: "admin", modules: [], kind: "admin" } as SessionUser;
    return runWithExecutor(ctx.executor, () => rawMcpServerService.handle(request, { ...ctx, user }), user.userId, user);
  },
};
vi.mock("../../auth/services/live-authorization.service.js", () => ({ resolveLiveAuthorization: async (user: SessionUser) => user }));
// Identity entitlements have their own tests; wire dispatch must not read the
// host's GitHub credentials while exercising these synthetic capabilities.
vi.mock("../../../shared/github/user-connection.js", () => ({ requireGithub: async () => {} }));

function mkCap(): AgentCapability {
  return {
    moduleId: "ping",
    version: 1,
    tools: [
      {
        name: "ping.echo",
        title: "Echo",
        description: "Echo input back.",
        kind: "read",
        inputSchema: {
          type: "object",
          properties: { msg: { type: "string" } },
          required: ["msg"],
        },
        handler: async (input) => ({
          ok: true,
          output: `pong: ${(input as { msg?: string }).msg ?? ""}`,
        }),
      },
    ],
  };
}

const ctx = { executor: localExecutor, userId: "1" };

function mkUser(userId: number): SessionUser {
  return {
    userId,
    username: `dev${userId}`,
    displayName: "Dev",
    role: "admin",
    modules: ["assistant"],
    kind: "admin",
  };
}

/** Capability de un preview Modo B (owner-only) registrada junto a su marker. */
function registerPreviewCap(ownerUserId: string): void {
  agentCapabilityRegistry.register({
    moduleId: "prevmod",
    version: 1,
    tools: [
      {
        name: "prevmod.hello",
        title: "Hello",
        description: "Preview tool.",
        kind: "read",
        inputSchema: { type: "object", properties: {} },
        handler: async () => ({ ok: true, output: "hi" }),
      },
    ],
  });
  communityPreviewRegistry.register({
    moduleId: "prevmod",
    ownerUserId,
    installedAt: new Date().toISOString(),
  });
}

describe("mcpServerService", () => {
  beforeEach(() => {
    agentCapabilityRegistry._resetForTest();
    communityPreviewRegistry._resetForTest();
    agentCapabilityRegistry.register(mkCap());
  });
  afterEach(() => {
    agentCapabilityRegistry._resetForTest();
    communityPreviewRegistry._resetForTest();
  });

  it("initialize returns protocol version + serverInfo", async () => {
    const r = await mcpServerService.handle(
      { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      ctx,
    );
    expect(r?.result).toMatchObject({
      protocolVersion: "2024-11-05",
      serverInfo: { name: "luxipanel-assistant" },
    });
  });

  it("notifications/initialized returns null (no response)", async () => {
    const r = await mcpServerService.handle(
      { jsonrpc: "2.0", method: "notifications/initialized" },
      ctx,
    );
    expect(r).toBeNull();
  });

  it("tools/list maps capability names with `.` → `__`", async () => {
    const r = await mcpServerService.handle(
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
      ctx,
    );
    const result = r?.result as { tools: Array<{ name: string }> };
    expect(result.tools.map((t) => t.name)).toEqual(["ping__echo"]);
  });

  it("tools/call invokes handler by wire name and returns text content", async () => {
    const r = await mcpServerService.handle(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "ping__echo", arguments: { msg: "hola" } },
      },
      ctx,
    );
    const result = r?.result as { content: Array<{ type: string; text: string }>; isError: boolean };
    expect(result.isError, result.content[0]?.text).toBe(false);
    expect(result.content[0]?.text).toBe("pong: hola");
  });

  it("unknown tool returns isError: true (not a JSON-RPC error)", async () => {
    const r = await mcpServerService.handle(
      {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "missing__tool", arguments: {} },
      },
      ctx,
    );
    const result = r?.result as { isError: boolean };
    expect(result.isError).toBe(true);
  });

  it("unknown method returns JSON-RPC error -32601", async () => {
    const r = await mcpServerService.handle(
      { jsonrpc: "2.0", id: 5, method: "tools/destroy" },
      ctx,
    );
    expect(r?.error?.code).toBe(-32601);
  });

  describe("previews owner-only (Modo B) en el loopback MCP", () => {
    it("tools/list muestra la tool del preview SOLO a su dueño", async () => {
      registerPreviewCap("7");
      const names = async (user?: SessionUser) => {
        const r = await mcpServerService.handle(
          { jsonrpc: "2.0", id: 10, method: "tools/list" },
          { executor: localExecutor, userId: user ? String(user.userId) : undefined, user },
        );
        return (r?.result as { tools: Array<{ name: string }> }).tools.map((t) => t.name);
      };
      expect(await names(mkUser(7))).toContain("prevmod__hello");
      expect(await names(mkUser(8))).not.toContain("prevmod__hello"); // otro admin del panel
      expect(await names(undefined)).not.toContain("prevmod__hello"); // sin identidad → oculto
    });

    it("tools/call rechaza la tool del preview para quien no es el dueño", async () => {
      registerPreviewCap("7");
      const call = async (user?: SessionUser) =>
        mcpServerService.handle(
          {
            jsonrpc: "2.0",
            id: 11,
            method: "tools/call",
            params: { name: "prevmod__hello", arguments: {} },
          },
          { executor: localExecutor, userId: user ? String(user.userId) : undefined, user },
        );
      const owner = (await call(mkUser(7)))?.result as { isError: boolean; content: Array<{ text: string }> };
      expect(owner.isError, owner.content[0]?.text).toBe(false);
      expect(owner.content[0]?.text).toBe("hi");
      const intruder = (await call(mkUser(8)))?.result as { isError: boolean };
      expect(intruder.isError).toBe(true);
      const anonymous = (await call(undefined))?.result as { isError: boolean };
      expect(anonymous.isError).toBe(true);
    });
  });

  // ── permissions.approve — mode × autoApprove × read-only table ─────────
  // Drives `handlePermissionRequest` indirectly via tools/call. The MCP layer
  // is the gate the CLI's `--permission-prompt-tool` talks to; this is the
  // single source of truth for which tools get through, regardless of whether
  // the CLI bridge is configured with `--permission-prompt-tool` (manual),
  // `--dangerously-skip-permissions` (auto), or `--permission-mode plan`.
  describe("permissions.approve — mode × autoApprove × read-only", () => {
    const crossCtx = { executor: localExecutor, userId: "1", permissionConversationId: "conv-A" };
    const noConvCtx = { executor: localExecutor, userId: "1" };
    /** Read-only built-in (permission-policy auto-allows without registry). */
    const callRead = () =>
      mcpServerService.handle(
        {
          jsonrpc: "2.0",
          id: 100,
          method: "tools/call",
          params: { name: "permissions__approve", arguments: { tool_name: "Read", input: { path: "/etc/hostname" } } },
        },
        crossCtx,
      );
    /** Mutating built-in (Bash — needs approval in manual/plan). */
    const callMutating = () =>
      mcpServerService.handle(
        {
          jsonrpc: "2.0",
          id: 101,
          method: "tools/call",
          params: { name: "permissions__approve", arguments: { tool_name: "Bash", input: { command: "rm -rf /" } } },
        },
        crossCtx,
      );

    beforeEach(() => {
      mockGetApproval.mockReset();
      mockBrokerRequest.mockReset().mockResolvedValue("allow");
    });

    it("no conversation channel → fail-safe deny (no prompt possible)", async () => {
      const r = await mcpServerService.handle(
        {
          jsonrpc: "2.0",
          id: 200,
          method: "tools/call",
          params: { name: "permissions__approve", arguments: { tool_name: "Bash", input: {} } },
        },
        noConvCtx,
      );
      const result = r?.result as { isError: boolean; content: Array<{ text: string }> };
      expect(result.isError).toBe(false);
      const payload = JSON.parse(result.content[0]!.text) as { behavior: string };
      expect(payload.behavior).toBe("deny");
      expect(mockGetApproval).not.toHaveBeenCalled();
      expect(mockBrokerRequest).not.toHaveBeenCalled();
    });

    it("read-only tool (Read) → allow regardless of mode (permissionPolicy short-circuit)", async () => {
      mockGetApproval.mockReturnValue({ mode: "manual", autoApprove: new Set<string>() });
      const r = await callRead();
      const payload = JSON.parse((r?.result as { content: Array<{ text: string }> }).content[0]!.text) as { behavior: string };
      expect(payload.behavior).toBe("allow");
      expect(mockGetApproval).not.toHaveBeenCalled();
      expect(mockBrokerRequest).not.toHaveBeenCalled();
    });

    it("mutating tool + auto mode → allow, no broker call", async () => {
      mockGetApproval.mockReturnValue({ mode: "auto", autoApprove: new Set<string>() });
      const r = await callMutating();
      const payload = JSON.parse((r?.result as { content: Array<{ text: string }> }).content[0]!.text) as { behavior: string };
      expect(payload.behavior).toBe("allow");
      expect(mockBrokerRequest).not.toHaveBeenCalled();
    });

    it("mutating tool + manual mode + tool in autoApprove → allow, no broker call", async () => {
      mockGetApproval.mockReturnValue({ mode: "manual", autoApprove: new Set(["Bash"]) });
      const r = await callMutating();
      const payload = JSON.parse((r?.result as { content: Array<{ text: string }> }).content[0]!.text) as { behavior: string };
      expect(payload.behavior).toBe("allow");
      expect(mockBrokerRequest).not.toHaveBeenCalled();
    });

    it("mutating tool + manual mode + NOT in autoApprove → broker.request, follows decision", async () => {
      mockGetApproval.mockReturnValue({ mode: "manual", autoApprove: new Set<string>() });
      mockBrokerRequest.mockResolvedValueOnce("deny");
      const r = await callMutating();
      const payload = JSON.parse((r?.result as { content: Array<{ text: string }> }).content[0]!.text) as { behavior: string };
      expect(payload.behavior).toBe("deny");
      expect(mockBrokerRequest).toHaveBeenCalledOnce();
      expect(mockBrokerRequest.mock.calls[0]![0]).toMatchObject({ conversationId: "conv-A", tool: "Bash" });
    });

    it("mutating tool + plan mode + NOT in autoApprove → DENY direct (defense in depth, no broker)", async () => {
      // Gap E: plan mode must never mutate. Claude Code's native
      // `--permission-mode plan` already blocks mutating tools upstream,
      // but if anything ever forwards a mutating tool to the prompt tool
      // (or the user adds it to `autoApproveTools` by mistake), the broker
      // denies unconditionally. No prompt is ever surfaced.
      mockGetApproval.mockReturnValue({ mode: "plan", autoApprove: new Set<string>() });
      const r = await callMutating();
      const payload = JSON.parse((r?.result as { content: Array<{ text: string }> }).content[0]!.text) as { behavior: string; message?: string };
      expect(payload.behavior).toBe("deny");
      expect(payload.message).toMatch(/plan mode/i);
      expect(mockBrokerRequest).not.toHaveBeenCalled();
    });

    it("mutating tool + plan mode + IN autoApprove → still DENY (autoApprove cannot override plan mode)", async () => {
      mockGetApproval.mockReturnValue({ mode: "plan", autoApprove: new Set(["Bash"]) });
      const r = await callMutating();
      const payload = JSON.parse((r?.result as { content: Array<{ text: string }> }).content[0]!.text) as { behavior: string };
      expect(payload.behavior).toBe("deny");
      expect(mockBrokerRequest).not.toHaveBeenCalled();
    });

    it("no approval snapshot (older run / ephemeral) → falls through to broker", async () => {
      mockGetApproval.mockReturnValue(null);
      mockBrokerRequest.mockResolvedValueOnce("allow");
      const r = await callMutating();
      const payload = JSON.parse((r?.result as { content: Array<{ text: string }> }).content[0]!.text) as { behavior: string };
      expect(payload.behavior).toBe("allow");
      expect(mockBrokerRequest).toHaveBeenCalledOnce();
    });
  });

  // ── team toolkit diagnostic on the cross channel ───────────────────────
  // A CLI leader that loses its per-run binding (run died on a restart, or a
  // transient meta read failure) must NOT silently lose team.* — it should see
  // a `team.unavailable` stub / actionable verdict, distinct from the legit
  // "this chat isn't a leader" silence.
  describe("team toolkit diagnostic (cross channel)", () => {
    const crossCtx = (conv?: string) => ({
      executor: localExecutor,
      userId: "1",
      user: mkUser(1),
      toolNamePrefix: "servers.",
      ...(conv ? { permissionConversationId: conv } : {}),
    });
    const teamTool = {
      name: "team.assign",
      title: "Assign",
      description: "Assign a task to a subordinate.",
      kind: "write" as const,
      inputSchema: { type: "object", properties: {}, required: [] as string[] },
      handler: async () => ({ ok: true, output: "assigned" }),
    };
    const listNames = async (c: Parameters<typeof mcpServerService.handle>[1]) => {
      const r = await mcpServerService.handle({ jsonrpc: "2.0", id: 1, method: "tools/list" }, c);
      return (r?.result as { tools: Array<{ name: string }> }).tools.map((t) => t.name);
    };

    beforeEach(() => {
      mockBuildTeamTools.mockReset();
      // auto mode → the permissions.approve tool is omitted, leaving only the
      // team surface under assertion.
      mockGetApproval.mockReturnValue({ mode: "auto", autoApprove: new Set<string>() });
    });

    it("ready: lists the leader's team tools, no stub", async () => {
      mockBuildTeamTools.mockResolvedValue({ tools: [teamTool], promptBlock: "" });
      const names = await listNames(crossCtx("conv-L"));
      expect(names).toContain("team__assign");
      expect(names).not.toContain("team__unavailable");
    });

    it("not-leader (null): no team tools, no stub — legit silence", async () => {
      mockBuildTeamTools.mockResolvedValue(null);
      const names = await listNames(crossCtx("conv-X"));
      expect(names).not.toContain("team__assign");
      expect(names).not.toContain("team__unavailable");
    });

    it("no conversation binding: exposes team.unavailable stub without reading meta", async () => {
      const names = await listNames(crossCtx());
      expect(names).toContain("team__unavailable");
      expect(mockBuildTeamTools).not.toHaveBeenCalled();
    });

    it("transient meta failure (throw): exposes team.unavailable stub", async () => {
      mockBuildTeamTools.mockRejectedValue(new Error("SFTP read failed"));
      const names = await listNames(crossCtx("conv-L"));
      expect(names).toContain("team__unavailable");
    });

    it("tools/call team.* when unavailable → actionable verdict, isError", async () => {
      const r = await mcpServerService.handle(
        { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "team__assign", arguments: {} } },
        crossCtx(), // no binding → unavailable
      );
      const result = r?.result as { isError: boolean; content: Array<{ text: string }> };
      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toMatch(/TEAM_CHANNEL_UNAVAILABLE/);
    });

    it("tools/call team.assign when ready → runs the real handler", async () => {
      mockBuildTeamTools.mockResolvedValue({ tools: [teamTool], promptBlock: "" });
      const r = await mcpServerService.handle(
        { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "team__assign", arguments: {} } },
        crossCtx("conv-L"),
      );
      const result = r?.result as { isError: boolean; content: Array<{ text: string }> };
      expect(result.isError).toBe(false);
      expect(result.content[0]?.text).toBe("assigned");
    });
  });
});

describe("run-scoped module MCP channel", () => {
  it("exposes only the four gateway tools and closes after the run ends", async () => {
    const { bindModuleToolRun } = await import("./module-tools.service.js");
    const user = mkUser(7), scopedContext = { ...ctx, user, moduleChannel: true, permissionConversationId: "channel-test" };
    const release = runWithExecutor(localExecutor, () => bindModuleToolRun("channel-test", localExecutor, user, []), 7, user);
    try {
      const list = await mcpServerService.handle({ jsonrpc: "2.0", id: 1, method: "tools/list" }, scopedContext);
      expect((list!.result as any).tools.map((tool: any) => tool.name).sort()).toEqual(["modules__describe", "modules__execute", "modules__list", "modules__read"]);
      const tools = (list!.result as any).tools;
      for (const name of ["modules__list", "modules__describe", "modules__read"]) {
        expect(tools.find((tool: any) => tool.name === name)?.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, idempotentHint: true });
      }
      expect(tools.find((tool: any) => tool.name === "modules__execute")?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true, idempotentHint: false });
      const denied = await mcpServerService.handle({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "servers__exec", arguments: {} } }, scopedContext);
      expect(denied?.result).toMatchObject({ isError: true });
    } finally { release(); }
    const expired = await mcpServerService.handle({ jsonrpc: "2.0", id: 3, method: "tools/list" }, scopedContext);
    expect((expired!.result as any).tools).toEqual([]);
  });
});
