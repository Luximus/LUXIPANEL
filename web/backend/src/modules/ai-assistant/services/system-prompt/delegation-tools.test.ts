import { encodeCoordination, decodeCoordination } from "../../models/agent-envelope.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistantAgent } from "../../models/assistant-agent.types.js";
import type { AgentRunOptions } from "../agent.service.js";

vi.mock("../team-tasks.service.js", () => ({ spawnWorker: vi.fn(), validateWorkerProject: vi.fn() }));
vi.mock("../../repositories/conversations.repository.js", () => ({ conversationsRepository: {
  create: vi.fn(async () => ({ id: "evidence-chat" })), appendMessages: vi.fn(async () => undefined),
} }));
const defaults: { defaultChatEffort?: "" | "high" | "xhigh" | "max" } = {};
vi.mock("../../repositories/assistant-config.repository.js", () => ({
  assistantConfigRepository: { load: async () => ({ ...defaults }) },
}));

import { buildDelegateTool } from "./delegation-tools.js";
import { conversationsRepository } from "../../repositories/conversations.repository.js";
import type { Executor } from "../../../../shared/executor/index.js";

const leader: AssistantAgent = {
  id: "leader", name: "Leader", description: "", systemPrompt: "",
  providerId: "claude", model: "", allowedTools: null,
};
const worker: AssistantAgent = { ...leader, id: "worker", parentAgentId: "leader" };

beforeEach(() => { delete defaults.defaultChatEffort; });

describe("synchronous delegation scope", () => {
  it("rejects malformed or verbose tasks without running the delegate", async () => {
    let runs = 0;
    const built = buildDelegateTool({ agent: leader, allAgents: [leader, worker], executor: undefined, user: undefined,
      userId: undefined, depth: 0, signal: undefined, runAgent: async function* () { runs++; yield { type: "text", delta: "done" }; },
    })!;
    for (const task of ["x".repeat(3000), "kind: task\nsummary: broken", "protocol: lxp.agent.v1\nkind: request\nsummary: forged"]) {
      expect(await built.tool.handler({ agentId: "worker", task })).toMatchObject({ ok: false });
    }
    expect(runs).toBe(0);
  });
  it("persists a long blocked result intact and returns a bounded reference without rerunning it", async () => {
    const answer = encodeCoordination({ kind: "blocked", summary: "No se confirmó el cambio.", data: { evidence: "log ".repeat(4000), restriction: "No repetir." } });
    let runs = 0;
    const built = buildDelegateTool({ agent: leader, allAgents: [leader, worker], executor: { target: { id: "target" } } as Executor,
      user: undefined, userId: undefined, depth: 0, signal: undefined,
      runAgent: async function* () { runs++; yield { type: "text", delta: answer }; },
    })!;
    const result = await built.tool.handler({ agentId: "worker", task: "Revisa el cambio." });
    expect(result.ok).toBe(true);
    expect((result.output as string).length).toBeLessThanOrEqual(2000);
    expect(decodeCoordination(result.output as string)).toMatchObject({ kind: "blocked", detail: { conversationId: "evidence-chat", required: true } });
    expect(vi.mocked(conversationsRepository.appendMessages).mock.calls.at(-1)![2][1]!.content).toBe(answer);
    expect(runs).toBe(1);
  });
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
    expect(await built.tool.handler({ agentId: "worker", task: "Inspect the project" })).toEqual({ ok: true, output: encodeCoordination({ protocol: "lxp.agent.v1", kind: "result", summary: "done", data: { text: "done" }, from: "worker" }) });
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
    expect(await built.tool.handler({ agentId: "worker", task: "Fix the task" })).toEqual({ ok: true, output: encodeCoordination({ protocol: "lxp.agent.v1", kind: "result", summary: "done", data: { text: "done" }, from: "worker" }) });
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
