import { describe, it, expect, vi } from "vitest";
const tracker = vi.hoisted(() => ({ done: null as any, output: null as any, job: { accumulated: "" } }));
vi.mock("../../cli-job-tracker.service.js", () => ({ cliJobTracker: {
  start: () => tracker.job, setActiveStream: vi.fn(),
  subscribeOutput: (_id: string, cb: any) => { tracker.output = cb; return () => {}; },
  subscribeDone: (_id: string, cb: any) => { tracker.done = cb; return () => {}; },
} }));
import { makeRecoveredCliGen } from "./recovered-run.js";

describe("recovered CLI outcome", () => {
  it.each([1, 0])("does not recover commentary as success with exit %s", async (exitCode) => {
    tracker.job.accumulated = JSON.stringify({ type: "item.completed", item: { type: "agent_message", phase: "commentary", text: "Estoy revisando" } });
    const g = makeRecoveredCliGen({} as any, "conv", { provider: "codex", jobId: "job", logFile: "log", exitFile: "exit", serverName: "target", startedAt: 0 });
    await g.next(); await g.next();
    const pending = g.next();
    tracker.done(tracker.job.accumulated, exitCode);
    const terminal = [await pending];
    for await (const event of g) terminal.push({ value: event, done: false });
    expect(terminal[0].value).toMatchObject({ type: "tool_result", success: false });
    expect(terminal.at(-1)?.value).toMatchObject({ type: "error" });
    expect(JSON.stringify(terminal)).not.toContain("Estoy revisando");
  });
});
