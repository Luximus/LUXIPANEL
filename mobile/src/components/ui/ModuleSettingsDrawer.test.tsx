import React, { useState } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ width: 390, dismiss: vi.fn(), cancel: vi.fn(() => false), mounts: vi.fn(), autoFinish: true, reduced: false, animations: [] as { toValue: number; stopped: boolean; finish: () => void }[] }));
vi.mock("react-native-gesture-handler", () => ({ GestureHandlerRootView: "GestureRoot", ScrollView: "ScrollView" }));
vi.mock("react-native", () => ({ Easing: { in: (fn: unknown) => fn, out: (fn: unknown) => fn, cubic: "cubic", quad: "quad" }, AccessibilityInfo: { isReduceMotionEnabled: async () => mocks.reduced, addEventListener: () => ({ remove() {} }) },
  View: "View", Text: "Text", TextInput: "Input", ScrollView: "ScrollView", Pressable: "Pressable", Modal: "NativeModal", KeyboardAvoidingView: "KAV",
  Keyboard: { dismiss: mocks.dismiss }, Platform: { OS: "android" }, useWindowDimensions: () => ({ width: mocks.width, height: 844 }),
  StyleSheet: { create: (s: unknown) => s, absoluteFill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 } },
  Animated: { View: "AnimatedView", Value: class { interpolate(config: unknown) { return config; } }, timing: (_value: unknown, options: {toValue: number; duration: number}) => {
    let callback: any;
    const animation = { toValue: options.toValue, stopped: false, finish: () => { if (!animation.stopped) callback?.({ finished: true }); } };
    mocks.animations.push(animation);
    return { start: (done: any) => { callback = done; if (mocks.autoFinish || options.duration === 0) animation.finish(); }, stop() { animation.stopped = true; callback?.({ finished: false }); } };
  } },
}));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 20 }) }));
vi.mock("lucide-react-native", () => ({ Settings2: "Icon", X: "Icon" }));
vi.mock("../../hooks/useTheme", () => ({ useTheme: () => ({ theme: "dark" }) }));
vi.mock("../../theme/colors", () => ({ getThemeTokens: () => ({ bgCardSolid: "#22272e", border: "#333" }) }));
vi.mock("../../i18n", () => ({ getMessages: () => ({ common: { close: "Cerrar" } }) }));
vi.mock("../../lib/inline-edit-back", () => ({ cancelActiveInlineEdit: mocks.cancel }));
import { FormDrawer } from "./FormDrawer";
import { ModuleSettingsDrawer, SettingsColumns, SettingsSectionBody } from "./ModuleSettingsDrawer";
import { NativeModuleContext, ScopedNativeModal, dismissNativeModuleDialog } from "../../screens/main/native-module-context";
import { NativeOverlayHost } from "../../screens/main/NativeOverlayHost";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReactTestRenderer;
beforeEach(() => { mocks.width = 390; mocks.autoFinish = true; mocks.reduced = false; mocks.animations = []; vi.clearAllMocks(); mocks.cancel.mockReturnValue(false); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });
const context = { key: "box:settings", visible: true, insideWorkspace: true };
function Draft() {
  const [value, setValue] = useState("");
  React.useEffect(() => { mocks.mounts(); }, []);
  return React.createElement("Input", { value, onChangeText: setValue });
}
it("keeps navigation and content side by side at phone widths and uses a full-height right drawer", async () => {
  await act(async () => { tree = create(<NativeModuleContext.Provider value={context}><ModuleSettingsDrawer visible onClose={() => {}} title="Configuración" language="es"><SettingsColumns language="es" value="general" onChange={() => {}} sections={[{ key: "general", label: "General", icon: <React.Fragment /> }]}><Draft /></SettingsColumns></ModuleSettingsDrawer></NativeModuleContext.Provider>); });
  const sheet = tree.root.findAllByType("AnimatedView" as any).find(node => node.props.style?.some?.((s: any) => s?.height === "100%"))!;
  expect(sheet.props.style).toContainEqual(expect.objectContaining({ width: 390, paddingTop: 0, paddingBottom: 20 }));
  expect(tree.root.findByProps({ testID: "module-settings-columns" }).props.style.flexDirection).toBe("row");
  expect(tree.root.findByProps({ testID: "module-settings-content" }).props.style.minWidth).toBe(0);
  const nav = tree.root.findAllByType("View" as any).find(node => node.props.style?.some?.((s: any) => s?.width === 56));
  expect(nav).toBeDefined();
  await act(async () => tree.root.findByProps({ testID: "module-settings-columns" }).props.onLayout({ nativeEvent: { layout: { width: 800 } } }));
  expect(tree.root.findAllByType("View" as any).some(node => node.props.style?.some?.((s: any) => s?.width === 208))).toBe(true);
});
it("retains drafts across close/reopen and registers back only for the visible module", async () => {
  const close = vi.fn();
  const render = (visible: boolean, moduleVisible = true) => <NativeOverlayHost><NativeModuleContext.Provider value={{ ...context, visible: moduleVisible }}><ModuleSettingsDrawer visible={visible} onClose={close} title="Ajustes" language="es"><Draft /></ModuleSettingsDrawer></NativeModuleContext.Provider></NativeOverlayHost>;
  await act(async () => { tree = create(render(true)); });
  await act(async () => tree.root.findByType("Input" as any).props.onChangeText("borrador"));
  mocks.cancel.mockReturnValueOnce(true);
  await act(async () => { expect(dismissNativeModuleDialog(context.key)).toBe(true); });
  expect(close).not.toHaveBeenCalled();
  await act(async () => { expect(dismissNativeModuleDialog(context.key)).toBe(true); });
  expect(close).toHaveBeenCalledOnce();
  await act(async () => tree.update(render(false)));
  expect(dismissNativeModuleDialog(context.key)).toBe(false);
  await act(async () => tree.update(render(true)));
  expect(tree.root.findByType("Input" as any).props.value).toBe("borrador");expect(mocks.mounts).toHaveBeenCalledOnce();
  await act(async () => tree.update(render(true, false)));
  expect(dismissNativeModuleDialog(context.key)).toBe(false);
});
it("lazily mounts sections and closes nested dialogs before the settings drawer", async () => {
  const close = vi.fn(), innerClose = vi.fn();
  const render = (section: string) => <NativeModuleContext.Provider value={context}><ModuleSettingsDrawer visible onClose={close} title="Ajustes" language="es"><SettingsSectionBody active={section === "general"}><Draft /><ScopedNativeModal visible onRequestClose={innerClose}><React.Fragment /></ScopedNativeModal></SettingsSectionBody><SettingsSectionBody active={section === "other"}><Draft /></SettingsSectionBody></ModuleSettingsDrawer></NativeModuleContext.Provider>;
  await act(async () => { tree = create(render("general")); });expect(mocks.mounts).toHaveBeenCalledOnce();
  await act(async () => { dismissNativeModuleDialog(context.key); });expect(innerClose).toHaveBeenCalledOnce();expect(close).not.toHaveBeenCalled();
  await act(async () => tree.update(render("other")));expect(mocks.mounts).toHaveBeenCalledTimes(2);
  await act(async () => { dismissNativeModuleDialog(context.key); });expect(close).toHaveBeenCalledOnce();
  await act(async () => tree.update(render("general")));expect(mocks.mounts).toHaveBeenCalledTimes(2);
});

it.each([390, 768, 1440])("opens forms in a full-height right drawer at width %s with a fixed footer", async (width) => {
  mocks.width = width;
  const close = vi.fn();
  await act(async () => { tree = create(<NativeModuleContext.Provider value={context}>
    <FormDrawer visible onClose={close} title="Nuevo usuario" language="es" footer={React.createElement("save-action")}><Draft /></FormDrawer>
  </NativeModuleContext.Provider>); });
  expect(tree.root.findAllByProps({testID:"module-settings-drawer"})).toHaveLength(0);
  const sheet = tree.root.findByProps({testID:"module-form-sheet"});
  expect(sheet.props.style).toContainEqual(expect.objectContaining({height:"100%"}));
  expect(sheet.props.style).toContainEqual(expect.objectContaining({width:width <= 1024 ? width : 640,paddingBottom:20}));
  expect(tree.root.findByProps({testID:"module-form-backdrop"}).props.onPress).toBeUndefined();
  expect(tree.root.findByProps({testID:"module-form-content"}).findAllByType("save-action" as any)).toHaveLength(0);
  expect(tree.root.findByProps({testID:"module-form-footer"}).findAllByType("save-action" as any)).toHaveLength(1);
  expect(close).not.toHaveBeenCalled();
});
it("closes confirmation, form and settings in order while retaining the underlying draft", async () => {
  const settingsClose = vi.fn();
  function Nested() {
    const [form, setForm] = useState(true), [confirm, setConfirm] = useState(true);
    return <NativeOverlayHost><NativeModuleContext.Provider value={context}>
      <ModuleSettingsDrawer visible onClose={settingsClose} title="Usuarios" language="es">
        <FormDrawer visible={form} onClose={()=>setForm(false)} title="Editar" language="es">
          <Draft /><ScopedNativeModal layer="confirmation" visible={confirm} onRequestClose={()=>setConfirm(false)}><React.Fragment /></ScopedNativeModal>
        </FormDrawer>
        {React.createElement("reopen-form",{onPress:()=>setForm(true)})}
      </ModuleSettingsDrawer>
    </NativeModuleContext.Provider></NativeOverlayHost>;
  }
  await act(async () => {tree=create(<Nested/>);});
  await act(async () => tree.root.findByType("Input" as any).props.onChangeText("sin guardar"));
  await act(async () => {expect(dismissNativeModuleDialog(context.key)).toBe(true);});
  expect(tree.root.findByType(FormDrawer).props.visible).toBe(true);
  expect(settingsClose).not.toHaveBeenCalled();
  await act(async () => {expect(dismissNativeModuleDialog(context.key)).toBe(true);});
  expect(tree.root.findByType(FormDrawer).props.visible).toBe(false);
  expect(settingsClose).not.toHaveBeenCalled();
  await act(async () => tree.root.findByType("reopen-form" as any).props.onPress());
  expect(tree.root.findByType("Input" as any).props.value).toBe("sin guardar");
  expect(mocks.mounts).toHaveBeenCalledOnce();
});

const layers = () => tree.root.findAllByProps({ testID: "native-overlay-layer" });
const finishAnimations = async () => act(async () => { [...mocks.animations].forEach(animation => animation.finish()); });
it.each(["header", "cancel", "saved", "back"])("finishes the exit on %s before removing a conditionally mounted form", async (action) => {
  mocks.autoFinish = false;
  const settingsClose = vi.fn();
  function Owner() {
    const [form, setForm] = useState(true);
    return <NativeOverlayHost><NativeModuleContext.Provider value={context}>
      <ModuleSettingsDrawer visible onClose={settingsClose} title="Settings" language="es">
        <Draft />
        {form && <FormDrawer visible onClose={() => setForm(false)} title="Form" language="es" footer={React.createElement("cancel-form", { onPress: () => setForm(false) })}>
          {React.createElement("saved-form", { onSaved: () => setForm(false) })}
        </FormDrawer>}
      </ModuleSettingsDrawer>
    </NativeModuleContext.Provider></NativeOverlayHost>;
  }
  await act(async () => { tree = create(<Owner />); });
  await finishAnimations();
  await act(async () => tree.root.findByType("Input" as any).props.onChangeText("preservar"));
  expect(layers().map(node => node.props.pointerEvents)).toEqual(["none", "auto"]);
  expect(tree.root.findByProps({ testID: "module-form-content" }).props.nestedScrollEnabled).toBe(true);
  await act(async () => {
    if (action === "back") dismissNativeModuleDialog(context.key);
    else if (action === "header") tree.root.findByProps({ testID: "module-form-drawer" }).findByProps({ accessibilityRole: "button", accessibilityLabel: "Cerrar" }).props.onPress();
    else if (action === "cancel") tree.root.findByType("cancel-form" as any).props.onPress();
    else tree.root.findByType("saved-form" as any).props.onSaved();
  });
  // Owner is gone, but the animated surface still blocks the underlying drawer.
  expect(tree.root.findAllByType(FormDrawer)).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: "module-form-sheet" })).toHaveLength(1);
  expect(layers().map(node => node.props.pointerEvents)).toEqual(["none", "auto"]);
  expect(layers()[1].findByType("GestureRoot" as any).props.pointerEvents).toBe("none");
  await act(async () => { dismissNativeModuleDialog(context.key); });
  expect(settingsClose).not.toHaveBeenCalled();
  await finishAnimations();
  expect(tree.root.findAllByProps({ testID: "module-form-sheet" })).toHaveLength(0);
  expect(layers().map(node => node.props.pointerEvents)).toEqual(["auto"]);
  expect(tree.root.findByType("Input" as any).props.value).toBe("preservar");
  expect(mocks.mounts).toHaveBeenCalledOnce();
});
it("cancels an interrupted exit and keeps the reopened form and its draft", async () => {
  mocks.autoFinish = false;
  const render = (visible: boolean) => <NativeOverlayHost><NativeModuleContext.Provider value={context}>
    <FormDrawer visible={visible} onClose={() => {}} title="Edit" language="es"><Draft /></FormDrawer>
  </NativeModuleContext.Provider></NativeOverlayHost>;
  await act(async () => { tree = create(render(true)); });
  await finishAnimations();
  await act(async () => tree.root.findByType("Input" as any).props.onChangeText("borrador"));
  await act(async () => tree.update(render(false)));
  const exit = mocks.animations.at(-1)!;
  expect(exit.toValue).toBe(0);
  await act(async () => tree.update(render(true)));
  expect(exit.stopped).toBe(true);
  await finishAnimations();
  expect(layers()[0].props.pointerEvents).toBe("auto");
  expect(tree.root.findByType("Input" as any).props.value).toBe("borrador");
});
it("removes retained layers immediately when reduced motion is enabled", async () => {
  mocks.autoFinish = false; mocks.reduced = true;
  const render = (visible: boolean) => <NativeOverlayHost><NativeModuleContext.Provider value={context}>
    {visible && <FormDrawer visible onClose={() => {}} language="es"><Draft /></FormDrawer>}
  </NativeModuleContext.Provider></NativeOverlayHost>;
  await act(async () => { tree = create(render(true)); });
  await act(async () => tree.update(render(false)));
  expect(layers()).toHaveLength(0);
});
