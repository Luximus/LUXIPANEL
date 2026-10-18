// SPDX-License-Identifier: AGPL-3.0-only
// Real backend finalization/serialization -> JSON wire -> real frontend reducers.
// Only I/O boundaries are mocked; no provider, database or production HTTP is used.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import type { AgentEvent, ConversationMessage } from "../assistant-api";
import { applyEvent, reloadHistory } from "./stream-apply";
import { historyTurn } from "./history";
import { chats } from "./state";
import { apiExecutionStatus } from "../chat-pane/api-activity";
import { snapshotToTaskView } from "../assistant-api/team";
const io = vi.hoisted(() => ({ messages: [] as unknown[], read: vi.fn(), scope: "qa-contract-target" }));
vi.mock("../assistant-api", () => ({
  assistantConversationsApi: { messages: io.read, markReviewed: vi.fn() },
  attachmentUrl: (id: string) => `/fixture/attachments/${id}`,
  displayText: (message: ConversationMessage) => message.textTranslated ?? message.content,
}));
vi.mock("@/lib/api-client", () => ({ resolveTargetScope: () => io.scope }));
vi.mock("@/lib/assistant-ws", () => ({ markAssistantTeamTaskSeen: vi.fn() }));
// Vite's frontend runner does not resolve this sibling package dynamically.
// Transpile actual backend source in memory; explicitly stub only I/O modules.
// No backend build output or source copy is used, and no service bootstrap is allowed.
const backend = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../backend/src");
const services = resolve(backend, "modules/ai-assistant/services");
const stubs = new Map<string, unknown>([
  [resolve(backend, "shared/executor/index.ts"), {
    runWithExecutor: (_executor: unknown, work: () => unknown) => work(),
    getContextExecutor: () => ({ target: { id: "qa-contract-target" } }), LOCAL_TARGET_ID: "local",
  }],
  [resolve(backend, "shared/logger/index.ts"), {
    createModuleLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  }],
  [resolve(backend, "shared/worklog/worklog-recorder.service.ts"), { recordActivity: vi.fn() }],
  [resolve(backend, "modules/ai-assistant/repositories/conversations.repository.ts"), {
    conversationsRepository: { getMeta: async () => null,
      appendMessages: async (_executor: unknown, _id: string, messages: unknown[]) => { io.messages.push(...messages); } },
  }],
  [resolve(backend, "modules/ai-assistant/repositories/team-tasks.repository.ts"), {
    teamTasksRepository: { listForLeaderConversation: async () => [] },
  }],
  [resolve(services, "providers/cli/shell.ts"), { ANSI_RE: /\x1b\[[0-9;?]*[ -/]*[@-~]/g }],
]);
const allowed = new Set([
  resolve(backend, "modules/ai-assistant/models/team-task.types.ts"),
  ...["agent-run-registry", "turn-finalization", "assistant-message-persistence", "conversation-message-normalizer", "api-activity", "execution-scope", "ask-protocol"].map(name => resolve(services, `${name}.ts`)),
  ...["events/index", "text/humanize-preview", "diagnostics/sanitize"].map(name => resolve(backend, `shared/${name}.ts`)),
  ...["message-presentation", "agent-envelope", "visible-summary"].map(name => resolve(backend, "modules/ai-assistant/models", name + ".ts")),
]);
const nativeRequire = createRequire(import.meta.url);
const backendRequire = createRequire(resolve(backend, "../package.json"));
const loaded = new Map<string, { exports: Record<string, any> }>();
function loadBackend(file: string): any {
  if (stubs.has(file)) return stubs.get(file);
  if (!allowed.has(file)) throw new Error(`QA refuses unexpected backend dependency: ${file}`);
  if (loaded.has(file)) return loaded.get(file)!.exports;
  const module = { exports: {} };
  loaded.set(file, module);
  const output = ts.transpileModule(readFileSync(file, "utf8"), {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const requireSource = (id: string): unknown => id.startsWith("node:") ? nativeRequire(id)
    : id === "zod" || id === "@toon-format/toon" ? backendRequire(id)
    : loadBackend(resolve(dirname(file), id.replace(/\.js$/, ".ts")));
  new Function("exports", "require", "module", output)(module.exports, requireSource, module);
  return module.exports;
}
const { agentRunRegistry } = loadBackend(resolve(services, "agent-run-registry.ts"));
const { guardTurnFinalization } = loadBackend(resolve(services, "turn-finalization.ts"));
const { persistAssistantMessage } = loadBackend(resolve(services, "assistant-message-persistence.ts"));
const { normalizeConversationMessage } = loadBackend(resolve(services, "conversation-message-normalizer.ts"));
const { toTeamTaskSnapshot, toTaskView } = loadBackend(resolve(backend, "modules/ai-assistant/models/team-task.types.ts"));
const wire = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const key = "qa-wire-contract";
let counter = 0;
const executor = { target: { id: "qa-contract-target" } };
beforeEach(() => {
  io.messages.length = 0;
  chats.set(key, { conversationId: key, provider: "openai", streaming: false,
    turns: [{ role: "assistant", text: "", tools: [], pending: true }] });
});
afterEach(() => { chats.clear(); vi.clearAllMocks(); });
async function roundTrip(events: AgentEvent[], pending = false) {
  const state = agentRunRegistry.start({ key: `qa-wire-${++counter}`, executor,
    makeGen: () => guardTurnFinalization((async function* () { yield* events; })(), async () => pending),
    onComplete: async (...args: unknown[]) => {
      const [answer, , ask, translation, duration, cliLog, askKind, outcome, activity] = args;
      await persistAssistantMessage(executor, key, answer, "openai", false, ask, translation,
        undefined, duration, cliLog, askKind, outcome, activity);
    },
  });
  await state.completion;
  const frames = wire<AgentEvent[]>(state.events);
  frames.forEach((event, seq) => applyEvent(key, event, { isCli: false, startedAt: 0, seq }));
  const live = chats.get(key)!.turns[0]!;
  const message = wire<ConversationMessage>(normalizeConversationMessage(io.messages.at(-1)));
  return { frames, live, message, restored: historyTurn(message) };
}
const tool: AgentEvent = { type: "tool_use", id: "read-a", name: "files.read", input: { path: "sample.txt" } };
const result: AgentEvent = { type: "tool_result", id: "read-a", success: true, output: "Archivo conservado" };

describe("integrated backend/frontend activity contract", () => {
  it.each([false, true])("keeps result ids, ordered progress and pending outcome across the wire: pending=%s", async pending => {
    const { frames, live, message, restored } = await roundTrip([
      { type: "text", delta: "Primera lectura" }, tool, result,
      { type: "text", delta: "Segunda lectura" }, { ...tool, id: "read-b" }, { ...result, id: "read-b", output: "Segundo archivo" },
      { type: "text", phase: "commentary", delta: "Avance posterior a la última llamada" },
      { type: "text", delta: "Resultado final verificado" }, { type: "done" },
    ], pending);
    expect(restored.tools).toEqual(live.tools);
    expect(restored.apiActivity).toEqual(live.apiActivity);
    expect(restored.tools.map(item => item.id)).toEqual(["read-a", "read-b"]);
    expect(restored.text).toBe(pending ? "" : "Resultado final verificado");
    expect(apiExecutionStatus(live)).toBe(pending ? "waiting" : "done");
    expect(apiExecutionStatus(restored)).toBe(pending ? "waiting" : "done");
    expect(message.pending === true).toBe(pending);
    // A reconnect replay must not execute or duplicate a received call.
    frames.forEach((event, seq) => applyEvent(key, event, { isCli: false, startedAt: 0, seq }));
    expect(chats.get(key)!.turns[0]).toEqual(live);
  });

  it("retains an uncertain tool failure on EOF without manufacturing success", async () => {
    const output = JSON.stringify({ operationStatus: "unconfirmed", message: "No se pudo confirmar el resultado", nextStep: "Consultar el estado" });
    const { frames, restored } = await roundTrip([tool, { ...result, success: false, output }]);
    expect(frames.at(-1)?.type).toBe("error");
    expect(restored.tools[0]?.result).toEqual({ success: false, output });
    expect(restored.error).toBeTruthy();
    expect(restored.text).toBe("");
    expect(apiExecutionStatus(restored)).toBe("failed");
  });

  it("preserves a human decision as waiting on SSE and persisted history", async () => {
    const questions = [{ id: "approve", type: "single" as const, text: "¿Continuar?", options: ["Sí", "No"] }];
    const { live, restored } = await roundTrip([tool, result, { type: "ask", id: "question", questions }, { type: "done" }]);
    expect(restored.ask).toEqual(questions);
    expect(apiExecutionStatus(live)).toBe("waiting");
    expect(apiExecutionStatus(restored)).toBe("waiting");
  });

  it("retains the live agent board and user attachments while adopting persisted history", async () => {
    const { message } = await roundTrip([tool, result, { type: "text", delta: "Resultado" }, { type: "done" }]);
    const task = { id: "worker", title: "Revisión", status: "failed" as const, workerAgentId: "reviewer",
      workerAgentName: "Revisor", workerConversationId: "worker-chat", createdAt: "", error: "Verificación fallida",
      artifacts: { filesChangedTotal: 2, insertions: 5, deletions: 1 } };
    chats.set(key, { ...chats.get(key)!, teamTasks: { worker: task } });
    io.read.mockResolvedValue({ items: [{ role: "user", content: "Revisar archivo", ts: "", attachments: [
      { id: "attachment", name: "sample.txt", mimeType: "text/plain", size: 12 },
    ] }, message], total: 2, hasMore: false });
    await reloadHistory(key, key);
    expect(chats.get(key)?.teamTasks).toEqual({ worker: task });
    expect(chats.get(key)?.turns[0]?.attachments).toEqual([expect.objectContaining({ name: "sample.txt" })]);
    expect(chats.get(key)?.turns[1]?.tools[0]?.result?.output).toBe("Archivo conservado");
  });
});

// A cold reload has no in-memory SSE task to enrich the lean HTTP snapshot.
it("keeps files and verification accessible after a cold persisted task snapshot", () => {
  const task = {
    id: "completed-worker", leaderConversationId: key, leaderAgentId: "leader", title: "Cambiar archivo",
    status: "done", workerAgentId: "worker", workerAgentName: "Revisor", workerConversationId: "worker-chat",
    createdAt: "2026-10-17T00:00:00Z", resultSummary: "Archivo verificado", collected: true,
    artifacts: { filesChangedTotal: 2, insertions: 5, deletions: 1 },
    verify: { state: "passed", attempts: 1 },
    isolation: { mode: "lease", branch: "developer", integrated: true },
  };
  const live = toTaskView(task);
  const restored = snapshotToTaskView(wire(toTeamTaskSnapshot(task)));
  expect(restored.workerAgentId).toBe(live.workerAgentId);
  expect(restored.workerConversationId).toBe(live.workerConversationId);
  expect(restored.artifacts).toEqual(live.artifacts);
  expect(restored.verify).toEqual(live.verify);
  expect(restored.isolation).toEqual(live.isolation);
});
