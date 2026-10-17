import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ runs: vi.fn(), tasks: vi.fn(), snapshot: vi.fn(), messages: vi.fn(), resume: vi.fn(), send: vi.fn(), scope: "target-a" }));
vi.mock("../assistant-api", () => ({
  snapshotToTaskView: (task: unknown) => task,
  listActiveRuns: api.runs, teamApi: { listActive: api.tasks, getConversationSnapshot: api.snapshot },
  assistantConversationsApi: { messages: api.messages, markReviewed: vi.fn(async () => {}) },
  streamAgentResume: api.resume, streamAgent: api.send, listAgentQueue: vi.fn(async () => []),
  displayText: (m: { content: string }) => m.content, attachmentUrl: (id: string) => id,
}));
vi.mock("./resume-poll", () => ({ startBackgroundPoll: vi.fn(), stopBackgroundPoll: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ resolveTargetScope: () => api.scope }));
vi.mock("@/lib/assistant-ws", () => ({ markAssistantTeamTaskSeen: vi.fn() }));
import { chatEngine } from "../chat-engine";
import { chats, backgroundActive, backgroundPending, backgroundWorkerRunning, unreviewedBackground } from "./state";

const key = "pending-chat";
const teamTasks = { task: { id: "task", title: "Revisar", status: "done" as const, workerAgentId: "worker",
  workerAgentName: "Agente", workerConversationId: "worker-chat", createdAt: "" } };
const pending = { role: "assistant" as const, content: "", ts: "2026-10-17T00:00:00Z", pending: true };
beforeEach(() => {
  api.scope = "target-a"; api.runs.mockResolvedValue([]); api.tasks.mockResolvedValue([]); api.resume.mockResolvedValue(null); api.snapshot.mockResolvedValue(null);
  chats.set(key, { provider: "openai", conversationId: key, streaming: false, teamTasks,
    turns: [{ role: "assistant", text: "", tools: [], completionPending: true }] });
  chatEngine.setActiveView(key);
});
afterEach(() => {
  chats.clear(); backgroundActive.clear(); backgroundPending.clear(); backgroundWorkerRunning.clear(); unreviewedBackground.clear();
  chatEngine.setActiveView(null); vi.clearAllMocks();
});

it("loads the collected final answer for an open pending conversation on the regular safety poll", async () => {
  api.messages.mockResolvedValue({ items: [pending,
    { role: "user", content: "Recoger resultados", auto: true, ts: "2026-10-17T00:01:00Z" },
    { role: "assistant", content: "Resultado verificado", ts: "2026-10-17T00:02:00Z" },
  ] });
  await chatEngine.refreshBackgroundRuns();
  await vi.waitFor(() => expect(chats.get(key)?.turns.at(-1)?.text).toBe("Resultado verificado"));
  expect(chats.get(key)?.turns[0]?.completionPending).toBe(true);
  expect(chats.get(key)?.turns.at(-1)?.completionPending).toBeUndefined();
  expect(chats.get(key)?.teamTasks).toEqual(teamTasks);
  expect(chats.get(key)?.streaming).toBe(false);
  expect(api.send).not.toHaveBeenCalled();
});

it("adopts an existing collection stream without resubmitting work or losing the board", async () => {
  api.messages.mockResolvedValue({ items: [pending,
    { role: "user", content: "Recoger resultados", auto: true, ts: "2026-10-17T00:01:00Z" },
  ] });
  api.resume.mockImplementation(async () => (async function* () {
    yield { event: { type: "text", phase: "commentary", delta: "Comprobando resultados" }, seq: 0 };
    yield { event: { type: "text", phase: "final_answer", delta: "Resultado recogido" }, seq: 1 };
    yield { event: { type: "done" }, seq: 2 };
  })());
  await chatEngine.refreshPendingOutcome(key);
  await vi.waitFor(() => expect(chats.get(key)?.turns.at(-1)?.text).toBe("Resultado recogido"));
  expect(api.resume).toHaveBeenCalledOnce();
  expect(api.resume.mock.calls[0]?.slice(0, 2)).toEqual([key, -1]);
  expect(api.send).not.toHaveBeenCalled();
  expect(chats.get(key)?.teamTasks).toEqual(teamTasks);
  expect(chats.get(key)?.streaming).toBe(false);
});

it("coalesces pending reads and ignores their response after switching target", async () => {
  let finish!: (value: unknown) => void;
  api.messages.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const first = chatEngine.refreshPendingOutcome(key);
  await chatEngine.refreshPendingOutcome(key);
  expect(api.messages).toHaveBeenCalledOnce();
  api.scope = "target-b";
  const before = chats.get(key);
  finish({ items: [{ role: "assistant", content: "Respuesta del target anterior", ts: "" }] });
  await first;
  expect(chats.get(key)).toBe(before);
  expect(api.resume).not.toHaveBeenCalled();
  expect(api.send).not.toHaveBeenCalled();
});

it("keeps pending evidence after a failed read and skips invisible or active streams", async () => {
  api.messages.mockRejectedValue(new Error("offline"));
  await chatEngine.refreshPendingOutcome(key);
  expect(chats.get(key)?.turns.at(-1)?.completionPending).toBe(true);
  expect(api.send).not.toHaveBeenCalled();
  api.messages.mockClear();
  chatEngine.setActiveView("other");
  await chatEngine.refreshPendingOutcome(key);
  chatEngine.setActiveView(key);
  chats.set(key, { ...chats.get(key)!, streaming: true });
  await chatEngine.refreshPendingOutcome(key);
  expect(api.messages).not.toHaveBeenCalled();
});

it("uses the persisted CLI mode when a new collection run has not reached the background feed", async () => {
  api.messages.mockResolvedValue({ items: [
    { ...pending, cli: true, cliLog: "Registro CLI pendiente" },
    { role: "user", content: "Recoger resultados", auto: true, ts: "2026-10-17T00:01:00Z" },
  ] });
  api.resume.mockImplementation(async () => (async function* () {
    yield { event: { type: "tool_use", id: "cli", name: "codex.cli", input: {} }, seq: 0 };
    yield { event: { type: "text", delta: "Verificando en CLI" }, seq: 1 };
    yield { event: { type: "tool_result", id: "cli", success: true, output: "Respuesta CLI" }, seq: 2 };
    yield { event: { type: "done" }, seq: 3 };
  })());
  await chatEngine.refreshPendingOutcome(key);
  await vi.waitFor(() => expect(chats.get(key)?.turns.at(-1)?.text).toBe("Respuesta CLI"));
  expect(chats.get(key)?.turns.at(-1)?.tools[0]?.terminal).toBe("Verificando en CLI");
  expect(api.send).not.toHaveBeenCalled();
});

it("cannot adopt an old target's stream after a delayed probe", async () => {
  let finish!: (value: unknown) => void;
  api.resume.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  chats.set(key, { ...chats.get(key)!, turns: [{ role: "user", text: "Origen", tools: [] }] });
  const pendingAdoption = chatEngine.adopt(key, "openai", key, false);
  api.scope = "target-b";
  chats.set(key, { ...chats.get(key)!, turns: [{ role: "user", text: "Nuevo contexto", tools: [] }] });
  const current = chats.get(key);
  finish((async function* () {
    yield { event: { type: "text", delta: "Dato del servidor anterior" }, seq: 0 };
    yield { event: { type: "done" }, seq: 1 };
  })());
  expect(await pendingAdoption).toBe(false);
  expect(chats.get(key)).toBe(current);
  expect(api.resume.mock.calls[0]?.[2]?.aborted).toBe(true);
});

it.each(["target", "newer-event"])("does not regress the task board after %s changes during a snapshot read", async change => {
  let finish!: (value: unknown) => void;
  api.snapshot.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const reading = chatEngine.refreshTeamTasks(key);
  if (change === "target") api.scope = "target-b";
  else chats.set(key, { ...chats.get(key)!, teamTasks: { task: { ...teamTasks.task, status: "running" } } });
  const current = chats.get(key)!.teamTasks;
  finish({ tasks: [{ ...teamTasks.task, status: "failed" }] });
  await reading;
  expect(chats.get(key)?.teamTasks).toEqual(current);
});
