// Botón atrás de Android por pestaña (extraído verbatim de MainTab.tsx; se
// invoca en el mismo punto del componente — mismo orden de hooks). Resuelve la
// prioridad: módulo nativo > picker > módulo webview > edición inline > sheet >
// drawers > modales > consola > chat > vista SSH > historial de vistas.
import { dismissNativeModuleDialog } from "./native-module-context";
import React, { useEffect } from "react";
import { BackHandler, Platform } from "react-native";
import type { useMainTabController } from "../../hooks/useMainTabController";
import { cancelActiveInlineEdit } from "../../lib/inline-edit-back";
import type { View } from "../../features/app/types";
import type { NativeModuleSession } from "./shell-types";

export function useTabBackHandler({
  ctrl, isActiveTab, nativeModule, setNativeModule, modulePickerOpen, closeModulePicker,
  moduleOverlayVisible, activeModuleId, hideModule, actionsSheetOpen, closeActionsSheet,
  serverDrawerOpen, closeServerDrawer, blogDrawerOpen, onCloseBlogDrawer,
  consoleOverlayVisible, minimizeConsoles, chatOpen, closePanelChat,
  navigateToView, viewHistoryRef,
}: {
  ctrl: ReturnType<typeof useMainTabController>;
  isActiveTab: boolean;
  nativeModule: NativeModuleSession | null;
  setNativeModule: React.Dispatch<React.SetStateAction<NativeModuleSession | null>>;
  modulePickerOpen: boolean;
  closeModulePicker: () => void;
  moduleOverlayVisible: boolean;
  activeModuleId: string | null;
  hideModule: () => void;
  actionsSheetOpen: boolean;
  closeActionsSheet: () => void;
  serverDrawerOpen: boolean;
  closeServerDrawer: () => void;
  blogDrawerOpen: boolean;
  onCloseBlogDrawer: () => void;
  consoleOverlayVisible: boolean;
  minimizeConsoles: () => void;
  chatOpen: boolean;
  closePanelChat: () => void;
  navigateToView: (next: View) => void;
  viewHistoryRef: React.MutableRefObject<View[]>;
}) {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      // Solo la pestaña ACTIVA responde al botón atrás: los MainTab ocultos
      // (display:none) también registran este handler y, sin el guard, el
      // estado de otra pestaña podía consumir el evento.
      if (!isActiveTab) return false;
      // Regla de modales: el botón atrás de Android NO debe descartar ningún
      // modal (perdería lo que el usuario está escribiendo). Si hay un modal
      // abierto, consumimos el evento (return true) SIN cerrarlo: el cierre
      // solo ocurre con los botones internos del modal (X, Cancelar, Aceptar).
      // Pantalla de módulo NATIVA abierta: atrás la cierra (vuelve al carousel).
      if (ctrl.directConnectPanel && !nativeModule) {
        if (dismissNativeModuleDialog(`${ctrl.directConnectPanel.id}:${ctrl.directConnectModuleId}`)) return true;
        if (cancelActiveInlineEdit()) return true;
        ctrl.closeDirectConnect();
        return true;
      }
      if (nativeModule) {
        if (dismissNativeModuleDialog(`${nativeModule.panelId}:${nativeModule.moduleId}`)) return true;
        if (cancelActiveInlineEdit()) return true;
        setNativeModule(null);
        return true;
      }
      if (modulePickerOpen) {
        closeModulePicker();
        return true;
      }
      // Módulo abierto a pantalla completa: atrás = OCULTAR (la webview sigue
      // viva/caliente para reabrir instantáneo); vuelve al carousel.
      if (moduleOverlayVisible && activeModuleId) {
        hideModule();
        return true;
      }
      // Edición inline en curso dentro de un drawer (renombrar categoría/tag,
      // pestaña o consola): atrás la CANCELA (descarta el borrador) sin cerrar
      // el drawer que la contiene. Ver lib/inline-edit-back.
      if (cancelActiveInlineEdit()) return true;
      if (actionsSheetOpen) {
        closeActionsSheet();
        return true;
      }
      if (serverDrawerOpen) {
        closeServerDrawer();
        return true;
      }
      if (blogDrawerOpen) {
        onCloseBlogDrawer();
        return true;
      }
      if (
        ctrl.ticketDetail.open ||
        ctrl.deletePanelState.open ||
        ctrl.panelEditor.open ||
        ctrl.connectKeyOpen ||
        ctrl.newTicket.open ||
        ctrl.guestAddOpen ||
        ctrl.accountOpen
      ) {
        return true;
      }
      // Consola visible (pantalla `Terminal`): atrás = MINIMIZAR (pop hacia la
      // vista de fondo); la sesión tmux sigue viva en el host. Coherente con el
      // modelo de pantalla de B2 (antes lo resolvía el handler interno del
      // propio terminal tras caer todos los demás casos).
      if (consoleOverlayVisible) {
        minimizeConsoles();
        return true;
      }
      // Pantalla `Chat` del asistente (A5): atrás = pop a la portada. El stream
      // sigue vivo en el chat-store; se vuelve con el CTA o desde el drawer.
      if (chatOpen) {
        closePanelChat();
        return true;
      }
      if (ctrl.view === "ssh") {
        ctrl.backFromSshToDashboard();
        return true;
      }

      let previous = viewHistoryRef.current.pop();
      while (previous === "ssh") {
        previous = viewHistoryRef.current.pop();
      }
      if (!previous) return false;
      if (previous === "splash" || previous === "loading-panel" || previous === "login") return false;
      navigateToView(previous);
      return true;
    });
    return () => sub.remove();
  }, [isActiveTab, actionsSheetOpen, closeActionsSheet, blogDrawerOpen, serverDrawerOpen, closeServerDrawer, ctrl, navigateToView, onCloseBlogDrawer, modulePickerOpen, closeModulePicker, moduleOverlayVisible, activeModuleId, hideModule, nativeModule, consoleOverlayVisible, minimizeConsoles, chatOpen, closePanelChat]);
}
