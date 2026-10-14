import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Animated, Easing, Keyboard, Linking, Platform, StatusBar, View, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { PanGestureHandler, State, type PanGestureHandlerStateChangeEvent } from "react-native-gesture-handler";

// SafeAreaView from react-native-safe-area-context already handles the
// Android status bar inset, but with `edgeToEdgeEnabled: true` in app.json
// the status bar draws transparent OVER the content. We restrict the inset
// to top/left/right so the bottom (gesture / nav bar) stays edge-to-edge.
import { useAuth } from "../context/useAuth";
import {
  closeTab as storeCloseTab,
  hydrateTabSessions,
  openNewTab as storeOpenNewTab,
  renameTab as storeRenameTab,
  setActiveTab as storeSetActiveTab,
  setTabAutoLabel as storeSetTabAutoLabel,
  updateTabChatRoute,
  updateTabSession as storeUpdateTabSession,
  useTabSessions,
} from "../navigation/tab-sessions-store";
import { killTerminalSession } from "../api/client";
import { TitleBarTabs } from "../components/TitleBarTabs";
import { useTheme } from "../hooks/useTheme";
import { getLocaleDirection, getMessages } from "../i18n";
import { hydrateSessionState, loadSessionState } from "../lib/session-state";
import { getThemeTokens } from "../theme/colors";
// Limpieza al cerrar una pestaña entera (closeTabWithReap): mata las tmux de sus
// consolas persistidas y borra su estado en disco. El resto del ciclo de vida de
// sesiones vive en MainTab (src/screens/main/MainTab.tsx).
import { clearConsoles, loadConsoles } from "../lib/console-sessions-store";
import { clearModuleSessions } from "../lib/module-sessions-store";
import BlogDrawerContent, { type BlogDrawerTab, type DrawerData, type ProfileSubTab, BLOG_DRAWER_TABS } from "../components/BlogDrawerContent";
import { ChatTopBar } from "../components/ChatTopBar";
import { DrawerTopBar } from "../components/DrawerTopBar";
import { SessionHost } from "../sessions/SessionHost";
import { styles } from "./MainScreen.styles";
// Wave D2: el shell POR PESTAÑA (MainTab), sus modales, el cromo compartido y
// los tipos del shell viven en ./main/ — este archivo solo orquesta el shell
// GLOBAL (pestañas, navbars, drawer derecho, drawer de soporte, SessionHost).
import { MainTab } from "./main/MainTab";
import { AnimatedPressable } from "./main/shell-chrome";
import type {
  ActionsSheetNav,
  BlogDrawerTarget,
  BottomControls,
  ProfileBundle,
  ServerDrawerNav,
} from "./main/shell-types";

export default function MainScreen() {
  // B3: las pestañas viven en el `tab-sessions-store` module-level (persistencia
  // v2 con migración v1→v2); aquí solo se leen de forma reactiva y se hidratan
  // una vez. Las mutaciones son funciones del store (identidad estable).
  const { tabs, activeTabId } = useTabSessions();
  useEffect(() => {
    void hydrateTabSessions();
  }, []);
  const { token, userEmail } = useAuth();
  // Cerrar una pestaña entera: ANTES de cerrarla, mata las sesiones tmux de SUS
  // consolas (si no, quedarían detached en el servidor hasta el reaper de 24h) y
  // borra su entrada del store. Solo si la pestaña realmente se va a cerrar (la fija
  // no se cierra). Best-effort sobre la lista persistida (la viva está en su MainTab).
  const closeTabWithReap = useCallback((tabId: string) => {
    const target = tabs.find((t) => t.id === tabId);
    const willClose = !!target && !target.fixed && tabs.length > 1;
    if (willClose) {
      void (async () => {
        try {
          const list = await loadConsoles(tabId);
          if (token) await Promise.all(list.map((c) => killTerminalSession(c.panelId, token, c.id)));
        } catch { /* best-effort: el reaper de 24h recoge lo que falle */ }
        await clearConsoles(tabId);
        // Las sesiones de módulo no tienen tmux (el SSO caduca solo): solo limpiar disco.
        await clearModuleSessions(tabId);
      })();
    }
    storeCloseTab(tabId);
  }, [tabs, token]);
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const tokens = getThemeTokens(theme === "dark");
  const [language, setLanguage] = useState<string>(() => loadSessionState().language);
  const messages = getMessages(language);
  const [tabViews, setTabViews] = useState<Record<string, string>>({});
  const [tabGuestModes, setTabGuestModes] = useState<Record<string, boolean>>({});
  const [tabInitialGuest, setTabInitialGuest] = useState<Record<string, boolean>>({});
  const [blogDrawerVisible, setBlogDrawerVisible] = useState(false);
  const [blogDrawerOpen, setBlogDrawerOpen] = useState(false);
  // El drawer derecho arranca SIEMPRE en "Comunidad" (su primer tab; sub-tab
  // "Publicaciones"). Los destinos explícitos (Pestañas/Perfil/Tienda) siguen
  // funcionando porque se piden por nombre vía `openBlogDrawer(<tab>)`.
  const [blogDrawerTab, setBlogDrawerTab] = useState<BlogDrawerTab>("blog");
  const [profileSubTab, setProfileSubTab] = useState<ProfileSubTab>("info");
  const [profileByTab, setProfileByTab] = useState<Record<string, ProfileBundle>>({});
  const [supportDrawerOpen, setSupportDrawerOpen] = useState(false);
  // Sesión activa de la pestaña visible (ver `activeSessionActive` más abajo): los
  // drawers globales (derecho/blog y soporte) se cierran y NO pueden abrirse al
  // cerrar sesión. El ref expone el valor vivo a `openBlogDrawer`/`openSupportDrawer`
  // sin meterlo en sus deps (conserva su identidad estable).
  const activeSessionActiveRef = React.useRef(Boolean(token));
  const goServersMap = React.useRef<Record<string, (() => void) | undefined>>({});
  const goSupportMap = React.useRef<Record<string, (() => void) | undefined>>({});
  const goSecurityMap = React.useRef<Record<string, (() => void) | undefined>>({});
  const goPaymentsMap = React.useRef<Record<string, (() => void) | undefined>>({});
  const goJobsMap = React.useRef<Record<string, (() => void) | undefined>>({});
  const openAccountMap = React.useRef<Record<string, (() => void) | undefined>>({});
  const openNotificationsMap = React.useRef<Record<string, (() => void) | undefined>>({});
  const shareLinkHandlerMap = React.useRef<Record<string, ((url: string) => void) | undefined>>({});
  const webViewInjectorMap = React.useRef<Record<string, ((js: string) => void) | undefined>>({});
  const activeTabIdRef = React.useRef(activeTabId);
  const keyboardShift = React.useRef(new Animated.Value(0)).current;
  const { width: screenWidth } = useWindowDimensions();
  const blogDrawerWidth = Math.round(screenWidth * 0.9);
  const blogDrawerTranslateX = React.useRef(new Animated.Value(blogDrawerWidth)).current;
  const blogDrawerBackdrop = React.useRef(new Animated.Value(0)).current;
  const blogDrawerCloseTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [bottomControlsByTab, setBottomControlsByTab] = useState<Record<string, BottomControls>>({});
  const [serverDrawerNavByTab, setServerDrawerNavByTab] = useState<Record<string, ServerDrawerNav | null>>({});
  const [actionsSheetNavByTab, setActionsSheetNavByTab] = useState<Record<string, ActionsSheetNav | null>>({});
  // Consola nativa (abierta desde el chat) que tapa el cuerpo del tab: oculta el
  // navbar del chat (arriba) y el composer (abajo), ajenos al terminal.
  const [terminalOverlayByTab, setTerminalOverlayByTab] = useState<Record<string, boolean>>({});

  const registerGoServers = useCallback((tabId: string, handler: (() => void) | null) => {
    goServersMap.current[tabId] = handler ?? undefined;
  }, []);
  const registerGoSupport = useCallback((tabId: string, handler: (() => void) | null) => {
    goSupportMap.current[tabId] = handler ?? undefined;
  }, []);
  const registerGoSecurity = useCallback((tabId: string, handler: (() => void) | null) => {
    goSecurityMap.current[tabId] = handler ?? undefined;
  }, []);
  const registerGoPayments = useCallback((tabId: string, handler: (() => void) | null) => {
    goPaymentsMap.current[tabId] = handler ?? undefined;
  }, []);
  const registerGoJobs = useCallback((tabId: string, handler: (() => void) | null) => {
    goJobsMap.current[tabId] = handler ?? undefined;
  }, []);
  const registerOpenAccount = useCallback((tabId: string, handler: (() => void) | null) => {
    openAccountMap.current[tabId] = handler ?? undefined;
  }, []);
  const registerOpenNotifications = useCallback((tabId: string, handler: (() => void) | null) => {
    openNotificationsMap.current[tabId] = handler ?? undefined;
  }, []);
  const registerShareLinkHandler = useCallback((tabId: string, handler: ((url: string) => void) | null) => {
    shareLinkHandlerMap.current[tabId] = handler ?? undefined;
  }, []);
  const registerWebViewInjector = useCallback((tabId: string, inject: ((js: string) => void) | null) => {
    webViewInjectorMap.current[tabId] = inject ?? undefined;
  }, []);
  const setTabView = useCallback((tabId: string, view: string) => {
    setTabViews((prev) => (prev[tabId] === view ? prev : { ...prev, [tabId]: view }));
  }, []);
  const setTabGuestMode = useCallback((tabId: string, guest: boolean) => {
    setTabGuestModes((prev) => (prev[tabId] === guest ? prev : { ...prev, [tabId]: guest }));
  }, []);
  const registerBottomControls = useCallback((tabId: string, controls: BottomControls) => {
    setBottomControlsByTab((prev) => ({ ...prev, [tabId]: controls }));
  }, []);
  const registerServerDrawerNav = useCallback((tabId: string, nav: ServerDrawerNav | null) => {
    setServerDrawerNavByTab((prev) => (prev[tabId] === nav ? prev : { ...prev, [tabId]: nav }));
  }, []);
  const registerTerminalOverlay = useCallback((tabId: string, visible: boolean) => {
    setTerminalOverlayByTab((prev) => (prev[tabId] === visible ? prev : { ...prev, [tabId]: visible }));
  }, []);
  const registerActionsSheetNav = useCallback((tabId: string, nav: ActionsSheetNav | null) => {
    setActionsSheetNavByTab((prev) => (prev[tabId] === nav ? prev : { ...prev, [tabId]: nav }));
  }, []);
  // El efecto que llama a esto en `MainTab` solo dispara cuando cambia algún dato
  // real del controlador (sus deps son refs estables), así que basta con escribir
  // siempre: no hay bucle de render.
  const registerProfile = useCallback((tabId: string, bundle: ProfileBundle) => {
    setProfileByTab((prev) => ({ ...prev, [tabId]: bundle }));
  }, []);
  const handleLogoClick = useCallback(() => {
    goServersMap.current[activeTabId]?.();
  }, [activeTabId]);
  // Selección de la pestaña fija "Servers": la activa y la fuerza a la pantalla
  // de servidores, sin importar en qué vista estuviera.
  const handleSelectServersTab = useCallback((tabId: string) => {
    storeSetActiveTab(tabId);
    goServersMap.current[tabId]?.();
  }, []);
  const handleGoSupport = useCallback(() => {
    goSupportMap.current[activeTabId]?.();
  }, [activeTabId]);
  const handleGoSecurity = useCallback(() => {
    goSecurityMap.current[activeTabId]?.();
  }, [activeTabId]);
  const handleGoPayments = useCallback(() => {
    goPaymentsMap.current[activeTabId]?.();
  }, [activeTabId]);
  const handleOpenAccount = useCallback(() => {
    openAccountMap.current[activeTabId]?.();
  }, [activeTabId]);
  const handleOpenNotifications = useCallback(() => {
    openNotificationsMap.current[activeTabId]?.();
  }, [activeTabId]);
  const openBlogDrawer = useCallback((tab: BlogDrawerTarget = "blog") => {
    // Sin sesión (login tras cerrar sesión): el drawer derecho no se despliega.
    if (!activeSessionActiveRef.current) return;
    if (blogDrawerCloseTimer.current) {
      clearTimeout(blogDrawerCloseTimer.current);
      blogDrawerCloseTimer.current = null;
    }
    // Bitácora/Seguridad/Pagos ya son sub-tabs de "Perfil": al pedir uno de esos
    // destinos, abre "profile" con el sub-tab correspondiente preseleccionado.
    if (tab === "worklog" || tab === "security" || tab === "payments") {
      setProfileSubTab(tab);
      setBlogDrawerTab("profile");
    } else {
      if (tab === "profile") setProfileSubTab("info");
      setBlogDrawerTab(tab);
    }
    setBlogDrawerVisible(true);
    setBlogDrawerOpen(true);
  }, []);
  // El puente LUXIPANEL (mensaje `open-panel-tabs` desde el webview) y cualquier
  // petición de abrir el gestor de pestañas abren el drawer derecho en el tab
  // "Pestañas" (reemplaza al antiguo modal de pestañas del navbar).
  const handleRequestOpenTabMenu = useCallback(() => openBlogDrawer("tabs"), [openBlogDrawer]);
  const openSupportDrawer = useCallback(() => {
    // Sin sesión (login tras cerrar sesión): el drawer de soporte no se despliega.
    if (!activeSessionActiveRef.current) return;
    setSupportDrawerOpen(true);
  }, []);
  const closeSupportDrawer = useCallback(() => {
    setSupportDrawerOpen(false);
  }, []);
  const closeBlogDrawer = useCallback(() => {
    setBlogDrawerOpen(false);
    if (blogDrawerCloseTimer.current) clearTimeout(blogDrawerCloseTimer.current);
    blogDrawerCloseTimer.current = setTimeout(() => {
      setBlogDrawerVisible(false);
      blogDrawerCloseTimer.current = null;
    }, 240);
  }, []);
  // Cambio de tab de primer nivel del drawer derecho (tap o swipe). El sub-tab de
  // "Perfil" vuelve a "Información" (primero) al cambiar de tab, para que "Perfil"
  // siempre empiece en su primer sub-tab al volver a él, no donde quedó.
  const changeBlogDrawerTab = useCallback((next: BlogDrawerTab) => {
    setBlogDrawerTab(next);
    setProfileSubTab("info");
  }, []);
  const handleBlogDrawerSwipe = useCallback((event: PanGestureHandlerStateChangeEvent) => {
    const { oldState, translationX, translationY, velocityX } = event.nativeEvent;
    if (oldState !== State.ACTIVE) return;
    if (Math.abs(translationX) < 24 && Math.abs(velocityX) < 550) return;
    if (Math.abs(translationX) < Math.abs(translationY) * 0.8 && Math.abs(velocityX) < 550) return;
    const n = BLOG_DRAWER_TABS.length;
    const idx = Math.max(0, BLOG_DRAWER_TABS.indexOf(blogDrawerTab));
    // Swipe-izquierda → siguiente tab; swipe-derecha → anterior. Cíclico (infinito):
    // desde el último vuelve al primero y viceversa. El cierre es por la X / backdrop.
    if (translationX < -18 || velocityX < -550) changeBlogDrawerTab(BLOG_DRAWER_TABS[(idx + 1) % n]);
    else if (translationX > 18 || velocityX > 550) changeBlogDrawerTab(BLOG_DRAWER_TABS[(idx - 1 + n) % n]);
  }, [blogDrawerTab, changeBlogDrawerTab]);

  useEffect(() => {
    void hydrateSessionState().then((s) => setLanguage(s.language));
  }, []);

  useEffect(() => () => {
    if (blogDrawerCloseTimer.current) clearTimeout(blogDrawerCloseTimer.current);
  }, []);

  useEffect(() => {
    if (blogDrawerOpen) {
      setBlogDrawerVisible(true);
      blogDrawerTranslateX.setValue(blogDrawerWidth);
      blogDrawerBackdrop.setValue(0);
      Animated.parallel([
        Animated.timing(blogDrawerTranslateX, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(blogDrawerBackdrop, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }
    if (!blogDrawerVisible) return;
    Animated.parallel([
      Animated.timing(blogDrawerTranslateX, {
        toValue: blogDrawerWidth,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(blogDrawerBackdrop, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [blogDrawerOpen, blogDrawerVisible, blogDrawerBackdrop, blogDrawerTranslateX, blogDrawerWidth]);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  useEffect(() => {
    const consumeUrl = (rawUrl: string | null | undefined) => {
      const url = String(rawUrl ?? "").trim();
      if (!url) return;
      shareLinkHandlerMap.current[activeTabIdRef.current]?.(url);
    };
    const sub = Linking.addEventListener("url", (event) => consumeUrl(event.url));
    void Linking.getInitialURL().then((url) => consumeUrl(url)).catch(() => {});
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = Keyboard.addListener(showEvent, (event) => {
      const toValue = Math.max((event.endCoordinates?.height ?? 0) - 8, 0);
      Animated.timing(keyboardShift, {
        toValue,
        duration: Platform.OS === "ios" ? 230 : 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      Animated.timing(keyboardShift, {
        toValue: 0,
        duration: Platform.OS === "ios" ? 210 : 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [keyboardShift]);

  const displayName = useMemo(
    () => (!userEmail
      ? messages.common.accountFallback
      : (userEmail.split("@")[0] ?? messages.common.accountFallback)
        .split(/[._-]/g).filter(Boolean)
        .map((p) => p[0].toUpperCase() + p.slice(1)).join(" ")),
    [userEmail, messages],
  );

  const activeView = tabViews[activeTabId];
  const activeGuest = Boolean(tabGuestModes[activeTabId]);

  // Hay sesión utilizable en la pestaña visible: token de portal (o invitado) y la
  // vista no es login/splash. Al cerrar sesión esto cae a `false` → se cierran los
  // drawers globales (derecho/blog y soporte) y se bloquea su apertura. Los drawers
  // por-pestaña (servidor izq. + sheet central) los gestiona cada `MainTab`.
  const activeSessionActive = (Boolean(token) || activeGuest)
    && activeView !== "login"
    && activeView !== "splash";
  useEffect(() => { activeSessionActiveRef.current = activeSessionActive; }, [activeSessionActive]);
  useEffect(() => {
    if (activeSessionActive) return;
    if (blogDrawerOpen) closeBlogDrawer();
    if (supportDrawerOpen) closeSupportDrawer();
  }, [activeSessionActive, blogDrawerOpen, supportDrawerOpen, closeBlogDrawer, closeSupportDrawer]);

  const handleOpenNewTab = useCallback(() => {
    const newTabId = storeOpenNewTab();
    if (activeGuest) {
      setTabInitialGuest((prev) => ({ ...prev, [newTabId]: true }));
    }
  }, [activeGuest]);
  const nativeWorkspace = activeView === "dashboard" && !activeGuest;
  const showTitleBar = !nativeWorkspace && activeView !== undefined
    && activeView !== "splash"
    && activeView !== "login"
    // Sin barras (sup./inf.) mientras carga el panel: pantalla de carga limpia.
    && activeView !== "loading-panel"
    && (Boolean(token) || activeGuest);
  const activeBottomControls = bottomControlsByTab[activeTabId];
  // Consola nativa del chat tapando el cuerpo del tab activo: el navbar del chat
  // (arriba) y el composer (abajo) no son del terminal → se ocultan.
  const activeTerminalOverlay = !!terminalOverlayByTab[activeTabId];
  const activeServerNav = serverDrawerNavByTab[activeTabId];
  const activeActionsSheetNav = actionsSheetNavByTab[activeTabId];

  // Tabs del drawer derecho (Cuenta/Bitácora) para el `DrawerTopBar` de la barra
  // superior (solo se muestran al abrir el drawer; sin título ni cerrar).
  const blogTabItems: { key: string; label: string }[] = activeGuest
    // Invitado: SOLO "Conexiones" (conexiones de invitado); sin Perfil/Tienda/Comunidad.
    ? [{ key: "tabs", label: messages.titleBar.tabsLabel }]
    : [
        { key: "blog", label: messages.blogfeed.communityTitle },
        { key: "profile", label: messages.account.tabProfile },
        // "Asistente" (Fase 4): ajustes del asistente IA del servidor activo.
        { key: "assistant-settings", label: messages.assistantSettings.tabLabel },
        { key: "store", label: messages.account.store },
        { key: "tabs", label: messages.titleBar.tabsLabel },
        // Empleo ya NO es un tab plano ni una vista aparte: vive embebido como sub-tab
        // de "Comunidad" (BlogDrawerContent → "Empleo" → JobsScreen compact).
      ];

  const handleBlogDrawerTabChange = useCallback((key: string) => {
    changeBlogDrawerTab(key as BlogDrawerTab);
  }, [changeBlogDrawerTab]);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.root, { backgroundColor: tokens.bgPrimary, direction: getLocaleDirection(language) }]}>
      <StatusBar
        barStyle={theme === "dark" ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />
      <View style={{ flex: 1 }}>
        {/* Barra superior. Al abrir un drawer (izq/der), la "toma" el `DrawerTopBar`
            mostrando SOLO los tabs (sin título ni botón de cerrar): así queda de una
            sola fila a la misma altura que la barra normal y NO desfasa el UI. El
            cierre es por backdrop/swipe/botón atrás. Sin drawers, en servidores se
            muestra el `ChatTopBar` (soporte + buscar + filtros + avatar). */}
        {blogDrawerVisible ? (
          <DrawerTopBar
            language={language}
            items={blogTabItems}
            value={activeGuest ? "tabs" : blogDrawerTab}
            onChange={handleBlogDrawerTabChange}
          />
        ) : activeServerNav?.open ? (
          <DrawerTopBar
            language={language}
            items={activeServerNav.items}
            value={activeServerNav.value}
            onChange={activeServerNav.onChange}
          />
        ) : activeActionsSheetNav?.open ? (
          <DrawerTopBar
            language={language}
            items={activeActionsSheetNav.items}
            value={activeActionsSheetNav.value}
            onChange={activeActionsSheetNav.onChange}
          />
        ) : showTitleBar && activeView === "dashboard" && !activeTerminalOverlay ? (
          <ChatTopBar
            language={language}
            onOpenNotifications={handleOpenNotifications}
            searchValue={activeBottomControls?.searchValue ?? ""}
            onSearchChange={activeBottomControls?.onSearchChange}
            onOpenFilters={activeBottomControls?.onOpenFilters}
            filterCount={activeBottomControls?.filterCount ?? 0}
            searchPlaceholder={activeBottomControls?.placeholder}
          />
        ) : null}
        <View style={{ flex: 1 }}>
          {tabs.map((tab) => (
            <View
              key={tab.id}
              style={{
                flex: activeTabId === tab.id ? 1 : 0,
                display: activeTabId === tab.id ? "flex" : "none",
              }}
            >
              <MainTab
                tabId={tab.id}
                isActiveTab={activeTabId === tab.id}
                onAutoLabelChange={storeSetTabAutoLabel}
                registerGoServers={registerGoServers}
                registerGoSupport={registerGoSupport}
                registerGoSecurity={registerGoSecurity}
                registerGoPayments={registerGoPayments}
                registerGoJobs={registerGoJobs}
                registerOpenAccount={registerOpenAccount}
                registerOpenNotifications={registerOpenNotifications}
                registerShareLinkHandler={registerShareLinkHandler}
                registerWebViewInjector={registerWebViewInjector}
                autoConnect={tab.autoConnect !== false}
                initialView={tab.restoreView}
                initialSshUrl={tab.restoreSshUrl}
                initialPanelId={tab.restorePanelId}
                initialChatPanelId={tab.restoreChatPanelId}
                onSessionChange={storeUpdateTabSession}
                onViewChange={setTabView}
                onGuestModeChange={setTabGuestMode}
                onChatOpenChange={updateTabChatRoute}
                onLanguageChange={setLanguage}
                globalLanguage={language}
                initialGuestMode={tabInitialGuest[tab.id]}
                registerBottomControls={registerBottomControls}
                registerProfile={registerProfile}
                keyboardShift={keyboardShift}
                onRequestOpenTabMenu={handleRequestOpenTabMenu}
                registerServerDrawerNav={registerServerDrawerNav}
                registerActionsSheetNav={registerActionsSheetNav}
                registerTerminalOverlay={registerTerminalOverlay}
                blogDrawerOpen={blogDrawerOpen}
                onOpenBlogDrawer={openBlogDrawer}
                onCloseBlogDrawer={closeBlogDrawer}
                supportDrawerOpen={supportDrawerOpen}
                onOpenSupportDrawer={openSupportDrawer}
                onCloseSupportDrawer={closeSupportDrawer}
            />
          </View>
        ))}
        {/* Host GLOBAL de sesiones vivas (B2): consolas tmux y webviews de módulo
            de TODAS las pestañas, SIEMPRE montadas (navegar/cambiar de pestaña no
            mata conexiones). Capa: ENCIMA del contenido de pestañas y DEBAJO del
            drawer derecho (overlay siguiente) y de los RN Modal (drawer del
            servidor sobre una sesión, modales, toasts del SO). No vive en App.tsx
            porque los drawers in-tree del shell aún se montan AQUÍ (B5 los subirá
            a overlays globales y el host podrá subir con ellos). */}
        <SessionHost />
        {/* Overlay del drawer derecho: DENTRO del contenedor del cuerpo (bajo el
            navbar) e igual que el izquierdo. Sus tabs los pinta el `DrawerTopBar`
            de la barra superior (solo tabs, sin título ni cerrar). */}
        {blogDrawerVisible ? (
          <View style={styles.blogDrawerOverlay} pointerEvents="box-none">
            <AnimatedPressable
              style={[styles.blogDrawerBackdrop, { opacity: blogDrawerBackdrop }]}
              onPress={closeBlogDrawer}
            />
            <PanGestureHandler onHandlerStateChange={handleBlogDrawerSwipe} activeOffsetX={[-8, 8]} failOffsetY={[-28, 28]}>
              <Animated.View
                style={[
                  styles.blogDrawer,
                  {
                    width: blogDrawerWidth,
                    // `blogDrawer` tiene `borderLeftWidth: 1` pero sin color: RN usa
                    // negro por defecto y se veía un borde oscuro (el drawer izq sí
                    // colorea su borde). Lo igualamos al borde del tema.
                    borderLeftColor: tokens.border,
                    // Safe-area inferior: contenido de cualquier tab por encima de la
                    // barra de navegación de Android.
                    paddingBottom: insets.bottom,
                    transform: [{ translateX: blogDrawerTranslateX }],
                    opacity: blogDrawerBackdrop.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }),
                  },
                ]}
              >
                {(() => {
                  const profile: DrawerData = profileByTab[activeTabId] ?? {
                    token: token ?? "",
                    setLanguage,
                    logout: async () => {},
                    displayName: "",
                    serverCount: 0,
                    balancesVersion: 0,
                    isAdmin: false,
                    paymentRows: [],
                    productRows: [],
                    busyPayments: false,
                    refreshPayments: () => {},
                    purchasePlan: () => {},
                    purchaseTokenPack: () => {},
                    iapReady: false,
                    tokenPurchaseSignal: 0,
                    switchAccount: async () => {},
                    toggleTheme: () => {},
                    theme,
                  };
                  return (
                    <BlogDrawerContent
                      visible={blogDrawerVisible}
                      tab={blogDrawerTab}
                      onTabChange={changeBlogDrawerTab}
                      profileSubTab={profileSubTab}
                      onProfileSubTabChange={setProfileSubTab}
                      onClose={closeBlogDrawer}
                      onSupport={activeGuest ? undefined : () => { closeBlogDrawer(); openSupportDrawer(); }}
                      jobsEnabled={!activeGuest}
                      // Invitado: el drawer derecho muestra SOLO las conexiones de invitado
                      // (tarjetas por subdominio). Los datos/handlers viajan en el bundle
                      // (`{...profile}` desde registerProfile); aquí solo el flag.
                      guestMode={activeGuest}
                      language={language}
                      chromeInNavbar
                      tabsData={{
                        tabs,
                        activeTabId,
                        onSelectTab: storeSetActiveTab,
                        onSelectServers: handleSelectServersTab,
                        onCloseTab: closeTabWithReap,
                        onRenameTab: storeRenameTab,
                        onOpenNewTab: () => { handleOpenNewTab(); closeBlogDrawer(); },
                        canOpenNewTab: Boolean(token) || activeGuest,
                      }}
                      {...profile}
                    />
                  );
                })()}
              </Animated.View>
            </PanGestureHandler>
          </View>
        ) : null}
        </View>
        {showTitleBar
          // Pantalla apilada tapando el cuerpo (consola nativa o chat A5): el
          // navbar inferior no es parte de ellas → se oculta (traen su cromo).
          && !activeTerminalOverlay
          // Con un drawer (izq=servidor / der=Bitácora) desplegado se oculta el
          // navbar inferior; al cerrarse (visible=false) vuelve a la normalidad.
          && !blogDrawerVisible && !activeServerNav?.open && !activeActionsSheetNav?.open
          // En la pantalla de servidores el buscador vive arriba (ChatTopBar): el
          // navbar inferior NO debe mostrarse en modo "search" (solo aporta valor
          // como composer del chat, detalle de ticket o navegación de pagos). Así
          // el navbar inferior aparece solo cuando realmente hace falta.
          && !(activeView === "dashboard" && activeBottomControls?.mode === "search") ? (
          <Animated.View style={{ transform: [{ translateY: Animated.multiply(keyboardShift, -1) }] }}>
            <TitleBarTabs
              onGoServers={handleLogoClick}
              onGoSupport={activeGuest ? undefined : handleGoSupport}
              onGoPayments={activeGuest ? undefined : handleGoPayments}
              activeView={activeView}
              displayName={activeGuest ? messages.common.guest : displayName}
              onOpenAccount={handleOpenAccount}
              guestMode={activeGuest}
              language={language}
              searchValue={activeBottomControls?.searchValue ?? ""}
              onSearchChange={activeBottomControls?.onSearchChange}
              onOpenFilters={activeBottomControls?.onOpenFilters}
              filterCount={activeBottomControls?.filterCount ?? 0}
              searchPlaceholder={activeBottomControls?.placeholder}
              showSearchControls={Boolean(activeBottomControls?.show) && activeBottomControls?.mode === "search"}
              webview={activeView === "ssh"}
              ticketDetailControls={activeBottomControls?.mode === "ticket-detail" ? {
                onAttach: activeBottomControls?.onAttach,
                onSend: activeBottomControls?.onSend,
                attachDisabled: Boolean(activeBottomControls?.attachDisabled),
                sendDisabled: Boolean(activeBottomControls?.sendDisabled),
                onBack: activeBottomControls?.onBack,
                counterLabel: activeBottomControls?.counterLabel,
              } : undefined}
            />
          </Animated.View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
