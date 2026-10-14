// Bottom-sheet CENTRAL (swipe-up) de acciones — New/Import/Export/Usage/
// Integrations/API — extraído verbatim de MainTab.tsx (mismo orden de hooks:
// se invoca en el mismo punto del componente).
import React, { useCallback, useEffect, useState } from "react";
import { Animated, Easing, useWindowDimensions } from "react-native";
import { State, type PanGestureHandlerStateChangeEvent } from "react-native-gesture-handler";
import type { useMainTabController } from "../../hooks/useMainTabController";
import type { getMessages } from "../../i18n";
import { ACTIONS_SHEET_TABS, actionsSheetTabItems, type ActionsSheetTab } from "../../components/ActionsSheet";
import type { ActionsSheetNav } from "./shell-types";

export function useActionsSheetState({
  ctrl, tabId, t, registerActionsSheetNav, sessionActive, sessionActiveRef,
  serverDrawerOpen, closeServerDrawer,
}: {
  ctrl: ReturnType<typeof useMainTabController>;
  tabId: string;
  t: ReturnType<typeof getMessages>;
  registerActionsSheetNav: (tabId: string, nav: ActionsSheetNav | null) => void;
  sessionActive: boolean;
  sessionActiveRef: React.MutableRefObject<boolean>;
  serverDrawerOpen: boolean;
  closeServerDrawer: () => void;
}) {
  const { height: actionsScreenHeight } = useWindowDimensions();
  // Sheet central al 100% del contenedor (antes 90%): abre completo.
  const actionsSheetHeight = actionsScreenHeight;
  const actionsSheetTranslateY = React.useRef(new Animated.Value(actionsSheetHeight)).current;
  const actionsSheetBackdrop = React.useRef(new Animated.Value(0)).current;
  // Arrastre vertical EN VIVO del sheet (sigue el dedo) para cerrar deslizando hacia
  // abajo desde CUALQUIER parte del contenedor (no solo el asa). Se suma a translateY.
  const actionsSheetDragY = React.useRef(new Animated.Value(0)).current;
  const actionsSheetCloseTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [actionsSheetOpen, setActionsSheetOpen] = useState(false);
  const [actionsSheetVisible, setActionsSheetVisible] = useState(false);
  const [actionsSheetTab, setActionsSheetTab] = useState<ActionsSheetTab>("new");
  const openActionsSheet = useCallback((tab: ActionsSheetTab = "new") => {
    // Sin sesión (login tras cerrar sesión): el sheet central no se despliega.
    if (!sessionActiveRef.current) return;
    if (actionsSheetCloseTimer.current) {
      clearTimeout(actionsSheetCloseTimer.current);
      actionsSheetCloseTimer.current = null;
    }
    actionsSheetDragY.setValue(0);
    setActionsSheetTab(tab);
    setActionsSheetVisible(true);
    setActionsSheetOpen(true);
  }, [actionsSheetDragY]);
  // Sigue el dedo en el eje Y mientras se arrastra el sheet (cierre por swipe-abajo).
  const onActionsSheetGesture = React.useMemo(
    () => Animated.event([{ nativeEvent: { translationY: actionsSheetDragY } }], { useNativeDriver: true }),
    [actionsSheetDragY],
  );
  const closeActionsSheet = useCallback(() => {
    setActionsSheetOpen(false);
    // Limpia el form de creación sembrado por el tab "New" (no debe quedar abierto).
    ctrl.closePanelEditor();
    if (actionsSheetCloseTimer.current) clearTimeout(actionsSheetCloseTimer.current);
    actionsSheetCloseTimer.current = setTimeout(() => {
      setActionsSheetVisible(false);
      actionsSheetCloseTimer.current = null;
    }, 240);
  }, [ctrl]);
  useEffect(() => () => {
    if (actionsSheetCloseTimer.current) clearTimeout(actionsSheetCloseTimer.current);
  }, []);
  // Al cerrar sesión (la vista pasa a "login" / sin token): cierra el sheet central
  // y el drawer lateral del servidor si quedaron abiertos. El drawer derecho (blog)
  // y el de soporte son globales y los cierra `MainScreen`. Solo actúa cuando hay
  // algo abierto, así que converge sin re-disparar tras cerrarlos.
  useEffect(() => {
    if (sessionActive) return;
    if (actionsSheetOpen) closeActionsSheet();
    if (serverDrawerOpen) closeServerDrawer();
  }, [sessionActive, actionsSheetOpen, serverDrawerOpen, closeActionsSheet, closeServerDrawer]);
  useEffect(() => {
    if (actionsSheetOpen) {
      setActionsSheetVisible(true);
      actionsSheetTranslateY.setValue(actionsSheetHeight);
      actionsSheetBackdrop.setValue(0);
      Animated.parallel([
        Animated.timing(actionsSheetTranslateY, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(actionsSheetBackdrop, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
      return;
    }
    if (!actionsSheetVisible) return;
    Animated.parallel([
      Animated.timing(actionsSheetTranslateY, { toValue: actionsSheetHeight, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(actionsSheetBackdrop, { toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [actionsSheetOpen, actionsSheetVisible, actionsSheetBackdrop, actionsSheetTranslateY, actionsSheetHeight]);
  // Sube los tabs del sheet central a `MainScreen` para pintarlos en el navbar
  // superior (`DrawerTopBar`) mientras el sheet está abierto (igual que los drawers).
  useEffect(() => {
    registerActionsSheetNav(tabId, {
      open: actionsSheetVisible,
      items: actionsSheetTabItems(t),
      value: actionsSheetTab,
      onChange: (k) => setActionsSheetTab(k as ActionsSheetTab),
    });
  }, [tabId, registerActionsSheetNav, actionsSheetVisible, actionsSheetTab, t]);
  useEffect(() => () => registerActionsSheetNav(tabId, null), [tabId, registerActionsSheetNav]);
  // Siembra el form de creación cuando el sheet está abierto en el tab "New".
  useEffect(() => {
    // The workspace also opens this sheet for an explicitly selected edit.
    if (actionsSheetOpen && actionsSheetTab === "new" && !ctrl.panelEditor.open) {
      ctrl.openCreatePanelModal();
    }
  }, [actionsSheetOpen, actionsSheetTab, ctrl.panelEditor.open, ctrl.panelEditor.mode, ctrl]);
  // Fin del gesto del sheet: swipe-abajo (en cualquier parte del contenedor) cierra;
  // swipe horizontal cicla tabs; si no llega al umbral, vuelve a su sitio.
  const handleActionsSheetSwipe = useCallback((event: PanGestureHandlerStateChangeEvent) => {
    const { oldState, translationX, translationY, velocityX, velocityY } = event.nativeEvent;
    if (oldState !== State.ACTIVE) return;
    const horizontal = Math.abs(translationX) > Math.abs(translationY);
    // Vertical hacia abajo → cerrar (sensible). El sheet ya viene siguiendo el dedo.
    if (!horizontal && (translationY > 80 || velocityY > 500)) {
      closeActionsSheet(); // deja `actionsSheetDragY` donde está; el slide de cierre continúa el gesto
      return;
    }
    // Horizontal → cicla tabs (cíclico).
    if (horizontal && (Math.abs(translationX) > 24 || Math.abs(velocityX) > 550)) {
      const idx = Math.max(0, ACTIONS_SHEET_TABS.indexOf(actionsSheetTab));
      if (translationX < 0) setActionsSheetTab(ACTIONS_SHEET_TABS[(idx + 1) % ACTIONS_SHEET_TABS.length]);
      else setActionsSheetTab(ACTIONS_SHEET_TABS[(idx - 1 + ACTIONS_SHEET_TABS.length) % ACTIONS_SHEET_TABS.length]);
    }
    // No cerró: el sheet vuelve a su posición.
    Animated.spring(actionsSheetDragY, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 14 }).start();
  }, [actionsSheetTab, closeActionsSheet, actionsSheetDragY]);
  // Gesto del handle inferior: swipe-up abre el sheet (en la pantalla de servidores).
  const handleOpenSheetSwipe = useCallback((event: PanGestureHandlerStateChangeEvent) => {
    const { oldState, translationY, velocityY } = event.nativeEvent;
    if (oldState !== State.ACTIVE) return;
    if (translationY < -24 || velocityY < -550) openActionsSheet("new");
  }, [openActionsSheet]);

  return {
    actionsSheetOpen, actionsSheetVisible, actionsSheetTab, setActionsSheetTab,
    actionsSheetTranslateY, actionsSheetBackdrop, actionsSheetDragY,
    openActionsSheet, closeActionsSheet, onActionsSheetGesture,
    handleActionsSheetSwipe, handleOpenSheetSwipe,
  };
}
