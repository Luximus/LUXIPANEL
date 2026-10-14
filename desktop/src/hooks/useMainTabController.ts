import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { connectPanel, exchangeGuestSession, getCurrentCustomer, getPanelsData, respondPanelInvitation, respondServerUserShare, respondGroupInvite } from "../api/client";
import { normalizeBaseUrl } from "../api/directAuth";
import { ENV } from "../config/env";
import { useAuth } from "../context/useAuth";
import { getWindowTitle, getPanelHost, getPanelSubdomainLabel, getPanelDisplayName, getLicenseState, openExternal } from "../features/app/utils";
import type { View } from "../features/app/types";
import type { AccountOpenSignal } from "../components/AccountMenu";
import type { ConnectionErrorState, PanelRow } from "../features/app/viewModels";
import { getDefaultServer } from "../storage/defaultServer";
import { loadGuestHistory, pushGuestAccessLink, removeGuestEntry, type GuestEntry } from "../storage/guestHistory";
import { clearGuestSession, isGuestSessionValid, loadGuestSession, saveGuestSession } from "../storage/guestSession";
import type { Panel, PanelInvitation } from "../types/models";
import { useThemeLanguage } from "./main-tab/useThemeLanguage";
import { getTokenBalance } from "../api/billing";
import { getMessages } from "../i18n";
import { useToast } from "../components/ToastProvider";
import { parseAccessLink } from "./main-tab/access-link";
import { buildPanelRows } from "./main-tab/panel-rows";
import { useConnectFlows } from "./main-tab/useConnectFlows";
import { usePanelEditor } from "./main-tab/usePanelEditor";
import { usePanelMetrics } from "./main-tab/usePanelMetrics";
import { usePanelStatusChecks } from "./main-tab/usePanelStatusChecks";
import { usePaymentsModal } from "./main-tab/usePaymentsModal";
import { useSupportTickets } from "./main-tab/useSupportTickets";
import { useTaxonomySshKeys } from "./main-tab/useTaxonomySshKeys";

export function useMainTabController({
  tabId,
  onAutoLabelChange,
  autoConnect = true,
  initialView,
  initialSshUrl,
  initialPanelId,
  initialGuestMode = false,
  onSessionChange,
}: {
  tabId: string;
  onAutoLabelChange: (tabId: string, label: string) => void;
  autoConnect?: boolean;
  initialView?: View;
  initialSshUrl?: string;
  initialPanelId?: string;
  initialGuestMode?: boolean;
  onSessionChange?: (tabId: string, session: { view: View; sshUrl: string; panelId: string | null }) => void;
}) {
  const { token, loading, logout: rawLogout, switchAccount: rawSwitchAccount, userEmail } = useAuth();
  // Tema + idioma (aislados de sesión/conexión) → `./main-tab/useThemeLanguage`.
  const { theme, isDark, language, toggleTheme: toggleThemeAndSync, setLanguage: setLanguageAndSync } = useThemeLanguage();
  const toast = useToast();
  const t = getMessages(language);
  const [view, setView] = useState<View>("splash");
  // Señal imperativa para abrir el modal de cuenta en su pestaña Seguridad (el
  // botón Seguridad ya no vive en el navbar; lo dispara el asistente / dashboard).
  // El `nonce` cambia en cada solicitud para re-disparar el efecto del modal
  // aunque la pestaña destino sea la misma.
  const [accountOpenSignal, setAccountOpenSignal] = useState<AccountOpenSignal>(null);
  const [guestMode, setGuestMode] = useState(initialGuestMode);
  const [guestHistory, setGuestHistory] = useState<GuestEntry[]>(() => loadGuestHistory());
  // Guest session JWT (POST /public/guest/exchange) → drives the REAL carousel
  // for guests via `effectiveToken`, the same /portal/* a shared user uses.
  const [guestToken, setGuestToken] = useState<string | null>(null);
  // Token used for panel data / metrics / modules: guest session when browsing
  // as a guest, otherwise the real account token.
  const effectiveToken = guestMode ? guestToken : token;
  const [panels, setPanels] = useState<Panel[]>([]);
  const [invitations, setInvitations] = useState<PanelInvitation[]>([]);
  const [sshUrl, setSshUrl] = useState("");
  const [busyPanels, setBusyPanels] = useState(false);
  const [autoConnectEnabled, setAutoConnectEnabled] = useState(autoConnect);
  const [activePanelId, setActivePanelId] = useState<string | null>(initialPanelId ?? null);
  // Per-tab restore is consumed once on first ready transition. After that we
  // follow user-driven view/sshUrl changes.
  const restoreConsumedRef = useRef(false);
  const [revealedPanelIps, setRevealedPanelIps] = useState<Record<string, boolean>>({});
  // Estado en vivo del servidor por panel (ping = test-connection SSH) →
  // `./main-tab/usePanelStatusChecks` (cache TTL + volcado por lotes).
  const { panelStatuses, runPanelStatusChecks, invalidatePanelStatus } = usePanelStatusChecks({ token });
  // Métricas en vivo (CPU/RAM/disco) del slide visible + paleta de marca por
  // servidor + foco pendiente → `./main-tab/usePanelMetrics`.
  const {
    panelMetrics,
    onActiveServerPanelChange,
    refreshPanelMetrics,
    pendingFocusPanelId,
    clearPendingFocus,
    focusServerPanel,
  } = usePanelMetrics({ effectiveToken, view, setView });
  const [accountOpen, setAccountOpen] = useState(false);
  // Taxonomía + llaves SSH (con mutadores locales que reconcilian paneles) →
  // `./main-tab/useTaxonomySshKeys`.
  const {
    taxonomy,
    sshKeys,
    refreshTaxonomy,
    refreshSshKeys,
    applyCategoryCreated,
    applyCategoryRenamed,
    applyCategoryDeleted,
    applyTagCreated,
    applyTagRenamed,
    applyTagDeleted,
    applySshKeyCreated,
    applySshKeyUpdated,
    applySshKeyDeleted,
  } = useTaxonomySshKeys({ token, setPanels });
  // Soporte (lista + poll 45s + nuevo ticket + detalle/hilo) →
  // `./main-tab/useSupportTickets`.
  const {
    tickets,
    busyTickets,
    ticketRows,
    openTicketsCount,
    refreshSupportTickets,
    newTicket,
    setNewTicket,
    openNewTicketModal,
    closeNewTicketModal,
    submitNewTicket,
    ticketDetail,
    setTicketDetail,
    openTicketDetail,
    closeTicketDetail,
    sendTicketReply,
    changeTicketStatus,
    handleSupportRowAction,
  } = useSupportTickets({ token, view, t, toast });
  // Modal global de Pagos (compras/consumo/historial) →
  // `./main-tab/usePaymentsModal`.
  const {
    paymentsInitialTab,
    paymentsOpen,
    paymentRows,
    productRows,
    busyPayments,
    openPaymentsView,
    closePayments,
    refreshPayments,
    purchasePlan,
  } = usePaymentsModal({ token, t, toast, setView });
  const accountRef = useRef<HTMLDivElement | null>(null);
  // Drawer de perfil público (badge "compartido por X").
  const [publicProfile, setPublicProfile] = useState<{ open: boolean; userId: string | null; userName: string }>({ open: false, userId: null, userName: "" });
  const [connectionError, setConnectionError] = useState<ConnectionErrorState>({ open: false, panelName: "", message: "" });
  // Conexión DIRECTA nativa desde la tarjeta de panel (owner) → aislada en
  const activeConnectionRef = useRef<{ panelId: string; panelName: string } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const displayName = useMemo(() => (guestMode ? t.common.guest : (!userEmail ? t.common.accountFallback : (userEmail.split("@")[0] ?? t.common.accountFallback).split(/[._-]/g).filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join(" "))), [guestMode, userEmail, t]);
  const licensedCount = useMemo(() => panels.filter((panel) => getLicenseState(panel) === "license_active").length, [panels]);
  const unlicensedCount = useMemo(() => Math.max(0, panels.length - licensedCount), [panels.length, licensedCount]);

  // Proyección Panel → PanelRow extraída a `./main-tab/panel-rows` (builder
  // puro); el memo conserva las mismas dependencias que el original.
  const panelRows = useMemo<PanelRow[]>(
    () => buildPanelRows({ panels, revealedPanelIps, panelStatuses, language, t }),
    [panels, revealedPanelIps, panelStatuses, language, t],
  );

  // Hydrate a previously persisted guest session (instant carousel on relaunch).
  useEffect(() => {
    if (!guestMode) return;
    const s = loadGuestSession();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga/estado inicial intencional del efecto
    if (s && isGuestSessionValid(s)) setGuestToken((current) => current ?? s.guestToken);
  }, [guestMode]);

  // Exchange the vigentes invitation links (access-link tokens) for a guest
  // session JWT. Re-runs when the links change; a 404 clears it.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga/estado inicial intencional del efecto
    if (!guestMode) { setGuestToken(null); return; }
    const tokens = guestHistory.map((e) => e.token);
    if (tokens.length === 0) { setGuestToken(null); clearGuestSession(); return; }
    let cancelled = false;
    void (async () => {
      try {
        const res = await exchangeGuestSession({ tokens });
        if (cancelled) return;
        if (res.guestToken) {
          setGuestToken(res.guestToken);
          saveGuestSession({ guestToken: res.guestToken, expiresAt: res.expiresAt });
        } else {
          setGuestToken(null);
        }
      } catch {
        if (!cancelled) { setGuestToken(null); clearGuestSession(); }
      }
    })();
    return () => { cancelled = true; };
  }, [guestMode, guestHistory]);

  // Load the REAL panels the guest has access to (shared/granular) using the
  // guest token — same shape as a logged-in shared user.
  useEffect(() => {
    if (!guestMode || !guestToken) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga/estado inicial intencional del efecto
    setBusyPanels(true);
    void (async () => {
      try {
        const data = await getPanelsData(guestToken);
        if (cancelled) return;
        setPanels(data.panels);
        setInvitations(data.invitations);
      } catch {
        /* keep prior panels on transient failure */
      } finally {
        if (!cancelled) setBusyPanels(false);
      }
    })();
    return () => { cancelled = true; };
  }, [guestMode, guestToken]);

  // Etiqueta del panel para la pestaña y el título de ventana: el SUBDOMINIO
  // ESTÁTICO del panel (p. ej. "mipanel"), nunca el subdominio rotatorio
  // dinámico que el backend devuelve como `redirectUrl` y que carga el webview
  // (`jbnaiqi7….luxipanel.com`). El subdominio estático sale del panel
  // conectado (`activePanelId`); en modo invitado no hay panel en memoria pero
  // el `sshUrl` ya es el host estático, así que basta su primera etiqueta.
  const sshSubdomainLabel = useMemo(() => {
    if (view !== "ssh" || !sshUrl) return "";
    const connectedPanel = activePanelId ? panels.find((panel) => panel.id === activePanelId) : null;
    if (connectedPanel) {
      const label = getPanelSubdomainLabel(getPanelHost(connectedPanel));
      if (label && label !== "-") return label;
    }
    try {
      return getPanelSubdomainLabel(new URL(sshUrl).hostname);
    } catch {
      return "";
    }
  }, [view, sshUrl, activePanelId, panels]);

  useEffect(() => {
    const title = getWindowTitle(view, sshSubdomainLabel);
    document.title = title;
    void window.electronApi?.setTitle(title);
  }, [sshSubdomainLabel, view]);

  useEffect(() => {
    if (view === "ssh" && sshUrl) {
      onAutoLabelChange(tabId, sshSubdomainLabel || "Servers");
      return;
    }
    if (view === "support") {
      onAutoLabelChange(tabId, "Support");
      return;
    }
    onAutoLabelChange(tabId, "Servers");
  }, [onAutoLabelChange, sshUrl, tabId, view, sshSubdomainLabel]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) setAccountOpen(false);
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga/estado inicial intencional del efecto
    if (loading) return setView("splash");
    if (guestMode) {
      setView((current) => (current === "splash" || current === "login" || current === "loading-panel" ? "dashboard" : current));
      return;
    }
    if (!token) {
      setAutoConnectEnabled(true);
      return setView("login");
    }
    setView("loading-panel");
  }, [guestMode, loading, token]);

  useEffect(() => {
    if (!token || view !== "loading-panel") return;
    void (async () => {
      setBusyPanels(true);
      try {
        const data = await getPanelsData(token);
        const list = data.panels;
        setPanels(list);
        setInvitations(data.invitations);
        void runPanelStatusChecks(list);

        // Per-tab restore: consume once. Prefer the panel/url the tab held when
        // the app was last closed; fall back to the global default-server flow.
        const shouldRestoreSsh = !restoreConsumedRef.current && initialView === "ssh";
        const shouldRestoreSupport = !restoreConsumedRef.current && initialView === "support";
        const restorePanelId = shouldRestoreSsh ? (initialPanelId ?? null) : null;
        restoreConsumedRef.current = true;

        if (shouldRestoreSsh) {
          const target = restorePanelId ? list.find((panel) => panel.id === restorePanelId) : null;
          if (target) {
            const host = getPanelHost(target);
            if (host && host !== "-") {
              // LP ya no cobra por conectar: sin gate de datos en el restore.
              activeConnectionRef.current = {
                panelId: target.id,
                panelName: getPanelDisplayName(target),
              };
              setActivePanelId(target.id);
              // Reconnect to mint a fresh one-use SSO ticket. URLs with tickets
              // are never persisted with the tab session.
              let restoredUrl = "";
              try {
                const res = await connectPanel(target.id, token);
                if (res.data?.redirectUrl) restoredUrl = res.data.redirectUrl;
              } catch { /* non-blocking */ }
              setSshUrl(restoredUrl || normalizeBaseUrl(host));
              setView("ssh");
              return;
            }
          }
        }

        if (autoConnectEnabled && !shouldRestoreSupport) {
          const defaultPanelId = await getDefaultServer();
          const current = defaultPanelId ? list.find((panel) => panel.id === defaultPanelId) : null;
          if (current) {
            const host = getPanelHost(current);
            if (host && host !== "-") {
              // LP ya no cobra por conectar: sin gate de datos en el auto-connect.
              activeConnectionRef.current = {
                panelId: current.id,
                panelName: getPanelDisplayName(current),
              };
              setActivePanelId(current.id);
              let connectedUrl = "";
              try {
                const res = await connectPanel(current.id, token);
                connectedUrl = res.data?.redirectUrl ?? "";
              } catch {
                /* non-blocking */
              }
              setSshUrl(connectedUrl || normalizeBaseUrl(host));
              setView("ssh");
              return;
            }
          }
        }

        if (shouldRestoreSupport) {
          setView("support");
          return;
        }
      } catch (error) {
        console.error(error);
      } finally {
        setBusyPanels(false);
      }
      setView("dashboard");
    })();
  }, [autoConnectEnabled, initialPanelId, initialSshUrl, initialView, runPanelStatusChecks, token, view]);

  // Notify the tab manager about the current session (view + ssh target) so it
  // can persist a snapshot used to reopen the tab where it was left.
  useEffect(() => {
    if (!onSessionChange) return;
    if (view === "splash" || view === "loading-panel" || view === "login") return;
    if (guestMode) return;
    onSessionChange(tabId, {
      view,
      // El URL de handoff puede contener un ticket de un solo uso. Sólo se
      // persiste el id del servidor; al restaurar se solicita otro ticket.
      sshUrl: "",
      panelId: view === "ssh" ? activePanelId : null,
    });
  }, [activePanelId, guestMode, onSessionChange, sshUrl, tabId, view]);

  const refreshPanels = useCallback(async () => {
    if (!token) return;
    setBusyPanels(true);
    try {
      const data = await getPanelsData(token);
      setPanels(data.panels);
      setInvitations(data.invitations);
      void runPanelStatusChecks(data.panels);
    } finally {
      setBusyPanels(false);
    }
  }, [runPanelStatusChecks, token]);

  useEffect(() => {
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- carga/estado inicial intencional del efecto
      setCurrentUserId(null);
      setIsAdmin(false);
      return;
    }
    void (async () => {
      await Promise.all([refreshTaxonomy(), refreshSshKeys()]);
      const me = await getCurrentCustomer(token);
      if (me) {
        setCurrentUserId(me.id ?? null);
        setIsAdmin(me.role === "admin");
      } else {
        setCurrentUserId(null);
        setIsAdmin(false);
      }
    })();
  }, [token, refreshTaxonomy, refreshSshKeys]);

  const refreshPanelsData = useCallback(async () => {
    if (!token) return;
    const data = await getPanelsData(token);
    setPanels(data.panels);
    setInvitations(data.invitations);
    void runPanelStatusChecks(data.panels);
  }, [runPanelStatusChecks, token]);

  // Editor de panel (crear/editar) + credencial revelada + borrado →
  // `./main-tab/usePanelEditor`.
  const {
    panelEditor,
    setPanelEditor,
    credentialReveal,
    setCredentialReveal,
    deletePanelState,
    openCreatePanelModal,
    openEditPanelModal,
    closePanelEditor,
    openDeletePanelModal,
    closeDeletePanelModal,
    requestDeletePanelFromEditor,
    submitPanelEditor,
    confirmDeletePanel,
  } = usePanelEditor({ token, t, toast, panels, taxonomy, sshKeys, refreshSshKeys, reloadPanels: refreshPanelsData, invalidatePanelStatus });

  // ── Saldo de tokens (marketplace) para el chip de cuenta ───────────
  // Solo informativo (se muestra en el botón de cuenta).
  // Guests exentos; si falla, conservamos el último valor conocido.
  const [tokensAvailable, setTokensAvailable] = useState<number | null>(null);
  const tokensAvailableRef = useRef<number | null>(null);
  // eslint-disable-next-line react-hooks/refs -- patrón latest-ref: espejo del estado para callbacks
  tokensAvailableRef.current = tokensAvailable;

  const refreshTokenBalance = useCallback(async (): Promise<number | null> => {
    if (guestMode || !token) return null;
    try {
      const balance = await getTokenBalance(token);
      setTokensAvailable(balance.available);
      tokensAvailableRef.current = balance.available;
      return balance.available;
    } catch {
      return tokensAvailableRef.current;
    }
  }, [guestMode, token]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga/estado inicial intencional del efecto
  useEffect(() => { void refreshTokenBalance(); }, [refreshTokenBalance]);

  // Señal de "saldos cambiaron" (p. ej. tras una compra aprobada). Refresca de
  // inmediato los saldos canónicos del controlador (chip de cuenta de MB/tokens
  // + gate de conexiones que lee `dataMbRef`) y bumpea un contador que las
  // pantallas con saldo propio (DashboardScreen: barra de saldo + gating "sin
  // datos") incluyen en sus deps para re-consultar. Así una compra exitosa
  // actualiza TODA la UI de saldos y reactiva lo bloqueado por 0 MB/tokens, sin
  // tener que recargar.
  const [balancesVersion, setBalancesVersion] = useState(0);
  const notifyBalancesChanged = useCallback(() => {
    setBalancesVersion((version) => version + 1);
    void refreshTokenBalance();
  }, [refreshTokenBalance]);

  /** LP ya NO cobra por conectar: gate neutralizado (siempre permite). Se
   *  conserva la función para no reescribir a sus llamadores. */
  const ensureDataAvailable = useCallback((): boolean => true, []);

  // Flujos de conexión vía gateway (SSH guardada / llave local / selector de
  // llave) → `./main-tab/useConnectFlows` (mutan la sesión por setters/ref).
  const {
    performConnect,
    connectLocalKey,
    setConnectLocalKey,
    closeConnectLocalKey,
    submitConnectLocalKey,
    connectMethod,
    closeConnectMethod,
    confirmConnectMethodSaved,
    confirmConnectMethodLocal,
    connectKey,
    setConnectKeySelectedId,
    closeConnectKeyModal,
    confirmConnectWithKey,
  } = useConnectFlows({ token: effectiveToken, t, toast, panels, sshKeys, ensureDataAvailable, activeConnectionRef, setActivePanelId, setSshUrl, setView, setConnectionError });

  const handlePanelRowAction = async (actionId: string, row: PanelRow) => {
    const panel = row.source;
    if (guestMode) {
      if (actionId === "connect") {
        performConnect(panel, panel.sshKeyId ?? undefined);
      }
      return;
    }
    if (actionId === "connect") {
      if (!token) return;
      // SSO del portal, seguido del workspace nativo conectado directamente
      // al box. El ticket no se conserva en el almacenamiento local.
      performConnect(panel, panel.sshKeyId ?? undefined);
      return;
    }

    if (actionId === "toggle_ip") {
      setRevealedPanelIps((current) => ({ ...current, [panel.id]: !current[panel.id] }));
      return;
    }

    if (actionId === "edit") {
      openEditPanelModal(row);
      return;
    }

    if (actionId === "recharge_data") {
      goToPaymentsView();
      return;
    }

    if (actionId === "view_owner") {
      const o = row.source.owner;
      if (o?.id) setPublicProfile({ open: true, userId: o.id, userName: o.name || "" });
      return;
    }

    if (actionId === "delete") {
      openDeletePanelModal(row);
    }
  };

  const openSupportPortal = () => openExternal(`${ENV.luxipanelUrl}/portal/support`);

  const goToSupportView = () => setView("support");
  // Empleos (marketplace de requerimientos). Solo con sesión viva.
  const goToJobsView = () => { if (token) setView("jobs"); };
  // Muro social "Publicaciones" (notas/encuestas). Solo con sesión viva.
  const goToPublicacionesView = () => { if (token) setView("publicaciones"); };
  // Fase W — gaps de web llevados a desktop nativo (dev-portal / tienda de módulos / blog).
  const goToDevPortalView = () => { if (token) setView("dev-portal"); };
  const goToModuleStoreView = () => { if (token) setView("module-store"); };
  const goToBlogView = () => { if (token) setView("blog"); };
  // Historial de notificaciones (toasts en background). Solo con sesión viva.
  const goToNotificationsView = () => { if (token) setView("notifications"); };
  // Solo accesible para admins (la entrada de navegación ya se gatea con isAdmin).
  const goToAdminView = () => { if (token && isAdmin) setView("admin"); };
  const goToServersView = () => setView(token || guestMode ? "dashboard" : "login");
  // Seguridad ahora es una pestaña del modal de cuenta: emite una señal de
  // apertura en vez de cambiar la vista (el botón Seguridad ya no vive en el
  // navbar). El gate de 2FA vive en el propio modal (AccountMenu), igual que
  // antes en MainScreen. Lo disparan el asistente (acción /security) y antes el
  // dashboard.
  const requestSecurityTab = () => {
    if (!token) { setView("login"); return; }
    setAccountOpenSignal({ tab: "security", nonce: Date.now() });
  };
  const goToPaymentsView = () => openPaymentsView(null);

  const backFromSshToDashboard = () => {
    setAutoConnectEnabled(false);
    activeConnectionRef.current = null;
    setActivePanelId(null);
    setSshUrl("");
    setView(guestMode ? "dashboard" : "dashboard");
  };

  const closeConnectionErrorModal = useCallback(() => {
    setConnectionError({ open: false, panelName: "", message: "" });
  }, []);

  const handleSshLoadFailed = useCallback((errorCode: number, errorDescription: string) => {
    // -3 (ABORTED) fires for normal in-app navigations (back/close); ignore it.
    if (errorCode === -3) return;
    const active = activeConnectionRef.current;
    activeConnectionRef.current = null;
    setActivePanelId(null);
    setAutoConnectEnabled(false);
    setSshUrl("");
    setView("dashboard");
    setConnectionError({
      open: true,
      panelName: active?.panelName ?? "",
      message: errorDescription || t.errors.connectionFailed,
    });
  }, [guestMode, t.errors.connectionFailed]);

  const handleSshConnected = useCallback(() => {
    activeConnectionRef.current = null;
  }, []);

  // Parse de `luxipanel://panel-share?token=…&mode=…`: parser puro extraído a
  // `./main-tab/access-link` (import estable, sin deps de React).

  // Entrar como invitado: SIEMPRE cae al carousel. El input puede ser un
  // subdominio/código o un enlace de invitación; el efecto de canje lo resuelve.
  const enterAsGuest = useCallback((raw?: string) => {
    activeConnectionRef.current = null;
    setActivePanelId(null);
    setAutoConnectEnabled(false);
    setSshUrl("");
    setGuestMode(true);
    setView("dashboard");
    const input = (raw ?? "").trim();
    if (!input) return;
    // Solo enlaces de acceso compartibles (la entrada por subdominio fue retirada).
    const parsed = parseAccessLink(input);
    if (parsed?.token) { setGuestHistory(pushGuestAccessLink({ token: parsed.token, mode: parsed.mode ?? "guest" })); }
  }, []);

  // A guest-shareable invitation link arriving via deep link / paste.
  const applyGuestAccessToken = useCallback((accessToken: string) => {
    setGuestHistory(pushGuestAccessLink({ token: accessToken, mode: "guest" }));
    activeConnectionRef.current = null;
    setActivePanelId(null);
    setAutoConnectEnabled(false);
    setSshUrl("");
    setGuestMode(true);
    setView("dashboard");
  }, []);

  const handleIncomingShareLink = useCallback((rawUrl: string) => {
    const parsed = parseAccessLink(rawUrl);
    if (!parsed?.token) return;
    applyGuestAccessToken(parsed.token);
  }, [applyGuestAccessToken]);

  const removeGuestSubdomainAction = useCallback((key: string) => {
    setGuestHistory(removeGuestEntry(key));
  }, []);

  const logout = useCallback(async () => {
    if (guestMode) {
      setGuestMode(false);
      setGuestToken(null);
      clearGuestSession();
      setSshUrl("");
      setActivePanelId(null);
      setView("login");
      return;
    }
    await rawLogout();
  }, [guestMode, rawLogout]);

  const switchAccount = useCallback(async () => {
    if (guestMode) {
      setGuestMode(false);
      setGuestToken(null);
      clearGuestSession();
      setSshUrl("");
      setActivePanelId(null);
      setView("login");
      return;
    }
    await rawSwitchAccount();
  }, [guestMode, rawSwitchAccount]);

  return {
    panels,
    theme,
    language,
    setLanguage: setLanguageAndSync,
    toggleTheme: toggleThemeAndSync,
    view,
    sshUrl,
    activePanelId,
    isDark,
    busyPanels,
    busyTickets,
    panelRows,
    panelMetrics,
    onActiveServerPanelChange,
    refreshPanelMetrics,
    pendingFocusPanelId,
    clearPendingFocus,
    focusServerPanel,
    ticketRows,
    tickets,
    accountRef,
    accountOpen,
    setAccountOpen,
    displayName,
    userEmail,
    switchAccount,
    logout,
    panelEditor,
    credentialReveal,
    setCredentialReveal,
    taxonomy,
    sshKeys,
    refreshTaxonomy,
    refreshSshKeys,
    applyCategoryCreated,
    applyCategoryRenamed,
    applyCategoryDeleted,
    applyTagCreated,
    applyTagRenamed,
    applyTagDeleted,
    applySshKeyCreated,
    applySshKeyUpdated,
    applySshKeyDeleted,
    token,
    setPanelEditor,
    closePanelEditor,
    submitPanelEditor,
    deletePanelState,
    closeDeletePanelModal,
    requestDeletePanelFromEditor,
    confirmDeletePanel,
    publicProfile,
    closePublicProfile: () => setPublicProfile((c) => ({ ...c, open: false })),
    handlePanelRowAction,
    invitations,
    respondInvitation: async (shareId: string, decision: "accepted" | "rejected", kind: "panel_share" | "server_user_share" | "group" = "panel_share") => {
      if (!token) return;
      if (kind === "server_user_share") {
        await respondServerUserShare(shareId, decision, token);
      } else if (kind === "group") {
        await respondGroupInvite(shareId, decision, token);
      } else {
        await respondPanelInvitation(shareId, decision, token);
      }
      await refreshPanelsData();
      toast.success(t.toast.saved);
    },
    openCreatePanelModal,
    openSupportPortal,
    newTicket,
    setNewTicket,
    openNewTicketModal,
    closeNewTicketModal,
    submitNewTicket,
    ticketDetail,
    setTicketDetail,
    openTicketDetail,
    closeTicketDetail,
    sendTicketReply,
    changeTicketStatus,
    handleSupportRowAction,
    isAdmin,
    tokensAvailable,
    balancesVersion,
    notifyBalancesChanged,
    currentUserId,
    refreshPanels,
    refreshSupportTickets,
    goToSupportView,
    goToJobsView,
    goToPublicacionesView,
    goToDevPortalView,
    goToModuleStoreView,
    goToBlogView,
    goToNotificationsView,
    requestSecurityTab,
    goToServersView,
    goToPaymentsView,
    paymentsInitialTab,
    paymentsOpen,
    closePayments,
    accountOpenSignal,
    goToAdminView,
    paymentRows, productRows, busyPayments, refreshPayments, purchasePlan,
    licensedCount,
    unlicensedCount,
    openTicketsCount,
    backFromSshToDashboard,
    connectionError,
    closeConnectionErrorModal,
    connectLocalKey,
    setConnectLocalKey,
    closeConnectLocalKey,
    submitConnectLocalKey,
    connectMethod,
    closeConnectMethod,
    confirmConnectMethodSaved,
    confirmConnectMethodLocal,
    connectKey,
    setConnectKeySelectedId,
    closeConnectKeyModal,
    confirmConnectWithKey,
    handleSshLoadFailed,
    handleSshConnected,
    enterAsGuest,
    handleIncomingShareLink,
    guestMode,
    guestToken,
    effectiveToken,
    guestHistory,
    removeGuestSubdomainAction,
  };
}
