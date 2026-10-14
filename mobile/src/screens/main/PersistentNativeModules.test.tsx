import React, { useEffect, useState } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
const registry = vi.hoisted(() => ({
  revision: 0,
  width: 390,
  reduced: false,
  timings: vi.fn(),
  dismiss: vi.fn(),
  listeners: new Set<() => void>(),
  mounts: vi.fn(),
  unmounts: vi.fn(),
  requests: vi.fn(),
}));
vi.mock("react-native-gesture-handler", () => ({ GestureHandlerRootView: "GestureRoot", ScrollView: "ScrollView" }));
vi.mock("react-native", () => ({ Easing: { in: (fn: unknown) => fn, out: (fn: unknown) => fn, cubic: "cubic", quad: "quad" },
  View: "native-view", Modal: "native-modal", Pressable: "Pressable", Keyboard: { dismiss: registry.dismiss },
  StyleSheet: { create: (s: unknown) => s, absoluteFill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 } },
  useWindowDimensions: () => ({ width: registry.width, height: 844 }),
  AccessibilityInfo: { isReduceMotionEnabled: async () => registry.reduced, addEventListener: () => ({ remove() {} }) },
  Animated: { View: "AnimatedView", Value: class { interpolate(config: unknown) { return config; } }, timing: (_value: unknown, options: unknown) => { registry.timings(options); return { start: (callback: any) => callback?.({ finished: true }), stop() {} }; } },
}));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 20 }) }));
vi.mock("../../hooks/useTheme", () => ({ useTheme: () => ({ theme: "dark" }) }));
vi.mock("../../theme/colors", () => ({ getThemeTokens: () => ({ bgCardSolid: "#22272e", border: "#333" }) }));
vi.mock("../../lib/session-state", () => ({ loadSessionState: () => ({ language: "es" }) }));
vi.mock("../../i18n", () => ({ getMessages: () => ({ common: { close: "Cerrar" } }) }));
vi.mock("../../api/serverApi", () => ({
  getDirect: () => ({ baseUrl: "https://box.example" }),
  getDirectSessionRevision: () => registry.revision,
  subscribeDirectSessions: (fn: () => void) => {
    registry.listeners.add(fn);
    return () => registry.listeners.delete(fn);
  },
}));
vi.mock("./native-module-view", () => ({
  NativeModuleView: ({ onBack }: { onBack: () => void }) => {
    const context = React.useContext(NativeModuleContext);
    const [draft, setDraft] = useState("");
    useEffect(() => {
      registry.mounts();
      registry.requests();
      return () => {
        registry.unmounts();
      };
    }, []);
    return React.createElement("test-form", {
      draft, context,
      onChange: setDraft,
      onBack,
    });
  },
}));
vi.mock("./NativeSessionBoundary", () => ({ NativeSessionBoundary: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("../../components/server/LiveDataStatus", () => ({ LiveDataStatus: () => null }));
import { NativeModuleContext } from "./native-module-context";
import { PersistentNativeModules } from "./PersistentNativeModules";
import type { NativeModuleSession } from "./shell-types";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReactTestRenderer | undefined;
afterEach(async () => {
  if (tree) await act(async () => tree!.unmount());
  tree = undefined;
  registry.revision = 0;
  registry.width = 390;
  registry.reduced = false;
  registry.listeners.clear();
  vi.clearAllMocks();
});
describe("React Native persistent drawers", () => {
  it("keeps a draft and the same mounted form through close/reopen and clears it on logout", async () => {
    const active = { panelId: "a", moduleId: "chat" } as NativeModuleSession;
    const close = vi.fn();
    await act(async () => {
      tree = create(
        <PersistentNativeModules active={active} token="jwt" onClose={close} />,
      );
    });
    const form = tree!.root.findByType("test-form" as any);
    await act(async () => form.props.onChange("Sin guardar"));
    await act(async () =>
      tree!.update(
        <PersistentNativeModules active={null} token="jwt" onClose={close} />,
      ),
    );
    expect(tree!.root.findByType("test-form" as any).props.draft).toBe(
      "Sin guardar",
    );
    expect(registry.unmounts).not.toHaveBeenCalled();
    expect(registry.requests).toHaveBeenCalledTimes(1);
    expect(
      tree!.root.findByProps({ testID: "native-module-drawer" }).props.pointerEvents,
    ).toBe("none");
    await act(async () =>
      tree!.update(
        <PersistentNativeModules active={active} token="jwt" onClose={close} />,
      ),
    );
    expect(tree!.root.findByType("test-form" as any).props.draft).toBe(
      "Sin guardar",
    );
    expect(registry.mounts).toHaveBeenCalledTimes(1);
    await act(async () => {
      registry.revision++;
      for (const listener of registry.listeners) listener();
    });
    expect(registry.unmounts).not.toHaveBeenCalled();
    await act(async () => tree!.update(<PersistentNativeModules active={active} token="refreshed-jwt" onClose={close} />));
    expect(tree!.root.findByType("test-form" as any).props.draft).toBe("Sin guardar");
    await act(async () => tree!.update(<PersistentNativeModules active={null} token="" onClose={close} />));
    expect(registry.unmounts).toHaveBeenCalledTimes(1);
  });
});

it("opens every module from the left, keeps views and drafts when switching modules, and honors a repeated submenu command", async () => {
  const close = vi.fn();
  const render = (moduleId: string | null, selectedView?: string, viewRevision?: number) => <PersistentNativeModules active={moduleId ? { panelId: "a", moduleId, selectedView, viewRevision } as NativeModuleSession : null} token="jwt" onClose={close} />;
  await act(async () => { tree = create(render("terminal", "new", 1)); });
  const original = tree!.root.findByType("test-form" as any);
  expect(original.props.context.viewRevision).toBe(1); // Opening New Terminal must not add a second PTY.
  const sheet = tree!.root.findByProps({ testID: "native-module-sheet" });
  expect(sheet.props.style).toContainEqual(expect.objectContaining({ width: 390, transform: [{ translateX: { inputRange: [0, 1], outputRange: [-390, 0] } }] }));
  await act(async () => { original.props.onChange("draft"); original.props.context.selectView("consoles"); });
  await act(async () => tree!.update(render("users")));
  expect(original.props.context.visible).toBe(false);
  expect(tree!.root.findAllByType("test-form" as any)).toHaveLength(2);
  await act(async () => tree!.update(render("terminal")));
  expect(original.props.draft).toBe("draft");
  expect(original.props.context.selectedView).toBe("consoles");
  expect(registry.mounts).toHaveBeenCalledTimes(2);
  expect(registry.unmounts).not.toHaveBeenCalled();
  await act(async () => tree!.update(render("terminal", "new", 2)));
  expect(original.props.context.selectedView).toBe("new");
  const revision = original.props.context.viewRevision;
  await act(async () => tree!.update(render("terminal", "new", 3)));
  expect(original.props.context.viewRevision).toBe(revision + 1);
  const drawer = tree!.root.findAllByProps({ testID: "native-module-drawer" }).find(node => node.props.pointerEvents === "auto")!;
  await act(async () => drawer.findByProps({ testID: "native-module-backdrop" }).props.onPress());
  expect(close).toHaveBeenCalledOnce();expect(registry.dismiss).toHaveBeenCalled();
});
it("uses the web desktop width and reduced motion without disposing hidden modules", async () => {
  registry.width = 1200; registry.reduced = true;
  const active = { panelId: "a", moduleId: "users" } as NativeModuleSession;
  await act(async () => { tree = create(<PersistentNativeModules active={active} token="jwt" onClose={() => {}} />); });
  expect(tree!.root.findByProps({ testID: "native-module-sheet" }).props.style).toContainEqual(expect.objectContaining({ width: 1080 }));
  expect(registry.timings).toHaveBeenLastCalledWith(expect.objectContaining({ duration: 0, toValue: 1 }));
  await act(async () => tree!.update(<PersistentNativeModules active={active} visible={false} token="jwt" onClose={() => {}} />));
  expect(tree!.root.findByProps({ testID: "native-module-drawer" }).props.accessibilityElementsHidden).toBe(true);
  expect(registry.unmounts).not.toHaveBeenCalled();
});
