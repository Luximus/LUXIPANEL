import {afterEach, expect, it, vi} from "vitest";
const mocks = vi.hoisted(() => ({
  refresh: vi.fn(async () => undefined), recovery: vi.fn(async () => undefined),
  status: "open", chats: new Map(), listeners: new Set([() => undefined]),
}));
vi.mock("../chat-engine", () => ({chatEngine: {refreshBackgroundRuns: mocks.refresh, resume: vi.fn()}}));
vi.mock("../assistant-api", () => ({resumeBackgroundRuns: mocks.recovery}));
vi.mock("./state", () => ({chats: mocks.chats, listeners: mocks.listeners, emit: vi.fn(), backgroundWorkerRunning: new Set()}));
vi.mock("./send", () => ({resetResumeAttempts: vi.fn()}));
vi.mock("./stream-apply", () => ({lastTurnInterrupted: () => false}));
vi.mock("@/lib/assistant-ws", () => ({connectAssistantWs: vi.fn(), getAssistantWsStatus: () => mocks.status,
  ASSISTANT_TEAM_TASK_EVENT: "qa:team-task", ASSISTANT_WS_STATUS_EVENT: "qa:ws-status"}));
vi.mock("@/lib/startup-state", () => ({afterPrimaryReady: (run: () => void, delay: number) => {
  const timer = setTimeout(run, delay); return () => clearTimeout(timer);
}}));
import {startBackgroundPoll, stopBackgroundPoll} from "./resume-poll";
afterEach(() => {stopBackgroundPoll(); vi.useRealTimers(); vi.restoreAllMocks(); mocks.chats.clear();});
it("defers startup, pauses hidden polling, and performs one recovery on returning to a restored chat", async () => {
  vi.useFakeTimers();
  const visible = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  startBackgroundPoll(); startBackgroundPoll();
  expect(mocks.refresh).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1000);
  expect(mocks.refresh).toHaveBeenCalledTimes(1); expect(mocks.recovery).not.toHaveBeenCalled();
  visible.mockReturnValue("hidden"); document.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(120_000); expect(mocks.refresh).toHaveBeenCalledTimes(1);
  mocks.chats.set("restored", {conversationId: "existing", streaming: false});
  visible.mockReturnValue("visible");
  document.dispatchEvent(new Event("visibilitychange")); document.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(1000);
  expect(mocks.recovery).toHaveBeenCalledTimes(1); expect(mocks.refresh).toHaveBeenCalledTimes(2);
  mocks.status = "closed"; window.dispatchEvent(new Event("qa:ws-status"));
  await vi.advanceTimersByTimeAsync(4_999); expect(mocks.refresh).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1); expect(mocks.refresh).toHaveBeenCalledTimes(3);
});
it("reconciles ordinary runs every five seconds even when the team websocket is open", async () => {
  vi.useFakeTimers(); mocks.refresh.mockClear(); mocks.status = "open";
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  startBackgroundPoll(); await vi.advanceTimersByTimeAsync(1000);
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(5000);
  expect(mocks.refresh).toHaveBeenCalledTimes(2);
});
