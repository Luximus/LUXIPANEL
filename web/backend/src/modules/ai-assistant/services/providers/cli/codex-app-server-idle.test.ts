import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { EventEmitter } from "node:events";
import { runInNewContext } from "node:vm";

// Execute the actual standalone target adapter with a simulated app-server and
// clock. No credentials, provider calls, processes or hour-long waits.
const source = readFileSync(new URL("./codex-app-server-adapter.mjs", import.meta.url), "utf8").replace(/^import .*;\n/gm, "");
async function adapter(mode = "auto") {
  vi.useFakeTimers();
  const events: any[] = [];
  let receive = (_line: string) => {};
  const child = Object.assign(new EventEmitter(), {
    stdout: {}, stderr: new EventEmitter(), exitCode: null, signalCode: null,
    kill: vi.fn(),
    stdin: { write(line: string) {
      const req = JSON.parse(line);
      if (!req.id) return;
      const result = req.method === "thread/start" ? { thread: { id: "thread" } }
        : req.method === "thread/items/list" ? { data: [] } : {};
      queueMicrotask(() => receive(JSON.stringify({ id: req.id, result })));
    } },
  });
  const proc = { argv: ["node", "adapter", "config"], exitCode: 0, stdout: { write: (s: string) => events.push(JSON.parse(s)) } };
  await runInNewContext(`(async () => {${source}\n})()`, {
    process: proc, spawn: () => child,
    createInterface: () => ({ on(_name: string, cb: typeof receive) { receive = cb; } }),
    readFile: async (file: string) => file === "config" ? JSON.stringify({ promptFile: "prompt", approvalMode: mode }) : "task",
    unlink: async () => {}, setTimeout, clearTimeout, Date,
  });
  const notify = (method: string, params = {}) => receive(JSON.stringify({ method, params }));
  return { child, proc, events, notify };
}
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe("Codex activity deadline", () => {
  it.each(["item/started", "item/commandExecution/outputDelta", "item/reasoning/textDelta", "thread/compacted"])("continues beyond one hour with %s", async (method) => {
    const a = await adapter();
    for (let i = 0; i < 4; i++) { await vi.advanceTimersByTimeAsync(40 * 60_000); a.notify(method, { item: { id: String(i), type: "commandExecution" }, delta: "progress" }); }
    expect(a.child.kill).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    expect(a.events.at(-1)).toMatchObject({ type: "turn.failed", error: { code: "CLI_IDLE_TIMEOUT" } });
    expect(a.proc.exitCode).toBe(1);
    expect(a.child.kill).toHaveBeenCalledWith("SIGTERM");
    await vi.advanceTimersByTimeAsync(5_000);
    expect(a.child.kill).toHaveBeenCalledWith("SIGKILL");
  });
  it("does not extend the deadline for repeated diagnostics/status", async () => {
    const a = await adapter();
    for (let i = 0; i < 6; i++) { await vi.advanceTimersByTimeAsync(10 * 60_000); a.child.stderr.emit("data", "diagnostic"); a.notify("thread/status/changed"); }
    expect(a.proc.exitCode).toBe(1);
    expect(a.events.some(e => e.type === "turn.completed")).toBe(false);
  });
  it("settles a final answer once and clears the idle timer", async () => {
    const a = await adapter();
    a.notify("item/completed", { item: { type: "agentMessage", text: "Hecho", phase: "final_answer" } });
    a.notify("turn/completed", { turn: { id: "turn", status: "completed" } });
    a.child.emit("exit", 0);
    await vi.advanceTimersByTimeAsync(2 * 60 * 60_000);
    expect(a.proc.exitCode).toBe(0);
    expect(a.events.filter(e => e.type === "turn.completed")).toHaveLength(1);
    expect(a.events.some(e => e.type === "turn.failed")).toBe(false);
  });
  it("does not turn commentary into a plan approval", async () => {
    const a = await adapter("plan");
    a.notify("item/completed", { item: { type: "agentMessage", text: "Voy a revisar", phase: "commentary" } });
    a.notify("turn/completed", { turn: { status: "completed" } });
    expect(a.proc.exitCode).toBe(1);
    expect(a.events.some(e => JSON.stringify(e).includes("plan-approval"))).toBe(false);
  });
  it("preserves a complete plan as a pending approval", async () => {
    const a = await adapter("plan");
    a.notify("item/completed", { item: { type: "plan", text: "Plan completo para la tarea" } });
    a.notify("turn/completed", { turn: { status: "completed" } });
    expect(a.proc.exitCode).toBe(0);
    expect(a.events.some(e => JSON.stringify(e).includes("plan-approval"))).toBe(true);
  });
  it("reports a failed turn and unexpected process exit", async () => {
    const a = await adapter();
    a.notify("turn/failed", { turn: { error: { message: "provider failed" } } });
    expect(a.proc.exitCode).toBe(1);
    expect(a.events.at(-1)).toMatchObject({ type: "turn.failed" });
  });
});
