// Puente sesiones ⇄ stack de navegación + entorno del SessionHost (B2/B3/A5),
// extraído verbatim de MainTab.tsx (mismo orden de hooks: se invoca en el mismo
// punto del componente, tras calcular `shellVisible`). No devuelve nada: todo
// son efectos/refs internos.
import React, { useEffect } from "react";
import type { PanGestureHandlerStateChangeEvent } from "react-native-gesture-handler";
import { CommonActions, StackActions } from "@react-navigation/native";
import type { useMainTabController } from "../../hooks/useMainTabController";
import type { getMessages } from "../../i18n";
import type { ServerModulePermissions } from "../../api/client";
import type { PanelRow } from "../../features/app/viewModels";
import { getNavigationRef } from "../../navigation/navigationRef";
import { syncChatRoute } from "../../navigation/chat-route-persist";
import { VIEW_TO_ROUTE } from "../../navigation/types";
import { serverDrawerTabItems, type ServerDrawerTab } from "../../components/ServerDrawer";
import { pushCommandHistory } from "../../lib/terminal-command-history";
import {
  disposeConsolesTab,
  getConsolesTab,
  minimizeConsoles as storeMinimizeConsoles,
  noteConsoleCommand,
  type ConsoleSession,
} from "../../lib/console-sessions-store";
import {
  disposeModulesTab,
  dropModuleSession as storeDropModuleSession,
  getModulesTab,
  hideModule as storeHideModule,
} from "../../lib/module-sessions-store";
import { setSessionTabEnv, clearSessionTabEnv, computeSessionsSuppressed } from "../../sessions/session-env";
import type { FloatingButtonsConfig } from "../../lib/module-floating-buttons-store";
import type { NativeModuleSession } from "./shell-types";

export function useSessionBridge({
  ctrl, tabId, isActiveTab, t, shellVisible,
  consoleOverlayVisible, activeConsole, activeConsoleId,
  moduleOverlayVisible, activeModuleId,
  chatRestoreRef, setChatOpenPanelId, onChatOpenChange,
  openServerDrawer, handleSwipe, hideModule, onRequestOpenTabMenu,
  openModulePicker, openModuleShortcut, openModuleSession, permsByPanel, serverRowsRef,
  nativeModule, standaloneOpen, activating, modulePickerVisible, actionsSheetVisible,
  supportDrawerOpen, visibleComposerStarted, terminalOpen, webviewRepaintSignal, floatingByPanel,
}: {
  ctrl: ReturnType<typeof useMainTabController>;
  tabId: string;
  isActiveTab: boolean;
  t: ReturnType<typeof getMessages>;
  shellVisible: boolean;
  consoleOverlayVisible: boolean;
  activeConsole: ConsoleSession | null;
  activeConsoleId: string | null;
  moduleOverlayVisible: boolean;
  activeModuleId: string | null;
  chatRestoreRef: React.MutableRefObject<string | undefined>;
  setChatOpenPanelId: React.Dispatch<React.SetStateAction<string | null>>;
  onChatOpenChange: (tabId: string, panelId: string | null) => void;
  openServerDrawer: (targetTab?: ServerDrawerTab) => void;
  handleSwipe: (event: PanGestureHandlerStateChangeEvent) => void;
  hideModule: () => void;
  onRequestOpenTabMenu: () => void;
  openModulePicker: (panel: PanelRow, perms: ServerModulePermissions) => void;
  openModuleShortcut: (panel: PanelRow, id: string) => void;
  openModuleSession: (panel: PanelRow, moduleId: string, route: string, moduleName?: string) => Promise<void>;
  permsByPanel: Record<string, ServerModulePermissions>;
  serverRowsRef: React.MutableRefObject<PanelRow[]>;
  nativeModule: NativeModuleSession | null;
  standaloneOpen: boolean;
  activating: { id: string; label: string } | null;
  modulePickerVisible: boolean;
  actionsSheetVisible: boolean;
  supportDrawerOpen: boolean;
  visibleComposerStarted: boolean;
  terminalOpen: boolean;
  webviewRepaintSignal: number;
  floatingByPanel: Record<string, FloatingButtonsConfig>;
}) {
  // Sentido stores → stack: la sesión ACTIVA (consola u webview de módulo
  // visibles) se refleja como ruta apilada sobre la vista actual. Imperativo
  // (navigate/replace/goBack) para convivir con el resetRoot del TabNavigator:
  //  - abrir/reabrir = navigate (apila sobre la vista);
  //  - cambiar de consola / de tipo (consola ⇄ módulo) = replace (nunca dos
  //    rutas de sesión apiladas: goBack vuelve SIEMPRE a la vista de fondo);
  //  - minimizar/ocultar/cerrar = goBack (la sesión sigue viva en el host).
  const activeConsolePanelId = activeConsole?.panelId ?? null;
  useEffect(() => {
    const nav = getNavigationRef(tabId);
    if (!nav.isReady()) return;
    const current = nav.getCurrentRoute();
    const onSessionRoute = current?.name === "Terminal" || current?.name === "ModuleWebView";
    const target = consoleOverlayVisible && activeConsoleId
      ? { name: "Terminal" as const, params: { panelId: activeConsolePanelId ?? "", consoleId: activeConsoleId } }
      : moduleOverlayVisible && activeModuleId
        ? { name: "ModuleWebView" as const, params: { moduleSessionId: activeModuleId } }
        : null;
    if (target) {
      if (current?.name === target.name) {
        const p = (current.params ?? {}) as Record<string, unknown>;
        const same = target.name === "Terminal"
          ? p.consoleId === activeConsoleId
          : p.moduleSessionId === activeModuleId;
        if (!same) nav.dispatch(StackActions.replace(target.name, target.params));
      } else if (onSessionRoute) {
        nav.dispatch(StackActions.replace(target.name, target.params));
      } else {
        nav.dispatch(CommonActions.navigate(target.name, target.params));
      }
    } else if (onSessionRoute) {
      if (nav.canGoBack()) nav.goBack();
      else nav.resetRoot({ index: 0, routes: [{ name: VIEW_TO_ROUTE[ctrl.view] }] });
    }
  }, [tabId, consoleOverlayVisible, activeConsoleId, moduleOverlayVisible, activeModuleId, activeConsolePanelId, ctrl.view]);

  // Sentido stack → stores: si la ruta de sesión desaparece por otra vía (el
  // resetRoot del TabNavigator al cambiar `ctrl.view`, un pop del navigator…),
  // la sesión pasa a inactiva (minimizada/oculta) pero SIGUE VIVA en el host.
  useEffect(() => {
    const nav = getNavigationRef(tabId);
    return nav.addListener("state", () => {
      const route = nav.getCurrentRoute();
      const name = route?.name;
      if (name !== "Terminal" && getConsolesTab(tabId).activeConsoleId) storeMinimizeConsoles(tabId);
      if (name !== "ModuleWebView" && getModulesTab(tabId).activeModuleId) storeHideModule(tabId);
      // A5: refleja la ruta `Chat` (gatea cromo, drawer y botón atrás). El
      // estado del chat NO se toca: al salir de la ruta la conversación sigue
      // viva en el chat-store. B3: además se persiste en el tab-sessions-store
      // (persistedRoute) para reabrir la pantalla al restaurar la pestaña.
      const chatPanelId = name === "Chat" ? ((route?.params as { panelId?: string } | undefined)?.panelId ?? null) : null;
      setChatOpenPanelId(chatPanelId);
      // Una navegación real a `Chat` invalida el restore pendiente (manda la
      // navegación del usuario); y mientras el restore siga pendiente NO se
      // persiste `null` — borraría de disco el restoreChatPanelId antes de que
      // el efecto one-shot de arriba pueda consumirlo (ver chat-route-persist).
      if (chatPanelId !== null) chatRestoreRef.current = undefined;
      const sync = syncChatRoute(chatPanelId, chatRestoreRef.current !== undefined);
      if (sync.action === "persist") onChatOpenChange(tabId, sync.panelId);
    });
  }, [tabId, onChatOpenChange]);

  // ── B2: entorno del SessionHost ─────────────────────────────────────────────
  // Callbacks vivos tras un ref (identidad estable): el env publicado solo
  // cambia cuando cambian sus DATOS (token/idioma/tema/flags), no cada render.
  const sessionEnvFnsRef = React.useRef({
    onSelectTopTab: (_key: string) => {},
    onConsoleCommand: (_consoleId: string, _cmd: string, _injected: boolean) => {},
    onSwipe: (_event: PanGestureHandlerStateChangeEvent) => {},
    onModuleLoadFailed: (_sessionId: string, _code: number, _desc: string) => {},
    onConnected: () => {},
    onModuleSessionExpired: (_sessionId: string) => {},
    onRequestBack: () => {},
    onRequestOpenTabs: () => {},
    onModuleMoreOptions: (_sessionId: string) => {},
    onModuleShortcut: (_sessionId: string, _moduleId: string) => {},
    onRequestSetTheme: (_theme: import("../../features/app/types").ThemeMode) => {},
    onRequestSetLanguage: (_language: string) => {},
  });
  sessionEnvFnsRef.current = {
    onSelectTopTab: (key) => openServerDrawer(key as ServerDrawerTab),
    onConsoleCommand: (consoleId, cmd, injected) => {
      // Los TECLEADOS van al historial de comandos; los inyectados (snippets/
      // reanudar) NO, pero ambos actualizan el auto-rótulo (store).
      const c = getConsolesTab(tabId).consoles.find((x) => x.id === consoleId);
      if (!injected && c) void pushCommandHistory(c.panelId, cmd);
      noteConsoleCommand(tabId, consoleId, cmd);
    },
    onSwipe: handleSwipe,
    onModuleLoadFailed: (sessionId, code, desc) => {
      // Fallo de carga: si es un PRE-WARM (background), soltarlo en silencio
      // (sin modal de error ni reset de la conexión principal). Si es una
      // sesión abierta por el usuario, mantener el aviso de conexión normal.
      if (getModulesTab(tabId).sessions.find((s) => s.id === sessionId)?.prewarm) {
        storeDropModuleSession(tabId, sessionId);
        return;
      }
      ctrl.handleSshLoadFailed(code, desc);
    },
    onConnected: ctrl.handleSshConnected,
    onModuleSessionExpired: (sessionId) => {
      // Sesión SSO caducada (rebote a /login tras mucho tiempo): SUELTA esta
      // sesión y ofrece reconexión. Al pulsar "Reconectar" se reabre el MISMO
      // módulo (SSO fresca con next=/panel/<ruta>) → el usuario vuelve justo
      // a la pantalla donde estaba.
      const m = getModulesTab(tabId).sessions.find((s) => s.id === sessionId);
      if (!m) return;
      const panelRow = serverRowsRef.current.find((r) => r.id === m.panelId);
      storeDropModuleSession(tabId, sessionId);
      if (panelRow) {
        ctrl.promptReconnect({
          panelName: m.panelName,
          kind: "session",
          retry: () => { void openModuleSession(panelRow, m.moduleId, m.route, m.moduleName); },
        });
      }
    },
    onRequestBack: hideModule,
    onRequestOpenTabs: onRequestOpenTabMenu,
    onModuleMoreOptions: (sessionId) => {
      // "Más opciones": reabre el drawer central para el panel de ESTA sesión.
      const m = getModulesTab(tabId).sessions.find((s) => s.id === sessionId);
      if (!m) return;
      const panel = serverRowsRef.current.find((r) => r.id === m.panelId);
      const perms = permsByPanel[m.panelId];
      if (panel && perms) openModulePicker(panel, perms);
    },
    onModuleShortcut: (sessionId, moduleId) => {
      const m = getModulesTab(tabId).sessions.find((s) => s.id === sessionId);
      const panel = m ? serverRowsRef.current.find((r) => r.id === m.panelId) : undefined;
      if (panel) openModuleShortcut(panel, moduleId);
    },
    onRequestSetTheme: ctrl.setTheme,
    onRequestSetLanguage: ctrl.setLanguage,
  };
  // Wrappers ESTABLES (una sola identidad) que delegan en el ref vivo.
  const sessionEnvFns = React.useMemo(() => ({
    onSelectTopTab: (key: string) => sessionEnvFnsRef.current.onSelectTopTab(key),
    onConsoleCommand: (consoleId: string, cmd: string, injected: boolean) => sessionEnvFnsRef.current.onConsoleCommand(consoleId, cmd, injected),
    onSwipe: (event: PanGestureHandlerStateChangeEvent) => sessionEnvFnsRef.current.onSwipe(event),
    onModuleLoadFailed: (sessionId: string, code: number, desc: string) => sessionEnvFnsRef.current.onModuleLoadFailed(sessionId, code, desc),
    onConnected: () => sessionEnvFnsRef.current.onConnected(),
    onModuleSessionExpired: (sessionId: string) => sessionEnvFnsRef.current.onModuleSessionExpired(sessionId),
    onRequestBack: () => sessionEnvFnsRef.current.onRequestBack(),
    onRequestOpenTabs: () => sessionEnvFnsRef.current.onRequestOpenTabs(),
    onModuleMoreOptions: (sessionId: string) => sessionEnvFnsRef.current.onModuleMoreOptions(sessionId),
    onModuleShortcut: (sessionId: string, moduleId: string) => sessionEnvFnsRef.current.onModuleShortcut(sessionId, moduleId),
    onRequestSetTheme: (theme: import("../../features/app/types").ThemeMode) => sessionEnvFnsRef.current.onRequestSetTheme(theme),
    onRequestSetLanguage: (language: string) => sessionEnvFnsRef.current.onRequestSetLanguage(language),
  }), []);

  // Overlays del tab que HOY se pintan POR ENCIMA de las sesiones (módulo
  // nativo, standalone, indicador de activación diferida, picker "Más
  // opciones", sheet central de acciones, drawer de soporte). El host vive por
  // encima del árbol del tab, así que mientras uno esté abierto las sesiones
  // visibles se OCULTAN temporalmente (siguen vivas; el drawer del servidor no
  // lo necesita: sobre una sesión ya se monta como RN Modal). Se usan los
  // estados *Visible* del picker y del sheet (cubren también su animación de
  // cierre). El predicado vive en `session-env` para testearlo puro.
  const sessionsSuppressed = computeSessionsSuppressed({
    nativeModuleOpen: Boolean(nativeModule),
    standaloneOpen,
    directConnectOpen: Boolean(ctrl.directConnectPanel),
    activating: Boolean(activating),
    modulePickerVisible,
    actionsSheetVisible,
    supportDrawerOpen,
  });
  // Tabs superiores del terminal (Terminal / Chat / Ajustes): misma lista que
  // pintaba el overlay previo.
  const consoleTopTabs = React.useMemo(
    () => serverDrawerTabItems(ctrl.guestMode, t, visibleComposerStarted, terminalOpen),
    [ctrl.guestMode, t, visibleComposerStarted, terminalOpen],
  );
  useEffect(() => {
    setSessionTabEnv(tabId, {
      isActiveTab,
      shellVisible,
      suppressed: sessionsSuppressed,
      consoles: {
        token: ctrl.token ?? "",
        language: ctrl.language,
        guestMode: ctrl.guestMode,
        topTabs: consoleTopTabs,
        onSelectTopTab: sessionEnvFns.onSelectTopTab,
        onCommand: sessionEnvFns.onConsoleCommand,
        onSwipe: sessionEnvFns.onSwipe,
      },
      modules: {
        theme: ctrl.theme,
        language: ctrl.language,
        repaintSignal: webviewRepaintSignal,
        floatingByPanel,
        onLoadFailed: sessionEnvFns.onModuleLoadFailed,
        onConnected: sessionEnvFns.onConnected,
        onSessionExpired: sessionEnvFns.onModuleSessionExpired,
        onRequestBack: sessionEnvFns.onRequestBack,
        onRequestOpenTabs: sessionEnvFns.onRequestOpenTabs,
        onMoreOptions: sessionEnvFns.onModuleMoreOptions,
        onOpenModuleShortcut: sessionEnvFns.onModuleShortcut,
        onRequestSetTheme: sessionEnvFns.onRequestSetTheme,
        onRequestSetLanguage: sessionEnvFns.onRequestSetLanguage,
      },
    });
  }, [tabId, isActiveTab, shellVisible, sessionsSuppressed, ctrl.token, ctrl.language, ctrl.guestMode, ctrl.theme, consoleTopTabs, webviewRepaintSignal, floatingByPanel, sessionEnvFns]);

  // Al desmontar la pestaña (cerrarla): retira su entorno y libera sus sesiones
  // en memoria (el host las desmonta). Matar sus tmux y limpiar el disco lo
  // hace `closeTabWithReap` en MainScreen.
  useEffect(() => () => {
    clearSessionTabEnv(tabId);
    disposeConsolesTab(tabId);
    disposeModulesTab(tabId);
  }, [tabId]);
}
