// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistantAgent } from "../../models/assistant-agent.types.js";
import type { AgentRunOptions } from "../agent.service.js";

vi.mock("../team-tasks.service.js", () => ({ spawnWorker: vi.fn(), validateWorkerProject: vi.fn() }));
const defaults: { defaultChatEffort?: "" | "high" | "xhigh" | "max" } = {};
vi.mock("../../repositories/assistant-config.repository.js", () => ({
  assistantConfigRepository: { load: async () => ({ ...defaults }) },
}));

import { buildDelegateTool } from "./delegation-tools.js";

const leader: AssistantAgent = {
  id: "leader", name: "Leader", description: "", systemPrompt: "",
  providerId: "claude", model: "", allowedTools: null,
};
const worker: AssistantAgent = { ...leader, id: "worker", parentAgentId: "leader" };

beforeEach(() => { delete defaults.defaultChatEffort; });

describe("synchronous delegation scope", () => {
  it.each(["max", "xhigh", "high", "", undefined] as const)("passes the configured reasoning choice %s to the delegate", async effort => {
    if (effort !== undefined) defaults.defaultChatEffort = effort;
    let received: AgentRunOptions | undefined;
    const built = buildDelegateTool({
      agent: leader, allAgents: [leader, worker], executor: undefined, user: undefined,
      userId: undefined, depth: 0, signal: undefined,
      runAgent: async function* (_messages, options) {
        received = options;
        yield { type: "text", delta: "done" };
      },
    })!;
    expect(await built.tool.handler({ agentId: "worker", task: "Inspect the project" })).toEqual({ ok: true, output: "done" });
    expect(received?.effort).toBe(effort || undefined);
  });

  it.each(["auto", "manual", "plan"] as const)("preserves the isolated workspace and %s approval mode", async mode => {
    let received: AgentRunOptions | undefined;
    const built = buildDelegateTool({
      agent: leader, allAgents: [leader, worker], executor: undefined, user: undefined,
      userId: undefined, depth: 0, signal: undefined,
      forcedCwd: "/var/www/LUXIPANEL/.lxp/owner-workspaces/task-one",
      approvalModeOverride: mode,
      runAgent: async function* (_messages, options) {
        received = options;
        yield { type: "text", delta: "done" };
      },
    })!;
    expect(await built.tool.handler({ agentId: "worker", task: "Fix the task" })).toEqual({ ok: true, output: "done" });
    expect(received?.forcedCwd).toBe("/var/www/LUXIPANEL/.lxp/owner-workspaces/task-one");
    expect(received?.approvalModeOverride).toBe(mode);
    expect(received?.conversationId).toBeUndefined();
    expect(received?.agentId).toBe("worker");
  });

  it("retains the delegate's normal project context when the parent is not isolated", async () => {
    let received: AgentRunOptions | undefined;
    const built = buildDelegateTool({
      agent: leader, allAgents: [leader, worker], executor: undefined, user: undefined,
      userId: undefined, depth: 0, signal: undefined,
      runAgent: async function* (_messages, options) {
        received = options;
        yield { type: "text", delta: "done" };
      },
    })!;
    await built.tool.handler({ agentId: "worker", task: "Inspect your project" });
    expect(received?.forcedCwd).toBeUndefined();
    expect(received?.projectId).toBeUndefined();
  });
});
