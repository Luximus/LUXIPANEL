import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentTool } from "../../../../shared/agent-capability/index.js";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../permission-broker.js", () => ({ permissionBroker: { request } }));
vi.mock("../agent-run-registry.js", () => ({ agentRunRegistry: { getApproval: () => null } }));
vi.mock("../headroom-client.service.js", () => ({ headroomClient: { compressToolOutput: vi.fn() } }));

import { runToolHandler } from "./api-loop.js";

describe("API tool approval modes", () => {
  const handler = vi.fn(async () => ({ ok: true, output: "done" }));
  const tool: AgentTool = {
    name: "test.change", title: "Change", description: "Changes a resource",
    kind: "action", inputSchema: { type: "object", properties: {} }, handler,
  };
  beforeEach(() => { handler.mockClear(); request.mockReset(); });

  it("blocks writes in plan mode", async () => {
    const result = await runToolHandler([tool], tool.name, {}, { approvalMode: "plan", conversationId: "c" });
    expect(result.success).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it("asks in manual mode and honors denial", async () => {
    request.mockResolvedValue("deny");
    const result = await runToolHandler([tool], tool.name, {}, { approvalMode: "manual", conversationId: "c" });
    expect(request).toHaveBeenCalledOnce();
    expect(result.success).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it("runs approved manual and automatic actions", async () => {
    request.mockResolvedValue("allow");
    expect((await runToolHandler([tool], tool.name, {}, { approvalMode: "manual", conversationId: "c" })).success).toBe(true);
    expect((await runToolHandler([tool], tool.name, {}, { approvalMode: "auto", conversationId: "c" })).success).toBe(true);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("lets the authorized team-review handler decide in manual mode without a recursive human prompt", async () => {
    const review = { ...tool, name: "team.review" };
    expect((await runToolHandler([review], review.name, {}, { approvalMode: "manual", conversationId: "leader" })).success).toBe(true);
    expect(request).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledOnce();
    expect((await runToolHandler([review], review.name, {}, { approvalMode: "plan", conversationId: "leader" })).success).toBe(false);
    expect(handler).toHaveBeenCalledOnce();
  });
});
