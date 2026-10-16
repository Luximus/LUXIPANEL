import { expect, it, vi } from "vitest";
vi.mock("./execution-scope.js", () => ({ executionKey: (id: string, target = "local") => JSON.stringify([target, id]) }));
import { claimLiveVoice, liveVoiceSession, releaseLiveVoice } from "./realtime-state.js";
it("isolates target sessions and rejects duplicate controllers", () => {
  expect(claimLiveVoice("chat", "one", "a")).toBe(true);
  expect(claimLiveVoice("chat", "two", "a")).toBe(false);
  expect(claimLiveVoice("chat", "three", "b")).toBe(true);
  releaseLiveVoice("chat", "stale", "a");
  expect(liveVoiceSession("chat", "a")).toBe("one");
  releaseLiveVoice("chat", "one", "a");
  expect(liveVoiceSession("chat", "a")).toBeUndefined();
  expect(liveVoiceSession("chat", "b")).toBe("three");
  releaseLiveVoice("chat", "three", "b");
});
