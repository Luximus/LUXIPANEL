import {afterEach, beforeEach, expect, it, vi} from "vitest";

vi.mock("./startup-state", () => ({hasStartupShell: () => true, invalidateStartup: vi.fn(), afterPrimaryReady: (run: () => void) => {
  const timer = setTimeout(run, 500); return () => clearTimeout(timer);
}}));
vi.mock("./api-client", () => ({resolvePanelApiPath: (path: string) => path, scopeHeaders: () => ({})}));

class FakeSocket {
  static OPEN = 1;
  static instances: FakeSocket[] = [];
  readyState = 0;
  onopen?: () => void;
  onclose?: (event: {code: number; reason: string}) => void;
  onmessage?: (event: {data: string}) => void;
  send = vi.fn();
  constructor(public url: string) { FakeSocket.instances.push(this); }
  close() { this.readyState = 3; this.onclose?.({code: 1000, reason: ""}); }
  open() { this.readyState = 1; this.onopen?.(); }
  frame(data: unknown) { this.onmessage?.({data: JSON.stringify(data)}); }
}

beforeEach(() => { FakeSocket.instances = []; });
afterEach(() => {
  window.dispatchEvent(new Event("luxipanel:logout"));
  vi.useRealTimers(); vi.unstubAllGlobals();
});

it("does not let a late unauthorized fallback close the new target connection", async () => {
  vi.useFakeTimers(); vi.stubGlobal("WebSocket", FakeSocket);
  let reply!: (response: unknown) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise(resolve => { reply = resolve; })));
  const {startUiEvents} = await import("./ui-events"); startUiEvents();
  await vi.advanceTimersByTimeAsync(500);
  FakeSocket.instances[0]!.open(); FakeSocket.instances[0]!.close();
  window.dispatchEvent(new Event("luxipanel:target-changed"));
  await vi.advanceTimersByTimeAsync(500);
  const current = FakeSocket.instances[1]!; current.open();
  reply({status: 401}); await vi.advanceTimersByTimeAsync(0);
  expect(current.readyState).toBe(FakeSocket.OPEN);
});

it("bounds HTTP fallback attempts per target and restarts after permission changes", async () => {
  vi.useFakeTimers(); vi.stubGlobal("WebSocket", FakeSocket);
  const fetch = vi.fn().mockResolvedValue({status: 200, json: async () => ({ok: true, data: {chat: 0}})});
  vi.stubGlobal("fetch", fetch);
  const {startUiEvents} = await import("./ui-events"); startUiEvents();
  await vi.advanceTimersByTimeAsync(500);
  const first = FakeSocket.instances[0]!; first.open();
  first.frame({type: "ui:status-error"}); first.frame({type: "ui:status-error"});
  await vi.advanceTimersByTimeAsync(1000); expect(fetch).toHaveBeenCalledTimes(1);
  window.dispatchEvent(new Event("luxipanel:permissions-changed"));
  await vi.advanceTimersByTimeAsync(500);
  const current = FakeSocket.instances[1]!; current.open(); current.frame({type: "ui:status-error"});
  await vi.advanceTimersByTimeAsync(0); expect(fetch).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(30_000); current.frame({type: "ui:status-error"});
  await vi.advanceTimersByTimeAsync(0); expect(fetch).toHaveBeenCalledTimes(3);
});

it("stops fallback and reconnects when the current session is unauthorized", async () => {
  vi.useFakeTimers(); vi.stubGlobal("WebSocket", FakeSocket);
  const fetch = vi.fn().mockResolvedValue({status: 401}); vi.stubGlobal("fetch", fetch);
  const {startUiEvents} = await import("./ui-events"); startUiEvents();
  await vi.advanceTimersByTimeAsync(500);
  const socket = FakeSocket.instances[0]!; socket.open(); socket.frame({type: "ui:status-error"});
  await vi.advanceTimersByTimeAsync(120_000);
  expect(socket.readyState).toBe(3); expect(FakeSocket.instances).toHaveLength(1);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("shares one delayed socket, rejects stale frames after target changes, and stops on logout", async () => {
  vi.useFakeTimers(); vi.stubGlobal("WebSocket", FakeSocket);
  const fetch = vi.fn().mockResolvedValue({status: 200, json: async () => ({ok: true, data: {chat: 2, notifications: 3}})});
  vi.stubGlobal("fetch", fetch);
  const {startUiEvents} = await import("./ui-events");
  const received: unknown[] = [];
  const listener = (event: Event) => received.push((event as CustomEvent).detail);
  window.addEventListener("lxp:ui:status", listener);
  startUiEvents(); startUiEvents();
  expect(FakeSocket.instances).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(500);
  expect(FakeSocket.instances).toHaveLength(1);
  const first = FakeSocket.instances[0]!; first.open(); first.frame({type: "ui:status", chat: 1});
  expect(received).toHaveLength(1); expect(fetch).not.toHaveBeenCalled();
  window.dispatchEvent(new Event("luxipanel:target-changed"));
  first.frame({type: "ui:status", chat: 999});
  expect(received).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(500);
  expect(FakeSocket.instances).toHaveLength(2);
  const second = FakeSocket.instances[1]!; second.open();
  window.dispatchEvent(new Event("luxipanel:logout"));
  second.frame({type: "ui:status", chat: 999});
  await vi.advanceTimersByTimeAsync(120_000);
  expect(received).toHaveLength(1); expect(FakeSocket.instances).toHaveLength(2);
  expect(fetch).not.toHaveBeenCalled();
  window.removeEventListener("lxp:ui:status", listener);
});

it("refreshes the module catalog and ignores events from a previous target", async () => {
  vi.useFakeTimers(); vi.stubGlobal("WebSocket", FakeSocket);
  const received: unknown[] = [], listener = (event: Event) => received.push((event as CustomEvent).detail);
  window.addEventListener("luxipanel:modules-changed", listener);
  const { startUiEvents } = await import("./ui-events"); startUiEvents();
  await vi.advanceTimersByTimeAsync(500); const old = FakeSocket.instances[0]!; old.open();
  old.frame({ type: "ui:modules-changed", targetId: "A", revision: 1 }); expect(received).toHaveLength(1);
  window.dispatchEvent(new Event("luxipanel:target-changed"));
  old.frame({ type: "ui:modules-changed", targetId: "A", revision: 2 }); expect(received).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(500); const current = FakeSocket.instances[1]!; current.open();
  current.frame({ type: "ui:modules-changed", targetId: "B", revision: 3 }); expect(received).toHaveLength(2);
  window.removeEventListener("luxipanel:modules-changed", listener);
});
