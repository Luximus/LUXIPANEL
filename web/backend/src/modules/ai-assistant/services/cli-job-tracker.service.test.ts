import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Executor } from "../../../shared/executor/index.js";
import { runWithExecutor } from "../../../shared/executor/context.js";

vi.mock("../../../shared/events/index.js", () => ({ eventBus: { emit: vi.fn() }, Events: {} }));
vi.mock("../../../shared/logger/index.js", () => ({ createModuleLogger: () => ({ info: vi.fn(), warn: vi.fn() }) }));
vi.mock("./conversation-message-normalizer.js", () => ({ deriveNotificationPreview: () => "" }));
vi.mock("./permission-broker.js", () => ({ permissionBroker: { request: vi.fn() } }));
vi.mock("./agent-run-registry.js", () => ({ agentRunRegistry: { getApproval: () => null } }));
import { cliJobTracker, CLI_EXIT_UNCONFIRMED } from "./cli-job-tracker.service.js";

let sequence = 0;
function track(options: { output?: Buffer; exit?: string; alive?: boolean; age?: number; target?: string } = {}) {
  const state = { output: options.output ?? Buffer.from("avance"), exit: options.exit ?? "", alive: options.alive ?? true, fail: false };
  const exec = vi.fn(async (cmd: string) => {
    if (state.fail) throw new Error("Target did not respond");
    let stdout = "", exitCode = 0;
    if (cmd.includes("dd if=")) {
      const start = Number(cmd.match(/skip=(\d+)/)![1]), size = Number(cmd.match(/count=(\d+)/)![1]);
      stdout = state.output.subarray(start, start + size).toString("base64");
    } else if (cmd.startsWith("cat ")) { stdout = state.exit; exitCode = stdout ? 0 : 1; }
    else if (cmd.startsWith("ps -p")) { stdout = state.alive ? "S" : ""; exitCode = state.alive ? 0 : 1; }
    return { stdout, stderr: "", exitCode, durationMs: 0 };
  });
  const executor = { target: { id: options.target ?? "local", name: "Test" }, exec } as unknown as Executor;
  const id = `job-${++sequence}`;
  const job = cliJobTracker.start({ jobId: id, conversationId: id, executor, pid: "1234", logFile: "log", exitFile: "exit", serverName: "Test", startedAt: Date.now() - (options.age ?? 0), notificationCtx: { title: "Test", link: "/" } });
  const done = vi.fn(), output = vi.fn();
  runWithExecutor(executor, () => {
    cliJobTracker.subscribeDone(id, done);
    cliJobTracker.subscribeOutput(id, output);
    cliJobTracker.setActiveStream(id, true);
  });
  return { state, exec, executor, job, done, output, id };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-16T12:00:00Z")); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe("CLI job tracking", () => {
  it("replays more than the executor output limit and preserves the final answer", async () => {
    const bytes = Buffer.from("x".repeat(11 * 1024 * 1024) + '\n{"type":"turn.completed"}\n');
    const a = track({ output: bytes, exit: "0" });
    await vi.advanceTimersByTimeAsync(3_000);
    expect(a.done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(21_000);
    expect(a.job.accumulated).toBe(bytes.toString());
    expect(a.done).toHaveBeenCalledExactlyOnceWith(bytes.toString(), 0);
    expect(a.exec.mock.calls.some(([cmd]) => cmd === "cat 'log' 2>/dev/null")).toBe(false);
    expect(a.exec.mock.calls.filter(([cmd]) => cmd.includes("dd if=")).length).toBeGreaterThan(40);
  });
  it("preserves UTF-8 characters split between transfers", async () => {
    const bytes = Buffer.from("a".repeat(256 * 1024 - 1) + "🛠️ corrección 中文");
    const a = track({ output: bytes, exit: "0" });
    await vi.advanceTimersByTimeAsync(3_000);
    expect(a.job.accumulated).toBe(bytes.toString());
    expect(a.output.mock.calls.map(([s]) => s).join("")).toBe(bytes.toString());
  });
  it("keeps tracking a live process beyond thirty minutes", async () => {
    const a = track({ age: 2 * 60 * 60_000 });
    await vi.advanceTimersByTimeAsync(36_000);
    expect(a.job.done).toBe(false);
    a.state.exit = "0";
    await vi.advanceTimersByTimeAsync(3_000);
    expect(a.done).toHaveBeenCalledExactlyOnceWith("avance", 0);
  });
  it("confirms a missing process twice and reports unknown status without deleting evidence", async () => {
    const a = track({ alive: false, age: 60_000 });
    await vi.advanceTimersByTimeAsync(3_000);
    expect(a.done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(a.done).toHaveBeenCalledExactlyOnceWith("avance", CLI_EXIT_UNCONFIRMED);
    expect(a.exec.mock.calls.some(([cmd]) => /kill|rm -f/.test(cmd))).toBe(false);
  });
  it("does not mistake connection errors for process death", async () => {
    const a = track({ alive: false, age: 60_000 });
    await vi.advanceTimersByTimeAsync(3_000);
    a.state.fail = true;
    await vi.advanceTimersByTimeAsync(18_000);
    expect(a.done).not.toHaveBeenCalled();
    a.state.fail = false;
    a.state.alive = true;
    await vi.advanceTimersByTimeAsync(18_000);
    expect(a.done).not.toHaveBeenCalled();
  });
  it("uses a late real exit status instead of declaring the process lost", async () => {
    const a = track({ alive: false, age: 60_000 });
    await vi.advanceTimersByTimeAsync(3_000);
    a.state.output = Buffer.from("avance\nrespuesta final");
    a.state.exit = "0";
    await vi.advanceTimersByTimeAsync(3_000);
    expect(a.done).toHaveBeenCalledExactlyOnceWith("avance\nrespuesta final", 0);
  });
  it("does not overlap slow polls or duplicate output", async () => {
    const a = track();
    let release!: () => void;
    a.exec.mockImplementationOnce(() => new Promise(resolve => { release = () => resolve({ stdout: "", stderr: "", exitCode: 1, durationMs: 0 }); }));
    await vi.advanceTimersByTimeAsync(12_000);
    expect(a.exec).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(a.output).toHaveBeenCalledExactlyOnceWith("avance");
  });
  it("preserves a real forced termination code", async () => {
    const a = track({ exit: "137" });
    await vi.advanceTimersByTimeAsync(3_000);
    expect(a.done).toHaveBeenCalledExactlyOnceWith("avance", 137);
  });
  it("uses the pinned target for polling", async () => {
    const a = track({ target: "remote", exit: "0" });
    await vi.advanceTimersByTimeAsync(3_000);
    expect(a.done).toHaveBeenCalledExactlyOnceWith("avance", 0);
  });
});
