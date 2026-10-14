import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  capture: vi.fn(), dispose: vi.fn(), save: vi.fn(async () => {}), timing: vi.fn(), mounts: 0, unmounts: 0,
}));
vi.mock("react-native", () => ({
  View: "View", StyleSheet: { create: (s: unknown) => s, absoluteFillObject: {} },
  AppState: { currentState: "active", addEventListener: () => ({ remove() {} }) },
  AccessibilityInfo: { isReduceMotionEnabled: async () => false, addEventListener: () => ({ remove() {} }) },
  useWindowDimensions: () => ({ width: 390, height: 844 }),
}));
vi.mock("@shopify/react-native-skia", () => ({
  Canvas: "Canvas", Group: "Group", Image: "Bitmap", makeImageFromView: mocks.capture,
  Skia: { Path: { Make: () => ({ addCircle() {} }) } },
}));
vi.mock("react-native-reanimated", () => ({
  useSharedValue: (value: unknown) => React.useRef({ value }).current,
  useDerivedValue: (fn: () => unknown) => ({ value: fn() }), cancelAnimation: () => {},
  Easing: { bezier: () => "ease-in" }, runOnJS: (fn: unknown) => fn,
  withTiming: (value: number, options: unknown, callback: () => void) => { mocks.timing(value, options); callback(); return value; },
}));
vi.mock("./panel-palette", () => ({ subscribeActivePalette: () => () => {} }));
vi.mock("../lib/session-state", () => ({
  loadSessionState: () => ({ isDark: false }), hydrateSessionState: async () => ({ isDark: false }), saveSessionState: mocks.save,
}));
let tree: ReactTestRenderer | undefined;
beforeEach(() => {
  vi.resetModules(); mocks.capture.mockReset(); mocks.dispose.mockClear(); mocks.save.mockClear(); mocks.timing.mockClear(); mocks.mounts = 0; mocks.unmounts = 0;
  mocks.capture.mockResolvedValue({ dispose: mocks.dispose });
  vi.stubGlobal("requestAnimationFrame", (fn: () => void) => { queueMicrotask(fn); return 1; });
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => { if (tree) await act(async () => tree!.unmount()); tree = undefined; vi.unstubAllGlobals(); });
async function mount(scope = "a") {
  const { ThemeTransitionProvider, ThemeTransitionScope } = await import("./ThemeTransitionProvider");
  const { useTheme } = await import("../hooks/useTheme");
  function Form() {
    const { theme, toggleTheme } = useTheme(); const [value, setValue] = React.useState("draft-secret");
    React.useEffect(() => { mocks.mounts++; return () => { mocks.unmounts++; }; }, []);
    return React.createElement("Form", { theme, value, setValue, toggle: () => toggleTheme({ x: 320, y: 56 }) });
  }
  const content = (value: string) => <ThemeTransitionProvider><ThemeTransitionScope value={value} /><Form /></ThemeTransitionProvider>;
  await act(async () => { tree = create(content(scope), { createNodeMock: () => ({ measureInWindow: (fn: Function) => fn(10, 20, 380, 760) }) }); });
  return { content, form: () => tree!.root.findByType("Form" as any) };
}
it("reveals the new theme from the measured control without remounting or clearing the live form", async () => {
  const s = await mount(); await act(async () => s.form().props.toggle());
  expect(s.form().props.theme).toBe("dark"); expect(s.form().props.value).toBe("draft-secret");
  expect(mocks.mounts).toBe(1); expect(mocks.unmounts).toBe(0); expect(mocks.save).toHaveBeenCalledOnce();
  expect(mocks.timing).toHaveBeenCalledWith(Math.hypot(310, 724), expect.objectContaining({ duration: 380 }));
  expect(mocks.dispose).toHaveBeenCalledOnce(); expect(tree!.root.findAllByType("Canvas" as any)).toHaveLength(0);
});
it("does not apply a late capture after changing the active scope", async () => {
  let resolve!: (image: unknown) => void;
  mocks.capture.mockImplementation(() => new Promise(r => { resolve = r; }));
  const s = await mount(); await act(async () => s.form().props.toggle());
  await act(async () => tree!.update(s.content("b")));
  await act(async () => resolve({ dispose: mocks.dispose }));
  expect(s.form().props.theme).toBe("light"); expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.dispose).toHaveBeenCalledOnce();
});
it("still changes the theme when the native surface cannot be captured", async () => {
  mocks.capture.mockRejectedValue(new Error("Surface unavailable"));
  const s = await mount(); await act(async () => s.form().props.toggle());
  expect(s.form().props.theme).toBe("dark"); expect(mocks.save).toHaveBeenCalledOnce(); expect(s.form().props.value).toBe("draft-secret");
});
