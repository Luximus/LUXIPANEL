// MainTab — el shell POR PESTAÑA de MainScreen (Wave D2: extraído verbatim de
// MainScreen.tsx sin cambios de semántica). Monta el controlador de la pestaña
// (useMainTabController), el TabNavigator con sus render-closures, los drawers
// laterales/sheets/overlays por pestaña y publica hacia MainScreen (vía los
// register*) el cromo que pinta el shell global (navbars, drawer derecho…).
//
// Reparto (mismo orden de hooks, extraídos verbatim a hermanos):
//  - tab-module-picker.ts   → drawer central "Más herramientas" + permisos/botones flotantes
//  - tab-server-drawer.tsx  → drawer izquierdo del servidor (estado + overlay)
//  - tab-actions-sheet.ts   → bottom-sheet central de acciones
//  - tab-back-handler.ts    → botón atrás de Android
//  - tab-session-bridge.ts  → sesiones ⇄ stack + entorno del SessionHost
//  - tab-views.tsx          → render-closures de las vistas del stack
//  - tab-shell-overlays.tsx → overlays/sheets/modales del shell
import React, { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Animated, useWindowDimensions, View } from "react-native";
import * as Crypto from "expo-crypto";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PanGestureHandler, State, type PanGestureHandlerStateChangeEvent } from "react-native-gesture-handler";

import { useAuth } from "../../context/useAuth";
import { useMainTabController } from "../../hooks/useMainTabController";
import { getCurrentCustomer, killTerminalSession, type ServerModulePermissions } from "../../api/client";
import { useTheme } from "../../hooks/useTheme";
import { getLocaleDirection, getMessages } from "../../i18n";
import { addNotificationTapListener, getInitialNotificationTap, type NotificationTapData } from "../../lib/notifications";
import { getThemeTokens } from "../../theme/colors";
import type { ServerDrawerTab } from "../../components/ServerDrawer";
// Stores de sesiones vivas (B2): ciclo de vida de consolas tmux y webviews de
// módulo POR PESTAÑA. Las sesiones en sí las renderiza el SessionHost global.
import {
  activateConsole as storeActivateConsole,
  closeConsole as storeCloseConsole,
  getConsolesTab,
  minimizeConsoles as storeMinimizeConsoles,
  openConsole as storeOpenConsole,
  renameConsole as storeRenameConsole,
  restoreConsoles,
  useConsolesTab,
} from "../../lib/console-sessions-store";
import {
  getModulesTab,
  hideModule as storeHideModule,
  restoreModuleSessions,
  useModulesTab,
} from "../../lib/module-sessions-store";
import { getDirect } from "../../api/serverApi";
import { setActivePalette, loadPanelPalette, getCachedPalette } from "../../theme/panel-palette";
import { loadFavorites, persistFavorites } from "../../components/ServerWindowCarousel";
import type { PanelRow } from "../../features/app/viewModels";
import { ACTIONS_SHEET_TABS } from "../../components/ActionsSheet";
import { useAssistantComposer } from "../../features/assistant/hooks";
import { chatController } from "../../features/assistant/chat-controller";
import { CommonActions, StackActions } from "@react-navigation/native";
import { TabNavigator } from "../../navigation/TabNavigator";
import { getNavigationRef } from "../../navigation/navigationRef";
import { VIEW_TO_ROUTE } from "../../navigation/types";
import { styles } from "../MainScreen.styles";
import { NATIVE_MODULE_IDS, type MainTabProps, type NativeModuleSession } from "./shell-types";
import { useModulePickerState } from "./tab-module-picker";
import { useServerDrawerState, renderServerDrawerOverlay } from "./tab-server-drawer";
import { useActionsSheetState } from "./tab-actions-sheet";
import { useTabBackHandler } from "./tab-back-handler";
import { useSessionBridge } from "./tab-session-bridge";
import { buildViewRenderers } from "./tab-views";
import { PersistentNativeModules } from "./PersistentNativeModules";
import { renderShellOverlays } from "./tab-shell-overlays";

export function MainTab(props: MainTabProps) {
  const {
    tabId, isActiveTab, onAutoLabelChange,
    registerGoServers, registerGoSupport, registerGoSecurity, registerGoPayments,
    registerGoJobs, registerOpenAccount, registerOpenNotifications,
    registerShareLinkHandler, registerWebViewInjector,
    autoConnect, initialView, initialSshUrl, initialPanelId, initialChatPanelId,
    onSessionChange, onViewChange, onGuestModeChange, onChatOpenChange,
    initialGuestMode, onLanguageChange, globalLanguage,
    registerBottomControls, registerProfile, keyboardShift, onRequestOpenTabMenu,
    registerServerDrawerNav, registerActionsSheetNav, registerTerminalOverlay,
    blogDrawerOpen, onOpenBlogDrawer, onCloseBlogDrawer,
    supportDrawerOpen, onOpenSupportDrawer, onCloseSupportDrawer,
  } = props;
  const ctrl = useMainTabController({
    tabId, onAutoLabelChange, autoConnect,
    initialView, initialSshUrl, initialPanelId,
    initialGuestMode,
    onSessionChange,
  });

  // Seguridad ahora es una pestaña del modal de cuenta: goToSecurityView abre el
  // modal ahí, y el propio AccountMenu aplica el gate de 2FA (step-up) al activar
  // la pestaña. Ya no se corre el reto aquí (lo haría dos veces).
  registerGoServers(tabId, ctrl.goToServersView);
  registerGoSupport(tabId, ctrl.goToSupportView);
  registerGoSecurity(tabId, ctrl.goToSecurityView);
  registerGoPayments(tabId, ctrl.goToPaymentsView);
  registerGoJobs(tabId, ctrl.goToJobsView);
  registerOpenAccount(tabId, () => ctrl.openAccountMenu());
  registerShareLinkHandler(tabId, ctrl.handleIncomingShareLink);

  useLayoutEffect(() => {
    onViewChange(tabId, ctrl.view);
  }, [tabId, ctrl.view, onViewChange]);

  useLayoutEffect(() => {
    onGuestModeChange(tabId, ctrl.guestMode);
  }, [tabId, ctrl.guestMode, onGuestModeChange]);

  useLayoutEffect(() => {
    onLanguageChange(ctrl.language);
  }, [ctrl.language, onLanguageChange]);

  // El idioma es GLOBAL (no por-tab): cuando otro tab —o Perfil— lo cambia, MainScreen lo
  // refleja en `globalLanguage` y aquí se sincroniza el controller de ESTE tab, así TODOS
  // los tabs (y sus webviews, que usan `ctrl.language`) quedan en el mismo idioma.
  // Deps SOLO `[globalLanguage]`: incluir `ctrl.language`/`ctrl.setLanguage` re-ejecutaba el
  // efecto al cambiar su identidad (cambian con el idioma) → cascada → "Maximum update
  // depth". La closure ya captura el ctrl.language/setLanguage actuales; el guard evita el
  // re-set en el tab que originó el cambio.
  useEffect(() => {
    if (globalLanguage && globalLanguage !== ctrl.language) {
      ctrl.setLanguage(globalLanguage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalLanguage]);

  const directionalStyle = { direction: getLocaleDirection(ctrl.language) } as const;
  // Safe-area inferior: el asa del sheet central debe quedar POR ENCIMA de la barra
  // de navegación de Android (si no, queda tapada al desplegar el drawer central).
  const insets = useSafeAreaInsets();
  const t = getMessages(ctrl.language);
  // Drawer central de Notificaciones (campana del top-bar): config push del
  // servidor visible. Se registra el abridor para que la campana (en MainScreen)
  // lo dispare. El avatar de cuenta se movió a un botón flotante abajo-derecha.
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  useEffect(() => {
    registerOpenNotifications(tabId, () => setNotificationsOpen(true));
    return () => registerOpenNotifications(tabId, null);
  }, [tabId, registerOpenNotifications]);
  const { userEmail: accountEmail, savedAccounts } = useAuth();
  const accountPhotoURL = accountEmail ? savedAccounts.find((a) => a.email === accountEmail)?.photoURL ?? null : null;
  const [dashboardSearch, setDashboardSearch] = useState("");
  const [dashboardFiltersSignal, setDashboardFiltersSignal] = useState(0);
  const [dashboardFilterCount, setDashboardFilterCount] = useState(0);
  const [supportSearch, setSupportSearch] = useState("");
  const [supportFiltersSignal, setSupportFiltersSignal] = useState(0);
  const [supportFilterCount, setSupportFilterCount] = useState(0);
  const [ticketDetailBottomActions, setTicketDetailBottomActions] = useState<{
    onBack: () => void;
    onAttach: () => void;
    onSend: () => void;
    attachDisabled: boolean;
    sendDisabled: boolean;
    counterLabel: string;
  } | null>(null);
  // Límite de subida DINÁMICO por rol (MB), entregado por el backend en
  // `customer.maxUploadMb` (fallback 5). Aplica a los adjuntos de soporte
  // (nuevo ticket + respuesta). Se resuelve una vez por sesión/token.
  const [maxUploadMb, setMaxUploadMb] = useState<number>(5);

  useEffect(() => {
    const token = ctrl.token;
    if (!token) { setMaxUploadMb(5); return; }
    let cancelled = false;
    void (async () => {
      const me = await getCurrentCustomer(token);
      if (!cancelled && me) setMaxUploadMb(me.maxUploadMb ?? 5);
    })();
    return () => { cancelled = true; };
  }, [ctrl.token]);
  const maxUploadBytes = maxUploadMb * 1024 * 1024;

  // Deep-link de notificaciones PUSH del servidor: al tocar una push (app en
  // background o cerrada por completo) lleva al carousel y enfoca el servidor del
  // evento (`data.panelId`). Cubre tanto el arranque en frío (la push abrió la
  // app) como el tap con la app viva.
  useEffect(() => {
    if (!ctrl.token) return;
    const focusFromTap = (data: NotificationTapData) => {
      const panelId = typeof data?.panelId === "string" ? data.panelId : null;
      if (panelId) ctrl.focusServerPanel(panelId);
    };
    void getInitialNotificationTap().then((data) => { if (data) focusFromTap(data); });
    return addNotificationTapListener(focusFromTap);
  }, [ctrl.token, ctrl.focusServerPanel]);

  // Estado del chat del servidor VISIBLE: gatea los tabs Chat/Ajustes del
  // drawer sobre el terminal (el chat en sí vive en la pantalla `Chat`, A5).
  const visibleServerId = ctrl.visibleServerPanelId ?? "";
  const visibleComposer = useAssistantComposer(visibleServerId);

  // ── A5: pantalla `Chat` del asistente ───────────────────────────────────────
  // La ruta `Chat { panelId }` se apila sobre la vista actual (patrón de las
  // rutas de sesión de B2, sincronizada aquí de forma imperativa). El estado del
  // chat vive en el `chat-store` module-level: abrir/cerrar la pantalla nunca
  // toca la conversación (goBack en mitad de un run deja el stream vivo y se
  // vuelve a él con el CTA de la portada o desde el drawer de conversaciones).
  // `chatOpenPanelId` refleja la ruta actual (lo mantiene el listener de estado
  // del stack, en tab-session-bridge) y gatea el cromo (navbars) y los tabs del drawer.
  const [chatOpenPanelId, setChatOpenPanelId] = useState<string | null>(null);
  const chatOpen = chatOpenPanelId !== null;
  const openPanelChat = useCallback((panelId: string) => {
    const token = ctrl.effectiveToken;
    if (!token || !panelId) return;
    chatController.configure(panelId, { token });
    chatController.startChat(panelId);
    // Una sola capa sobre la vista (contrato B2): si hay una sesión visible
    // (consola/módulo), se minimiza/oculta y su ruta se REEMPLAZA por la del
    // chat (goBack desde el chat vuelve SIEMPRE a la vista de fondo).
    if (getConsolesTab(tabId).activeConsoleId) storeMinimizeConsoles(tabId);
    if (getModulesTab(tabId).activeModuleId) storeHideModule(tabId);
    const nav = getNavigationRef(tabId);
    if (!nav.isReady()) return;
    const current = nav.getCurrentRoute();
    if (current?.name === "Terminal" || current?.name === "ModuleWebView") {
      nav.dispatch(StackActions.replace("Chat", { panelId }));
    } else if (current?.name !== "Chat") {
      nav.dispatch(CommonActions.navigate("Chat", { panelId }));
    } else if ((current.params as { panelId?: string } | undefined)?.panelId !== panelId) {
      nav.dispatch(StackActions.replace("Chat", { panelId }));
    }
  }, [tabId, ctrl.effectiveToken]);
  const closePanelChat = useCallback(() => {
    const nav = getNavigationRef(tabId);
    if (!nav.isReady() || nav.getCurrentRoute()?.name !== "Chat") return;
    if (nav.canGoBack()) nav.goBack();
    else nav.resetRoot({ index: 0, routes: [{ name: VIEW_TO_ROUTE[ctrl.view] }] });
  }, [tabId, ctrl.view]);

  // B3 (persistedRoute): reabre la pantalla `Chat` persistida de esta pestaña al
  // restaurarla (muerte de proceso incluida). One-shot: se consume en el primer
  // intento viable — token listo, vista ya restaurada (no splash/carga/login),
  // navigator listo y el panel presente en la lista (si el panel ya no existe o
  // la sesión no vuelve —p. ej. era de invitado—, nunca se consume y no reabre).
  const chatRestoreRef = React.useRef(initialChatPanelId);
  useEffect(() => {
    const panelId = chatRestoreRef.current;
    if (!panelId || !ctrl.effectiveToken) return;
    if (ctrl.view === "splash" || ctrl.view === "loading-panel" || ctrl.view === "login") return;
    if (!ctrl.panelRows.some((r) => r.id === panelId)) return;
    if (!getNavigationRef(tabId).isReady()) return;
    chatRestoreRef.current = undefined;
    openPanelChat(panelId);
  }, [tabId, ctrl.effectiveToken, ctrl.view, ctrl.panelRows, openPanelChat]);

  useEffect(() => {
    const isSupport = ctrl.view === "support" && !ctrl.ticketDetail.open;
    const isDashboard = ctrl.view === "dashboard";
    const isTicketDetail = ctrl.view === "support" && ctrl.ticketDetail.open;
    registerBottomControls(tabId, {
      mode: isTicketDetail ? "ticket-detail" : "search",
      view: ctrl.view,
      searchValue: isSupport ? supportSearch : dashboardSearch,
      onSearchChange: isSupport ? setSupportSearch : setDashboardSearch,
      onOpenFilters: () => {
        if (isSupport) setSupportFiltersSignal((v) => v + 1);
        else if (isDashboard) setDashboardFiltersSignal((v) => v + 1);
      },
      filterCount: isSupport ? supportFilterCount : dashboardFilterCount,
      placeholder: isSupport ? t.ticketTable.filters.search : t.panelTable.filters.search,
      show: isSupport || isDashboard || isTicketDetail,
      onAttach: isTicketDetail ? ticketDetailBottomActions?.onAttach : undefined,
      onSend: isTicketDetail ? ticketDetailBottomActions?.onSend : undefined,
      attachDisabled: isTicketDetail ? ticketDetailBottomActions?.attachDisabled : undefined,
      sendDisabled: isTicketDetail ? ticketDetailBottomActions?.sendDisabled : undefined,
      onBack: isTicketDetail ? ticketDetailBottomActions?.onBack : undefined,
      counterLabel: isTicketDetail ? ticketDetailBottomActions?.counterLabel : undefined,
    });
  }, [ctrl.view, ctrl.ticketDetail.open, supportSearch, dashboardSearch, supportFilterCount, dashboardFilterCount, t, tabId, registerBottomControls, ticketDetailBottomActions]);

  // Reporta a MainScreen los datos del controlador que el tab "Perfil" del drawer
  // de Bitácora necesita (idioma persistente, logout, nombre, nº de servidores).
  const profileServerCount = ctrl.guestMode ? ctrl.panelRows.length : ctrl.licensedCount + ctrl.unlicensedCount;
  useEffect(() => {
    registerProfile(tabId, {
      token: ctrl.token ?? "",
      setLanguage: ctrl.setLanguage,
      logout: ctrl.logout,
      displayName: ctrl.displayName,
      currentUserId: ctrl.currentUserId,
      photoURL: accountPhotoURL,
      serverCount: profileServerCount,
      balancesVersion: ctrl.balancesVersion,
      isAdmin: ctrl.isAdmin,
      paymentRows: ctrl.paymentRows,
      productRows: ctrl.productRows,
      busyPayments: ctrl.busyPayments,
      refreshPayments: ctrl.refreshPayments,
      purchasePlan: ctrl.purchasePlan,
      purchaseTokenPack: ctrl.purchaseTokenPack,
      iapReady: ctrl.iapReady,
      tokenPurchaseSignal: ctrl.tokenPurchaseSignal,
      switchAccount: ctrl.switchAccount,
      toggleTheme: ctrl.toggleTheme,
      theme: ctrl.theme,
      // Conexiones de invitado para el drawer derecho (modo invitado). Tocar una
      // enfoca su panel en el carousel y cierra el drawer.
      guestEntries: ctrl.guestHistory,
      guestPanelRows: ctrl.panelRows,
      guestActivePanelId: ctrl.visibleServerPanelId,
      // Panel activo para el tab "Asistente" del drawer derecho (Fase 4): su
      // asistente IA se configura por el túnel SSO de este servidor.
      assistantPanelId: ctrl.visibleServerPanelId,
      // "Iniciar chat" con un agente desde el tab "Asistente": navega a la
      // pantalla `Chat` del panel (A5; antes el chat vivía en el carousel).
      onOpenAssistantChat: openPanelChat,
      onGuestAdd: ctrl.openGuestAdd,
      onGuestRemove: (key: string) => { void ctrl.removeGuestSubdomainAction(key); },
      onGuestSelect: (panelId: string | null) => { if (panelId) ctrl.focusServerPanel(panelId); onCloseBlogDrawer(); },
    });
  }, [tabId, registerProfile, ctrl.token, ctrl.setLanguage, ctrl.logout, ctrl.displayName, ctrl.currentUserId, accountPhotoURL, profileServerCount, ctrl.balancesVersion, ctrl.isAdmin, ctrl.paymentRows, ctrl.productRows, ctrl.busyPayments, ctrl.refreshPayments, ctrl.purchasePlan, ctrl.purchaseTokenPack, ctrl.iapReady, ctrl.tokenPurchaseSignal, ctrl.switchAccount, ctrl.toggleTheme, ctrl.theme, ctrl.guestHistory, ctrl.panelRows, ctrl.visibleServerPanelId, openPanelChat, ctrl.openGuestAdd, ctrl.removeGuestSubdomainAction, ctrl.focusServerPanel, onCloseBlogDrawer]);

  // Puente: las acciones que abrían el modal de Tienda (compra de datos/tokens,
  // p. ej. el asistente o flujos de compra) ahora abren el drawer en el tab Tienda.
  useEffect(() => {
    if (ctrl.paymentsOpen) {
      onOpenBlogDrawer("store");
      ctrl.closePayments();
    }
  }, [ctrl.paymentsOpen, ctrl.closePayments, onOpenBlogDrawer]);

  // Puente: el avatar y los deep-links de cuenta (menu/info/seguridad/pagos) abren
  // el drawer de Bitácora en el tab correspondiente. Sustituye al dropdown/modales
  // de `AccountMenu` (ya eliminados).
  useEffect(() => {
    if (!ctrl.accountOpen) return;
    const tab = ctrl.accountInitialTab === "security"
      ? "security"
      : ctrl.accountInitialTab === "payments"
        ? "payments"
        : "profile";
    onOpenBlogDrawer(tab);
    ctrl.setAccountOpen(false);
  }, [ctrl.accountOpen, ctrl.accountInitialTab, ctrl.setAccountOpen, onOpenBlogDrawer]);

  const viewHistoryRef = React.useRef<import("../../features/app/types").View[]>([]);
  const lastViewRef = React.useRef(ctrl.view);

  useEffect(() => {
    if (lastViewRef.current !== ctrl.view) {
      viewHistoryRef.current.push(lastViewRef.current);
      lastViewRef.current = ctrl.view;
    }
  }, [ctrl.view]);

  const navigateToView = useCallback((next: import("../../features/app/types").View) => {
    // Seguridad y Pagos ya no son vistas (son modales globales), así que el
    // historial de navegación nunca las contiene aquí.
    if (next === "dashboard") ctrl.goToServersView();
    else if (next === "support") ctrl.goToSupportView();
  }, [ctrl]);

  // Drawer IZQUIERDO (opuesto del blog): info del servidor visible + SSH/Categorías.
  // Se abre con swipe-derecha en la pantalla de servidores; entra desde la izquierda.
  // (El estado abrir/cerrar/siembra vive en ./tab-server-drawer; los valores de
  // animación y estados base se declaran aquí porque el efecto de repintado del
  // webview de abajo depende de `serverDrawerVisible`.)
  const { width: serverDrawerScreenWidth } = useWindowDimensions();
  const serverDrawerWidth = Math.round(serverDrawerScreenWidth * 0.9);
  const serverDrawerTranslateX = React.useRef(new Animated.Value(-serverDrawerWidth)).current;
  const serverDrawerBackdrop = React.useRef(new Animated.Value(0)).current;
  const serverDrawerCloseTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [serverDrawerOpen, setServerDrawerOpen] = useState(false);
  const [serverDrawerVisible, setServerDrawerVisible] = useState(false);
  // Sesión utilizable de ESTA pestaña: hay token de portal (o modo invitado) y la
  // vista no es el login/splash. Al cerrar sesión los drawers laterales (servidor)
  // y el sheet central deben cerrarse y NO poder abrirse hasta volver a entrar.
  // El ref deja que `openServerDrawer`/`openActionsSheet` consulten el valor vivo
  // sin entrar en sus deps (mantiene su identidad estable).
  const sessionActive = (Boolean(ctrl.token) || ctrl.guestMode) && ctrl.view !== "login" && ctrl.view !== "splash";
  const sessionActiveRef = React.useRef(sessionActive);
  useEffect(() => { sessionActiveRef.current = sessionActive; }, [sessionActive]);
  // Señal de recompose del WebView: se incrementa cuando se CIERRA un drawer lateral
  // (RN Modal) sobre el WebView, para limpiar el "borde blanco" que deja la capa
  // hardware de Android al desmontar el Modal (ver `SshScreen.repaintSignal`).
  const [webviewRepaintSignal, setWebviewRepaintSignal] = useState(0);
  const anyLateralDrawerOpen = serverDrawerVisible || blogDrawerOpen;
  const prevLateralDrawerOpenRef = React.useRef(anyLateralDrawerOpen);
  useEffect(() => {
    const wasOpen = prevLateralDrawerOpenRef.current;
    prevLateralDrawerOpenRef.current = anyLateralDrawerOpen;
    if (!wasOpen || anyLateralDrawerOpen) return; // solo en el flanco de CIERRE
    // Recompose inmediato (drawers cuya bandera cae TRAS la animación, p. ej.
    // `serverDrawerVisible`) y otro tras la animación (drawers cuya bandera cae al
    // INICIAR el cierre, p. ej. `blogDrawerOpen`). Cada uno = toggle breve de opacidad.
    setWebviewRepaintSignal((s) => s + 1);
    const id = setTimeout(() => setWebviewRepaintSignal((s) => s + 1), 320);
    return () => clearTimeout(id);
  }, [anyLateralDrawerOpen]);
  // Tab activo del drawer izquierdo (controlado aquí para el swipe infinito).
  const [serverDrawerTab, setServerDrawerTab] = useState<ServerDrawerTab>("server");
  // Sub-tab inicial del tab SSH al abrir el drawer: "register" cuando se abre desde
  // el botón "Registrar llave SSH" (portada del carousel) para caer directo en el
  // formulario; "list" en cualquier otra apertura/navegación. Es one-shot: se
  // resetea al cerrar el drawer y al cambiar de tab manualmente.
  const [sshInitialSubTab, setSshInitialSubTab] = useState<"list" | "register">("list");
  // Suscribe MainTab a cambios de tema/PALETA (del panel activo) para repintar su
  // cromo (`serverTokens`); si no, solo repintaría al cambiar otro estado.
  useTheme();
  const serverTokens = getThemeTokens(ctrl.isDark);
  // Injector del WebView del terminal del tab activo (lo registra `SshScreen`).
  // Lo usa el tab "Snippets" del drawer para ejecutar un snippet inyectando el
  // evento `lxp-terminal:inject-command` (mismo que el `runSnippet` del panel).
  const webviewInjectRef = React.useRef<((js: string) => void) | null>(null);

  // Favoritos compartidos: el carousel ordena, el tab Server del drawer togglea.
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
  useEffect(() => { void loadFavorites().then(setFavorites); }, []);
  const toggleFavorite = useCallback((id: string) => {
    setFavorites((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      persistFavorites(next);
      return next;
    });
  }, []);

  // Panel visible (para sembrar la edición inline del tab Server) y favorito.
  const serverRows = ctrl.panelRows;
  const activeServerPanel = serverRows.find((r) => r.id === ctrl.visibleServerPanelId) ?? serverRows[0] ?? null;

  // ── Consolas (terminal nativo multi-sesión) ───────────────────────────────
  // "Nueva terminal" abre una CONSOLA: una conexión/sesión nativa INDEPENDIENTE
  // (≠ las pestañas internas de LUXIPANEL). Pueden coexistir varias (incl. de
  // distintos servidores); todas se MANTIENEN VIVAS montadas en el `SessionHost`
  // global (B2). El ciclo de vida vive en `console-sessions-store`; este tab
  // solo orquesta. El tab "Consolas" del drawer las lista, cambia y cierra; la
  // consola visible es la pantalla `Terminal` del stack de esta pestaña.
  const { consoles, activeConsoleId } = useConsolesTab(tabId);

  // Restaurar consolas persistidas de esta pestaña (FRÍAS: no se activan ni
  // conectan). El store garantiza una sola restauración por pestaña y persiste
  // los cambios posteriores con debounce (auto-rótulo incluido).
  useEffect(() => {
    void restoreConsoles(tabId);
  }, [tabId]);

  // Activa (muestra) una consola y la marca montada (la conecta si estaba fría).
  const activateConsole = useCallback((id: string) => {
    // Un solo overlay a la vez (consola vs webview de módulo): al mostrar una
    // consola se OCULTA el módulo activo, igual que `activateModule` (en el
    // store) minimiza la consola visible.
    storeHideModule(tabId);
    storeActivateConsole(tabId, id);
  }, [tabId]);
  const openNewConsole = useCallback((panel: PanelRow) => {
    if (ctrl.guestMode || !ctrl.token) return;
    // Id ALEATORIO (UUID): es el `sessionId` del reattach tmux. No-adivinable, para
    // que en escenarios multi-usuario con cuenta SSH compartida nadie pueda enganchar
    // la sesión de otro conociendo/adivinando el id.
    const id = `con-${Crypto.randomUUID()}`;
    storeHideModule(tabId);
    storeOpenConsole(tabId, { id, panelId: panel.id, panelName: panel.nameLabel || panel.source.licenseName || "" });
  }, [tabId, ctrl.guestMode, ctrl.token]);
  const minimizeConsoles = useCallback(() => storeMinimizeConsoles(tabId), [tabId]);
  // Renombrado MANUAL: fija `label`; vacío lo borra (vuelve al auto-rótulo).
  const renameConsole = useCallback((id: string, label: string) => storeRenameConsole(tabId, id, label), [tabId]);
  const closeConsole = useCallback((id: string) => {
    // Mata la sesión tmux para no dejarla huérfana en el servidor (best-effort).
    const target = consoles.find((c) => c.id === id);
    if (target && ctrl.token && !ctrl.guestMode) void killTerminalSession(target.panelId, ctrl.token, id);
    // Si se cierra la activa, el store salta a otra viva; si no queda, minimiza.
    storeCloseConsole(tabId, id);
  }, [tabId, consoles, ctrl.token, ctrl.guestMode]);

  // La consola se VE cuando hay una activa (y existe): pantalla `Terminal` en el
  // stack + superficie visible en el host. El terminal está "abierto" (→ el
  // drawer muestra el tab "Terminal") en la vista SSH o con una consola visible.
  // Minimizado (activeConsoleId=null) NO cuenta, así el drawer del dashboard se
  // comporta normal aunque haya consolas vivas.
  const consoleOverlayVisible = !ctrl.guestMode && !!activeConsoleId && consoles.some((c) => c.id === activeConsoleId);
  const terminalOpen = ctrl.view === "ssh" || consoleOverlayVisible;
  // Sube al `MainScreen` si una pantalla apilada tapa el cuerpo del tab —
  // consola nativa o pantalla `Chat` (A5) — para que oculte el ChatTopBar y el
  // navbar inferior (ambas traen su propio cromo). La vista "ssh" ya la maneja
  // `activeView`.
  useEffect(() => {
    registerTerminalOverlay(tabId, consoleOverlayVisible || chatOpen);
  }, [tabId, consoleOverlayVisible, chatOpen, registerTerminalOverlay]);
  const activeConsole = consoles.find((c) => c.id === activeConsoleId) ?? null;
  const nativeTerminalPanel = activeConsole ? serverRows.find((r) => r.id === activeConsole.panelId) ?? null : null;

  // ── Sesiones de MÓDULO (webviews de LUXIPANEL — UNA por panel) ─────────────
  // "Más opciones"/chat/terminal → reutilizan UNA SOLA webview por panel: en vez de
  // abrir otra, navegan por SPA (ClientRouter de Astro) o abren el drawer flotante
  // DENTRO de la webview ya cargada. "Atrás" la OCULTA (sigue viva/caliente), no la
  // destruye. El carousel pre-carga (oculta) la webview del slide visible. El ciclo
  // de vida (montaje, tope blando, activación diferida, pre-warm, re-acuñado SSO)
  // vive en `module-sessions-store` (B2) y las webviews las renderiza el
  // `SessionHost` global; este tab solo orquesta.
  const { sessions: moduleSessions, activeModuleId, activating } = useModulesTab(tabId);
  // Sesión de módulo NATIVO (pantalla RN) montada sobre el dashboard, en paralelo
  // a los webviews de módulos. null = ninguna abierta.
  const [nativeModule, setNativeModule] = useState<NativeModuleSession | null>(null);
  // Overlay del gestor de servidores STANDALONE (conexión directa, sin LP-LS).
  // Autocontenido: lista/alta/selector y monta las MISMAS pantallas nativas.
  const [standaloneOpen, setStandaloneOpen] = useState(false);

  // Restaurar sesiones de módulo persistidas (FRÍAS: sin redirectUrl ni montar).
  // El store garantiza una sola restauración y persiste cambios con debounce
  // (nunca el redirectUrl).
  useEffect(() => {
    void restoreModuleSessions(tabId);
  }, [tabId]);

  // Atrás dentro de un módulo: OCULTA (la sesión sigue montada/caliente para
  // reabrir instantáneo); no destruye ni gasta datos. Soltar una sesión (fallo
  // de PRE-WARM / SSO caducada) lo hace `storeDropModuleSession` desde los
  // callbacks del host (en tab-session-bridge).
  const hideModule = useCallback(() => storeHideModule(tabId), [tabId]);

  // Built-in modules use RN screens. A direct session is required because the
  // retired LP-LS module gateway cannot serve these requests anymore.
  const openModuleSession = useCallback(async (panel: PanelRow, moduleId: string, route: string, moduleName?: string) => {
    if (!ctrl.effectiveToken) return;
    if (NATIVE_MODULE_IDS.has(moduleId)) {
      setNativeModule({ panelId: panel.id, moduleId });
      return;
    }
    // No server module falls back to the embedded panel. Community pages are
    // not exposed by the current panel runtime, so unknown ids stay closed.
    void route;
    void moduleName;
  }, [ctrl.effectiveToken, ctrl.openDirectConnect]);

  const openToolSession = useCallback(async (panel: PanelRow, tool: "assistant" | "terminal", perms: ServerModulePermissions) => {
    if (!ctrl.effectiveToken) return;
    setPermsByPanel((cur) => ({ ...cur, [panel.id]: perms }));
    if (tool === "terminal") {
      openNewConsole(panel);
      return;
    }
    openPanelChat(panel.id);
  }, [ctrl.effectiveToken, openNewConsole, openPanelChat]);

  const serverRowsRef = React.useRef(serverRows);
  serverRowsRef.current = serverRows;

  // Invitado incluido: el webview de módulo/herramienta del invitado también es una
  // sesión visible normal (antes el `!guestMode` lo ocultaba y los botones "no
  // hacían nada"). Las webviews montadas las renderiza el SessionHost.
  const moduleOverlayVisible = !!activeModuleId && moduleSessions.some((m) => m.id === activeModuleId);

  // Buscar un servidor en el navbar superior MIENTRAS hay un módulo (webview) abierto
  // en overlay devuelve al usuario a la vista de servidores (carousel) para que vea el
  // resultado del filtro. Se dispara al ESCRIBIR en la búsqueda (su valor cambió y no
  // está vacío), NO al abrirse el módulo (que no cambia el texto) → así no cierra un
  // módulo recién abierto que arrastre una búsqueda previa. El filtro del carousel
  // (PanelCardGrid) trata a los favoritos como a cualquier panel —solo aparecen si
  // cumplen el criterio, no por estar marcados— y solo los reordena al frente.
  const prevDashSearchRef = React.useRef(dashboardSearch);
  useEffect(() => {
    const prev = prevDashSearchRef.current;
    prevDashSearchRef.current = dashboardSearch;
    if (moduleOverlayVisible && dashboardSearch !== prev && dashboardSearch.trim()) hideModule();
  }, [dashboardSearch, moduleOverlayVisible, hideModule]);

  // ¿Hay un WebView nativo a pantalla completa TAPANDO el navbar? (vista SSH,
  // terminal nativo o webview de módulo). En ese caso el drawer izquierdo debe ir
  // en un RN Modal (por ENCIMA del WebView) y pintar SUS PROPIOS tabs, porque el
  // `DrawerTopBar` del navbar queda detrás del overlay y no se ve.
  const overlayOverNavbar = terminalOpen || moduleOverlayVisible || Boolean(nativeModule || ctrl.directConnectPanel);
  // Tabs Chat/Ajustes del drawer izquierdo: con la pantalla `Chat` abierta o
  // sobre un terminal con una conversación en curso (A5: `started` ya no
  // significa "chat a la vista" — el carousel siempre muestra portadas).
  const chatTabsOn = chatOpen || (visibleComposer.started && terminalOpen);

  // ── Drawer central "Más herramientas" + permisos por panel + botones
  // flotantes (extraído verbatim a ./tab-module-picker; mismo orden de hooks).
  const {
    modulePickerError, modulePickerLoading, retryModulePicker,
    modulePickerOpen, modulePickerVisible, modulePickerPanel, modulePickerAvailable,
    modulePickerTools, modulePickerAtTop, setModulePickerAtTop,
    permsByPanel, setPermsByPanel, floatingByPanel, toggleFloating, openModuleShortcut,
    modulePickerTranslateY, modulePickerBackdrop, modulePickerDragY,
    openModulePicker, closeModulePicker, onModulePickerGesture, handleModulePickerSwipe,
  } = useModulePickerState({ t, token: ctrl.effectiveToken ?? "", moduleSessions, openModuleSession });

  // ── Paleta de tema del panel ACTIVO (copiada de "ajustes → apariencia" de
  // LUXIPANEL) aplicada al UI del app mientras estás sobre ese panel. El panel
  // "en foco" es: la consola visible > el panel SSH conectado > el visible del
  // carousel. Solo la PESTAÑA activa controla la paleta global (las inactivas
  // siguen montadas pero no la pisan). Cambia de panel → cambia la paleta.
  const themedPanelId = ctrl.guestMode
    ? null
    : consoleOverlayVisible
      ? (activeConsole?.panelId ?? null)
      : ctrl.view === "ssh"
        ? (ctrl.activePanelId ?? null)
        : (ctrl.visibleServerPanelId ?? null);
  // Panel cuya paleta YA está aplicada (resuelta). El carousel lo usa para mostrar
  // skeleton hasta que el color del panel visible esté listo (sin flash de color).
  const [palettePanelId, setPalettePanelId] = useState<string | null>(null);
  useEffect(() => {
    if (!isActiveTab) return;
    if (!themedPanelId || !ctrl.token || ctrl.guestMode) {
      setActivePalette(null);
      setPalettePanelId(themedPanelId ?? null); // sin panel/invitado → "listo" (base)
      return;
    }
    // Si ya está en caché (incl. resuelta a "sin paleta"), aplícala SÍNCRONO: sin
    // hueco ni skeleton. Si no, deja el skeleton hasta que cargue el branding.
    const cached = getCachedPalette(themedPanelId);
    if (cached !== undefined) {
      setActivePalette(cached);
      setPalettePanelId(themedPanelId);
      return;
    }
    let cancelled = false;
    void loadPanelPalette(themedPanelId, ctrl.token).then((p) => {
      if (cancelled) return;
      setActivePalette(p);
      setPalettePanelId(themedPanelId);
    });
    return () => { cancelled = true; };
  }, [isActiveTab, themedPanelId, ctrl.token, ctrl.guestMode]);

  // ── Drawer izquierdo del servidor: estado + siembra del editor inline
  // (extraído verbatim a ./tab-server-drawer; mismo orden de hooks).
  const {
    openServerDrawer, closeServerDrawer, handleServerDrawerSwipe,
    manageAccessOpen, setManageAccessOpen, publicProfile, setPublicProfile,
  } = useServerDrawerState({
    ctrl, tabId, t, activeServerPanel, chatTabsOn, terminalOpen, overlayOverNavbar,
    registerServerDrawerNav, sessionActiveRef,
    serverDrawerWidth, serverDrawerTranslateX, serverDrawerBackdrop, serverDrawerCloseTimer,
    serverDrawerOpen, setServerDrawerOpen, serverDrawerVisible, setServerDrawerVisible,
    serverDrawerTab, setServerDrawerTab, setSshInitialSubTab,
  });

  // ── Bottom-sheet CENTRAL (swipe-up): New/Import/Export/Usage/Integrations/API
  // (extraído verbatim a ./tab-actions-sheet; mismo orden de hooks).
  const {
    actionsSheetOpen, actionsSheetVisible, actionsSheetTab, setActionsSheetTab,
    actionsSheetTranslateY, actionsSheetBackdrop, actionsSheetDragY,
    openActionsSheet, closeActionsSheet, onActionsSheetGesture,
    handleActionsSheetSwipe, handleOpenSheetSwipe,
  } = useActionsSheetState({
    ctrl, tabId, t, registerActionsSheetNav, sessionActive, sessionActiveRef,
    serverDrawerOpen, closeServerDrawer,
  });

  // Botón atrás de Android (extraído verbatim a ./tab-back-handler).
  useTabBackHandler({
    ctrl, isActiveTab, nativeModule, setNativeModule, modulePickerOpen, closeModulePicker,
    moduleOverlayVisible, activeModuleId, hideModule, actionsSheetOpen, closeActionsSheet,
    serverDrawerOpen, closeServerDrawer, blogDrawerOpen, onCloseBlogDrawer,
    consoleOverlayVisible, minimizeConsoles, chatOpen, closePanelChat,
    navigateToView, viewHistoryRef,
  });

  const handleSwipe = useCallback((event: PanGestureHandlerStateChangeEvent) => {
    const { oldState, translationX, translationY, velocityX } = event.nativeEvent;
    if (oldState !== State.ACTIVE) return;
    const horizontal = Math.abs(translationX) >= 32 || Math.abs(velocityX) >= 550;
    if (!horizontal) return;
    if (Math.abs(translationX) < Math.abs(translationY) * 0.8 && Math.abs(velocityX) < 550) return;
    // Sheet central desplegado: el swipe lateral cambia SUS tabs (cíclico) y NUNCA
    // abre los drawers laterales. Este handler externo gana al gesto horizontal
    // (su activeOffsetX es menor que el del sheet), así que el ciclo de tabs vive
    // aquí tanto si el dedo va sobre el sheet como sobre el backdrop.
    if (actionsSheetOpen) {
      const idx = Math.max(0, ACTIONS_SHEET_TABS.indexOf(actionsSheetTab));
      if (translationX < 0) setActionsSheetTab(ACTIONS_SHEET_TABS[(idx + 1) % ACTIONS_SHEET_TABS.length]);
      else setActionsSheetTab(ACTIONS_SHEET_TABS[(idx - 1 + ACTIONS_SHEET_TABS.length) % ACTIONS_SHEET_TABS.length]);
      return;
    }
    // El detalle de ticket no participa del carrusel (su gesto es scroll/volver).
    if (blogDrawerOpen) {
      if (translationX > 24 || velocityX > 550) onCloseBlogDrawer();
      return;
    }
    if (serverDrawerOpen) {
      if (translationX < -24 || velocityX < -550) closeServerDrawer();
      return;
    }
    // Swipe-izquierda → blog (drawer derecho); swipe-derecha → drawer del servidor
    // (drawer izquierdo), en la pantalla de servidores y también con el terminal
    // abierto (vista SSH) para llegar al tab "Snippets".
    if (translationX < -24 || velocityX < -550) onOpenBlogDrawer();
    else if ((translationX > 24 || velocityX > 550) && (ctrl.view === "dashboard" || ctrl.view === "ssh")) openServerDrawer();
  }, [actionsSheetOpen, actionsSheetTab, blogDrawerOpen, serverDrawerOpen, closeServerDrawer, openServerDrawer, ctrl.view, onCloseBlogDrawer, onOpenBlogDrawer]);

  // Vistas SIN shell: splash/carga/login/ssh eran early-returns que NO montaban
  // overlays, modales, sheets ni el gesto lateral del shell. Se conserva ese
  // contrato exacto gateando el bloque del shell (abajo) con esta bandera.
  const shellVisible = ctrl.view !== "splash" && ctrl.view !== "loading-panel"
    && ctrl.view !== "login" && ctrl.view !== "ssh";

  // Puente sesiones ⇄ stack + entorno del SessionHost (extraído verbatim a
  // ./tab-session-bridge; mismo orden de hooks).
  useSessionBridge({
    ctrl, tabId, isActiveTab, t, shellVisible,
    consoleOverlayVisible, activeConsole, activeConsoleId,
    moduleOverlayVisible, activeModuleId,
    chatRestoreRef, setChatOpenPanelId, onChatOpenChange,
    openServerDrawer, handleSwipe, hideModule, onRequestOpenTabMenu,
    openModulePicker, openModuleShortcut, openModuleSession, permsByPanel, serverRowsRef,
    nativeModule, standaloneOpen, activating, modulePickerVisible, actionsSheetVisible,
    supportDrawerOpen, visibleComposerStarted: visibleComposer.started, terminalOpen,
    webviewRepaintSignal, floatingByPanel,
  });

  // Overlay del drawer izquierdo (in-tree o RN Modal): render en ./tab-server-drawer.
  const renderDrawerOverlay = (asModal = false) => renderServerDrawerOverlay({
    ctrl, t, insets, serverTokens, serverDrawerVisible, serverDrawerWidth,
    serverDrawerTranslateX, serverDrawerBackdrop, serverDrawerTab, setServerDrawerTab,
    setSshInitialSubTab, sshInitialSubTab, closeServerDrawer, handleServerDrawerSwipe,
    overlayOverNavbar, chatTabsOn, terminalOpen, serverRows, activeServerPanel,
    nativeTerminalPanel, moduleOverlayVisible, activeModuleId, moduleSessions,
    favorites, toggleFavorite, openPanelChat, consoleOverlayVisible, activeConsoleId,
    consoles, activateConsole, closeConsole, renameConsole, openNewConsole, webviewInjectRef,
  }, asModal);

  // ── B1 (transicional): render-closures de las VISTAS del stack, extraídas
  // verbatim a ./tab-views (sin hooks: se reconstruyen por render igual que las
  // closures inline que reemplazan). `ctrl.view` sigue siendo la fuente de
  // verdad y el stack solo la refleja (ver src/navigation/TabNavigator.tsx).
  const viewRenderers = buildViewRenderers({
    ctrl, tabId, isActiveTab, t, directionalStyle, insets, serverTokens, accountPhotoURL,
    serverRows, favorites, palettePanelId, webviewRepaintSignal, webviewInjectRef,
    registerWebViewInjector, onRequestOpenTabMenu, visibleComposerStarted: visibleComposer.started,
    keyboardShift, maxUploadBytes, handleSwipe, openServerDrawer,
    renderServerDrawerOverlay: renderDrawerOverlay, openActionsSheet, openPanelChat,
    closePanelChat, setSshInitialSubTab, toggleFavorite, openNewConsole,
    setManageAccessOpen, setPublicProfile, openModulePicker, blogDrawerOpen,
    onOpenBlogDrawer, onCloseBlogDrawer, onOpenSupportDrawer, dashboardSearch,
    setDashboardSearch, dashboardFiltersSignal, setDashboardFilterCount, supportSearch,
    setSupportSearch, supportFiltersSignal, setSupportFilterCount, setTicketDetailBottomActions,
  });

  return (
    // Con un webview de MÓDULO a pantalla completa, se DESACTIVA el gesto lateral
    // (abrir drawers) para que el WebView reciba todos los toques y haga scroll en
    // cualquier dirección. Las acciones laterales ya están en los botones de borde.
    // (También evita que la ventana de `failOffsetY` compita con el scroll vertical.)
    // En las vistas sin shell el gesto tampoco existe (sus early-returns no lo
    // montaban; la vista SSH trae su PROPIO PanGestureHandler dentro de su screen).
    <PanGestureHandler enabled={shellVisible && !moduleOverlayVisible && !nativeModule && !ctrl.directConnectPanel} onHandlerStateChange={handleSwipe} activeOffsetX={[-8, 8]} failOffsetY={[-28, 28]}>
      <View style={[styles.fill, directionalStyle]}>
        {/* Núcleo de navegación por pestaña (B1+B2): UNA ruta de vista
            sincronizada desde ctrl.view (reset, nunca push) y, encima, la ruta
            de sesión (Terminal/ModuleWebView) sincronizada desde los stores de
            sesiones. El botón atrás lo sigue resolviendo íntegro el BackHandler
            manual (./tab-back-handler). Los overlays/modales/sheets del shell
            (./tab-shell-overlays) quedan FUERA del navigator, montados encima,
            igual que antes (migrarlos es B5). */}
        <TabNavigator tabId={tabId} view={ctrl.view} renderers={viewRenderers} />
        {ctrl.effectiveToken ? <PersistentNativeModules active={nativeModule ?? (ctrl.directConnectPanel ? {panelId: ctrl.directConnectPanel.id, moduleId: ctrl.directConnectModuleId as NativeModuleSession["moduleId"]} : null)} accountId={ctrl.currentUserId} token={ctrl.effectiveToken} visible={shellVisible && isActiveTab} onClose={() => { setNativeModule(null); ctrl.closeDirectConnect(); }}/> : null}
        {shellVisible ? renderShellOverlays({
          ctrl, tabId, isActiveTab, t, insets, serverTokens, maxUploadBytes,
          nativeModule, setNativeModule, standaloneOpen, setStandaloneOpen, activating,
          consoleOverlayVisible, moduleOverlayVisible, renderServerDrawerOverlay: renderDrawerOverlay,
          serverDrawerVisible, blogDrawerOpen, supportDrawerOpen, onCloseSupportDrawer,
          onOpenSupportDrawer, onOpenBlogDrawer, visibleComposerStarted: visibleComposer.started,
          publicProfile, setPublicProfile, manageAccessOpen, setManageAccessOpen,
          activeServerPanel, notificationsOpen, setNotificationsOpen,
          actionsSheetVisible, actionsSheetTab, setActionsSheetTab, actionsSheetTranslateY,
          actionsSheetBackdrop, actionsSheetDragY, openActionsSheet, closeActionsSheet,
          onActionsSheetGesture, handleActionsSheetSwipe, handleOpenSheetSwipe,
          modulePickerVisible, modulePickerAtTop, setModulePickerAtTop, modulePickerPanel,
          modulePickerError, modulePickerLoading, retryModulePicker,
          modulePickerAvailable, modulePickerTools, modulePickerTranslateY, modulePickerBackdrop,
          modulePickerDragY, closeModulePicker, onModulePickerGesture, handleModulePickerSwipe,
          openModuleSession, openToolSession, floatingByPanel, toggleFloating,
        }) : null}
      </View>
    </PanGestureHandler>
  );
}
