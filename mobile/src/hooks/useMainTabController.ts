// Controlador POR PESTAÑA del shell principal (MainTab). Fase de refactor
// <1000 líneas: los dominios cohesivos viven como sub-hooks/helpers en
// ./main-tab/ (tickets, pagos+IAP, taxonomía, conexiones, editor de panel,
// enlaces compartidos, ping de estado, auto-rótulo). Este archivo conserva el
// NÚCLEO de sesión/vista/paneles/invitado y COMPONE los sub-hooks; su objeto de
// retorno mantiene el mismo contrato que antes (MainScreen/MainTab no cambian).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  getCurrentCustomer,
  getPanelsData,
  exchangeGuestSession,
  getTickets,
  getServerMetrics,
  invalidateSshKeysCache,
  respondPanelInvitation,
  respondServerUserShare,
  respondGroupInvite,
} from "../api/client";
import { useAuth } from "../context/useAuth";
import { getLicenseState } from "../features/app/utils";
import type { View } from "../features/app/types";
import type {
  ConnectionErrorState,
  PanelRow,
  ServerMetricsState,
  ServerPingStatus,
} from "../features/app/viewModels";
import { loadPanelsCache, savePanelsCache } from "../storage/portalDataCache";
import {
  loadGuestHistory,
  loadGuestHistorySync,
  pushGuestAccessLink,
  removeGuestEntry,
  type GuestEntry,
} from "../storage/guestHistory";
import {
  clearGuestSession,
  isGuestSessionValid,
  loadGuestSession,
  saveGuestSession,
} from "../storage/guestSession";
import type { Panel, PanelInvitation, Ticket } from "../types/models";
import { useThemeLanguage } from "./main-tab/useThemeLanguage";
import { buildPanelRowsBase } from "./main-tab/row-builders";
import { computeTabAutoLabel } from "./main-tab/auto-label";
import { runPanelStatusChecksHelper } from "./main-tab/panel-status";
import { runPanelRowAction } from "./main-tab/panel-row-actions";
import { useSupportTickets } from "./main-tab/useSupportTickets";
import { useIapPayments } from "./main-tab/useIapPayments";
import { useTaxonomyActions } from "./main-tab/useTaxonomyActions";
import { useConnectFlows } from "./main-tab/useConnectFlows";
import { usePanelEditor } from "./main-tab/usePanelEditor";
import { useShareLinks } from "./main-tab/useShareLinks";
import {
  applySshKeyCreated,
  applySshKeyDeleted,
  applySshKeyUpdated,
  refreshSshKeys as refreshSshKeysStore,
  useSshKeys,
} from "../features/servers/ssh-keys-store";
import { hydrateTicketsFromCache, replaceTickets } from "../features/support/tickets-store";
import { clearIapPurchaseResult } from "../features/iap/purchase-lifecycle";
import { useAssistantComposer, useAssistantSession } from "../features/assistant/hooks";
import { useRateLimitReload } from "../components/RateLimitProvider";

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
  // Tema + idioma (y sus sync con session-state): sub-hook cohesivo autocontenido.
  const {
    theme,
    isDark,
    language,
    t,
    toggleTheme: toggleThemeAndSync,
    setTheme: setThemeAndSync,
    setLanguage: setLanguageAndSync,
  } = useThemeLanguage();
  // Token de recarga del modal global de 429: cambia cuando el usuario pulsa
  // "Recargar" tras la cuenta atrás. Un efecto más abajo lo observa para volver
  // a cargar los datos de la pantalla actual (espejo del reload del desktop).
  const rateLimitReloadToken = useRateLimitReload();

  const [view, setView] = useState<View>("splash");
  // Pagos + IAP (modal de pagos, historial/catálogo, balancesVersion, ciclo IAP
  // compartido B4 y compras): sub-hook cohesivo ./main-tab/useIapPayments.
  const payments = useIapPayments({ token, t, setView });
  const { goToPaymentsView } = payments;
  const [guestMode, setGuestMode] = useState(initialGuestMode);
  const [guestHistory, setGuestHistory] = useState<GuestEntry[]>(() => loadGuestHistorySync());
  // Guest session JWT (from POST /public/guest/exchange). Drives the REAL
  // carousel for guests via `effectiveToken`, the same /portal/* endpoints a
  // logged-in shared user uses. Null until the invitation links are exchanged.
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [guestAddOpen, setGuestAddOpen] = useState(false);
  // The token actually used for panel data / metrics / modules: the guest
  // session when browsing as a guest, otherwise the real account token.
  const effectiveToken = guestMode ? guestToken : token;
  const [panels, setPanels] = useState<Panel[]>([]);
  const bootstrappedRef = useRef(false);
  const hydratedCacheRef = useRef(false);
  // Dominio SOPORTE (tickets + detalle + modal nuevo): sub-hook cohesivo
  // ./main-tab/useSupportTickets (lista en el store B4).
  const support = useSupportTickets({ token, userEmail, t, bootstrappedRef });
  const { refreshSupportTickets } = support;
  const [invitations, setInvitations] = useState<PanelInvitation[]>([]);
  const [sshUrl, setSshUrl] = useState("");
  // URL navegada DENTRO del WebView de LUXIPANEL (módulo/terminal activo); la
  // reporta `SshScreen.onNavigationStateChange` y la usa el auto-rótulo para que
  // la pestaña refleje qué hace el usuario en el panel ("<subdominio> - <módulo>").
  const [sshWebviewUrl, setSshWebviewUrl] = useState<string | null>(null);
  const [busyPanels, setBusyPanels] = useState(false);
  const [autoConnectEnabled, setAutoConnectEnabled] = useState(autoConnect);
  const [activePanelId, setActivePanelId] = useState<string | null>(initialPanelId ?? null);
  const restoreConsumedRef = useRef(false);
  const [revealedPanelIps, setRevealedPanelIps] = useState<Record<string, boolean>>({});
  // Estado en vivo del servidor por panel (ping = test-connection SSH). Se
  // sondea al cargar y en cada refresh; sólo aplica a paneles propios con IP
  // y credenciales guardadas (los compartidos/sin llave quedan "unknown").
  const [panelStatuses, setPanelStatuses] = useState<Record<string, ServerPingStatus>>({});
  // Último resultado de ping por panel + timestamp, para reusarlo dentro del
  // TTL y no rehacer el handshake SSH en cada carga/refresh.
  const panelStatusCacheRef = useRef<Record<string, { status: ServerPingStatus; at: number }>>({});
  // Métricas en vivo (CPU/RAM/disco) por panel + el panel de la tarjeta visible
  // del carousel. Sólo se sondea el visible (1 cada 30s) mientras la vista esté
  // en "dashboard" y la app en primer plano. Ver efecto más abajo.
  const [panelMetrics, setPanelMetrics] = useState<Record<string, ServerMetricsState>>({});
  const [visibleServerPanelId, setVisibleServerPanelId] = useState<string | null>(null);
  const onActiveServerPanelChange = useCallback((panelId: string | null) => {
    setVisibleServerPanelId(panelId);
  }, []);
  // Estado del chat del panel visible: si la conversación está iniciada, la
  // etiqueta de la pestaña usa el nombre del panel (ver efecto de autoLabel).
  const visibleComposerStarted = useAssistantComposer(visibleServerPanelId ?? "").started;
  // Título/resumen del chat del panel visible (lo publica el pane). El auto-rótulo
  // lo añade al subdominio cuando hay una conversación iniciada.
  const visibleChatTitle = useAssistantSession(visibleServerPanelId ?? "").title;
  // Panel al que el carousel debe desplazarse (p. ej. recién creado). Lo fija
  // submitPanelEditor al crear; el carousel lo consume y luego lo limpia.
  const [pendingFocusPanelId, setPendingFocusPanelId] = useState<string | null>(null);
  const clearPendingFocus = useCallback(() => setPendingFocusPanelId(null), []);
  // Lleva al carousel y desplaza a la tarjeta del panel indicado (p.ej. al tocar
  // una notificación de uso elevado de un servidor). Si el panel no está en la
  // lista, el carousel ignora el foco (no-op).
  const focusServerPanel = useCallback((panelId: string) => {
    setView("dashboard");
    setPendingFocusPanelId(panelId);
  }, []);
  const [accountOpen, setAccountOpen] = useState(false);
  // Sección a enfocar al abrir el menú de cuenta. `menu` muestra el dropdown
  // (perfiles + items); el resto abre directamente su modal (deep-link del
  // asistente / dashboard). El avatar abre `menu`; goToSecurityView abre
  // `security` directo.
  const [accountInitialTab, setAccountInitialTab] = useState<"menu" | "info" | "security" | "payments">("menu");
  // Llaves SSH: dominio extraído al store module-level (fase B4); aquí solo se
  // consume la lista reactiva. Mutadores y selector se re-exportan tal cual.
  const sshKeys = useSshKeys();
  // Refs siempre-actuales para que los mutadores locales lean el estado vigente
  // (nombres antiguos al renombrar/eliminar, y persistir cache sin refetch).
  const panelsRef = useRef(panels);
  panelsRef.current = panels;
  const invitationsRef = useRef(invitations);
  invitationsRef.current = invitations;
  const accountRef = useRef<unknown>(null);
  // Taxonomía (categorías/tags) + mutadores locales: sub-hook cohesivo
  // ./main-tab/useTaxonomyActions (sin efectos).
  const taxonomyApi = useTaxonomyActions({ token, userEmail, panelsRef, invitationsRef, setPanels });
  const { taxonomy, refreshTaxonomy } = taxonomyApi;
  const [connectionError, setConnectionError] = useState<ConnectionErrorState>({
    open: false, panelName: "", message: "",
  });
  // Acción de reintento del modal de reconexión. Vive en un ref (no en el estado)
  // para no serializar funciones ni recrear el modal en cada render. La rellena
  // `promptReconnect`; la consume `reconnect()`.
  const connectionRetryRef = useRef<(() => void | Promise<void>) | null>(null);
  // Abre el modal de reconexión UNIFICADO (servidor caído / sin internet /
  // sesión caducada). Si `retry` viene, el modal ofrece "Reconectar" y al pulsarlo
  // re-ejecuta esa acción para que el usuario siga donde estaba.
  const promptReconnect = useCallback((opts: {
    panelName?: string;
    message?: string;
    kind?: "connection" | "session";
    retry?: (() => void | Promise<void>) | null;
  }) => {
    connectionRetryRef.current = opts.retry ?? null;
    setConnectionError({
      open: true,
      panelName: opts.panelName ?? "",
      message: opts.message ?? "",
      kind: opts.kind ?? "connection",
      canRetry: Boolean(opts.retry),
      reconnecting: false,
    });
  }, []);
  const closeConnectionError = useCallback(() => {
    connectionRetryRef.current = null;
    setConnectionError({ open: false, panelName: "", message: "" });
  }, []);
  // "Reconectar": ejecuta el reintento guardado. El propio reintento navega al
  // panel (éxito) o vuelve a abrir el modal con el error nuevo (fallo); aquí solo
  // marcamos el spinner y, si el modal sigue abierto al terminar, lo quitamos.
  const reconnect = useCallback(async () => {
    const retry = connectionRetryRef.current;
    if (!retry) { closeConnectionError(); return; }
    setConnectionError((prev) => ({ ...prev, reconnecting: true }));
    try {
      await retry();
    } finally {
      setConnectionError((prev) => (prev.open && prev.reconnecting ? { ...prev, reconnecting: false } : prev));
    }
  }, [closeConnectionError]);
  const activeConnectionRef = useRef<{ panelId: string; panelName: string } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const displayName = useMemo(
    () => (guestMode
      ? t.common.guest
      : !userEmail
        ? t.common.accountFallback
        : (userEmail.split("@")[0] ?? t.common.accountFallback)
          .split(/[._-]/g).filter(Boolean)
          .map((p) => p[0].toUpperCase() + p.slice(1)).join(" ")),
    [guestMode, userEmail, t],
  );
  // "Servidores activos" bajo el modelo por datos (MB): un panel está activo si
  // es conectable (getLicenseState === "license_active"); el resto cuenta como
  // inactivo (cancelado o sin saldo). Ya no se gatea por licenseKey/paymentExpired
  // (eso era el modelo viejo de licencias por slot).
  const licensedCount = useMemo(
    () => panels.filter((panel) => getLicenseState(panel) === "license_active").length,
    [panels],
  );
  const unlicensedCount = useMemo(() => Math.max(0, panels.length - licensedCount), [panels.length, licensedCount]);

  // Base estable de filas: solo cambia con panels/IP-revelada/idioma. NO depende
  // del ping (panelStatuses), así el sondeo en background no reconstruye el
  // searchBlob de TODOS los paneles en cada resultado (causa del "cargando y no
  // deja hacer nada"). El estado en vivo se superpone abajo de forma barata.
  const panelRowsBase = useMemo<PanelRow[]>(
    () => buildPanelRowsBase(panels, revealedPanelIps, language, t),
    [panels, revealedPanelIps, language, t],
  );

  // Superpone el estado en vivo (ping) sobre la base. Mantiene la referencia de
  // la fila cuando su estado no cambió, para no re-renderizar filas ajenas.
  const panelRows = useMemo<PanelRow[]>(
    () => panelRowsBase.map((row) => {
      const serverStatus = panelStatuses[row.id] ?? "unknown";
      return serverStatus === row.serverStatus ? row : { ...row, serverStatus };
    }),
    [panelRowsBase, panelStatuses],
  );

  // Auto-rótulo de la pestaña (cálculo puro en ./main-tab/auto-label).
  useEffect(() => {
    onAutoLabelChange(tabId, computeTabAutoLabel({
      view, sshUrl, sshWebviewUrl, panels, activePanelId,
      visibleComposerStarted, visibleServerPanelId, visibleChatTitle,
    }));
  }, [activePanelId, onAutoLabelChange, panels, sshUrl, sshWebviewUrl, tabId, view, visibleChatTitle, visibleComposerStarted, visibleServerPanelId]);

  // Al (re)conectar a un panel se limpia la URL del WebView para no arrastrar el
  // contexto (módulo/terminal) de la conexión anterior hasta el primer evento de
  // navegación de la nueva carga.
  useEffect(() => { setSshWebviewUrl(null); }, [sshUrl]);

  useEffect(() => {
    if (loading) {
      setView("splash");
      return;
    }
    if (guestMode) {
      setView((v) => (v === "splash" || v === "login" || v === "loading-panel" ? "dashboard" : v));
      return;
    }
    if (!token) {
      setAutoConnectEnabled(true);
      setView("login");
      return;
    }
    setView("loading-panel");
  }, [loading, token, guestMode]);

  useEffect(() => {
    if (token) return;
    bootstrappedRef.current = false;
    hydratedCacheRef.current = false;
  }, [token]);

  useEffect(() => {
    if (!token || guestMode || hydratedCacheRef.current) return;
    hydratedCacheRef.current = true;
    void (async () => {
      const [panelsCache] = await Promise.all([
        loadPanelsCache(userEmail),
        hydrateTicketsFromCache(userEmail),
      ]);
      if (panelsCache) {
        setPanels(panelsCache.panels);
        setInvitations(panelsCache.invitations);
      }
    })();
  }, [guestMode, token, userEmail]);

  useEffect(() => {
    void loadGuestHistory().then(setGuestHistory);
  }, []);

  // Hydrate a previously persisted guest session so the guest carousel survives
  // backgrounding/relaunch without a fresh exchange (the exchange effect below
  // refreshes it when the links change or it nears expiry).
  useEffect(() => {
    if (!guestMode) return;
    void loadGuestSession().then((s) => {
      if (s && isGuestSessionValid(s)) setGuestToken((current) => current ?? s.guestToken);
    });
  }, [guestMode]);

  // Exchange the vigentes invitation links (access-link tokens + subdomains) for
  // a guest session JWT. Re-runs whenever the set of links changes; a 404 (no
  // valid link) clears the session so the carousel shows empty rather than stale.
  useEffect(() => {
    if (!guestMode) { setGuestToken(null); return; }
    const tokens = guestHistory.map((e) => e.token);
    if (tokens.length === 0) { setGuestToken(null); void clearGuestSession(); return; }
    let cancelled = false;
    void (async () => {
      try {
        const res = await exchangeGuestSession({ tokens });
        if (cancelled) return;
        if (res.guestToken) {
          setGuestToken(res.guestToken);
          void saveGuestSession({ guestToken: res.guestToken, expiresAt: res.expiresAt });
        }
        // Respuesta SIN token (404 transitorio, o el re-exchange que dispara recargar el
        // historial async tras el sync inicial): NO blanquear un guestToken ya válido. Si se
        // nuleaba, el carousel quedaba con paneles cargados pero SIN token → cada slide caía a
        // `null` (slides en blanco). El caso real "sin enlaces" ya lo cubre el early-return.
      } catch {
        /* fallo transitorio: conservar el guestToken vigente (no blanquear el carousel) */
      }
    })();
    return () => { cancelled = true; };
  }, [guestMode, guestHistory]);

  // Load the REAL panels the guest has access to (shared/granular) using the
  // guest token — same shape as a logged-in shared user, so the carousel and its
  // owner/shared gating work unchanged.
  useEffect(() => {
    if (!guestMode) return;
    // Sin sesión guest válida → NO dejar paneles obsoletos (de un login previo o de un
    // guestToken caducado) en el carousel: aparecerían como slides EN BLANCO (sin token, el
    // slide cae a `null`). Mejor vaciar → el carousel muestra su estado vacío/CTA.
    if (!guestToken) { setPanels([]); return; }
    let cancelled = false;
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

  // Flujos de CONEXIÓN a panel (sesión SSH directa, conexión nativa, SSO de
  // módulos, modales de método/llave y handlers de fallo/expiración): sub-hook
  // cohesivo ./main-tab/useConnectFlows (sin efectos).
  const connect = useConnectFlows({
    token, effectiveToken, guestMode, t, panels, activePanelId,
    setView, setSshUrl, setActivePanelId, setAutoConnectEnabled,
    activeConnectionRef, promptReconnect, setConnectionError,
  });
  const { openDirectPanelSession, openDirectConnect } = connect;

  // Sondeo de estado en vivo por panel (cuerpo puro en ./main-tab/panel-status).
  const runPanelStatusChecks = useCallback(async (list: Panel[]) => {
    if (!token) return;
    await runPanelStatusChecksHelper({ token, list, cache: panelStatusCacheRef.current, setPanelStatuses });
  }, [token]);

  // Polling de métricas (CPU/RAM/disco) SÓLO del panel de la tarjeta visible del
  // carousel: 1 sondeo al activarse + cada 30s, gateado por vista "dashboard" y
  // app en primer plano (AppState). Al hacer swipe a otra tarjeta el efecto se
  // re-arma para el nuevo panel; mantiene el último valor mientras refresca. LP
  // ya no cobra por datos (MB), así que no hay gate de saldo: se sondea siempre.
  useEffect(() => {
    if (!effectiveToken || view !== "dashboard" || !visibleServerPanelId) return;
    const panelId = visibleServerPanelId;
    let cancelled = false;
    const fetchOnce = async () => {
      if (AppState.currentState !== "active") return;
      setPanelMetrics((current) => (current[panelId] ? current : { ...current, [panelId]: { status: "loading" } }));
      const result = await getServerMetrics(panelId, effectiveToken);
      if (cancelled) return;
      setPanelMetrics((current) => ({
        ...current,
        [panelId]: result.ok
          ? { status: "ok", metrics: result.metrics }
          : { status: "error" },
      }));
    };
    void fetchOnce();
    const intervalId = setInterval(() => void fetchOnce(), 30_000);
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void fetchOnce();
    });
    return () => {
      cancelled = true;
      clearInterval(intervalId);
      sub.remove();
    };
  }, [effectiveToken, view, visibleServerPanelId]);

  useEffect(() => {
    if (!token || view !== "loading-panel") return;
    void (async () => {
      setBusyPanels(true);
      try {
        // Antes: el arranque pedía paneles+tickets, pintaba, y VOLVÍA a pedir los
        // paneles y a guardar la caché por segunda vez (el bloque de abajo se
        // ejecutaba también tras el `if`). Ahora es UNA oleada: paneles + tickets
        // en paralelo, un solo volcado de estado y un solo guardado.
        const firstRun = !bootstrappedRef.current;
        const [data, rows] = await Promise.all([
          getPanelsData(token),
          firstRun ? getTickets(token).catch(() => [] as Ticket[]) : Promise.resolve(null),
        ]);
        if (rows) replaceTickets(userEmail, rows);
        bootstrappedRef.current = true;
        const list = data.panels;
        setPanels(list);
        setInvitations(data.invitations);
        // Escritura a SecureStore (Keychain/Keystore, troceada): NO debe bloquear
        // la transición a `dashboard` — el estado en memoria ya se sembró dentro
        // de `savePanelsCache` antes de tocar el disco.
        void savePanelsCache(userEmail, { panels: list, invitations: data.invitations });
        // Sondeo de estado en vivo: diferido (InteractionManager) + por lotes,
        // así no compite con la entrada. Si aun así notas congelación, revisa que
        // el depurador de JS NO esté conectado (serializa todo el JS en dev).
        void runPanelStatusChecks(list);

        // Al ENTRAR a la app SIEMPRE se muestra el carousel de servidores (dashboard): por
        // pedido del usuario ya NO se restaura la vista SSH previa NI se auto-conecta al
        // servidor por defecto en el arranque (no se abre solo el webview de panel/servidor).
        // Las consolas/módulos restaurados siguen FRÍOS: no se montan hasta que el usuario los
        // activa. Para reactivar el auto-arranque, restaurar el bloque de restore-SSH +
        // auto-connect (`shouldRestoreSsh` + `autoConnectEnabled` → `openDirectPanelSession`).
        const shouldRestoreSupport = !restoreConsumedRef.current && initialView === "support";
        const shouldRestoreSecurity = !restoreConsumedRef.current && initialView === "security";
        restoreConsumedRef.current = true;

        if (shouldRestoreSupport) {
          setView("support");
          return;
        }
        if (shouldRestoreSecurity) {
          // Seguridad ya no es una pantalla: restaura al dashboard y abre el
          // modal de cuenta en la pestaña de Seguridad (pasa por el gate de 2FA
          // que aplica el propio AccountMenu).
          setView("dashboard");
          setAccountInitialTab("security");
          setAccountOpen(true);
          return;
        }
      } catch (error) {
        console.error(error);
      } finally {
        setBusyPanels(false);
      }
      setView("dashboard");
    })();
  }, [autoConnectEnabled, initialPanelId, initialView, openDirectPanelSession, runPanelStatusChecks, token, userEmail, view]);

  useEffect(() => {
    if (!onSessionChange) return;
    if (view === "splash" || view === "loading-panel" || view === "login") return;
    if (guestMode) return;
    onSessionChange(tabId, {
      view,
      sshUrl: view === "ssh" ? sshUrl : "",
      panelId: view === "ssh" ? activePanelId : null,
    });
  }, [activePanelId, guestMode, onSessionChange, sshUrl, tabId, view]);

  const refreshPanels = useCallback(async () => {
    if (!token) return;
    setBusyPanels(true);
    try {
      const data = await getPanelsData(token, { force: true }); // refresco explícito
      setPanels(data.panels);
      setInvitations(data.invitations);
      void savePanelsCache(userEmail, { panels: data.panels, invitations: data.invitations });
      void runPanelStatusChecks(data.panels);
    } finally {
      setBusyPanels(false);
    }
    bootstrappedRef.current = true;
  }, [runPanelStatusChecks, token, userEmail]);

  const refreshSshKeys = useCallback(async () => {
    if (!token) return;
    // El store llama a `getSshKeys(token)` sin opciones; tirar la entrada antes
    // garantiza que este refresco explícito vea el estado real del servidor.
    invalidateSshKeysCache();
    await refreshSshKeysStore(token);
  }, [token]);

  useEffect(() => {
    if (!token) {
      setCurrentUserId(null);
      setIsAdmin(false);
      return;
    }
    void (async () => {
      // `/portal/me` NO depende de la taxonomía ni de las llaves: antes esperaba
      // a que ambas terminaran (2 oleadas de red en serie). Ahora las tres salen
      // en la MISMA oleada.
      const [, , me] = await Promise.all([
        refreshTaxonomy(),
        refreshSshKeys(),
        getCurrentCustomer(token),
      ]);
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
    const data = await getPanelsData(token, { force: true }); // refresco explícito
    setPanels(data.panels);
    setInvitations(data.invitations);
    void savePanelsCache(userEmail, { panels: data.panels, invitations: data.invitations });
    void runPanelStatusChecks(data.panels);
  }, [runPanelStatusChecks, token, userEmail]);

  // Editor de panel (crear/editar inline + submit con test SSH) y modal de
  // borrado: sub-hook cohesivo ./main-tab/usePanelEditor.
  const editor = usePanelEditor({
    token, userEmail, t, taxonomy, sshKeys, panels,
    setPanels, setInvitations, panelStatusCacheRef, setPendingFocusPanelId,
    refreshSshKeys, refreshPanelsData,
  });
  const { openEditPanelModal, openDeletePanelModal } = editor;

  // "Recargar" del modal global de 429: cuando el usuario confirma tras la cuenta
  // atrás, `rateLimitReloadToken` se incrementa y aquí re-disparamos la carga de
  // datos de la pantalla actual (paneles + invitaciones, tickets, taxonomía,
  // llaves SSH y saldo de datos), análogo al reload de la SPA del desktop pero
  // SIN tirar la app: conserva auth, pestañas y navegación. Saltamos el valor
  // inicial (token 0) para no refetch en el primer render. En modo invitado no
  // hay datos de cuenta que recargar.
  const reloadTokenSeenRef = useRef(rateLimitReloadToken);
  useEffect(() => {
    if (reloadTokenSeenRef.current === rateLimitReloadToken) return;
    reloadTokenSeenRef.current = rateLimitReloadToken;
    if (!token || guestMode) return;
    void Promise.allSettled([
      refreshPanelsData(),
      refreshSupportTickets(),
      refreshTaxonomy(),
      refreshSshKeys(),
    ]);
  }, [rateLimitReloadToken, token, guestMode, refreshPanelsData, refreshSupportTickets, refreshTaxonomy, refreshSshKeys]);

  // Enlaces de acceso compartibles entrantes (deep-links panel-share/panel-access):
  // sub-hook cohesivo ./main-tab/useShareLinks.
  const shareLinks = useShareLinks({
    token, t, setView, setActivePanelId, setAutoConnectEnabled, setSshUrl,
    setGuestMode, setGuestHistory, activeConnectionRef, refreshPanelsData,
  });
  const { parseIncomingAccessLink } = shareLinks;

  // Acciones de fila/tarjeta de panel (cuerpo puro en ./main-tab/panel-row-actions).
  const handlePanelRowAction = (actionId: string, row: PanelRow) => runPanelRowAction({
    token, effectiveToken, guestMode, t, activeConnectionRef,
    setSshUrl, setView, goToPaymentsView, openDirectConnect,
    openEditPanelModal, openDeletePanelModal,
    toggleRevealedIp: (panelId: string) => {
      setRevealedPanelIps((current) => ({ ...current, [panelId]: !current[panelId] }));
    },
  }, actionId, row);

  const goToSupportView = () => setView("support");
  const goToServersView = () => setView(token || guestMode ? "dashboard" : "login");
  const goToBlogFeedView = () => setView(token || guestMode ? "blogfeed" : "login");
  // Muro social "Publicaciones": vista full-screen gateada por token (publicar/
  // comentar cuestan tokens). Sin sesión → login.
  const goToPublicacionesView = () => setView(token ? "publicaciones" : "login");
  // Empleos (Jobs marketplace): vista full-screen gateada por token. NO aplica en
  // guestMode (el ítem se oculta para invitados); aquí caemos a login sin sesión.
  const goToJobsView = () => setView(token ? "jobs" : "login");
  // Avatar de la barra de título → abre el dropdown de cuenta (perfiles + items).
  const openAccountMenu = () => {
    setAccountInitialTab("menu");
    setAccountOpen(true);
  };
  // Seguridad ya no es una pantalla: es la pestaña "security" del modal de
  // cuenta. El gate de 2FA lo aplica el propio AccountMenu al activar la
  // pestaña, así que aquí solo abrimos el modal pre-enfocado ahí.
  const goToSecurityView = () => {
    if (!token && !guestMode) { setView("login"); return; }
    setAccountInitialTab("security");
    setAccountOpen(true);
  };

  // Entrar como invitado: SIEMPRE cae al carousel (dashboard). El input opcional
  // puede ser un subdominio/código dinámico o un enlace de invitación
  // (luxipanel://panel-share?token=…). El efecto de canje lo resuelve a paneles.
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
    const parsed = parseIncomingAccessLink(input);
    if (parsed?.token) {
      void pushGuestAccessLink({ token: parsed.token, mode: parsed.mode ?? "guest" }).then(setGuestHistory);
    }
  }, [parseIncomingAccessLink]);

  // Quita una entrada por su clave (token de access-link).
  const removeGuestSubdomainAction = useCallback(async (key: string): Promise<void> => {
    const next = await removeGuestEntry(key);
    setGuestHistory(next);
  }, []);

  const openGuestAdd = useCallback(() => {
    setGuestAddOpen(true);
  }, []);
  const closeGuestAdd = useCallback(() => {
    setGuestAddOpen(false);
  }, []);

  const logout = useCallback(async () => {
    if (guestMode) {
      setGuestMode(false);
      setGuestToken(null);
      void clearGuestSession();
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
      void clearGuestSession();
      setSshUrl("");
      setActivePanelId(null);
      setView("login");
      return;
    }
    await rawSwitchAccount();
  }, [guestMode, rawSwitchAccount]);

  return {
    // Dominios extraídos (sub-hooks ./main-tab/*): mismos nombres y contratos
    // que exponía este controlador antes del troceo.
    ...support,
    ...payments,
    ...taxonomyApi,
    ...connect,
    ...editor,
    ...shareLinks,
    // ── Núcleo (este archivo) ──
    theme, language,
    setLanguage: setLanguageAndSync, toggleTheme: toggleThemeAndSync,
    setTheme: setThemeAndSync,
    view, sshUrl, isDark,
    activePanelId,
    busyPanels,
    panelRows, panelMetrics, onActiveServerPanelChange, visibleServerPanelId, pendingFocusPanelId, clearPendingFocus, focusServerPanel,
    accountRef, accountOpen, setAccountOpen, accountInitialTab, openAccountMenu,
    displayName, userEmail, switchAccount, logout,
    sshKeys,
    refreshSshKeys,
    applySshKeyCreated, applySshKeyUpdated, applySshKeyDeleted,
    token,
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
    },
    isAdmin, currentUserId,
    refreshPanels,
    goToSupportView, goToSecurityView, goToServersView, goToBlogFeedView, goToJobsView, goToPublicacionesView,
    licensedCount, unlicensedCount,
    connectionError, closeConnectionErrorModal: closeConnectionError, reconnect, promptReconnect,
    clearPurchaseResult: clearIapPurchaseResult,
    setSshWebviewUrl,
    enterAsGuest, guestMode, guestToken, effectiveToken, guestHistory,
    guestAddOpen, openGuestAdd, closeGuestAdd,
    removeGuestSubdomainAction,
  };
}
