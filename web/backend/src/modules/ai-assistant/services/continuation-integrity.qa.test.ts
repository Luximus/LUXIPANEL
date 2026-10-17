// SPDX-License-Identifier: AGPL-3.0-only
// Independent integrated QA: a provider terminal is provisional until storage settles.
import { describe, expect, it, vi } from "vitest";
import type { Executor } from "../../../shared/executor/index.js";
import type { AgentEvent } from "./providers/provider.types.js";

vi.mock("../../../shared/worklog/worklog-recorder.service.js", () => ({ recordActivity: vi.fn() }));
vi.mock("../repositories/conversations.repository.js", () => ({
  conversationsRepository: { getMeta: vi.fn(async () => null) },
}));
import { agentRunRegistry } from "./agent-run-registry.js";

const executor = { target: { id: "qa-integrated-finalization" } } as Executor;
let counter = 0;
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
function closingRun(rejectSave = false) {
  const entered = deferred(), release = deferred();
  const mutation = vi.fn();
  const key = `qa-persistence-${++counter}`;
  const makeGen = async function* (): AsyncGenerator<AgentEvent> {
    mutation();
    yield { type: "tool_use", id: "write", name: "files.write", input: { path: "fixture.txt" } };
    yield { type: "tool_result", id: "write", success: true, output: "Fixture mutation confirmed" };
    yield { type: "text", phase: "final_answer", delta: "Resultado verificado" };
    yield { type: "done" };
  };
  const run = agentRunRegistry.start({ key, executor, makeGen,
    onComplete: async () => {
      entered.resolve();
      await release.promise;
      if (rejectSave) throw new Error("fixture storage refused");
    },
  });
  return { key, run, entered, release, makeGen, mutation };
}

describe("QA: reconnect and ownership during persistence", () => {
  it.each([false, true])("delivers the terminal to a reconnect during storage, rejected=%s", async rejectSave => {
    const fixture = closingRun(rejectSave);
    await fixture.entered.promise;
    const received: AgentEvent[] = [];
    const unsubscribe = agentRunRegistry.attach(fixture.key, 0, event => received.push(event), executor.target.id);
    try {
      expect(received.some(event => event.type === "done" || event.type === "error")).toBe(false);
      fixture.release.resolve();
      await fixture.run.completion;
      expect(received.at(-1)?.type).toBe(rejectSave ? "error" : "done");
      expect(received.filter(event => event.type === "done" || event.type === "error")).toHaveLength(1);
    } finally {
      fixture.release.resolve();
      await fixture.run.completion;
      unsubscribe?.();
    }
  });

  it("retains background ownership until storage and close have settled", async () => {
    const fixture = closingRun();
    await fixture.entered.promise;
    try {
      expect(agentRunRegistry.activeRuns()).toContainEqual(expect.objectContaining({ key: fixture.key, targetId: executor.target.id }));
      expect(agentRunRegistry.isActive(fixture.key, executor.target.id)).toBe(true);
    } finally {
      fixture.release.resolve();
      await fixture.run.completion;
    }
  });

  it("joins a duplicate start while saving instead of executing another mutation", async () => {
    const fixture = closingRun();
    await fixture.entered.promise;
    let next: ReturnType<typeof agentRunRegistry.start> | undefined;
    try {
      next = agentRunRegistry.start({ key: fixture.key, executor, makeGen: fixture.makeGen });
      fixture.release.resolve();
      await Promise.all([fixture.run.completion, next.completion]);
      expect(fixture.mutation).toHaveBeenCalledTimes(1);
      expect(next).toBe(fixture.run);
    } finally {
      fixture.release.resolve();
      await Promise.all([fixture.run.completion, next?.completion]);
    }
  });

  it("waits for an already-started save during graceful shutdown", async () => {
    const fixture = closingRun();
    await fixture.entered.promise;
    let shutdownSettled = false;
    const shutdown = agentRunRegistry.gracefulShutdown(100).then(result => { shutdownSettled = true; return result; });
    try {
      await new Promise<void>(resolve => setImmediate(resolve));
      expect(shutdownSettled).toBe(false);
    } finally {
      fixture.release.resolve();
      await Promise.all([fixture.run.completion, shutdown]);
    }
  });
});
