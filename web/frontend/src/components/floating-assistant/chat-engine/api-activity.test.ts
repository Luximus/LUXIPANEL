import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentEvent, ConversationMessage } from "../assistant-api";
import { assistantConversationsApi } from "../assistant-api";
import { apiExecutionStatus, apiToolStatus } from "../chat-pane/api-activity";
import { apiActivityTools } from "./api-activity";
import { historyTurn } from "./history";
import { applyEvent, reloadHistory } from "./stream-apply";
import { chats } from "./state";

const scope = vi.hoisted(() => ({ value: "target-a" }));
vi.mock("@/lib/api-client", () => ({ resolveTargetScope: () => scope.value }));
vi.mock("@/lib/assistant-ws", () => ({ markAssistantTeamTaskSeen: vi.fn() }));
vi.mock("../assistant-api", () => ({
  assistantConversationsApi: { messages: vi.fn(), markReviewed: vi.fn() },
  attachmentUrl: (id: string) => id,
  displayText: (m: ConversationMessage) => m.textTranslated ?? m.content,
}));
const key = "activity-contract";
beforeEach(() => {
  scope.value = "target-a";
  chats.set(key, { provider: "openai", conversationId: key, streaming: false,
    turns: [{ role: "assistant", text: "", pending: true, tools: [] }] });
});
afterEach(() => { chats.clear(); vi.clearAllMocks(); });
function apply(event: AgentEvent, seq?: number, isCli = false) {
  applyEvent(key, event, { isCli, seq, startedAt: 0 });
}
const turn = () => chats.get(key)!.turns.at(-1)!;

describe("API process contract", () => {
  it("retains commentary after the last call, distinct call ids and the final answer on reload", () => {
    const events: AgentEvent[] = [
      { type: "text", delta: "Primera comprobación", phase: "commentary" },
      { type: "tool_use", id: "one", name: "files.read", input: { path: "one.txt" } },
      { type: "tool_result", id: "one", success: true, output: "Primera salida" },
      { type: "text", delta: "Segunda comprobación", phase: "commentary" },
      { type: "tool_use", id: "two", name: "files.read", input: { path: "two.txt" } },
      { type: "tool_result", id: "two", success: false, output: "Fallo conservado" },
      { type: "text", delta: "Avance posterior a las herramientas", phase: "commentary" },
      { type: "text", delta: "Respuesta final", phase: "final_answer" },
      { type: "done" },
    ];
    events.forEach((event, seq) => apply(event, seq));
    expect(turn().text).toBe("Respuesta final");
    expect(turn().apiTextOffset).toBeUndefined();
    const persisted: ConversationMessage = JSON.parse(JSON.stringify({
      role: "assistant", content: turn().text, ts: "2026-10-17T00:00:00Z",
      apiActivity: turn().apiActivity, textTranslated: "Respuesta traducida",
    }));
    const restored = historyTurn(persisted);
    expect(restored.text).toBe("Respuesta traducida");
    expect(restored.apiActivity).toEqual({ events: events.slice(0, 7) });
    expect(restored.tools).toEqual(turn().tools);
    expect(restored.tools.map(tool => tool.id)).toEqual(["one", "two"]);
    expect(apiExecutionStatus(turn())).toBe("done");
    expect(apiExecutionStatus(restored)).toBe("done");
    expect(apiToolStatus(restored.tools[1]!, restored)).toBe("failed");
    expect(restored.apiTextOffset).toBeUndefined();
  });

  it("ignores replayed SSE sequence numbers without losing identical new deltas", () => {
    const event: AgentEvent = { type: "text", delta: "Avance.", phase: "commentary" };
    apply(event, 0); apply(event, 0); apply(event, 1);
    apply({ type: "text", delta: "Final.", phase: "final_answer" }, 2);
    apply({ type: "text", delta: "Final.", phase: "final_answer" }, 2);
    expect(turn().apiActivity?.events).toEqual([{ ...event, delta: "Avance.Avance." }]);
    expect(turn().text).toBe("Final.");
    expect(chats.get(key)?.lastSeq).toBe(2);
  });

  it("retains result-before-call, unknown results and history truncation without inventing calls", () => {
    const apiActivity = { truncated: true as const, events: [
      { type: "tool_result" as const, id: "one", success: true, output: "Resultado conservado" },
      { type: "tool_result" as const, id: "unknown", success: false, output: "Detalle sin llamada" },
      { type: "tool_use" as const, id: "one", name: "files.read", input: { path: "one.txt" } },
      { type: "tool_use" as const, id: "one", name: "files.read", input: { path: "one.txt" } },
    ] };
    const before = JSON.stringify(apiActivity);
    const restored = historyTurn({ role: "assistant", content: "", ts: "", apiActivity, error: "Fallo conservado" });
    expect(apiActivityTools(apiActivity)).toEqual([{ id: "one", name: "files.read", input: { path: "one.txt" },
      result: { success: true, output: "Resultado conservado" } }]);
    expect(JSON.stringify(restored.apiActivity)).toBe(before);
    expect(restored.text).toBe("");
    expect(apiExecutionStatus(restored)).toBe("failed");
  });

  it.each([false, true])("keeps done.pending separate from a running local stream: cli=%s", isCli => {
    apply({ type: "tool_use", id: "call", name: isCli ? "codex.cli" : "team.assign", input: {} }, 0, isCli);
    apply({ type: "text", delta: "Trabajo todavía pendiente" }, 1, isCli);
    apply({ type: "tool_result", id: "call", success: true, output: "[La ejecución sigue pendiente.]" }, 2, isCli);
    apply({ type: "done", pending: true }, 3, isCli);
    expect(turn()).toMatchObject({ pending: false, completionPending: true, text: "" });
    expect(apiExecutionStatus(turn())).toBe("waiting");
    expect(apiToolStatus(turn().tools[0]!, turn())).toBe(isCli ? "waiting" : "done");
    expect(turn().tools[0]?.lanes?.main?.status).not.toBe("done");
    const restored = historyTurn({ role: "assistant", content: "", ts: "", pending: true,
      ...(isCli ? { cli: true, cliLog: "$ codex\nTrabajo todavía pendiente" } : { apiActivity: turn().apiActivity }) });
    expect(restored.text).toBe("");
    expect(restored.pending).toBeUndefined();
    expect(restored.completionPending).toBe(true);
    expect(apiExecutionStatus(restored)).toBe("waiting");
  });

  it("does not promote unconfirmed CLI terminal prose on done or after a failed result", () => {
    apply({ type: "tool_use", id: "cli", name: "codex.cli", input: {} }, 0, true);
    apply({ type: "text", delta: "$ codex\nEstoy verificando" }, 1, true);
    apply({ type: "done" }, 2, true);
    expect(turn().text).toBe("");
    expect(apiExecutionStatus(turn())).toBe("unconfirmed");
    apply({ type: "tool_result", id: "cli", success: false, output: "Error, trabajo sin terminar" }, 3, true);
    expect(turn().text).toBe("");
    expect(apiExecutionStatus(turn())).toBe("failed");
  });

  it("settles CLI lanes only after a confirmed final result and terminal frame", () => {
    apply({ type: "tool_use", id: "cli", name: "codex.cli", input: {} }, 0, true);
    apply({ type: "tool_result", id: "cli", success: true, output: "Respuesta final" }, 1, true);
    expect(turn().tools[0]?.lanes?.main?.status).toBe("running");
    expect(apiToolStatus(turn().tools[0]!, turn())).toBe("running");
    apply({ type: "done" }, 2, true);
    expect(turn().tools[0]?.lanes?.main?.status).toBe("done");
    expect(apiExecutionStatus(turn())).toBe("done");
  });

  it.each([false, true])("tracks recovery after a failed nested call without erasing it: cli=%s", isCli => {
    let seq = 0;
    const emit = (event: AgentEvent) => apply(event, seq++, isCli);
    if (isCli) emit({ type: "tool_use", id: "cli", name: "codex.cli", input: {} });
    emit({ type: "tool_use", id: "failed-read", name: "files.read", input: {} });
    emit({ type: "tool_result", id: "failed-read", success: false, output: "Lectura fallida" });
    expect(apiExecutionStatus(turn())).toBe("running");
    const failed = turn().tools.find(tool => tool.id === "failed-read")!;
    expect(apiToolStatus(failed, turn())).toBe("failed");
    expect(apiExecutionStatus({ ...turn(), permission: { id: "approval", tool: "files.read", title: "Permiso" } })).toBe("waiting");
    expect(apiExecutionStatus({ ...turn(), pending: false, stopped: true })).toBe("stopped");
    expect(apiExecutionStatus({ ...turn(), pending: false, interrupted: true })).toBe("unconfirmed");
    emit({ type: "tool_use", id: "retry", name: "files.read", input: {} });
    emit({ type: "tool_result", id: "retry", success: true, output: "Lectura recuperada" });
    expect(apiExecutionStatus(turn())).toBe("running");
    if (isCli) emit({ type: "tool_result", id: "cli", success: true, output: "Archivo revisado" });
    else emit({ type: "text", phase: "final_answer", delta: "Archivo revisado" });
    expect(apiExecutionStatus(turn())).toBe("running");
    emit({ type: "done" });
    expect(apiExecutionStatus(turn())).toBe("done");
    expect(turn().tools.find(tool => tool.id === "failed-read")?.result).toEqual(failed.result);
    const restored = historyTurn({ role: "assistant", content: turn().text, ts: "",
      ...(isCli ? { cli: true, cliLog: "Lectura fallida\nLectura recuperada" } : { apiActivity: turn().apiActivity }) });
    expect(apiExecutionStatus(restored)).toBe("done");
  });

  it("keeps genuine terminal failures after successful calls", () => {
    apply({ type: "tool_use", id: "cli", name: "codex.cli", input: {} }, 0, true);
    apply({ type: "tool_use", id: "read", name: "files.read", input: {} }, 1, true);
    apply({ type: "tool_result", id: "read", success: true, output: "Leído" }, 2, true);
    apply({ type: "tool_result", id: "cli", success: false, output: "Ejecución fallida" }, 3, true);
    apply({ type: "done" }, 4, true);
    expect(apiExecutionStatus(turn())).toBe("failed");
    expect(apiExecutionStatus({ ...turn(), tools: [], error: "Fallo terminal" })).toBe("failed");
  });

  it("does not complete a failed call without a final answer or an unresolved call with one", () => {
    apply({ type: "tool_use", id: "read", name: "files.read", input: {} });
    apply({ type: "tool_result", id: "read", success: false, output: "Error" });
    apply({ type: "done" });
    expect(apiExecutionStatus(turn())).toBe("failed");
    expect(apiExecutionStatus({ ...turn(), text: "Respuesta", tools: [{ id: "unknown", name: "files.read", input: {} }] })).toBe("unconfirmed");
  });

  it("routes an explicitly translated CLI answer outside the terminal", () => {
    apply({ type: "tool_use", id: "cli", name: "codex.cli", input: {} }, 0, true);
    apply({ type: "text", delta: "Progreso CLI" }, 1, true);
    apply({ type: "text", delta: "Respuesta traducida", phase: "final_answer" }, 2, true);
    expect(turn().text).toBe("Respuesta traducida");
    expect(turn().tools[0]?.terminal).toBe("Progreso CLI");
  });

  it("keeps old histories without API metadata intact", () => {
    const restored = historyTurn({ role: "assistant", content: "Avance antiguo\n\nRespuesta antigua", ts: "" });
    expect(restored.text).toBe("Avance antiguo\n\nRespuesta antigua");
    expect(restored.tools).toEqual([]);
    expect(restored.apiActivity).toBeUndefined();
  });

  it("does not complete a commentary-only run with no final answer", () => {
    apply({ type: "text", delta: "Solo un avance", phase: "commentary" });
    apply({ type: "done" });
    expect(turn().text).toBe("");
    expect(apiExecutionStatus(turn())).toBe("unconfirmed");
  });
});

describe("history recovery isolation", () => {
  const request: ConversationMessage = { role: "user", content: "Revisa el estado", ts: "2026-10-17T10:00:00Z" };
  beforeEach(() => {
    const chat = chats.get(key)!;
    chats.set(key, { ...chat, turns: [historyTurn(request), ...chat.turns] });
  });
  it("allows the current resume probe to load persisted history after its stream buffer expired", async () => {
    chats.set(key, { ...chats.get(key)!, streaming: true, abort: new AbortController() });
    vi.mocked(assistantConversationsApi.messages).mockResolvedValue({
      items: [request, { role: "assistant", content: "Resultado recuperado", ts: "" }], total: 2, hasMore: false,
    });
    await reloadHistory(key, key);
    expect(turn().text).toBe("Resultado recuperado");
    expect(chats.get(key)?.streaming).toBe(false);
  });

  it("preserves the team board while rehydrating API history", async () => {
    const teamTasks = { task: { id: "task", title: "Tarea", status: "running" as const,
      workerAgentId: "worker", workerAgentName: "Agente", workerConversationId: "worker-chat", createdAt: "" } };
    chats.set(key, { ...chats.get(key)!, teamTasks });
    vi.mocked(assistantConversationsApi.messages).mockResolvedValue({ items: [request, {
      role: "assistant", content: "", ts: "", pending: true, apiActivity: { events: [
        { type: "text", phase: "commentary", delta: "Avance guardado" },
      ] },
    }], total: 2, hasMore: false });
    await reloadHistory(key, key);
    expect(chats.get(key)?.teamTasks).toEqual(teamTasks);
    expect(chats.get(key)?.streaming).toBe(false);
    expect(turn().completionPending).toBe(true);
    expect(turn().apiActivity?.events).toHaveLength(1);
  });

  it.each(["target", "removed", "new-stream", "conversation"])("discards a stale history response after %s changes", async change => {
    let finish!: (value: { items: ConversationMessage[]; total: number; hasMore: boolean }) => void;
    vi.mocked(assistantConversationsApi.messages).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const pending = reloadHistory(key, key);
    if (change === "target") scope.value = "target-b";
    if (change === "removed") chats.delete(key);
    if (change === "new-stream") chats.set(key, { ...chats.get(key)!, streaming: true });
    if (change === "conversation") chats.set(key, { ...chats.get(key)!, conversationId: "other" });
    const before = chats.get(key);
    finish({ items: [{ role: "assistant", content: "Dato de otro contexto", ts: "" }], total: 1, hasMore: false });
    await pending;
    expect(chats.get(key)).toBe(before);
    expect(chats.get(key)?.turns.some(t => t.text === "Dato de otro contexto")).not.toBe(true);
  });
});

it("shows a canceled worker instead of a stale pending outcome when no work remains active", () => {
  const response = historyTurn({ role: "assistant", content: "", ts: "", pending: true });
  const canceled = { id: "task", title: "Tarea", status: "canceled" as const, workerAgentId: "worker",
    workerAgentName: "Agente", workerConversationId: "worker-chat", createdAt: "" };
  expect(apiExecutionStatus(response, [canceled])).toBe("stopped");
  expect(apiExecutionStatus(response, [canceled, { ...canceled, id: "active", status: "running" }])).toBe("running");
  expect(apiExecutionStatus(response, [canceled, { ...canceled, id: "pending", status: "pending" }])).toBe("waiting");
});

it("updates the execution as failed worker verification is retried and resolved", () => {
  const response = historyTurn({ role: "assistant", content: "Respuesta guardada", ts: "" });
  const worker = { id: "task", title: "Tarea", status: "done" as const, workerAgentId: "worker",
    workerAgentName: "Agente", workerConversationId: "worker-chat", createdAt: "" };
  const failed = { ...worker, verify: { state: "failed" as const, attempts: 1 } };
  expect(apiExecutionStatus(response, [failed])).toBe("failed");
  expect(apiExecutionStatus(response, [{ ...failed, status: "pending", pendingPermission: true }])).toBe("waiting");
  expect(apiExecutionStatus(response, [{ ...failed, status: "running" }])).toBe("running");
  expect(apiExecutionStatus(response, [{ ...worker, verify: { state: "running", attempts: 2 } }])).toBe("running");
  expect(apiExecutionStatus(response, [{ ...worker, verify: { state: "passed", attempts: 2 } }])).toBe("done");
  expect(apiExecutionStatus(response, [{ ...worker, status: "failed" }])).toBe("failed");
});
