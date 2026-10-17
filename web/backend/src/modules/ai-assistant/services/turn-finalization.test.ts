// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it, vi } from "vitest";
import { guardTurnFinalization, hasUncollectedTeamTasks } from "./turn-finalization.js";
import { agentRunRegistry } from "./agent-run-registry.js";
import type { AgentEvent } from "./providers/provider.types.js";
import type { Executor } from "../../../shared/executor/index.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import { persistAssistantMessage } from "./assistant-message-persistence.js";
import { normalizeConversationMessage } from "./conversation-message-normalizer.js";
import { createApiActivity } from "./api-activity.js";

const board = vi.hoisted(() => ({ list: vi.fn(async () => [] as unknown[]), append: vi.fn(async (..._args: unknown[]) => undefined) }));
vi.mock("../repositories/team-tasks.repository.js", () => ({ teamTasksRepository: { listForLeaderConversation: board.list } }));
vi.mock("../../../shared/worklog/worklog-recorder.service.js", () => ({ recordActivity: vi.fn() }));
vi.mock("../repositories/conversations.repository.js", () => ({ conversationsRepository: { getMeta: async () => null, appendMessages: board.append } }));

const executor = { target: { id: "completion-test" } } as Executor;
async function* events(items: AgentEvent[]) { yield* items; }
const tool: AgentEvent = { type: "tool_use", id: "tool", name: "files.read", input: {} };
const result: AgentEvent = { type: "tool_result", id: "tool", success: true, output: "evidencia" };
async function run(items: AgentEvent[], pending = false, translated = false) {
  const onComplete = vi.fn();
  const translateText = vi.fn(async (text: string) => `ES:${text}`);
  const state = agentRunRegistry.start({
    key: `final-${Math.random()}`, executor, onComplete,
    ...(translated ? { translate: { lang: "es", translateText } } : {}),
    makeGen: () => guardTurnFinalization(events(items), async () => pending),
  });
  await state.completion;
  return { state, onComplete, translateText };
}

describe("turn finalization", () => {
  it.each([false, true])("persists only the final API text, translation=%s", async translated => {
    const { state, onComplete, translateText } = await run([
      { type: "text", delta: "Voy a cambiar la lista. " }, tool, result,
      { type: "text", delta: "Ya localicé ambos formatos. " }, { ...tool, id: "second" },
      { ...result, id: "second" }, { type: "text", delta: "Ajuste verificado." }, { type: "done" },
    ], false, translated);
    expect(onComplete.mock.calls[0][0]).toBe("Ajuste verificado.");
    if (translated) expect(translateText).toHaveBeenCalledWith("Ajuste verificado.");
    else expect(state.events).toContainEqual({ type: "text", delta: "Voy a cambiar la lista. ", phase: "commentary" });
    expect(onComplete.mock.calls[0][8]).toMatchObject({ events: [
      { type: "text", phase: "commentary", delta: "Voy a cambiar la lista. " }, tool, result,
      { type: "text", phase: "commentary", delta: "Ya localicé ambos formatos. " },
      { ...tool, id: "second" }, { ...result, id: "second" },
    ] });
    expect(state.events.at(-1)).toEqual({ type: "done" });
  });

  it.each([false, true])("does not publish a final while delegated tasks need collection, cli=%s", async cli => {
    const items: AgentEvent[] = cli ? [
      { type: "tool_use", id: "cli", name: "codex.cli", input: {} },
      { type: "text", delta: "Trabajando en el equipo" },
      { type: "tool_result", id: "cli", success: true, output: "Todo terminado" },
    ] : [tool, result, { type: "text", delta: "Todo terminado" }];
    const { state, onComplete, translateText } = await run([...items, { type: "done" }], true, true);
    expect(onComplete.mock.calls[0][0]).toBe("");
    expect(onComplete.mock.calls[0][7]).toEqual({ pending: true });
    expect(state.events.at(-1)).toEqual({ type: "done", pending: true });
    expect(JSON.stringify(state.events)).not.toContain("Todo terminado");
    expect(translateText).not.toHaveBeenCalled();
    if (cli) expect(onComplete.mock.calls[0][5]).toContain("Trabajando");
  });

  it("respects a human question instead of scheduling a final", async () => {
    const ask: AgentEvent = { type: "ask", id: "q", questions: [{ id: "q1", type: "text", text: "Destino" }] };
    const { state, onComplete } = await run([{ type: "text", delta: "Necesito el destino." }, ask, { type: "done" }], true);
    expect(state.events).toContainEqual(ask);
    expect(onComplete.mock.calls[0][2]).toEqual(ask.questions);
    expect(onComplete.mock.calls[0][7]).toBeUndefined();
  });

  it("preserves a detached background run as pending even without delegated tasks", async () => {
    const { state, onComplete } = await run([
      { type: "tool_use", id: "cli", name: "claude.cli", input: {} },
      { type: "text", delta: "Trabajo en curso" },
      { type: "tool_result", id: "cli", success: true, output: "[corriendo en background]" },
      { type: "done", pending: true },
    ]);
    expect(onComplete.mock.calls[0][0]).toBe("");
    expect(onComplete.mock.calls[0][1]).toBe(false);
    expect(onComplete.mock.calls[0][7]).toEqual({ pending: true });
    expect(state.events.at(-1)).toEqual({ type: "done", pending: true });
  });

  it("fails an EOF without claiming that changes failed or retrying them", async () => {
    const { state, onComplete } = await run([tool, { ...result, success: false, output: '{"operationStatus":"unconfirmed"}' }]);
    expect(state.events.at(-1)?.type).toBe("error");
    expect(onComplete.mock.calls[0][1]).toBe(true);
    expect(state.events.filter(e => e.type === "tool_use")).toHaveLength(1);
  });

  it("does not promote a CLI log when its final answer is empty", async () => {
    const { onComplete } = await run([
      { type: "tool_use", id: "cli", name: "claude.cli", input: {} },
      { type: "text", delta: "Voy a cambiarlo. Falta verificarlo." },
      { type: "tool_result", id: "cli", success: true, output: "" }, { type: "done" },
    ]);
    expect(onComplete.mock.calls[0][0]).toBe("");
    expect(onComplete.mock.calls[0][5]).toContain("Falta verificarlo");
    expect(onComplete.mock.calls[0][1]).toBe(true);
  });

  it("keeps explicit commentary after the last tool out of the final answer", async () => {
    const { onComplete } = await run([tool, result,
      { type: "text", phase: "commentary", delta: "Estoy terminando" },
      { type: "text", phase: "final_answer", delta: "Verificado" }, { type: "done" },
    ]);
    expect(onComplete.mock.calls[0][0]).toBe("Verificado");
    expect(onComplete.mock.calls[0][8].events.at(-1)).toEqual({ type: "text", phase: "commentary", delta: "Estoy terminando" });
  });

  it("emits a settled turn, without a finished notification, while the team is pending", async () => {
    const finished = vi.fn();
    const settled = vi.fn();
    eventBus.on(Events.AI_CHAT_FINISHED, finished);
    eventBus.on(Events.AI_TURN_SETTLED, settled);
    try {
      await run([tool, result, { type: "text", delta: "Terminado" }, { type: "done" }], true);
      expect(finished).not.toHaveBeenCalled();
      expect(settled).toHaveBeenCalledWith(expect.objectContaining({ pending: true }));
    } finally {
      eventBus.off(Events.AI_CHAT_FINISHED, finished);
      eventBus.off(Events.AI_TURN_SETTLED, settled);
    }
  });

  it("uses the exact target board and fails closed on missing context", async () => {
    board.list.mockResolvedValueOnce([{ status: "running", collected: true }]);
    expect(await hasUncollectedTeamTasks(executor, "leader")).toBe(true);
    expect(board.list).toHaveBeenLastCalledWith(executor, "leader");
    board.list.mockResolvedValueOnce([{ status: "done", collected: false }]);
    expect(await hasUncollectedTeamTasks(executor, "leader")).toBe(true);
    board.list.mockResolvedValueOnce([{ status: "failed", collected: true }]);
    expect(await hasUncollectedTeamTasks(executor, "leader")).toBe(false);
    await expect(hasUncollectedTeamTasks(null, "leader")).rejects.toThrow("contexto");
  });

  it.each([false, true])("round-trips API progress and results separately from the final, pending=%s", async pending => {
    const { onComplete } = await run([
      { type: "text", delta: "Voy a comprobar" },
      { ...tool, input: { path: "example.txt", password: "private-test-value" } },
      { ...result, output: '{"private_key":"private-test-value","ok":true}' },
      { type: "text", delta: "Verificado" }, { type: "done" },
    ], pending);
    const [answer, , ask, translation, duration, cliLog, askKind, outcome, activity] = onComplete.mock.calls[0];
    await persistAssistantMessage(executor, "history", answer, "codex", false, ask, translation, undefined, duration, cliLog, askKind, outcome, activity);
    const call = board.append.mock.calls.at(-1)!;
    expect(call[0]).toBe(executor);
    expect(call[1]).toBe("history");
    const [saved] = JSON.parse(JSON.stringify(call[2]));
    const reloaded = normalizeConversationMessage(saved);
    expect(reloaded.content).toBe(pending ? "" : "Verificado");
    expect(reloaded.pending).toBe(pending ? true : undefined);
    expect(reloaded.apiActivity?.events).toEqual([
      { type: "text", phase: "commentary", delta: "Voy a comprobar" },
      { ...tool, input: { path: "example.txt", password: "[redacted]" } },
      { ...result, output: '{"private_key":"[redacted]","ok":true}' },
      ...(pending ? [{ type: "text", phase: "commentary", delta: "Verificado" }] : []),
    ]);
    expect(JSON.stringify(reloaded)).not.toContain("private-test-value");
    expect(reloaded.ts).toBe(saved.ts);
  });

  it("retains provisional text as activity when the team is still pending", async () => {
    const { state, onComplete } = await run([
      tool, result, { type: "text", delta: "Falta verificar el despliegue." }, { type: "done" },
    ], true);
    expect(state.events).toContainEqual({ type: "text", phase: "commentary", delta: "Falta verificar el despliegue." });
    expect(onComplete.mock.calls[0][0]).toBe("");
    expect(onComplete.mock.calls[0][8].events.at(-1)).toMatchObject({ phase: "commentary", delta: "Falta verificar el despliegue." });
  });

  it("retains buffered evidence when the provider throws before closing", async () => {
    const onComplete = vi.fn();
    const state = agentRunRegistry.start({
      key: "throw-before-close", executor, onComplete,
      makeGen: () => guardTurnFinalization((async function* () {
        yield { type: "text", delta: "La verificación sigue pendiente." } as AgentEvent;
        throw new Error("El proveedor no respondió a tiempo.");
      })(), async () => false),
    });
    await state.completion;
    expect(onComplete.mock.calls[0][8]?.events).toContainEqual({
      type: "text", phase: "commentary", delta: "La verificación sigue pendiente.",
    });
    expect(onComplete.mock.calls[0][1]).toBe(true);
    expect(state.events.at(-1)?.type).toBe("error");
  });

  it("waits for persistence before emitting the terminal frame", async () => {
    let saved!: () => void;
    const saving = new Promise<void>(resolve => { saved = resolve; });
    const onComplete = vi.fn(() => saving);
    const state = agentRunRegistry.start({
      key: "await-history", executor, onComplete,
      makeGen: () => events([{ type: "text", delta: "Resultado verificado." }, { type: "done" }]),
    });
    try {
      await vi.waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
      expect(state.events.some(event => event.type === "done")).toBe(false);
    } finally { saved(); await state.completion; }
    expect(state.events.at(-1)).toEqual({ type: "done" });
  });

  it("surfaces a history failure without publishing a successful terminal frame", async () => {
    board.append.mockRejectedValueOnce(new Error("history unavailable"));
    const finished = vi.fn();
    eventBus.on(Events.AI_CHAT_FINISHED, finished);
    try {
      const state = agentRunRegistry.start({
        key: "history-failure", executor,
        makeGen: () => events([{ type: "text", delta: "Resultado verificado." }, { type: "done" }]),
        onComplete: text => persistAssistantMessage(executor, "history-failure", text, "codex", false),
      });
      await state.completion;
      expect(state.events.some(event => event.type === "done")).toBe(false);
      expect(state.events.at(-1)).toMatchObject({ type: "error", message: expect.stringContaining("confirmar") });
      expect(finished).toHaveBeenCalledWith(expect.objectContaining({ errored: true }));
    } finally { eventBus.off(Events.AI_CHAT_FINISHED, finished); }
  });

  it("bounds retained detail while preserving call identities and the error outcome", () => {
    const activity = createApiActivity();
    activity.record(tool);
    activity.record({ ...result, output: "a".repeat(100_000) });
    activity.record({ ...tool, id: "second" });
    activity.record({ ...result, id: "second", success: false, output: "Resultado sin confirmar" });
    const saved = activity.snapshot()!;
    expect(saved.truncated).toBe(true);
    expect(saved.events.map(event => "id" in event ? event.id : "text")).toEqual(["tool", "tool", "second", "second"]);
    expect(saved.events.at(-1)).toEqual({ ...result, id: "second", success: false, output: "Resultado sin confirmar" });
    expect(JSON.stringify(saved).length).toBeLessThan(32_000);
  });

  it("redacts a credential split across progress deltas", () => {
    const activity = createApiActivity();
    activity.record({ type: "text", phase: "commentary", delta: "token=" });
    activity.record({ type: "text", phase: "commentary", delta: "private-test-value" });
    expect(activity.snapshot()?.events).toEqual([{ type: "text", phase: "commentary", delta: "token=[redacted]" }]);
  });
});

it.each([false, true])("rejects a successful API close without final-answer evidence, commentary=%s", async commentary => {
  const { state, onComplete } = await run([
    ...(commentary ? [{ type: "text" as const, phase: "commentary" as const, delta: "Verificación pendiente" }] : []),
    { type: "done" },
  ]);
  expect(state.events.at(-1)?.type).toBe("error");
  expect(onComplete.mock.calls[0][0]).toBe("");
  expect(onComplete.mock.calls[0][1]).toBe(true);
});
