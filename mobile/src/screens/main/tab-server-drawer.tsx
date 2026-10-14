// Drawer IZQUIERDO del servidor (por pestaña): estado abrir/cerrar + siembra del
// editor inline + navegación de tabs + overlay de render (in-tree o RN Modal).
// Extraído verbatim de MainTab.tsx; el hook se invoca en el MISMO punto del
// componente (mismo orden de hooks) y los valores/refs de animación se declaran
// en MainTab (antes del efecto de repintado del webview) y se pasan aquí.
import React, { useCallback, useEffect, useLayoutEffect } from "react";
import { Animated, Easing, View } from "react-native";
import { ScopedNativeModal as Modal } from "./native-module-context";;
import { GestureHandlerRootView, PanGestureHandler, State, type PanGestureHandlerStateChangeEvent } from "react-native-gesture-handler";
import type { EdgeInsets } from "react-native-safe-area-context";
import type { useMainTabController } from "../../hooks/useMainTabController";
import type { getMessages } from "../../i18n";
import type { getThemeTokens } from "../../theme/colors";
import type { PanelEditorState, PanelRow } from "../../features/app/viewModels";
import ServerDrawer, { serverDrawerTabsFor, serverDrawerTabItems, type ServerDrawerTab } from "../../components/ServerDrawer";
import { injectIntoConsole, type ConsoleSession } from "../../lib/console-sessions-store";
import type { ModuleSession } from "../../lib/module-sessions-store";
import { styles } from "../MainScreen.styles";
import { AnimatedPressable } from "./shell-chrome";
import type { ServerDrawerNav } from "./shell-types";

type Ctrl = ReturnType<typeof useMainTabController>;

export function useServerDrawerState({
  ctrl, tabId, t, activeServerPanel, chatTabsOn, terminalOpen, overlayOverNavbar,
  registerServerDrawerNav, sessionActiveRef,
  serverDrawerWidth, serverDrawerTranslateX, serverDrawerBackdrop, serverDrawerCloseTimer,
  serverDrawerOpen, setServerDrawerOpen, serverDrawerVisible, setServerDrawerVisible,
  serverDrawerTab, setServerDrawerTab, setSshInitialSubTab,
}: {
  ctrl: Ctrl;
  tabId: string;
  t: ReturnType<typeof getMessages>;
  activeServerPanel: PanelRow | null;
  chatTabsOn: boolean;
  terminalOpen: boolean;
  overlayOverNavbar: boolean;
  registerServerDrawerNav: (tabId: string, nav: ServerDrawerNav | null) => void;
  sessionActiveRef: React.MutableRefObject<boolean>;
  serverDrawerWidth: number;
  serverDrawerTranslateX: Animated.Value;
  serverDrawerBackdrop: Animated.Value;
  serverDrawerCloseTimer: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  serverDrawerOpen: boolean;
  setServerDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  serverDrawerVisible: boolean;
  setServerDrawerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  serverDrawerTab: ServerDrawerTab;
  setServerDrawerTab: React.Dispatch<React.SetStateAction<ServerDrawerTab>>;
  setSshInitialSubTab: React.Dispatch<React.SetStateAction<"list" | "register">>;
}) {
  // Dirty del editor inline: snapshot de los campos editables al sembrar vs. actual.
  const editSnapshotRef = React.useRef<string | null>(null);
  const editFieldsJson = (pe: PanelEditorState) => JSON.stringify({
    ip: pe.ip, port: pe.port, category: pe.category, tags: pe.tags, accessUrl: pe.accessUrl,
    sshUsername: pe.sshUsername, sshKeyIds: pe.sshKeyIds, sshPrivateKey: pe.sshPrivateKey, sshPassphrase: pe.sshPassphrase,
  });
  const editorDirty = ctrl.panelEditor.mode === "edit" && ctrl.panelEditor.open
    && editSnapshotRef.current !== null && editFieldsJson(ctrl.panelEditor) !== editSnapshotRef.current;
  // Ref siempre-actual a `submitPanelEditor` (función nueva por render): la usamos
  // para AUTOGUARDAR al cerrar el drawer sin meterla en deps de `closeServerDrawer`
  // (evita el bucle de re-registro del nav del drawer).
  const submitPanelEditorRef = React.useRef(ctrl.submitPanelEditor);
  submitPanelEditorRef.current = ctrl.submitPanelEditor;
  const [manageAccessOpen, setManageAccessOpen] = React.useState(false);
  // Drawer de perfil público (al tocar el badge "compartido por X").
  const [publicProfile, setPublicProfile] = React.useState<{ open: boolean; userId: string | null; userName: string }>({
    open: false, userId: null, userName: "",
  });

  const openServerDrawer = useCallback((targetTab?: ServerDrawerTab) => {
    // Sin sesión (login tras cerrar sesión): no se despliega ningún drawer.
    if (!sessionActiveRef.current) return;
    if (serverDrawerCloseTimer.current) {
      clearTimeout(serverDrawerCloseTimer.current);
      serverDrawerCloseTimer.current = null;
    }
    // Con tab explícito (p. ej. "ssh_keys" desde "registrar llave SSH") se respeta.
    // Sin él: con el terminal abierto abre "Snippets" (primero); si el chat está
    // iniciado abre "Chat"; si no (portada, sin conversación ni panel elegidos)
    // abre "Server" en modo EDITABLE (lo siembra el efecto que observa
    // serverDrawerTab === "server").
    // `chatTabsOn` (no `visibleComposer.started`): desde A5 el carousel siempre
    // muestra portadas aunque haya una conversación iniciada, así que ahí el
    // drawer abre en "Server"; "chat" solo si la pantalla Chat está a la vista.
    setServerDrawerTab(targetTab ?? (terminalOpen ? "snippets" : chatTabsOn ? "chat" : "server"));
    setServerDrawerVisible(true);
    setServerDrawerOpen(true);
  }, [chatTabsOn, terminalOpen]);
  // Cierre real: resetea editor + snapshot y anima el cierre.
  const doCloseServerDrawer = useCallback(() => {
    setServerDrawerOpen(false);
    setSshInitialSubTab("list"); // one-shot: el próximo open de SSH vuelve a "list"
    ctrl.closePanelEditor();
    editSnapshotRef.current = null;
    if (serverDrawerCloseTimer.current) clearTimeout(serverDrawerCloseTimer.current);
    serverDrawerCloseTimer.current = setTimeout(() => {
      setServerDrawerVisible(false);
      serverDrawerCloseTimer.current = null;
    }, 240);
    // Dep en `ctrl.closePanelEditor` (estable), no en `ctrl` (objeto nuevo por
    // render): así `closeServerDrawer` no cambia cada render y el efecto que sube
    // el nav del drawer no entra en bucle de setState.
  }, [ctrl.closePanelEditor]);
  // AUTOGUARDADO al cerrar: si el editor inline tiene cambios sin guardar, los
  // persiste (best-effort, en segundo plano) y cierra. Ya no se pide confirmar.
  const closeServerDrawer = useCallback(() => {
    if (editorDirty) void submitPanelEditorRef.current?.();
    doCloseServerDrawer();
  }, [editorDirty, doCloseServerDrawer]);

  // Sube el cromo del drawer izquierdo (título=nombre del servidor + tabs + cerrar)
  // a `MainScreen` para que el `DrawerTopBar` lo pinte en el navbar mientras abre.
  useEffect(() => {
    registerServerDrawerNav(tabId, {
      // Sobre cualquier WebView a pantalla completa (SSH, terminal nativo o webview
      // de módulo) el drawer pinta SUS PROPIOS tabs (chromeInNavbar=false), porque la
      // barra superior del navbar queda detrás del overlay: dejar `open` en false
      // evita que el DrawerTopBar intente "tomar" la barra detrás del WebView.
      open: serverDrawerVisible && !overlayOverNavbar,
      title: activeServerPanel?.nameLabel || t.titleBar.fabServer,
      items: serverDrawerTabItems(ctrl.guestMode, t, chatTabsOn, terminalOpen),
      // Coerción robusta: si el tab seleccionado ya no está en la lista vigente
      // (p. ej. quedó en "server" al entrar a un módulo, o en "chat" al salir),
      // cae al PRIMER tab válido del modo actual (no siempre "server": en modo
      // módulo los tabs de servers no existen).
      value: (() => {
        const list = serverDrawerTabsFor(ctrl.guestMode, chatTabsOn, terminalOpen);
        return list.includes(serverDrawerTab) ? serverDrawerTab : list[0];
      })(),
      onChange: (k) => { setSshInitialSubTab("list"); setServerDrawerTab(k as ServerDrawerTab); },
      onClose: closeServerDrawer,
    });
  }, [tabId, registerServerDrawerNav, serverDrawerVisible, activeServerPanel?.nameLabel, t, ctrl.guestMode, serverDrawerTab, chatTabsOn, terminalOpen, overlayOverNavbar, closeServerDrawer]);
  useEffect(() => () => registerServerDrawerNav(tabId, null), [tabId, registerServerDrawerNav]);

  // Siembra la edición inline del panel visible al abrir el tab Server (no invitado).
  // `useLayoutEffect` (no `useEffect`): la siembra ocurre ANTES del primer pintado,
  // así el tab Server nunca muestra el parpadeo de la versión de solo lectura
  // ("versión antigua") mientras `panelEditor` se siembra para el panel visible.
  useLayoutEffect(() => {
    if (!serverDrawerOpen || !activeServerPanel || ctrl.guestMode) return;
    // Tab EFECTIVO: replica la coerción de `ServerDrawer` (un tab "chat"/"snippets"
    // que ya no aplica se pinta como "server"). Sembramos cuando el objetivo REAL es
    // "server" aunque `serverDrawerTab` siga en un valor obsoleto por la carrera del
    // swipe con el flip de `started`: así el tab Server nunca queda en skeleton por
    // falta de siembra (BUG del skeleton pegado al abrir el drawer al iniciar chat).
    // MISMA lista que pintan el DrawerTopBar y ServerDrawer (`chatTabsOn`, no
    // `visibleComposer.started`): con una conversación iniciada pero el chat NO a
    // la vista (carousel), `started=true` metía aquí los tabs de módulo y la
    // siembra nunca corría → tab Server en skeleton para siempre y swipe muerto.
    const list = serverDrawerTabsFor(ctrl.guestMode, chatTabsOn, terminalOpen);
    const effectiveTab = list.includes(serverDrawerTab) ? serverDrawerTab : list[0];
    if (effectiveTab !== "server") return;
    if (ctrl.panelEditor.open && ctrl.panelEditor.mode === "edit" && ctrl.panelEditor.panelId === activeServerPanel.source.id) return;
    ctrl.openEditPanelModal(activeServerPanel);
    editSnapshotRef.current = null;
  }, [serverDrawerOpen, serverDrawerTab, chatTabsOn, terminalOpen, activeServerPanel, ctrl.guestMode, ctrl.panelEditor.open, ctrl.panelEditor.mode, ctrl.panelEditor.panelId, ctrl]);
  // Captura el snapshot una vez sembrado (para detectar cambios).
  useEffect(() => {
    if (serverDrawerOpen && ctrl.panelEditor.open && ctrl.panelEditor.mode === "edit" && editSnapshotRef.current === null) {
      editSnapshotRef.current = editFieldsJson(ctrl.panelEditor);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverDrawerOpen, ctrl.panelEditor]);
  useEffect(() => () => {
    if (serverDrawerCloseTimer.current) clearTimeout(serverDrawerCloseTimer.current);
  }, []);
  useEffect(() => {
    if (serverDrawerOpen) {
      setServerDrawerVisible(true);
      serverDrawerTranslateX.setValue(-serverDrawerWidth);
      serverDrawerBackdrop.setValue(0);
      Animated.parallel([
        Animated.timing(serverDrawerTranslateX, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(serverDrawerBackdrop, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
      return;
    }
    if (!serverDrawerVisible) return;
    Animated.parallel([
      Animated.timing(serverDrawerTranslateX, { toValue: -serverDrawerWidth, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(serverDrawerBackdrop, { toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [serverDrawerOpen, serverDrawerVisible, serverDrawerBackdrop, serverDrawerTranslateX, serverDrawerWidth]);
  const handleServerDrawerSwipe = useCallback((event: PanGestureHandlerStateChangeEvent) => {
    const { oldState, translationX, translationY, velocityX } = event.nativeEvent;
    if (oldState !== State.ACTIVE) return;
    if (Math.abs(translationX) < 24 && Math.abs(velocityX) < 550) return;
    if (Math.abs(translationX) < Math.abs(translationY) * 0.8 && Math.abs(velocityX) < 550) return;
    const list = serverDrawerTabsFor(ctrl.guestMode, chatTabsOn, terminalOpen);
    // Invitado (un solo tab): el swipe-izquierda cierra el drawer (no hay tabs que ciclar).
    if (list.length <= 1) {
      if (translationX < -18 || velocityX < -550) closeServerDrawer();
      return;
    }
    // Swipe-izquierda → siguiente tab; swipe-derecha → anterior. Cíclico (infinito).
    const idx = Math.max(0, list.indexOf(serverDrawerTab));
    if (translationX < -18 || velocityX < -550) { setSshInitialSubTab("list"); setServerDrawerTab(list[(idx + 1) % list.length]); }
    else if (translationX > 18 || velocityX > 550) { setSshInitialSubTab("list"); setServerDrawerTab(list[(idx - 1 + list.length) % list.length]); }
  }, [ctrl.guestMode, serverDrawerTab, chatTabsOn, terminalOpen, closeServerDrawer]);

  return {
    openServerDrawer, closeServerDrawer, handleServerDrawerSwipe,
    manageAccessOpen, setManageAccessOpen, publicProfile, setPublicProfile,
  };
}

/** Deps del overlay del drawer izquierdo (todas del render de MainTab). */
export type ServerDrawerOverlayDeps = {
  ctrl: Ctrl;
  t: ReturnType<typeof getMessages>;
  insets: EdgeInsets;
  serverTokens: ReturnType<typeof getThemeTokens>;
  serverDrawerVisible: boolean;
  serverDrawerWidth: number;
  serverDrawerTranslateX: Animated.Value;
  serverDrawerBackdrop: Animated.Value;
  serverDrawerTab: ServerDrawerTab;
  setServerDrawerTab: React.Dispatch<React.SetStateAction<ServerDrawerTab>>;
  setSshInitialSubTab: React.Dispatch<React.SetStateAction<"list" | "register">>;
  sshInitialSubTab: "list" | "register";
  closeServerDrawer: () => void;
  handleServerDrawerSwipe: (event: PanGestureHandlerStateChangeEvent) => void;
  overlayOverNavbar: boolean;
  chatTabsOn: boolean;
  terminalOpen: boolean;
  serverRows: PanelRow[];
  activeServerPanel: PanelRow | null;
  nativeTerminalPanel: PanelRow | null;
  moduleOverlayVisible: boolean;
  activeModuleId: string | null;
  moduleSessions: ModuleSession[];
  favorites: Set<string>;
  toggleFavorite: (id: string) => void;
  openPanelChat: (panelId: string) => void;
  consoleOverlayVisible: boolean;
  activeConsoleId: string | null;
  consoles: ConsoleSession[];
  activateConsole: (id: string) => void;
  closeConsole: (id: string) => void;
  renameConsole: (id: string, label: string) => void;
  openNewConsole: (panel: PanelRow) => void;
  webviewInjectRef: React.MutableRefObject<((js: string) => void) | null>;
};

// Overlay del drawer izquierdo (snippets/chat/server/ssh/categorías). Se usa
// sobre el dashboard y sobre AMBOS terminales (vista SSH y terminal nativo) para
// habilitar el tab "Terminal". `asModal` lo envuelve en un RN Modal: sobre el
// terminal el WebView nativo TAPA cualquier overlay del árbol de MainTab, así que
// va en su propia ventana nativa (por ENCIMA del WebView). En ese modo el drawer
// pinta sus propios tabs (no hay navbar) y se navega con ellos (sin swipe de tabs).
export function renderServerDrawerOverlay(d: ServerDrawerOverlayDeps, asModal = false) {
  const {
    ctrl, t, insets, serverTokens, serverDrawerVisible, serverDrawerWidth,
    serverDrawerTranslateX, serverDrawerBackdrop, serverDrawerTab, setServerDrawerTab,
    setSshInitialSubTab, sshInitialSubTab, closeServerDrawer, handleServerDrawerSwipe,
    overlayOverNavbar, chatTabsOn, terminalOpen, serverRows, activeServerPanel,
    nativeTerminalPanel, moduleOverlayVisible, activeModuleId, moduleSessions,
    favorites, toggleFavorite, openPanelChat, consoleOverlayVisible, activeConsoleId,
    consoles, activateConsole, closeConsole, renameConsole, openNewConsole, webviewInjectRef,
  } = d;
  if (!serverDrawerVisible) return null;
  // Sobre el terminal el panel del drawer es el del terminal abierto (la sesión
  // SSH conectada `activePanelId`, o el panel del terminal nativo), NO el visible
  // del carousel (que es del dashboard) — así los snippets son del servidor cuyo
  // terminal está abierto.
  // Sobre un webview de módulo el panel del drawer es el del MÓDULO activo (su
  // `panelId`), no el visible del carousel: así Server/SSH/Categorías son del
  // servidor cuyo módulo está abierto.
  const activeModulePanel = moduleOverlayVisible && activeModuleId
    ? serverRows.find((r) => r.id === moduleSessions.find((m) => m.id === activeModuleId)?.panelId) ?? null
    : null;
  const activePanel = (ctrl.view === "ssh"
    ? serverRows.find((r) => r.id === ctrl.activePanelId)
    : activeModulePanel ?? nativeTerminalPanel) ?? activeServerPanel;
  const activeMetrics = ctrl.visibleServerPanelId ? ctrl.panelMetrics?.[ctrl.visibleServerPanelId] : undefined;
  const panel = (
    <Animated.View
      style={[
        styles.serverDrawer,
        {
          width: serverDrawerWidth,
          // En Modal cubrimos la pantalla completa (incl. status bar): reservamos
          // el borde superior. Abajo siempre (barra de navegación Android).
          paddingTop: asModal ? insets.top : 0,
          paddingBottom: insets.bottom,
          backgroundColor: serverTokens.bgPrimary,
          borderRightColor: serverTokens.border,
          transform: [{ translateX: serverDrawerTranslateX }],
          opacity: serverDrawerBackdrop.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }),
        },
      ]}
    >
      <ServerDrawer
        panel={activePanel}
        metrics={activeMetrics}
        loading={!ctrl.guestMode && ctrl.busyPanels && !activePanel}
        language={ctrl.language}
        token={ctrl.token ?? ""}
        guestMode={ctrl.guestMode}
        tab={serverDrawerTab}
        onTabChange={(tab) => { setSshInitialSubTab("list"); setServerDrawerTab(tab); }}
        initialSshTab={sshInitialSubTab}
        onClose={closeServerDrawer}
        // Sobre cualquier WebView a pantalla completa (SSH, terminal nativo o
        // webview de módulo) el navbar no está visible → el drawer pinta sus propios
        // tabs; en dashboard usa el DrawerTopBar del navbar.
        chromeInNavbar={!overlayOverNavbar}
        taxonomy={ctrl.taxonomy}
        sshKeys={ctrl.sshKeys}
        refreshTaxonomy={ctrl.refreshTaxonomy}
        refreshSshKeys={ctrl.refreshSshKeys}
        applyCategoryCreated={ctrl.applyCategoryCreated}
        applyCategoryRenamed={ctrl.applyCategoryRenamed}
        applyCategoryDeleted={ctrl.applyCategoryDeleted}
        applyTagCreated={ctrl.applyTagCreated}
        applyTagRenamed={ctrl.applyTagRenamed}
        applyTagDeleted={ctrl.applyTagDeleted}
        applySshKeyCreated={ctrl.applySshKeyCreated}
        applySshKeyUpdated={ctrl.applySshKeyUpdated}
        applySshKeyDeleted={ctrl.applySshKeyDeleted}
        panelEditor={ctrl.panelEditor}
        sshKeyOptions={ctrl.sshKeys}
        setPanelEditor={ctrl.setPanelEditor}
        closePanelEditor={ctrl.closePanelEditor}
        submitPanelEditor={ctrl.submitPanelEditor}
        requestDeletePanel={ctrl.requestDeletePanelFromEditor}
        isFavorite={activePanel ? favorites.has(activePanel.id) : false}
        onToggleFavorite={() => { if (activePanel) toggleFavorite(activePanel.id); }}
        onEnterPanel={() => {
          if (activePanel) void ctrl.handlePanelRowAction("connect", activePanel);
          closeServerDrawer();
        }}
        chatStarted={chatTabsOn}
        terminalOpen={terminalOpen}
        onOpenChat={openPanelChat}
        // Snippets → consola ACTIVA (terminal nativo) si está visible;
        // si no, la WebView del panel (vista SSH).
        injectIntoTerminal={(js) => {
          if (consoleOverlayVisible && activeConsoleId) injectIntoConsole(activeConsoleId, js);
          else webviewInjectRef.current?.(js);
        }}
        // Gestión de consolas (tab "Consolas"): solo con el overlay de consola
        // visible (en la vista SSH el overlay nativo no se renderiza). Sin él, la
        // lista sale vacía y SIN botón "Nueva consola".
        consoles={consoleOverlayVisible ? consoles : undefined}
        activeConsoleId={consoleOverlayVisible ? activeConsoleId : null}
        onSelectConsole={consoleOverlayVisible ? (id) => { activateConsole(id); closeServerDrawer(); } : undefined}
        // Cerrar la ÚLTIMA consola desde el drawer cierra también el drawer (si no,
        // saltaría de golpe al modo dashboard del drawer).
        onCloseConsole={consoleOverlayVisible ? (id) => { closeConsole(id); if (consoles.length <= 1) closeServerDrawer(); } : undefined}
        onRenameConsole={consoleOverlayVisible ? renameConsole : undefined}
        onNewConsole={consoleOverlayVisible ? () => { if (activePanel) openNewConsole(activePanel); } : undefined}
        onRefresh={async () => {
          // Pull-to-refresh del tab "Server": paneles/estado + taxonomía + llaves.
          await Promise.all([ctrl.refreshPanels(), ctrl.refreshTaxonomy(), ctrl.refreshSshKeys()]);
        }}
      />
    </Animated.View>
  );
  const backdrop = (
    <AnimatedPressable
      style={[styles.serverDrawerBackdrop, { opacity: serverDrawerBackdrop }]}
      onPress={closeServerDrawer}
    />
  );
  if (asModal) {
    // Dentro de un RN Modal los gestos NO funcionan con el GestureHandlerRootView
    // raíz de la app (el Modal vive en otra jerarquía de vistas): hay que envolver
    // el contenido del Modal en su propio GestureHandlerRootView para que el swipe
    // lateral cambie de tab igual que en el drawer del dashboard.
    return (
      <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={closeServerDrawer}>
        <GestureHandlerRootView style={styles.fill}>
          <View style={styles.serverDrawerOverlay} pointerEvents="box-none">
            <PanGestureHandler onHandlerStateChange={handleServerDrawerSwipe} activeOffsetX={[-8, 8]} failOffsetY={[-28, 28]}>
              {panel}
            </PanGestureHandler>
            {backdrop}
          </View>
        </GestureHandlerRootView>
      </Modal>
    );
  }
  return (
    <View style={styles.serverDrawerOverlay} pointerEvents="box-none">
      <PanGestureHandler onHandlerStateChange={handleServerDrawerSwipe} activeOffsetX={[-8, 8]} failOffsetY={[-28, 28]}>
        {panel}
      </PanGestureHandler>
      {backdrop}
    </View>
  );
}
