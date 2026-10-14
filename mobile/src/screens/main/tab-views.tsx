// Render-closures de las VISTAS del stack por pestaña (B1/B2/A5), extraídas
// verbatim de MainTab.tsx. Sin hooks: `buildViewRenderers` se llama en cada
// render de MainTab y devuelve el mapa de render-props del TabNavigator, igual
// que las closures inline que reemplaza.
import React from "react";
import { Animated, Pressable, View, type ViewStyle } from "react-native";
import { type PanGestureHandlerStateChangeEvent } from "react-native-gesture-handler";
import type { EdgeInsets } from "react-native-safe-area-context";
import type { useMainTabController } from "../../hooks/useMainTabController";
import type { getMessages } from "../../i18n";
import type { getThemeTokens } from "../../theme/colors";
import type { ServerModulePermissions } from "../../api/client";
import type { PanelRow } from "../../features/app/viewModels";
import type { ServerDrawerTab } from "../../components/ServerDrawer";
import type { ActionsSheetTab } from "../../components/ActionsSheet";
import type { RootStackScreenProps } from "../../navigation/types";
import { NativePanelWorkspace } from "./NativePanelWorkspace";
import { DashboardScreen } from "../DashboardScreen";
import { LoadingPanelScreen } from "../LoadingPanelScreen";
import { LoginScreen } from "../LoginScreen";
import { SplashScreen } from "../SplashScreen";
import { SupportScreen } from "../SupportScreen";
import { BlogReaderScreen } from "../BlogReaderScreen";
import { PublicacionesScreen } from "../PublicacionesScreen";
import { TicketDetailScreen } from "../TicketDetailScreen";
import { TerminalScreen } from "../TerminalScreen";
import { ChatScreen } from "../ChatScreen";
import { Avatar } from "../../components/ui/Avatar";
import { styles } from "../MainScreen.styles";
import { RouteTransition } from "./shell-chrome";
import type { BlogDrawerTarget } from "./shell-types";

export type ViewRendererDeps = {
  ctrl: ReturnType<typeof useMainTabController>;
  tabId: string;
  isActiveTab: boolean;
  t: ReturnType<typeof getMessages>;
  directionalStyle: ViewStyle;
  insets: EdgeInsets;
  serverTokens: ReturnType<typeof getThemeTokens>;
  accountPhotoURL: string | null;
  serverRows: PanelRow[];
  favorites: Set<string>;
  palettePanelId: string | null;
  webviewRepaintSignal: number;
  webviewInjectRef: React.MutableRefObject<((js: string) => void) | null>;
  registerWebViewInjector: (tabId: string, inject: ((js: string) => void) | null) => void;
  onRequestOpenTabMenu: () => void;
  visibleComposerStarted: boolean;
  keyboardShift: Animated.Value;
  maxUploadBytes: number;
  handleSwipe: (event: PanGestureHandlerStateChangeEvent) => void;
  openServerDrawer: (targetTab?: ServerDrawerTab) => void;
  renderServerDrawerOverlay: (asModal?: boolean) => React.ReactNode;
  openActionsSheet: (tab?: ActionsSheetTab) => void;
  openPanelChat: (panelId: string) => void;
  closePanelChat: () => void;
  setSshInitialSubTab: React.Dispatch<React.SetStateAction<"list" | "register">>;
  toggleFavorite: (id: string) => void;
  openNewConsole: (panel: PanelRow) => void;
  setManageAccessOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setPublicProfile: React.Dispatch<React.SetStateAction<{ open: boolean; userId: string | null; userName: string }>>;
  openModulePicker: (panel: PanelRow, perms: ServerModulePermissions) => void;
  blogDrawerOpen: boolean;
  onOpenBlogDrawer: (tab?: BlogDrawerTarget) => void;
  onCloseBlogDrawer: () => void;
  onOpenSupportDrawer: () => void;
  dashboardSearch: string;
  setDashboardSearch: React.Dispatch<React.SetStateAction<string>>;
  dashboardFiltersSignal: number;
  setDashboardFilterCount: React.Dispatch<React.SetStateAction<number>>;
  supportSearch: string;
  setSupportSearch: React.Dispatch<React.SetStateAction<string>>;
  supportFiltersSignal: number;
  setSupportFilterCount: React.Dispatch<React.SetStateAction<number>>;
  setTicketDetailBottomActions: (actions: {
    onBack: () => void;
    onAttach: () => void;
    onSend: () => void;
    attachDisabled: boolean;
    sendDisabled: boolean;
    counterLabel: string;
  } | null) => void;
};

export function buildViewRenderers(d: ViewRendererDeps) {
  const {
    ctrl, tabId, isActiveTab, t, directionalStyle, insets, serverTokens, accountPhotoURL,
    serverRows, favorites, palettePanelId, webviewRepaintSignal, webviewInjectRef,
    registerWebViewInjector, onRequestOpenTabMenu, visibleComposerStarted, keyboardShift,
    maxUploadBytes, handleSwipe, openServerDrawer, renderServerDrawerOverlay,
    openActionsSheet, openPanelChat, closePanelChat, setSshInitialSubTab, toggleFavorite,
    openNewConsole, setManageAccessOpen, setPublicProfile, openModulePicker,
    blogDrawerOpen, onOpenBlogDrawer, onCloseBlogDrawer, onOpenSupportDrawer,
    dashboardSearch, setDashboardSearch, dashboardFiltersSignal, setDashboardFilterCount,
    supportSearch, setSupportSearch, supportFiltersSignal, setSupportFilterCount,
    setTicketDetailBottomActions,
  } = d;

  const renderSplashView = () => (
    <View style={[styles.fill, directionalStyle]}><SplashScreen theme={ctrl.theme} language={ctrl.language} /></View>
  );
  const renderLoadingPanelView = () => (
    <View style={[styles.fill, directionalStyle]}><LoadingPanelScreen theme={ctrl.theme} language={ctrl.language} /></View>
  );
  const renderLoginView = () => (
    <View style={[styles.fill, directionalStyle]}>
      <LoginScreen
        theme={ctrl.theme}
        onToggleTheme={ctrl.toggleTheme}
        language={ctrl.language}
        setLanguage={ctrl.setLanguage}
        onGuestEnter={ctrl.enterAsGuest}
      />
    </View>
  );
  const renderDashboardView = () => !ctrl.guestMode ? (
    <NativePanelWorkspace key={ctrl.userEmail || ctrl.currentUserId || "account"} account={ctrl.userEmail || ctrl.currentUserId || "account"} token={ctrl.effectiveToken ?? ""} panels={serverRows} busy={ctrl.busyPanels} language={ctrl.language} active={isActiveTab} focusPanelId={ctrl.pendingFocusPanelId} onFocusHandled={ctrl.clearPendingFocus} onPanelChange={ctrl.onActiveServerPanelChange} onManagePanels={() => {ctrl.openCreatePanelModal();openActionsSheet("new");}} onEditPanel={row=>{ctrl.openEditPanelModal(row);openActionsSheet("new");}} onDeletePanel={ctrl.openDeletePanelModal} onAccount={ctrl.openAccountMenu} onLogout={() => { void ctrl.logout(); }} onSupport={onOpenSupportDrawer} onToggleTheme={ctrl.toggleTheme} onLanguageChange={ctrl.setLanguage} />
  ) : (
    <>
          <View style={styles.fill}>
            <RouteTransition routeKey={`dashboard:${ctrl.guestMode ? "guest" : "user"}`}>
              <DashboardScreen
                isDark={ctrl.isDark}
                language={ctrl.language}
                licensedCount={ctrl.licensedCount}
                unlicensedCount={ctrl.unlicensedCount}
                busyPanels={ctrl.busyPanels}
                panelRows={ctrl.panelRows}
                panelMetrics={ctrl.panelMetrics}
                favorites={favorites}
                onActiveServerPanelChange={ctrl.onActiveServerPanelChange}
                // Panel cuya paleta ya está aplicada → el carousel muestra skeleton
                // en los slides cuyo color aún no llegó (evita el flash de color).
                // `undefined` en invitado = sin feature (no skeleton).
                palettePanelId={ctrl.guestMode ? undefined : palettePanelId}
                focusPanelId={ctrl.pendingFocusPanelId}
                onFocusHandled={ctrl.clearPendingFocus}
                onPanelRowAction={(a, r) => {
                  // Botones de la portada del chat (no son acciones de fila): abrir
                  // el sheet central "nueva conexión" o el drawer izq en tab SSH.
                  if (a === "new_server") { if (ctrl.guestMode) ctrl.openGuestAdd(); else openActionsSheet("new"); return; }
                  // "Empezar conversación": abre la pantalla `Chat` del panel (A5).
                  if (a === "open_chat") { openPanelChat(r.id); return; }
                  if (a === "register_ssh") { setSshInitialSubTab("register"); openServerDrawer("ssh_keys"); return; }
                  if (a === "favorite") { toggleFavorite(r.id); return; }
                  // "Nueva terminal": abre una CONSOLA nueva (terminal nativo
                  // independiente) a nivel de pestaña. El drawer izq (tab "Terminal" →
                  // "Consolas") las lista/cambia/cierra; varias coexisten vivas.
                  if (a === "open_terminal") { openNewConsole(r); return; }
                  // Acciones de la portada junto a "usuarios": gestión de acceso abre
                  // el modal granular; auditoría la maneja DashboardScreen. Operan
                  // sobre el panel visible.
                  if (a === "manage_access") { setManageAccessOpen(true); return; }
                  if (a === "view_owner") { const o = r.source.owner; if (o?.id) setPublicProfile({ open: true, userId: o.id, userName: o.name || "" }); return; }
                  void ctrl.handlePanelRowAction(a, r);
                }}
                onOpenModulePicker={(r, perms) => openModulePicker(r, perms)}
                onOpenCreatePanel={ctrl.guestMode ? ctrl.openGuestAdd : () => openActionsSheet("new")}
                onRefreshPanels={ctrl.refreshPanels}
                onGoServers={ctrl.goToServersView}
                onGoSupport={onOpenSupportDrawer}
                onGoSecurity={ctrl.goToSecurityView}
                onGoPayments={ctrl.goToPaymentsView}
                isAdmin={ctrl.isAdmin}
                blogDrawerOpen={blogDrawerOpen}
                onOpenBlogDrawer={onOpenBlogDrawer}
                onCloseBlogDrawer={onCloseBlogDrawer}
                searchValue={dashboardSearch}
                onSearchChange={setDashboardSearch}
                openFiltersSignal={dashboardFiltersSignal}
                onFilterCountChange={setDashboardFilterCount}
                balancesVersion={ctrl.balancesVersion}
                invitations={ctrl.invitations}
                onRespondInvitation={(shareId, decision, kind) => void ctrl.respondInvitation(shareId, decision, kind)}
                token={ctrl.effectiveToken ?? ""}
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
                guestMode={ctrl.guestMode}
              />
            </RouteTransition>
          </View>
        {/* Avatar de cuenta FLOTANTE (esquina inferior derecha, donde antes estaban
            las flechas del carousel). Solo en la portada de servidores; los drawers
            y sheets (zIndex mayor) lo cubren al abrirse, y la pantalla `Chat` (A5)
            tapa todo el Dashboard. Vive DENTRO de la screen Dashboard (absoluto
            sobre su contenido), mismo apilado que antes. */}
        <Pressable
          onPress={() => ctrl.openAccountMenu()}
          accessibilityLabel={ctrl.displayName}
          style={[styles.floatingAvatar, { bottom: insets.bottom + 12, borderColor: serverTokens.border, backgroundColor: serverTokens.bgCardSolid }]}
        >
          <Avatar photoURL={accountPhotoURL} displayName={ctrl.displayName} size={44} bordered={false} />
        </Pressable>
    </>
  );
  const renderSupportView = () => (
    !ctrl.ticketDetail.open ? (
          <View style={styles.fill}>
            <RouteTransition routeKey="support">
              <SupportScreen
                isDark={ctrl.isDark}
                language={ctrl.language}
                openTicketsCount={ctrl.openTicketsCount}
                totalTickets={ctrl.tickets.length}
                busyTickets={ctrl.busyTickets}
                ticketRows={ctrl.ticketRows}
                onRefreshTickets={ctrl.refreshSupportTickets}
                onTicketRowAction={ctrl.handleSupportRowAction}
                onGoServers={ctrl.goToServersView}
                onGoSupport={ctrl.goToSupportView}
                onGoSecurity={ctrl.goToSecurityView}
                onGoPayments={ctrl.goToPaymentsView}
                onOpenNewTicket={ctrl.openNewTicketModal}
                searchValue={supportSearch}
                onSearchChange={setSupportSearch}
                openFiltersSignal={supportFiltersSignal}
                onFilterCountChange={setSupportFilterCount}
                isAdmin={ctrl.isAdmin}
                token={ctrl.token ?? undefined}
              />
            </RouteTransition>
          </View>
    ) : (
          <TicketDetailScreen
            state={ctrl.ticketDetail}
            setState={ctrl.setTicketDetail}
            onBack={ctrl.closeTicketDetail}
            sendReply={(attachments) => void ctrl.sendTicketReply(attachments)}
            currentUserId={ctrl.currentUserId}
            token={ctrl.token ?? null}
            language={ctrl.language}
            maxFileBytes={maxUploadBytes}
            onBottomActionsChange={setTicketDetailBottomActions}
            keyboardShift={keyboardShift}
          />
    )
  );
  const renderBlogFeedView = () => (
          <View style={styles.fill}>
            <RouteTransition routeKey="blogfeed">
              <BlogReaderScreen
                language={ctrl.language}
                token={ctrl.token ?? ""}
              />
            </RouteTransition>
          </View>
  );
  const renderPublicacionesView = () => (
          <View style={styles.fill}>
            <RouteTransition routeKey="publicaciones">
              <PublicacionesScreen
                language={ctrl.language}
                token={ctrl.token ?? ""}
                displayName={ctrl.displayName}
                photoURL={accountPhotoURL}
                currentUserId={ctrl.currentUserId}
              />
            </RouteTransition>
          </View>
  );
  // "security" y "jobs" siguen siendo valores válidos de `ctrl.view` pero YA NO
  // tienen cuerpo full-screen propio: Seguridad es la pestaña "security" del
  // modal de cuenta (goToSecurityView abre el modal sin tocar la vista) y Empleo
  // se embebe en el drawer derecho (Comunidad → Empleo, `JobsScreen compact`).
  // NO se fuerzan a screen con contenido: su ruta existe (paridad 1:1 con el
  // tipo `View`) y renderiza null, con el shell (drawers/modales) montado igual
  // que hoy (el montaje condicional actual tampoco pinta nada para ellas).
  const renderEmptyView = () => null;

  // ── B2: pantallas de sesión (Terminal / ModuleWebView) ─────────────────────
  // Cáscaras: chrome mínimo + `SessionSurfaceTarget` (la sesión viva la pinta
  // el SessionHost global encima del rect publicado). Params: solo ids.
  const renderTerminalView = (props: RootStackScreenProps<"Terminal">) => (
    <TerminalScreen tabId={tabId} consoleId={props.route.params.consoleId} active={isActiveTab} />
  );
  // A route left in persisted navigation from an older release safely returns
  // to the native server dashboard. No embedded panel is rendered.
  const renderRetiredModuleView = () => renderDashboardView();
  // ── A5: pantalla del chat del asistente ─────────────────────────────────────
  // Autocontenida (cabecera + turnos + composer contra el chat-store); aquí solo
  // se le inyecta el entorno del tab: token, métricas del panel y el opener del
  // terminal nativo. Param: solo el id del panel.
  const renderChatView = (props: RootStackScreenProps<"Chat">) => {
    const chatPanelId = props.route.params.panelId;
    const chatRow = serverRows.find((r) => r.id === chatPanelId);
    return (
      <ChatScreen
        panelId={chatPanelId}
        token={ctrl.effectiveToken ?? ""}
        language={ctrl.language}
        metricsState={ctrl.panelMetrics[chatPanelId]}
        onMetricsRefresh={() => { void ctrl.refreshPanels(); }}
        onNewTerminal={chatRow && !ctrl.guestMode ? () => openNewConsole(chatRow) : undefined}
        onBack={closePanelChat}
        keyboardShift={keyboardShift}
      />
    );
  };

  return {
    Splash: renderSplashView,
    Login: renderLoginView,
    LoadingPanel: renderLoadingPanelView,
    Dashboard: renderDashboardView,
    Support: renderSupportView,
    Security: renderEmptyView,
    Ssh: renderDashboardView,
    BlogFeed: renderBlogFeedView,
    Jobs: renderEmptyView,
    Publicaciones: renderPublicacionesView,
    Terminal: renderTerminalView,
    ModuleWebView: renderRetiredModuleView,
    Chat: renderChatView,
  };
}
