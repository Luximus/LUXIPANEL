// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ tools: [{ name: "inspect", annotations: { readOnlyHint: true }, inputSchema: { type: "object" } }] as any[], fail: false, requests: vi.fn() }));
vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({ Client: class {
  async connect() {}
  async request(request: any) {
    state.requests(request);
    if (request.method === "tools/list") { if (state.fail) throw new Error("Disconnected"); return { tools: state.tools }; }
    return { content: [{ type: "text", text: "ok" }] };
  }
} }));
vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => ({ StdioClientTransport: class { close() {} } }));
vi.mock("../../auth/services/live-authorization.service.js", () => ({ resolveLiveAuthorization: async (user: any) => user }));
import { mcpConnectionService } from "./mcp-connection.service.js";
import { setModuleCatalogProvider } from "../../../shared/module-state/index.js";
import { agentCapabilityRegistry } from "../../../shared/agent-capability/registry.js";
import { runWithExecutor } from "../../../shared/executor/context.js";
import type { SessionUser } from "../../../shared/types/index.js";
import type { Executor } from "../../../shared/executor/types.js";
const executor = { target: { id: "A" } } as Executor;
const admin = { userId: 7, kind: "admin", modules: [] } as unknown as SessionUser;
beforeEach(() => {
  state.tools = [{ name: "inspect", annotations: { readOnlyHint: true }, inputSchema: { type: "object" } }]; state.fail = false; state.requests.mockClear();
  setModuleCatalogProvider(() => [{ id: "github-mcp", name: "GitHub", description: "", kind: "mcp_server" }, { id: "codebase-graph", name: "Graph", description: "", kind: "mcp_server" }]);
  agentCapabilityRegistry._resetForTest();
});
afterEach(async () => { await mcpConnectionService.disconnect("github-mcp"); await mcpConnectionService.disconnect("codebase-graph"); agentCapabilityRegistry._resetForTest(); });
it("refreshes schemas and rejects captured tools after replacement or disconnect", async () => {
  await mcpConnectionService.connect("github-mcp", ["mock"]);
  const old = agentCapabilityRegistry.get("github-mcp")!.tools[0]!;
  expect(old.kind).toBe("read");
  await runWithExecutor(executor, async () => expect(await old.handler({})).toMatchObject({ ok: true }), 7, admin);
  state.tools = [{ name: "mutate", inputSchema: { type: "object" } }];
  await Promise.all([mcpConnectionService.refreshTools("github-mcp"), mcpConnectionService.refreshTools("github-mcp")]);
  const replacement = agentCapabilityRegistry.get("github-mcp")!.tools[0]!;
  expect(replacement.kind).toBe("action");
  await expect(runWithExecutor(executor, () => old.handler({}), 7, admin)).rejects.toThrow("changed");
  await mcpConnectionService.disconnect("github-mcp");
  await expect(runWithExecutor(executor, () => replacement.handler({}), 7, admin)).rejects.toThrow("changed");
});
it("removes external tools on a failed catalog refresh and never enrolls a raw graph MCP", async () => {
  await mcpConnectionService.connect("github-mcp", ["mock"]);
  state.fail = true;
  await expect(mcpConnectionService.refreshTools("github-mcp")).rejects.toThrow();
  expect(agentCapabilityRegistry.get("github-mcp")!.tools).toHaveLength(0);
  state.fail = false;
  await mcpConnectionService.connect("codebase-graph", ["mock"]);
  expect(agentCapabilityRegistry.get("codebase-graph")).toBeUndefined();
});
