// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests for the MCP executor-resolution fallback (`resolveExecutor`).
 *
 * Matrix under test: a token whose `bridgeSessionId` no longer resolves
 * (direct executor AND bridged session both miss) must
 *   - re-resolve to the ACTIVE run's pinned executor when the token carries
 *     the run's `conversationId` and the run owner matches `userId`;
 *   - stay FAIL-CLOSED (McpSessionExpiredError) in every other case: no
 *     conversationId, owner mismatch, ownerless run, or finished run.
 */
import { describe, expect, it, vi } from "vitest";

// config/env fail-fasts on missing env (transitively imported by the logger
// and the controller). Provide the minimum BEFORE any module import.
process.env.JWT_SECRET ??= "x".repeat(40);
process.env.LICENSE_SERVER_URL ??= "http://127.0.0.1:3300";

// Cut the heavy import chains the controller drags in but the resolution
// logic never touches (tool registry, config writer, JWT plumbing).
vi.mock("../services/mcp-server.service.js", () => ({
  mcpServerService: { handle: vi.fn() },
  MCP_PROTOCOL_VERSION: "2025-06-18",
  MCP_SERVER_INFO: { name: "test", version: "0" },
}));
vi.mock("../services/mcp-config-writer.service.js", () => ({
  mcpConfigWriterService: { install: vi.fn() },
}));
vi.mock("../../auth/services/token.service.js", () => ({
  tokenService: { verify: vi.fn(), signWithExpiry: vi.fn(), toSessionUser: vi.fn() },
}));
// This suite owns synthetic identities; live account policy is tested in auth.
vi.mock("../../auth/services/live-authorization.service.js", () => ({ resolveLiveAuthorization: async (user: SessionUser) => user }));
// Both regular resolutions MISS: the direct-executor lookup and the bridged
// session are what the fallback kicks in after.
vi.mock("../../../shared/executor/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../shared/executor/index.js")>();
  return {
    ...actual,
    getExecutor: vi.fn(() => actual.localExecutor),
    getDirectExecutorByBridgeSessionId: vi.fn(async () => null),
  };
});

import { mcpController, __mcpControllerInternals } from "./mcp.controller.js";
import { agentRunRegistry } from "../services/agent-run-registry.js";
import { getDirectExecutorByBridgeSessionId, localExecutor, type Executor } from "../../../shared/executor/index.js";
import type { SessionUser } from "../../../shared/types/index.js";
import type { AgentEvent } from "../services/agent.service.js";

const { resolveExecutor, McpSessionExpiredError } = __mcpControllerInternals;

const owner = {
  userId: 7,
  username: "u",
  displayName: "U",
  role: "admin",
  modules: ["assistant"],
  kind: "admin",
} as unknown as SessionUser;

/** Start a long-lived run pinned to `executor`; caller must stop() it. */
function startActiveRun(key: string, executor: Executor, user?: SessionUser): void {
  agentRunRegistry.start({
    key,
    executor,
    ...(user ? { user } : {}),
    makeGen: async function* (): AsyncGenerator<AgentEvent> {
      for (let i = 0; i < 200; i++) {
        await new Promise((r) => setTimeout(r, 20));
        yield { type: "text", delta: String(i) } as AgentEvent;
      }
      yield { type: "done" } as AgentEvent;
    },
  });
}

async function waitFor(pred: () => boolean, timeout = 1000): Promise<void> {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > timeout) throw new Error("waitFor timed out");
    await new Promise((r) => setTimeout(r, 5));
  }
}

describe("resolveExecutor — stale bridge session fallback (MCP cross channel)", () => {
  it("no bridgeSessionId → localExecutor (non-managed-style token, unchanged)", async () => {
    await expect(resolveExecutor({})).resolves.toBe(localExecutor);
  });

  it("remote target without bridge material fails closed", async () => {
    await expect(resolveExecutor({ targetId: "mcp-target" })).rejects.toBeInstanceOf(McpSessionExpiredError);
  });

  it("rejects a bridge that resolves to a different server", async () => {
    vi.mocked(getDirectExecutorByBridgeSessionId).mockResolvedValueOnce({ target: { id: "other-target" } } as never);
    await expect(resolveExecutor({ targetId: "mcp-target", bridgeSessionId: "wrong-bridge" })).rejects.toBeInstanceOf(McpSessionExpiredError);
  });

  it("does not reuse an active run on another server for a stale token", async () => {
    const key = `conv-mcp-server-mismatch-${Math.random()}`;
    startActiveRun(key, { target: { id: "other-target" } } as Executor, owner);
    try {
      await expect(resolveExecutor({
        targetId: "mcp-target", bridgeSessionId: "dead-bridge", conversationId: key, userId: owner.userId,
      })).rejects.toBeInstanceOf(McpSessionExpiredError);
    } finally {
      agentRunRegistry.stop(key, "other-target");
      await waitFor(() => !agentRunRegistry.isActive(key, "other-target"));
    }
  });

  it("stale bridge + active run + owner match → the run's pinned executor", async () => {
    const key = `conv-mcp-fallback-${Math.random()}`;
    const pinned = { marker: "pinned", target: { id: "mcp-target" } } as unknown as Executor;
    startActiveRun(key, pinned, owner);
    await waitFor(() => agentRunRegistry.isActive(key, "mcp-target"));
    try {
      const got = await resolveExecutor({
        bridgeSessionId: "dead-bridge", targetId: "mcp-target",
        conversationId: key,
        userId: 7,
      });
      expect(got).toBe(pinned);
    } finally {
      agentRunRegistry.stop(key, "mcp-target");
      await waitFor(() => !agentRunRegistry.isActive(key, "mcp-target"));
    }
  });

  it("stale bridge + owner MISMATCH → fail-closed McpSessionExpiredError", async () => {
    const key = `conv-mcp-mismatch-${Math.random()}`;
    startActiveRun(key, { marker: "pinned", target: { id: "mcp-target" } } as unknown as Executor, owner);
    await waitFor(() => agentRunRegistry.isActive(key, "mcp-target"));
    try {
      await expect(
        resolveExecutor({ bridgeSessionId: "dead-bridge", targetId: "mcp-target", conversationId: key, userId: 99 }),
      ).rejects.toBeInstanceOf(McpSessionExpiredError);
    } finally {
      agentRunRegistry.stop(key, "mcp-target");
      await waitFor(() => !agentRunRegistry.isActive(key, "mcp-target"));
    }
  });

  it("stale bridge + OWNERLESS run → fail-closed (strict owner check)", async () => {
    const key = `conv-mcp-ownerless-${Math.random()}`;
    startActiveRun(key, { marker: "pinned", target: { id: "mcp-target" } } as unknown as Executor);
    await waitFor(() => agentRunRegistry.isActive(key, "mcp-target"));
    try {
      await expect(
        resolveExecutor({ bridgeSessionId: "dead-bridge", targetId: "mcp-target", conversationId: key, userId: 7 }),
      ).rejects.toBeInstanceOf(McpSessionExpiredError);
    } finally {
      agentRunRegistry.stop(key, "mcp-target");
      await waitFor(() => !agentRunRegistry.isActive(key, "mcp-target"));
    }
  });

  it("stale bridge + NO conversationId (installed full-endpoint token) → fail-closed", async () => {
    await expect(
      resolveExecutor({ bridgeSessionId: "dead-bridge", targetId: "mcp-target", userId: 7 }),
    ).rejects.toBeInstanceOf(McpSessionExpiredError);
  });

  it("stale bridge + FINISHED run → fail-closed (fallback dies with the run)", async () => {
    const key = `conv-mcp-finished-${Math.random()}`;
    agentRunRegistry.start({
      key,
      executor: { marker: "pinned", target: { id: "mcp-target" } } as unknown as Executor,
      user: owner,
      makeGen: async function* (): AsyncGenerator<AgentEvent> {
        yield { type: "text", delta: "x" } as AgentEvent;
        yield { type: "done" } as AgentEvent;
      },
    });
    await waitFor(() => !agentRunRegistry.isActive(key, "mcp-target") && agentRunRegistry.has(key, "mcp-target"));
    await expect(
      resolveExecutor({ bridgeSessionId: "dead-bridge", targetId: "mcp-target", conversationId: key, userId: 7 }),
    ).rejects.toBeInstanceOf(McpSessionExpiredError);
  });
});

describe("module token endpoint isolation", () => {
  const response = () => {
    const res = { status: vi.fn(), set: vi.fn(), json: vi.fn(), end: vi.fn() };
    res.status.mockReturnValue(res); res.set.mockReturnValue(res);
    return res;
  };
  it.each([undefined, "cross", "graph"])("does not accept a %s token on the module endpoint", async mcpScope => {
    const { tokenService } = await import("../../auth/services/token.service.js");
    vi.mocked(tokenService.verify).mockResolvedValue({ ...owner, mcpScope } as never);
    const res = response();
    await mcpController.handleModules({ header: () => "Bearer test", headers: { authorization: "Bearer test" }, body: { jsonrpc: "2.0", id: 1, method: "tools/list" } } as never, res as never);
    expect(res.status).toHaveBeenCalledWith(403);
  });
  it.each(["handle", "handleCross", "handleGraph"] as const)("does not replay a module token on %s", async endpoint => {
    const { tokenService } = await import("../../auth/services/token.service.js");
    vi.mocked(tokenService.verify).mockResolvedValue({ ...owner, mcpScope: "modules" } as never);
    const res = response();
    await mcpController[endpoint]({ header: () => "Bearer test", headers: { authorization: "Bearer test" }, body: { jsonrpc: "2.0", id: 1, method: "tools/list" } } as never, res as never);
    expect(res.status).toHaveBeenCalledWith(403);
  });
  it("restores the run jail and refuses an expired module run", async () => {
    const { tokenService } = await import("../../auth/services/token.service.js");
    const { mcpServerService } = await import("../services/mcp-server.service.js");
    const { bindModuleToolRun } = await import("../services/module-tools.service.js");
    const { runWithExecutor, setContextFileJail, getFileJailPaths } = await import("../../../shared/executor/context.js");
    const req = { header: () => "Bearer test", headers: { authorization: "Bearer test" }, body: { jsonrpc: "2.0", id: 1, method: "tools/list" } };
    vi.mocked(tokenService.verify).mockResolvedValue({ ...owner, targetId: "local", mcpScope: "modules", conversationId: "module-jail" } as never);
    vi.mocked(tokenService.toSessionUser).mockReturnValue(owner);
    const release = runWithExecutor(localExecutor, () => { setContextFileJail(["/srv/project"]); return bindModuleToolRun("module-jail", localExecutor, owner, []); }, owner.userId, owner);
    vi.mocked(mcpServerService.handle).mockImplementation(async (_body, ctx) => {
      expect(ctx.executor).toBe(localExecutor); expect(ctx.moduleChannel).toBe(true);
      expect(getFileJailPaths()).toEqual(["/srv/project"]);
      return { jsonrpc: "2.0", id: 1, result: {} };
    });
    try { const res = response(); await mcpController.handleModules(req as never, res as never); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ result: {} })); }
    finally { release(); }
    const expired = response(); await mcpController.handleModules(req as never, expired as never);
    expect(expired.status).toHaveBeenCalledWith(403);
  });
});


describe("MCP recovery watermark", () => {
  it.each([true, false])("only marks successful repairs (ok=%s)", async ok => {
    const { mcpRepairService } = await import("../services/mcp-repair.service.js");
    const { conversationsRepository } = await import("../repositories/conversations.repository.js");
    const repair = vi.spyOn(mcpRepairService, "repair").mockResolvedValue({ ok, detail: "test", provider: "codex", reinstalled: ok, expiresAt: 1 });
    const mark = vi.spyOn(conversationsRepository, "markMcpRepaired").mockResolvedValue({ mcpRepairedAt: "now" } as never);
    const res = { locals: { user: owner }, json: vi.fn(), status: vi.fn() };
    const req = { body: { conversationId: "chat", provider: "codex" }, protocol: "http", get: () => "localhost", header: () => "localhost", headers: { host: "localhost" } };
    try {
      const next = vi.fn();
      await mcpController.repair(req as never, res as never, next);
      expect(next).not.toHaveBeenCalled();
      expect(mark).toHaveBeenCalledTimes(ok ? 1 : 0);
      await vi.waitFor(() => expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok })));
    } finally { repair.mockRestore(); mark.mockRestore(); }
  });
});
