import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { connectPanel, connectPanelWithLocalKey, type SshKeySummary } from "../../api/client";
import type { ToastApi } from "../../components/ToastProvider";
import type { Messages } from "../../i18n/messages";
import type { View } from "../../features/app/types";
import type { ConnectionErrorState, ConnectKeyState, ConnectLocalKeyState, ConnectMethodState } from "../../features/app/viewModels";
import { getPanelDisplayName, getPanelHost } from "../../features/app/utils";
import { formatMessage } from "../../i18n";
import { saveDefaultServer } from "../../storage/defaultServer";
import type { Panel } from "../../types/models";

/**
 * Flujos de conexión vía gateway (`connectPanel`) del controlador de pestaña
 * principal. `connectPanel` emite un ticket SSO de un solo uso; SshScreen lo
 * canjea y monta el workspace React local para el servidor. Los flujos de
 * llave local y selección de llave conservan el mismo destino.
 */
export function useConnectFlows({ token, t, toast, panels, sshKeys, ensureDataAvailable, activeConnectionRef, setActivePanelId, setSshUrl, setView, setConnectionError }: {
  token: string | null;
  t: Messages;
  toast: ToastApi;
  panels: Panel[];
  sshKeys: SshKeySummary[];
  ensureDataAvailable: () => boolean;
  /** Ref compartida del controlador (conexión gateway en curso). Tipo
   *  estructural para no depender de MutableRefObject (deprecado en React 19). */
  activeConnectionRef: { current: { panelId: string; panelName: string } | null };
  setActivePanelId: Dispatch<SetStateAction<string | null>>;
  setSshUrl: Dispatch<SetStateAction<string>>;
  setView: Dispatch<SetStateAction<View>>;
  setConnectionError: Dispatch<SetStateAction<ConnectionErrorState>>;
}) {
  const [connectLocalKey, setConnectLocalKey] = useState<ConnectLocalKeyState>({ open: false, panelId: null, panelName: "", username: "", privateKey: "", passphrase: "", busy: false, error: "" });
  const [connectMethod, setConnectMethod] = useState<ConnectMethodState>({ open: false, panelId: null, panelName: "", hasSavedSsh: false });
  const [connectKey, setConnectKey] = useState<ConnectKeyState>({ open: false, panelId: null, panelName: "", keys: [], selectedKeyId: "" });
  const pendingConnectMethodPanelRef = useRef<Panel | null>(null);

  const performConnect = (panel: Panel, sshKeyId?: string) => {
    if (!token) return;
    const host = getPanelHost(panel);
    if (!host || host === "-") {
      toast.error(t.errors.panelHasNoSubdomain);
      return;
    }
    // Conectar al panel no consume saldo de datos del portal.
    const panelName = getPanelDisplayName(panel);
    // Show a loading screen while /connect returns a one-use SSO handoff URL.
    activeConnectionRef.current = { panelId: panel.id, panelName };
    setActivePanelId(panel.id);
    setConnectionError({ open: false, panelName: "", message: "" });
    setSshUrl("");
    setView("loading-panel");
    void saveDefaultServer(panel.id);
    void (async () => {
      try {
        const res = await connectPanel(
          panel.id,
          token,
          sshKeyId ? { sshKeyId } : undefined,
          (fingerprint) => window.confirm(formatMessage(t.sshFingerprint.body, { fingerprint })),
        );
        if (activeConnectionRef.current?.panelId !== panel.id) return;
        const redirectUrl = res.data?.redirectUrl;
        if (!redirectUrl) throw new Error(t.errors.connectionFailed);
        setSshUrl(redirectUrl);
        setView("ssh");
      } catch (error) {
        if (activeConnectionRef.current?.panelId !== panel.id) return;
        activeConnectionRef.current = null;
        setView("dashboard");
        setSshUrl("");
        setConnectionError({
          open: true,
          panelName,
          message: error instanceof Error ? error.message : t.errors.connectionFailed,
        });
      }
    })();
  };

  // ── Connect with a LOCAL SSH key (never persisted) ────────────────
  const pendingLocalKeyPanelRef = useRef<Panel | null>(null);

  const openConnectLocalKey = (panel: Panel) => {
    const host = getPanelHost(panel);
    if (!host || host === "-") {
      toast.error(t.errors.panelHasNoSubdomain);
      return;
    }
    pendingLocalKeyPanelRef.current = panel;
    setConnectLocalKey({
      open: true,
      panelId: panel.id,
      panelName: getPanelDisplayName(panel),
      username: "",
      privateKey: "",
      passphrase: "",
      busy: false,
      error: "",
    });
  };

  const closeConnectLocalKey = useCallback(() => {
    setConnectLocalKey((cur) => (cur.busy
      ? cur
      : { open: false, panelId: null, panelName: "", username: "", privateKey: "", passphrase: "", busy: false, error: "" }));
    pendingLocalKeyPanelRef.current = null;
  }, []);

  // Keys the user owns that are assigned to this panel (panelIds includes it).
  const getKeysAttachedToPanel = (panelId: string): SshKeySummary[] => (
    sshKeys.filter((key) => Array.isArray(key.panelIds) && key.panelIds.includes(panelId))
  );

  const closeConnectMethod = useCallback(() => {
    setConnectMethod({ open: false, panelId: null, panelName: "", hasSavedSsh: false });
    pendingConnectMethodPanelRef.current = null;
  }, []);

  // NOTE: plain functions on purpose. Memoizing these with useCallback froze a
  // first-render closure where `token` was still null (auth restores after
  // mount), so `performConnect` bailed out at its `if (!token) return` guard
  // and "SSH guardada" did nothing.
  const confirmConnectMethodSaved = async () => {
    const panel = pendingConnectMethodPanelRef.current;
    closeConnectMethod();
    if (!panel) return;
    // If more than one saved key is assigned to this panel, let the user pick
    // which one to connect with (same as /frontend and /app). With a single
    // key (or none) we connect straight away and let the backend resolve it.
    const attached = getKeysAttachedToPanel(panel.id);
    if (attached.length > 1) {
      setConnectKey({
        open: true,
        panelId: panel.id,
        panelName: getPanelDisplayName(panel),
        keys: attached,
        selectedKeyId: attached[0]?.id ?? "",
      });
      return;
    }
    const sshKeyId = attached[0]?.id ?? panel.sshKeyId ?? undefined;
    performConnect(panel, sshKeyId);
  };

  const confirmConnectMethodLocal = () => {
    const panel = pendingConnectMethodPanelRef.current;
    closeConnectMethod();
    if (!panel) return;
    openConnectLocalKey(panel);
  };

  const setConnectKeySelectedId = (selectedKeyId: string) => {
    setConnectKey((current) => ({ ...current, selectedKeyId }));
  };

  const closeConnectKeyModal = useCallback(() => {
    setConnectKey({ open: false, panelId: null, panelName: "", keys: [], selectedKeyId: "" });
  }, []);

  const confirmConnectWithKey = async () => {
    const { panelId, selectedKeyId } = connectKey;
    closeConnectKeyModal();
    if (!panelId || !selectedKeyId) return;
    const panel = panels.find((entry) => entry.id === panelId);
    if (!panel) return;
    performConnect(panel, selectedKeyId);
  };

  const submitConnectLocalKey = async () => {
    if (!token) return;
    const snap = connectLocalKey;
    const panel = pendingLocalKeyPanelRef.current;
    if (!snap.panelId || !panel) return;
    const username = snap.username.trim();
    const privateKey = snap.privateKey.trim();
    if (!username) {
      setConnectLocalKey((c) => ({ ...c, error: t.errors.sshLocalUsernameRequired, failedField: "username" }));
      return;
    }
    if (!privateKey) {
      setConnectLocalKey((c) => ({ ...c, error: t.errors.sshLocalKeyRequired, failedField: "privateKey" }));
      return;
    }
    if (!ensureDataAvailable()) return;
    const panelName = snap.panelName;
    setConnectLocalKey((c) => ({ ...c, busy: true, error: "", failedField: null }));
    try {
      const res = await connectPanelWithLocalKey(
        snap.panelId,
        { localSshKey: privateKey, localSshUsername: username, passphrase: snap.passphrase || undefined },
        token,
        (fingerprint) => window.confirm(formatMessage(t.sshFingerprint.body, { fingerprint })),
      );
      // Open the DYNAMIC rotating subdomain the backend returns, not the static
      // managed host (mirrors /frontend and performConnect).
      const redirectUrl = res.data?.redirectUrl;
      if (!redirectUrl) throw new Error(t.errors.connectionFailed);
      // The local key lives only in memory; drop it as soon as we hand off.
      pendingLocalKeyPanelRef.current = null;
      activeConnectionRef.current = { panelId: panel.id, panelName };
      setActivePanelId(panel.id);
      setConnectionError({ open: false, panelName: "", message: "" });
      setConnectLocalKey({ open: false, panelId: null, panelName: "", username: "", privateKey: "", passphrase: "", busy: false, error: "" });
      setSshUrl(redirectUrl);
      setView("ssh");
      void saveDefaultServer(panel.id);
    } catch (error) {
      setConnectLocalKey((c) => ({
        ...c,
        busy: false,
        error: error instanceof Error ? error.message : t.errors.connectionFailed,
      }));
    }
  };

  return {
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
  };
}
