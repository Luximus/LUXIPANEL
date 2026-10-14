import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ url: vi.fn(), authenticate: vi.fn(), revision: 0, listeners: new Set<() => void>(), keyboardOpen: false, overlap: 0 }));
vi.mock("../hooks/useTerminalKeyboard", () => ({ useTerminalKeyboard: () => ({ surfaceRef: { current: null }, onSurfaceLayout() {}, keyboardOpen: mocks.keyboardOpen, overlap: mocks.overlap }) }));
vi.mock("../api/terminalSession", () => ({ ensureTerminalSession: mocks.authenticate }));
vi.mock("react-native", () => ({
  KeyboardAvoidingView: "KeyboardAvoidingView", View: "View", Text: "Text", TextInput: "Input", Pressable: "Pressable", ScrollView: "ScrollView", ActivityIndicator: "Spinner",
  StyleSheet: { create: (s: unknown) => s, absoluteFillObject: {} }, Platform: { OS: "android" },
  AppState: { addEventListener: () => ({ remove() {} }) }, Keyboard: { addListener: () => ({ remove() {} }) },
}));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
vi.mock("lucide-react-native", () => ({ AlertTriangle: "Icon", Download: "Icon", RefreshCw: "Icon" }));
vi.mock("../hooks/useTheme", () => ({ useTheme: () => ({ theme: "dark" }) }));
vi.mock("../theme/colors", () => ({ getThemeTokens: () => ({}) }));
vi.mock("./NativeTerminalView", () => ({ NativeTerminalView: (props: unknown) => React.createElement("terminal-grid", props as any) }));
vi.mock("../api/client", () => ({ buildTerminalWsUrl: mocks.url, getTerminalTmuxStatus: async () => ({ installed: true }), installTerminalTmux: vi.fn() }));
vi.mock("../api/serverApi", () => ({
  getDirectSessionRevision: () => mocks.revision,
  subscribeDirectSessions: (fn: () => void) => { mocks.listeners.add(fn); return () => mocks.listeners.delete(fn); },
}));
vi.mock("expo-clipboard", () => ({ getStringAsync: async () => "" }));
import NativeTerminalSession from "./NativeTerminalSession";
class Socket {
  static all: Socket[] = []; static OPEN = 1;
  readyState = 0; binaryType = ""; onopen?: () => void; onclose?: (e: any) => void; onerror?: () => void; onmessage?: (e: any) => void;
  send = vi.fn(); close = vi.fn(() => { this.readyState = 3; this.onclose?.({ code: 1000 }); });
  constructor(public url: string) { Socket.all.push(this); }
  frame(frame: unknown) { this.onmessage?.({ data: JSON.stringify(frame) }); }
}
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReactTestRenderer | undefined;
beforeEach(() => {
  vi.useFakeTimers(); vi.stubGlobal("WebSocket", Socket); Socket.all = []; mocks.revision = 0; mocks.keyboardOpen = false; mocks.overlap = 0;
  mocks.url.mockReset().mockResolvedValue("wss://box.example/api/terminal/ws?token=ticket");
  mocks.authenticate.mockReset().mockResolvedValue(true);
});
afterEach(async () => {
  if (tree) await act(async () => tree!.unmount()); tree = undefined;
  vi.useRealTimers(); vi.unstubAllGlobals(); mocks.listeners.clear();
});
const mount = async () => { await act(async () => { tree = create(<NativeTerminalSession panelId="a" token="portal" sessionId="console-12345678" language="en" />); }); };
it("renders the real box JSON output and waits for PTY readiness before connecting", async () => {
  await mount(); const ws = Socket.all[0]!;
  await act(async () => { ws.readyState = 1; ws.onopen?.(); });
  expect(JSON.stringify(tree!.toJSON())).toContain("Connecting");
  await act(async () => { ws.frame({ type: "connected" }); ws.frame({ type: "output", data: "prompt$ hello\r\n" }); await vi.advanceTimersByTimeAsync(20); });
  const rows = tree!.root.findByType("terminal-grid" as any).props.rows;
  expect(JSON.stringify(rows)).toContain("prompt$ hello");
  expect(JSON.stringify(tree!.toJSON())).not.toContain("Connecting");
  expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: "resize", cols: 80, rows: 24 }));
});
it("gets a fresh ticket and keeps the console id when reconnecting", async () => {
  await mount(); const first = Socket.all[0]!;
  await act(async () => { first.readyState = 1; first.onopen?.(); first.frame({ type: "connected" }); });
  await act(async () => first.close());
  await act(async () => { await vi.advanceTimersByTimeAsync(801); });
  expect(Socket.all).toHaveLength(2);
  expect(mocks.url).toHaveBeenCalledTimes(2);
  expect(mocks.url.mock.calls[1]?.[3]).toBe("console-12345678");
});
it("does not open a socket after unmount while authorization is pending", async () => {
  let resolve!: (url: string) => void;
  mocks.url.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  await mount();
  await act(async () => tree!.unmount()); tree = undefined;
  await act(async () => resolve("wss://box.example/api/terminal/ws?token=late"));
  expect(Socket.all).toHaveLength(0);
});
it("closes the previous socket on session change and stops retrying missing authentication", async () => {
  await mount(); const first = Socket.all[0]!;
  mocks.url.mockRejectedValue(new Error("connect_required"));
  await act(async () => { mocks.revision++; mocks.listeners.forEach(fn => fn()); });
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
  expect(first.close).toHaveBeenCalledTimes(1);
  expect(Socket.all).toHaveLength(1);
  expect(JSON.stringify(tree!.toJSON())).toContain("Connect the server to open the terminal.");
});
it("shows the box error and stops retrying a forbidden terminal", async () => {
  await mount(); const ws = Socket.all[0]!;
  await act(async () => { ws.frame({ type: "error", message: "Terminal access denied" }); ws.onclose?.({ code: 1008 }); });
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
  expect(JSON.stringify(tree!.toJSON())).toContain("Terminal access denied");
  expect(Socket.all).toHaveLength(1);
});
it("opens the terminal immediately while the saved credential connects in the background", async () => {
  let resolve!: (connected: boolean) => void;
  mocks.authenticate.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  await mount();
  expect(tree!.root.findByType("terminal-grid" as any)).toBeDefined();
  expect(tree!.root.findAllByType("Input" as any)).toHaveLength(0);
  expect(Socket.all).toHaveLength(0);
  await act(async () => resolve(true));
  expect(tree!.root.findByType("terminal-grid" as any)).toBeDefined();
  expect(Socket.all).toHaveLength(1);
});
it("retries saved credentials in the same terminal after authentication fails", async () => {
  mocks.authenticate.mockResolvedValueOnce(false);
  await mount();
  expect(tree!.root.findByType("terminal-grid" as any)).toBeDefined();
  expect(JSON.stringify(tree!.toJSON())).toContain("saved credentials");
  expect(Socket.all).toHaveLength(0);
  await act(async () => tree!.root.findAllByType("Pressable" as any).find(node => node.props.style?.some?.((style: any) => style?.borderRadius === 12))!.props.onPress());
  expect(mocks.authenticate).toHaveBeenCalledTimes(2);
  expect(Socket.all).toHaveLength(1);
  expect(JSON.stringify(tree!.toJSON())).not.toContain("saved credentials");
});
it("sends one carriage return for the software keyboard and forwards VT query replies", async () => {
  await mount(); const ws=Socket.all[0]!;
  await act(async()=>{ws.readyState=1;ws.onopen?.();ws.frame({type:"connected"});});
  ws.send.mockClear();
  const input=tree!.root.findByType("Input" as any);
  await act(async()=>input.props.onChangeText(input.props.value+"\n"));
  expect(ws.send.mock.calls.map(call=>JSON.parse(call[0])).filter(frame=>frame.type==="input")).toEqual([{type:"input",data:"\r"}]);
  await act(async()=>{ws.frame({type:"output",data:"\x1b[6n"});await vi.advanceTimersByTimeAsync(20);});
  expect(ws.send.mock.calls.map(call=>JSON.parse(call[0])).some(frame=>frame.type==="input"&&frame.data==="\x1b[1;1R")).toBe(true);
});
it("encodes toolbar arrows in the application cursor mode requested by Codex", async()=>{
 mocks.keyboardOpen=true;
 await mount();const ws=Socket.all[0]!;
 await act(async()=>{ws.readyState=1;ws.onopen?.();ws.frame({type:"connected"});ws.frame({type:"output",data:"\x1b[?1h"});await vi.advanceTimersByTimeAsync(20);});
 const arrow=tree!.root.findAllByType("Pressable" as any).find(node=>node.findAllByType("Text" as any).some(label=>label.props.children==="↑"));
 expect(arrow).toBeDefined(); ws.send.mockClear(); await act(async()=>arrow!.props.onPress());
 expect(ws.send).toHaveBeenCalledWith(JSON.stringify({type:"input",data:"\x1bOA"}));
});
it("resends the latest mobile grid once the PTY is ready, including reattachment", async () => {
  await mount(); const ws = Socket.all[0]!;
  await act(async () => { ws.readyState = 1; ws.onopen?.(); });
  // The backend may discard everything until it sends connected. The visible
  // area can change while its asynchronous PTY startup is still in progress.
  await act(async () => tree!.root.findAllByType("Pressable" as any).find(node => node.props.onLayout)!.props.onLayout({ nativeEvent: { layout: { width: 390, height: 400 } } }));
  ws.send.mockClear();
  await act(async () => ws.frame({ type: "connected", reattached: true }));
  expect(ws.send.mock.calls.map(call => JSON.parse(call[0]))).toContainEqual({ type: "resize", cols: 48, rows: 21 });
  expect(tree!.root.findByType("terminal-grid" as any).props.cols).toBe(48);
  expect(Socket.all).toHaveLength(1);
});
it("shows auxiliary keys only with the keyboard, above the measured overlap", async () => {
  await mount();
  const labels = () => tree!.root.findAllByType("Text" as any).map(node => node.props.children);
  expect(labels()).not.toContain("Esc");
  mocks.keyboardOpen = true; mocks.overlap = 270;
  await act(async () => tree!.update(<NativeTerminalSession panelId="a" token="portal" sessionId="console-12345678" language="en" />));
  expect(labels()).toContain("Esc");
  const surface = tree!.root.findAllByType("View" as any).find(node => node.props.collapsable === false)!;
  expect(surface.props.style).toContainEqual(expect.objectContaining({ paddingBottom: 270 }));
  mocks.keyboardOpen = false; mocks.overlap = 0;
  await act(async () => tree!.update(<NativeTerminalSession panelId="a" token="portal" sessionId="console-12345678" language="en" />));
  expect(labels()).not.toContain("Esc");
  expect(Socket.all).toHaveLength(1);
});
it("keeps an inactive PTY connected without autofocus, input or auxiliary keys", async () => {
  mocks.keyboardOpen = true;
  const blur = vi.fn(), onStatus = vi.fn(), onViewport = vi.fn(), onActions = vi.fn();
  const render = (active: boolean) => <NativeTerminalSession panelId="a" token="portal" sessionId="console-12345678" language="en" active={active} onStatusChange={onStatus} onViewportChange={onViewport} onRegisterActions={onActions} />;
  await act(async () => { tree = create(render(false), { createNodeMock: element => element.type === "Input" ? { blur } : null }); });
  const ws = Socket.all[0]!;
  await act(async () => { ws.readyState = 1; ws.onopen?.(); ws.frame({ type: "connected" }); });
  expect(onStatus).toHaveBeenLastCalledWith("ready");
  expect(tree!.root.findByType("Input" as any).props.autoFocus).toBe(false);
  expect(tree!.root.findByType("Input" as any).props.editable).toBe(false);
  expect(tree!.root.findAllByProps({ testID: "terminal-special-keys" })).toHaveLength(0);
  expect(onViewport).not.toHaveBeenCalled();
  ws.send.mockClear();
  await act(async () => tree!.root.findByType("Input" as any).props.onChangeText("ignored"));
  expect(ws.send).not.toHaveBeenCalled();
  await act(async () => tree!.update(render(true)));
  expect(tree!.root.findAllByProps({ testID: "terminal-special-keys" })).toHaveLength(1);
  expect(Socket.all).toHaveLength(1);
  await act(async () => onActions.mock.calls[0][0].blur());expect(blur).toHaveBeenCalled();
  await act(async () => tree!.update(render(false)));expect(blur.mock.calls.length).toBeGreaterThan(1);
  expect(ws.close).not.toHaveBeenCalled();
});
it("uses the web's 13 auxiliary keys, reports their measured height and preserves Ctrl+C and slash input", async () => {
  mocks.keyboardOpen = true; mocks.overlap = 270;
  const onViewport = vi.fn();
  await act(async () => { tree = create(<NativeTerminalSession panelId="a" token="portal" language="en" onViewportChange={onViewport} />); });
  const ws = Socket.all[0]!;
  await act(async () => { ws.readyState = 1; ws.onopen?.(); ws.frame({ type: "connected" }); });
  const bar = tree!.root.findByProps({ testID: "terminal-special-keys" });
  expect(bar.findAllByType("Pressable" as any).map(node => node.props.accessibilityLabel)).toEqual(["Esc", "Tab", "Ctrl", "Alt", "PgUp", "PgDn", "/", "Home", "←", "↑", "↓", "→", "End"]);
  await act(async () => bar.props.onLayout({ nativeEvent: { layout: { height: 87 } } }));
  expect(onViewport).toHaveBeenLastCalledWith({ bottom: 357, height: 0 });
  const press = async (label: string) => act(async () => bar.findAllByType("Pressable" as any).find(node => node.props.accessibilityLabel === label)!.props.onPress());
  ws.send.mockClear(); await press("/");
  expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: "input", data: "/" }));
  await press("Ctrl");
  const input = tree!.root.findByType("Input" as any);
  await act(async () => input.props.onChangeText(input.props.value + "c"));
  expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: "input", data: "\x03" }));
  await act(async () => input.props.onChangeText(input.props.value + "c"));
  expect(ws.send).toHaveBeenLastCalledWith(JSON.stringify({ type: "input", data: "c" }));
});
