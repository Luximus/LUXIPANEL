import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/useAuth";
import { useTabs } from "../hooks/useTabs";
import { useMainTabController } from "../hooks/useMainTabController";
import { useTabSwitcher } from "../hooks/useTabSwitcher";
import { TitleBarTabs } from "../components/TitleBarTabs";
import { TabSwitcherOverlay } from "../components/TabSwitcherOverlay";
import { type NavbarChrome } from "../components/AppNavbar";
import { buildSectionNav } from "../features/app/sectionNav";
import { AssistantDrawer, type ChatAction } from "../components/AssistantDrawer";
import { resolveAvatarUrl } from "../components/SupportChatWidget";
import { getSupportAssistantIdentity } from "../api/client";
import { loadSessionState } from "../lib/session-state";
import { PanelEditorModal } from "../components/PanelEditorModal";
import { PanelCredentialRevealModal } from "../components/PanelCredentialRevealModal";
import { getPageGradient, openExternal } from "../features/app/utils";
import { ENV } from "../config/env";
import { DashboardScreen } from "./DashboardScreen";
import { LoadingPanelScreen } from "./LoadingPanelScreen";
import { LoginScreen } from "./LoginScreen";
import { SplashScreen } from "./SplashScreen";
import { SshScreen } from "./SshScreen";
import { SupportScreen } from "./SupportScreen";
import { NotificationsScreen } from "./NotificationsScreen";
import { PaymentsModal } from "../components/PaymentsModal";
import { AdminScreen } from "./AdminScreen";
import { JobsScreen } from "./JobsScreen";
import { PublicacionesScreen } from "./PublicacionesScreen";
import { DeletePanelModal } from "../components/DeletePanelModal";
import { PublicProfileDrawer } from "../components/PublicProfileDrawer";
import { ConnectionErrorModal } from "../components/ConnectionErrorModal";
import { ConnectLocalKeyModal } from "../components/ConnectLocalKeyModal";
import { ConnectMethodModal } from "../components/ConnectMethodModal";
import { ConnectSshKeyModal } from "../components/ConnectSshKeyModal";
import { StandaloneManagerModal } from "../components/StandaloneManagerModal";
import { StandaloneServerScreen } from "./StandaloneServerScreen";
import { DevPortalScreen } from "./DevPortalScreen";
import { ModuleStoreScreen } from "./ModuleStoreScreen";
import { BlogScreen } from "./BlogScreen";
import type { StandaloneServer } from "../lib/standalone-servers";
import { clearStandaloneSecretsFromMemory, migrateLegacyStandaloneSecrets } from "../lib/standalone-servers";
import { NewTicketModal } from "../components/NewTicketModal";
import { TicketDetailScreen } from "./TicketDetailScreen";
import { BookOpen, MessageCircle, ShieldCheck, X } from "lucide-react";
import { getMessages } from "../i18n";
import { startNotificationStream } from "../lib/notification-stream";
import styles from "./MainScreen.module.css";

function MainTab({
  tabId,
  onAutoLabelChange,
  registerGoServers,
  registerGoSupport,
  registerGoNotifications,
  registerGoSecurity,
  registerGoPayments,
  registerGoAdmin,
  registerGoJobs,
  registerGoPublicaciones,
  registerGoNewTicket,
  registerShareLink,
  registerChrome,
  autoConnect,
  initialView,
  initialSshUrl,
  initialPanelId,
  onSessionChange,
  onViewChange,
  onGuestModeChange,
  initialGuestMode,
  onLanguageChange,
  globalLanguage,
}: {
  tabId: string;
  onAutoLabelChange: (tabId: string, label: string) => void;
  registerGoServers: (tabId: string, handler: (() => void) | null) => void;
  registerGoSupport: (tabId: string, handler: (() => void) | null) => void;
  registerGoNotifications: (tabId: string, handler: (() => void) | null) => void;
  registerGoSecurity: (tabId: string, handler: (() => void) | null) => void;
  registerGoPayments: (tabId: string, handler: (() => void) | null) => void;
  registerGoAdmin: (tabId: string, handler: (() => void) | null) => void;
  /** Sección "Empleos" (marketplace de requerimientos con escrow de tokens). */
  registerGoJobs: (tabId: string, handler: (() => void) | null) => void;
  /** Sección "Publicaciones" (muro social: notas/encuestas con reacciones). */
  registerGoPublicaciones: (tabId: string, handler: (() => void) | null) => void;
  registerGoNewTicket: (tabId: string, handler: (() => void) | null) => void;
  /** Routes an incoming luxipanel:// deep link to this tab's guest handler. */
  registerShareLink: (tabId: string, handler: ((url: string) => void) | null) => void;
  registerChrome: (tabId: string, chrome: NavbarChrome) => void;
  autoConnect: boolean;
  initialView?: import("../features/app/types").View;
  initialSshUrl?: string;
  initialPanelId?: string;
  onSessionChange: (tabId: string, session: { view: import("../features/app/types").View; sshUrl: string; panelId: string | null }) => void;
  onViewChange: (tabId: string, view: string) => void;
  onGuestModeChange: (tabId: string, guest: boolean) => void;
  initialGuestMode?: boolean;
  /** Reporta el idioma de ESTE tab hacia arriba (idioma global). */
  onLanguageChange: (language: string) => void;
  /** Idioma GLOBAL de la app: sincroniza el controller de este tab para que todos queden
   *  en el mismo idioma (incluye sus webviews, que usan `ctrl.language`). */
  globalLanguage: string;
}) {
  const ctrl = useMainTabController({
    tabId,
    onAutoLabelChange,
    autoConnect,
    initialView,
    initialSshUrl,
    initialPanelId,
    initialGuestMode,
    onSessionChange,
  });
  const [adminDrawerOpen, setAdminDrawerOpen] = useState(false);
  useEffect(() => {
    if (!ctrl.token || !ctrl.isAdmin || ctrl.guestMode) setAdminDrawerOpen(false);
  }, [ctrl.token, ctrl.isAdmin, ctrl.guestMode]);
  useEffect(() => {
    if (ctrl.view !== "admin") return;
    if (ctrl.token && ctrl.isAdmin && !ctrl.guestMode) setAdminDrawerOpen(true);
    ctrl.goToServersView();
  }, [ctrl.view, ctrl.token, ctrl.isAdmin, ctrl.guestMode, ctrl.goToServersView]);
  useEffect(() => {
    if (!adminDrawerOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setAdminDrawerOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [adminDrawerOpen]);
  // Seguridad y Pagos ahora son pestañas del modal de cuenta: estos handlers
  // emiten la señal de apertura del modal (vía el controlador). El gate de 2FA de
  // Seguridad vive dentro del modal (AccountMenu.requireSecurityAccess).
  // Gestor de servidores STANDALONE (conexión directa, sin LP-LS). Estado local
  // de este tab; no vive en el controller porque es una superficie autónoma.
  const [standaloneOpen, setStandaloneOpen] = useState(false);
  // Servidor standalone ABIERTO: al fijarse, se renderiza la vista NATIVA de
  // módulos (`StandaloneServerScreen`) que habla DIRECTO al box por serverApi.
  // Reemplaza el stopgap `openExternal(baseUrl)`.
  const [activeStandalone, setActiveStandalone] = useState<StandaloneServer | null>(null);
  const openStandaloneServer = useCallback((server: StandaloneServer) => {
    setStandaloneOpen(false);
    setActiveStandalone(server);
  }, []);

  registerGoServers(tabId, ctrl.goToServersView);
  registerGoSupport(tabId, ctrl.goToSupportView);
  registerGoNotifications(tabId, ctrl.goToNotificationsView);
  registerGoSecurity(tabId, ctrl.requestSecurityTab);
  registerGoPayments(tabId, ctrl.goToPaymentsView);
  registerGoAdmin(tabId, () => { if (ctrl.token && ctrl.isAdmin && !ctrl.guestMode) setAdminDrawerOpen(true); });
  registerGoJobs(tabId, ctrl.goToJobsView);
  registerGoPublicaciones(tabId, ctrl.goToPublicacionesView);
  registerGoNewTicket(tabId, ctrl.openNewTicketModal);
  registerShareLink(tabId, ctrl.handleIncomingShareLink);

  // Las acciones contextuales (New/Importar/Exportar, Refrescar, etc.) ya NO se
  // publican al navbar superior (removido): cada pantalla las renderiza encima
  // de su buscador (ver `NavActions`).

  useEffect(() => {
    onViewChange(tabId, ctrl.view);
  }, [tabId, ctrl.view, onViewChange]);

  useEffect(() => {
    onGuestModeChange(tabId, ctrl.guestMode);
  }, [tabId, ctrl.guestMode, onGuestModeChange]);

  // Idioma GLOBAL (no por-tab). UP: reporta el cambio de ESTE tab al estado global de
  // MainScreen. DOWN: cuando otro tab —o Perfil— lo cambia, se refleja en `globalLanguage`
  // y aquí se sincroniza el controller de este tab, así TODOS los tabs (y sus webviews)
  // quedan en el mismo idioma.
  useEffect(() => {
    onLanguageChange(ctrl.language);
  }, [ctrl.language, onLanguageChange]);
  // Deps SOLO `[globalLanguage]`: incluir `ctrl.language`/`ctrl.setLanguage` re-ejecutaba el
  // efecto al cambiar su identidad → cascada → "Maximum update depth". La closure ya captura
  // los valores actuales; el guard evita el re-set en el tab que originó el cambio.
  useEffect(() => {
    if (globalLanguage && globalLanguage !== ctrl.language) {
      ctrl.setLanguage(globalLanguage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalLanguage]);

  // Registra el "chrome" (tema/cuenta/idioma) de esta pestaña para el navbar.
  useEffect(() => {
    registerChrome(tabId, {
      theme: ctrl.theme,
      toggleTheme: ctrl.toggleTheme,
      language: ctrl.language,
      setLanguage: ctrl.setLanguage,
      displayName: ctrl.displayName,
      switchAccount: ctrl.switchAccount,
      logout: ctrl.logout,
      isAdmin: ctrl.isAdmin,
      tokensAvailable: ctrl.tokensAvailable,
      accountOpenSignal: ctrl.accountOpenSignal,
      paymentsModalOpen: ctrl.paymentsOpen,
    });
  }, [tabId, registerChrome, ctrl.theme, ctrl.toggleTheme, ctrl.language, ctrl.setLanguage, ctrl.displayName, ctrl.switchAccount, ctrl.logout, ctrl.isAdmin, ctrl.tokensAvailable, ctrl.accountOpenSignal, ctrl.paymentsOpen]);

  if (ctrl.view === "splash") return <SplashScreen theme={ctrl.theme} language={ctrl.language} />;
  if (ctrl.view === "loading-panel") return <LoadingPanelScreen theme={ctrl.theme} language={ctrl.language} />;
  if (ctrl.view === "login") return <LoginScreen theme={ctrl.theme} onToggleTheme={ctrl.toggleTheme} language={ctrl.language} setLanguage={ctrl.setLanguage} onGuestEnter={ctrl.enterAsGuest} />;
  // Vista NATIVA de un servidor standalone conectado (conexión directa, sin
  // webview ni openExternal). Tiene prioridad sobre las vistas normales del tab.
  if (activeStandalone) {
    return (
      <StandaloneServerScreen
        server={activeStandalone}
        theme={ctrl.theme}
        language={ctrl.language}
        onBack={() => setActiveStandalone(null)}
      />
    );
  }
  if (ctrl.view === "ssh") {
    const panel = ctrl.panels.find((entry) => entry.id === ctrl.activePanelId);
    return (
      <SshScreen
        theme={ctrl.theme}
        sshUrl={ctrl.sshUrl}
        panelId={ctrl.activePanelId ?? ""}
        panelName={panel?.licenseName || panel?.customDomain || "LUXIPANEL"}
        tabId={tabId}
        language={ctrl.language}
        onConnected={ctrl.handleSshConnected}
        onBack={ctrl.goToServersView}
      />
    );
  }

  return (
    <div data-theme={ctrl.theme} className={`${styles.tabContent} h-full text-base-content`} style={{ ["--ms-page-bg" as string]: getPageGradient(ctrl.theme) }}>
      {ctrl.view === "dashboard" ? (
        <DashboardScreen
          isDark={ctrl.isDark}
          language={ctrl.language}
          licensedCount={ctrl.licensedCount}
          unlicensedCount={ctrl.unlicensedCount}
          busyPanels={ctrl.busyPanels}
          panelRows={ctrl.panelRows}
          panelMetrics={ctrl.panelMetrics}
          onActiveServerPanelChange={ctrl.onActiveServerPanelChange}
          refreshPanelMetrics={ctrl.refreshPanelMetrics}
          pendingFocusPanelId={ctrl.pendingFocusPanelId}
          clearPendingFocus={ctrl.clearPendingFocus}
          balancesVersion={ctrl.balancesVersion}
          onPanelRowAction={(a, r) => void ctrl.handlePanelRowAction(a, r)}
          onOpenCreatePanel={ctrl.guestMode
            ? () => { const link = window.prompt(getMessages(ctrl.language).login.guestPrompt); if (link) ctrl.enterAsGuest(link.trim()); }
            : ctrl.openCreatePanelModal}
          onOpenStandalone={ctrl.guestMode ? undefined : () => setStandaloneOpen(true)}
          onRefreshPanels={ctrl.refreshPanels}
          onGoSupport={ctrl.guestMode ? undefined : ctrl.goToSupportView}
          onGoPayments={ctrl.guestMode ? undefined : ctrl.goToPaymentsView}
          onGoSecurity={ctrl.guestMode ? undefined : ctrl.requestSecurityTab}
          onGoDevPortal={ctrl.guestMode ? undefined : ctrl.goToDevPortalView}
          onGoModuleStore={ctrl.guestMode ? undefined : ctrl.goToModuleStoreView}
          onGoBlog={ctrl.guestMode ? undefined : ctrl.goToBlogView}
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
      ) : null}

      {ctrl.view === "support" && !ctrl.ticketDetail.open ? (
        <SupportScreen
          isDark={ctrl.isDark}
          language={ctrl.language}
          token={ctrl.token ?? ""}
          isAdmin={ctrl.isAdmin}
          openTicketsCount={ctrl.openTicketsCount}
          totalTickets={ctrl.tickets.length}
          busyTickets={ctrl.busyTickets}
          ticketRows={ctrl.ticketRows}
          onRefreshTickets={ctrl.refreshSupportTickets}
          onTicketRowAction={ctrl.handleSupportRowAction}
          onGoServers={ctrl.goToServersView}
          onOpenNewTicket={ctrl.openNewTicketModal}
        />
      ) : null}

      {ctrl.view === "support" && ctrl.ticketDetail.open ? (
        <TicketDetailScreen
          state={ctrl.ticketDetail}
          setState={ctrl.setTicketDetail}
          onBack={ctrl.closeTicketDetail}
          sendReply={(attachments) => void ctrl.sendTicketReply(attachments)}
          currentUserId={ctrl.currentUserId}
          token={ctrl.token ?? null}
          language={ctrl.language}
        />
      ) : null}

      {ctrl.view === "notifications" ? (
        <NotificationsScreen
          token={ctrl.token ?? ""}
          language={ctrl.language}
          onOpenServer={(panelId) => ctrl.focusServerPanel(panelId)}
        />
      ) : null}

      {ctrl.view === "jobs" && ctrl.token ? (
        <JobsScreen
          token={ctrl.token}
          language={ctrl.language}
          onGoServers={ctrl.goToServersView}
          isAdmin={ctrl.isAdmin}
        />
      ) : null}

      {ctrl.view === "publicaciones" && ctrl.token ? (
        <PublicacionesScreen
          token={ctrl.token}
          language={ctrl.language}
          currentUserId={ctrl.currentUserId}
          isAdmin={ctrl.isAdmin}
        />
      ) : null}

      {/* Seguridad y Pagos ya no son vistas: ambas viven en modales globales.
          Seguridad es una pestaña del modal de cuenta (AccountMenu, vía
          ctrl.accountOpenSignal); Pagos (compras de datos/tokens) es el
          PaymentsModal montado más abajo junto al resto de modales. */}

      {/* Fase W — gaps de web nativos en desktop. */}
      {ctrl.view === "dev-portal" && ctrl.token ? (
        <DevPortalScreen token={ctrl.token} language={ctrl.language} isAdmin={ctrl.isAdmin} />
      ) : null}

      {ctrl.view === "module-store" && ctrl.token ? (
        <ModuleStoreScreen token={ctrl.token} language={ctrl.language} isAdmin={ctrl.isAdmin} />
      ) : null}

      {ctrl.view === "blog" && ctrl.token ? (
        <BlogScreen token={ctrl.token} language={ctrl.language} isAdmin={ctrl.isAdmin} />
      ) : null}

      <PanelEditorModal
        panelEditor={ctrl.panelEditor}
        taxonomy={ctrl.taxonomy}
        sshKeys={ctrl.sshKeys}
        setPanelEditor={ctrl.setPanelEditor}
        closePanelEditor={ctrl.closePanelEditor}
        submitPanelEditor={ctrl.submitPanelEditor}
        requestDeletePanel={ctrl.requestDeletePanelFromEditor}
        sshAdvanced={ctrl.token ? {
          token: ctrl.token,
          taxonomy: ctrl.taxonomy,
          sshKeys: ctrl.sshKeys,
          panels: ctrl.panelRows.map((row) => ({ id: row.id, label: `${row.nameLabel} · ${row.accessDomain}` })),
          refreshTaxonomy: ctrl.refreshTaxonomy,
          refreshSshKeys: ctrl.refreshSshKeys,
          refreshPanels: ctrl.refreshPanels,
          applyCategoryCreated: ctrl.applyCategoryCreated,
          applyCategoryRenamed: ctrl.applyCategoryRenamed,
          applyCategoryDeleted: ctrl.applyCategoryDeleted,
          applyTagCreated: ctrl.applyTagCreated,
          applyTagRenamed: ctrl.applyTagRenamed,
          applyTagDeleted: ctrl.applyTagDeleted,
          applySshKeyCreated: ctrl.applySshKeyCreated,
          applySshKeyUpdated: ctrl.applySshKeyUpdated,
          applySshKeyDeleted: ctrl.applySshKeyDeleted,
        } : undefined}
        language={ctrl.language}
      />
      <PanelCredentialRevealModal
        secret={ctrl.credentialReveal}
        onClose={() => ctrl.setCredentialReveal(null)}
        language={ctrl.language}
      />
      <DeletePanelModal
        deletePanel={ctrl.deletePanelState}
        closeDeletePanel={ctrl.closeDeletePanelModal}
        confirmDeletePanel={ctrl.confirmDeletePanel}
        language={ctrl.language}
      />
      <PublicProfileDrawer
        open={ctrl.publicProfile.open}
        onClose={ctrl.closePublicProfile}
        userId={ctrl.publicProfile.userId}
        userName={ctrl.publicProfile.userName}
        token={ctrl.token ?? ""}
        language={ctrl.language}
      />
      <ConnectionErrorModal
        state={ctrl.connectionError}
        onClose={ctrl.closeConnectionErrorModal}
        language={ctrl.language}
      />
      <ConnectLocalKeyModal
        state={ctrl.connectLocalKey}
        setState={ctrl.setConnectLocalKey}
        close={ctrl.closeConnectLocalKey}
        submit={() => void ctrl.submitConnectLocalKey()}
        language={ctrl.language}
      />
      <ConnectMethodModal
        state={ctrl.connectMethod}
        onClose={ctrl.closeConnectMethod}
        onUseSaved={() => void ctrl.confirmConnectMethodSaved()}
        onUseLocalKey={ctrl.confirmConnectMethodLocal}
        language={ctrl.language}
      />
      <ConnectSshKeyModal
        state={ctrl.connectKey}
        onSelect={ctrl.setConnectKeySelectedId}
        onClose={ctrl.closeConnectKeyModal}
        onConfirm={() => void ctrl.confirmConnectWithKey()}
        language={ctrl.language}
      />
      <StandaloneManagerModal
        open={standaloneOpen}
        onClose={() => setStandaloneOpen(false)}
        language={ctrl.language}
        onOpenServer={openStandaloneServer}
      />
      <NewTicketModal
        state={ctrl.newTicket}
        setState={ctrl.setNewTicket}
        close={ctrl.closeNewTicketModal}
        submit={(attachments) => void ctrl.submitNewTicket(attachments)}
        token={ctrl.token ?? null}
        language={ctrl.language}
      />
      {!ctrl.guestMode ? (
        <PaymentsModal
          open={ctrl.paymentsOpen}
          onClose={ctrl.closePayments}
          language={ctrl.language}
          token={ctrl.token ?? ""}
          payments={ctrl.paymentRows}
          busy={ctrl.busyPayments}
          onRefresh={() => void ctrl.refreshPayments()}
          onBalancesChanged={ctrl.notifyBalancesChanged}
          initialTab={ctrl.paymentsInitialTab ?? undefined}
          isAdmin={ctrl.isAdmin}
        />
      ) : null}
      {adminDrawerOpen && ctrl.isAdmin && ctrl.token && !ctrl.guestMode ? (
        <div className={styles.adminDrawerLayer}>
          <button type="button" className={styles.adminDrawerBackdrop} aria-label={getMessages(ctrl.language).admin.close}
            onClick={() => setAdminDrawerOpen(false)} />
          <aside className={styles.adminDrawerPanel} role="dialog" aria-modal="true" aria-label={getMessages(ctrl.language).admin.section}>
            <div className={styles.adminDrawerHeader}>
              <div className={styles.adminDrawerIdentity}>
                <span className={styles.adminDrawerIcon}><ShieldCheck size={21} /></span>
                <div className={styles.adminDrawerHeading}>
                  <strong>{getMessages(ctrl.language).admin.section}</strong>
                </div>
              </div>
              <div className={styles.adminDrawerActions}>
                <button type="button" className={styles.adminDrawerDocs}
                  onClick={() => openExternal(`${ENV.luxipanelUrl.replace(/\/+$/, "")}/documentation`)}>
                  <BookOpen size={17} />
                  <span>{getMessages(ctrl.language).dataTableSettings.sshKeysTab.docsLink.replace(/[←→]\s*$/, "")}</span>
                </button>
                <button type="button" className={styles.adminDrawerClose} onClick={() => setAdminDrawerOpen(false)}
                  aria-label={getMessages(ctrl.language).admin.close}><X size={19} /></button>
              </div>
            </div>
            <AdminScreen language={ctrl.language} token={ctrl.token} />
          </aside>
        </div>
      ) : null}
    </div>
  );
}

export default function MainScreen() {
  const { tabs, activeTabId, setActiveTabId, openNewTab, closeTab, renameTab, setTabAutoLabel, updateTabSession } = useTabs();
  const { token } = useAuth();
  const previousToken = useRef(token);
  useEffect(() => { void migrateLegacyStandaloneSecrets(); }, []);
  useEffect(() => {
    if (previousToken.current !== token) clearStandaloneSecretsFromMemory();
    previousToken.current = token;
  }, [token]);
  // Cambiador de pestañas tipo Alt+Tab (Ctrl+Tab). El ref apunta al contenedor
  // de la pestaña VISIBLE para capturar su miniatura.
  const activeTabNodeRef = useRef<HTMLDivElement | null>(null);
  const tabSwitcher = useTabSwitcher({
    tabs,
    activeTabId,
    setActiveTabId,
    getActiveNode: () => activeTabNodeRef.current,
  });
  const goServersMapRef = useRef<Record<string, (() => void) | undefined>>({});
  const goSupportMapRef = useRef<Record<string, (() => void) | undefined>>({});
  const goNotificationsMapRef = useRef<Record<string, (() => void) | undefined>>({});
  const goSecurityMapRef = useRef<Record<string, (() => void) | undefined>>({});
  const goPaymentsMapRef = useRef<Record<string, (() => void) | undefined>>({});
  const goAdminMapRef = useRef<Record<string, (() => void) | undefined>>({});
  // Empleos (marketplace de requerimientos con escrow de tokens).
  const goJobsMapRef = useRef<Record<string, (() => void) | undefined>>({});
  // Publicaciones (muro social: notas/encuestas con reacciones).
  const goPublicacionesMapRef = useRef<Record<string, (() => void) | undefined>>({});
  const goNewTicketMapRef = useRef<Record<string, (() => void) | undefined>>({});
  // Deep-link (luxipanel://panel-share) → enter guest mode on the active tab.
  const shareLinkMapRef = useRef<Record<string, ((url: string) => void) | undefined>>({});
  const [tabViews, setTabViews] = useState<Record<string, string>>({});
  const [tabGuestModes, setTabGuestModes] = useState<Record<string, boolean>>({});
  const [tabInitialGuest, setTabInitialGuest] = useState<Record<string, boolean>>({});
  // Chrome (tema/cuenta) de cada pestaña, para la barra de título. Las acciones
  // contextuales ya no se publican aquí: cada pantalla las renderiza sola.
  const [tabChrome, setTabChrome] = useState<Record<string, NavbarChrome>>({});
  const [assistantOpen, setAssistantOpen] = useState(false);
  // Avatar del asistente de soporte ACTIVO para mostrarlo (redondeado) en el
  // FAB, antes de abrir el drawer. Se carga eager con sesión: el endpoint de
  // identidad es read-only y no cobra diamantes. Si falla, el FAB cae al icono.
  const [assistantAvatar, setAssistantAvatar] = useState<string | null>(null);
  useEffect(() => {
    if (!token) {
      setAssistantAvatar(null);
      return;
    }
    let cancelled = false;
    void getSupportAssistantIdentity(token).then((id) => {
      if (!cancelled && id?.avatarUrl) setAssistantAvatar(resolveAvatarUrl(id.avatarUrl));
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Conexión SSE persistente de notificaciones en background. Se abre cuando hay
  // sesión (token) y se cierra en logout/cambio de cuenta/desmontaje. Como la app
  // vive en bandeja, el stream sobrevive a la ventana oculta y dispara un toast
  // nativo de Windows (vía electronApi.notify en main.cjs) por cada evento. Un
  // solo EventSource activo: el efecto se re-suscribe si cambia el token.
  useEffect(() => {
    if (!token) return;
    const handle = startNotificationStream(token);
    return () => handle.close();
  }, [token]);

  const registerGoServers = useCallback((tabId: string, handler: (() => void) | null) => {
    goServersMapRef.current[tabId] = handler ?? undefined;
  }, []);

  const registerGoSupport = useCallback((tabId: string, handler: (() => void) | null) => {
    goSupportMapRef.current[tabId] = handler ?? undefined;
  }, []);

  const registerGoNotifications = useCallback((tabId: string, handler: (() => void) | null) => {
    goNotificationsMapRef.current[tabId] = handler ?? undefined;
  }, []);

  const registerGoSecurity = useCallback((tabId: string, handler: (() => void) | null) => {
    goSecurityMapRef.current[tabId] = handler ?? undefined;
  }, []);

  const registerGoPayments = useCallback((tabId: string, handler: (() => void) | null) => {
    goPaymentsMapRef.current[tabId] = handler ?? undefined;
  }, []);

  const registerGoAdmin = useCallback((tabId: string, handler: (() => void) | null) => {
    goAdminMapRef.current[tabId] = handler ?? undefined;
  }, []);

  const registerGoJobs = useCallback((tabId: string, handler: (() => void) | null) => {
    goJobsMapRef.current[tabId] = handler ?? undefined;
  }, []);

  const registerGoPublicaciones = useCallback((tabId: string, handler: (() => void) | null) => {
    goPublicacionesMapRef.current[tabId] = handler ?? undefined;
  }, []);

  const registerGoNewTicket = useCallback((tabId: string, handler: (() => void) | null) => {
    goNewTicketMapRef.current[tabId] = handler ?? undefined;
  }, []);

  const registerShareLink = useCallback((tabId: string, handler: ((url: string) => void) | null) => {
    shareLinkMapRef.current[tabId] = handler ?? undefined;
  }, []);

  // Incoming luxipanel:// deep links (from the Electron main process) are routed
  // to the active tab's guest handler, which enters the guest carousel.
  useEffect(() => {
    const api = window.electronApi;
    if (!api?.onDeeplink) return;
    return api.onDeeplink((url) => {
      shareLinkMapRef.current[activeTabId]?.(url);
    });
  }, [activeTabId]);

  // Igual que navActions: el `chrome` trae funciones que pueden cambiar de
  // identidad cada render (toggleTheme/switchAccount/…). Comparamos una FIRMA de
  // VALORES visibles (tema/idioma/nombre) y solo entonces actualizamos; así no
  // se dispara `setTabChrome` en cada render → sin bucle de render. Las funciones
  // del chrome guardado siguen siendo válidas (cierran sobre el estado vigente
  // en el momento en que un valor cambió).
  const chromeSigRef = useRef<Record<string, string>>({});
  const registerChrome = useCallback((tabId: string, chrome: NavbarChrome) => {
    // `accountOpenSignal.nonce` entra en la firma: así una solicitud de abrir el
    // modal en Seguridad re-propaga el chrome al `AccountMenu` para re-disparar
    // el efecto de apertura aunque nada más haya cambiado.
    const sig = `${chrome.theme}|${chrome.language}|${chrome.displayName}|${chrome.isAdmin ? 1 : 0}|${chrome.tokensAvailable ?? "-"}|${chrome.accountOpenSignal?.nonce ?? "-"}|${chrome.paymentsModalOpen ? 1 : 0}`;
    if (chromeSigRef.current[tabId] === sig) return;
    chromeSigRef.current[tabId] = sig;
    setTabChrome((prev) => ({ ...prev, [tabId]: chrome }));
  }, []);

  const setTabView = useCallback((tabId: string, view: string) => {
    setTabViews((prev) => (prev[tabId] === view ? prev : { ...prev, [tabId]: view }));
  }, []);

  const setTabGuestMode = useCallback((tabId: string, guest: boolean) => {
    setTabGuestModes((prev) => (prev[tabId] === guest ? prev : { ...prev, [tabId]: guest }));
  }, []);

  const handleLogoClick = useCallback(() => {
    goServersMapRef.current[activeTabId]?.();
  }, [activeTabId]);

  const handleGoSupport = useCallback(() => {
    goSupportMapRef.current[activeTabId]?.();
  }, [activeTabId]);

  const handleGoNotifications = useCallback(() => {
    goNotificationsMapRef.current[activeTabId]?.();
  }, [activeTabId]);

  const handleGoPayments = useCallback(() => {
    goPaymentsMapRef.current[activeTabId]?.();
  }, [activeTabId]);

  const handleGoAdmin = useCallback(() => {
    goAdminMapRef.current[activeTabId]?.();
  }, [activeTabId]);

  const handleGoJobs = useCallback(() => {
    goJobsMapRef.current[activeTabId]?.();
  }, [activeTabId]);

  const handleGoPublicaciones = useCallback(() => {
    goPublicacionesMapRef.current[activeTabId]?.();
  }, [activeTabId]);

  const activeGuest = Boolean(tabGuestModes[activeTabId]);
  const activeView = tabViews[activeTabId];
  // El idioma es GLOBAL (no por-tab) y reactivo: cada pestaña reporta su cambio
  // (`onLanguageChange`) y se sincroniza a TODAS (`globalLanguage`), para que afecte a
  // todos los tabs y sus webviews. Se siembra de session-state (persistencia global).
  const [language, setLanguage] = useState<string>(() => loadSessionState().language);
  // La navegación de sección solo aplica con sesión viva; en las pantallas
  // previas (login/splash/loading) el navbar no se muestra.
  const navEnabled = !!activeView && !["login", "splash", "loading-panel"].includes(activeView);
  const handleOpenNewTab = useCallback(() => {
    const newTabId = openNewTab();
    if (activeGuest) setTabInitialGuest((prev) => ({ ...prev, [newTabId]: true }));
  }, [activeGuest, openNewTab]);

  const activeChrome = tabChrome[activeTabId] ?? null;
  // Navegación de sección (Servidores/Soporte/Pagos/Admin) para la barra de
  // título (antes vivía en la barra intermedia, ya removida). Solo con sesión.
  const sectionNav = navEnabled
    ? buildSectionNav({
        t: getMessages(language),
        activeView,
        onServers: handleLogoClick,
        onSupport: activeGuest ? undefined : handleGoSupport,
        onPayments: activeGuest ? undefined : handleGoPayments,
        onNotifications: activeGuest ? undefined : handleGoNotifications,
        onAdmin: activeGuest ? undefined : handleGoAdmin,
        // Empleos: visible con sesión real (no invitado); no es admin-only.
        onJobs: activeGuest ? undefined : handleGoJobs,
        // Publicaciones: visible con sesión real (no invitado); no es admin-only.
        onPublicaciones: activeGuest ? undefined : handleGoPublicaciones,
        showAdmin: !activeGuest && Boolean(activeChrome?.isAdmin),
        // Soporte del CLIENTE → asistente (drawer). La sección "Soporte" del
        // navbar queda solo para staff/admin (consola de tickets).
        showSupport: !activeGuest && Boolean(activeChrome?.isAdmin),
        // Notificaciones: solo con sesión real (no invitado).
        showNotifications: !activeGuest && Boolean(token),
        paymentsActive: Boolean(activeChrome?.paymentsModalOpen),
      })
    : undefined;
  const assistantAvailable =
    navEnabled
    && !activeGuest
    && Boolean(token)
    && ["dashboard", "support"].includes(activeView ?? "");

  // Traduce las acciones del asistente a la navegación interna de la pestaña
  // activa (no hay deep-link de Astro en el cliente desktop).
  const handleAssistantAction = useCallback((action: ChatAction) => {
    setAssistantOpen(false);
    if (action.type === "navigate") {
      const href = action.href.toLowerCase();
      if (href.includes("/support")) goSupportMapRef.current[activeTabId]?.();
      else if (href.includes("/payment")) goPaymentsMapRef.current[activeTabId]?.();
      else if (href.includes("/security")) goSecurityMapRef.current[activeTabId]?.();
      else if (href.includes("/jobs")) goJobsMapRef.current[activeTabId]?.();
      else if (href.includes("/publicaciones")) goPublicacionesMapRef.current[activeTabId]?.();
      else if (href.includes("/server")) goServersMapRef.current[activeTabId]?.();
      return;
    }
    if (action.type === "open_modal") {
      if (action.modal === "new_ticket") goNewTicketMapRef.current[activeTabId]?.();
      else goServersMapRef.current[activeTabId]?.();
    }
  }, [activeTabId]);

  return (
    <>
      <div className="h-screen overflow-hidden">
        <TitleBarTabs
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={setActiveTabId}
          onCloseTab={closeTab}
          onOpenNewTab={handleOpenNewTab}
          onRenameTab={renameTab}
          onLogoClick={handleLogoClick}
          canOpenNewTab={Boolean(token) || activeGuest}
          navEnabled={navEnabled}
          language={language}
          chrome={navEnabled ? activeChrome : null}
          sectionNav={navEnabled ? sectionNav : undefined}
        />
        {/* La barra intermedia (AppNavbar) se removió: la navegación de sección
            vive en la barra de título (arriba) y las acciones contextuales en
            cada pantalla, encima de su buscador. */}
        <div className="mt-[var(--lp-titlebar-h)] h-[calc(100vh-var(--lp-titlebar-h))] overflow-hidden">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              ref={activeTabId === tab.id ? activeTabNodeRef : undefined}
              className={activeTabId === tab.id ? "block h-full" : "hidden"}
            >
              <MainTab
                tabId={tab.id}
                onAutoLabelChange={setTabAutoLabel}
                registerGoServers={registerGoServers}
                registerShareLink={registerShareLink}
                registerGoSupport={registerGoSupport}
                registerGoNotifications={registerGoNotifications}
                registerGoSecurity={registerGoSecurity}
                registerGoPayments={registerGoPayments}
                registerGoAdmin={registerGoAdmin}
                registerGoJobs={registerGoJobs}
                registerGoPublicaciones={registerGoPublicaciones}
                registerGoNewTicket={registerGoNewTicket}
                registerChrome={registerChrome}
                autoConnect={tab.autoConnect !== false}
                initialView={tab.restoreView}
                initialSshUrl={tab.restoreSshUrl}
                initialPanelId={tab.restorePanelId}
                onSessionChange={updateTabSession}
                onViewChange={setTabView}
                onGuestModeChange={setTabGuestMode}
                initialGuestMode={tabInitialGuest[tab.id]}
                onLanguageChange={setLanguage}
                globalLanguage={language}
              />
            </div>
          ))}
        </div>
      </div>
      <TabSwitcherOverlay
        overlay={tabSwitcher.overlay}
        tabs={tabs}
        thumbs={tabSwitcher.thumbs}
        version={tabSwitcher.version}
        onSelect={tabSwitcher.select}
        language={language}
      />
      {/* Botón flotante (FAB) del asistente de soporte: movido fuera del navbar
          para igualar a /app y /web. Visible solo cuando el asistente aplica
          (dashboard/support/payments, con sesión y no invitado). Se DESHABILITA
          (no se oculta) cuando la cuenta se quedó sin datos. El saldo viaja en
          el chrome de la pestaña activa (`activeChrome?.dataMb`). */}
      {assistantAvailable ? (
        (() => {
          const tFab = getMessages(language);
          return (
            <button
              type="button"
              className="lp-support-fab tooltip tooltip-top"
              onClick={() => setAssistantOpen(true)}
              aria-label={tFab.supportAssistant.open}
              data-tip={tFab.supportAssistant.title}
            >
              {assistantAvatar ? (
                <img className="lp-support-fab__avatar" src={assistantAvatar} alt="" aria-hidden="true" />
              ) : (
                <MessageCircle size={18} />
              )}
              <span className="lp-support-fab__label">{tFab.supportAssistant.fabLabel}</span>
            </button>
          );
        })()
      ) : null}
      <AssistantDrawer
        open={assistantOpen}
        onOpenChange={setAssistantOpen}
        token={token ?? null}
        language={language}
        onAction={handleAssistantAction}
        available={assistantAvailable}
      />
    </>
  );
}
