import React, { useState } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("react-native-gesture-handler", () => ({ GestureHandlerRootView: "GestureRoot", ScrollView: "ScrollView" }));
vi.mock("react-native", () => ({
  View: "View", Text: "Text", Pressable: "Pressable", ScrollView: "ScrollView", KeyboardAvoidingView: "KAV",
  Modal: "NativeModal", ActivityIndicator: "Spinner", Platform: { OS: "android" },
  StyleSheet: { create: (value: unknown) => value, absoluteFill: { position: "absolute" } },
}));
vi.mock("lucide-react-native", () => ({ Trash2: "Trash", ShieldCheck: "Shield", X: "Close" }));
vi.mock("../../hooks/useTheme", () => ({ useTheme: () => ({ theme: "dark" }) }));
vi.mock("../../theme/panel-palette", () => ({ getActivePalette: () => null }));
vi.mock("../../lib/session-state", () => ({ loadSessionState: () => ({ language: "es" }) }));
import { ConfirmationModal } from "./ConfirmationModal";
import { useConfirmation } from "./useConfirmation";
import { NativeOverlayHost } from "../../screens/main/NativeOverlayHost";
import { NativeModuleContext, ScopedNativeModal, dismissNativeConfirmation, dismissNativeModuleDialog } from "../../screens/main/native-module-context";
import { registerInlineEditCancel, unregisterInlineEditCancel } from "../../lib/inline-edit-back";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReactTestRenderer;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });
const key = "confirmation-regression";
function Owner({ action, cancel, closeDrawer, closeForm }: { action: () => unknown; cancel: () => void; closeDrawer: () => void; closeForm: () => void }) {
  const { askConfirmation, confirmation } = useConfirmation("es");
  const [draft, setDraft] = useState("");
  return <>
    {confirmation}
    <ScopedNativeModal visible onRequestClose={closeDrawer}>
      <ScopedNativeModal visible onRequestClose={closeForm}>
        {React.createElement("Draft", { value: draft, onChange: setDraft })}
        {React.createElement("Request", { onPress: () => askConfirmation("Eliminar proyecto", "Mi proyecto", [
          { text: "Cancelar", style: "cancel", onPress: cancel },
          { text: "Eliminar", style: "destructive", onPress: action },
        ]) })}
      </ScopedNativeModal>
    </ScopedNativeModal>
  </>;
}
async function mount(action = vi.fn()) {
  const cancel = vi.fn(), closeDrawer = vi.fn(), closeForm = vi.fn();
  await act(async () => { tree = create(<NativeOverlayHost><NativeModuleContext.Provider value={{ key, visible: true }}>
    <Owner action={action} cancel={cancel} closeDrawer={closeDrawer} closeForm={closeForm} />
  </NativeModuleContext.Provider></NativeOverlayHost>); });
  await act(async () => tree.root.findByType("Draft" as any).props.onChange("sin guardar"));
  await act(async () => tree.root.findByType("Request" as any).props.onPress());
  return { action, cancel, closeDrawer, closeForm };
}
const modal = () => tree.root.findByType(ConfirmationModal);
const press = (label: string) => tree.root.findAllByType("Pressable" as any).find(node => node.findAllByType("Text" as any).some(text => text.children.includes(label)))!;
const order = (node: any) => { for (let p = node; p; p = p.parent) { const style = p.props.style; if (Array.isArray(style) && style[0]?.zIndex) return style[0].zIndex; } return 0; };

it.each(["back", "cancel", "backdrop", "close"])("%s closes only the confirmation and preserves the nested form and draft", async (method) => {
  const handlers = await mount();
  const inline = vi.fn(); registerInlineEditCancel(inline);
  expect(order(tree.root.findByProps({ testID: "confirmation-card" }))).toBeGreaterThan(order(tree.root.findByType("Draft" as any)));
  await act(async () => {
    if (method === "back") expect(dismissNativeConfirmation(key)).toBe(true);
    else if (method === "cancel") press("Cancelar").props.onPress();
    else tree.root.findByProps({ testID: `confirmation-${method}` }).props.onPress({ stopPropagation() {} });
  });
  expect(tree.root.findAllByType(ConfirmationModal)).toHaveLength(0);
  expect(handlers.cancel).toHaveBeenCalledOnce();
  expect(handlers.action).not.toHaveBeenCalled();
  expect(handlers.closeDrawer).not.toHaveBeenCalled();
  expect(handlers.closeForm).not.toHaveBeenCalled();
  expect(tree.root.findByType("Draft" as any).props.value).toBe("sin guardar");
  expect(inline).not.toHaveBeenCalled(); unregisterInlineEditCancel(inline);
  expect(dismissNativeModuleDialog(key)).toBe(true);
  expect(handlers.closeForm).toHaveBeenCalledOnce();
});

it("submits once, blocks dismissal while pending, and keeps the parent form after success", async () => {
  let finish!: () => void;
  const action = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  const handlers = await mount(action);
  const submit = press("Eliminar").props.onPress;
  await act(async () => { submit(); submit(); });
  expect(action).toHaveBeenCalledOnce();
  expect(press("Cancelar").props.disabled).toBe(true);
  await act(async () => { dismissNativeConfirmation(key); });
  expect(modal().props.visible).toBe(true);
  await act(async () => finish());
  expect(tree.root.findAllByType(ConfirmationModal)).toHaveLength(0);
  expect(handlers.closeForm).not.toHaveBeenCalled();
  expect(tree.root.findByType("Draft" as any).props.value).toBe("sin guardar");
});

it("shows a deletion error inside the modal and permits retry without losing the underlying form", async () => {
  const action = vi.fn().mockRejectedValueOnce(new Error("Sin conexión")).mockResolvedValueOnce(undefined);
  await mount(action);
  await act(async () => press("Eliminar").props.onPress());
  expect(modal().props.visible).toBe(true);
  expect(modal().props.error).toBe("Sin conexión");
  expect(tree.root.findAllByType("Text" as any).some(node => node.children.includes("Sin conexión"))).toBe(true);
  await act(async () => press("Eliminar").props.onPress());
  expect(action).toHaveBeenCalledTimes(2);
  expect(tree.root.findAllByType(ConfirmationModal)).toHaveLength(0);
  expect(tree.root.findByType("Draft" as any).props.value).toBe("sin guardar");
});

it('handles a controlled async callback without requiring an external confirmation hook',async()=>{
 let reject!:(error:Error)=>void;const cancel=vi.fn();const submit=vi.fn().mockImplementationOnce(()=>new Promise((_r,j)=>{reject=j;})).mockResolvedValue(undefined);
 await act(async()=>{tree=create(<ConfirmationModal visible title="Eliminar" confirmLabel="Aplicar" cancelLabel="Cancelar" onConfirm={submit} onCancel={cancel}/>);});
 await act(async()=>{press('Aplicar').props.onPress();press('Aplicar').props.onPress();});expect(submit).toHaveBeenCalledOnce();
 await act(async()=>tree.root.findByProps({testID:'confirmation-close'}).props.onPress({stopPropagation(){}}));expect(cancel).not.toHaveBeenCalled();
 await act(async()=>reject(new Error('No autorizado')));expect(JSON.stringify(tree.toJSON())).toContain('No tienes permiso para realizar esta operación.');expect(press('Cancelar').props.accessibilityState.disabled).toBe(false);
 await act(async()=>press('Aplicar').props.onPress());expect(submit).toHaveBeenCalledTimes(2);expect(JSON.stringify(tree.toJSON())).not.toContain('No tienes permiso para realizar esta operación.');
});
