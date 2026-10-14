import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  events: new Map<string, (event: any) => void>(), dimension: undefined as undefined | (() => void),
  rect: { y: 50, height: 750 }, os: "android", topInset: 0,
}));
vi.mock("react-native", () => ({
  View: "View", Platform: { get OS() { return mocks.os; } },
  Keyboard: { addListener: (name: string, fn: (event: any) => void) => { mocks.events.set(name, fn); return { remove: () => mocks.events.delete(name) }; } },
  Dimensions: { addEventListener: (_name: string, fn: () => void) => { mocks.dimension = fn; return { remove: () => { mocks.dimension = undefined; } }; } },
}));
import { useTerminalKeyboard } from "./useTerminalKeyboard";
let tree: ReactTestRenderer | undefined;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
function Surface() {
  const { surfaceRef, onSurfaceLayout, overlap, keyboardOpen } = useTerminalKeyboard(mocks.topInset);
  return React.createElement("View", { ref: surfaceRef, onLayout: onSurfaceLayout, overlap, keyboardOpen } as any);
}
beforeEach(() => {
  vi.useFakeTimers(); mocks.os = "android"; mocks.rect = { y: 50, height: 750 }; mocks.topInset = 0;
  vi.stubGlobal("requestAnimationFrame", (fn: () => void) => setTimeout(fn, 16));
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
});
afterEach(async () => { if (tree) await act(async () => tree!.unmount()); tree = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); });
async function mount() {
  await act(async () => {
    tree = create(<Surface />, { createNodeMock: () => ({ measureInWindow: (fn: (...args: number[]) => void) => fn(0, mocks.rect.y, 390, mocks.rect.height) }) });
    await vi.advanceTimersByTimeAsync(16);
  });
}
const state = () => tree!.root.findByType("View" as any).props;
async function frame(event: string, y = 500) {
  await act(async () => mocks.events.get(event)!({ endCoordinates: { height: 300, screenY: y } }));
  await act(async () => { await vi.advanceTimersByTimeAsync(16); });
}
it("lifts a fixed session above IME then removes compensation after Android resize", async () => {
  await mount(); await frame("keyboardDidShow");
  expect(state().overlap).toBe(300); expect(state().keyboardOpen).toBe(true);
  mocks.rect.height = 450;
  await act(async () => { mocks.dimension!(); await vi.advanceTimersByTimeAsync(16); });
  expect(state().overlap).toBe(0); expect(state().keyboardOpen).toBe(true);
  await frame("keyboardDidHide");
  expect(state().overlap).toBe(0); expect(state().keyboardOpen).toBe(false);
});
it("accounts for a nested surface and moving iOS keyboard frames", async () => {
  mocks.os = "ios"; mocks.rect = { y: 140, height: 610 };
  await mount(); await frame("keyboardWillChangeFrame", 510);
  expect(state().overlap).toBe(240);
  await frame("keyboardWillChangeFrame", 480);
  expect(state().overlap).toBe(270);
  await frame("keyboardWillHide");
  expect(state().overlap).toBe(0);
});
it("uses the actual surface bottom when it is already above the keyboard", async () => {
  mocks.rect = { y: 80, height: 350 };
  await mount(); await frame("keyboardDidShow");
  expect(state().overlap).toBe(0);
  await act(async () => tree!.unmount()); tree = undefined;
  expect(mocks.events.size).toBe(0); expect(mocks.dimension).toBeUndefined();
});
it("converts Android window coordinates to keyboard screen coordinates with status bar insets", async () => {
  mocks.topInset = 24; mocks.rect = { y: -24, height: 800 };
  await mount(); await frame("keyboardDidShow", 500);
  expect(state().overlap).toBe(300);
  mocks.rect.height = 500;
  await act(async () => { mocks.dimension!(); await vi.advanceTimersByTimeAsync(16); });
  expect(state().overlap).toBe(0);
});
