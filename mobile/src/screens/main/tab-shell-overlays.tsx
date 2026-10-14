import { nativeText } from '../../i18n/native-text';
// Overlays/sheets/modales del shell POR PESTAÑA (extraídos verbatim del return
// de MainTab.tsx). Sin hooks: `renderShellOverlays` se llama en el render de
// MainTab cuando `shellVisible` es true y devuelve el MISMO árbol de elementos
// que las secciones inline que reemplaza (sin componente envoltorio, para no
// cambiar la reconciliación).
import React from "react";
import { ActivityIndicator, Animated, Pressable, Text, View } from "react-native";
import { PanGestureHandler, type PanGestureHandlerStateChangeEvent } from "react-native-gesture-handler";
import type { EdgeInsets } from "react-native-safe-area-context";
import type { useMainTabController } from "../../hooks/useMainTabController";
import type { getMessages } from "../../i18n";
import type { getThemeTokens } from "../../theme/colors";
import type { ServerModulePermissions } from "../../api/client";
import type { PanelRow } from "../../features/app/viewModels";
import { StandaloneManagerScreen } from "../server/standalone/StandaloneManagerScreen";
import { DirectPanelConnectScreen } from "../server/direct/DirectPanelConnectScreen";
import { SupportChatWidget } from "../../components/SupportChatWidget";
import { ServerSharingModal } from "../../components/ServerSharingModal";
import PublicProfileDrawer from "../../components/PublicProfileDrawer";
import NotificationsCenter from "../../components/NotificationsCenter";
import { Modal as AppModal } from "../../components/ui/Modal";
import ActionsSheet, { type ActionsSheetTab } from "../../components/ActionsSheet";
import { ModulePickerContent } from "../../components/ModulePickerContent";
import { cancelModuleActivation } from "../../lib/module-sessions-store";
import { DEFAULT_FLOATING_BUTTONS, type FloatingButtonsConfig } from "../../lib/module-floating-buttons-store";
import { styles } from "../MainScreen.styles";
import { AnimatedPressable, handleAssistantAction } from "./shell-chrome";
import type { BlogDrawerTarget, NativeModuleSession } from "./shell-types";
import { MainTabModals } from "./tab-modals";

export type ShellOverlaysDeps = {
  ctrl: ReturnType<typeof useMainTabController>;
  tabId: string;
  isActiveTab: boolean;
  t: ReturnType<typeof getMessages>;
  insets: EdgeInsets;
  serverTokens: ReturnType<typeof getThemeTokens>;
  maxUploadBytes: number;
  nativeModule: NativeModuleSession | null;
  setNativeModule: React.Dispatch<React.SetStateAction<NativeModuleSession | null>>;
  standaloneOpen: boolean;
  setStandaloneOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activating: { id: string; label: string } | null;
  consoleOverlayVisible: boolean;
  moduleOverlayVisible: boolean;
  renderServerDrawerOverlay: (asModal?: boolean) => React.ReactNode;
  serverDrawerVisible: boolean;
  blogDrawerOpen: boolean;
  supportDrawerOpen: boolean;
  onCloseSupportDrawer: () => void;
  onOpenSupportDrawer: () => void;
  onOpenBlogDrawer: (tab?: BlogDrawerTarget) => void;
  visibleComposerStarted: boolean;
  publicProfile: { open: boolean; userId: string | null; userName: string };
  setPublicProfile: React.Dispatch<React.SetStateAction<{ open: boolean; userId: string | null; userName: string }>>;
  manageAccessOpen: boolean;
  setManageAccessOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeServerPanel: PanelRow | null;
  notificationsOpen: boolean;
  setNotificationsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  // ── Sheet central de acciones ──
  actionsSheetVisible: boolean;
  actionsSheetTab: ActionsSheetTab;
  setActionsSheetTab: (tab: ActionsSheetTab) => void;
  actionsSheetTranslateY: Animated.Value;
  actionsSheetBackdrop: Animated.Value;
  actionsSheetDragY: Animated.Value;
  openActionsSheet: (tab?: ActionsSheetTab) => void;
  closeActionsSheet: () => void;
  onActionsSheetGesture: (...args: unknown[]) => void;
  handleActionsSheetSwipe: (event: PanGestureHandlerStateChangeEvent) => void;
  handleOpenSheetSwipe: (event: PanGestureHandlerStateChangeEvent) => void;
  // ── Drawer central "Más herramientas" ──
  modulePickerError: string | null;
  modulePickerLoading: boolean;
  retryModulePicker: () => void;
  modulePickerVisible: boolean;
  modulePickerAtTop: boolean;
  setModulePickerAtTop: (atTop: boolean) => void;
  modulePickerPanel: PanelRow | null;
  modulePickerAvailable: { id: string; name?: string }[];
  modulePickerTools: { assistant: boolean; terminal: boolean };
  modulePickerTranslateY: Animated.Value;
  modulePickerBackdrop: Animated.Value;
  modulePickerDragY: Animated.Value;
  closeModulePicker: () => void;
  onModulePickerGesture: (...args: unknown[]) => void;
  handleModulePickerSwipe: (event: PanGestureHandlerStateChangeEvent) => void;
  openModuleSession: (panel: PanelRow, moduleId: string, route: string, moduleName?: string) => Promise<void>;
  openToolSession: (panel: PanelRow, tool: "assistant" | "terminal", perms: ServerModulePermissions) => Promise<void>;
  floatingByPanel: Record<string, FloatingButtonsConfig>;
  toggleFloating: (panelId: string, side: "left" | "right", id: string) => void;
};

export function renderShellOverlays(d: ShellOverlaysDeps) {
  const {
    ctrl, tabId, t, insets, serverTokens, maxUploadBytes,
    nativeModule, setNativeModule, standaloneOpen, setStandaloneOpen, activating,
    consoleOverlayVisible, moduleOverlayVisible, renderServerDrawerOverlay,
    serverDrawerVisible, blogDrawerOpen, supportDrawerOpen, onCloseSupportDrawer,
    onOpenSupportDrawer, onOpenBlogDrawer, visibleComposerStarted,
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
  } = d;
  return (
    <>
        {/* B2: las CONSOLAS (terminal nativo) y los WEBVIEWS DE MÓDULO ya no se
            montan aquí como overlays absolutos: viven SIEMPRE montados en el
            `SessionHost` global (src/sessions/) y se muestran sobre el rect que
            publican las pantallas `Terminal` / `ModuleWebView` del stack de esta
            pestaña. Minimizar/atrás = goBack (la sesión sigue viva); reabrir =
            navigate con el id. El drawer izquierdo sigue abriéndose ENCIMA como
            RN Modal (ver más abajo). */}
        {/* Sesión de módulo NATIVA (pantalla RN) sobre el dashboard. Cubre todo y
            provee su propio fondo; "atrás" la cierra (vuelve al carousel). */}
        {/* Gestor de servidores STANDALONE (conexión directa). Overlay propio por
            encima del dashboard; no depende del token de LP-LS. */}
        {standaloneOpen ? (
          <View style={styles.nativeModuleOverlay} pointerEvents="auto">
            <StandaloneManagerScreen
              visible={d.isActiveTab}
              onClose={() => setStandaloneOpen(false)}
              token={ctrl.token ?? null}
              onRequireSubscription={() => onOpenBlogDrawer("store")}
            />
          </View>
        ) : null}
        {/* Conexión NATIVA directa del botón "Conectar" de un panel del directorio:
            autentica contra el backend del box (usuario Linux + 2FA), registra el
            DirectTarget bajo panel.id y abre el selector de módulos NATIVO. Sin
            webview ni gateway (reemplaza el antiguo view="ssh"/redirectUrl SSO). */}
        {/* Indicador de carga de la ACTIVACIÓN DIFERIDA: pantalla SÓLIDA oscura (sin
            tarjeta ni sombra) que cubre el dashboard mientras la webview carga oculta;
            se revela solo cuando la vista destino terminó de cargar. Tocarla cancela. */}
        {activating ? (
          <Pressable
            style={[styles.moduleLoadingOverlay, { backgroundColor: serverTokens.bgPrimary, paddingBottom: insets.bottom }]}
            onPress={() => cancelModuleActivation(tabId, activating.id)}
          >
            <ActivityIndicator size="large" color={serverTokens.brand} />
            {activating.label ? (
              <Text style={[styles.moduleLoadingTitle, { color: serverTokens.textPrimary }]} numberOfLines={1}>
                {activating.label}
              </Text>
            ) : null}
            <Text style={[styles.moduleLoadingHint, { color: serverTokens.textMuted }]} numberOfLines={2}>
              {t.modules.loadingHint}
            </Text>
          </Pressable>
        ) : null}
        {/* El chip flotante "Módulos (N)" y su modal selector se eliminaron: los
            módulos se abren/reabren desde "Más opciones" (botón + drawer) y atrás
            los cierra (vuelve al carousel). */}
        {/* Drawer izq sobre las consolas O el webview de módulo: RN Modal (por ENCIMA
            del overlay/WebView nativo), igual que en la vista SSH. Si fuera in-tree,
            el WebView nativo lo taparía (quedaría por debajo o invisible). */}
        {(consoleOverlayVisible || moduleOverlayVisible) ? renderServerDrawerOverlay(true) : null}


      {/* La Tienda (paquetes de datos/tokens) vive ahora en el tab "Tienda" del
          drawer de Bitácora. Las acciones que abrían este modal (asistente, flujos
          de compra) abren el drawer en ese tab vía el puente de `ctrl.paymentsOpen`. */}

      {ctrl.token
        && !ctrl.guestMode
        && (supportDrawerOpen
          || (ctrl.view === "support" && !ctrl.ticketDetail.open)) ? (
        <SupportChatWidget
          key={supportDrawerOpen ? "support-drawer" : `support-${ctrl.view}`}
          token={ctrl.token}
          language={ctrl.language}
          isDark={ctrl.isDark}
          initialOpen={supportDrawerOpen}
          hideLauncher={supportDrawerOpen}
          onClose={onCloseSupportDrawer}
          onAction={(a) => handleAssistantAction(ctrl, a, onOpenBlogDrawer, onOpenSupportDrawer)}
        />
      ) : null}

      {/* Editar = inline en el tab "Server" del drawer izquierdo; crear = tab "New"
          del sheet central. Ya no hay modal de edición de panel. Los modales por
          pestaña (borrar/conexión/compra/ticket…) viven en ./tab-modals. */}
      <MainTabModals ctrl={ctrl} maxUploadBytes={maxUploadBytes} />

      {/* Drawer izq (no-modal) sobre el dashboard. Con el overlay de consola o el
          webview de módulo visible NO se renderiza aquí: lo monta la versión Modal de
          arriba (por encima del overlay); si no, se montaría `ServerDrawer` dos veces. */}
      {!(consoleOverlayVisible || moduleOverlayVisible) ? renderServerDrawerOverlay() : null}

      {/* Perfil público del usuario que compartió un servidor (badge "compartido
          por X"): drawer izquierdo independiente con tabs Perfil + Bitácora. */}
      <PublicProfileDrawer
        visible={publicProfile.open}
        onClose={() => setPublicProfile((c) => ({ ...c, open: false }))}
        userId={publicProfile.userId}
        userName={publicProfile.userName}
        token={ctrl.token ?? ""}
        language={ctrl.language}
      />

      {/* Manage Access (acceso granular) desde el tab Server. */}
      <ServerSharingModal
        open={manageAccessOpen && Boolean(activeServerPanel)}
        panelId={activeServerPanel?.source.id ?? null}
        panelName={activeServerPanel?.nameLabel ?? ""}
        token={ctrl.token ?? ""}
        language={ctrl.language}
        onClose={() => setManageAccessOpen(false)}
      />

      {/* Drawer central de Notificaciones (campana del top-bar): muestra solo el
          registro/historial de avisos (todos los servidores). La config de
          alertas por servidor se migró a LUXIPANEL. Independiente del sheet
          central de acciones. El cuerpo no scrollea: el listado gestiona su
          propio scroll. */}
      <AppModal
        visible={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        title={(ctrl.language ?? "es").startsWith("en") ? nativeText("Notifications") : nativeText("Notificaciones")}
        language={ctrl.language}
        scrollable={false}
        fillHeight
      >
        <NotificationsCenter
          token={ctrl.effectiveToken ?? ""}
          language={ctrl.language}
          onOpenServer={(panelId) => { setNotificationsOpen(false); ctrl.focusServerPanel(panelId); }}
        />
      </AppModal>

      {/* Handle inferior: swipe-up (o tap) abre el bottom-sheet central. Solo en la
          pantalla de servidores y sin otros drawers/sheets abiertos. Con el chat
          iniciado el composer ocupa el navbar inferior, así que el asa se oculta
          (si no, quedaba flotando "mal ubicada" sobre el composer). */}
      {ctrl.view === "dashboard" && !ctrl.guestMode && !visibleComposerStarted && !actionsSheetVisible && !serverDrawerVisible && !blogDrawerOpen && !moduleOverlayVisible ? (
        <PanGestureHandler onHandlerStateChange={handleOpenSheetSwipe} activeOffsetY={[-8, 8]} failOffsetX={[-24, 24]}>
          <View style={[styles.sheetHandleZone, { bottom: insets.bottom }]} pointerEvents="box-none">
            <Pressable
              onPress={() => openActionsSheet("new")}
              accessibilityLabel={t.dashboard.newConnection}
              style={[styles.sheetHandle, { backgroundColor: serverTokens.bgCardSolid, borderColor: serverTokens.border }]}
            >
              <View style={[styles.sheetHandleBar, { backgroundColor: serverTokens.textMuted }]} />
            </Pressable>
          </View>
        </PanGestureHandler>
      ) : null}

      {actionsSheetVisible ? (
        <View style={styles.actionsSheetOverlay}>
          <AnimatedPressable
            style={[styles.actionsSheetBackdrop, { opacity: actionsSheetBackdrop }]}
            onPress={closeActionsSheet}
          />
          <PanGestureHandler
            onGestureEvent={onActionsSheetGesture}
            onHandlerStateChange={handleActionsSheetSwipe}
            activeOffsetX={[-12, 12]}
            activeOffsetY={[-99999, 10]}
          >
            <Animated.View
              style={[
                styles.actionsSheet,
                {
                  backgroundColor: serverTokens.bgPrimary,
                  borderTopColor: serverTokens.border,
                  // translateY = animación de apertura/cierre + arrastre en vivo del
                  // dedo (solo hacia abajo: el negativo se recorta a 0).
                  transform: [{
                    translateY: Animated.add(
                      actionsSheetTranslateY,
                      actionsSheetDragY.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolateLeft: "clamp" }),
                    ),
                  }],
                },
              ]}
            >
              <ActionsSheet
                visible={actionsSheetVisible}
                tab={actionsSheetTab}
                onTabChange={setActionsSheetTab}
                onClose={closeActionsSheet}
                onOpenStandalone={() => { closeActionsSheet(); setStandaloneOpen(true); }}
                language={ctrl.language}
                data={{
                  token: ctrl.token ?? "",
                  isAdmin: ctrl.isAdmin,
                  taxonomy: ctrl.taxonomy,
                  sshKeys: ctrl.sshKeys,
                  sshKeyOptions: ctrl.sshKeys,
                  refreshTaxonomy: ctrl.refreshTaxonomy,
                  refreshSshKeys: ctrl.refreshSshKeys,
                  applyCategoryCreated: ctrl.applyCategoryCreated,
                  applyCategoryRenamed: ctrl.applyCategoryRenamed,
                  applyCategoryDeleted: ctrl.applyCategoryDeleted,
                  applyTagCreated: ctrl.applyTagCreated,
                  applyTagRenamed: ctrl.applyTagRenamed,
                  applyTagDeleted: ctrl.applyTagDeleted,
                  applySshKeyCreated: ctrl.applySshKeyCreated,
                  applySshKeyUpdated: ctrl.applySshKeyUpdated,
                  applySshKeyDeleted: ctrl.applySshKeyDeleted,
                  panelEditor: ctrl.panelEditor,
                  setPanelEditor: ctrl.setPanelEditor,
                  // "Probar conexión": prueba SSH y, si conecta, crea el panel; al
                  // crear con éxito se cierra el sheet (el carousel salta al nuevo panel).
                  submitPanelEditor: async () => {
                    const createdId = await ctrl.submitPanelEditor();
                    if (createdId) closeActionsSheet();
                  },
                  requestDeletePanel: ctrl.requestDeletePanelFromEditor,
                  closePanelEditor: ctrl.closePanelEditor,
                  onAfterImport: ctrl.refreshPanels,
                }}
              />
            </Animated.View>
          </PanGestureHandler>
        </View>
      ) : null}

      {/* Drawer central "Más herramientas": bottom-sheet INDEPENDIENTE (no Modal),
          mismo patrón que el ActionsSheet. Lista los módulos activos del servidor;
          al elegir uno abre su webview (openModuleSession). */}
      {modulePickerVisible ? (
        <View style={styles.modulePickerOverlay}>
          <AnimatedPressable
            style={[styles.actionsSheetBackdrop, { opacity: modulePickerBackdrop }]}
            onPress={closeModulePicker}
          />
          <PanGestureHandler
            onGestureEvent={onModulePickerGesture}
            onHandlerStateChange={handleModulePickerSwipe}
            // Solo arriba del todo: si la lista está desplazada, el gesto vertical va
            // al ScrollView (no cierra el sheet). Umbral más alto (18) = menos sensible.
            enabled={modulePickerAtTop}
            activeOffsetY={[-99999, 18]}
          >
            <Animated.View
              style={[
                styles.modulePickerSheet,
                {
                  backgroundColor: serverTokens.bgCardSolid,
                  // El sheet ya va DEBAJO del SafeAreaView + barra superior (status bar
                  // ya reservado arriba): NO añadimos inset superior aquí (duplicaba el
                  // espacio y dejaba un hueco). Solo reservamos el inferior (barra de
                  // navegación). La cabecera propia aporta su pequeño respiro.
                  paddingBottom: insets.bottom,
                  transform: [{
                    translateY: Animated.add(
                      modulePickerTranslateY,
                      modulePickerDragY.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolateLeft: "clamp" }),
                    ),
                  }],
                },
              ]}
            >
              <ModulePickerContent
                available={modulePickerAvailable}
                tools={modulePickerTools}
                error={modulePickerError}
                loading={modulePickerLoading}
                onRetry={retryModulePicker}
                language={ctrl.language}
                onClose={closeModulePicker}
                onPick={(moduleId, route, name) => {
                  const panel = modulePickerPanel;
                  closeModulePicker();
                  if (panel) void openModuleSession(panel, moduleId, route, name);
                }}
                onPickTool={(tool) => {
                  const panel = modulePickerPanel;
                  closeModulePicker();
                  if (panel) void openToolSession(panel, tool, { ...modulePickerTools, available: modulePickerAvailable });
                }}
                // Configuración de botones flotantes del servidor del picker (engranaje).
                floatingConfig={modulePickerPanel ? (floatingByPanel[modulePickerPanel.id] ?? DEFAULT_FLOATING_BUTTONS) : DEFAULT_FLOATING_BUTTONS}
                onToggleFloating={modulePickerPanel ? (side, id) => toggleFloating(modulePickerPanel.id, side, id) : undefined}
                // Habilita el arrastrar-para-cerrar solo con la lista arriba del todo.
                onScrollEdgeChange={setModulePickerAtTop}
              />
            </Animated.View>
          </PanGestureHandler>
        </View>
      ) : null}
    </>
  );
}
