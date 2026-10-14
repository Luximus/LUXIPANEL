// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { EventEmitter } from "node:events";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { isDeepStrictEqual } from "node:util";

const source = readFileSync(new URL("./codex-app-server-adapter.mjs", import.meta.url), "utf8").replace(/^import .*;\n/gm, "");
async function adapter(mode = "manual") {
  vi.useFakeTimers();
  const events: any[] = [], replies: any[] = [];
  let receive = (_line: string) => {};
  let decision: string | undefined;
  const reads: string[] = [];
  const child = Object.assign(new EventEmitter(), {
    stdout: {}, stderr: new EventEmitter(), exitCode: null, signalCode: null, kill: vi.fn(),
    stdin: { write(line: string) {
      const req = JSON.parse(line);
      if (!req.method) { replies.push(req); return; }
      if (!req.id) return;
      const result = req.method === "thread/start" ? { thread: { id: "thread" } } : {};
      queueMicrotask(() => receive(JSON.stringify({ id: req.id, result })));
    } },
  });
  await runInNewContext(`(async () => {${source}\n})()`, {
    process: { argv: ["node", "adapter", "config"], stdout: { write: (s: string) => events.push(JSON.parse(s)) } },
    spawn: () => child,
    createInterface: () => ({ on(_name: string, cb: typeof receive) { receive = cb; } }),
    readFile: async (file: string) => {
      if (file === "config") return JSON.stringify({ promptFile: "prompt", approvalDir: "/approvals", approvalMode: mode });
      if (file === "prompt") return "task";
      reads.push(file);
      if (!decision) throw new Error("No decision yet");
      return JSON.stringify({ decision });
    },
    unlink: async () => {}, setTimeout, clearTimeout, Date, isDeepStrictEqual,
  });
  const notify = (method: string, params: any, id?: string | number) => receive(JSON.stringify({ method, params, ...(id !== undefined ? { id } : {}) }));
  const start = (overrides = {}) => notify("item/started", { item: { id: "mcp-call", type: "mcpToolCall", server: "luxipanel-modules", tool: "modules__execute", ...overrides } });
  const decide = async (value: string) => { decision = value; await vi.advanceTimersByTimeAsync(400); };
  return { events, replies, notify, start, decide, reads };
}
const question = { itemId: "mcp-call", questions: [{ id: "approval", question: "Allow this tool call?", options: [{ label: "Accept" }, { label: "Decline" }, { label: "Cancel" }] }] };
const elicitation = { mode: "form", serverName: "luxipanel-modules", message: "Allow this tool call?", requestedSchema: { type: "object", properties: {} }, _meta: { codex_approval_kind: "mcp_tool_call", tool_name: "modules__execute", callId: "mcp-call" } };
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe("Codex MCP approvals use the panel decision", () => {
  it.each(["item/tool/requestUserInput", "tool/requestUserInput"])("relays %s instead of silently rejecting it", async method => {
    const a = await adapter(); a.start(); a.notify(method, question, 90);
    expect(a.events.at(-1)).toMatchObject({ type: "lxp.approval.request", tool: "mcp__luxipanel-modules__modules__execute" });
    expect(a.replies).toHaveLength(0);
    await a.decide("allow");
    expect(a.replies).toEqual([{ id: 90, result: { answers: { approval: { answers: ["Accept"] } } } }]);
  });
  it.each(["deny", "always"])("honours a %s decision for the exact pending MCP call", async decision => {
    const a = await adapter(); a.start(); a.notify("item/tool/requestUserInput", question, 91); await a.decide(decision);
    expect(a.replies[0].result.answers.approval.answers).toEqual([decision === "deny" ? "Decline" : "Accept"]);
  });
  it.each(["allow", "deny"])("responds to native elicitation with %s", async decision => {
    const a = await adapter(); a.start(); a.notify("mcpServer/elicitation/request", elicitation, 92); await a.decide(decision);
    expect(a.replies).toEqual([{ id: 92, result: { action: decision === "allow" ? "accept" : "decline", content: decision === "allow" ? {} : null } }]);
  });
  it("does not grant persistent MCP permission and preserves mandatory user review", async () => {
    const a = await adapter("auto"); a.start();
    a.notify("mcpServer/elicitation/request", { ...elicitation, requestedSchema: { type: "object", properties: { persist: { type: "boolean" } } }, _meta: { ...elicitation._meta, codex_requires_user_input: true } }, "../../unsafe");
    expect(a.events.at(-1)).toMatchObject({ require_user_approval: true });
    expect(a.reads).toEqual(["/approvals/1.json"]);
    await a.decide("always");
    expect(a.replies[0]).toEqual({ id: "../../unsafe", result: { action: "accept", content: { persist: false } } });
  });
  it("declines unanswered approval after the deadline", async () => {
    const a = await adapter(); a.start(); a.notify("mcpServer/elicitation/request", elicitation, 93);
    await vi.advanceTimersByTimeAsync(5 * 60_000 + 400);
    expect(a.replies[0].result).toEqual({ action: "decline", content: null });
  });
  it.each(["missing-call", "general-question", "data-form", "other-server"])("does not auto-answer %s", async kind => {
    const a = await adapter(); if (kind !== "missing-call") a.start();
    if (kind === "general-question") a.notify("item/tool/requestUserInput", { ...question, questions: [{ ...question.questions[0], options: [{ label: "Option A" }, { label: "Option B" }] }] }, 94);
    else a.notify("mcpServer/elicitation/request", { ...elicitation, ...(kind === "data-form" ? { requestedSchema: { type: "object", properties: { password: { type: "string" } } } } : {}), ...(kind === "other-server" ? { serverName: "unrelated" } : {}) }, 94);
    expect(a.replies[0]).toMatchObject({ id: 94, error: { code: -32601 } });
    expect(a.events.some(e => e.type === "lxp.approval.request")).toBe(false);
  });
  // Captured from the installed Codex 0.160.1 with a local mock model/MCP.
  // Unlike the original synthetic fixture, this has neither tool_name nor callId.
  it.each(["qa", "luxipanel-modules", "another-provider"])("correlates native metadata for %s", async server => {
    const a = await adapter(); a.start({ server, arguments: { value: "integration" } });
    const request = { ...elicitation, serverName: server, _meta: {
      codex_approval_kind: "mcp_tool_call", persist: ["session", "always"],
      tool_description: "Local probe", tool_params: { value: "integration" },
      tool_params_display: [{ name: "value", value: "integration", display_name: "value" }],
    } };
    a.notify("mcpServer/elicitation/request", request, 101);
    expect(a.events.at(-1)).toMatchObject({ type: "lxp.approval.request", tool: `mcp__${server}__modules__execute` });
    await a.decide("allow");
    expect(a.replies[0]).toEqual({ id: 101, result: { action: "accept", content: {} } });
  });
  it("matches arguments independent of object key order among concurrent calls", async () => {
    const a = await adapter();
    a.start({ id: "a", arguments: { serverId: "one", input: { x: 1, y: [2, 3] } } });
    a.start({ id: "b", arguments: { serverId: "two", input: { x: 1, y: [2, 3] } } });
    a.notify("mcpServer/elicitation/request", { ...elicitation, _meta: {
      codex_approval_kind: "mcp_tool_call", tool_params: { input: { y: [2, 3], x: 1 }, serverId: "two" },
    } }, 102);
    await a.decide("allow");
    expect(a.replies[0].result.action).toBe("accept");
  });
  it.each(["ambiguous", "wrong-arguments", "wrong-id", "no-identity", "finished"])("rejects %s instead of approving the wrong call", async kind => {
    const a = await adapter(); a.start({ arguments: { serverId: "one" } });
    if (kind === "ambiguous") a.start({ id: "duplicate", arguments: { serverId: "one" } });
    if (kind === "finished") a.notify("item/completed", { item: { id: "mcp-call", type: "mcpToolCall" } });
    a.notify("mcpServer/elicitation/request", { ...elicitation, _meta: {
      codex_approval_kind: "mcp_tool_call",
      ...(kind !== "no-identity" ? { tool_params: { serverId: kind === "wrong-arguments" ? "two" : "one" } } : {}),
      ...(kind === "wrong-id" ? { callId: "missing" } : {}),
    } }, 103);
    expect(a.replies[0]).toMatchObject({ error: { code: -32601 } });
    expect(a.events.some(e => e.type === "lxp.approval.request")).toBe(false);
  });
  it("does not apply a delayed permission to a completed call", async () => {
    const a = await adapter(); a.start(); a.notify("mcpServer/elicitation/request", elicitation, 104);
    a.notify("item/completed", { item: { id: "mcp-call", type: "mcpToolCall" } });
    await a.decide("allow"); expect(a.replies[0].result.action).toBe("decline");
  });
  it.each(["allow", "always", "deny"])("supports current Allow/Cancel choices with %s", async decision => {
    const a = await adapter(); a.start();
    a.notify("item/tool/requestUserInput", { ...question, questions: [{
      id: "mcp_tool_call_approval_mcp-call", question: "Allow this call?",
      options: ["Allow", "Allow for this session", "Allow and don't ask me again", "Cancel"].map(label => ({ label })),
    }] }, 105);
    await a.decide(decision);
    expect(a.replies[0].result.answers["mcp_tool_call_approval_mcp-call"].answers).toEqual([decision === "deny" ? "Cancel" : "Allow"]);
  });
  it("keeps command approval responses compatible", async () => {
    const a = await adapter(); a.notify("item/commandExecution/requestApproval", { command: "example" }, 95); await a.decide("allow");
    expect(a.replies[0]).toEqual({ id: 95, result: { decision: "accept" } });
  });
});

// Exercise the actual tracker relay with injected broker/executor boundaries.
// This verifies auto/manual/plan policy without a live server or real actions.
const tracker = readFileSync(new URL("../../cli-job-tracker.service.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("tracker.ts", tracker, ts.ScriptTarget.Latest, true);
const fn = ast.statements.find(s => ts.isFunctionDeclaration(s) && s.name?.text === "relayCodexApprovals")!;
const relaySource = ts.transpileModule(fn.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
describe("MCP approval relay policy", () => {
  it.each([
    ["auto", false, "allow", 0], ["auto", true, "deny", 1],
    ["manual", false, "deny", 1], ["plan", false, "deny", 0],
  ])("mode %s mandatory=%s respects the decision", async (mode, mandatory, decision, prompts) => {
    const broker = vi.fn().mockResolvedValue("deny"), writeFile = vi.fn().mockResolvedValue(undefined);
    const relay = runInNewContext(relaySource + "\nrelayCodexApprovals", {
      agentRunRegistry: { getApproval: () => ({ mode, autoApprove: new Set() }) },
      permissionBroker: { request: broker }, Buffer, log: { warn: vi.fn() },
    });
    relay({ provider: "codex", jobId: "fake", conversationId: "chat", approvalBuffer: "", seenApprovals: new Set(), executor: { writeFile } }, JSON.stringify({ type: "lxp.approval.request", request_id: "1", tool: "mcp__test__action", require_user_approval: mandatory }) + "\n");
    await vi.waitFor(() => expect(writeFile).toHaveBeenCalledTimes(1));
    expect(broker).toHaveBeenCalledTimes(Number(prompts));
    expect(JSON.parse(writeFile.mock.calls[0][1].toString()).decision).toBe(decision);
  });
});
