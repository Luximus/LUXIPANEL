import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AgentEventFrame, ConversationMessage } from "../assistant-api";

const api = vi.hoisted(() => ({
  queue: vi.fn(), messages: vi.fn(), resume: vi.fn(),
}));
vi.mock("../assistant-api", () => ({
  listAgentQueue: api.queue,
  streamAgentResume: api.resume,
  assistantConversationsApi: { messages: api.messages },
  displayText: (message: ConversationMessage) => message.content,
}));
vi.mock("./resume-poll", () => ({ startBackgroundPoll: vi.fn(), stopBackgroundPoll: vi.fn() }));
vi.mock("@/lib/assistant-ws", () => ({ markAssistantTeamTaskSeen: vi.fn() }));

import { chatEngine } from "../chat-engine";
import { adopting, chats, pendingAddenda, queues, serverQueued } from "./state";
import { onCleanSettle } from "./send";

const key = "queued-conversation";
const oldHistory = [
  { role: "user", content: "Primero" },
  { role: "assistant", content: "Primero terminado" },
] as ConversationMessage[];

function liveRun(text: string, isCli = false) {
  let finish!: () => void;
  const completed = new Promise<void>(resolve => { finish = resolve; });
  const frames = (async function* (): AsyncGenerator<AgentEventFrame> {
    if (isCli) yield { event: { type: "tool_use", id: "cli", name: "codex.cli", input: {} }, seq: 0 };
    yield { event: { type: "text", delta: text }, seq: 1 };
    await completed;
    if (isCli) yield { event: { type: "tool_result", id: "cli", success: true, output: text }, seq: 2 };
    yield { event: { type: "done" }, seq: 3 };
  })();
  return { frames, finish };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  api.queue.mockResolvedValue([]);
  api.messages.mockResolvedValue({ items: [...oldHistory, { role: "user", content: "Segundo" }] });
  chats.set(key, { provider: "codex", conversationId: key, streaming: false,
    turns: [{ role: "assistant", text: "Primero terminado", tools: [] }] });
});

afterEach(() => {
  chats.clear(); adopting.clear(); queues.clear(); serverQueued.clear(); pendingAddenda.clear();
  vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks();
});

it.each([false, true])("streams each drained queued turn (CLI: %s)", async (isCli) => {
  const second = liveRun("Segundo en curso", isCli);
  const third = liveRun("Tercero en curso", isCli);
  serverQueued.set(key, [{ id: "q2", userText: "Segundo" }]);
  api.queue.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "q3", userText: "Tercero" }]);
  api.resume.mockResolvedValueOnce(second.frames).mockResolvedValueOnce(third.frames);
  const paint = vi.fn();
  const unsubscribe = chatEngine.subscribe(paint);
  try {
    onCleanSettle(key, key, "codex", isCli);
    await vi.advanceTimersByTimeAsync(300);
    expect(api.resume).toHaveBeenCalledTimes(1);
    expect(chats.get(key)?.streaming).toBe(true);
    const secondTurn = chats.get(key)?.turns.at(-1);
    expect(isCli ? secondTurn?.tools[0]?.terminal : secondTurn?.text).toContain("Segundo en curso");
    expect(paint).toHaveBeenCalled();

    api.messages.mockResolvedValue({ items: [...oldHistory,
      { role: "user", content: "Segundo" }, { role: "assistant", content: "Segundo en curso" },
      { role: "user", content: "Tercero" }] });
    second.finish();
    await vi.advanceTimersByTimeAsync(300);
    expect(api.resume).toHaveBeenCalledTimes(2);
    expect(chats.get(key)?.streaming).toBe(true);
    const thirdTurn = chats.get(key)?.turns.at(-1);
    expect(isCli ? thirdTurn?.tools[0]?.terminal : thirdTurn?.text).toContain("Tercero en curso");
    third.finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(chats.get(key)?.streaming).toBe(false);
    expect(chats.get(key)?.turns.at(-1)?.text).toBe("Tercero en curso");
    expect(chats.get(key)?.turns).toHaveLength(6);
    expect(serverQueued.has(key)).toBe(false);
  } finally {
    second.finish(); third.finish(); unsubscribe();
  }
});

it("waits for the next user turn to persist without replaying the previous answer twice", async () => {
  const next = liveRun("Segundo en curso");
  serverQueued.set(key, [{ id: "q2", userText: "Segundo" }]);
  api.messages.mockResolvedValueOnce({ items: oldHistory });
  api.resume.mockResolvedValueOnce((async function* (): AsyncGenerator<AgentEventFrame> {
    yield { event: { type: "text", delta: "Respuesta antigua duplicada" }, seq: 0 };
    yield { event: { type: "done" }, seq: 1 };
  })()).mockResolvedValueOnce(next.frames);
  try {
    onCleanSettle(key, key, "codex", false);
    await vi.advanceTimersByTimeAsync(300);
    expect(chats.get(key)?.turns).toHaveLength(2);
    expect(chats.get(key)?.streaming).toBe(false);
    await vi.advanceTimersByTimeAsync(700);
    expect(api.resume).toHaveBeenCalledTimes(2);
    expect(chats.get(key)?.turns.at(-1)?.text).toBe("Segundo en curso");
    expect(chats.get(key)?.turns).toHaveLength(4);
  } finally {
    next.finish();
    await vi.advanceTimersByTimeAsync(0);
  }
});

it("does not probe for another run when there was no queued message", async () => {
  onCleanSettle(key, key, "codex", false);
  await vi.advanceTimersByTimeAsync(12_000);
  expect(api.queue).toHaveBeenCalledOnce();
  expect(api.messages).not.toHaveBeenCalled();
  expect(api.resume).not.toHaveBeenCalled();
});
