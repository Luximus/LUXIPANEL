import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  targets: new Map<string, { jwt: string; baseUrl: string }>(),
  sessions: new Set<() => void>(),
  streams: new Map<string, (event: any) => void>(),
  requests: vi.fn(),
  create: vi.fn(),
  close: vi.fn().mockResolvedValue(undefined),
  ringPrefs: null as Promise<unknown> | null,
}));
vi.mock("../api/serverApi", () => ({
  getDirect: (id: string) => state.targets.get(id),
  getDirectServerIds: () => [...state.targets.keys()],
  subscribeDirectSessions: (fn: () => void) => {
    state.sessions.add(fn);
    return () => state.sessions.delete(fn);
  },
}));
vi.mock("../api/serverUserApi", () => ({
  userRequest: (_id: string, _method: string, path: string) =>
    path === "/api/preferences"
      ? Promise.resolve({ username: "alice" })
      : (state.ringPrefs ??
        Promise.resolve({
          calls: {
            dnd: false,
            language: "es",
            translate: true,
            micDefault: "on",
          },
        })),
  messagingApi: () => ({
    startCall: () => state.requests(),
    accept: () => state.requests(),
    end: vi.fn().mockResolvedValue(undefined),
    reject: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock("./server-chat-stream", () => ({
  subscribeServerChat: (id: string, fn: (event: any) => void) => {
    state.streams.set(id, fn);
    return () => state.streams.delete(id);
  },
}));
vi.mock("./audio-call-engine", () => ({ createAudioCall: state.create }));
import {
  initializeServerCalls,
  getServerCallSnapshot,
  startServerCall,
  endServerCall,
} from "./server-calls";
const call = {
  id: "call-a",
  convId: "conversation-a",
  state: "ringing",
  startedBy: "bob",
  kind: "dm",
  participants: [
    {
      id: "alice",
      displayName: "Alice",
      state: "ringing",
      lang: "es",
      translate: true,
    },
  ],
  translation: { enabled: true },
};
let stop: (() => void) | undefined;
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
beforeEach(async () => {
  await endServerCall();
  state.targets.clear();
  state.streams.clear();
  state.sessions.clear();
  state.ringPrefs = null;
  vi.clearAllMocks();
  state.targets.set("server-a", { jwt: "jwt", baseUrl: "https://a.example" });
  state.requests.mockResolvedValue({
    call,
    wsUrl: "wss://a.example/call",
    token: "call-token",
  });
  state.create.mockResolvedValue({
    close: state.close,
    setMuted: vi.fn(),
    setLanguage: vi.fn(),
  });
});
afterEach(async () => {
  stop?.();
  stop = undefined;
  await endServerCall();
});
describe("call service outlives module visibility", () => {
  it("receives incoming calls without opening Messaging and follows authenticated sessions", async () => {
    stop = initializeServerCalls();
    expect(state.streams.has("server-a")).toBe(true);
    state.streams.get("server-a")!({ type: "chat:call:ring", data: { call } });
    await flush();
    expect(getServerCallSnapshot()?.incoming?.id).toBe("call-a");
    state.targets.clear();
    for (const fn of state.sessions) fn();
    expect(getServerCallSnapshot()).toBeNull();
    expect(state.streams.size).toBe(0);
  });
  it("does not ring an ended call when preferences resolve late", async () => {
    let resolve!: (value: unknown) => void;
    state.ringPrefs = new Promise((done) => (resolve = done));
    stop = initializeServerCalls();
    const event = state.streams.get("server-a")!;
    event({ type: "chat:call:ring", data: { call } });
    event({
      type: "chat:call:state",
      data: { call: { ...call, state: "ended" } },
    });
    resolve({
      calls: { dnd: false, language: "es", translate: false, micDefault: "on" },
    });
    await flush();
    expect(getServerCallSnapshot()).toBeNull();
  });
  it("keeps audio active independently of views and disposes a late engine after logout", async () => {
    stop = initializeServerCalls();
    await startServerCall("server-a", "conversation-a");
    expect(getServerCallSnapshot()?.status).toBe("active");
    expect(state.close).not.toHaveBeenCalled();
    await endServerCall();
    expect(state.close).toHaveBeenCalledTimes(1);
    let resolve!: (value: unknown) => void;
    state.create.mockImplementation(
      () => new Promise((done) => (resolve = done)),
    );
    const pending = startServerCall("server-a", "conversation-a");
    await flush();
    state.targets.clear();
    for (const fn of state.sessions) fn();
    resolve({ close: state.close, setMuted: vi.fn(), setLanguage: vi.fn() });
    await pending;
    expect(getServerCallSnapshot()).toBeNull();
    expect(state.close).toHaveBeenCalledTimes(2);
  });
});
