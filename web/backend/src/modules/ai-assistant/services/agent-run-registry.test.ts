// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect, vi } from "vitest";
import { agentRunRegistry } from "./agent-run-registry.js";
import { LOCAL_TARGET_ID, type Executor } from "../../../shared/executor/index.js";
import type { AgentEvent } from "./agent.service.js";

const executor = { target: { id: LOCAL_TARGET_ID } } as Executor;

/** Build an async generator that yields the given events with a tick between. */
async function* gen(events: AgentEvent[], delayMs = 0): AsyncGenerator<AgentEvent> {
  for (const ev of events) {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    yield ev;
  }
}

/** Wait until predicate is true (polling), or throw after `timeout`. */
async function waitFor(pred: () => boolean, timeout = 1000): Promise<void> {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > timeout) throw new Error("waitFor timed out");
    await new Promise((r) => setTimeout(r, 5));
  }
}

describe("agentRunRegistry", () => {
  it("persists exactly once with the accumulated text after the run finishes", async () => {
    const onComplete = vi.fn();
    const key = `conv-persist-${Math.random()}`;

    agentRunRegistry.start({
      key,
      executor,
      makeGen: () =>
        gen([
          { type: "text", delta: "Hola " },
          { type: "text", delta: "mundo" },
          { type: "done" },
        ]),
      onComplete,
    });

    await waitFor(() => onComplete.mock.calls.length > 0);
    expect(onComplete).toHaveBeenCalledTimes(1);
    // onComplete(assistantText, errored, ask?, translation?) — assert the first two.
    expect(onComplete.mock.calls[0]?.slice(0, 2)).toEqual(["Hola mundo", false]);
  });

  it("keeps running and still persists when no client is attached (disconnect)", async () => {
    const onComplete = vi.fn();
    const key = `conv-detached-${Math.random()}`;

    // Start the run but never attach an SSE consumer (simulates the WebView
    // socket dropping immediately on app-switch).
    agentRunRegistry.start({
      key,
      executor,
      makeGen: () => gen([{ type: "text", delta: "ok" }, { type: "done" }], 10),
      onComplete,
    });

    await waitFor(() => onComplete.mock.calls.length > 0);
    expect(onComplete.mock.calls[0]?.slice(0, 2)).toEqual(["ok", false]);
    expect(agentRunRegistry.isActive(key)).toBe(false);
  });

  it("replays buffered events to a late attacher and streams the rest live", async () => {
    const key = `conv-attach-${Math.random()}`;
    agentRunRegistry.start({
      key,
      executor,
      makeGen: () => gen([{ type: "text", delta: "a" }, { type: "text", delta: "b" }, { type: "done" }], 15),
    });

    // Attach after the first event has likely buffered.
    await waitFor(() => agentRunRegistry.has(key));
    const seen: AgentEvent[] = [];
    await new Promise<void>((resolve) => {
      const unsub = agentRunRegistry.attach(key, 0, (ev) => {
        seen.push(ev);
        if (ev.type === "done") {
          unsub?.();
          resolve();
        }
      });
    });

    const text = seen.filter((e) => e.type === "text").map((e) => (e as { delta: string }).delta).join("");
    expect(text).toBe("ab");
    expect(seen[seen.length - 1]?.type).toBe("done");
  });

  it("only replays events after fromSeq on resume", async () => {
    const key = `conv-resume-${Math.random()}`;
    agentRunRegistry.start({
      key,
      executor,
      makeGen: () => gen([{ type: "text", delta: "x" }, { type: "text", delta: "y" }, { type: "done" }]),
    });
    // Let it finish (events retained briefly for replay).
    await waitFor(() => !agentRunRegistry.isActive(key));

    const seen: AgentEvent[] = [];
    agentRunRegistry.attach(key, 1, (ev) => seen.push(ev)); // skip seq 0 ("x")
    expect(seen.some((e) => e.type === "text" && (e as { delta: string }).delta === "x")).toBe(false);
    expect(seen.some((e) => e.type === "text" && (e as { delta: string }).delta === "y")).toBe(true);
  });

  it("suppresses English deltas and emits one translated block when translate is set", async () => {
    const key = `conv-translate-${Math.random()}`;
    const onComplete = vi.fn();
    agentRunRegistry.start({
      key,
      executor,
      makeGen: () =>
        gen([
          { type: "text", delta: "Disk " },
          { type: "text", delta: "is full" },
          { type: "done" },
        ]),
      translate: {
        lang: "es",
        translateText: async (en) => `ES:${en}`,
      },
      onComplete,
    });

    const seen: AgentEvent[] = [];
    await new Promise<void>((resolve) => {
      const unsub = agentRunRegistry.attach(key, 0, (ev) => {
        seen.push(ev);
        if (ev.type === "done") {
          unsub?.();
          resolve();
        }
      });
    });

    // No raw English deltas leaked to the client.
    const texts = seen.filter((e) => e.type === "text").map((e) => (e as { delta: string }).delta);
    expect(texts).toEqual(["ES:Disk is full"]);
    // Status frames appeared (working + translating).
    expect(seen.some((e) => e.type === "status" && (e as { state: string }).state === "working")).toBe(true);
    expect(seen.some((e) => e.type === "status" && (e as { state: string }).state === "translating")).toBe(true);
    // onComplete carries English context + the translated display variant.
    await waitFor(() => onComplete.mock.calls.length > 0);
    const call = onComplete.mock.calls[0]!;
    expect(call[0]).toBe("Disk is full");
    expect(call[3]).toEqual({ text: "ES:Disk is full", lang: "es" });
  });

  it("CLI translate: keeps the live terminal and replaces the answer with a translated tool_result", async () => {
    const key = `conv-cli-translate-${Math.random()}`;
    const onComplete = vi.fn();
    agentRunRegistry.start({
      key,
      executor,
      makeGen: () =>
        gen([
          { type: "tool_use", id: "cli-1", name: "claude.cli", input: {} },
          { type: "text", delta: "\x1b[2m$ claude -p\x1b[0m\r\n" }, // synthetic header
          { type: "text", delta: "● working…\r\n" }, // live terminal activity
          { type: "tool_result", id: "cli-1", success: true, output: "Disk is full" }, // clean answer
          { type: "usage", model: "claude-cli", inputTokens: 1, outputTokens: 1, estimated: false },
          { type: "done" },
        ]),
      translate: {
        lang: "es",
        translateText: async (en) => `ES:${en}`,
      },
      onComplete,
    });

    const seen: AgentEvent[] = [];
    await new Promise<void>((resolve) => {
      const unsub = agentRunRegistry.attach(key, 0, (ev) => {
        seen.push(ev);
        if (ev.type === "done") {
          unsub?.();
          resolve();
        }
      });
    });

    // The live terminal deltas (English) are NOT suppressed — the user watches
    // the CLI work in real time.
    const texts = seen.filter((e) => e.type === "text").map((e) => (e as { delta: string }).delta);
    expect(texts).toContain("● working…\r\n");
    // The English clean answer was suppressed; the only answer-bearing
    // tool_result is the TRANSLATED one (replaces the bubble text).
    const results = seen.filter((e) => e.type === "tool_result") as Array<{ output: string }>;
    expect(results.map((r) => r.output)).toEqual(["ES:Disk is full"]);
    // A "translating" status frame appeared (no "working" — terminal is visible).
    expect(seen.some((e) => e.type === "status" && (e as { state: string }).state === "translating")).toBe(true);
    expect(seen.some((e) => e.type === "status" && (e as { state: string }).state === "working")).toBe(false);
    // onComplete carries the translated display variant.
    await waitFor(() => onComplete.mock.calls.length > 0);
    expect(onComplete.mock.calls[0]![3]).toEqual({ text: "ES:Disk is full", lang: "es" });
  });

  it("CLI without translation persists the clean tool_result instead of the terminal transcript", async () => {
    const key = `conv-cli-clean-${Math.random()}`;
    const onComplete = vi.fn();
    agentRunRegistry.start({
      key,
      executor,
      makeGen: () =>
        gen([
          { type: "tool_use", id: "cli-1", name: "codex.cli", input: {} },
          { type: "text", delta: "\x1b[2m$ codex exec\x1b[0m\r\n" },
          { type: "text", delta: "● Codex\r\n" },
          { type: "text", delta: "Investigating...\r\n" },
          { type: "tool_result", id: "cli-1", success: true, output: "Root cause found." },
          { type: "done" },
        ]),
      onComplete,
    });

    await waitFor(() => onComplete.mock.calls.length > 0);
    const call = onComplete.mock.calls[0]!;
    expect(call[0]).toBe("Root cause found.");
    expect(call[5]).toContain("$ codex exec");
    expect(call[5]).toContain("Investigating...");
  });

  it("gracefulShutdown flushes API runs (persist partial) and leaves CLI runs for descriptor recovery", async () => {
    const apiKey = `conv-gs-api-${Math.random()}`;
    const cliKey = `conv-gs-cli-${Math.random()}`;
    const apiComplete = vi.fn();
    const cliComplete = vi.fn();

    // API run: streams a partial answer then a long tail that never finishes
    // within the test (no `.cli` tool → treated as in-process API).
    agentRunRegistry.start({
      key: apiKey,
      executor,
      makeGen: async function* () {
        yield { type: "text", delta: "partial answer" } as AgentEvent;
        for (let i = 0; i < 100; i++) {
          await new Promise((r) => setTimeout(r, 20));
          yield { type: "text", delta: "." } as AgentEvent;
        }
        yield { type: "done" } as AgentEvent;
      },
      onComplete: apiComplete,
    });

    // CLI run: emits a `.cli` tool_use (→ run.cli=true) then a long tail.
    agentRunRegistry.start({
      key: cliKey,
      executor,
      makeGen: async function* () {
        yield { type: "tool_use", id: "j1", name: "claude.cli", input: {} } as AgentEvent;
        for (let i = 0; i < 100; i++) {
          await new Promise((r) => setTimeout(r, 20));
          yield { type: "text", delta: "x" } as AgentEvent;
        }
        yield { type: "done" } as AgentEvent;
      },
      onComplete: cliComplete,
    });

    await waitFor(() => agentRunRegistry.isActive(apiKey) && agentRunRegistry.isActive(cliKey));
    // Ensure the CLI run's `.cli` tool_use was processed (run.cli=true).
    await waitFor(() => agentRunRegistry.activeRuns().some((r) => r.key === cliKey && r.cli));

    const res = await agentRunRegistry.gracefulShutdown(1000);
    expect(res.flushed).toBe(1); // only the API run was aborted+flushed
    expect(res.cliDetached).toBe(1); // the CLI run was left alone

    // API run settled with its partial answer persisted; no longer active.
    await waitFor(() => apiComplete.mock.calls.length > 0);
    expect(agentRunRegistry.isActive(apiKey)).toBe(false);
    expect(String(apiComplete.mock.calls[0]?.[0])).toContain("partial answer");

    // CLI run was NOT aborted by shutdown → still active, onComplete not called
    // (its nohup keeps running on the target; recovery re-attaches later).
    expect(cliComplete).not.toHaveBeenCalled();
    expect(agentRunRegistry.isActive(cliKey)).toBe(true);

    // Cleanup so the lingering CLI run doesn't leak into other tests.
    agentRunRegistry.stop(cliKey);
    await waitFor(() => !agentRunRegistry.isActive(cliKey));
  });

  it("stop() aborts an in-flight run", async () => {
    const key = `conv-stop-${Math.random()}`;
    let sawAbort = false;
    agentRunRegistry.start({
      key,
      executor,
      // A long stream that checks nothing — the registry breaks the loop when
      // its AbortController fires.
      makeGen: async function* () {
        for (let i = 0; i < 100; i++) {
          await new Promise((r) => setTimeout(r, 20));
          yield { type: "text", delta: String(i) } as AgentEvent;
        }
        yield { type: "done" } as AgentEvent;
      },
      onComplete: () => {
        sawAbort = true;
      },
    });

    await waitFor(() => agentRunRegistry.isActive(key));
    expect(agentRunRegistry.stop(key)).toBe(true);
    await waitFor(() => sawAbort);
    expect(agentRunRegistry.isActive(key)).toBe(false);
  });

  // runContext powers the MCP cross-channel fallback (mcp.controller): a token
  // whose bridge session died MID-RUN re-resolves to the run's own pinned
  // executor — but only while the run is live, and only with its owner.
  describe("runContext()", () => {
    it("exposes the pinned executor + owner while ACTIVE, null once finished", async () => {
      const key = `conv-runctx-${Math.random()}`;
      const pinned = { marker: "pinned", target: { id: LOCAL_TARGET_ID } } as unknown as Executor;
      agentRunRegistry.start({
        key,
        executor: pinned,
        user: { userId: 7, username: "u", displayName: "U", role: "admin", modules: [], kind: "admin" } as unknown as import("../../../shared/types/index.js").SessionUser,
        makeGen: () => gen([{ type: "text", delta: "x" }, { type: "done" }], 25),
      });

      await waitFor(() => agentRunRegistry.isActive(key));
      const ctx = agentRunRegistry.runContext(key);
      expect(ctx?.executor).toBe(pinned);
      expect(ctx?.ownerUserId).toBe(7);

      // Finished (but still retained for replay) → the fallback must be gone.
      await waitFor(() => !agentRunRegistry.isActive(key));
      expect(agentRunRegistry.has(key)).toBe(true);
      expect(agentRunRegistry.runContext(key)).toBeNull();
    });

    it("excluye los runs de WORKER del cap por usuario (activeCountForUser)", async () => {
      const user = { userId: 42, username: "u", displayName: "U", role: "admin", modules: [], kind: "admin" } as unknown as import("../../../shared/types/index.js").SessionUser;
      const userKey = `conv-cap-user-${Math.random()}`;
      const workerKey = `conv-cap-worker-${Math.random()}`;
      agentRunRegistry.start({
        key: userKey,
        executor,
        user,
        makeGen: () => gen([{ type: "text", delta: "x" }, { type: "done" }], 50),
      });
      agentRunRegistry.start({
        key: workerKey,
        executor,
        user,
        isWorker: true,
        makeGen: () => gen([{ type: "text", delta: "x" }, { type: "done" }], 50),
      });
      await waitFor(() => agentRunRegistry.isActive(userKey) && agentRunRegistry.isActive(workerKey));
      // Solo el run de usuario cuenta; el worker tiene su propio cupo.
      expect(agentRunRegistry.activeCountForUser(42)).toBe(1);
      // El worker sigue exponiendo su owner para el canal MCP (runContext).
      expect(agentRunRegistry.runContext(workerKey)?.ownerUserId).toBe(42);
      agentRunRegistry.stop(userKey);
      agentRunRegistry.stop(workerKey);
      await waitFor(() => !agentRunRegistry.isActive(userKey) && !agentRunRegistry.isActive(workerKey));
    });

    it("returns null for unknown keys and omits ownerUserId for ownerless runs", async () => {
      expect(agentRunRegistry.runContext(`nope-${Math.random()}`)).toBeNull();

      const key = `conv-runctx-noowner-${Math.random()}`;
      agentRunRegistry.start({
        key,
        executor,
        makeGen: () => gen([{ type: "text", delta: "x" }, { type: "done" }], 25),
      });
      await waitFor(() => agentRunRegistry.isActive(key));
      const ctx = agentRunRegistry.runContext(key);
      expect(ctx).not.toBeNull();
      expect(ctx?.ownerUserId).toBeUndefined();
      agentRunRegistry.stop(key);
      await waitFor(() => !agentRunRegistry.isActive(key));
    });
  });
});

describe("CLI terminal outcomes", () => {
  it.each([false, true])("persists CLI failure with translation=%s", async (translate) => {
    const onComplete = vi.fn();
    const run = agentRunRegistry.start({ key: `failed-${Math.random()}`, executor, onComplete,
      ...(translate ? { translate: { lang: "es", translateText: async () => "WRONG_SUCCESS" } } : {}),
      makeGen: () => gen([
        { type: "tool_use", id: "cli", name: "codex.cli", input: {} },
        { type: "text", delta: "Estoy revisando" },
        { type: "tool_result", id: "cli", success: false, output: "Inactividad" },
        { type: "done" },
      ]),
    });
    await run.completion;
    expect(run.events.at(-1)).toEqual({ type: "error", message: "Inactividad" });
    expect(onComplete.mock.calls[0][1]).toBe(true);
    expect(onComplete.mock.calls[0][7]).toEqual({ error: "Inactividad" });
    expect(run.events.some(e => e.type === "tool_result" && e.success)).toBe(false);
  });
  it("does not treat an auxiliary failure as the main CLI outcome", async () => {
    const onComplete = vi.fn();
    const run = agentRunRegistry.start({ key: `aux-${Math.random()}`, executor, onComplete,
      makeGen: () => gen([
        { type: "tool_use", id: "cli", name: "codex.cli", input: {} },
        { type: "tool_result", id: "aux", success: false, output: "Auxiliary failed" },
        { type: "tool_result", id: "cli", success: true, output: "Hecho" },
        { type: "done" },
      ]),
    });
    await run.completion;
    expect(onComplete.mock.calls[0].slice(0, 2)).toEqual(["Hecho", false]);
    expect(run.events.at(-1)).toEqual({ type: "done" });
  });
  it("persists errors with no final text and keeps manual stop distinct", async () => {
    const onComplete = vi.fn();
    const run = agentRunRegistry.start({ key: `empty-error-${Math.random()}`, executor, onComplete,
      makeGen: () => gen([{ type: "tool_use", id: "cli", name: "codex.cli", input: {} }, { type: "text", delta: "progress" }, { type: "error", message: "failed" }]),
    });
    await run.completion;
    expect(onComplete.mock.calls[0][0]).toBe("");
    expect(onComplete.mock.calls[0][7]).toEqual({ error: "failed" });
    const stopped = vi.fn();
    const key = `stop-${Math.random()}`;
    const r = agentRunRegistry.start({ key, executor, onComplete: stopped, makeGen: () => gen([{ type: "text", delta: "partial" }, { type: "done" }], 10) });
    agentRunRegistry.stop(key);
    await r.completion;
    expect(stopped.mock.calls[0][7]).toEqual({ interrupted: true });
  });
});
