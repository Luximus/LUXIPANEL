import { afterEach, describe, expect, it, vi } from "vitest";
import { hasMcpSessionError, startMcpRecovery } from "./mcp-recovery";
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
describe("real MCP session errors", () => {
  it("ignores mentions, quoted source, user text and successful command output", () => {
    for (const value of ["MCP_SESSION_EXPIRED", { type: "text", delta: "MCP_SESSION_EXPIRED" },
      { type: "tool_result", success: true, output: "MCP_SESSION_EXPIRED" },
      { type: "item.completed", item: { type: "command_execution", output: 'const marker = "MCP_SESSION_EXPIRED"' } },
      { type: "agent_message", text: "MCP_SESSION_EXPIRED" }]) expect(hasMcpSessionError(value)).toBe(false);
  });
  it("detects API, MCP and JSONL errors", () => {
    for (const value of [{ type: "error", message: "[MCP_SESSION_EXPIRED]" },
      { type: "tool_result", success: false, output: "[MCP_SESSION_EXPIRED]" },
      { type: "item.completed", item: { type: "mcp_tool_call", result: { isError: true, content: [{ type: "text", text: "[MCP_SESSION_EXPIRED]" }] } } }]) {
      expect(hasMcpSessionError(value)).toBe(true);
      expect(hasMcpSessionError('not JSON\n'+JSON.stringify(value)+'\n')).toBe(true);
    }
  });
});
describe("automatic MCP recovery", () => {
  it("runs without a click and deduplicates concurrent consumers", async () => {
    const repair = vi.fn(async () => ({ ok: true, stamp: "now" }));
    const a = vi.fn(), b = vi.fn(), failed = vi.fn();
    startMcpRecovery({ key: "dedupe", current: () => true, repair, recovered: a, failed });
    startMcpRecovery({ key: "dedupe", current: () => true, repair, recovered: b, failed });
    await vi.waitFor(() => expect(b).toHaveBeenCalledOnce());
    expect(a).toHaveBeenCalledOnce(); expect(repair).toHaveBeenCalledOnce(); expect(failed).not.toHaveBeenCalled();
  });
  it("retries silently and only reports an error after three failed attempts", async () => {
    vi.useFakeTimers(); const repair = vi.fn(async () => ({ ok: false, error: "unavailable" })), failed = vi.fn();
    startMcpRecovery({ key: "retry", current: () => true, repair, recovered: vi.fn(), failed });
    await vi.advanceTimersByTimeAsync(0); expect(repair).toHaveBeenCalledTimes(1); expect(failed).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5000); expect(repair).toHaveBeenCalledTimes(2); expect(failed).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(15000); expect(repair).toHaveBeenCalledTimes(3); expect(failed).toHaveBeenCalledWith("unavailable");
    await vi.advanceTimersByTimeAsync(120000); expect(repair).toHaveBeenCalledTimes(3);
  });
  it("recovers after a transient error", async () => {
    vi.useFakeTimers(); const repair = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValue({ ok: true });
    const recovered = vi.fn(), failed = vi.fn();
    startMcpRecovery({ key: "transient", current: () => true, repair, recovered, failed });
    await vi.advanceTimersByTimeAsync(5001); expect(recovered).toHaveBeenCalledOnce(); expect(failed).not.toHaveBeenCalled();
  });
  it("does not repair after switching target before dispatch", async () => {
    const repair = vi.fn(), stop = startMcpRecovery({ key: "cancel", current: () => true, repair, recovered: vi.fn(), failed: vi.fn() });
    stop(); await Promise.resolve(); expect(repair).not.toHaveBeenCalled();
  });
  it("ignores a stale response after switching conversations", async () => {
    let done!: (value: {ok: boolean}) => void, current = true;
    const recovered = vi.fn(), failed = vi.fn();
    startMcpRecovery({ key: "stale", current: () => current, repair: () => new Promise(resolve => { done = resolve; }), recovered, failed });
    await Promise.resolve(); current = false; done({ ok: true }); await Promise.resolve();
    expect(recovered).not.toHaveBeenCalled(); expect(failed).not.toHaveBeenCalled();
  });
});
