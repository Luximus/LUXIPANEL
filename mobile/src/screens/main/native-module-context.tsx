import React, { createContext, useContext, useLayoutEffect, useRef, useState } from "react";
import { Modal as RNModal, View, type ModalProps } from "react-native";
import { NativeModuleContext } from "./native-module-visibility";
import { OverlayExitingContext, useNativeOverlay, type OverlayExit } from "./NativeOverlayHost";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ModuleUiContext, useModuleUi } from "../../components/ui/ModuleUi";
export { NativeModuleContext, useNativeModuleVisible } from "./native-module-visibility";
let nextDialog = 0;
const DialogDepth = createContext(0);
type DialogEntry = { id: symbol; depth: number; priority: number; close: () => void; setOrder: (order: number, top: boolean) => void };
const dialogs = new Map<string, DialogEntry[]>();
function orderDialogs(key: string, stack: DialogEntry[]) {
  stack.sort((a, b) => a.priority - b.priority || a.depth - b.depth);
  stack.forEach((entry, index) => entry.setOrder(index, index === stack.length - 1));
  if (stack.length) dialogs.set(key, stack);
  else dialogs.delete(key);
}
export function dismissNativeModuleDialog(key: string): boolean {
  const entry = dialogs.get(key)?.at(-1);
  if (!entry) return false;
  entry.close();
  return true;
}
export function dismissNativeConfirmation(key: string): boolean {
  const entry = dialogs.get(key)?.at(-1);
  if (!entry?.priority) return false;
  entry.close();
  return true;
}
/** This surface lives in the host, including during a conditional owner's exit. */
function ScopedModalSurface({ id, context, depth, layer, visible, interactive, onRequestClose, children }: {
  id: symbol; context: NonNullable<React.ContextType<typeof NativeModuleContext>>;
  depth: number; layer?: "confirmation"; visible?: boolean; interactive: boolean;
  onRequestClose?: ModalProps["onRequestClose"]; children?: React.ReactNode;
}) {
  const exiting = useContext(OverlayExitingContext);
  const [position, setPosition] = useState({ order: 0, top: false });
  const close = useRef(onRequestClose);
  close.current = exiting || !interactive ? undefined : onRequestClose;
  const shown = context.visible && visible !== false;
  useLayoutEffect(() => {
    if (!shown) return;
    const entry: DialogEntry = {
      id, depth, priority: layer === "confirmation" ? 1 : 0,
      close: () => close.current?.({} as any),
      setOrder: (order, top) => setPosition(old => old.order === order && old.top === top ? old : { order, top }),
    };
    const stack = dialogs.get(context.key) || [];
    stack.push(entry);
    orderDialogs(context.key, stack);
    return () => orderDialogs(context.key, dialogs.get(context.key)?.filter(item => item.id !== id) || []);
  }, [context.key, shown, depth, layer, id]);
  const active = shown && position.top;
  const zIndex = (layer === "confirmation" ? 20000 : 10000) + position.order;
  return <View
    testID="native-overlay-layer"
    collapsable={false}
    style={[{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex, elevation: 32 + position.order }, !shown && { display: "none" }]}
    pointerEvents={active ? "auto" : "none"}
    accessibilityViewIsModal={active}
    accessibilityElementsHidden={!active || exiting}
    importantForAccessibility={active && !exiting ? "yes" : "no-hide-descendants"}
  >
    <GestureHandlerRootView style={{ flex: 1, minHeight: 0, minWidth: 0 }} pointerEvents={active && !exiting && interactive ? "auto" : "none"}>
      {children}
    </GestureHandlerRootView>
  </View>;
}

/** Internal overlays stay mounted with their module, including draft forms. */
export function ScopedNativeModal({ layer, exitAnimation, interactive = true, ...props }: ModalProps & { layer?: "confirmation"; exitAnimation?: OverlayExit; interactive?: boolean }) {
  const moduleUi = useModuleUi();
  const context = useContext(NativeModuleContext);
  const depth = useContext(DialogDepth);
  const id = useRef(Symbol(`dialog-${nextDialog++}`));
  const content = React.useMemo(() => context ? (
    <NativeModuleContext.Provider value={context}>
      <ModuleUiContext.Provider value={moduleUi}>
        <DialogDepth.Provider value={depth + 1}>
          <ScopedModalSurface id={id.current} context={context} depth={depth} layer={layer} visible={props.visible} interactive={interactive} onRequestClose={props.onRequestClose}>
            {props.children}
          </ScopedModalSurface>
        </DialogDepth.Provider>
      </ModuleUiContext.Provider>
    </NativeModuleContext.Provider>
  ) : null, [context, moduleUi, depth, layer, interactive, props.visible, props.onRequestClose, props.children]);
  const hosted = useNativeOverlay(id.current, content, context?.visible && props.visible !== false ? exitAnimation : undefined);
  if (!context) return <RNModal {...props}><DialogDepth.Provider value={depth + 1}><GestureHandlerRootView style={{ flex: 1 }}>{props.children}</GestureHandlerRootView></DialogDepth.Provider></RNModal>;
  return hosted ? null : content;
}
