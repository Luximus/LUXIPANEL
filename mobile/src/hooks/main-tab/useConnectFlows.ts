import { useCallback, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { Alert } from "react-native";
import { connectPanel, connectPanelWithLocalKey, type SshKeySummary } from "../../api/client";
import { getPanelDisplayName, getPanelHost } from "../../features/app/utils";
import { appendNextParam } from "../../features/app/luxipanel-modules";
import { getKeysAttachedToPanel } from "../../features/servers/ssh-keys-store";
import { saveDefaultServer } from "../../storage/defaultServer";
import type { View } from "../../features/app/types";
import type { ConnectionErrorState, ConnectLocalKeyState } from "../../features/app/viewModels";
import type { Panel } from "../../types/models";
import type { Messages } from "../../i18n";
import { localizeCommonError } from "../../lib/error-localization";
import { confirmHostFingerprint } from "./helpers";

/** Firma de `promptReconnect` del controlador (abre el modal de reconexión
 *  unificado guardando el thunk de reintento en su ref). */
type PromptReconnect = (opts: {
  panelName?: string;
  message?: string;
  kind?: "connection" | "session";
  retry?: (() => void | Promise<void>) | null;
}) => void;

/**
 * Sub-hook COHESIVO extraído de `useMainTabController` (fase de refactor <1000
 * líneas): TODOS los flujos de conexión a un panel — sesión SSH directa
 * (webview), conexión nativa directa, resolución de redirectUrl SSO para
 * módulos, modales "¿cómo conectar?" / selector de llave / llave local y los
 * handlers de fallo/expiración de la sesión SSH. Solo useState/useRef/
 * useCallback (CERO efectos): extraerlo no altera el orden de hooks efectivos.
 * Código movido verbatim; el estado compartido (vista, sshUrl, panel activo,
 * modal de error) entra por parámetros.
 */
export function useConnectFlows({
  token,
  effectiveToken,
  guestMode,
  t,
  panels,
  activePanelId,
  setView,
  setSshUrl,
  setActivePanelId,
  setAutoConnectEnabled,
  activeConnectionRef,
  promptReconnect,
  setConnectionError,
}: {
  token: string | null;
  effectiveToken: string | null;
  guestMode: boolean;
  t: Messages;
  panels: Panel[];
  activePanelId: string | null;
  setView: (view: View) => void;
  setSshUrl: (url: string) => void;
  setActivePanelId: (id: string | null) => void;
  setAutoConnectEnabled: (enabled: boolean) => void;
  activeConnectionRef: MutableRefObject<{ panelId: string; panelName: string } | null>;
  promptReconnect: PromptReconnect;
  setConnectionError: Dispatch<SetStateAction<ConnectionErrorState>>;
}) {
  const [connectKeyOpen, setConnectKeyOpen] = useState(false);
  const [connectKeyPanelId, setConnectKeyPanelId] = useState<string | null>(null);
  const [connectKeyOptions, setConnectKeyOptions] = useState<SshKeySummary[]>([]);
  const [connectKeySelectedId, setConnectKeySelectedId] = useState("");
  // Modal "¿cómo conectar?" (SSH guardada vs llave local), igual que desktop.
  const [connectMethod, setConnectMethod] = useState<{ open: boolean; panelId: string | null; panelName: string; hasSavedSsh: boolean }>({
    open: false, panelId: null, panelName: "", hasSavedSsh: false,
  });
  const pendingConnectMethodPanelRef = useRef<Panel | null>(null);
  const [connectLocalKey, setConnectLocalKey] = useState<ConnectLocalKeyState>({
    open: false, panelId: null, panelName: "", username: "", privateKey: "", passphrase: "", busy: false, error: "",
  });
  const pendingLocalKeyPanelRef = useRef<Panel | null>(null);

  /**
   * LP ya NO cobra por conectar: conectar nunca se bloquea por "datos" (MB).
   * Este gate quedó neutralizado (siempre permite) — se conserva la función solo
   * para no reescribir todos sus llamadores. El backend es la única barrera.
   */
  const ensureDataAvailable = useCallback(async (): Promise<boolean> => true, []);

  const [directConnectPanel, setDirectConnectPanel] = useState<Panel | null>(null);
  const [directConnectModuleId, setDirectConnectModuleId] = useState("assistant");

  const openDirectPanelSession = useCallback(async (panel: Panel, _sshKeyId?: string) => {
    const host = getPanelHost(panel);
    if (!host || host === "-") {
      Alert.alert(t.common.error, t.errors.panelHasNoSubdomain);
      return;
    }
    setActivePanelId(panel.id);
    setSshUrl("");
    setView("dashboard");
    void saveDefaultServer(panel.id);
    setDirectConnectModuleId("assistant");
    setDirectConnectPanel(panel);
  }, [t, setActivePanelId, setSshUrl, setView]);

  const connectToPanel = useCallback((panel: Panel, sshKeyId?: string) => {
    void openDirectPanelSession(panel, sshKeyId);
  }, [openDirectPanelSession]);

  // ── Conexión NATIVA directa (reemplaza el webview/gateway del "Conectar") ────
  // El botón "Conectar" de un panel ya NO abre una webview vía redirectUrl SSO:
  // autentica DIRECTO contra el backend LUXIPANEL del box (usuario Linux + 2FA),
  // registra el DirectTarget bajo `panel.id` y abre las PANTALLAS NATIVAS. Este
  // estado lo consume `MainScreen` para montar `DirectPanelConnectScreen` como
  // overlay sobre el dashboard (mismo mecanismo que el gestor standalone). El
  // overlay resuelve `baseUrl` desde el host del panel (`getPanelHost`).

  const openDirectConnect = useCallback((panel: Panel, moduleId = "assistant") => {
    const host = getPanelHost(panel);
    if (!host || host === "-") {
      Alert.alert(t.common.error, t.errors.panelHasNoSubdomain);
      return;
    }
    setActivePanelId(panel.id);
    void saveDefaultServer(panel.id);
    setDirectConnectModuleId(moduleId);
    setDirectConnectPanel(panel);
  }, [t]);
  const closeDirectConnect = useCallback(() => {
    setDirectConnectPanel(null);
    setDirectConnectModuleId("assistant");
  }, []);

  /**
   * Obtiene el `redirectUrl` (SSO) de un panel SIN cambiar la vista — para abrir
   * un MÓDULO de LUXIPANEL como su propia webview persistente (modelo consolas,
   * lo monta MainScreen). Si `nextPath` se pasa, el callback SSO aterriza directo
   * en el módulo (`?next=/panel/<route>`). Reusa el gate de datos
   * (`ensureDataAvailable`), la llave por defecto del panel (como "SSH guardada"
   * de 1 llave; el backend resuelve la credencial en paneles compartidos) y la
   * aprobación TOFU de huella. Devuelve null si no se pudo (sin datos / sin host /
   * fallo de conexión — en ese último caso muestra el modal de error).
   */
  const resolvePanelRedirectUrl = useCallback(async (panel: Panel, nextPath?: string, opts?: { silent?: boolean }): Promise<string | null> => {
    // `silent` (pre-warm en background del carousel): NO muestra ninguna UI — ni el
    // modal de datos, ni el TOFU de huella, ni el modal de error de conexión. Ante
    // cualquier impedimento devuelve null y el pre-warm simplemente no ocurre (el
    // usuario verá los gates normales si abre el panel a mano más tarde).
    const silent = opts?.silent === true;
    if (!effectiveToken) return null;
    // Los invitados NO hacen pre-warm silencioso: abrir una conexión SSH solo por
    // ver la tarjeta consumiría datos del dueño. El connect del invitado es siempre
    // explícito (Fase 2): el backend emite el SSO atribuido al dueño con `luser`.
    if (silent && guestMode) return null;
    const host = getPanelHost(panel);
    if (!host || host === "-") {
      if (!silent) Alert.alert(t.common.error, t.errors.panelHasNoSubdomain);
      return null;
    }
    // LP ya no cobra por conectar: no hay gate de datos ni en silent ni manual.
    const attached = getKeysAttachedToPanel(panel.id);
    const sshKeyId = attached[0]?.id ?? panel.sshKeyId ?? undefined;
    try {
      const result = await connectPanel(
        panel.id,
        effectiveToken,
        sshKeyId ? { sshKeyId } : undefined,
        // En silent NO aprobamos huellas pendientes (rechaza ⇒ connectPanel lanza ⇒
        // pre-warm omitido). Sin silent, pide confirmación TOFU al usuario.
        silent ? () => false : (fp: string) => confirmHostFingerprint(fp, t),
      );
      const redirectUrl = result?.data?.redirectUrl;
      if (!redirectUrl) throw new Error(t.errors.connectionUrlMissing);
      return nextPath ? appendNextParam(redirectUrl, nextPath) : redirectUrl;
    } catch (error) {
      if (!silent) {
        setConnectionError({
          open: true,
          panelName: getPanelDisplayName(panel),
          message: localizeCommonError(error, t, t.errors.connectionFailed),
        });
      }
      return null;
    }
  }, [ensureDataAvailable, guestMode, t, effectiveToken]);

  // ── Connect with a LOCAL SSH key (never persisted) ────────────────
  const openConnectLocalKey = useCallback((panel: Panel) => {
    // The native flow authenticates with the box; the legacy local SSH key
    // dialog must never route to a WebView.
    void openDirectPanelSession(panel);
  }, [openDirectPanelSession]);

  const closeConnectLocalKey = useCallback(() => {
    setConnectLocalKey((cur) => (cur.busy
      ? cur
      : { open: false, panelId: null, panelName: "", username: "", privateKey: "", passphrase: "", busy: false, error: "" }));
    pendingLocalKeyPanelRef.current = null;
  }, []);

  const submitConnectLocalKey = useCallback(async () => {
    const panel = pendingLocalKeyPanelRef.current;
    pendingLocalKeyPanelRef.current = null;
    setConnectLocalKey({ open: false, panelId: null, panelName: "", username: "", privateKey: "", passphrase: "", busy: false, error: "" });
    if (panel) await openDirectPanelSession(panel);
  }, [openDirectPanelSession]);

  const backFromSshToDashboard = () => {
    setAutoConnectEnabled(false);
    activeConnectionRef.current = null;
    setActivePanelId(null);
    setSshUrl("");
    setView("dashboard");
  };

  // Sesión SSO del panel caducada (rebote a /login): vuelve al carousel y abre el
  // modal de reconexión (kind="session") con un reintento que vuelve a entrar al
  // MISMO servidor, para que el usuario continúe donde estaba en vez de quedar
  // varado en el login del panel.
  const handleSshSessionExpired = useCallback(() => {
    const panelId = activePanelId;
    const panel = panelId ? panels.find((p) => p.id === panelId) ?? null : null;
    setAutoConnectEnabled(false);
    activeConnectionRef.current = null;
    setActivePanelId(null);
    setSshUrl("");
    setView("dashboard");
    if (panel) {
      promptReconnect({
        panelName: getPanelDisplayName(panel),
        kind: "session",
        retry: () => openDirectPanelSession(panel),
      });
    }
  }, [activePanelId, panels, promptReconnect, openDirectPanelSession]);

  const closeConnectKeyModal = useCallback(() => {
    setConnectKeyOpen(false);
    setConnectKeyPanelId(null);
    setConnectKeyOptions([]);
    setConnectKeySelectedId("");
  }, []);

  const confirmConnectWithKey = useCallback(async () => {
    if (!connectKeyPanelId || !connectKeySelectedId) {
      Alert.alert(t.common.error, t.errors.selectAtLeastOneSshKey);
      return;
    }
    const panel = panels.find((entry) => entry.id === connectKeyPanelId);
    if (!panel) {
      closeConnectKeyModal();
      return;
    }
    closeConnectKeyModal();
    connectToPanel(panel, connectKeySelectedId);
  }, [closeConnectKeyModal, connectKeyPanelId, connectKeySelectedId, connectToPanel, panels, t]);

  // ── Modal "¿cómo conectar?" (igual que desktop/frontend) ──────────────
  const closeConnectMethod = useCallback(() => {
    setConnectMethod({ open: false, panelId: null, panelName: "", hasSavedSsh: false });
    pendingConnectMethodPanelRef.current = null;
  }, []);

  /**
   * Abre el modal de método. Si el panel NO tiene SSH guardada, salta directo a
   * la llave local (no hay credenciales que ofrecer); con SSH guardada SIEMPRE
   * muestra el modal (tenga 1 o varias llaves).
   */
  const openConnectMethod = useCallback((panel: Panel) => {
    const host = getPanelHost(panel);
    if (!host || host === "-") {
      Alert.alert(t.common.error, t.errors.panelHasNoSubdomain);
      return;
    }
    const isSharedPanel = panel.ownership === "shared";
    const hasSavedSsh = isSharedPanel
      ? true
      : Boolean(
          panel.serverIp
          && panel.sshSaveCredentials
          && ((panel.sshKeyIds?.length ?? 0) > 0 || panel.sshKeyId || panel.sshUsername),
        );
    if (!hasSavedSsh) {
      openConnectLocalKey(panel);
      return;
    }
    pendingConnectMethodPanelRef.current = panel;
    // Nombre del modal: usa `getPanelDisplayName` (nombre de licencia o SOLO el
    // subdominio), nunca el host completo `subdominio.luxipanel.com`.
    setConnectMethod({ open: true, panelId: panel.id, panelName: getPanelDisplayName(panel), hasSavedSsh });
  }, [openConnectLocalKey, t]);

  // "Usar SSH guardada": con >1 llave asignada abre el selector de cuenta; con
  // una sola conecta directo dejando que el backend resuelva la credencial.
  const confirmConnectMethodSaved = useCallback(async () => {
    const panel = pendingConnectMethodPanelRef.current;
    closeConnectMethod();
    if (!panel) return;
    const attached = getKeysAttachedToPanel(panel.id);
    if (attached.length > 1) {
      setConnectKeyPanelId(panel.id);
      setConnectKeyOptions(attached);
      setConnectKeySelectedId(attached[0]?.id ?? "");
      setConnectKeyOpen(true);
      return;
    }
    const sshKeyId = attached[0]?.id ?? panel.sshKeyId ?? undefined;
    connectToPanel(panel, sshKeyId);
  }, [closeConnectMethod, connectToPanel]);

  const confirmConnectMethodLocal = useCallback(() => {
    const panel = pendingConnectMethodPanelRef.current;
    closeConnectMethod();
    if (!panel) return;
    openConnectLocalKey(panel);
  }, [closeConnectMethod, openConnectLocalKey]);

  const handleSshLoadFailed = useCallback((errorCode: number, errorDescription: string) => {
    if (errorCode === -3) return;
    const active = activeConnectionRef.current;
    // El panel sigue identificado por `activePanelId` aunque `activeConnectionRef`
    // ya se haya limpiado (se vacía al cargar OK): así un fallo a MITAD de sesión
    // (servidor que se cae / se va el internet) también puede reintentar.
    const panelId = active?.panelId ?? activePanelId;
    const panel = panelId ? panels.find((p) => p.id === panelId) ?? null : null;
    const panelName = active?.panelName ?? (panel ? getPanelDisplayName(panel) : "");
    activeConnectionRef.current = null;
    setActivePanelId(null);
    setAutoConnectEnabled(false);
    setSshUrl("");
    setView("dashboard");
    promptReconnect({
      panelName,
      message: localizeCommonError(errorDescription, t, t.errors.connectionFailed),
      kind: "connection",
      retry: panel ? () => openDirectPanelSession(panel) : null,
    });
  }, [activePanelId, panels, promptReconnect, t, openDirectPanelSession]);

  const handleSshConnected = useCallback(() => {
    activeConnectionRef.current = null;
  }, []);

  return {
    ensureDataAvailable,
    openDirectPanelSession,
    connectToPanel,
    resolvePanelRedirectUrl,
    connectKeyOpen, connectKeyOptions, connectKeySelectedId, setConnectKeySelectedId,
    closeConnectKeyModal, confirmConnectWithKey,
    connectMethod, closeConnectMethod, openConnectMethod, confirmConnectMethodSaved, confirmConnectMethodLocal,
    connectLocalKey, setConnectLocalKey, openConnectLocalKey, closeConnectLocalKey, submitConnectLocalKey,
    directConnectPanel, directConnectModuleId, openDirectConnect, closeDirectConnect,
    backFromSshToDashboard, handleSshSessionExpired,
    handleSshLoadFailed, handleSshConnected,
  };
}
